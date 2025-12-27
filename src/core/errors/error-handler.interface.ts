import { McpContext } from "../context/mcp-context.interface";
import { JsonRpcError } from "../../interface/jsonrpc.interface";

/**
 * Error handler function type
 */
export type ErrorHandler = (
  error: Error,
  context: {
    toolName?: string;
    requestId?: string | number | null;
    mcpContext?: McpContext;
  }
) => JsonRpcError | Error | null;

/**
 * Global error handler configuration
 */
export interface ErrorHandlerConfig {
  /** Global error handler */
  handler?: ErrorHandler;
  /** Whether to log errors automatically */
  logErrors?: boolean;
}

