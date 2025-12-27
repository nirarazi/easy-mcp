import { Injectable, Optional, Inject } from "@nestjs/common";
import { ToolDefinition, ToolParameter } from "../tool.interface";
import { ToolRegistrationInput, JsonSchema2020_12 } from "../../config/mcp-config.interface";
import { ToolNotFoundError, ToolExecutionError } from "../../core/errors/easy-mcp-error";
import { logger } from "../../core/utils/logger.util";
import { isSafeObjectKey } from "../../core/utils/sanitize.util";
import { scanClassesForTools } from "../../core/utils/decorator-scanner";
import { McpContext } from "../../core/context/mcp-context.interface";
import { ProgressCallback } from "../../core/progress/progress-notifier.service";
import { MetricsService } from "../../core/observability/metrics.service";

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

  constructor(@Optional() private metricsService?: MetricsService) {}

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
   * @param context Optional context for user information and permissions
   * @param progress Optional progress callback for long-running operations
   * @returns The result of the tool execution
   * @throws ToolNotFoundError if the tool is not registered
   * @throws ToolExecutionError if the tool execution fails or scope validation fails
   */
  public async executeTool(
    name: string,
    args: Record<string, any>,
    cancellationToken?: import("../tool.interface").CancellationToken,
    context?: McpContext,
    progress?: ProgressCallback
  ): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new ToolNotFoundError(name);
    }

    // Validate required scopes if tool has them
    if (tool.requiredScopes && tool.requiredScopes.length > 0) {
      if (!context || !context.scopes || context.scopes.length === 0) {
        throw new ToolExecutionError(
          `Tool '${name}' requires scopes: ${tool.requiredScopes.join(", ")}`,
          name,
        );
      }

      const hasAllScopes = tool.requiredScopes.every((scope) => context.scopes!.includes(scope));
      if (!hasAllScopes) {
        const missingScopes = tool.requiredScopes.filter(
          (scope) => !context.scopes!.includes(scope)
        );
        throw new ToolExecutionError(
          `Tool '${name}' requires scopes: ${tool.requiredScopes.join(", ")}. Missing: ${missingScopes.join(", ")}`,
          name,
        );
      }
    }

    // Record metrics start
    const recordEnd = this.metricsService?.recordToolStart(name);

    try {
      const result = await tool.execute(args, cancellationToken, context, progress);
      recordEnd?.();
      return result;
    } catch (error) {
      recordEnd?.();
      this.metricsService?.recordToolError(name);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ToolExecutionError(
        `Tool '${name}' execution failed: ${errorMessage}`,
        name,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Registers tools from decorator-based classes.
   * Scans classes for @McpTool decorated methods and registers them automatically.
   *
   * @param classes Array of class constructors to scan
   * @param instances Optional map of class to instance (if already instantiated)
   */
  public registerToolsFromDecorators(
    classes: Array<new (...args: any[]) => any>,
    instances?: Map<new (...args: any[]) => any, any>
  ): void {
    const tools = scanClassesForTools(classes, instances);
    for (const tool of tools) {
      this.registerTool(tool);
    }
    logger.info("ToolRegistryService", `Registered ${tools.length} tool(s) from decorators`, {
      component: "ToolRegistry",
      toolCount: tools.length,
    });
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
            ([key]) => !["type", "properties", "required"].includes(key) && isSafeObjectKey(key)
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
   * Converts a ToolParameter to JsonSchema2020_12, ensuring type is always defined.
   * If type is undefined, it defaults to "object" for nested schemas.
   */
  private convertToolParameterToJsonSchema(param: ToolParameter): JsonSchema2020_12 {
    const schema: any = {
      ...(param.type !== undefined && { type: param.type }),
      ...(param.description && { description: param.description }),
      ...(param.enum && { enum: param.enum }),
      ...(param.default !== undefined && { default: param.default }),
      ...(param.const !== undefined && { const: param.const }),
      ...(param.$ref && { $ref: param.$ref }),
      ...(param.oneOf && { oneOf: param.oneOf.map((p) => this.convertToolParameterToJsonSchema(p)) }),
      ...(param.anyOf && { anyOf: param.anyOf.map((p) => this.convertToolParameterToJsonSchema(p)) }),
      ...(param.allOf && { allOf: param.allOf.map((p) => this.convertToolParameterToJsonSchema(p)) }),
    };

    // Handle nested properties
    if (param.properties) {
      schema.type = schema.type ?? "object";
      schema.properties = {};
      for (const [key, value] of Object.entries(param.properties)) {
        // Prevent prototype pollution by only copying safe keys
        if (isSafeObjectKey(key)) {
          schema.properties[key] = this.convertToolParameterToJsonSchema(value);
        }
      }
      if (Array.isArray(param.required)) {
        schema.required = param.required;
      }
    }

    // Handle items (for arrays)
    if (param.items) {
      schema.type = schema.type ?? "array";
      schema.items = Array.isArray(param.items)
        ? param.items.map((item) => this.convertToolParameterToJsonSchema(item))
        : this.convertToolParameterToJsonSchema(param.items);
    }

    // Copy any additional properties (prevent prototype pollution)
    for (const [key, value] of Object.entries(param)) {
      if (
        ![
          "type",
          "description",
          "enum",
          "default",
          "const",
          "required",
          "$ref",
          "oneOf",
          "anyOf",
          "allOf",
          "properties",
          "items",
        ].includes(key) &&
        isSafeObjectKey(key)
      ) {
        schema[key] = value;
      }
    }

    return schema as JsonSchema2020_12;
  }

  /**
   * Converts registered tools to ToolRegistrationInput format.
   * Uses JSON Schema 2020-12 format directly.
   * @returns Array of tools in ToolRegistrationInput format
   */
  public getToolsAsRegistrationInput(): ToolRegistrationInput[] {
    return Array.from(this.registry.values()).map((tool) => {
      // Convert the inputSchema, ensuring all nested ToolParameters are converted to JsonSchema2020_12
      const convertedSchema: JsonSchema2020_12 = {
        type: "object",
        ...(tool.inputSchema.required && { required: tool.inputSchema.required }),
      };

      // Convert properties if they exist (prevent prototype pollution)
      if (tool.inputSchema.properties) {
        convertedSchema.properties = {};
        for (const [key, value] of Object.entries(tool.inputSchema.properties)) {
          // Only copy safe keys to prevent prototype pollution
          if (isSafeObjectKey(key)) {
            convertedSchema.properties[key] = this.convertToolParameterToJsonSchema(value);
          }
        }
      }

      // Copy any additional properties from inputSchema (prevent prototype pollution)
      for (const [key, value] of Object.entries(tool.inputSchema)) {
        if (!["type", "properties", "required"].includes(key) && isSafeObjectKey(key)) {
          (convertedSchema as any)[key] = value;
        }
      }

      return {
        name: tool.name,
        description: tool.description,
        function: tool.execute,
        inputSchema: convertedSchema,
        icon: tool.icon,
      };
    });
  }
}
