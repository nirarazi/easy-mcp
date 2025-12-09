import { Test, TestingModule } from "@nestjs/testing";
import { LlmProviderService } from "./llm-provider.service";

describe("LlmProviderService", () => {
  let service: LlmProviderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LlmProviderService],
    }).compile();

    service = module.get<LlmProviderService>(LlmProviderService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
