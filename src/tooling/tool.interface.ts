// src/tooling/tool.interface.ts

/**
 * Defines the structure of a single parameter for a registered tool function.
 * This translates directly to a JSON Schema property.
 */
export interface ToolParameter {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description: string;
  enum?: string[]; // Optional: for restricted values
}

/**
 * Defines a function that the LLM can call.
 * This function takes key/value arguments and returns a result string or object.
 */
export type ToolFunction = (args: Record<string, any>) => Promise<any>;

/**
 * The full definition of an external tool registered with EasyMCP (Layer 3).
 * This structure is used to generate the LLM's required JSON Schema.
 */
export interface ToolDefinition {
  /** The unique name of the function (e.g., 'lookupCodeExample'). */
  name: string;

  /** A clear description of what the function does (critical for the LLM). */
  description: string;

  /** The actual executable function reference. */
  execute: ToolFunction;

  /** The definition of the function's input arguments (JSON Schema 'properties'). */
  parameters: Record<string, ToolParameter>;

  /** List of required parameter keys. */
  required: string[];
}
