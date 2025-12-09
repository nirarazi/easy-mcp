import { Injectable, Inject } from "@nestjs/common";
import {
  GoogleGenAI,
  GenerateContentParameters,
  Content,
  Part,
  FunctionDeclaration,
  Tool,
  GenerateContentResponse,
  Type,
} from "@google/genai";

import { ILlmClient } from "../llm-client.interface";
import {
  type LlmProviderConfig,
  ToolRegistrationInput,
} from "../../config/mcp-config.interface";
import { McpOutput } from "../../interface/mcp.interface";
import { ConversationTurn } from "../../session/memory.interface";
import { LLM_PROVIDER_CONFIG_TOKEN } from "../../../src/config/constants";

@Injectable()
export class GeminiClientService implements ILlmClient {
  private aiClient: GoogleGenAI;
  private modelName: string;

  constructor(@Inject(LLM_PROVIDER_CONFIG_TOKEN) config: LlmProviderConfig) {
    this.modelName = config.model;
    this.aiClient = new GoogleGenAI({ apiKey: config.apiKey });
  }

  public async generateContent(
    contents: ConversationTurn[],
    tools: ToolRegistrationInput[],
    systemInstruction: string,
  ): Promise<McpOutput> {
    const geminiContents: Content[] = this.translateHistory(contents);
    const geminiTools: FunctionDeclaration[] = this.translateTools(tools);

    // FIX 4: Change type declaration to include 'undefined'
    const toolsConfig: Tool[] | undefined =
      geminiTools.length > 0
        ? [{ functionDeclarations: geminiTools }]
        : undefined;

    const request: GenerateContentParameters = {
      model: this.modelName,
      contents: geminiContents,
      config: {
        systemInstruction: systemInstruction,
        tools: toolsConfig,
        temperature: 0.7,
      },
    };

    const response: GenerateContentResponse =
      await this.aiClient.models.generateContent(request);

    const usageMetadata = response.usageMetadata ?? {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
    };
    const candidate = response.candidates?.[0];

    const content: Content | undefined = candidate?.content;

    let toolCall: McpOutput["toolCall"] = undefined;
    let responseText = response.text || "";

    // FIX 5: Use nullish coalescing to safely call .find() on content.parts
    const functionCallPart = (content?.parts || []).find(
      (part: Part) => part.functionCall,
    );

    if (functionCallPart?.functionCall) {
      const fc = functionCallPart.functionCall;
      toolCall = {
        functionName: fc.name as string,
        arguments: fc.args as Record<string, any>,
      };
      responseText = "";
    }

    const mcpOutput: McpOutput = {
      response: responseText,
      modelUsed: this.modelName,
      tokenUsage: {
        promptTokens: usageMetadata.promptTokenCount as number,
        completionTokens: usageMetadata.candidatesTokenCount as number,
        totalTokens: usageMetadata.totalTokenCount as number,
      },
      toolCall: toolCall,
    };

    return mcpOutput;
  }

  /** Maps Easy MCP turns to the SDK's Content[] format. */
  private translateHistory(contents: ConversationTurn[]): Content[] {
    return contents.map((turn) => ({
      role: turn.role === "model" ? "model" : "user",
      parts: [{ text: turn.content } as Part],
    }));
  }

  /** Maps Easy MCP tool registration to the SDK's FunctionDeclaration[] format. */
  private translateTools(
    tools: ToolRegistrationInput[],
  ): FunctionDeclaration[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: Type.OBJECT,
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required,
      },
    }));
  }
}
