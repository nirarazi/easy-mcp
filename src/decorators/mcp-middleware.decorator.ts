import "reflect-metadata";
import { Middleware } from "../core/middleware/middleware.interface";

/**
 * Metadata key for storing middleware
 */
const MCP_MIDDLEWARE_METADATA_KEY = Symbol("mcp:middleware");

/**
 * Decorator to register a middleware function.
 *
 * @example
 * ```typescript
 * @McpMiddleware(async (req, context, next) => {
 *   const start = Date.now();
 *   const result = await next();
 *   logPerformance(req.method, Date.now() - start);
 *   return result;
 * })
 * export class PerformanceMiddleware {}
 * ```
 */
export function McpMiddleware(middleware: Middleware): ClassDecorator {
  return (target: any) => {
    const existingMiddlewares: Middleware[] =
      Reflect.getMetadata(MCP_MIDDLEWARE_METADATA_KEY, target) || [];
    existingMiddlewares.push(middleware);
    Reflect.defineMetadata(MCP_MIDDLEWARE_METADATA_KEY, existingMiddlewares, target);
  };
}

/**
 * Gets middleware functions from a class.
 * @internal
 */
export function getMiddlewares(target: any): Middleware[] {
  return Reflect.getMetadata(MCP_MIDDLEWARE_METADATA_KEY, target) || [];
}
