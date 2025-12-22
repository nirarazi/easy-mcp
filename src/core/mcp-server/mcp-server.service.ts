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
    console.error("[Layer 3] Circular dependency resolved.");
  }

  /**
   * Implements the startListening() method by delegating network startup to Layer 1.
   */
  public async startListening(): Promise<void> {
    console.error(
      `[Layer 3: Abstraction Core] Initiating Layer 1 Interface startup...`,
    );
    await this.interfaceLayer.start();
    console.error(
      `[Layer 3] McpServerService is operational and awaiting Layer 1 input.`,
    );
  }

  /**
   * Handles JSON-RPC requests and routes them to appropriate MCP protocol methods.
   */
  public async handleRequest(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    try {
      switch (request.method) {
        case "initialize":
          return this.handleInitialize(request);
        case "tools/list":
          return this.handleListTools(request);
        case "tools/call":
          return this.handleCallTool(request);
        default:
          return createJsonRpcError(
            request.id,
            JsonRpcErrorCode.MethodNotFound,
            `Method not found: ${request.method}`,
          );
      }
    } catch (error) {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InternalError,
        error instanceof Error ? error.message : "Internal error",
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
   */
  private async handleCallTool(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    const params = request.params as CallToolParams | undefined;

    if (!params) {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        "Missing params",
      );
    }

    if (!params.name || typeof params.name !== "string") {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        "Missing or invalid tool name",
      );
    }

    // Get tool definition for schema validation
    const tool = this.toolRegistry.getTool(params.name);
    if (!tool) {
      return createJsonRpcError(
        request.id,
        McpErrorCode.ToolNotFound,
        `Tool not found: ${params.name}`,
      );
    }

    // Validate arguments against tool schema
    const args = params.arguments || {};
    const validationError = validateToolArguments(
      args,
      tool.parameters,
      tool.required,
    );
    if (validationError) {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        validationError,
      );
    }

    try {
      const toolResult = await this.toolRegistry.executeTool(
        params.name,
        args,
      );

      // Convert tool result to MCP format
      // Sanitize result to prevent sensitive data exposure
      let resultText: string;
      if (typeof toolResult === "string") {
        resultText = toolResult;
      } else {
        try {
          resultText = JSON.stringify(toolResult);
        } catch (error) {
          resultText = "[Result could not be serialized]";
        }
      }

      const result: CallToolResult = {
        content: [
          {
            type: "text",
            text: resultText,
          },
        ],
        isError: false,
      };

      return createJsonRpcSuccess(request.id, result);
    } catch (error) {
      // Handle tool-specific errors
      if (error instanceof ToolNotFoundError) {
        return createJsonRpcError(
          request.id,
          McpErrorCode.ToolNotFound,
          "Tool not found",
        );
      }

      if (error instanceof ToolExecutionError) {
        // Use JSON-RPC error instead of success with isError flag
        return createJsonRpcError(
          request.id,
          McpErrorCode.ToolExecutionError,
          "Tool execution failed",
        );
      }

      // Unknown error - sanitize message
      return createJsonRpcError(
        request.id,
        McpErrorCode.ToolExecutionError,
        "Tool execution failed",
      );
    }
  }
}
