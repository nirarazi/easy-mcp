import { Test, TestingModule } from "@nestjs/testing";
import { EmbeddingService } from "./embedding.service";
import { EMBEDDING_CLIENT_TOKEN } from "../../../src/config/constants";
// Assuming the client is injected via a token defined in constants

// FIX: Mock the client functionality expected by EmbeddingService
const mockEmbeddingClient = {
  // Mock the method the service calls
  embedContent: jest
    .fn()
    .mockResolvedValue({ embedding: { values: [0.1, 0.2] } }),
};

describe("EmbeddingService", () => {
  let service: EmbeddingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          // Provide the dependency via a token with a mock implementation
          provide: EMBEDDING_CLIENT_TOKEN,
          useValue: mockEmbeddingClient,
        },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
