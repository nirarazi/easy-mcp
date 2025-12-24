/**
 * JSON Schema 2020-12 compatible schema definition
 */
export interface JsonSchema2020_12 {
  type: "object" | "string" | "number" | "integer" | "boolean" | "array";
  properties?: Record<string, JsonSchema2020_12>;
  items?: JsonSchema2020_12 | JsonSchema2020_12[];
  required?: string[];
  description?: string;
  enum?: (string | number | boolean)[];
  default?: any;
  const?: any;
  oneOf?: JsonSchema2020_12[];
  anyOf?: JsonSchema2020_12[];
  allOf?: JsonSchema2020_12[];
  $ref?: string;
  // Additional JSON Schema properties
  [key: string]: any;
}

/**
 * The unified, complete configuration object for EasyMCP.initialize().
 * Uses JSON Schema 2020-12 format for input schemas.
 */
export interface ToolRegistrationInput {
  name: string;
  description: string;
  function: (args: Record<string, any>) => Promise<any>;
  inputSchema: JsonSchema2020_12;
  icon?: string; // Optional icon URI for the tool
}

/**
 * Server information for MCP initialize response.
 */
export interface ServerInfo {
  name: string;
  version: string;
}

/**
 * Resource registration input
 */
export interface ResourceRegistrationInput {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  icon?: string;
  /** Function that returns the resource content */
  getContent: () => Promise<string | { type: string; data: string; mimeType?: string }>;
}

/**
 * Prompt registration input
 */
export interface PromptRegistrationInput {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  icon?: string;
  /** Function that generates the prompt content from arguments */
  getPrompt: (args: Record<string, any>) => Promise<Array<{
    role: "user" | "assistant";
    content: Array<{
      type: "text" | "image" | "resource";
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    }>;
  }>>;
}

/**
 * The main configuration object passed to EasyMCP.initialize().
 */
export interface McpConfig {
  tools: ToolRegistrationInput[];
  resources?: ResourceRegistrationInput[];
  prompts?: PromptRegistrationInput[];
  serverInfo?: ServerInfo;
}
