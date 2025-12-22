/**
 * The unified, complete configuration object for EasyMCP.initialize().
 */
export interface ToolRegistrationInput {
  name: string;
  description: string;
  function: (args: Record<string, any>) => Promise<any>;
  inputSchema: {
    type: "OBJECT";
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Server information for MCP initialize response.
 */
export interface ServerInfo {
  name: string;
  version: string;
}

/**
 * The main configuration object passed to EasyMCP.initialize().
 */
export interface McpConfig {
  tools: ToolRegistrationInput[];
  serverInfo?: ServerInfo;
}
