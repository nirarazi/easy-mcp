import { Injectable } from "@nestjs/common";
import { GeminiClientService } from "../gemini/gemini-client.service";
import { ILlmClient } from "../llm-client.interface"; // Assumed interface for concrete clients
import { ConversationTurn } from "../../memory/memory.interface";
import { McpOutput } from "../../interface/mcp.interface";
import { ToolRegistrationInput } from "../../config/mcp-config.interface"; // Type for tools input

@Injectable()
export class LlmProviderService {
  // This property holds the concrete client that implements the ILlmClient contract
  private client: ILlmClient;

  constructor(
    // Inject the concrete client implementation
    private readonly geminiClient: GeminiClientService,
  ) {
    // Assign the concrete client to the abstracted interface
    this.client = this.geminiClient;
    console.log(
      "[Layer 3/4] LlmProviderService initialized with GeminiClientService.",
    );
  }

  /**
   * FIX: Implements the missing `generateContent` method.
   * This method fulfills the contract expected by the McpServerService.
   * It delegates the request to the currently selected concrete LLM client.
   */
  public async generateContent(
    contents: ConversationTurn[],
    tools: ToolRegistrationInput[],
    systemInstruction: string,
  ): Promise<McpOutput> {
    // The core job of LlmProviderService is to call the underlying vendor client's method
    return this.client.generateContent(contents, tools, systemInstruction);
  }
}
