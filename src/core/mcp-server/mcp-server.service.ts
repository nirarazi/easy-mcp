import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { LlmProviderService } from "../../providers/llm-provider/llm-provider.service";
import { ToolRegistryService } from "../../tooling/tool-registry/tool-registry.service";
import {
  INTERFACE_LAYER_TOKEN,
  MEMORY_SERVICE_TOKEN,
  SYSTEM_INSTRUCTION_TOKEN,
} from "../../config/constants";
import { type IMemoryService } from "../../memory/memory.interface";
import { type IInterfaceLayer } from "../../interface/interface.interface";
import { WebSocketGatewayService } from "../../interface/websocket-gateway.service";
// Assuming the relative path is correct from this file's location
import {
  McpMessageInput,
  McpMessageOutput,
} from "../../interface/mcp.interface";
import { ConversationTurn } from "../../memory/memory.interface";
import { sanitizeToolArgs, sanitizeErrorMessage, sanitizeToolResult } from "../utils/sanitize.util";

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
  }   /**
   * The core Model Context Protocol (MCP) logic (handleMessage).
   * Handles both regular messages and multi-turn tool execution.
   */
  public async handleMessage(
    input: McpMessageInput,
  ): Promise<McpMessageOutput> {
    const { sessionId, text: userMessage, toolResult } = input;

    // --- 1. Retrieve Context (Layer 2) ---
    const history = await this.memoryService.getConversationHistory(sessionId);
    const ltmContext = await this.memoryService.getLongTermContext(
      sessionId,
      userMessage || "",
    );

    // --- 2. Handle Multi-Turn Tool Execution ---
    // If toolResult is provided, this is a continuation after tool execution
    if (toolResult) {
      // Add tool result to conversation history
      // Sanitize the result to prevent sensitive data exposure
      const toolResultContent = sanitizeToolResult(toolResult.result);
      
      const toolResultTurn: ConversationTurn = {
        role: "tool",
        content: toolResultContent,
        timestamp: new Date(),
        toolResult: toolResultContent,
      };

      const contentsWithToolResult: ConversationTurn[] = [
        ...history,
        toolResultTurn,
      ];

      // Make follow-up LLM call with tool result
      const availableTools = this.toolRegistry.getToolsAsRegistrationInput();
      const llmResponse = await this.llmProvider.generateContent(
        contentsWithToolResult,
        availableTools,
        this.systemInstruction,
      );

      // Update memory with the final response
      const finalResponse = llmResponse.response || "Tool execution completed.";
      await this.memoryService.addTurn(
        sessionId,
        `Tool result for ${toolResult.name}`,
        finalResponse,
      );

      return {
        sessionId,
        response: finalResponse,
        metadata: {
          modelUsed: llmResponse.modelUsed,
          tokenUsage: llmResponse.tokenUsage,
        },
      };
    }

    // --- 3. Regular Message Flow ---
    // Assemble prompt with context
    const promptWithContext =
      ltmContext.length > 0
        ? `CONTEXT:\n${ltmContext.join("\n")}\n\nUSER QUESTION: ${userMessage}`
        : userMessage;

    const contents: ConversationTurn[] = [
      ...history,
      { role: "user", content: promptWithContext, timestamp: new Date() },
    ];

    // --- 4. Call LLM (Layer 4) ---
    const availableTools = this.toolRegistry.getToolsAsRegistrationInput();
    const llmResponse = await this.llmProvider.generateContent(
      contents,
      availableTools,
      this.systemInstruction,
    );

    // --- 5. Handle LLM Output (Text or Function Call) ---
    let responseText = llmResponse.response;
    const action: McpMessageOutput["action"] = undefined;

    if (llmResponse.toolCall) {
      // Sanitize tool arguments for logging
      const sanitizedArgs = sanitizeToolArgs(llmResponse.toolCall.arguments);
      const sanitizedArgsString = (() => {
        try {
          return JSON.stringify(sanitizedArgs);
        } catch {
          return '[tool args could not be serialized]';
        }
      })();
      console.log(
        `[Layer 3] LLM suggested tool call: ${llmResponse.toolCall.functionName}`,
      );

      try {
        // Execute the tool
        const toolResult = await this.toolRegistry.executeTool(
          llmResponse.toolCall.functionName,
          llmResponse.toolCall.arguments,
        );

        // Convert tool result to string for conversation history
        // Sanitize the result to prevent sensitive data exposure
        const toolResultString = sanitizeToolResult(toolResult);

        // Add tool call and result to conversation history
        // Use sanitized args in the content to prevent sensitive data exposure
        const toolCallTurn: ConversationTurn = {
          role: "tool",
          content: `Tool ${llmResponse.toolCall.functionName} called with args: ${sanitizedArgsString}`,
          timestamp: new Date(),
          toolResult: toolResultString,
        };

        const toolResultTurn: ConversationTurn = {
          role: "tool",
          content: toolResultString,
          timestamp: new Date(),
          toolResult: toolResultString,
        };

        // Make follow-up LLM call with tool result
        const contentsWithToolResult: ConversationTurn[] = [
          ...contents,
          toolCallTurn,
          toolResultTurn,
        ];

        const followUpResponse = await this.llmProvider.generateContent(
          contentsWithToolResult,
          availableTools,
          this.systemInstruction,
        );

        responseText = followUpResponse.response || `Tool '${llmResponse.toolCall.functionName}' executed successfully.`;
        
        // Update memory with both user message and final response
        await this.memoryService.addTurn(sessionId, userMessage, responseText);

        return {
          sessionId,
          response: responseText,
          metadata: {
            modelUsed: followUpResponse.modelUsed,
            tokenUsage: {
              promptTokens: (llmResponse.tokenUsage.promptTokens || 0) + (followUpResponse.tokenUsage.promptTokens || 0),
              completionTokens: (llmResponse.tokenUsage.completionTokens || 0) + (followUpResponse.tokenUsage.completionTokens || 0),
              totalTokens: (llmResponse.tokenUsage.totalTokens || 0) + (followUpResponse.tokenUsage.totalTokens || 0),
            },
          },
        };
      } catch (error) {
        // Tool execution failed - sanitize error message to prevent sensitive data leakage
        const sanitizedErrorMessage = sanitizeErrorMessage(error);
        responseText = `Error executing tool '${llmResponse.toolCall.functionName}': ${sanitizedErrorMessage}`;
        
        // Still update memory with the error (sanitized)
        await this.memoryService.addTurn(sessionId, userMessage, responseText);

        // Don't return action details for failed tool execution
        return {
          sessionId,
          response: responseText,
          action: undefined,
          metadata: {
            modelUsed: llmResponse.modelUsed,
            tokenUsage: llmResponse.tokenUsage,
          },
        };
      }
    }

    // --- 6. Update Memory & Return (No tool call) ---
    await this.memoryService.addTurn(sessionId, userMessage, responseText);

    return {
      sessionId,
      response: responseText,
      action,
      metadata: {
        modelUsed: llmResponse.modelUsed,
        tokenUsage: llmResponse.tokenUsage,
      },
    };
  }
}
