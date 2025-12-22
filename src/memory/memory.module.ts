import { Module, DynamicModule, Global } from "@nestjs/common";
import { SessionMemoryService } from "./session-memory.service";
import { FirestoreMemoryService } from "./firestore-memory/firestore-memory.service";
import { VectorDBService } from "./vectordb/vectordb.service";
import { McpConfig } from "../config/mcp-config.interface";
import { CONFIG_TOKEN, MEMORY_SERVICE_TOKEN, VECTOR_DB_CONFIG } from "../config/constants";

@Global()
@Module({})
export class MemoryModule {
  static forRoot(config: McpConfig): DynamicModule {
    const providers: any[] = [
      // 1. Provide the full configuration object for the Memory Services to use
      {
        provide: CONFIG_TOKEN, // Assuming CONFIG_TOKEN holds the full config
        useValue: config,
      },
      // 2. Provide VectorDB configuration if ltmConfig is present
      {
        provide: VECTOR_DB_CONFIG,
        useValue: config.ltmConfig,
      },
      // 3. Register VectorDBService (requires EmbeddingService from ProvidersModule)
      VectorDBService,
    ];

    // 4. Select memory service based on persistence type
    const persistenceType = config.persistence?.type;
    let memoryServiceClass;
    
    if (persistenceType === "FIRESTORE") {
      memoryServiceClass = FirestoreMemoryService;
      providers.push(FirestoreMemoryService);
      console.log("[MemoryModule] Using FirestoreMemoryService for persistence");
    } else {
      memoryServiceClass = SessionMemoryService;
      providers.push(SessionMemoryService);
      console.log("[MemoryModule] Using SessionMemoryService (in-memory) for persistence");
    }

    // 5. Provide the service via its interface token for Dependency Injection
    providers.push({
      provide: MEMORY_SERVICE_TOKEN,
      useExisting: memoryServiceClass, // Use the selected implementation
    });

    return {
      module: MemoryModule,
      providers,
      exports: [
        MEMORY_SERVICE_TOKEN, // Export the token so McpServerService can inject it
        VectorDBService, // Export VectorDBService for potential direct use
      ],
    };
  }
}
