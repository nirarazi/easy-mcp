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

/**
 * Sanitizes error messages to prevent sensitive data exposure.
 * Removes stack traces and limits message length.
 */
function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Remove stack traces and internal details
    const message = error.message;
    // Limit message length to prevent information leakage
    const maxLength = 200;
    if (message.length > maxLength) {
      return message.substring(0, maxLength) + "...";
    }
    return message;
  }
  return "An error occurred";
}

@Injectable()
export class StdioGatewayService implements IInterfaceLayer {
  private mcpServerService: McpServerService;
  private rl: readline.Interface;
  private isRunning = false;
  private buffer = "";

  constructor() {
    console.error("[Layer 1: Interface] StdioGatewayService initialized.");
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
   * Uses Content-Length framing as per MCP protocol specification.
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.error("[Layer 1] StdioGatewayService is already running.");
      return;
    }

    console.error("[Layer 1] Starting stdio JSON-RPC server...");
    console.error("[Layer 1] Server is running and listening for JSON-RPC requests.");

    this.isRunning = true;

    // Create readline interface for reading from stdin line by line
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    // Process messages using Content-Length framing (MCP protocol standard)
    this.rl.on("line", async (line: string) => {
      if (!line.trim()) {
        return; // Skip empty lines
      }

      // Check for Content-Length header
      const contentLengthMatch = line.match(/^Content-Length:\s*(\d+)/i);
      if (contentLengthMatch) {
        const contentLength = parseInt(contentLengthMatch[1], 10);
        
        // Read the next line which should be the JSON-RPC message
        this.rl.once("line", async (body: string) => {
          // Ensure we read exactly the specified length
          const message = body.substring(0, contentLength);
          
          try {
            await this.processRequest(message);
          } catch (error) {
            console.error("[Layer 1] Error processing request:", sanitizeErrorMessage(error));
          }
        });
        return;
      }

      // Fallback: try to parse as direct JSON (for backwards compatibility)
      // This handles cases where Content-Length header is not used
      try {
        await this.processRequest(line);
      } catch (error) {
        console.error("[Layer 1] Error processing request:", sanitizeErrorMessage(error));
      }
    });

    // Handle stdin close
    this.rl.on("close", () => {
      console.error("[Layer 1] stdin closed, shutting down...");
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
   * Processes a JSON-RPC request message.
   */
  private async processRequest(message: string): Promise<void> {
    if (!message.trim()) {
      return; // Skip empty messages
    }

    let request: any = null;
    
    try {
      request = JSON.parse(message);
    } catch (error) {
      // Per JSON-RPC 2.0 spec: Parse errors should not send a response if ID is unknown
      // Since we can't parse the request, we don't know the ID, so we don't respond
      console.error("[Layer 1] JSON Parse Error:", sanitizeErrorMessage(error));
      return;
    }

    if (!isValidJsonRpcRequest(request)) {
      // Invalid request structure - try to use request ID if available
      const requestId = request && typeof request === 'object' && ('id' in request) ? request.id : null;
      const errorResponse = createJsonRpcError(
        requestId,
        JsonRpcErrorCode.InvalidRequest,
        "Invalid JSON-RPC request structure",
      );
      // Only send response if we have a valid ID
      if (requestId !== null && requestId !== undefined) {
        this.sendResponse(errorResponse);
      }
      return;
    }

    try {
      // Handle the valid request
      const response = await this.handleRequest(request);
      this.sendResponse(response);
    } catch (error) {
      // Handle internal errors during request processing
      const errorResponse = createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InternalError,
        "Internal error during request handling",
      );
      this.sendResponse(errorResponse);
      // Log the actual error to stderr for debugging (not sent to client)
      console.error("[Layer 1] Internal error:", sanitizeErrorMessage(error));
    }
  }

  /**
   * Sends a JSON-RPC response to stdout
   */
  public async sendMessage(sessionId: string, output: any): Promise<void> {
    // This method is part of IInterfaceLayer but not used in stdio mode
    // Responses are sent directly via sendResponse()
    console.error(
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
      // Sanitize error message before returning
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InternalError,
        "Internal error",
      );
    }
  }

  /**
   * Sends a JSON-RPC response to stdout using Content-Length framing.
   */
  private sendResponse(response: JsonRpcResponse): void {
    const json = JSON.stringify(response);
    const contentLength = Buffer.byteLength(json, "utf8");
    
    // Write Content-Length header followed by empty line, then message body
    process.stdout.write(`Content-Length: ${contentLength}\r\n\r\n${json}`);
  }

  /**
   * Gracefully shuts down the stdio gateway
   */
  private shutdown(): void {
    if (this.rl) {
      this.rl.close();
    }
    this.isRunning = false;
    console.error("[Layer 1] StdioGatewayService shut down.");
  }
}

