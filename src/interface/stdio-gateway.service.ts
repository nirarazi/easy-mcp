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
import { MAX_MESSAGE_SIZE_BYTES, MAX_CONTENT_LENGTH } from "../config/constants";
import { logger } from "../core/utils/logger.util";
import { sanitizeErrorMessage } from "../core/utils/sanitize.util";
import * as readline from "readline";

@Injectable()
export class StdioGatewayService implements IInterfaceLayer {
  private mcpServerService: McpServerService;
  private rl: readline.Interface;
  private isRunning = false;
  private pendingContentLength: number | null = null;
  private messageBuffer: Buffer = Buffer.alloc(0);
  private signalHandlers: Array<{ signal: string; handler: () => void }> = [];
  private contentLengthTimeout: NodeJS.Timeout | null = null;

  constructor() {
    logger.info("StdioGatewayService", "StdioGatewayService initialized", {
      component: "Layer 1: Interface",
    });
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
   * Supports both newline-delimited JSON (default) and Content-Length framing (optional).
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("StdioGatewayService", "StdioGatewayService is already running", {
        component: "Layer 1",
      });
      return;
    }

    logger.info("StdioGatewayService", "Starting stdio JSON-RPC server", {
      component: "Layer 1",
    });
    logger.info("StdioGatewayService", "Server is running and listening for JSON-RPC requests", {
      component: "Layer 1",
    });

    this.isRunning = true;
    this.pendingContentLength = null;
    this.messageBuffer = Buffer.alloc(0);

    // Create readline interface for reading from stdin line by line
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    // Process messages using Content-Length framing (MCP protocol standard)
    this.rl.on("line", (line: string) => {
      this.handleLine(line).catch((error) => {
        logger.error("StdioGatewayService", "Error handling line", {
          component: "Layer 1",
          error: sanitizeErrorMessage(error),
        });
      });
    });

    // Handle stdin close
    this.rl.on("close", () => {
      logger.info("StdioGatewayService", "stdin closed, shutting down", {
        component: "Layer 1",
      });
      this.isRunning = false;
    });

    // Handle process termination
    // Store handler references so they can be removed on shutdown to prevent leaks
    const sigintHandler = () => {
      this.shutdown();
    };
    const sigtermHandler = () => {
      this.shutdown();
    };

    process.on("SIGINT", sigintHandler);
    process.on("SIGTERM", sigtermHandler);

