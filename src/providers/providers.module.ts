import { Module, DynamicModule, Global } from "@nestjs/common";
import { LlmProviderService } from "./llm-provider/llm-provider.service";
import { EmbeddingService } from "./embedding/embedding.service";
import { GeminiClientService } from "./gemini/gemini-client.service"; // Import the client
import { LlmProviderConfig } from "../config/mcp-config.interface";
import { LLM_PROVIDER_CONFIG_TOKEN } from "../config/constants";

// We make this module Global so the EmbeddingService can access LlmProviderService
@Global()
@Module({})
export class ProvidersModule {
  static forRoot(config: LlmProviderConfig): DynamicModule {
    return {
      module: ProvidersModule,
      providers: [
        // 1. Provide the configuration object
        {
          provide: LLM_PROVIDER_CONFIG_TOKEN,
          useValue: config,
        },
        // 2. Register the concrete client (which consumes the config)
        GeminiClientService,
        // 3. Register the abstraction layer (which consumes the client)
        LlmProviderService,
        // 4. Register the Embedding service
        EmbeddingService,
      ],
      exports: [
        LlmProviderService,
        EmbeddingService,
        GeminiClientService, // Export client for testing or other abstractions
      ],
    };
  }
}
