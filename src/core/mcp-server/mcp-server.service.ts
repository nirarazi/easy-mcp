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
import { sanitizeToolResult, sanitizeErrorMessage } from "../utils/sanitize.util";
import { CancellationToken } from "../../tooling/tool.interface";

@Injectable()
export class McpServerService implements OnModuleInit {
  // Store client identifier from initialize request for audit logging
  private clientIdentifier: string = "stdio-client";

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
          logger.audit(
            "McpServerService",
            "resources/read",
            response.error ? "failure" : "success",
            { method: request.method },
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
          logger.audit(
            "McpServerService",
            "prompts/get",
            response.error ? "failure" : "success",
            { method: request.method },
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

    // Validate protocol version - currently only 2025-11-25 is supported
    const SUPPORTED_PROTOCOL_VERSION = "2025-11-25";
    if (params.protocolVersion !== SUPPORTED_PROTOCOL_VERSION) {
      logger.warn("McpServerService", "Unsupported protocol version", {
        component: "Layer 3",
        // Don't log client-supplied protocolVersion to avoid logging sensitive data
        supportedVersion: SUPPORTED_PROTOCOL_VERSION,
        requestId: request.id,
      });
      const isDebugMode = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
      if (isDebugMode) {
        logger.debug("McpServerService", "Protocol version mismatch", {
          // Don't log client-supplied data (protocolVersion, clientInfo) to avoid logging sensitive information
          supported: SUPPORTED_PROTOCOL_VERSION,
          // Only log safe metadata: client name if available (already extracted and stored)
          clientName: params.clientInfo?.name || 'unknown',
        });
      }
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        `Unsupported protocol version: ${params.protocolVersion}. Supported version: ${SUPPORTED_PROTOCOL_VERSION}. Please update your client to use protocol version ${SUPPORTED_PROTOCOL_VERSION}.`,
      );
    }

    const config = this.configHolder.getConfig();
    const hasResources = config.resources && config.resources.length > 0;
    const hasPrompts = config.prompts && config.prompts.length > 0;
    
    const result: InitializeResult = {
      protocolVersion: SUPPORTED_PROTOCOL_VERSION,
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
            toolName,
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
          toolName,
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
          toolName,
          validationError,
          method: request.method,
        },
        request.id,
        actorId,
      );
      const isDebugMode = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
      if (isDebugMode) {
        logger.debug("McpServerService", "Tool argument validation failed", {
          toolName,
          validationError,
          providedArgs: Object.keys(args),
          expectedParams: Object.keys(tool.inputSchema.properties || {}),
          requiredParams: tool.inputSchema.required || [],
        });
      }
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        `Tool '${toolName}' validation failed: ${validationError}. Check the tool schema and ensure all required parameters are provided.`,
      );
    }

    // Create cancellation token for this request (basic implementation)
    const cancellationToken: CancellationToken = {
      isCancelled: false,
      onCancel: () => {}, // Placeholder - would be implemented with proper cancellation handling
      cancel: () => {
        cancellationToken.isCancelled = true;
      },
    };

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
          toolName,
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
            toolName,
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
            toolName,
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
        toolName,
        requestId: request.id,
        error: sanitizeErrorMessage(error),
      });

      logger.audit(
        "McpServerService",
        "tools/call",
        "failure",
        {
          reason: "Unknown error",
          toolName,
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
      return createJsonRpcError(
        request.id,
        McpErrorCode.ResourceNotFound,
        `Resource not found: ${params.uri}`,
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

      if (typeof content === "string") {
        contents = [{
          uri: params.uri,
          mimeType: resource.mimeType,
          text: content,
        }];
      } else {
        contents = [{
          uri: params.uri,
          mimeType: content.mimeType || resource.mimeType,
          ...(content.type === "text" ? { text: content.data } : { blob: content.data }),
        }];
      }

      const result: ReadResourceResult = {
        contents,
      };

      return createJsonRpcSuccess(request.id, result);
    } catch (error) {
      logger.error("McpServerService", "Error reading resource", {
        component: "Layer 3",
        uri: params.uri,
        requestId: request.id,
        error: sanitizeErrorMessage(error),
      });
      return createJsonRpcError(
        request.id,
        McpErrorCode.ResourceNotFound,
        `Failed to read resource: ${params.uri}`,
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
      return createJsonRpcError(
        request.id,
        McpErrorCode.PromptNotFound,
        `Prompt not found: ${params.name}`,
      );
    }

    try {
      const args = params.arguments || {};
      const messages = await this.promptRegistry.getPromptContent(params.name, args);

      const result: GetPromptResult = {
        messages,
      };

      return createJsonRpcSuccess(request.id, result);
    } catch (error) {
      logger.error("McpServerService", "Error getting prompt", {
        component: "Layer 3",
        promptName: params.name,
        requestId: request.id,
        error: sanitizeErrorMessage(error),
      });
      return createJsonRpcError(
        request.id,
        McpErrorCode.PromptNotFound,
        `Failed to get prompt: ${params.name}`,
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
