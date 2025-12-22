import { Inject, Injectable } from "@nestjs/common";

// src/memory/VectorDB.service.ts

import type { LTMConfig } from "../../config/mcp-config.interface"; // Config definition
import { EmbeddingService } from "../../providers/embedding/embedding.service"; // Assumes a service for generating vectors
import { VECTOR_DB_CONFIG } from "../../../src/config/constants";

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
  private readonly requestTimeout: number = 10000; // 10 seconds default timeout

  constructor(
    @Inject(VECTOR_DB_CONFIG) config: LTMConfig,
    private embeddingService: EmbeddingService,
  ) {
    this.endpoint = this.validateEndpoint(config.vectorDB.endpoint);
    this.collectionName = config.vectorDB.collectionName;
    console.log(`LTM VectorDB connected to: ${this.endpoint}`);
  }

  /**
   * Validates the VectorDB endpoint URL to prevent SSRF attacks.
   * Only allows HTTP/HTTPS URLs with public IPs or hostnames.
   * Blocks localhost, private IPs, and internal network addresses.
   */
  private validateEndpoint(endpoint: string): string {
    if (!endpoint || typeof endpoint !== 'string') {
      throw new Error('VectorDB endpoint must be a non-empty string');
    }

    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new Error(`Invalid VectorDB endpoint URL: ${endpoint}`);
    }

    // Only allow HTTP and HTTPS protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`VectorDB endpoint must use http:// or https:// protocol, got: ${url.protocol}`);
    }

    const hostname = url.hostname.toLowerCase();

    // Block localhost and loopback addresses
    const blockedHostnames = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '0:0:0:0:0:0:0:1',
    ];

    if (blockedHostnames.includes(hostname)) {
      throw new Error(`VectorDB endpoint cannot be localhost or loopback address: ${hostname}`);
    }

    // Block private IP ranges (RFC 1918)
    const privateIpPatterns = [
      /^10\./,                    // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./,              // 192.168.0.0/16
      /^169\.254\./,              // Link-local
      /^fc00:/,                   // IPv6 private
      /^fe80:/,                   // IPv6 link-local
    ];

    for (const pattern of privateIpPatterns) {
      if (pattern.test(hostname)) {
        throw new Error(`VectorDB endpoint cannot be a private IP address: ${hostname}`);
      }
    }

    // Block metadata endpoints (common cloud provider metadata services)
    const blockedMetadataHosts = [
      'metadata.google.internal',
      '169.254.169.254', // AWS, GCP, Azure metadata
      'metadata',
    ];

    if (blockedMetadataHosts.some(blocked => hostname.includes(blocked))) {
      throw new Error(`VectorDB endpoint cannot point to metadata service: ${hostname}`);
    }

    return endpoint;
  }

  /**
   * Performs the semantic search necessary for Retrieval-Augmented Generation (RAG).
   * @param query The user's question.
   * @param k The number of results to return (e.g., retrievalK: 3).
   * @returns An array of relevant documents.
   * @throws Error if VectorDB request fails, times out, or returns invalid response.
   */
  public async retrieveRelevantFacts(
    query: string,
    k: number,
  ): Promise<RagDocument[]> {
    try {
      // 1. Convert the user's query into an embedding vector (Layer 4 task)
      let queryVector: number[];
      try {
        queryVector = await this.embeddingService.getEmbedding(query);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to generate embedding for query: ${errorMessage}`);
      }

      // 2. Query the VectorDB endpoint with timeout
      // NOTE: This uses a conceptual 'fetch' call to the VectorDB service endpoint
      // In a real application, you'd use the vendor's SDK (e.g., Pinecone SDK).
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

      let response: Response;
      try {
        response = await fetch(`${this.endpoint}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collection: this.collectionName,
            vector: queryVector,
            limit: k,
          }),
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`VectorDB request timed out after ${this.requestTimeout}ms`);
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`VectorDB network error: ${errorMessage}`);
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const statusText = response.statusText || `HTTP ${response.status}`;
        let errorMessage = `VectorDB retrieval failed: ${statusText}`;
        
        // Provide more specific error messages
        if (response.status === 401 || response.status === 403) {
          errorMessage = `VectorDB authentication failed (${response.status}): Check your credentials`;
        } else if (response.status === 404) {
          errorMessage = `VectorDB collection '${this.collectionName}' not found (404)`;
        } else if (response.status === 429) {
          errorMessage = `VectorDB rate limit exceeded (429): Please retry later`;
        } else if (response.status >= 500) {
          errorMessage = `VectorDB server error (${response.status}): Please retry later`;
        }
        
        throw new Error(errorMessage);
      }

      let results: VectorDBResult;
      try {
        results = (await response.json()) as VectorDBResult;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`VectorDB returned invalid JSON response: ${errorMessage}`);
      }

      // Validate response structure
      if (!results || !Array.isArray(results.documents)) {
        throw new Error(`VectorDB returned invalid response format: expected documents array`);
      }

      // Transform the raw results into the RagDocument interface
      return results.documents as RagDocument[];
    } catch (error) {
      // Re-throw if already an Error with a good message, otherwise wrap it
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`VectorDB retrieval failed: ${String(error)}`);
    }
  }
}

interface VectorDBResult {
  documents: any[];
}
