import { Injectable } from "@nestjs/common";
import { ToolDefinition, ToolParameter } from "../tool.interface";
import { ToolRegistrationInput } from "../../config/mcp-config.interface";
import { ToolNotFoundError, ToolExecutionError } from "../../core/errors/easy-mcp-error";
import { logger } from "../../core/utils/logger.util";

/**
 * Type representing a tool schema in the format expected by LLM providers.
 * This matches the format used by Gemini and other LLM APIs.
 */
export interface LlmToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, ToolParameter>;
      required: string[];
    };
  };
}

@Injectable()
export class ToolRegistryService {
  private readonly registry = new Map<string, ToolDefinition>();

  /**
   * Registers a new tool, making it available for the LLM to call.
   * @param definition The complete ToolDefinition object.
   */
  public registerTool(definition: ToolDefinition): void {
    if (this.registry.has(definition.name)) {
      throw new Error(`Tool name '${definition.name}' already registered.`);
    }
    this.registry.set(definition.name, definition);
    logger.info("ToolRegistryService", `Tool registered: ${definition.name}`, {
      component: "ToolRegistry",
      toolName: definition.name,
    });
  }

  /**
   * Retrieves a registered tool definition by name.
   */
  public getTool(name: string): ToolDefinition | undefined {
    return this.registry.get(name);
  }

  /**
   * Executes a registered tool with the given arguments.
   * @param name The name of the tool to execute
   * @param args The arguments to pass to the tool function
   * @returns The result of the tool execution
   * @throws ToolNotFoundError if the tool is not registered
   * @throws ToolExecutionError if the tool execution fails
   */
  public async executeTool(name: string, args: Record<string, any>): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new ToolNotFoundError(name);
    }

    try {
      const result = await tool.execute(args);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ToolExecutionError(
        `Tool '${name}' execution failed: ${errorMessage}`,
        name,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Registers a tool from the ToolRegistrationInput format (used in config).
   * Converts the config format to the internal ToolDefinition format.
   * @param toolInput The tool configuration from McpConfig
   */
  public registerToolFromConfig(toolInput: ToolRegistrationInput): void {
    // Convert ToolRegistrationInput.inputSchema.properties to ToolParameter format
    const parameters: Record<string, ToolParameter> = {};
    
    for (const [key, prop] of Object.entries(toolInput.inputSchema.properties)) {
      // Convert uppercase type (STRING) to lowercase (string)
      const typeMap: Record<string, ToolParameter['type']> = {
        'STRING': 'string',
        'NUMBER': 'number',
        'INTEGER': 'integer',
        'BOOLEAN': 'boolean',
        'ARRAY': 'array',
        'OBJECT': 'object',
      };

      const lowerType = typeMap[prop.type as string];
      if (!lowerType) {
        throw new Error(`Tool '${toolInput.name}': Unsupported property type '${prop.type}' for property '${key}'. Must be one of: STRING, NUMBER, INTEGER, BOOLEAN, ARRAY, OBJECT`);
      }

      parameters[key] = {
        type: lowerType,
        description: prop.description || '',
        ...(prop.enum && { enum: prop.enum }),
      };
    }

    // Convert required array
    const required = toolInput.inputSchema.required || [];

    // Create ToolDefinition
    const toolDefinition: ToolDefinition = {
      name: toolInput.name,
      description: toolInput.description,
      execute: toolInput.function,
      parameters,
      required,
    };

    // Register using the existing method
    this.registerTool(toolDefinition);
  }

  /**
   * Retrieves the JSON Schema representations of ALL registered tools.
   * This output is passed directly to the LLM vendor API during the prompt assembly (Layer 3).
   * @returns Array of tool schemas in LLM-compatible format
   */
  public getToolSchemasForLLM(): LlmToolSchema[] {
    return Array.from(this.registry.values()).map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object" as const,
          properties: tool.parameters,
          required: tool.required,
        },
      },
    }));
  }

  /**
   * Converts registered tools to ToolRegistrationInput format for LLM provider.
   * This is used to bridge the gap between internal ToolDefinition and the format
   * expected by generateContent methods.
   * @returns Array of tools in ToolRegistrationInput format
   */
  public getToolsAsRegistrationInput(): ToolRegistrationInput[] {
    return Array.from(this.registry.values()).map((tool) => {
      // Convert ToolParameter format back to ToolRegistrationInput format
      const properties: Record<string, any> = {};
      for (const [key, param] of Object.entries(tool.parameters)) {
        // Convert lowercase type back to uppercase for ToolRegistrationInput
        const typeMap: Record<ToolParameter['type'], string> = {
          'string': 'STRING',
          'number': 'NUMBER',
          'integer': 'INTEGER',
          'boolean': 'BOOLEAN',
          'array': 'ARRAY',
          'object': 'OBJECT',
        };
        properties[key] = {
          type: typeMap[param.type] || 'STRING',
          description: param.description,
          ...(param.enum && { enum: param.enum }),
        };
      }

      return {
        name: tool.name,
        description: tool.description,
        function: tool.execute,
        inputSchema: {
          type: 'OBJECT',
          properties,
          required: tool.required,
        },
      };
    });
  }
}
