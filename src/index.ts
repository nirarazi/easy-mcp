// Main class
export { EasyMCP } from './EasyMCP';

// Configuration interfaces
export type {
  McpConfig,
  ToolRegistrationInput,
  LlmProviderConfig,
  PersistenceConfig,
  LTMConfig,
} from './config/mcp-config.interface';

// Message interfaces
export type {
  McpMessageInput,
  McpMessageOutput,
  McpInput,
  McpOutput,
} from './interface/mcp.interface';

// Memory interfaces
export type {
  ConversationTurn,
  IMemoryService,
} from './memory/memory.interface';

export type {
  SessionState,
} from './session/memory.interface';

// Interface layer
export type { IInterfaceLayer } from './interface/interface.interface';

// Provider interfaces
export type { ILlmClient } from './providers/llm-client.interface';

// Tool interfaces
export type {
  ToolDefinition,
  ToolParameter,
  ToolFunction,
} from './tooling/tool.interface';

// Error classes
export {
  EasyMcpError,
  ConfigurationError,
  ToolExecutionError,
  ToolNotFoundError,
  LlmApiError,
} from './core/errors/easy-mcp-error';

// Constants (for advanced use cases)
export { INTERFACE_LAYER_TOKEN } from './config/constants';

