import { CreateMcpServerOptions, StandaloneTransport } from "./types";
import { StandaloneToolRegistry, StandaloneResourceRegistry, StandalonePromptRegistry } from "./core-services";
import { JsonRpcRequest, JsonRpcResponse, createJsonRpcSuccess, createJsonRpcError, JsonRpcErrorCode, isValidJsonRpcRequest } from "../interface/jsonrpc.interface";
import { InitializeParams, InitializeResult, ListToolsResult, McpTool, CallToolParams, CallToolResult, McpErrorCode } from "../interface/mcp-protocol.interface";
import { McpContext } from "../core/context/mcp-context.interface";
import { logger } from "../core/utils/logger.util";
import { sanitizeToolResult, sanitizeName } from "../core/utils/sanitize.util";
import * as readline from "readline";
import * as http from "http";

/**
 * Standalone MCP server (no NestJS required).
 */
export class StandaloneMcpServer {
  private toolRegistry: StandaloneToolRegistry;
  private resourceRegistry: StandaloneResourceRegistry;
  private promptRegistry: StandalonePromptRegistry;
  private serverInfo: { name: string; version: string };
  private transport: StandaloneTransport;
  private auth?: (request: any) => Promise<McpContext> | McpContext | null;
  private httpServer?: http.Server;
  private port?: number;
  private host?: string;

  constructor(options: CreateMcpServerOptions) {
    this.toolRegistry = new StandaloneToolRegistry();
    this.resourceRegistry = new StandaloneResourceRegistry();
    this.promptRegistry = new StandalonePromptRegistry();
    this.transport = options.transport || "stdio";
    this.auth = options.auth;
    this.port = options.port;
    this.host = options.host;

    this.serverInfo = options.serverInfo || {
      name: "easy-mcp-standalone",
      version: "0.2.1",
    };

    // Register tools
    for (const tool of options.tools) {
      this.toolRegistry.registerTool(tool);
    }

    // Register resources
    if (options.resources) {
      for (const resource of options.resources) {
        this.resourceRegistry.registerResource(resource);
      }
    }

    // Register prompts
    if (options.prompts) {
      for (const prompt of options.prompts) {
        this.promptRegistry.registerPrompt(prompt);
      }
    }
  }

  /**
   * Starts the server based on transport type.
   */
  async start(): Promise<void> {
    if (this.transport === "stdio") {
      await this.startStdio();
    } else if (this.transport === "http") {
      await this.startHttp();
    } else {
      throw new Error(`Unsupported transport: ${this.transport}`);
    }
  }

  /**
   * Starts stdio transport.
   */
  private async startStdio(): Promise<void> {
    logger.info("StandaloneMcpServer", "Starting stdio transport", {
      component: "Standalone",
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on("line", async (line: string) => {
      try {
        const request = JSON.parse(line);
        if (isValidJsonRpcRequest(request)) {
          const response = await this.handleRequest(request);
          process.stdout.write(JSON.stringify(response) + "\n");
        }
      } catch (error) {
        logger.error("StandaloneMcpServer", "Error processing stdio request", {
          component: "Standalone",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /**
   * Starts HTTP transport.
   */
  private async startHttp(): Promise<void> {
    logger.info("StandaloneMcpServer", "Starting HTTP transport", {
      component: "Standalone",
    });

    this.httpServer = http.createServer(async (req, res) => {
      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
      }

      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const request = JSON.parse(body);
          if (isValidJsonRpcRequest(request)) {
            // Extract context if auth is provided
            let context: McpContext | undefined;
            if (this.auth) {
              const authContext = await this.auth(req);
              context = authContext || undefined;
            }

            // Add context metadata to request
            if (context) {
              request.metadata = {
                userId: context.userId,
                scopes: context.scopes,
                buildingIds: context.buildingIds,
                sessionId: context.sessionId,
              };
            }

            const response = await this.handleRequest(request);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(response));
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: {
                code: JsonRpcErrorCode.InvalidRequest,
                message: "Invalid JSON-RPC request",
              },
            }));
          }
        } catch (error) {
          logger.error("StandaloneMcpServer", "Error processing HTTP request", {
            component: "Standalone",
            error: error instanceof Error ? error.message : String(error),
          });
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: JsonRpcErrorCode.InternalError,
              message: "Internal error",
            },
          }));
        }
      });
    });

    // Start listening
    const port = this.port || 3000;
    const host = this.host || "localhost";
    this.httpServer.listen(port, host, () => {
      logger.info("StandaloneMcpServer", `HTTP server listening on ${host}:${port}`, {
        component: "Standalone",
      });
    });
  }

  /**
   * Handles a JSON-RPC request.
   */
  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
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
          `Method not found: ${request.method}`
        );
    }
  }

  /**
   * Handles initialize request.
   */
  private handleInitialize(request: JsonRpcRequest): JsonRpcResponse {
    const params = request.params as InitializeParams | undefined;

    if (params && params.protocolVersion !== "2025-11-25") {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        `Unsupported protocol version: ${params.protocolVersion}. Supported version: 2025-11-25`
      );
    }

    const result: InitializeResult = {
      protocolVersion: "2025-11-25",
      capabilities: {
        tools: {},
      },
      serverInfo: this.serverInfo,
    };

    return createJsonRpcSuccess(request.id, result);
  }

  /**
   * Handles tools/list request.
   */
  private handleListTools(request: JsonRpcRequest): JsonRpcResponse {
    const tools = this.toolRegistry.getToolSchemasForLLM();

    const mcpTools: McpTool[] = tools.map((tool) => {
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
   * Handles tools/call request.
   */
  private async handleCallTool(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const params = request.params as CallToolParams | undefined;

    if (!params || !params.name || typeof params.name !== "string") {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InvalidParams,
        "Missing or invalid tool name"
      );
    }

    const args = params.arguments || {};
    const toolName = params.name;

    // Extract context from request metadata
    let context: McpContext | undefined;
    if (request.metadata) {
      context = {
        userId: request.metadata.userId,
        scopes: request.metadata.scopes,
        buildingIds: request.metadata.buildingIds,
        sessionId: request.metadata.sessionId,
      };
    }

    try {
      const toolResult = await this.toolRegistry.executeTool(toolName, args, undefined, context);
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

      return createJsonRpcSuccess(request.id, result);
    } catch (error) {
      if (error instanceof ToolNotFoundError) {
        return createJsonRpcError(
          request.id,
          McpErrorCode.ToolNotFound,
          `Tool not found: ${toolName}`
        );
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      return createJsonRpcError(
        request.id,
        McpErrorCode.ToolExecutionError,
        `Tool execution failed: ${errorMessage}`
      );
    }
  }

  /**
   * Stops the server.
   */
  async stop(): Promise<void> {
    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer!.close(() => {
          logger.info("StandaloneMcpServer", "HTTP server stopped", {
            component: "Standalone",
          });
          resolve();
        });
      });
    }
  }
}

/**
 * Creates a standalone MCP server (no NestJS required).
 *
 * @example
 * ```typescript
 * import { createMcpServer } from 'easy-mcp-nest/standalone';
 *
 * const server = createMcpServer({
 *   tools: [BuildingTools, PaymentTools],
 *   resources: [BuildingResources],
 *   transport: 'http',
 *   auth: validateMcpToken,
 * });
 *
 * await server.start();
 * ```
 */
export function createMcpServer(options: CreateMcpServerOptions): StandaloneMcpServer {
  return new StandaloneMcpServer(options);
}
