// src/memory/firestore-memory/firestore-memory.service.ts

import { Injectable, Inject, Optional } from "@nestjs/common";
// 1. Import specific functions for initialization
import {
  initializeApp,
  FirebaseApp,
  getApps,
  getApp,
  FirebaseOptions,
} from "firebase/app";
// 2. Import specific functions/types for Firestore
import {
  getFirestore,
  Firestore,
  getDoc,
  doc,
  setDoc,
} from "firebase/firestore";
// NOTE: You only need to import the Firestore service here.
import type { McpConfig } from "../../config/mcp-config.interface";
import { SessionState } from "../../session/memory.interface";
import { IMemoryService, ConversationTurn } from "../memory.interface";
import { CONFIG_TOKEN } from "../../config/constants";
import { VectorDBService } from "../vectordb/vectordb.service";

/**
 * Service to manage Short-Term Memory (STM) using Firestore.
 * Handles persistence and retrieval of the SessionState (History Buffer).
 */
@Injectable()
export class FirestoreMemoryService implements IMemoryService {
  private firestore: Firestore;
  private app: FirebaseApp;
  private sessionsCollection: string = "mcp-sessions"; // Hardcoded collection name
  private config: McpConfig;

  constructor(
    @Inject(CONFIG_TOKEN) config: McpConfig,
    @Optional() @Inject(VectorDBService) private readonly vectorDBService?: VectorDBService,
  ) {
    this.config = config;
    const persistenceConfig = config.persistence;

    if (persistenceConfig.type !== "FIRESTORE") {
      throw new Error("FirestoreMemoryService requires persistence.type to be 'FIRESTORE'");
    }

    // 1. Initialize the App using the function import
    if (getApps().length === 0) {
      // If no apps are initialized, initialize a new one
      this.app = initializeApp(persistenceConfig.config as FirebaseOptions);
    } else {
      // If an app is already initialized (e.g., by another module), reuse the default one
      this.app = getApp();
    }

    // 2. Retrieve the Firestore service instance using getFirestore(app)
    this.firestore = getFirestore(this.app);
    console.log("[Layer 2: Session & Memory] FirestoreMemoryService initialized.");
  }

  /**
   * Retrieves the full SessionState for a given ID.
   * @param sessionId The unique ID for the session.
   * @returns The existing state, or a new empty state if not found.
   */
  public async getSessionState(sessionId: string): Promise<SessionState> {
    const docRef = doc(this.firestore, this.sessionsCollection, sessionId);
    const ds = await getDoc(docRef);

    if (ds.exists()) {
      // Return the existing state from Firestore.
      // NOTE: We must cast to ensure TypeScript matches the retrieved object.
      const data = ds.data() as SessionState;

      // Ensure the history array exists and timestamps are converted from Firestore Timestamps if necessary
      if (!data.history) data.history = [];

      return data;
    } else {
      // Return a clean, initialized state if the session is brand new.
      return {
        sessionId: sessionId,
        history: [],
        summaryBlock: "",
        systemInstruction: "",
        relevantFacts: [],
      } as SessionState;
    }
  }

  /**
   * Saves the updated SessionState (including the new turn) to Firestore.
   * This handles the persistence step after GenerateResponse is complete.
   */
  public async saveSessionState(state: SessionState): Promise<void> {
    const docRef = doc(
      this.firestore,
      this.sessionsCollection,
      state.sessionId,
    );

    // Use set with merge: true to update fields without deleting the entire document
    await setDoc(docRef, state as any, { merge: true });
  }

  /**
   * Implements IMemoryService.getConversationHistory
   */
  async getConversationHistory(sessionId: string): Promise<ConversationTurn[]> {
    const state = await this.getSessionState(sessionId);
    // Filter and map to ensure compatibility with the ConversationTurn interface.
    // Only process turns with supported roles to guard against invalid data from the database.
    return (state.history || [])
      .filter(turn => ["user", "model", "system", "tool"].includes(turn.role))
      .map(turn => {
        // Convert "system" role to "model" for compatibility with LLM providers
        const role = turn.role === "system" ? "model" : turn.role;
        return {
          role: role,
          content: turn.content,
          timestamp: turn.timestamp,
          toolResult: turn.toolResult,
        };
      });
  }

  /**
   * Implements IMemoryService.getLongTermContext
   */
  async getLongTermContext(sessionId: string, query: string): Promise<string[]> {
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
        console.error("[FirestoreMemoryService] VectorDB retrieval failed:", error);
        // Fall back to empty array if VectorDB fails
        return [];
      }
    }
    
    // Return empty array if VectorDB is not available or query is empty
    return [];
  }

  /**
   * Implements IMemoryService.addTurn
   */
  async addTurn(
    sessionId: string,
    userMessage: string,
    modelResponse: string,
  ): Promise<void> {
    const state = await this.getSessionState(sessionId);
    
    // Add user and model turns to history
    state.history.push({
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    });
    state.history.push({
      role: "model",
      content: modelResponse,
      timestamp: new Date(),
    });

    // Save updated state to Firestore
    await this.saveSessionState(state);
  }
}
