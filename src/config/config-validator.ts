import { McpConfig, ToolRegistrationInput } from './mcp-config.interface';
import { ConfigurationError } from '../core/errors/easy-mcp-error';
import { ToolNamingValidator } from '../core/utils/tool-naming-validator';

/**
 * Validates the EasyMCP configuration object.
 * Throws ConfigurationError if validation fails.
 */
export class ConfigValidator {
  /**
   * Validates the complete McpConfig object.
   * @param config The configuration to validate
   * @throws ConfigurationError if validation fails
   */
  static validate(config: McpConfig): void {
    if (!config) {
      throw new ConfigurationError('Configuration object is required');
    }

    // Validate Tools
    if (!config.tools || !Array.isArray(config.tools)) {
      throw new ConfigurationError('tools must be a non-empty array');
    }

    if (config.tools.length === 0) {
      throw new ConfigurationError('At least one tool must be provided');
    }

    config.tools.forEach((tool, index) => {
      this.validateTool(tool, index);
    });

    // Validate resources if provided
    if (config.resources !== undefined) {
      if (!Array.isArray(config.resources)) {
        throw new ConfigurationError('resources must be an array if provided');
      }
      config.resources.forEach((res, idx) => {
        if (!res.uri || typeof res.uri !== 'string' || res.uri.trim().length === 0) {
          throw new ConfigurationError(`Resource at index ${idx}: 'uri' must be a non-empty string`);
        }
        if (!res.name || typeof res.name !== 'string' || res.name.trim().length === 0) {
          throw new ConfigurationError(`Resource '${res.uri}': 'name' must be a non-empty string`);
        }
        if (typeof res.getContent !== 'function') {
          throw new ConfigurationError(`Resource '${res.uri}': 'getContent' must be a function`);
        }
        if (res.description !== undefined && typeof res.description !== 'string') {
          throw new ConfigurationError(`Resource '${res.uri}': 'description' must be a string if provided`);
        }
        if (res.mimeType !== undefined && typeof res.mimeType !== 'string') {
          throw new ConfigurationError(`Resource '${res.uri}': 'mimeType' must be a string if provided`);
        }
        if (res.icon !== undefined && typeof res.icon !== 'string') {
          throw new ConfigurationError(`Resource '${res.uri}': 'icon' must be a string if provided`);
        }
      });
    }

    // Validate prompts if provided
    if (config.prompts !== undefined) {
      if (!Array.isArray(config.prompts)) {
        throw new ConfigurationError('prompts must be an array if provided');
      }
      config.prompts.forEach((p, idx) => {
        if (!p.name || typeof p.name !== 'string' || p.name.trim().length === 0) {
          throw new ConfigurationError(`Prompt at index ${idx}: 'name' must be a non-empty string`);
        }
        if (typeof p.getPrompt !== 'function') {
          throw new ConfigurationError(`Prompt '${p.name}': 'getPrompt' must be a function`);
        }
        if (p.description !== undefined && typeof p.description !== 'string') {
          throw new ConfigurationError(`Prompt '${p.name}': 'description' must be a string if provided`);
        }
        if (p.arguments !== undefined) {
          if (!Array.isArray(p.arguments)) {
            throw new ConfigurationError(`Prompt '${p.name}': 'arguments' must be an array if provided`);
          }
          p.arguments.forEach((arg, argIdx) => {
            if (!arg.name || typeof arg.name !== 'string' || arg.name.trim().length === 0) {
              throw new ConfigurationError(`Prompt '${p.name}': argument at index ${argIdx} must have a non-empty 'name'`);
            }
            if (arg.description !== undefined && typeof arg.description !== 'string') {
              throw new ConfigurationError(`Prompt '${p.name}': argument '${arg.name}' description must be a string if provided`);
            }
            if (arg.required !== undefined && typeof arg.required !== 'boolean') {
              throw new ConfigurationError(`Prompt '${p.name}': argument '${arg.name}' required must be a boolean if provided`);
            }
          });
        }
        if (p.icon !== undefined && typeof p.icon !== 'string') {
          throw new ConfigurationError(`Prompt '${p.name}': 'icon' must be a string if provided`);
        }
      });
    }

    // Validate serverInfo if provided
    if (config.serverInfo) {
      if (!config.serverInfo.name || typeof config.serverInfo.name !== 'string' || config.serverInfo.name.trim().length === 0) {
        throw new ConfigurationError('serverInfo.name must be a non-empty string');
      }
      if (!config.serverInfo.version || typeof config.serverInfo.version !== 'string' || config.serverInfo.version.trim().length === 0) {
        throw new ConfigurationError('serverInfo.version must be a non-empty string');
      }
    }
  }

