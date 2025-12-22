import { Injectable } from "@nestjs/common";
import { IInterfaceLayer } from "./interface.interface";
import { McpServerService } from "../core/mcp-server/mcp-server.service";
import {
  JsonRpcRequest,
  JsonRpcResponse,
  isValidJsonRpcRequest,
  createJsonRpcError,
  JsonRpcErrorCode,
} from "./jsonrpc.interface";
import * as readline from "readline";

@Injectable()
export class StdioGatewayService implements IInterfaceLayer {
  private mcpServerService: McpServerService;
  private rl: readline.Interface;
  private isRunning = false;

  constructor() {
    console.log("[Layer 1: Interface] StdioGatewayService initialized.");
  }

  /**
   * Used by CoreModule's OnModuleInit to resolve the circular dependency.
   */
  public setMcpServerService(service: McpServerService) {
    this.mcpServerService = service;
  }

  /**
   * Implements the IInterfaceLayer.start() method.
   * Sets up stdio readline interface for JSON-RPC communication.
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[Layer 1] StdioGatewayService is already running.");
      return;
    }

    console.log("[Layer 1] Starting stdio JSON-RPC server...");
    console.log("[Layer 1] Server is running and listening for JSON-RPC requests.");

    this.isRunning = true;

    // Create readline interface for reading from stdin line by line
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    // Process each line as a JSON-RPC request
    this.rl.on("line", async (line: string) => {
      if (!line.trim()) {
        return; // Skip empty lines
      }

      try {
        const request: JsonRpcRequest = JSON.parse(line);

        if (!isValidJsonRpcRequest(request)) {
          const errorResponse = createJsonRpcError(
            null,
            JsonRpcErrorCode.InvalidRequest,
            "Invalid JSON-RPC request",
          );
          this.sendResponse(errorResponse);
          return;
        }

        // Handle the request
        const response = await this.handleRequest(request);
        this.sendResponse(response);
      } catch (error) {
        // Parse error or other error
        const errorResponse = createJsonRpcError(
          null,
          JsonRpcErrorCode.ParseError,
          error instanceof Error ? error.message : "Parse error",
        );
        this.sendResponse(errorResponse);
      }
    });

    // Handle stdin close
    this.rl.on("close", () => {
      console.log("[Layer 1] stdin closed, shutting down...");
      this.isRunning = false;
    });

    // Handle process termination
    process.on("SIGINT", () => {
      this.shutdown();
    });

    process.on("SIGTERM", () => {
      this.shutdown();
    });
  }

  /**
   * Sends a JSON-RPC response to stdout
   */
  public async sendMessage(sessionId: string, output: any): Promise<void> {
    // This method is part of IInterfaceLayer but not used in stdio mode
    // Responses are sent directly via sendResponse()
    console.warn(
      `[Layer 1] sendMessage() called with sessionId=${sessionId}, but stdio mode doesn't use sessions`,
    );
  }

  /**
   * Handles a JSON-RPC request by routing it to McpServerService
   */
  private async handleRequest(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse> {
    if (!this.mcpServerService) {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InternalError,
        "McpServerService not initialized",
      );
    }

    try {
      return await this.mcpServerService.handleRequest(request);
    } catch (error) {
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InternalError,
        error instanceof Error ? error.message : "Internal error",
      );
    }
  }

  /**
   * Sends a JSON-RPC response to stdout
   */
  private sendResponse(response: JsonRpcResponse): void {
    const json = JSON.stringify(response);
    console.log(json);
  }

  /**
   * Gracefully shuts down the stdio gateway
   */
  private shutdown(): void {
    if (this.rl) {
      this.rl.close();
    }
    this.isRunning = false;
    console.log("[Layer 1] StdioGatewayService shut down.");
  }
}

