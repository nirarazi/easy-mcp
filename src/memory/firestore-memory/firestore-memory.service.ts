// src/memory/firestore-memory/firestore-memory.service.ts

import { Injectable } from "@nestjs/common";
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
import { PersistenceConfig } from "../../config/mcp-config.interface";
import { SessionState } from "../../session/memory.interface";

/**
 * Service to manage Short-Term Memory (STM) using Firestore.
 * Handles persistence and retrieval of the SessionState (History Buffer).
 */
@Injectable()
export class FirestoreMemoryService {
  private firestore: Firestore;
  private app: FirebaseApp;
  private sessionsCollection: string = "mcp-sessions"; // Hardcoded collection name

  // NOTE: In a full NestJS implementation, the config would be injected here,
  // typically via a custom provider in memory.module.ts.
  constructor(/* @Inject('PERSISTENCE_CONFIG') config: PersistenceConfig */) {
    // We'll mock the config injection for simplicity here:
    const config: PersistenceConfig = {
      type: "FIRESTORE",
      config: {}, // Assuming external code provides the actual config object
      appId: "default-mcp-app",
      authToken: null,
    };

    // 1. Initialize the App using the function import
    if (getApps().length === 0) {
      // If no apps are initialized, initialize a new one
      this.app = initializeApp(config.config as FirebaseOptions);
    } else {
      // If an app is already initialized (e.g., by another module), reuse the default one
      this.app = getApp();
    }

    // 2. Retrieve the Firestore service instance using getFirestore(app)
    this.firestore = getFirestore(this.app);
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
}