  /**
   * Validates a single tool configuration.
   */
  private static validateTool(tool: ToolRegistrationInput, index: number): void {
    if (!tool) {
      throw new ConfigurationError(`Tool at index ${index} is null or undefined`);
    }

    if (!tool.name || typeof tool.name !== 'string' || tool.name.trim().length === 0) {
      throw new ConfigurationError(`Tool at index ${index}: name must be a non-empty string`);
    }

    // Validate tool name according to MCP 2025-11-25 naming guidelines
    const namingError = ToolNamingValidator.validate(tool.name);
    if (namingError) {
      const suggestion = ToolNamingValidator.suggest(tool.name);
      throw new ConfigurationError(
        `Tool '${tool.name}': ${namingError}. Suggested name: '${suggestion}'`
      );
    }

    if (!tool.description || typeof tool.description !== 'string' || tool.description.trim().length === 0) {
      throw new ConfigurationError(`Tool '${tool.name}': description must be a non-empty string`);
    }

    if (typeof tool.function !== 'function') {
      throw new ConfigurationError(`Tool '${tool.name}': function must be a function`);
    }

    if (!tool.inputSchema) {
      throw new ConfigurationError(`Tool '${tool.name}': inputSchema is required`);
    }

    // Validate JSON Schema 2020-12 format
    if (tool.inputSchema.type !== 'object') {
      throw new ConfigurationError(`Tool '${tool.name}': inputSchema.type must be 'object' (JSON Schema 2020-12 format)`);
    }

    // Properties are optional in JSON Schema, but validate if present
    if (tool.inputSchema.properties !== undefined) {
      if (typeof tool.inputSchema.properties !== 'object' || Array.isArray(tool.inputSchema.properties)) {
        throw new ConfigurationError(`Tool '${tool.name}': inputSchema.properties must be an object`);
      }

      // Validate each property in the schema
      for (const [propName, propDef] of Object.entries(tool.inputSchema.properties)) {
        if (!propDef || typeof propDef !== 'object' || Array.isArray(propDef)) {
          throw new ConfigurationError(`Tool '${tool.name}': property '${propName}' must be an object`);
        }

        // Type is optional in JSON Schema (can use oneOf, anyOf, etc.), but if present, validate
        if (propDef.type !== undefined) {
          const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object'];
          if (typeof propDef.type !== 'string' || !validTypes.includes(propDef.type)) {
            throw new ConfigurationError(`Tool '${tool.name}': property '${propName}' has invalid type '${propDef.type}'. Must be one of: ${validTypes.join(', ')} (JSON Schema 2020-12 format)`);
          }
        }

        // Description is recommended but not required in JSON Schema
        if (propDef.description !== undefined && typeof propDef.description !== 'string') {
          throw new ConfigurationError(`Tool '${tool.name}': property '${propName}' description must be a string if provided`);
        }
      }
    }

    // Validate required array if provided
    if (tool.inputSchema.required !== undefined) {
      if (!Array.isArray(tool.inputSchema.required)) {
        throw new ConfigurationError(`Tool '${tool.name}': inputSchema.required must be an array`);
      }

      // Ensure all required properties exist in properties (if properties is defined)
      if (tool.inputSchema.properties) {
        for (const requiredProp of tool.inputSchema.required) {
          if (!(requiredProp in tool.inputSchema.properties)) {
            throw new ConfigurationError(`Tool '${tool.name}': required property '${requiredProp}' does not exist in properties`);
          }
        }
      }
    }

    // Validate icon if provided
    if (tool.icon !== undefined && typeof tool.icon !== 'string') {
      throw new ConfigurationError(`Tool '${tool.name}': icon must be a string (URI) if provided`);
    }
  }
}

