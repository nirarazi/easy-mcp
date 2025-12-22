import { McpConfig, ToolRegistrationInput } from './mcp-config.interface';
import { ConfigurationError } from '../core/errors/easy-mcp-error';

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

    // Validate LLM Provider Config
    this.validateLlmProvider(config.llmProvider);

    // Validate Persistence Config
    this.validatePersistence(config.persistence);

    // Validate LTM Config
    this.validateLTM(config.ltmConfig);

    // Validate Tools
    if (config.tools && Array.isArray(config.tools)) {
      config.tools.forEach((tool, index) => {
        this.validateTool(tool, index);
      });
    }
  }

  /**
   * Validates the LLM provider configuration.
   */
  private static validateLlmProvider(config: McpConfig['llmProvider']): void {
    if (!config) {
      throw new ConfigurationError('llmProvider configuration is required');
    }

    if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim().length === 0) {
      throw new ConfigurationError('llmProvider.apiKey must be a non-empty string');
    }

    if (!config.model || typeof config.model !== 'string' || config.model.trim().length === 0) {
      throw new ConfigurationError('llmProvider.model must be a non-empty string');
    }

    if (!config.systemInstruction || typeof config.systemInstruction !== 'string') {
      throw new ConfigurationError('llmProvider.systemInstruction must be a string');
    }
  }

  /**
   * Validates the persistence configuration.
   */
  private static validatePersistence(config: McpConfig['persistence']): void {
    if (!config) {
      throw new ConfigurationError('persistence configuration is required');
    }

    if (config.type !== 'FIRESTORE') {
      throw new ConfigurationError(`Unsupported persistence type: ${config.type}. Only 'FIRESTORE' is currently supported.`);
    }

    if (!config.appId || typeof config.appId !== 'string' || config.appId.trim().length === 0) {
      throw new ConfigurationError('persistence.appId must be a non-empty string');
    }

    // config.config is optional for Firestore, but if provided should be an object
    if (config.config !== undefined && (typeof config.config !== 'object' || config.config === null || Array.isArray(config.config))) {
      throw new ConfigurationError('persistence.config must be an object if provided');
    }
  }

  /**
   * Validates the LTM (Long-Term Memory) configuration.
   */
  private static validateLTM(config: McpConfig['ltmConfig']): void {
    if (!config) {
      throw new ConfigurationError('ltmConfig configuration is required');
    }

    if (!config.vectorDB) {
      throw new ConfigurationError('ltmConfig.vectorDB is required');
    }

    if (!config.vectorDB.endpoint || typeof config.vectorDB.endpoint !== 'string' || config.vectorDB.endpoint.trim().length === 0) {
      throw new ConfigurationError('ltmConfig.vectorDB.endpoint must be a non-empty string');
    }

    if (!config.vectorDB.collectionName || typeof config.vectorDB.collectionName !== 'string' || config.vectorDB.collectionName.trim().length === 0) {
      throw new ConfigurationError('ltmConfig.vectorDB.collectionName must be a non-empty string');
    }

    if (typeof config.retrievalK !== 'number' || config.retrievalK < 1) {
      throw new ConfigurationError('ltmConfig.retrievalK must be a positive number');
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

    if (!tool.description || typeof tool.description !== 'string' || tool.description.trim().length === 0) {
      throw new ConfigurationError(`Tool '${tool.name}': description must be a non-empty string`);
    }

    if (typeof tool.function !== 'function') {
      throw new ConfigurationError(`Tool '${tool.name}': function must be a function`);
    }

    if (!tool.inputSchema) {
      throw new ConfigurationError(`Tool '${tool.name}': inputSchema is required`);
    }

    if (tool.inputSchema.type !== 'OBJECT') {
      throw new ConfigurationError(`Tool '${tool.name}': inputSchema.type must be 'OBJECT'`);
    }

    if (!tool.inputSchema.properties || typeof tool.inputSchema.properties !== 'object' || Array.isArray(tool.inputSchema.properties)) {
      throw new ConfigurationError(`Tool '${tool.name}': inputSchema.properties must be an object`);
    }

    // Validate each property in the schema
    for (const [propName, propDef] of Object.entries(tool.inputSchema.properties)) {
      if (!propDef || typeof propDef !== 'object' || Array.isArray(propDef)) {
        throw new ConfigurationError(`Tool '${tool.name}': property '${propName}' must be an object`);
      }

      if (!propDef.type || typeof propDef.type !== 'string') {
        throw new ConfigurationError(`Tool '${tool.name}': property '${propName}' must have a type`);
      }

      // Validate type is one of the supported types
      const validTypes = ['STRING', 'NUMBER', 'INTEGER', 'BOOLEAN', 'ARRAY', 'OBJECT'];
      if (!validTypes.includes(propDef.type)) {
        throw new ConfigurationError(`Tool '${tool.name}': property '${propName}' has invalid type '${propDef.type}'. Must be one of: ${validTypes.join(', ')}`);
      }

      if (!propDef.description || typeof propDef.description !== 'string') {
        throw new ConfigurationError(`Tool '${tool.name}': property '${propName}' must have a description`);
      }
    }

    // Validate required array if provided
    if (tool.inputSchema.required !== undefined) {
      if (!Array.isArray(tool.inputSchema.required)) {
        throw new ConfigurationError(`Tool '${tool.name}': inputSchema.required must be an array`);
      }

      // Ensure all required properties exist in properties
      for (const requiredProp of tool.inputSchema.required) {
        if (!(requiredProp in tool.inputSchema.properties)) {
          throw new ConfigurationError(`Tool '${tool.name}': required property '${requiredProp}' does not exist in properties`);
        }
      }
    }
  }
}

