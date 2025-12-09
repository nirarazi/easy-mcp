import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { LlmProviderService } from "../../providers/llm-provider/llm-provider.service";
import { ToolRegistryService } from "../../tooling/tool-registry/tool-registry.service";
import { SYSTEM_INSTRUCTION_TOKEN } from "../../config/constants";
import {
  MEMORY_SERVICE_TOKEN,
  type IMemoryService,
} from "../../memory/memory.interface";
import {
  INTERFACE_LAYER_TOKEN,
  type IInterfaceLayer,
} from "../../interface/interface.interface";
import { WebSocketGatewayService } from "../../interface/websocket-gateway.service";
// Assuming the relative path is correct from this file's location
import {
  McpMessageInput,
  McpMessageOutput,
} from "../../interface/mcp.interface";
import { ConversationTurn } from "../../memory/memory.interface";
// Need to import this type to correctly cast the tools array
import { ToolRegistrationInput } from "../../config/mcp-config.interface";

@Injectable()
export class McpServerService implements OnModuleInit {
  constructor(
    // Layer 4
    private readonly llmProvider: LlmProviderService, // Layer 3
    private readonly toolRegistry: ToolRegistryService, // Layer 2
    @Inject(MEMORY_SERVICE_TOKEN)
    private readonly memoryService: IMemoryService, // Config
    @Inject(SYSTEM_INSTRUCTION_TOKEN)
    private readonly systemInstruction: string, // Layer 1 Interface (Used to call start())
    @Inject(INTERFACE_LAYER_TOKEN)
    private readonly interfaceLayer: IInterfaceLayer, // Layer 1 Concrete (Used to set the dependency on itself)
    private readonly webSocketGatewayService: WebSocketGatewayService,
  ) {} // FIX: Resolves the dependency cycle by waiting for all services to be instantiated.

  onModuleInit() {
    this.webSocketGatewayService.setMcpServerService(this);
    console.log("[Layer 3] Circular dependency resolved.");
  } /**
   * Implements the startListening() method by delegating network startup to Layer 1.
   */

  public async startListening(): Promise<void> {
    console.log(
      `[Layer 3: Abstraction Core] Initiating Layer 1 Interface startup...`,
    ); // Delegate the actual startup of the network listener to the Layer 1 component

    await this.interfaceLayer.start();

    console.log(
      `[Layer 3] McpServerService is operational and awaiting Layer 1 input.`,
    );
  } /**
   * The core Model Context Protocol (MCP) logic (handleMessage).
   */

  public async handleMessage(
    input: McpMessageInput,
  ): Promise<McpMessageOutput> {
    const { sessionId, text: userMessage } = input; // --- 1. Retrieve Context (Layer 2) ---

    const history = await this.memoryService.getConversationHistory(sessionId);
    const ltmContext = await this.memoryService.getLongTermContext(
      sessionId,
      userMessage,
    ); // --- 2. Assemble Prompt & Tools ---

    const promptWithContext =
      ltmContext.length > 0
        ? `CONTEXT:\n${ltmContext.join("\n")}\n\nUSER QUESTION: ${userMessage}`
        : userMessage;

    const contents: ConversationTurn[] = [
      ...history,
      { role: "user", content: promptWithContext, timestamp: new Date() },
    ]; // FIX 1: Change method name to the existing one in ToolRegistryService

    const availableTools = this.toolRegistry.getToolSchemasForLLM(); // --- 3. Call LLM (Layer 4) ---

    // FIX 2: Explicitly cast the schema array to the expected input type for generateContent
    // This resolves the TS2339 error for `generateContent`.
    const llmResponse = await this.llmProvider.generateContent(
      contents,
      availableTools as ToolRegistrationInput[], // Casting required due to method mismatch
      this.systemInstruction,
    ); // --- 4. Handle LLM Output (Text or Function Call) ---

    let responseText = llmResponse.response;
    let action: McpMessageOutput["action"] = undefined;

    if (llmResponse.toolCall) {
      console.log(
        `[Layer 3] LLM suggested tool call: ${llmResponse.toolCall.functionName}`,
      );

      action = {
        name: llmResponse.toolCall.functionName,
        args: llmResponse.toolCall.arguments,
      };
      responseText = `Action suggested: ${action.name}. Waiting for tool result...`;
    } // --- 5. Update Memory & Return ---

    await this.memoryService.addTurn(sessionId, userMessage, responseText);

    return {
      sessionId,
      response: responseText,
      action,
      // Include optional metadata from LLM output
      metadata: {
        modelUsed: llmResponse.modelUsed,
        tokenUsage: llmResponse.tokenUsage,
      },
    };
  }
}
