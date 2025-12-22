import { ConfigValidator } from './config-validator';
import { ConfigurationError } from '../core/errors/easy-mcp-error';
import { McpConfig } from './mcp-config.interface';

describe('ConfigValidator', () => {
  const validConfig: McpConfig = {
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

    it('should throw if tools array is missing', () => {
      const config = { ...validConfig, tools: undefined as any };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
      expect(() => ConfigValidator.validate(config)).toThrow('tools');
    });

    it('should throw if tools array is empty', () => {
      const config = { ...validConfig, tools: [] };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
      expect(() => ConfigValidator.validate(config)).toThrow('At least one tool');
    });
  });

  describe('serverInfo validation', () => {
    it('should pass validation if serverInfo is provided correctly', () => {
      const config = {
        ...validConfig,
        serverInfo: {
          name: 'my-server',
          version: '1.0.0',
        },
      };
      expect(() => ConfigValidator.validate(config)).not.toThrow();
    });

    it('should throw if serverInfo.name is missing', () => {
      const config = {
        ...validConfig,
        serverInfo: {
          name: '',
          version: '1.0.0',
        },
      };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
      expect(() => ConfigValidator.validate(config)).toThrow('serverInfo.name');
    });

    it('should throw if serverInfo.version is missing', () => {
      const config = {
        ...validConfig,
        serverInfo: {
          name: 'my-server',
          version: '',
        },
      };
      expect(() => ConfigValidator.validate(config)).toThrow(ConfigurationError);
      expect(() => ConfigValidator.validate(config)).toThrow('serverInfo.version');
    });
  });

  describe('tool validation', () => {
    it('should validate tools with valid schema', () => {
      expect(() => ConfigValidator.validate(validConfig)).not.toThrow();
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
