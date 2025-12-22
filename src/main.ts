import { EasyMCP } from "./EasyMCP";
import { McpConfig } from "./config/mcp-config.interface";

// This is a minimal mock config for startup, real config comes from client
const mockConfig: McpConfig = {
  tools: [],
  serverInfo: {
    name: "easy-mcp-framework",
    version: "0.1.0",
  },
};

async function bootstrap() {
  await EasyMCP.initialize(mockConfig);
  // FIX 3: Assuming EasyMCP.run() is static (must be fixed in EasyMCP.ts)
  void EasyMCP.run();
}
void bootstrap();
