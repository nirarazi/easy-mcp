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
    sampling?: {};
    roots?: {};
    elicitation?: {};
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
 * MCP Tool definition (matches JSON Schema 2020-12 format)
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
  icon?: string; // Optional icon URI for the tool
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
 * Resource definition in MCP format
 */
export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  icon?: string;
}

/**
 * Resources list response
 */
export interface ListResourcesResult {
  resources: McpResource[];
}

/**
 * Read resource request parameters
 */
export interface ReadResourceParams {
  uri: string;
}

/**
 * Read resource result
 */
export interface ReadResourceResult {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

/**
 * Prompt definition in MCP format
 */
export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  icon?: string;
}

/**
 * Prompts list response
 */
export interface ListPromptsResult {
  prompts: McpPrompt[];
}

/**
 * Get prompt request parameters
 */
export interface GetPromptParams {
  name: string;
  arguments?: Record<string, any>;
}

/**
 * Get prompt result
 */
export interface GetPromptResult {
  messages: Array<{
    role: "user" | "assistant";
    content: Array<{
      type: "text" | "image" | "resource";
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    }>;
  }>;
}

/**
 * Sampling request parameters (client feature)
 */
export interface SamplingRequestParams {
  messages: Array<{
    role: "user" | "assistant";
    content: Array<{
      type: "text" | "image" | "resource";
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    }>;
  }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

/**
 * Sampling result (client feature)
 */
export interface SamplingResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  model: string;
  stopReason: "end_turn" | "stop_sequence" | "max_tokens" | "cancelled" | "error";
}

/**
 * Roots list result (client feature)
 */
export interface ListRootsResult {
  roots: Array<{
    uri: string;
    name?: string;
  }>;
}

/**
 * Roots read parameters (client feature)
 */
export interface ReadRootParams {
  uri: string;
}

/**
 * Roots read result (client feature)
 */
export interface ReadRootResult {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

/**
 * Elicit request parameters (client feature)
 */
export interface ElicitParams {
  message?: string;
  schema: {
    type: "string" | "number" | "boolean" | "enum";
    description?: string;
    enum?: Array<{
      value: string | number | boolean;
      title?: string;
    }>;
    default?: string | number | boolean;
    mode?: "single" | "multiple";
  };
}

/**
 * Elicit result (client feature)
 */
export interface ElicitResult {
  value: string | number | boolean | (string | number | boolean)[];
}

/**
 * Progress notification (server-initiated notification)
 */
export interface ProgressNotification {
  jsonrpc: "2.0";
  method: "notifications/progress";
  params: {
    progressToken: string;
    progress: number; // 0.0 to 1.0
    total?: number;
    message?: string;
  };
}

/**
 * Cancellation request parameters
 */
export interface CancelRequestParams {
  requestId: string | number;
}

/**
 * Cancellation result
 */
export interface CancelResult {
  cancelled: boolean;
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
  ResourceNotFound = -32003,
  PromptNotFound = -32004,
  SamplingNotSupported = -32005,
  RootsNotSupported = -32006,
  ElicitationNotSupported = -32007,
  RequestCancelled = -32008,
}

