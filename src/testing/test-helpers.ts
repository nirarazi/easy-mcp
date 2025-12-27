import { ToolRegistrationInput } from "../config/mcp-config.interface";
import { JsonRpcRequest } from "../interface/jsonrpc.interface";
import { mockMcpContext } from "./mock-context";

/**
 * Creates a mock JSON-RPC request for testing.
 */
export function createMockJsonRpcRequest(
  method: string,
  params?: any,
  id: string | number = 1
): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
}

/**
 * Creates a mock tool registration input for testing.
 */
export function createMockTool(
  name: string,
  description: string,
  handler: (args: Record<string, any>) => Promise<any>
): ToolRegistrationInput {
  return {
    name,
    description,
    function: handler,
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  };
}

/**
 * Helper to wait for async operations in tests.
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to create a cancellation token for testing.
 */
export function createMockCancellationToken(): {
  isCancelled: boolean;
  onCancel: (callback: () => void) => void;
  cancel: () => void;
} {
  let cancelled = false;
  const callbacks: Array<() => void> = [];

  return {
    get isCancelled() {
      return cancelled;
    },
    onCancel(callback: () => void) {
      callbacks.push(callback);
    },
    cancel() {
      cancelled = true;
      callbacks.forEach((cb) => cb());
    },
  };
}

