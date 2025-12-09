import { Test, TestingModule } from "@nestjs/testing";
import { FirestoreMemoryService } from "./firestore-memory.service";

describe("FirestoreMemoryService", () => {
  let service: FirestoreMemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FirestoreMemoryService],
    }).compile();

    service = module.get<FirestoreMemoryService>(FirestoreMemoryService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
