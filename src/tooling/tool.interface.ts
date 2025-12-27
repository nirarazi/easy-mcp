// src/tooling/tool.interface.ts

/**
 * JSON Schema 2020-12 compatible schema definition for tool parameters.
 * This follows the standard JSON Schema format.
 */
export interface ToolParameter extends Record<string, any> {
  type?: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  enum?: (string | number | boolean)[];
  default?: any;
  const?: any;
  items?: ToolParameter | ToolParameter[];
  properties?: Record<string, ToolParameter>;
  required?: string[];
  oneOf?: ToolParameter[];
  anyOf?: ToolParameter[];
  allOf?: ToolParameter[];
  $ref?: string;
  // Additional JSON Schema properties
  [key: string]: any;
}

/**
 * Cancellation token for cancelling tool execution.
 */
export interface CancellationToken {
  isCancelled: boolean;
  onCancel: (callback: () => void) => void;
  cancel: () => void;
}

import { McpContext } from "../core/context/mcp-context.interface";

/**
 * Defines a function that the LLM can call.
 * This function takes key/value arguments and returns a result string or object.
 * Optionally accepts a cancellation token for long-running operations.
 * Optionally accepts context for user information and permissions.
 */
export type ToolFunction = (
  args: Record<string, any>,
  cancellationToken?: CancellationToken,
  context?: McpContext
) => Promise<any>;

/**
 * The full definition of an external tool registered with EasyMCP (Layer 3).
 * This structure uses JSON Schema 2020-12 format.
 */
export interface ToolDefinition {
  /** The unique name of the function (e.g., 'lookupCodeExample'). */
  name: string;

  /** A clear description of what the function does (critical for the LLM). */
  description: string;

  /** The actual executable function reference. */
  execute: ToolFunction;

  /** JSON Schema 2020-12 compatible input schema for the tool. */
  inputSchema: {
    type: "object";
    properties?: Record<string, ToolParameter>;
    required?: string[];
    [key: string]: any;
  };

  /** Optional icon URI for the tool. */
  icon?: string;
}
