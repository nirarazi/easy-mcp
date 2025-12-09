// The standard representation of a turn in the conversation history
export interface ConversationTurn {
  role: "user" | "model";
  content: string;
  timestamp: Date;
}

// Contract for the core memory management service (Layer 2)
export interface IMemoryService {
  /**
   * Retrieves the short-term conversation history for a session.
   */
  getConversationHistory(sessionId: string): Promise<ConversationTurn[]>;

  /**
   * Retrieves relevant long-term context (RAG) based on the user's query.
   */
  getLongTermContext(sessionId: string, query: string): Promise<string[]>;

  /**
   * Adds the completed user and model turn to the history/session state.
   */
  addTurn(
    sessionId: string,
    userMessage: string,
    modelResponse: string,
  ): Promise<void>;
}