    // Store handlers for cleanup
    this.signalHandlers = [
      { signal: "SIGINT", handler: sigintHandler },
      { signal: "SIGTERM", handler: sigtermHandler },
    ];
  }

  /**
   * Handles a single line from stdin.
   * Implements Content-Length framing with proper multi-line JSON support.
   * Includes timeout protection to prevent DoS attacks via incomplete messages.
   */
  private async handleLine(line: string): Promise<void> {
    // If we're waiting for a message body, accumulate bytes
    if (this.pendingContentLength !== null) {
      const lineBytes = Buffer.from(line + "\n", "utf8");
      this.messageBuffer = Buffer.concat([this.messageBuffer, lineBytes]);

      // Check if we've read enough bytes
      if (this.messageBuffer.length >= this.pendingContentLength) {
        // Clear timeout since we received the complete message
        if (this.contentLengthTimeout) {
          clearTimeout(this.contentLengthTimeout);
          this.contentLengthTimeout = null;
        }

        const messageBytes = this.messageBuffer.subarray(0, this.pendingContentLength);
        const message = messageBytes.toString("utf8");
        
        // Reset state
        this.pendingContentLength = null;
        this.messageBuffer = Buffer.alloc(0);

        // Process the complete message
        await this.processRequest(message);
      }
      return;
    }

    // Skip empty lines
    if (!line.trim()) {
      return;
    }

    // Check for Content-Length header with improved validation
    // Handle both CRLF and LF line endings, and validate header format strictly
    const trimmedLine = line.trim();
    const contentLengthMatch = trimmedLine.match(/^Content-Length:\s*(\d+)\s*$/i);
    
    if (contentLengthMatch) {
      // Validate that we're not already processing a message
      if (this.pendingContentLength !== null) {
        logger.error("StdioGatewayService", "Received Content-Length header while already processing a message", {
          component: "Layer 1",
          existingLength: this.pendingContentLength,
          newLength: contentLengthMatch[1],
        });
        // Reset state to prevent confusion
        this.pendingContentLength = null;
        this.messageBuffer = Buffer.alloc(0);
        if (this.contentLengthTimeout) {
          clearTimeout(this.contentLengthTimeout);
          this.contentLengthTimeout = null;
        }
      }

      const contentLengthStr = contentLengthMatch[1];
      const contentLength = parseInt(contentLengthStr, 10);

      // Validate Content-Length value is a valid positive integer
      if (isNaN(contentLength) || contentLength < 0 || !Number.isInteger(contentLength)) {
        logger.error("StdioGatewayService", "Invalid Content-Length value (must be non-negative integer)", {
          component: "Layer 1",
          receivedValue: contentLengthStr,
        });
        return;
      }

      // Validate that the string representation matches the parsed integer (prevents overflow)
      if (contentLength.toString() !== contentLengthStr) {
        logger.error("StdioGatewayService", "Content-Length value overflow or invalid format", {
          component: "Layer 1",
          receivedValue: contentLengthStr,
        });
        return;
      }

      // Enforce maximum message size to prevent memory exhaustion
      if (contentLength > MAX_CONTENT_LENGTH) {
        logger.error("StdioGatewayService", "Content-Length exceeds maximum allowed size", {
          component: "Layer 1",
          contentLength,
          maxAllowed: MAX_CONTENT_LENGTH,
        });
        // Clear any existing timeout
        if (this.contentLengthTimeout) {
          clearTimeout(this.contentLengthTimeout);
          this.contentLengthTimeout = null;
        }
        // Reset state to prevent hanging
        this.pendingContentLength = null;
        this.messageBuffer = Buffer.alloc(0);
        return;
      }

      // Start accumulating message bytes
      // Note: The MCP spec requires CRLF CRLF after the header, but readline
      // will have already consumed the line ending, so we start accumulating on the next line
      this.pendingContentLength = contentLength;
      this.messageBuffer = Buffer.alloc(0);

      // Set timeout to prevent DoS via incomplete messages
      // If message body is not received within 30 seconds, reset state
      this.contentLengthTimeout = setTimeout(() => {
        logger.error("StdioGatewayService", "Content-Length timeout: message body not received within timeout period", {
          component: "Layer 1",
          contentLength,
          timeoutMs: 30000,
        });
        // Reset state to prevent hanging
        this.pendingContentLength = null;
        this.messageBuffer = Buffer.alloc(0);
        this.contentLengthTimeout = null;
      }, 30000); // 30 second timeout

      return;
    }

    // Fallback: try to parse as direct JSON (for backwards compatibility)
    // This handles cases where Content-Length header is not used
    // But we still enforce size limits
    const lineBytes = Buffer.byteLength(line, "utf8");
    if (lineBytes > MAX_MESSAGE_SIZE_BYTES) {
      logger.error("StdioGatewayService", "Unframed message exceeds maximum size", {
        component: "Layer 1",
        messageSize: lineBytes,
        maxAllowed: MAX_MESSAGE_SIZE_BYTES,
      });
      return;
    }

    await this.processRequest(line);
  }

  /**
   * Processes a JSON-RPC request message.
   * Validates message size and handles parsing errors securely.
   */
  private async processRequest(message: string): Promise<void> {
    if (!message.trim()) {
      return; // Skip empty messages
    }

    // Validate message size (in bytes)
    const messageSize = Buffer.byteLength(message, "utf8");
    if (messageSize > MAX_MESSAGE_SIZE_BYTES) {
      logger.error("StdioGatewayService", "Message exceeds maximum allowed size", {
        component: "Layer 1",
        messageSize,
        maxAllowed: MAX_MESSAGE_SIZE_BYTES,
      });
      // Cannot respond without a valid request ID
      return;
    }

    let request: any = null;
    
    try {
      request = JSON.parse(message);
    } catch (error) {
      // Per JSON-RPC 2.0 spec: Parse errors should not send a response if ID is unknown
      // Since we can't parse the request, we don't know the ID, so we don't respond
      logger.error("StdioGatewayService", "JSON Parse Error", {
        component: "Layer 1",
        error: sanitizeErrorMessage(error),
      });
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
      logger.warn("StdioGatewayService", "Invalid JSON-RPC request structure", {
        component: "Layer 1",
        requestId,
      });
      return;
    }

    try {
      // Handle the valid request
      const response = await this.handleRequest(request);
      this.sendResponse(response);
    } catch (err) {
      // Handle internal errors during request processing
      const errorResponse = createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InternalError,
        "Internal error during request handling",
      );
      this.sendResponse(errorResponse);
      // Log the actual error to stderr for debugging (not sent to client)
      logger.error("StdioGatewayService", "Internal error during request handling", {
        component: "Layer 1",
        requestId: request.id,
        method: request.method,
        error: sanitizeErrorMessage(err),
      });
    }
  }

  /**
   * Sends a JSON-RPC response to stdout
   */
  public async sendMessage(sessionId: string, _output: unknown): Promise<void> {
    // This method is part of IInterfaceLayer but not used in stdio mode
    // Responses are sent directly via sendResponse()
     
    logger.warn("StdioGatewayService", "sendMessage() called but stdio mode doesn't use sessions", {
      component: "Layer 1",
      sessionId,
    });
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
    } catch (err) {
      // Log error for debugging but don't expose details to client
      logger.error("StdioGatewayService", "Error in handleRequest", {
        component: "Layer 1",
        requestId: request.id,
        error: sanitizeErrorMessage(err),
      });
      // Sanitize error message before returning
      return createJsonRpcError(
        request.id,
        JsonRpcErrorCode.InternalError,
        "Internal error",
      );
    }
  }

  /**
   * Sends a JSON-RPC response to stdout.
   * 
   * By default, uses newline-delimited JSON for maximum client compatibility.
   * Set MCP_USE_CONTENT_LENGTH=1 to use Content-Length framing per MCP spec.
   * 
   * Note: Some MCP clients (Cursor, Claude Desktop) have issues parsing Content-Length
   * headers, so newline-delimited JSON is the default for better compatibility.
   */
  private sendResponse(response: JsonRpcResponse): void {
    try {
      const json = JSON.stringify(response);
      const useContentLength = process.env.MCP_USE_CONTENT_LENGTH === "1";

      if (useContentLength) {
        // MCP spec framing: Content-Length header + CRLF CRLF + body
        // Validate JSON can be stringified and is within size limits
        const contentLength = Buffer.byteLength(json, "utf8");
        
        if (contentLength > MAX_MESSAGE_SIZE_BYTES) {
          logger.error("StdioGatewayService", "Response exceeds maximum size for Content-Length framing", {
            component: "Layer 1",
            contentLength,
            maxAllowed: MAX_MESSAGE_SIZE_BYTES,
          });
          // Fallback to error response if original response is too large
          const errorResponse = createJsonRpcError(
            response.id,
            JsonRpcErrorCode.InternalError,
            "Response too large",
          );
          const errorJson = JSON.stringify(errorResponse);
          const errorLength = Buffer.byteLength(errorJson, "utf8");
          const errorMessage = `Content-Length: ${errorLength}\r\n\r\n${errorJson}`;
          process.stdout.write(errorMessage);
          return;
        }

        // Validate contentLength is a valid positive integer
        if (!Number.isInteger(contentLength) || contentLength < 0) {
          logger.error("StdioGatewayService", "Invalid content length calculated", {
            component: "Layer 1",
            contentLength,
          });
          return;
        }

        // MCP spec requires exact CRLF CRLF separator
        const message = `Content-Length: ${contentLength}\r\n\r\n${json}`;
        process.stdout.write(message);
      } else {
        // Default: newline-delimited JSON (better client compatibility)
        // Validate size before sending
        const messageSize = Buffer.byteLength(json, "utf8");
        if (messageSize > MAX_MESSAGE_SIZE_BYTES) {
          logger.error("StdioGatewayService", "Response exceeds maximum size for newline-delimited JSON", {
            component: "Layer 1",
            messageSize,
            maxAllowed: MAX_MESSAGE_SIZE_BYTES,
          });
          // Fallback to error response
          const errorResponse = createJsonRpcError(
            response.id,
            JsonRpcErrorCode.InternalError,
            "Response too large",
          );
          process.stdout.write(JSON.stringify(errorResponse) + "\n");
          return;
        }
        process.stdout.write(json + "\n");
      }
    } catch (error) {
      // Handle JSON serialization errors or write failures
      logger.error("StdioGatewayService", "Failed to send response", {
        component: "Layer 1",
        error: sanitizeErrorMessage(error),
      });
      // Try to send a minimal error response if possible
      try {
        const errorResponse = createJsonRpcError(
          response?.id || null,
          JsonRpcErrorCode.InternalError,
          "Internal error",
        );
        const errorJson = JSON.stringify(errorResponse);
        const useContentLength = process.env.MCP_USE_CONTENT_LENGTH === "1";
        if (useContentLength) {
          const errorLength = Buffer.byteLength(errorJson, "utf8");
          process.stdout.write(`Content-Length: ${errorLength}\r\n\r\n${errorJson}`);
        } else {
          process.stdout.write(errorJson + "\n");
        }
      } catch {
        // If we can't even send an error response, log and continue
        logger.error("StdioGatewayService", "Failed to send error response", {
          component: "Layer 1",
        });
      }
    }
  }

  /**
   * Gracefully shuts down the stdio gateway
   * Removes signal handlers to prevent memory leaks and duplicate handlers
   */
  private shutdown(): void {
    // Remove signal handlers to prevent leaks
    for (const { signal, handler } of this.signalHandlers) {
      process.removeListener(signal, handler);
    }
    this.signalHandlers = [];

    // Clear any pending timeout
    if (this.contentLengthTimeout) {
      clearTimeout(this.contentLengthTimeout);
      this.contentLengthTimeout = null;
    }

    if (this.rl) {
      this.rl.close();
    }
    this.isRunning = false;
    this.pendingContentLength = null;
    this.messageBuffer = Buffer.alloc(0);
    logger.info("StdioGatewayService", "StdioGatewayService shut down", {
      component: "Layer 1",
    });
  }
}

