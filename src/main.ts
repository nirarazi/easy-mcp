import { EasyMCP } from "./EasyMCP";
import { McpConfig } from "./config/mcp-config.interface";
import { PACKAGE_NAME, VERSION } from "./config/version";

// This is a minimal mock config for startup, real config comes from client
const mockConfig: McpConfig = {
  tools: [],
  serverInfo: {
    name: PACKAGE_NAME,
    version: VERSION,
  },
};

async function bootstrap() {
  await EasyMCP.initialize(mockConfig);
  // FIX 3: Assuming EasyMCP.run() is static (must be fixed in EasyMCP.ts)
  void EasyMCP.run();
}
void bootstrap();
