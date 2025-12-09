import { Injectable } from "@nestjs/common";
import { ToolDefinition } from "../tool.interface";

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
    console.log(`Tool registered: ${definition.name}`);
  }

  /**
   * Retrieves a registered tool definition by name.
   */
  public getTool(name: string): ToolDefinition | undefined {
    return this.registry.get(name);
  }

  /**
   * Retrieves the JSON Schema representations of ALL registered tools.
   * This output is passed directly to the LLM vendor API during the prompt assembly (Layer 3).
   *
   */
  public getToolSchemasForLLM(): any[] {
    return Array.from(this.registry.values()).map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.parameters,
          required: tool.required,
        },
      },
    }));
  }
}
