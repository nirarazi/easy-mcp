// src/app.module.ts

import { Module } from "@nestjs/common";
import { McpServerService } from "./core/mcp-server/mcp-server.service";
import { ProvidersModule } from "./providers/providers.module";
import { MemoryModule } from "./memory/memory.module";
import { ToolRegistryService } from "./tooling/tool-registry/tool-registry.service";
import {
  McpConfig,
  ToolRegistrationInput,
} from "./config/mcp-config.interface";
import { ConfigHolderService } from "./config/config-holder.service";
import { CONFIG_TOKEN, SYSTEM_INSTRUCTION_TOKEN } from "./config/constants";

async function lookupCodeExample(args: Record<string, any>): Promise<string> {
  console.log(`TOOL: Performing specific database lookup for: ${args.query}`);

  // Safely cast/destructure the arguments to access 'query'
  const { query } = args as { query: string };

  if (!query) {
    throw new Error("Missing required 'query' argument for tool.");
  }

  console.log(`TOOL: Performing specific database lookup for: ${query}`);
  await new Promise((resolve) => setTimeout(resolve, 50));

  if (query.toLowerCase().includes("react")) {
    return "Found React component example: Uses functional component 'CodeBlock' to display TypeScript syntax highlighting.";
  }
  return "Code example lookup failed: Query too broad.";
}

const lookupCodeTool: ToolRegistrationInput = {
  name: "lookupCodeExample",
  description:
    "Use this tool to search the private code repository for specific example code blocks.",
  function: lookupCodeExample,
  inputSchema: {
    type: "OBJECT",
    properties: {
      query: {
        type: "STRING",
        description:
          "The specific code topic or programming language the user is asking about.",
      },
    },
    required: ["query"],
  },
};

// NOTE: This config would be loaded from EasyMCP.initialize() or ENV files.
const FRAMEWORK_CONFIG: McpConfig = {
  persistence: {
    type: "FIRESTORE",
    config: {},
    appId: "techdocs-app",
    authToken: null,
  },
  llmProvider: {
    model: "gemini-2.5-flash-preview-09-2025",
    apiKey: "YOUR_SECURE_API_KEY",
    systemInstruction:
      "You are the highly knowledgeable TechDocs AI Assistant. Always be concise and professional.",
  },
  ltmConfig: {
    vectorDB: {
      type: "VECTOR_DB_SERVICE",
      endpoint: "https://vectordb.techdocs.com/index-a",
      collectionName: "code_documentation_v2",
    },
    retrievalK: 3,
  },
  tools: [lookupCodeTool],
};

@Module({
  imports: [
    ProvidersModule.forRoot(FRAMEWORK_CONFIG.llmProvider), // Pass config to Layer 4
    MemoryModule.forRoot(FRAMEWORK_CONFIG), // Pass config to Layer 2
  ],
  providers: [
    // Layer 3: The Orchestrator
    McpServerService,
    // Layer 3: Tool Registration is simple, so it can be a root provider
    ToolRegistryService,
    ConfigHolderService,
    // Inject the System Instruction constant required by McpServerService
    {
      provide: CONFIG_TOKEN,
      useExisting: ConfigHolderService,
    },
    {
      provide: SYSTEM_INSTRUCTION_TOKEN,
      useFactory: (configService: ConfigHolderService) => {
        return configService.getConfig().llmProvider.systemInstruction;
      },
      inject: [ConfigHolderService],
    },
  ],
  exports: [McpServerService], // Export the core service so it can be used externally
})
export class AppModule {}
