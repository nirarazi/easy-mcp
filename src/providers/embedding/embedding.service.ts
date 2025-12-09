import { Inject, Injectable } from "@nestjs/common";
import { EMBEDDING_CLIENT_TOKEN } from "../../config/constants";

// import { GeminiClient } from './GeminiClient'; // Reusing the underlying client

@Injectable()
export class EmbeddingService {
  private llmClient: EmbeddingClient; // The same underlying client used for LlmProviderService

  constructor(@Inject(EMBEDDING_CLIENT_TOKEN) clientInstance: EmbeddingClient) {
    this.llmClient = clientInstance;
  }

  /**
   * Converts a string of text (e.g., user query or document chunk) into a vector.
   * @param text The text to be embedded.
   * @returns A Promise resolving to a numeric vector array.
   */
  public async getEmbedding(text: string): Promise<number[]> {
    // NOTE: Uses the provider's specific embedding endpoint/model
    const result = await this.llmClient.embedContent({
      model: "embedding-001", // Standard Google embedding model name
      content: text,
    });

    // Assuming the result structure contains a single embedding array
    return result.embedding;
  }
}

export interface EmbeddingClient {
  embedContent: (args: {
    model: string;
    content: string;
  }) => Promise<EmbeddingResult>;
}

export interface EmbeddingResult {
  embedding: number[];
}
