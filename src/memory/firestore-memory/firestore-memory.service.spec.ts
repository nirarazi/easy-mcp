import { Test, TestingModule } from "@nestjs/testing";
import { McpConfig } from "src/config/mcp-config.interface";
import { CONFIG_TOKEN } from "../../config/constants";
import { FirestoreMemoryService } from "./firestore-memory.service";

jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn().mockReturnValue([]), // Return empty array to allow initializeApp
}));
// Optionally, mock firestore if your service uses it directly
jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  query: jest.fn(),
}));

// FIX: Provide a mock config with the full structure required for Firebase initialization
const mockConfig = {
  // Persistence block is crucial for FirestoreMemoryService
  persistence: {
    type: "FIRESTORE",
    appId: "appId",
    authToken: "authToken",
    config: {
      projectId: "test-project", // Required by Firebase initializeApp
      apiKey: "test-api-key", // Common required Firebase field
      authDomain: "test-auth-domain",
      // Include any other Firebase-related fields the service might read
    },
  },
  // Include other top-level fields to satisfy McpConfig interface if necessary
  llmProvider: {
    model: "model",
    apiKey: "API_KEY",
    systemInstruction: "SYSTEM_INSTRUCTION",
  },
  ltmConfig: {
    vectorDB: {
      type: "DB_TYPE",
      endpoint: "ENDPOINT",
      collectionName: "COLLECTION_NAME",
    },
    retrievalK: 1,
  },
  tools: [],
} as McpConfig; // Cast as any for simplicity in testing the config structure

describe("FirestoreMemoryService", () => {
  let service: FirestoreMemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirestoreMemoryService,
        {
          // Provide the required configuration token
          provide: CONFIG_TOKEN,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<FirestoreMemoryService>(FirestoreMemoryService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
