import { EasyMCP } from "./EasyMCP";
import { McpConfig } from "./config/mcp-config.interface";

// This is a minimal mock config for startup, real config comes from client
const mockConfig: McpConfig = {
  // FIX 1 & 2: Removed 'enabled: false' as it doesn't exist on PersistenceConfig/LTMConfig types
  persistence: {
    type: "FIRESTORE",
    appId: "APP_ID",
    authToken: "AUTH_TOKEN",
    config: {},
  },
  ltmConfig: {
    vectorDB: {
      type: "VECTOR_DB_SERVICE",
      endpoint: "ENDPOINT",
      collectionName: "COLLECTION_NAME",
    },
    retrievalK: 1,
  },
  llmProvider: {
    apiKey: "mock-key",
    model: "gemini-2.5-flash",
    systemInstruction: "You are an intelligent assistant.",
  },
  tools: [],
};

async function bootstrap() {
  await EasyMCP.initialize(mockConfig);
  // FIX 3: Assuming EasyMCP.run() is static (must be fixed in EasyMCP.ts)
  void EasyMCP.run();
}
void bootstrap();
