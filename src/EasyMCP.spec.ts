import { EasyMCP } from './EasyMCP';
import { McpConfig } from './config/mcp-config.interface';
import { ToolRegistryService } from './tooling/tool-registry/tool-registry.service';
import { ConfigHolderService } from './config/config-holder.service';
import { CONFIG_TOKEN } from './config/constants';

// Mock NestJS modules
jest.mock('./app.module', () => ({
  AppModule: class {},
}));

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    createApplicationContext: jest.fn(),
  },
}));

describe('EasyMCP', () => {
  const validConfig: McpConfig = {
    persistence: {
      type: 'FIRESTORE',
      appId: 'test-app',
      authToken: 'test-token',
      config: {},
    },
    llmProvider: {
      model: 'gemini-1.5-flash',
      apiKey: 'test-api-key',
      systemInstruction: 'You are a helpful assistant.',
    },
    ltmConfig: {
      vectorDB: {
        type: 'VECTOR_DB_SERVICE',
        endpoint: 'https://example.com',
        collectionName: 'test-collection',
      },
      retrievalK: 3,
    },
    tools: [
      {
        name: 'testTool',
        description: 'A test tool',
        function: async (args: Record<string, any>) => {
          return `Result: ${JSON.stringify(args)}`;
        },
        inputSchema: {
          type: 'OBJECT',
          properties: {
            param: {
              type: 'STRING',
              description: 'A parameter',
            },
          },
          required: ['param'],
        },
      },
    ],
  };

  beforeEach(() => {
    // Reset the static app property
    (EasyMCP as any).app = undefined;
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should validate configuration before initializing', async () => {
      const invalidConfig = { ...validConfig, llmProvider: { ...validConfig.llmProvider, apiKey: '' } };
      
      await expect(EasyMCP.initialize(invalidConfig as any)).rejects.toThrow();
    });

    it('should throw error if config validation fails', async () => {
      const invalidConfig = { ...validConfig, persistence: undefined as any };
      
      await expect(EasyMCP.initialize(invalidConfig)).rejects.toThrow();
    });

    it('should warn if already initialized', async () => {
      const { NestFactory } = require('@nestjs/core');
      const mockApp = {
        get: jest.fn().mockReturnValue({
          setConfig: jest.fn(),
          registerToolFromConfig: jest.fn(),
        }),
      };
      
      NestFactory.createApplicationContext = jest.fn().mockResolvedValue(mockApp);
      
      await EasyMCP.initialize(validConfig);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await EasyMCP.initialize(validConfig);
      
      expect(consoleSpy).toHaveBeenCalledWith('EasyMCP is already initialized.');
      consoleSpy.mockRestore();
    });
  });

  describe('tool auto-registration', () => {
    it('should automatically register tools from config', async () => {
      const { NestFactory } = require('@nestjs/core');
      const mockToolRegistry = {
        registerToolFromConfig: jest.fn(),
      };
      
      const mockConfigHolder = {
        setConfig: jest.fn(),
      };
      
      const mockApp = {
        get: jest.fn((token) => {
          if (token === CONFIG_TOKEN || token === 'MCP_CONFIG_HOLDER') {
            return mockConfigHolder;
          }
          if (token === ToolRegistryService) {
            return mockToolRegistry;
          }
          return null;
        }),
      };
      
      NestFactory.createApplicationContext = jest.fn().mockResolvedValue(mockApp);
      
      await EasyMCP.initialize(validConfig);
      
      expect(mockToolRegistry.registerToolFromConfig).toHaveBeenCalledTimes(1);
      expect(mockToolRegistry.registerToolFromConfig).toHaveBeenCalledWith(validConfig.tools[0]);
    });

    it('should handle empty tools array', async () => {
      const { NestFactory } = require('@nestjs/core');
      const configWithoutTools = { ...validConfig, tools: [] };
      const mockToolRegistry = {
        registerToolFromConfig: jest.fn(),
      };
      
      const mockConfigHolder = {
        setConfig: jest.fn(),
      };
      
      const mockApp = {
        get: jest.fn((token) => {
          if (token === CONFIG_TOKEN || token === 'MCP_CONFIG_HOLDER') {
            return mockConfigHolder;
          }
          if (token === ToolRegistryService) {
            return mockToolRegistry;
          }
          return null;
        }),
      };
      
      NestFactory.createApplicationContext = jest.fn().mockResolvedValue(mockApp);
      
      await EasyMCP.initialize(configWithoutTools);
      
      expect(mockToolRegistry.registerToolFromConfig).not.toHaveBeenCalled();
    });

    it('should throw error if tool registration fails', async () => {
      const { NestFactory } = require('@nestjs/core');
      const mockToolRegistry = {
        registerToolFromConfig: jest.fn().mockImplementation(() => {
          throw new Error('Duplicate tool name');
        }),
      };
      
      const mockConfigHolder = {
        setConfig: jest.fn(),
      };
      
      const mockApp = {
        get: jest.fn((token) => {
          if (token === CONFIG_TOKEN || token === 'MCP_CONFIG_HOLDER') {
            return mockConfigHolder;
          }
          if (token === ToolRegistryService) {
            return mockToolRegistry;
          }
          return null;
        }),
      };
      
      NestFactory.createApplicationContext = jest.fn().mockResolvedValue(mockApp);
      
      await expect(EasyMCP.initialize(validConfig)).rejects.toThrow('Failed to register tool');
    });
  });

  describe('getService', () => {
    it('should throw error if not initialized', () => {
      (EasyMCP as any).app = undefined;
      expect(() => EasyMCP.getService('SOME_TOKEN')).toThrow('EasyMCP is not initialized');
    });

    it('should return service from app context', async () => {
      const { NestFactory } = require('@nestjs/core');
      const mockService = { someMethod: jest.fn() };
      const mockConfigHolder = {
        setConfig: jest.fn(),
      };
      const mockToolRegistry = {
        registerToolFromConfig: jest.fn(),
      };
      const mockApp = {
        get: jest.fn((token) => {
          if (token === CONFIG_TOKEN || token === 'MCP_CONFIG_HOLDER') {
            return mockConfigHolder;
          }
          if (token === ToolRegistryService) {
            return mockToolRegistry;
          }
          return mockService;
        }),
      };
      
      NestFactory.createApplicationContext = jest.fn().mockResolvedValue(mockApp);
      
      await EasyMCP.initialize(validConfig);
      const service = EasyMCP.getService('SOME_TOKEN');
      
      expect(service).toBe(mockService);
    });
  });
});

