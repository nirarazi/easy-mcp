// src/app.module.ts

import { Module } from "@nestjs/common";
import { McpServerService } from "./core/mcp-server/mcp-server.service";
import { ProvidersModule } from "./providers/providers.module";
import { MemoryModule } from "./memory/memory.module";
import { ToolRegistryService } from "./tooling/tool-registry/tool-registry.service";
import { ConfigHolderService } from "./config/config-holder.service";
import { CONFIG_TOKEN, SYSTEM_INSTRUCTION_TOKEN } from "./config/constants";

// NOTE: This module is used internally by EasyMCP.initialize().
// The placeholder configs below are required for NestJS module initialization.
// The actual configuration is provided at runtime via EasyMCP.initialize(config)
// and stored in ConfigHolderService, which services read from.

// Minimal placeholder configs for module initialization
// These will be replaced by the real config in EasyMCP.initialize()
const PLACEHOLDER_LLM_CONFIG = {
  model: "gemini-1.5-flash",
  apiKey: "placeholder",
  systemInstruction: "Placeholder",
};

const PLACEHOLDER_MCP_CONFIG = {
  persistence: {
    type: "FIRESTORE" as const,
    appId: "placeholder",
    authToken: null,
    config: {},
  },
  llmProvider: PLACEHOLDER_LLM_CONFIG,
  ltmConfig: {
    vectorDB: {
      type: "VECTOR_DB_SERVICE",
      endpoint: "https://placeholder.com",
      collectionName: "placeholder",
    },
    retrievalK: 3,
  },
  tools: [],
};

@Module({
  imports: [
    // These modules require config via forRoot() at module definition time.
    // The placeholder configs above are used here, but the real config
    // is provided via EasyMCP.initialize() and stored in ConfigHolderService.
    ProvidersModule.forRoot(PLACEHOLDER_LLM_CONFIG),
    MemoryModule.forRoot(PLACEHOLDER_MCP_CONFIG),
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
