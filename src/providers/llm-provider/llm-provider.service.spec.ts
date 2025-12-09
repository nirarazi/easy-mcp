import { Test, TestingModule } from "@nestjs/testing";
import { LlmProviderService } from "./llm-provider.service";
import { GeminiClientService } from "../gemini/gemini-client.service";
import { LLM_PROVIDER_CONFIG_TOKEN } from "../../config/constants"; // Assuming this token exists

// Mock the GeminiClientService to prevent real API calls
class MockGeminiClientService {
  generateContent = jest.fn();
}

describe("LlmProviderService", () => {
  let service: LlmProviderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmProviderService,
        {
          // FIX 1: Provide the required configuration token for GeminiClientService
          provide: LLM_PROVIDER_CONFIG_TOKEN,
          useValue: { apiKey: "mock-key", model: "test-model" },
        },
        {
          // FIX 2: Replace the real GeminiClientService with a mock
          provide: GeminiClientService,
          useClass: MockGeminiClientService,
        },
      ],
    }).compile();

    service = module.get<LlmProviderService>(LlmProviderService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
