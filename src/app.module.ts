// src/app.module.ts

import { Module } from "@nestjs/common";
import { McpServerService } from "./core/mcp-server/mcp-server.service";
import { ToolRegistryService } from "./tooling/tool-registry/tool-registry.service";
import { ConfigHolderService } from "./config/config-holder.service";
import { CONFIG_TOKEN } from "./config/constants";
import { InterfaceModule } from "./interface/interface.module";
import { ResourceModule } from "./resources/resource.module";
import { PromptModule } from "./prompts/prompt.module";
import { ContextProviderService } from "./core/context/context-provider.service";

// NOTE: This module is used internally by EasyMCP.initialize().
// The actual configuration is provided at runtime via EasyMCP.initialize(config)
// and stored in ConfigHolderService, which services read from.

@Module({
  imports: [InterfaceModule, ResourceModule, PromptModule],
  providers: [
    // Layer 3: The Orchestrator
    McpServerService,
    // Layer 3: Tool Registration is simple, so it can be a root provider
    ToolRegistryService,
    ConfigHolderService,
    // Context provider for extracting user context from requests
    ContextProviderService,
    // Inject the Config token
    {
      provide: CONFIG_TOKEN,
      useExisting: ConfigHolderService,
    },
  ],
  exports: [McpServerService], // Export the core service so it can be used externally
})
export class AppModule {}
