import { ToolDefinition, ToolFunction, CancellationToken } from "../tooling/tool.interface";
import { ToolRegistrationInput, ResourceRegistrationInput, PromptRegistrationInput } from "../config/mcp-config.interface";
import { ToolNotFoundError, ToolExecutionError } from "../core/errors/easy-mcp-error";
import { McpContext } from "../core/context/mcp-context.interface";
import { validateToolArguments } from "../core/utils/schema-validator";
import { logger } from "../core/utils/logger.util";

/**
 * Standalone tool registry (no NestJS dependency).
 */
export class StandaloneToolRegistry {
  private readonly registry = new Map<string, ToolDefinition>();

  /**
   * Registers a tool from ToolRegistrationInput.
   */
  registerTool(toolInput: ToolRegistrationInput): void {
    if (this.registry.has(toolInput.name)) {
      throw new Error(`Tool name '${toolInput.name}' already registered.`);
    }

    const toolDefinition: ToolDefinition = {
      name: toolInput.name,
      description: toolInput.description,
      execute: toolInput.function,
      inputSchema: toolInput.inputSchema,
      icon: toolInput.icon,
    };

    this.registry.set(toolInput.name, toolDefinition);
    logger.info("StandaloneToolRegistry", `Tool registered: ${toolInput.name}`, {
      component: "Standalone",
      toolName: toolInput.name,
    });
  }

  /**
   * Gets a tool by name.
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.registry.get(name);
  }

  /**
   * Executes a tool with arguments and optional context.
   */
  async executeTool(
    name: string,
    args: Record<string, any>,
    cancellationToken?: CancellationToken,
    context?: McpContext
  ): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new ToolNotFoundError(name);
    }

    // Validate arguments
    const validationError = validateToolArguments(args, tool.inputSchema);
    if (validationError) {
      throw new ToolExecutionError(
        `Tool '${name}' validation failed: ${validationError}`,
        name
      );
    }

    try {
      const result = await tool.execute(args, cancellationToken, context);
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
   * Gets all registered tools as schemas for LLM.
   */
  getToolSchemasForLLM(): Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: any;
    };
  }> {
    return Array.from(this.registry.values()).map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }
}

/**
 * Standalone resource registry (no NestJS dependency).
 */
export class StandaloneResourceRegistry {
  private readonly registry = new Map<string, ResourceRegistrationInput>();

  /**
   * Registers a resource.
   */
  registerResource(resource: ResourceRegistrationInput): void {
    if (this.registry.has(resource.uri)) {
      throw new Error(`Resource URI '${resource.uri}' already registered.`);
    }
    this.registry.set(resource.uri, resource);
  }

  /**
   * Gets a resource by URI.
   */
  getResource(uri: string): ResourceRegistrationInput | undefined {
    return this.registry.get(uri);
  }

  /**
   * Gets all registered resources.
   */
  getAllResources(): ResourceRegistrationInput[] {
    return Array.from(this.registry.values());
  }
}

/**
 * Standalone prompt registry (no NestJS dependency).
 */
export class StandalonePromptRegistry {
  private readonly registry = new Map<string, PromptRegistrationInput>();

  /**
   * Registers a prompt.
   */
  registerPrompt(prompt: PromptRegistrationInput): void {
    if (this.registry.has(prompt.name)) {
      throw new Error(`Prompt name '${prompt.name}' already registered.`);
    }
    this.registry.set(prompt.name, prompt);
  }

  /**
   * Gets a prompt by name.
   */
  getPrompt(name: string): PromptRegistrationInput | undefined {
    return this.registry.get(name);
  }

  /**
   * Gets all registered prompts.
   */
  getAllPrompts(): PromptRegistrationInput[] {
    return Array.from(this.registry.values());
  }
}
