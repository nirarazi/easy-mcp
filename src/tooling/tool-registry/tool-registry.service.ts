import { Injectable } from "@nestjs/common";
import { ToolDefinition, ToolParameter } from "../tool.interface";
import { ToolRegistrationInput } from "../../config/mcp-config.interface";
import { ToolNotFoundError, ToolExecutionError } from "../../core/errors/easy-mcp-error";
import { logger } from "../../core/utils/logger.util";

/**
 * Type representing a tool schema in the format expected by LLM providers.
 * This matches the format used by Gemini and other LLM APIs.
 * Uses JSON Schema 2020-12 format.
 */
export interface LlmToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties?: Record<string, ToolParameter>;
      required?: string[];
      [key: string]: any;
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
   * @param cancellationToken Optional cancellation token for long-running operations
   * @returns The result of the tool execution
   * @throws ToolNotFoundError if the tool is not registered
   * @throws ToolExecutionError if the tool execution fails
   */
  public async executeTool(
    name: string,
    args: Record<string, any>,
    cancellationToken?: import("../tool.interface").CancellationToken
  ): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new ToolNotFoundError(name);
    }

    try {
      const result = await tool.execute(args, cancellationToken);
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
   * Uses JSON Schema 2020-12 format directly.
   * @param toolInput The tool configuration from McpConfig
   */
  public registerToolFromConfig(toolInput: ToolRegistrationInput): void {
    // Validate that inputSchema is an object type schema
    if (toolInput.inputSchema.type !== "object") {
      throw new Error(`Tool '${toolInput.name}': inputSchema.type must be "object" for tool definitions`);
    }

    // Create ToolDefinition using JSON Schema 2020-12 directly
    const toolDefinition: ToolDefinition = {
      name: toolInput.name,
      description: toolInput.description,
      execute: toolInput.function,
      inputSchema: {
        type: "object",
        properties: toolInput.inputSchema.properties || {},
        required: toolInput.inputSchema.required || [],
        ...Object.fromEntries(
          Object.entries(toolInput.inputSchema).filter(
            ([key]) => !["type", "properties", "required"].includes(key)
          )
        ),
      },
      icon: toolInput.icon,
    };

    // Register using the existing method
    this.registerTool(toolDefinition);
  }

  /**
   * Retrieves the JSON Schema representations of ALL registered tools.
   * This output is passed directly to the LLM vendor API during the prompt assembly (Layer 3).
   * Uses JSON Schema 2020-12 format.
   * @returns Array of tool schemas in LLM-compatible format
   */
  public getToolSchemasForLLM(): LlmToolSchema[] {
    return Array.from(this.registry.values()).map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  /**
   * Converts registered tools to ToolRegistrationInput format.
   * Uses JSON Schema 2020-12 format directly.
   * @returns Array of tools in ToolRegistrationInput format
   */
  public getToolsAsRegistrationInput(): ToolRegistrationInput[] {
    return Array.from(this.registry.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      function: tool.execute,
      inputSchema: tool.inputSchema,
      icon: tool.icon,
    }));
  }
}
