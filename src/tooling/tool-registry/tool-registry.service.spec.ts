import { Test, TestingModule } from "@nestjs/testing";
import { ToolRegistryService } from "./tool-registry.service";

describe("ToolRegistryService", () => {
  let service: ToolRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ToolRegistryService],
    }).compile();

    service = module.get<ToolRegistryService>(ToolRegistryService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
