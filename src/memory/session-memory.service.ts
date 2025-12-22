import { Injectable, Optional, Inject } from "@nestjs/common";
import { IMemoryService, ConversationTurn } from "./memory.interface";
import { type McpConfig } from "../config/mcp-config.interface"; // Needed for configuration
import { VectorDBService } from "./vectordb/vectordb.service";

/**
 * FIX: A minimal, in-memory implementation of IMemoryService for framework development.
 * This should be replaced by FirestoreMemoryService or a database/Redis implementation later.
 */
@Injectable()
export class SessionMemoryService implements IMemoryService {
  // In-memory store for development (key: sessionId, value: ConversationTurn[])
  private historyStore: Map<string, ConversationTurn[]> = new Map();

  constructor(
    private readonly config: McpConfig,
    @Optional() @Inject(VectorDBService) private readonly vectorDBService?: VectorDBService,
  ) {
    console.log(
      "[Layer 2: Session & Memory] SessionMemoryService initialized.",
    );
  }

  async getConversationHistory(sessionId: string): Promise<ConversationTurn[]> {
    await Promise.resolve();
    // Return existing history or an empty array
    return this.historyStore.get(sessionId) || [];
  }

  async getLongTermContext(
    sessionId: string,
    query: string,
  ): Promise<string[]> {
    await Promise.resolve({ sessionId, query });
    
    // If VectorDBService is available, use it for RAG retrieval
    if (this.vectorDBService && query && query.trim().length > 0) {
      try {
        const retrievalK = this.config.ltmConfig?.retrievalK || 3;
        const ragDocuments = await this.vectorDBService.retrieveRelevantFacts(query, retrievalK);
        
        // Convert RagDocument[] to string[] format expected by the interface
        return ragDocuments.map(doc => {
          // Format: "text (source: source, score: score)"
          return `${doc.text} (source: ${doc.source}, score: ${doc.score.toFixed(3)})`;
        });
      } catch (error) {
        console.error("[SessionMemoryService] VectorDB retrieval failed:", error);
        // Fall back to empty array if VectorDB fails
        return [];
      }
    }
    
    // Return empty array if VectorDB is not available or query is empty
    return [];
  }

  async addTurn(
    sessionId: string,
    userMessage: string,
    modelResponse: string,
  ): Promise<void> {
    const history = this.historyStore.get(sessionId) || [];

    history.push({ role: "user", content: userMessage, timestamp: new Date() });
    history.push({
      role: "model",
      content: modelResponse,
      timestamp: new Date(),
    });

    this.historyStore.set(sessionId, history);
    // In a real implementation, this would trigger database writes and LTM updates.

    await Promise.resolve();
  }
}
