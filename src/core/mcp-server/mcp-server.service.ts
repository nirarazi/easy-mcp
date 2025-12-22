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
import { validateToolArguments } from "../utils/schema-validator";
import { logger } from "../utils/logger.util";
import { sanitizeToolArgs, sanitizeToolResult } from "../utils/sanitize.util";

@Injectable()
export class McpServerService implements OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistryService,
    @Inject(INTERFACE_LAYER_TOKEN)
    private readonly interfaceLayer: IInterfaceLayer,
    private readonly stdioGatewayService: StdioGatewayService,
    @Inject(CONFIG_TOKEN)
    private readonly configHolder: ConfigHolderService,
  ) {}

  private getServerInfo() {
    const config = this.configHolder.getConfig();
    return config.serverInfo || {
      name: "easy-mcp-framework",
      version: "0.1.0",
    };
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
    try {
      let response: JsonRpcResponse;
      switch (request.method) {
        case "initialize":
          response = await this.handleInitialize(request);
          logger.audit(
            "McpServerService",
            "initialize",
            response.error ? "failure" : "success",
            { method: request.method },
            request.id,
          );
          return response;
        case "tools/list":
          response = await this.handleListTools(request);
          logger.audit(
            "McpServerService",
            "tools/list",
            response.error ? "failure" : "success",
            { method: request.method },
            request.id,
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
        error: error instanceof Error ? error.message : "Unknown error",
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
   */
  private async handleInitialize(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    const params = request.params as InitializeParams | undefined;

    if (!params || typeof params.protocolVersion !== "string") {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        "Missing or invalid protocolVersion",
      );
    }

    const result: InitializeResult = {
      protocolVersion: "2024-11-05",
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
  private async handleListTools(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
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
   */
  private async handleCallTool(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    const params = request.params as CallToolParams | undefined;

    if (!params) {
      logger.audit(
        "McpServerService",
        "tools/call",
        "failure",
        { reason: "Missing params", method: request.method },
        request.id,
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
      );
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        "Missing or invalid tool name",
      );
    }

    const toolName = params.name;
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
      );
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        validationError,
      );
    }

    try {
      // Audit log: Tool execution started
      logger.audit(
        "McpServerService",
        "tools/call",
        "success",
        {
          toolName,
          sanitizedArgs: sanitizeToolArgs(args),
          method: request.method,
        },
        request.id,
      );

      const toolResult = await this.toolRegistry.executeTool(toolName, args);

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
        error: error instanceof Error ? error.message : "Unknown error",
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
