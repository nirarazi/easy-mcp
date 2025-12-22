import { ConfigValidator } from './config-validator';
import { ConfigurationError } from '../core/errors/easy-mcp-error';
import { McpConfig } from './mcp-config.interface';

describe('ConfigValidator', () => {
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
    tools: [],
  };

  describe('validate', () => {
    it('should pass validation for valid config', () => {
      expect(() => ConfigValidator.validate(validConfig)).not.toThrow();
    });

    it('should throw ConfigurationError for null config', () => {
      expect(() => ConfigValidator.validate(null as any)).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for undefined config', () => {
      expect(() => ConfigValidator.validate(undefined as any)).toThrow(ConfigurationError);
    });
  });

  describe('llmProvider validation', () => {
    it('should throw if llmProvider is missing', () => {
      const config = { ...validConfig, llmProvider: undefined as any };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
      expect(() => ConfigValidator.validate(config)).toThrow('llmProvider');
    });

    it('should throw if apiKey is missing', () => {
      const config = { ...validConfig, llmProvider: { ...validConfig.llmProvider, apiKey: '' } };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
    });

    it('should throw if model is missing', () => {
      const config = { ...validConfig, llmProvider: { ...validConfig.llmProvider, model: '' } };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
    });

    it('should throw if systemInstruction is missing', () => {
      const config = { ...validConfig, llmProvider: { ...validConfig.llmProvider, systemInstruction: '' } };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
    });
  });

  describe('persistence validation', () => {
    it('should throw if persistence is missing', () => {
      const config = { ...validConfig, persistence: undefined as any };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
    });

    it('should throw if appId is missing', () => {
      const config = { ...validConfig, persistence: { ...validConfig.persistence, appId: '' } };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
    });

    it('should throw if type is not FIRESTORE', () => {
      const config = { ...validConfig, persistence: { ...validConfig.persistence, type: 'INVALID' as any } };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
    });
  });

  describe('ltmConfig validation', () => {
    it('should throw if ltmConfig is missing', () => {
      const config = { ...validConfig, ltmConfig: undefined as any };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
    });

    it('should throw if vectorDB endpoint is missing', () => {
      const config = {
        ...validConfig,
        ltmConfig: {
          ...validConfig.ltmConfig,
          vectorDB: { ...validConfig.ltmConfig.vectorDB, endpoint: '' },
        },
      };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
    });

    it('should throw if retrievalK is invalid', () => {
      const config = { ...validConfig, ltmConfig: { ...validConfig.ltmConfig, retrievalK: 0 } };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
    });
  });

  describe('tool validation', () => {
    it('should validate tools with valid schema', () => {
      const config = {
        ...validConfig,
        tools: [
          {
            name: 'testTool',
            description: 'A test tool',
            function: async () => 'result',
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
      expect(() => ConfigValidator.validate(config)).not.toThrow();
    });

    it('should throw if tool name is missing', () => {
      const config = {
        ...validConfig,
        tools: [
          {
            name: '',
            description: 'A test tool',
            function: async () => 'result',
            inputSchema: {
              type: 'OBJECT',
              properties: {},
            },
          },
        ],
      };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
    });

    it('should throw if tool function is not a function', () => {
      const config = {
        ...validConfig,
        tools: [
          {
            name: 'testTool',
            description: 'A test tool',
            function: 'not a function' as any,
            inputSchema: {
              type: 'OBJECT',
              properties: {},
            },
          },
        ],
      };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
    });

    it('should throw if tool property type is invalid', () => {
      const config = {
        ...validConfig,
        tools: [
          {
            name: 'testTool',
            description: 'A test tool',
            function: async () => 'result',
            inputSchema: {
              type: 'OBJECT',
              properties: {
                param: {
                  type: 'INVALID_TYPE' as any,
                  description: 'A parameter',
                },
              },
            },
          },
        ],
      };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
    });
  });
});

