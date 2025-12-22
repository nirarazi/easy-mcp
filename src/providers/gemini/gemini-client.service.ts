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
import { LlmApiError } from "../../core/errors/easy-mcp-error";

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

    let response: GenerateContentResponse;
    try {
      response = await this.aiClient.models.generateContent(request);
    } catch (error) {
      // Handle various types of API errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check for HTTP status codes in error
      let statusCode: number | undefined;
      if (error && typeof error === 'object' && 'status' in error) {
        statusCode = error.status as number;
      } else if (error && typeof error === 'object' && 'statusCode' in error) {
        statusCode = error.statusCode as number;
      }

      // Provide user-friendly error messages based on status code
      let message = `Gemini API call failed: ${errorMessage}`;
      if (statusCode === 401) {
        message = 'Gemini API authentication failed. Check your API key.';
      } else if (statusCode === 403) {
        message = 'Gemini API access forbidden. Check your API key permissions.';
      } else if (statusCode === 429) {
        message = 'Gemini API rate limit exceeded. Please retry after some time.';
      } else if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
        message = 'Gemini API server error. Please retry later.';
      } else if (statusCode) {
        message = `Gemini API error (${statusCode}): ${errorMessage}`;
      }

      throw new LlmApiError(
        message,
        'gemini',
        statusCode,
        error instanceof Error ? error : new Error(errorMessage),
      );
    }

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
