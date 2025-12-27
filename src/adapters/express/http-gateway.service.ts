import { Injectable } from "@nestjs/common";
import { Request, Response } from "express";
import { IInterfaceLayer } from "../../interface/interface.interface";
import { McpServerService } from "../../core/mcp-server/mcp-server.service";
import {
  JsonRpcRequest,
  JsonRpcResponse,
  isValidJsonRpcRequest,
  createJsonRpcError,
  JsonRpcErrorCode,
} from "../../interface/jsonrpc.interface";
import { logger } from "../../core/utils/logger.util";
import { sanitizeErrorMessage } from "../../core/utils/sanitize.util";
import { McpContext } from "../../core/context/mcp-context.interface";

/**
 * HTTP Gateway Service for Express integration.
 * Implements IInterfaceLayer for HTTP transport.
 */
@Injectable()
export class HttpGatewayService implements IInterfaceLayer {
  private mcpServerService: McpServerService;
  private requestContextMap = new Map<string, McpContext>();

  constructor() {
    logger.info("HttpGatewayService", "HttpGatewayService initialized", {
      component: "Layer 1: HTTP Interface",
    });
  }

  /**
   * Used to inject McpServerService (resolves circular dependency).
   */
  public setMcpServerService(service: McpServerService): void {
    this.mcpServerService = service;
  }

  /**
   * Starts the HTTP gateway (no-op for Express, handled by Express app).
   */
  public async start(): Promise<void> {
    logger.info("HttpGatewayService", "HTTP gateway ready (handled by Express)", {
      component: "Layer 1: HTTP Interface",
    });
  }

  /**
   * Sends a JSON-RPC response to a specific session.
   * For HTTP, this stores the response to be sent via Express.
   */
  public async sendMessage(sessionId: string, output: unknown): Promise<void> {
    // For HTTP, responses are sent directly via Express response object
    // This method is kept for interface compatibility but may not be used
    logger.debug("HttpGatewayService", "sendMessage called", {
      component: "Layer 1: HTTP Interface",
      sessionId,
    });
  }

  /**
   * Handles an HTTP request and returns the JSON-RPC response.
   * This is called by the Express route handler.
   */
  public async handleHttpRequest(
    req: Request,
    res: Response,
    context?: McpContext
  ): Promise<void> {
    // Store context for this request
    const requestId = req.headers["x-request-id"] || String(Date.now());
    if (context) {
      this.requestContextMap.set(String(requestId), context);
    }

    try {
      // Parse JSON-RPC request from request body
      const body = req.body;
      
      if (!body || typeof body !== "object") {
        const errorResponse = createJsonRpcError(
          null,
          JsonRpcErrorCode.InvalidRequest,
          "Request body must be a valid JSON-RPC request"
        );
        res.status(400).json(errorResponse);
        return;
      }

      // Validate JSON-RPC request
      if (!isValidJsonRpcRequest(body)) {
        const errorResponse = createJsonRpcError(
          body.id || null,
          JsonRpcErrorCode.InvalidRequest,
          "Invalid JSON-RPC request structure"
        );
        res.status(400).json(errorResponse);
        return;
      }

      const request: JsonRpcRequest = {
        ...body,
        // Add context metadata to request
        metadata: context ? {
          userId: context.userId,
          scopes: context.scopes,
          buildingIds: context.buildingIds,
          sessionId: context.sessionId || String(requestId),
          metadata: {
            ip: req.ip || req.socket.remoteAddress,
            userAgent: req.get("user-agent"),
          },
        } : undefined,
      };

      // Handle the request via McpServerService
      if (!this.mcpServerService) {
        const errorResponse = createJsonRpcError(
          request.id,
          JsonRpcErrorCode.InternalError,
          "McpServerService not initialized"
        );
        res.status(500).json(errorResponse);
        return;
      }

      const response = await this.mcpServerService.handleRequest(request);
      
      // Send response
      res.status(200).json(response);

      // Clean up context
      this.requestContextMap.delete(String(requestId));
    } catch (error) {
      logger.error("HttpGatewayService", "Error handling HTTP request", {
        component: "Layer 1: HTTP Interface",
        error: sanitizeErrorMessage(error),
      });

      const errorResponse = createJsonRpcError(
        req.body?.id || null,
        JsonRpcErrorCode.InternalError,
        "Internal error during request handling"
      );
      res.status(500).json(errorResponse);
    }
  }
}

