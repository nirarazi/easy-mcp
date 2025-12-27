import "reflect-metadata";
import { ErrorHandler } from "../core/errors/error-handler.interface";

/**
 * Metadata key for storing error handlers
 */
const MCP_ERROR_HANDLER_METADATA_KEY = Symbol("mcp:error:handler");

/**
 * Decorator to register a global error handler.
 *
 * @example
 * ```typescript
 * @McpErrorHandler((error, context) => {
 *   logErrorSecurely('MCP error', error, context);
 *   return sanitizeError(error);
 * })
 * export class MyErrorHandler {}
 * ```
 */
export function McpErrorHandler(handler: ErrorHandler): ClassDecorator {
  return (target: any) => {
    Reflect.defineMetadata(MCP_ERROR_HANDLER_METADATA_KEY, handler, target);
  };
}

/**
 * Gets the error handler from a class.
 * @internal
 */
export function getErrorHandler(target: any): ErrorHandler | undefined {
  return Reflect.getMetadata(MCP_ERROR_HANDLER_METADATA_KEY, target);
}

