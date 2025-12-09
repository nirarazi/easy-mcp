// src/session/memory.interface.ts

/**
 * Represents a single turn (user/model exchange) in the conversation history.
 */
export interface ConversationTurn {
  role: "user" | "model" | "system" | "tool";
  content: string;
  timestamp: Date;

  /** Optional: Used for the 'tool' role to store the tool's output. */
  toolResult?: string;
}

/**
 * Represents the complete state of a single active session (STM).
 */
export interface SessionState {
  sessionId: string;

  /** The sequential list of turns (the History Buffer). */
  history: ConversationTurn[];

  /** The compressed summary block created by the summarization process. */
  summaryBlock: string;

  /** The current system instruction/persona being used. */
  systemInstruction: string;

  /** Any extracted facts or user preferences (e.g., from LTM lookup). */
  relevantFacts: string[];
}
