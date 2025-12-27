// Main class
export { EasyMCP } from './EasyMCP';

// Configuration interfaces
export type {
  McpConfig,
  ToolRegistrationInput,
  ServerInfo,
} from './config/mcp-config.interface';

// Interface layer
export type { IInterfaceLayer } from './interface/interface.interface';

// JSON-RPC interfaces
export type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
} from './interface/jsonrpc.interface';

export { JsonRpcErrorCode } from './interface/jsonrpc.interface';

// MCP Protocol interfaces
export type {
  InitializeParams,
  InitializeResult,
  ListToolsResult,
  McpTool,
  CallToolParams,
  CallToolResult,
} from './interface/mcp-protocol.interface';

export { McpErrorCode } from './interface/mcp-protocol.interface';

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
} from './core/errors/easy-mcp-error';

// Utilities
export { ToolNamingValidator } from './core/utils/tool-naming-validator';

// Constants (for advanced use cases)
export { INTERFACE_LAYER_TOKEN } from './config/constants';

// Version information
export { VERSION, PACKAGE_NAME, getVersion, getPackageName } from './config/version';

// Context and decorators
export type { McpContext } from './core/context/mcp-context.interface';
export { McpContext as McpContextDecorator } from './decorators';

