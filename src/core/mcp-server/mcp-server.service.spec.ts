import { Test, TestingModule } from "@nestjs/testing";
import { McpServerService } from "./mcp-server.service";
// Import all external dependencies and tokens
import { LlmProviderService } from "../../providers/llm-provider/llm-provider.service";
import { ToolRegistryService } from "../../tooling/tool-registry/tool-registry.service";
import {
  INTERFACE_LAYER_TOKEN,
  MEMORY_SERVICE_TOKEN,
  SYSTEM_INSTRUCTION_TOKEN,
} from "../../config/constants";
import { WebSocketGatewayService } from "../../interface/websocket-gateway.service";

// Mock dependencies
class MockLlmProviderService {}
class MockToolRegistryService {}
class MockMemoryService {}
class MockInterfaceLayer {}
class MockWebSocketGatewayService {
  setMcpServerService = jest.fn();
}

describe("McpServerService", () => {
  let service: McpServerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      // FIX 1: Move all services to the providers array (no 'imports')
      providers: [
        McpServerService,
        { provide: LlmProviderService, useClass: MockLlmProviderService },
        { provide: ToolRegistryService, useClass: MockToolRegistryService },
        {
          provide: WebSocketGatewayService,
          useClass: MockWebSocketGatewayService,
        },
        // FIX 2: Provide all required tokens with mock values/classes
        { provide: MEMORY_SERVICE_TOKEN, useClass: MockMemoryService },
        { provide: SYSTEM_INSTRUCTION_TOKEN, useValue: "mock instruction" },
        { provide: INTERFACE_LAYER_TOKEN, useClass: MockInterfaceLayer },
      ],
    }).compile();

    service = module.get<McpServerService>(McpServerService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
