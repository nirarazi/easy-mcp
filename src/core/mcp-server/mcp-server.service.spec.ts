import { Test, TestingModule } from "@nestjs/testing";
import { McpServerService } from "./mcp-server.service";
// Import all external dependencies and tokens
import { LlmProviderService } from "../../providers/llm-provider/llm-provider.service";
import { ToolRegistryService } from "../../tooling/tool-registry/tool-registry.service";
import {
  INTERFACE_LAYER_TOKEN,
  MEMORY_SERVICE_TOKEN,
  SYSTEM_INSTRUCTION_TOKEN,
} from "../../config/constants";
import { WebSocketGatewayService } from "../../interface/websocket-gateway.service";
import { IMemoryService } from "../../memory/memory.interface";
import { McpMessageInput } from "../../interface/mcp.interface";
import { ConversationTurn } from "../../memory/memory.interface";
import { McpOutput } from "../../interface/mcp.interface";

describe("McpServerService", () => {
  let service: McpServerService;
  let llmProvider: jest.Mocked<LlmProviderService>;
  let toolRegistry: jest.Mocked<ToolRegistryService>;
  let memoryService: jest.Mocked<IMemoryService>;
  let webSocketGateway: jest.Mocked<WebSocketGatewayService>;

  beforeEach(async () => {
    // Create mocks with proper methods
    const mockLlmProvider = {
      generateContent: jest.fn(),
    };

    const mockToolRegistry = {
      getToolsAsRegistrationInput: jest.fn().mockReturnValue([]),
      executeTool: jest.fn(),
    };

    const mockMemoryService = {
      getConversationHistory: jest.fn().mockResolvedValue([]),
      getLongTermContext: jest.fn().mockResolvedValue([]),
      addTurn: jest.fn().mockResolvedValue(undefined),
    };

    const mockInterfaceLayer = {
      start: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };

    const mockWebSocketGateway = {
      setMcpServerService: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpServerService,
        { provide: LlmProviderService, useValue: mockLlmProvider },
        { provide: ToolRegistryService, useValue: mockToolRegistry },
        {
          provide: WebSocketGatewayService,
          useValue: mockWebSocketGateway,
        },
        { provide: MEMORY_SERVICE_TOKEN, useValue: mockMemoryService },
        { provide: SYSTEM_INSTRUCTION_TOKEN, useValue: "mock instruction" },
        { provide: INTERFACE_LAYER_TOKEN, useValue: mockInterfaceLayer },
      ],
    }).compile();

    service = module.get<McpServerService>(McpServerService);
    llmProvider = module.get(LlmProviderService);
    toolRegistry = module.get(ToolRegistryService);
    memoryService = module.get(MEMORY_SERVICE_TOKEN);
    webSocketGateway = module.get(WebSocketGatewayService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("handleMessage", () => {
    const mockInput: McpMessageInput = {
      sessionId: "test-session",
      text: "Hello, world!",
    };

    it("should handle a regular message without tool calls", async () => {
      const mockResponse: McpOutput = {
        response: "Hello! How can I help you?",
        modelUsed: "gemini-1.5-flash",
        tokenUsage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
      };

      llmProvider.generateContent.mockResolvedValue(mockResponse);

      const result = await service.handleMessage(mockInput);

      expect(result.sessionId).toBe("test-session");
      expect(result.response).toBe("Hello! How can I help you?");
      expect(result.action).toBeUndefined();
      expect(memoryService.addTurn).toHaveBeenCalledWith(
        "test-session",
        "Hello, world!",
        "Hello! How can I help you?",
      );
    });

    it("should execute tool when LLM calls it", async () => {
      const toolCallResponse: McpOutput = {
        response: "",
        modelUsed: "gemini-1.5-flash",
        tokenUsage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
        toolCall: {
          functionName: "testTool",
          arguments: { param: "value" },
        },
      };

      const followUpResponse: McpOutput = {
        response: "Tool executed successfully!",
        modelUsed: "gemini-1.5-flash",
        tokenUsage: {
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
        },
      };

      llmProvider.generateContent
        .mockResolvedValueOnce(toolCallResponse)
        .mockResolvedValueOnce(followUpResponse);

      toolRegistry.executeTool.mockResolvedValue("tool result");

      const result = await service.handleMessage(mockInput);

      expect(toolRegistry.executeTool).toHaveBeenCalledWith("testTool", {
        param: "value",
      });
      expect(result.response).toBe("Tool executed successfully!");
      expect(llmProvider.generateContent).toHaveBeenCalledTimes(2);
    });

    it("should handle tool execution errors gracefully", async () => {
      const toolCallResponse: McpOutput = {
        response: "",
        modelUsed: "gemini-1.5-flash",
        tokenUsage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
        toolCall: {
          functionName: "testTool",
          arguments: { param: "value" },
        },
      };

      llmProvider.generateContent.mockResolvedValue(toolCallResponse);
      toolRegistry.executeTool.mockRejectedValue(new Error("Tool execution failed"));

      const result = await service.handleMessage(mockInput);

      expect(result.response).toContain("Error executing tool");
      expect(result.action).toBeUndefined();
    });

    it("should handle multi-turn tool execution with toolResult", async () => {
      const inputWithToolResult: McpMessageInput = {
        sessionId: "test-session",
        text: "",
        toolResult: {
          name: "testTool",
          result: "tool execution result",
        },
      };

      const followUpResponse: McpOutput = {
        response: "Based on the tool result, here's the answer.",
        modelUsed: "gemini-1.5-flash",
        tokenUsage: {
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
        },
      };

      llmProvider.generateContent.mockResolvedValue(followUpResponse);

      const result = await service.handleMessage(inputWithToolResult);

      expect(result.response).toBe("Based on the tool result, here's the answer.");
      expect(llmProvider.generateContent).toHaveBeenCalledTimes(1);
      // Verify tool result was added to conversation
      const callArgs = llmProvider.generateContent.mock.calls[0][0];
      expect(callArgs.some((turn) => turn.role === "tool")).toBe(true);
    });
  });
});
