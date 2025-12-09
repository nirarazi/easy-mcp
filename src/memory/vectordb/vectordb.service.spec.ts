import { Test, TestingModule } from "@nestjs/testing";
import { VectorDBService } from "./vectordb.service";
import { EmbeddingService } from "../../providers/embedding/embedding.service";
import { VECTOR_DB_CONFIG } from "../../config/constants";

// FIX: Mock the EmbeddingService dependency
const mockEmbeddingService = {
  getEmbedding: jest.fn(),
};

describe("VectorDBService", () => {
  let service: VectorDBService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorDBService,
        {
          provide: VECTOR_DB_CONFIG as string,
          useValue: { vectorDB: { endpoint: "ENDPOINT" } },
        },
        { provide: EmbeddingService, useValue: mockEmbeddingService },
      ],
    }).compile();

    service = module.get<VectorDBService>(VectorDBService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
