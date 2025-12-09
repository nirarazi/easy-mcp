import { Test, TestingModule } from "@nestjs/testing";
import { VectorDBService } from "./vectordb.service";

describe("VectordbService", () => {
  let service: VectorDBService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VectorDBService],
    }).compile();

    service = module.get<VectorDBService>(VectorDBService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
