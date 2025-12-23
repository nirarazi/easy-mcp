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
} from "../../interface/mcp-protocol.interface";
import { ToolNotFoundError, ToolExecutionError } from "../errors/easy-mcp-error";
import { CONFIG_TOKEN } from "../../config/constants";
import { ConfigHolderService } from "../../config/config-holder.service";
import { VERSION, PACKAGE_NAME } from "../../config/version";
import { validateToolArguments } from "../utils/schema-validator";
import { logger } from "../utils/logger.util";
import { sanitizeToolResult, sanitizeErrorMessage } from "../utils/sanitize.util";

@Injectable()
export class McpServerService implements OnModuleInit {
  // Store client identifier from initialize request for audit logging
  private clientIdentifier: string = "stdio-client";

  constructor(
    private readonly toolRegistry: ToolRegistryService,
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

    // Validate protocol version - currently only 2024-11-05 is supported
    const SUPPORTED_PROTOCOL_VERSION = "2024-11-05";
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

    const result: InitializeResult = {
      protocolVersion: SUPPORTED_PROTOCOL_VERSION,
      capabilities: {
        tools: {},
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
    const mcpTools: McpTool[] = tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      inputSchema: tool.function.parameters,
    }));

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

    // Validate arguments against tool schema
    const validationError = validateToolArguments(
      args,
      tool.parameters,
      tool.required,
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
          expectedParams: Object.keys(tool.parameters),
          requiredParams: tool.required,
        });
      }
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        `Tool '${toolName}' validation failed: ${validationError}. Check the tool schema and ensure all required parameters are provided.`,
      );
    }

    try {
      const toolResult: unknown = await this.toolRegistry.executeTool(toolName, args);

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
}
