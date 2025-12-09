/**
 * The unified JSON input structure received by the MCPF (Layer 1).
 */
export interface McpInput {
  /** A unique identifier for the user session (required for Layer 2). */
  sessionId: string;

  /** The new message from the user. */
  query: string;

  /** Optional: The specific model/persona requested for this turn. */
  modelName?: string;

  /** Optional: Any application-specific metadata or flags. */
  metadata?: Record<string, any>;
}

/**
 * The unified JSON response structure sent back by the MCPF (Layer 1).
 */
export interface McpOutput {
  /** The final generated text response from the LLM. */
  response: string;

  /** The model that was used to generate the response. */
  modelUsed: string;

  /** Metrics on token usage for cost management. */
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    // Layer 2/3 may add: summaryTokens, ragTokens, etc.
  };

  /** Optional: Information about a tool that was called (if any). */
  toolCall?: {
    functionName: string;
    arguments: Record<string, any>;
    // The response could trigger a tool call that requires an external action.
  };
}

/**
 * Interface for messages received by the Easy MCP Framework (Layer 1).
 * This represents the standardized input from the client (e.g., via WebSocket).
 */
export interface McpMessageInput {
  /**
   * A unique identifier for the conversation session (required for history and LTM lookup).
   */
  sessionId: string;

  /**
   * The raw text message from the user.
   */
  text: string;

  /**
   * Optional metadata passed from the client, such as user IDs, app state, etc.
   */
  metadata?: Record<string, any>;

  /**
   * Optional payload for a *tool result* being sent back to the framework
   * in a multi-turn tool execution flow.
   */
  toolResult?: {
    name: string;
    result: Record<string, any> | string;
  };
}

// ----------------------------------------------------------------------

/**
 * Interface for the message sent by the Easy MCP Framework back to the client.
 * This represents the standardized output after processing by Layer 3/4.
 */
export interface McpMessageOutput {
  /**
   * The session ID this response belongs to.
   */
  sessionId: string;

  /**
   * The model's natural language response or a status message.
   */
  response: string;

  /**
   * If the model decided to call a tool, this field contains the details.
   * The client (Layer 1) is responsible for executing this action.
   */
  action?: {
    name: string;
    /**
     * The arguments provided by the LLM for the function call.
     */
    args: Record<string, any>;
  };

  /**
   * Metadata related to token usage, safety, etc. (Optional, for debugging/metrics)
   */
  metadata?: {
    modelUsed: string;
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
}
