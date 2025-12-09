import { Injectable } from "@nestjs/common";
import { IMemoryService, ConversationTurn } from "./memory.interface";
import { type McpConfig } from "../config/mcp-config.interface"; // Needed for configuration

/**
 * FIX: A minimal, in-memory implementation of IMemoryService for framework development.
 * This should be replaced by FirestoreMemoryService or a database/Redis implementation later.
 */
@Injectable()
export class SessionMemoryService implements IMemoryService {
  // In-memory store for development (key: sessionId, value: ConversationTurn[])
  private historyStore: Map<string, ConversationTurn[]> = new Map();

  constructor(private readonly config: McpConfig) {
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
    // Since we haven't implemented VectorDB, this is a placeholder for RAG context
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
