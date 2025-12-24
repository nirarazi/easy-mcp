import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { ToolRegistryService } from "../../tooling/tool-registry/tool-registry.service";
import { INTERFACE_LAYER_TOKEN } from "../../config/constants";
import { type IInterfaceLayer } from "../../interface/interface.interface";
import { StdioGatewayService } from "../../interface/stdio-gateway.service";
import {
  JsonRpcRequest,
  JsonRpcResponse,
  createJsonRpcSuccess,
  createJsonRpcError,
  JsonRpcErrorCode,
} from "../../interface/jsonrpc.interface";
import {
  InitializeParams,
  InitializeResult,
  ListToolsResult,
  McpTool,
  CallToolParams,
  CallToolResult,
  McpErrorCode,
  ListResourcesResult,
  McpResource,
  ReadResourceParams,
  ReadResourceResult,
  ListPromptsResult,
  McpPrompt,
  GetPromptParams,
  GetPromptResult,
  SamplingRequestParams,
  SamplingResult,
  ListRootsResult,
  ReadRootParams,
  ReadRootResult,
  ElicitParams,
  ElicitResult,
} from "../../interface/mcp-protocol.interface";
import { ResourceRegistryService } from "../../resources/resource-registry.service";
import { PromptRegistryService } from "../../prompts/prompt-registry.service";
import { ToolNotFoundError, ToolExecutionError } from "../errors/easy-mcp-error";
import { CONFIG_TOKEN } from "../../config/constants";
import { ConfigHolderService } from "../../config/config-holder.service";
import { VERSION, PACKAGE_NAME } from "../../config/version";
import { validateToolArguments } from "../utils/schema-validator";
import { logger } from "../utils/logger.util";
import { sanitizeToolResult, sanitizeErrorMessage, sanitizeUri, sanitizeName } from "../utils/sanitize.util";
import { CancellationToken } from "../../tooling/tool.interface";
import { MAX_RESOURCE_CONTENT_SIZE_BYTES, MAX_CANCELLATION_TOKENS } from "../../config/constants";

