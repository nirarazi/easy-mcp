import { ToolRegistrationInput, ResourceRegistrationInput, PromptRegistrationInput, ServerInfo } from "../config/mcp-config.interface";
import { McpContext } from "../core/context/mcp-context.interface";

/**
 * Transport type for standalone MCP server.
 */
export type StandaloneTransport = "stdio" | "http";

/**
 * Authentication function for standalone mode.
 */
export type StandaloneAuthFunction = (request: any) => Promise<McpContext> | McpContext | null;

/**
 * Options for creating a standalone MCP server.
 */
export interface CreateMcpServerOptions {
  /** Array of tool registration inputs */
  tools: ToolRegistrationInput[];
  
  /** Array of resource registration inputs */
  resources?: ResourceRegistrationInput[];
  
  /** Array of prompt registration inputs */
  prompts?: PromptRegistrationInput[];
  
  /** Server information */
  serverInfo?: ServerInfo;
  
  /** Transport type (default: 'stdio') */
  transport?: StandaloneTransport;
  
  /** Optional authentication function */
  auth?: StandaloneAuthFunction;
  
  /** HTTP port (only used when transport is 'http') */
  port?: number;
  
  /** HTTP host (only used when transport is 'http', default: 'localhost') */
  host?: string;
}

