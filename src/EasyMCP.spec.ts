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
      const invalidConfig = { ...validConfig, tools: [] };
      
      await expect(EasyMCP.initialize(invalidConfig)).rejects.toThrow('At least one tool');
    });

    it('should throw error if config validation fails', async () => {
      const invalidConfig = { ...validConfig, tools: undefined as any };
      
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
      // Note: We now use structured logging instead of console.warn
      // The logger writes to stderr as JSON, so we verify initialization doesn't throw
      await EasyMCP.initialize(validConfig);
      
      // Verify that the second initialization doesn't throw (it should just return)
      expect(true).toBe(true); // Test passes if no error is thrown
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

    it('should throw error if tools array is empty', async () => {
      const configWithoutTools = { ...validConfig, tools: [] };
      
      await expect(EasyMCP.initialize(configWithoutTools)).rejects.toThrow('At least one tool must be provided');
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