@Injectable()
export class McpServerService implements OnModuleInit {
  // Store client identifier from initialize request for audit logging
  private clientIdentifier: string = "stdio-client";
  // Map of request IDs to cancellation tokens for handling $/cancelRequest
  private readonly cancellationTokens = new Map<string | number, CancellationToken>();

  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly resourceRegistry: ResourceRegistryService,
    private readonly promptRegistry: PromptRegistryService,
    @Inject(INTERFACE_LAYER_TOKEN)
    private readonly interfaceLayer: IInterfaceLayer,
    private readonly stdioGatewayService: StdioGatewayService,
    @Inject(CONFIG_TOKEN)
    private readonly configHolder: ConfigHolderService,
  ) {}

  private getServerInfo(): { name: string; version: string } {
    const config = this.configHolder.getConfig();
    const defaultInfo: { name: string; version: string } = {
      name: PACKAGE_NAME,
      version: VERSION,
    };
    return (config.serverInfo as { name: string; version: string } | undefined) ?? defaultInfo;
  }

  /**
   * Extracts actor identifier from request for audit logging.
   * Uses clientInfo from initialize request if available, otherwise uses stored client identifier.
   * 
   * Note: The actor identifier is client-supplied and not authenticated/verified.
   * This is acceptable for local stdio usage where the client process is trusted,
   * but should not be relied upon for security-critical authorization decisions.
   * For production deployments requiring strict access control, additional authentication
   * mechanisms should be implemented at the transport layer or application level.
   */
  private getActorIdentifier(request: JsonRpcRequest): string {
    // For initialize requests, extract client identifier from clientInfo
    if (request.method === "initialize") {
      const params = request.params as InitializeParams | undefined;
      if (params?.clientInfo?.name) {
        this.clientIdentifier = params.clientInfo.name;
        return this.clientIdentifier;
      }
    }
    // For all other requests, use stored client identifier
    return this.clientIdentifier;
  }

  onModuleInit() {
    this.stdioGatewayService.setMcpServerService(this);
    logger.info("McpServerService", "Circular dependency resolved", {
      component: "Layer 3",
    });
  }

  /**
   * Implements the startListening() method by delegating network startup to Layer 1.
   */
  public async startListening(): Promise<void> {
    logger.info("McpServerService", "Initiating Layer 1 Interface startup", {
      component: "Layer 3: Abstraction Core",
    });
    await this.interfaceLayer.start();
    logger.info("McpServerService", "McpServerService is operational and awaiting Layer 1 input", {
      component: "Layer 3",
    });
  }

  /**
   * Handles JSON-RPC requests and routes them to appropriate MCP protocol methods.
   */
  public async handleRequest(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    const isDebugMode = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
    
    if (isDebugMode) {
      logger.debug("McpServerService", "Received JSON-RPC request", {
        method: request.method,
        requestId: request.id,
        hasParams: !!request.params,
      });
    }

    try {
      let response: JsonRpcResponse;
      switch (request.method) {
        case "initialize":
          response = this.handleInitialize(request);
          if (isDebugMode) {
            const initResult = response.result as InitializeResult | undefined;
            logger.debug("McpServerService", "Initialize response", {
              protocolVersion: initResult?.protocolVersion,
              hasError: !!response.error,
              errorCode: response.error?.code,
            });
          }
          logger.audit(
            "McpServerService",
            "initialize",
            response.error ? "failure" : "success",
            { method: request.method },
            request.id,
            this.getActorIdentifier(request),
          );
          return response;
        case "tools/list":
          response = this.handleListTools(request);
          if (isDebugMode) {
            const listResult = response.result as ListToolsResult | undefined;
            logger.debug("McpServerService", "Tools/list response", {
              toolCount: listResult?.tools?.length || 0,
              hasError: !!response.error,
            });
          }
          logger.audit(
            "McpServerService",
            "tools/list",
            response.error ? "failure" : "success",
            { method: request.method },
            request.id,
            this.getActorIdentifier(request),
          );
          return response;
        case "tools/call":
          response = await this.handleCallTool(request);
          // Audit logging for tools/call is done inside handleCallTool for more detail
          return response;
        case "resources/list":
          response = this.handleListResources(request);
          logger.audit(
            "McpServerService",
            "resources/list",
            response.error ? "failure" : "success",
            { method: request.method },
            request.id,
            this.getActorIdentifier(request),
          );
          return response;
        case "resources/read":
          response = await this.handleReadResource(request);
          const readResourceParams = request.params as { uri?: string } | undefined;
          logger.audit(
            "McpServerService",
            "resources/read",
            response.error ? "failure" : "success",
            {
              method: request.method,
              ...(readResourceParams?.uri && { uri: sanitizeUri(readResourceParams.uri) }),
            },
            request.id,
            this.getActorIdentifier(request),
          );
          return response;
        case "prompts/list":
          response = this.handleListPrompts(request);
          logger.audit(
            "McpServerService",
            "prompts/list",
            response.error ? "failure" : "success",
            { method: request.method },
            request.id,
            this.getActorIdentifier(request),
          );
          return response;
        case "prompts/get":
          response = await this.handleGetPrompt(request);
          const getPromptParams = request.params as { name?: string } | undefined;
          logger.audit(
            "McpServerService",
            "prompts/get",
            response.error ? "failure" : "success",
            {
              method: request.method,
              ...(getPromptParams?.name && { promptName: sanitizeName(getPromptParams.name) }),
            },
            request.id,
            this.getActorIdentifier(request),
          );
          return response;
        case "sampling/create":
          response = await this.handleSampling(request);
          logger.audit(
            "McpServerService",
            "sampling/create",
            response.error ? "failure" : "success",
            { method: request.method },
            request.id,
            this.getActorIdentifier(request),
          );
          return response;
        case "roots/list":
          response = this.handleListRoots(request);
          logger.audit(
            "McpServerService",
            "roots/list",
            response.error ? "failure" : "success",
            { method: request.method },
            request.id,
            this.getActorIdentifier(request),
          );
          return response;
        case "roots/read":
          response = await this.handleReadRoot(request);
          logger.audit(
            "McpServerService",
            "roots/read",
            response.error ? "failure" : "success",
            { method: request.method },
            request.id,
            this.getActorIdentifier(request),
          );
          return response;
        case "elicitation/elicit":
          response = await this.handleElicitation(request);
          logger.audit(
            "McpServerService",
            "elicitation/elicit",
            response.error ? "failure" : "success",
            { method: request.method },
            request.id,
            this.getActorIdentifier(request),
          );
          return response;
        case "$/cancelRequest":
          // This is a notification (id is null), so we handle it but don't return a response
          this.handleCancelRequest(request);
          // Return a special marker to indicate this was a notification
          return { jsonrpc: "2.0", id: null } as JsonRpcResponse;
        default:
          logger.warn("McpServerService", "Method not found", {
            component: "Layer 3",
            method: request.method,
            requestId: request.id,
          });
          return createJsonRpcError(
            request.id,
            JsonRpcErrorCode.MethodNotFound,
            `Method not found: ${request.method}`,
          );
      }
    } catch (error) {
      logger.error("McpServerService", "Unhandled error in handleRequest", {
        component: "Layer 3",
        method: request.method,
        requestId: request.id,
        error: sanitizeErrorMessage(error),
      });
      // Never expose internal error details to client
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InternalError,
        "Internal error",
      );
    }
  }

  /**
   * Handles the initialize request.
   * Returns server capabilities and protocol version.
   * Validates that the client's protocol version is supported.
   */
  private handleInitialize(
    request: JsonRpcRequest,
  ): JsonRpcResponse {
    const params = request.params as InitializeParams | undefined;

    if (!params || typeof params.protocolVersion !== "string") {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        "Missing or invalid protocolVersion",
      );
    }

    // Validate protocol version - support multiple versions for compatibility
    // 2024-11-05: Legacy version
    // 2025-06-18: Intermediate version (used by Cursor)
    // 2025-11-25: Current/latest version
    const SUPPORTED_PROTOCOL_VERSIONS = ["2024-11-05", "2025-06-18", "2025-11-25"];
    const PRIMARY_PROTOCOL_VERSION = "2025-11-25";
    
    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(params.protocolVersion)) {
      logger.warn("McpServerService", "Unsupported protocol version", {
        component: "Layer 3",
        clientVersion: params.protocolVersion,
        supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
        requestId: request.id,
        clientName: params.clientInfo?.name || 'unknown',
      });
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        `Unsupported protocol version: ${params.protocolVersion}. Supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')}. Please update your client to use protocol version ${PRIMARY_PROTOCOL_VERSION}.`,
      );
    }
    
    // Log if using legacy or intermediate version
    if (params.protocolVersion !== PRIMARY_PROTOCOL_VERSION) {
      logger.info("McpServerService", "Client using non-primary protocol version", {
        component: "Layer 3",
        clientVersion: params.protocolVersion,
        recommendedVersion: PRIMARY_PROTOCOL_VERSION,
        requestId: request.id,
        clientName: params.clientInfo?.name || 'unknown',
      });
    }

    const config = this.configHolder.getConfig();
    const hasResources = config.resources && config.resources.length > 0;
    const hasPrompts = config.prompts && config.prompts.length > 0;
    
    // Respond with the client's requested protocol version (or primary if client requests newer)
    // This ensures compatibility - server responds with the version it supports that matches client's request
    const responseProtocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(params.protocolVersion)
      ? params.protocolVersion
      : PRIMARY_PROTOCOL_VERSION;
    
    const result: InitializeResult = {
      protocolVersion: responseProtocolVersion,
      capabilities: {
        tools: {},
        ...(hasResources && { resources: {} }),
        ...(hasPrompts && { prompts: {} }),
      },
      serverInfo: this.getServerInfo(),
    };

    return createJsonRpcSuccess(request.id, result);
  }

  /**
   * Handles the tools/list request.
   * Returns all registered tools in MCP format.
   */
  private handleListTools(
    request: JsonRpcRequest,
  ): JsonRpcResponse {
    const tools = this.toolRegistry.getToolSchemasForLLM();
    
    const mcpTools: McpTool[] = tools.map((tool) => {
      // Get tool definition to access icon
      const toolDef = this.toolRegistry.getTool(tool.function.name);
      return {
        name: tool.function.name,
        description: tool.function.description,
        inputSchema: tool.function.parameters,
        ...(toolDef?.icon && { icon: toolDef.icon }),
      };
    });

    const result: ListToolsResult = {
      tools: mcpTools,
    };

    return createJsonRpcSuccess(request.id, result);
  }

  /**
   * Handles the tools/call request.
   * Executes the requested tool and returns the result.
   * Includes comprehensive audit logging for security and compliance.
   * 
   * Note: This implementation does not perform authorization checks to determine
   * which callers may execute which tools. This is acceptable for local stdio usage
   * where the client process is trusted, but may require additional authorization
   * mechanisms for production deployments with untrusted clients or multi-tenant scenarios.
   * Tool execution is validated for shape and schema, but access control is delegated
   * to the operating system's process isolation model.
   */
  private async handleCallTool(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    const params = request.params as CallToolParams | undefined;

    const actorId = this.getActorIdentifier(request);

    if (!params) {
      logger.audit(
        "McpServerService",
        "tools/call",
        "failure",
        { reason: "Missing params", method: request.method },
        request.id,
        actorId,
      );
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        "Missing params",
      );
    }

    if (!params.name || typeof params.name !== "string") {
      logger.audit(
        "McpServerService",
        "tools/call",
        "failure",
        { reason: "Missing or invalid tool name", method: request.method },
        request.id,
        actorId,
      );
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        "Missing or invalid tool name",
      );
    }

    const toolName = params.name;
    
    // Validate that arguments is a plain object (not array, string, etc.)
    if (params.arguments !== undefined && params.arguments !== null) {
      if (
        typeof params.arguments !== "object" ||
        Array.isArray(params.arguments)
      ) {
        logger.audit(
          "McpServerService",
          "tools/call",
          "failure",
          {
            reason: "Invalid arguments type - must be a plain object",
            toolName: sanitizeName(toolName),
            method: request.method,
          },
          request.id,
          actorId,
        );
        return createJsonRpcError(
          request.id,
          JsonRpcErrorCode.InvalidParams,
          "Arguments must be a plain object",
        );
      }
    }
    
    const args = params.arguments || {};

    // Get tool definition for schema validation
    const tool = this.toolRegistry.getTool(toolName);
    if (!tool) {
      logger.audit(
        "McpServerService",
        "tools/call",
        "failure",
        {
          reason: "Tool not found",
          toolName: sanitizeName(toolName),
          method: request.method,
        },
        request.id,
        actorId,
      );
      return createJsonRpcError(
        request.id,
        McpErrorCode.ToolNotFound,
        "Tool not found",
      );
    }

    // Validate arguments against tool schema (JSON Schema 2020-12)
    const validationError = validateToolArguments(
      args,
      tool.inputSchema,
    );
    if (validationError) {
      logger.audit(
        "McpServerService",
        "tools/call",
        "failure",
        {
          reason: "Invalid arguments",
          toolName: sanitizeName(toolName),
          validationError,
          method: request.method,
        },
        request.id,
        actorId,
      );
      const isDebugMode = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
      if (isDebugMode) {
        logger.debug("McpServerService", "Tool argument validation failed", {
          toolName: sanitizeName(toolName),
          validationError,
          providedArgs: Object.keys(args),
          expectedParams:
            tool.inputSchema.properties &&
            typeof tool.inputSchema.properties === "object" &&
            !Array.isArray(tool.inputSchema.properties)
              ? Object.keys(tool.inputSchema.properties)
              : [],
          requiredParams: Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : [],
        });
      }
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        `Tool '${toolName}' validation failed: ${validationError}. Check the tool schema and ensure all required parameters are provided.`,
      );
    }

    // Create cancellation token for this request
    const cancellationToken: CancellationToken = {
      isCancelled: false,
      onCancel: () => {}, // Placeholder for event listener
      cancel: () => {
        cancellationToken.isCancelled = true;
      },
    };

    // Store cancellation token for this request if it has an ID
    // Enforce size limit to prevent memory DoS
    if (request.id !== null && request.id !== undefined) {
      // If map is at capacity, remove oldest entry (simple FIFO eviction)
      if (this.cancellationTokens.size >= MAX_CANCELLATION_TOKENS) {
        const firstKey = this.cancellationTokens.keys().next().value;
        if (firstKey !== undefined) {
          this.cancellationTokens.delete(firstKey);
        }
      }
      this.cancellationTokens.set(request.id, cancellationToken);
    }

    try {
      const toolResult: unknown = await this.toolRegistry.executeTool(toolName, args, cancellationToken);
      
      // Check if cancelled during execution
      if (cancellationToken.isCancelled) {
        return createJsonRpcError(
          request.id,
          McpErrorCode.RequestCancelled,
          "Request was cancelled",
        );
      }

      // Sanitize result to prevent sensitive data exposure
      const sanitizedResult = sanitizeToolResult(toolResult);

      const result: CallToolResult = {
        content: [
          {
            type: "text",
            text: sanitizedResult,
          },
        ],
        isError: false,
      };

      // Audit log: Tool execution completed successfully
      logger.audit(
        "McpServerService",
        "tools/call",
        "success",
        {
          toolName: sanitizeName(toolName),
          resultSize: sanitizedResult.length,
          method: request.method,
        },
        request.id,
        actorId,
      );

      return createJsonRpcSuccess(request.id, result);
    } catch (error) {
      // Handle tool-specific errors
      if (error instanceof ToolNotFoundError) {
        logger.audit(
          "McpServerService",
          "tools/call",
          "failure",
          {
            reason: "ToolNotFoundError",
            toolName: sanitizeName(toolName),
            method: request.method,
          },
          request.id,
          actorId,
        );
        return createJsonRpcError(
          request.id,
          McpErrorCode.ToolNotFound,
          "Tool not found",
        );
      }

      if (error instanceof ToolExecutionError) {
        logger.audit(
          "McpServerService",
          "tools/call",
          "failure",
          {
            reason: "ToolExecutionError",
            toolName: sanitizeName(toolName),
            method: request.method,
          },
          request.id,
          actorId,
        );
        // Use JSON-RPC error instead of success with isError flag
        return createJsonRpcError(
          request.id,
          McpErrorCode.ToolExecutionError,
          "Tool execution failed",
        );
      }

      // Unknown error - log for debugging but don't expose details to client
      logger.error("McpServerService", "Unknown error during tool execution", {
        component: "Layer 3",
        toolName: sanitizeName(toolName),
        requestId: request.id,
        error: sanitizeErrorMessage(error),
      });

      logger.audit(
        "McpServerService",
        "tools/call",
        "failure",
        {
          reason: "Unknown error",
          toolName: sanitizeName(toolName),
          method: request.method,
        },
        request.id,
        actorId,
      );

      // Never expose internal error details to client
      return createJsonRpcError(
        request.id,
        McpErrorCode.ToolExecutionError,
        "Tool execution failed",
      );
    } finally {
      // Clean up the cancellation token after the request is finished
      if (request.id !== null && request.id !== undefined) {
        this.cancellationTokens.delete(request.id);
      }
    }
  }

  /**
   * Handles the $/cancelRequest notification.
   * Cancels the request with the specified requestId if it exists.
   */
  private handleCancelRequest(request: JsonRpcRequest): void {
    const params = request.params as { requestId?: string | number } | undefined;
    if (params?.requestId !== undefined) {
      const token = this.cancellationTokens.get(params.requestId);
      if (token) {
        token.cancel();
        logger.debug("McpServerService", "Request cancelled", {
          component: "Layer 3",
          requestId: params.requestId,
        });
      }
    }
  }

  /**
   * Handles the resources/list request.
   * Returns all registered resources in MCP format.
   */
  private handleListResources(
    request: JsonRpcRequest,
  ): JsonRpcResponse {
    const resources = this.resourceRegistry.getAllResources();
    const mcpResources: McpResource[] = resources.map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      ...(resource.description && { description: resource.description }),
      ...(resource.mimeType && { mimeType: resource.mimeType }),
      ...(resource.icon && { icon: resource.icon }),
    }));

    const result: ListResourcesResult = {
      resources: mcpResources,
    };

    return createJsonRpcSuccess(request.id, result);
  }

  /**
   * Handles the resources/read request.
   * Returns the content of the requested resource.
   */
  private async handleReadResource(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    const params = request.params as ReadResourceParams | undefined;

    if (!params || !params.uri || typeof params.uri !== "string") {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        "Missing or invalid uri parameter",
      );
    }

    const resource = this.resourceRegistry.getResource(params.uri);
    if (!resource) {
      // Log URI internally for debugging, but don't expose it in user-facing error
      logger.debug("McpServerService", "Resource not found", {
        component: "Layer 3",
        uri: sanitizeUri(params.uri),
        requestId: request.id,
      });
      return createJsonRpcError(
        request.id,
        McpErrorCode.ResourceNotFound,
        "Resource not found",
      );
    }

    try {
      const content = await this.resourceRegistry.getResourceContent(params.uri);
      
      // Handle different content formats
      let contents: Array<{
        uri: string;
        mimeType?: string;
        text?: string;
        blob?: string;
      }>;

      // Check content size to prevent unbounded response DoS
      let contentSize: number;
      let contentData: string;
      
      if (typeof content === "string") {
        contentData = content;
        contentSize = Buffer.byteLength(content, "utf8");
      } else {
        const contentType = content.type;
        if (contentType !== "text" && contentType !== "blob") {
          logger.error("McpServerService", "Invalid resource content type", {
            component: "Layer 3",
            uri: sanitizeUri(params.uri),
            contentType,
            requestId: request.id,
          });
          return createJsonRpcError(
            request.id,
            JsonRpcErrorCode.InternalError,
            "Internal error",
          );
        }

        contentData = content.data;
        // For blob data, estimate size (base64 encoded data is ~33% larger)
        if (contentType === "blob") {
          contentSize = Math.ceil(contentData.length * 0.75); // Approximate decoded size
        } else {
          contentSize = Buffer.byteLength(contentData, "utf8");
        }
      }

      // Enforce size limit
      if (contentSize > MAX_RESOURCE_CONTENT_SIZE_BYTES) {
        logger.error("McpServerService", "Resource content exceeds maximum size", {
          component: "Layer 3",
          uri: sanitizeUri(params.uri),
          contentSize,
          maxSize: MAX_RESOURCE_CONTENT_SIZE_BYTES,
          requestId: request.id,
        });
        return createJsonRpcError(
          request.id,
          JsonRpcErrorCode.InternalError,
          "Resource content too large",
        );
      }

      // Build contents array
      if (typeof content === "string") {
        contents = [{
          uri: params.uri,
          mimeType: resource.mimeType,
          text: contentData,
        }];
      } else {
        const contentType = content.type;
        contents = [{
          uri: params.uri,
          mimeType: content.mimeType || resource.mimeType,
          ...(contentType === "text" ? { text: contentData } : { blob: contentData }),
        }];
      }

      const result: ReadResourceResult = {
        contents,
      };

      return createJsonRpcSuccess(request.id, result);
    } catch (error) {
      logger.error("McpServerService", "Error reading resource", {
        component: "Layer 3",
        uri: sanitizeUri(params.uri),
        requestId: request.id,
        error: sanitizeErrorMessage(error),
      });
      // Use InternalError for read failures (not ResourceNotFound) to distinguish from not-found cases
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InternalError,
        "Internal error",
      );
    }
  }

  /**
   * Handles the prompts/list request.
   * Returns all registered prompts in MCP format.
   */
  private handleListPrompts(
    request: JsonRpcRequest,
  ): JsonRpcResponse {
    const prompts = this.promptRegistry.getAllPrompts();
    const mcpPrompts: McpPrompt[] = prompts.map((prompt) => ({
      name: prompt.name,
      ...(prompt.description && { description: prompt.description }),
      ...(prompt.arguments && { arguments: prompt.arguments }),
      ...(prompt.icon && { icon: prompt.icon }),
    }));

    const result: ListPromptsResult = {
      prompts: mcpPrompts,
    };

    return createJsonRpcSuccess(request.id, result);
  }

  /**
   * Handles the prompts/get request.
   * Returns the prompt content generated from arguments.
   */
  private async handleGetPrompt(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    const params = request.params as GetPromptParams | undefined;

    if (!params || !params.name || typeof params.name !== "string") {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        "Missing or invalid name parameter",
      );
    }

    const prompt = this.promptRegistry.getPrompt(params.name);
    if (!prompt) {
      // Log prompt name internally for debugging, but don't expose it in user-facing error
      logger.debug("McpServerService", "Prompt not found", {
        component: "Layer 3",
        promptName: sanitizeName(params.name),
        requestId: request.id,
      });
      return createJsonRpcError(
        request.id,
        McpErrorCode.PromptNotFound,
        "Prompt not found",
      );
    }

    // Validate that arguments is an object if provided
    if (params.arguments !== undefined && (typeof params.arguments !== "object" || params.arguments === null || Array.isArray(params.arguments))) {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        "Arguments must be a plain object",
      );
    }

    const args = params.arguments || {};

    // Validate required prompt arguments
    if (prompt.arguments) {
      for (const argDef of prompt.arguments.filter(a => a.required)) {
        if (args[argDef.name] === undefined) {
          return createJsonRpcError(
            request.id,
            JsonRpcErrorCode.InvalidParams,
            `Missing required prompt argument: ${argDef.name}`,
          );
        }
      }
    }

    try {
      const messages = await this.promptRegistry.getPromptContent(params.name, args);

      const result: GetPromptResult = {
        messages,
      };

      return createJsonRpcSuccess(request.id, result);
    } catch (error) {
      logger.error("McpServerService", "Error getting prompt", {
        component: "Layer 3",
        promptName: sanitizeName(params.name),
        requestId: request.id,
        error: sanitizeErrorMessage(error),
      });
      // Use InternalError for generation failures (not PromptNotFound) to distinguish from not-found cases
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InternalError,
        "Internal error",
      );
    }
  }

  /**
   * Handles the sampling/create request (client feature).
   * Note: This is a placeholder implementation. Actual sampling requires LLM integration.
   */
  private async handleSampling(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    // Sampling is a client feature - servers typically don't implement this
    // This is a placeholder that returns an error indicating it's not supported
    return createJsonRpcError(
      request.id,
      McpErrorCode.SamplingNotSupported,
      "Sampling is a client feature and is not supported by this server",
    );
  }

  /**
   * Handles the roots/list request (client feature).
   * Returns available root URIs that the server can access.
   */
  private handleListRoots(
    request: JsonRpcRequest,
  ): JsonRpcResponse {
    // Roots allow servers to inquire about URI/filesystem boundaries
    // This is a placeholder - actual implementation would depend on server configuration
    const result: ListRootsResult = {
      roots: [],
    };
    return createJsonRpcSuccess(request.id, result);
  }

  /**
   * Handles the roots/read request (client feature).
   * Reads content from a root URI.
   */
  private async handleReadRoot(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    const params = request.params as ReadRootParams | undefined;

    if (!params || !params.uri || typeof params.uri !== "string") {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        "Missing or invalid uri parameter",
      );
    }

    // Roots is a client feature - this is a placeholder
    return createJsonRpcError(
      request.id,
      McpErrorCode.RootsNotSupported,
      "Roots is a client feature and is not supported by this server",
    );
  }

  /**
   * Handles the elicitation/elicit request (client feature).
   * Requests additional information from the user.
   */
  private async handleElicitation(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    const params = request.params as ElicitParams | undefined;

    if (!params || !params.schema) {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        "Missing or invalid schema parameter",
      );
    }

    // Elicitation is a client feature - this is a placeholder
    return createJsonRpcError(
      request.id,
      McpErrorCode.ElicitationNotSupported,
      "Elicitation is a client feature and is not supported by this server",
    );
  }
}
