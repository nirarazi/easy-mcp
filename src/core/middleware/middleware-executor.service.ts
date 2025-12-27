import { Injectable } from "@nestjs/common";
import { JsonRpcRequest, JsonRpcResponse } from "../../interface/jsonrpc.interface";
import { McpContext } from "../context/mcp-context.interface";
import { Middleware } from "./middleware.interface";
import { logger } from "../utils/logger.util";

/**
 * Service for executing middleware pipelines.
 */
@Injectable()
export class MiddlewareExecutorService {
  private globalMiddlewares: Middleware[] = [];

  /**
   * Registers a global middleware.
   */
  registerMiddleware(middleware: Middleware): void {
    this.globalMiddlewares.push(middleware);
  }

  /**
   * Executes middleware pipeline for a request.
   */
  async execute(
    request: JsonRpcRequest,
    context: McpContext | undefined,
    handler: () => Promise<JsonRpcResponse>,
    additionalMiddlewares: Middleware[] = []
  ): Promise<JsonRpcResponse> {
    const allMiddlewares = [...this.globalMiddlewares, ...additionalMiddlewares];

    // Build middleware chain
    let index = 0;
    const next = async (): Promise<JsonRpcResponse> => {
      if (index >= allMiddlewares.length) {
        return handler();
      }

      const middleware = allMiddlewares[index++];
      try {
        return await middleware(request, context, next);
      } catch (error) {
        logger.error("MiddlewareExecutorService", "Middleware execution failed", {
          component: "Middleware",
          middlewareIndex: index - 1,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };

    return next();
  }
}

