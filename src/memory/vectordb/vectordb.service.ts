import { Injectable } from "@nestjs/common";

// src/memory/VectorDB.service.ts

import type { LTMConfig } from "../../config/mcp-config.interface"; // Config definition
import { EmbeddingService } from "../../providers/embedding/embedding.service"; // Assumes a service for generating vectors

/**
 * Represents a document snippet retrieved from the VectorDB.
 */
export interface RagDocument {
  text: string;
  source: string; // e.g., 'techdocs/file/CodeBlock.ts'
  score: number; // Relevance score
}

/**
 * Service to handle Long-Term Memory (LTM) search and retrieval using a VectorDB.
 */
@Injectable()
export class VectorDBService {
  private endpoint: string;
  private collectionName: string;

  constructor(
    config: LTMConfig,
    private embeddingService: EmbeddingService,
  ) {
    this.endpoint = config.vectorDB.endpoint;
    this.collectionName = config.vectorDB.collectionName;
    console.log(`LTM VectorDB connected to: ${this.endpoint}`);
  }

  /**
   * Performs the semantic search necessary for Retrieval-Augmented Generation (RAG).
   * @param query The user's question.
   * @param k The number of results to return (e.g., retrievalK: 3).
   * @returns An array of relevant documents.
   */
  public async retrieveRelevantFacts(
    query: string,
    k: number,
  ): Promise<RagDocument[]> {
    // 1. Convert the user's query into an embedding vector (Layer 4 task)
    const queryVector = await this.embeddingService.getEmbedding(query);

    // 2. Query the VectorDB endpoint
    // NOTE: This uses a conceptual 'fetch' call to the VectorDB service endpoint
    // In a real application, you'd use the vendor's SDK (e.g., Pinecone SDK).
    const response = await fetch(`${this.endpoint}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection: this.collectionName,
        vector: queryVector,
        limit: k,
      }),
    });

    if (!response.ok) {
      throw new Error(`VectorDB retrieval failed: ${response.statusText}`);
    }

    const results = (await response.json()) as VectorDBResult;
    // Transform the raw results into the RagDocument interface
    return results.documents as RagDocument[];
  }
}

interface VectorDBResult {
  documents: any[];
}
