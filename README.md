# EasyMCP Framework

A NestJS-based framework for building Model Context Protocol (MCP) servers with LLM integration, tool execution, and memory management.

## Description

EasyMCP simplifies the creation of MCP (Model Context Protocol) servers by providing a clean, layered architecture that handles:

- **LLM Integration**: Seamless integration with Google Gemini (extensible to other providers)
- **Tool Execution**: Automatic execution of tools when LLMs call them
- **Memory Management**: Short-term conversation history and long-term RAG (Retrieval-Augmented Generation)
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install easy-mcp-framework
# or
pnpm add easy-mcp-framework
# or
yarn add easy-mcp-framework
```

## Quick Start

```typescript
import { EasyMCP, McpConfig } from 'easy-mcp-framework';

// Define your tools
async function getUser(args: { userId: string }): Promise<string> {
  // Your tool logic here
  const user = await fetchUser(args.userId);
  return JSON.stringify(user);
}

// Configure EasyMCP
const config: McpConfig = {
  persistence: {
    type: 'FIRESTORE',
    appId: 'my-app',
    authToken: process.env.FIREBASE_AUTH_TOKEN,
    config: { /* Firebase config */ },
  },
  llmProvider: {
    model: 'gemini-1.5-flash',
    apiKey: process.env.GOOGLE_API_KEY,
    systemInstruction: 'You are a helpful assistant.',
  },
  ltmConfig: {
    vectorDB: {
      type: 'VECTOR_DB_SERVICE',
      endpoint: 'https://your-vectordb.com',
      collectionName: 'documents',
    },
    retrievalK: 3,
  },
  tools: [
    {
      name: 'getUser',
      description: 'Retrieves user details by ID',
      function: getUser,
      inputSchema: {
        type: 'OBJECT',
        properties: {
          userId: {
            type: 'STRING',
            description: 'The unique ID of the user',
          },
        },
        required: ['userId'],
      },
    },
  ],
};

// Initialize and run
async function bootstrap() {
  await EasyMCP.initialize(config);
  await EasyMCP.run();
}

bootstrap();
```

## Configuration

### McpConfig

The main configuration object passed to `EasyMCP.initialize()`:

```typescript
interface McpConfig {
  persistence: PersistenceConfig;
  llmProvider: LlmProviderConfig;
  ltmConfig: LTMConfig;
  tools: ToolRegistrationInput[];
}
```

### PersistenceConfig

Configuration for short-term memory (conversation history):

```typescript
interface PersistenceConfig {
  type: 'FIRESTORE';
  appId: string;
  authToken: string | null;
  config: any; // Firebase configuration object
}
```

### LlmProviderConfig

Configuration for the LLM provider:

```typescript
interface LlmProviderConfig {
  model: string; // e.g., 'gemini-1.5-flash'
  apiKey: string;
  systemInstruction: string;
}
```

### LTMConfig

Configuration for long-term memory (RAG):

```typescript
interface LTMConfig {
  vectorDB: {
    type: string;
    endpoint: string;
    collectionName: string;
  };
  retrievalK: number; // Number of documents to retrieve
}
```

## Tool Registration

Tools are automatically registered when passed in the `config.tools` array. Each tool must implement:

```typescript
interface ToolRegistrationInput {
  name: string;
  description: string;
  function: (args: Record<string, any>) => Promise<any>;
  inputSchema: {
    type: 'OBJECT';
    properties: Record<string, {
      type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}
```

### Example Tool

```typescript
async function searchDatabase(args: { query: string; limit?: number }): Promise<string> {
  const results = await db.search(args.query, args.limit || 10);
  return JSON.stringify(results);
}

const searchTool: ToolRegistrationInput = {
  name: 'searchDatabase',
  description: 'Searches the database for matching records',
  function: searchDatabase,
  inputSchema: {
    type: 'OBJECT',
    properties: {
      query: {
        type: 'STRING',
        description: 'The search query',
      },
      limit: {
        type: 'INTEGER',
        description: 'Maximum number of results to return',
      },
    },
    required: ['query'],
  },
};
```

## API Reference

### EasyMCP Class

#### `static initialize(config: McpConfig): Promise<void>`

Initializes the EasyMCP framework with the provided configuration. Must be called before `run()`.

#### `static run(): Promise<void>`

Starts the EasyMCP server and begins listening for messages.

#### `static getService<T>(token: string | symbol): T`

Retrieves a service from the NestJS application context. Useful for advanced use cases.

### Types

- `McpConfig` - Main configuration interface
- `ToolRegistrationInput` - Tool definition interface
- `McpMessageInput` - Input message format
- `McpMessageOutput` - Output message format
- `ConversationTurn` - Conversation history turn
- `IMemoryService` - Memory service interface
- `IInterfaceLayer` - Interface layer interface
- `ILlmClient` - LLM client interface

## Architecture

EasyMCP uses a 4-layer architecture:

1. **Interface Layer**: Handles communication (WebSockets, HTTP, etc.)
2. **Memory Layer**: Manages short-term (conversation) and long-term (vector DB) memory
3. **Abstraction Layer**: Core orchestration logic
4. **Provider Layer**: Connects to LLMs (Google Gemini)

## Examples

### Basic Chat Bot

```typescript
import { EasyMCP, McpConfig } from 'easy-mcp-framework';

const config: McpConfig = {
  // ... configuration
  tools: [], // No tools needed for basic chat
};

await EasyMCP.initialize(config);
await EasyMCP.run();
```

### Tool-Enabled Assistant

```typescript
// Define tools that interact with your application
const tools = [
  createUserTool,
  updateUserTool,
  deleteUserTool,
  // ... more tools
];

const config: McpConfig = {
  // ... configuration
  tools,
};

await EasyMCP.initialize(config);
await EasyMCP.run();
```

## Error Handling

EasyMCP provides custom error classes:

- `EasyMcpError` - Base error class
- `ConfigurationError` - Configuration validation errors
- `ToolExecutionError` - Tool execution failures
- `ToolNotFoundError` - Tool not found in registry

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions, please open an issue on [GitHub](https://github.com/nirarazi/easy-mcp).
