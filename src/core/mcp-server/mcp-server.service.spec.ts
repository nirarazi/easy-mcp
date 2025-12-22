import { Test, TestingModule } from "@nestjs/testing";
import { McpServerService } from "./mcp-server.service";
import { ToolRegistryService } from "../../tooling/tool-registry/tool-registry.service";
import { INTERFACE_LAYER_TOKEN, CONFIG_TOKEN } from "../../config/constants";
import { StdioGatewayService } from "../../interface/stdio-gateway.service";
import { IInterfaceLayer } from "../../interface/interface.interface";
import {
  JsonRpcRequest,
  JsonRpcErrorCode,
} from "../../interface/jsonrpc.interface";
import { ConfigHolderService } from "../../config/config-holder.service";
import { McpConfig } from "../../config/mcp-config.interface";

describe("McpServerService", () => {
  let service: McpServerService;
  let toolRegistry: jest.Mocked<ToolRegistryService>;
  let interfaceLayer: jest.Mocked<IInterfaceLayer>;
  let stdioGateway: jest.Mocked<StdioGatewayService>;
  let configHolder: jest.Mocked<ConfigHolderService>;

  const mockConfig: McpConfig = {
    tools: [
      {
        name: "testTool",
        description: "A test tool",
        function: async () => "result",
        inputSchema: {
          type: "OBJECT",
          properties: {
            param: {
              type: "STRING",
              description: "A parameter",
            },
          },
          required: ["param"],
        },
      },
    ],
  };

  beforeEach(async () => {
    const mockTool = {
      name: "testTool",
      description: "A test tool",
      execute: jest.fn(),
      parameters: {
        param: {
          type: "string" as const,
          description: "A parameter",
        },
      },
      required: ["param"],
    };

    const mockToolRegistry = {
      getToolSchemasForLLM: jest.fn().mockReturnValue([
        {
          type: "function",
          function: {
            name: "testTool",
            description: "A test tool",
            parameters: {
              type: "object",
              properties: {
                param: {
                  type: "string",
                  description: "A parameter",
                },
              },
              required: ["param"],
            },
          },
        },
      ]),
      getTool: jest.fn().mockReturnValue(mockTool),
      executeTool: jest.fn(),
    };

    const mockInterfaceLayer = {
      start: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };

    const mockStdioGateway = {
      setMcpServerService: jest.fn(),
    };

    const mockConfigHolder = {
      getConfig: jest.fn().mockReturnValue(mockConfig),
      setConfig: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpServerService,
        { provide: ToolRegistryService, useValue: mockToolRegistry },
        {
          provide: StdioGatewayService,
          useValue: mockStdioGateway,
        },
        { provide: INTERFACE_LAYER_TOKEN, useValue: mockInterfaceLayer },
        { provide: CONFIG_TOKEN, useValue: mockConfigHolder },
      ],
    }).compile();

    service = module.get<McpServerService>(McpServerService);
    toolRegistry = module.get(ToolRegistryService);
    interfaceLayer = module.get(INTERFACE_LAYER_TOKEN);
    stdioGateway = module.get(StdioGatewayService);
    configHolder = module.get(CONFIG_TOKEN);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("handleRequest", () => {
    it("should handle initialize request", async () => {
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
        },
      };

      const response = await service.handleRequest(request);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(response.result.protocolVersion).toBe("2024-11-05");
      expect(response.result.capabilities).toBeDefined();
      expect(response.result.serverInfo).toBeDefined();
    });

    it("should handle tools/list request", async () => {
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      };

      const response = await service.handleRequest(request);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(2);
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
      expect(toolRegistry.getToolSchemasForLLM).toHaveBeenCalled();
    });

    it("should handle tools/call request", async () => {
      toolRegistry.executeTool.mockResolvedValue("tool result");

      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "testTool",
          arguments: { param: "value" },
        },
      };

      const response = await service.handleRequest(request);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(3);
      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      expect(toolRegistry.executeTool).toHaveBeenCalledWith("testTool", {
        param: "value",
      });
    });

    it("should handle unknown method", async () => {
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 4,
        method: "unknown/method",
      };

      const response = await service.handleRequest(request);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(4);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(JsonRpcErrorCode.MethodNotFound);
    });

    it("should handle tool execution errors", async () => {
      const { ToolExecutionError } = require("../errors/easy-mcp-error");
      toolRegistry.executeTool.mockRejectedValue(
        new ToolExecutionError("Tool failed", "testTool"),
      );

      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "testTool",
          arguments: { param: "value" }, // Provide required parameter
        },
      };

      const response = await service.handleRequest(request);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(5);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32002); // McpErrorCode.ToolExecutionError
    });

    it("should handle tool not found errors", async () => {
      const { ToolNotFoundError } = require("../errors/easy-mcp-error");
      toolRegistry.getTool.mockReturnValue(undefined); // Tool not found

      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "testTool",
          arguments: {},
        },
      };

      const response = await service.handleRequest(request);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(6);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32001); // McpErrorCode.ToolNotFound
    });
  });
});
