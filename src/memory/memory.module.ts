import { Module, DynamicModule, Global } from "@nestjs/common";
import { SessionMemoryService } from "./session-memory.service";
import { McpConfig } from "../config/mcp-config.interface";
import { CONFIG_TOKEN, MEMORY_SERVICE_TOKEN } from "../config/constants";

@Global()
@Module({})
export class MemoryModule {
  static forRoot(config: McpConfig): DynamicModule {
    return {
      module: MemoryModule,
      providers: [
        // 1. Provide the full configuration object for the Memory Services to use
        {
          provide: CONFIG_TOKEN, // Assuming CONFIG_TOKEN holds the full config
          useValue: config,
        },
        // 2. Register the concrete implementation
        SessionMemoryService,
        // 3. Provide the service via its interface token for Dependency Injection
        {
          provide: MEMORY_SERVICE_TOKEN,
          useExisting: SessionMemoryService, // Use the instance created above
        },
      ],
      exports: [
        MEMORY_SERVICE_TOKEN, // Export the token so McpServerService can inject it
      ],
    };
  }
}
