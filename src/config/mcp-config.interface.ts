/**
 * Defines the configuration for the Firestore Short-Term Memory (STM) service.
 */
export interface PersistenceConfig {
  type: "FIRESTORE"; // Currently only supports Firestore
  config: any; // Firebase configuration object
  appId: string;
  authToken: string | null;
}

/**
 * Defines the configuration for the Long-Term Memory (LTM) / RAG service.
 */
export interface LTMConfig {
  vectorDB: {
    type: string; // e.g., 'VECTOR_DB_SERVICE'
    endpoint: string;
    collectionName: string;
  };
  retrievalK: number; // Top K documents to retrieve
}

/**
 * Defines the configuration for the Layer 4 LLM Provider.
 */
export interface LlmProviderConfig {
  model: string; // e.g., 'gemini-2.5-flash-preview-09-2025'
  apiKey: string;
  systemInstruction: string;
}

/**
 * The unified, complete configuration object for EasyMCP.initialize().
 * NOTE: Tool registration needs a simpler interface for public use.
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
 * The main configuration object passed to EasyMCP.initialize().
 */
export interface McpConfig {
  persistence: PersistenceConfig;
  llmProvider: LlmProviderConfig;
  ltmConfig: LTMConfig;
  tools: ToolRegistrationInput[];
}
