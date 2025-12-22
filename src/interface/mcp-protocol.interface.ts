/**
 * MCP Protocol Types
 * Based on Model Context Protocol specification
 */

/**
 * Initialize request parameters
 */
export interface InitializeParams {
  protocolVersion: string;
  capabilities?: {
    tools?: {};
    resources?: {};
    prompts?: {};
  };
  clientInfo?: {
    name: string;
    version: string;
  };
}

/**
 * Initialize response with server capabilities
 */
export interface InitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: {};
    resources?: {};
    prompts?: {};
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

/**
 * MCP Tool definition (matches JSON Schema format)
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Tools list response
 */
export interface ListToolsResult {
  tools: McpTool[];
}

/**
 * Call tool request parameters
 */
export interface CallToolParams {
  name: string;
  arguments?: Record<string, any>;
}

/**
 * Call tool result
 */
export interface CallToolResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
}

/**
 * MCP-specific error codes
 */
export enum McpErrorCode {
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ToolNotFound = -32001,
  ToolExecutionError = -32002,
}

