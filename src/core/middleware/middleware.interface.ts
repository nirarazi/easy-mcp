import { JsonRpcRequest, JsonRpcResponse } from "../../interface/jsonrpc.interface";
import { McpContext } from "../context/mcp-context.interface";

/**
 * Middleware function type
 */
export type Middleware = (
  request: JsonRpcRequest,
  context: McpContext | undefined,
  next: () => Promise<JsonRpcResponse>
) => Promise<JsonRpcResponse>;

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /** Middleware functions to execute */
  middlewares: Middleware[];
}
