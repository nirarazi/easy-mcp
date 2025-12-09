import { ConversationTurn } from "../session/memory.interface";
import { McpOutput } from "../interface/mcp.interface";
import { ToolRegistrationInput } from "../config/mcp-config.interface";

/**
 * Contract for any concrete LLM vendor client (Gemini, OpenAI, etc.).
 * This decouples the LlmProviderService (Abstraction) from the vendor SDK.
 */
export interface ILlmClient {
  /**
   * Executes the final vendor-specific API call.
   */
  generateContent(
    contents: ConversationTurn[],
    tools: ToolRegistrationInput[],
    systemInstruction: string,
  ): Promise<McpOutput>;
}
