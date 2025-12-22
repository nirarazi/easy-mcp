/**
 * JSON-RPC 2.0 Request interface
 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: any;
}

/**
 * JSON-RPC 2.0 Response interface
 */
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: any;
  error?: JsonRpcError;
}

/**
 * JSON-RPC 2.0 Error interface
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

/**
 * Standard JSON-RPC error codes
 */
export enum JsonRpcErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
}

/**
 * Validates a JSON-RPC request
 */
export function isValidJsonRpcRequest(obj: any): obj is JsonRpcRequest {
  return (
    obj &&
    typeof obj === "object" &&
    obj.jsonrpc === "2.0" &&
    typeof obj.method === "string" &&
    (obj.id === null ||
      typeof obj.id === "string" ||
      typeof obj.id === "number")
  );
}

/**
 * Creates a JSON-RPC success response
 */
export function createJsonRpcSuccess(
  id: string | number | null,
  result: any,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

/**
 * Creates a JSON-RPC error response
 */
export function createJsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: any,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data !== undefined && { data }),
    },
  };
}

