# EasyMCP Framework Implementation Guide

This guide is designed for engineers integrating the **EasyMCP Framework** into an existing TypeScript/Node.js SaaS product. EasyMCP enables you to add Model Context Protocol (MCP) server capabilities, allowing LLMs (like Gemini) to interact with your application's data and tools.

## 1. Overview
The EasyMCP framework provides a 4-layer architecture:
1.  **Interface Layer**: Handles communication (WebSockets, HTTP, etc.).
2.  **Memory Layer**: Manages short-term (conversation) and long-term (vector DB) memory.
3.  **Abstraction Layer**: Core orchestration logic.
4.  **Provider Layer**: Connects to LLMs (Google Gemini).

## 2. Integration Setup

### Option A: npm Package (Recommended)
1.  Install EasyMCP as a dependency:
    ```bash
    npm install easy-mcp-framework
    # or
    pnpm add easy-mcp-framework
    # or
    yarn add easy-mcp-framework
    ```
2.  Import and use in your project:
    ```typescript
    import { EasyMCP, McpConfig } from 'easy-mcp-framework';
    ```

### Option B: Direct Integration (For Monorepos)
1.  Copy the `src` directory from this repository into a new folder in your project, e.g., `packages/mcp-server` or `src/modules/mcp`.
2.  Install the required dependencies:
    ```bash
    npm install @nestjs/common @nestjs/core @nestjs/platform-express @google/genai firebase rxjs reflect-metadata
    ```

### Option C: As a Microservice
1.  Clone this repository as a standalone service.
2.  Configure it to communicate with your main SaaS app via API calls.

## 3. Configuration

You need to initialize the framework with a `McpConfig` object. This typically happens in your application's entry point (`main.ts`).

### Required Environment Variables
- `GOOGLE_API_KEY`: For Gemini API.
- `FIREBASE_XXX`: If using Firestore for persistence.

### Initialization Code
In your `main.ts`:
```typescript
import { EasyMCP } from './mcp/EasyMCP'; // Adjust path
import { McpConfig } from './mcp/config/mcp-config.interface';

const config: McpConfig = {
  persistence: {
    type: 'FIRESTORE',
    appId: 'my-saas-app',
    authToken: process.env.FIREBASE_AUTH_TOKEN,
    config: { /* Firebase Config */ }
  },
  ltmConfig: {
    vectorDB: {
      type: 'VECTOR_DB_SERVICE',
      endpoint: process.env.VECTOR_DB_ENDPOINT,
      collectionName: 'saas_docs'
    },
    retrievalK: 3
  },
  llmProvider: {
    model: 'gemini-1.5-flash',
    apiKey: process.env.GOOGLE_API_KEY,
    systemInstruction: 'You are a helpful assistant for MySaaSApp.'
  },
  tools: [] // We will add tools next
};

async function bootstrap() {
  // Tools are automatically registered during initialize()
  await EasyMCP.initialize(config);
  await EasyMCP.run();
}
bootstrap();
```

## 4. Defining & Registering Tools

Tools allow the LLM to perform actions in your SaaS (e.g., "Get user details", "Reset password").

### Step 4.1: Define the Tool Function
Create a function that performs the action. It should accept an object of arguments.
```typescript
// tools/get-user.tool.ts
export async function getUser(args: { userId: string }) {
  // Call your SaaS service/DB here
  const user = await myUserService.findById(args.userId);
  return JSON.stringify(user);
}
```

### Step 4.2: Define the Schema
Define the JSON schema so the LLM knows how to call it.
```typescript
import { ToolRegistrationInput } from '../mcp/config/mcp-config.interface';

export const getUserTool: ToolRegistrationInput = {
  name: 'getUser',
  description: 'Retrieves user details by ID',
  function: getUser,
  inputSchema: {
    type: 'OBJECT',
    properties: {
      userId: { type: 'STRING', description: 'The unique ID of the user' }
    },
    required: ['userId']
  }
};
```

### Step 4.3: Add Tools to Configuration
**Tools are automatically registered** when you pass them in the `config.tools` array during `EasyMCP.initialize()`. No manual registration is needed!

Simply include your tools in the configuration:

```typescript
const config: McpConfig = {
  // ... other config
  tools: [getUserTool], // Tools are automatically registered!
};

await EasyMCP.initialize(config);
```

The framework will:
1. Validate each tool's schema
2. Convert the tool format to the internal registry format
3. Register all tools automatically
4. Make them available to the LLM immediately

If a tool fails to register (e.g., duplicate name, invalid schema), `initialize()` will throw an error with details.

## 5. Connecting the Interface (Transports)

The default `WebSocketGatewayService` provides a mock implementation. To make this production-ready:
1.  **WebSockets**: Implement a real NestJS WebSocket Gateway (using `@nestjs/websockets`) inside `src/interface`.
2.  **HTTP/SSE**: Alternatively, implement an optional HTTP Controller to expose an endpoint (e.g., `/mcp/message`) that calls `McpServerService.handleMessage()`.

Example HTTP Controller:
```typescript
@Controller('mcp')
export class McpController {
  constructor(private mcpService: McpServerService) {}

  @Post('message')
  async handleMessage(@Body() body: McpMessageInput) {
    return this.mcpService.handleMessage(body);
  }
}
```

## 6. Debugging & Testing
- use `npm run start:dev` to run the server.
- Watch the logs for `[Layer 3]`.
- If the LLM isn't calling tools, check the `availableTools` log in `McpServerService` or add logging there.
- **Note**: The default `WebSocketGatewayService` includes a `mockReceiveMessage` call in its `start()` method to demonstrate functionality. You should remove this call in `src/interface/websocket-gateway.service.ts` when moving to production.
