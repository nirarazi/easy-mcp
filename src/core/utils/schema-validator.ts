import { ToolParameter } from "../../tooling/tool.interface";

/**
 * Validates tool arguments against the tool's JSON Schema 2020-12 schema.
 * @param args The arguments to validate
 * @param inputSchema The JSON Schema 2020-12 schema definition
 * @returns Validation error message if invalid, null if valid
 */
export function validateToolArguments(
  args: Record<string, any>,
  inputSchema: { type: "object"; properties?: Record<string, ToolParameter>; required?: string[] },
): string | null {
  // Check required parameters
  const required = inputSchema.required || [];
  for (const paramName of required) {
    if (!(paramName in args) || args[paramName] === undefined || args[paramName] === null) {
      return `Missing required parameter: ${paramName}`;
    }
  }

  // Validate each provided argument
  const properties = inputSchema.properties || {};
  for (const [paramName, paramValue] of Object.entries(args)) {
    const paramDef = properties[paramName];
    
    if (!paramDef) {
      return `Unknown parameter: ${paramName}`;
    }

    // Validate type
    const validationError = validateParameterType(paramName, paramValue, paramDef);
    if (validationError) {
      return validationError;
    }

    // Validate enum if specified
    if (paramDef.enum && !paramDef.enum.includes(paramValue)) {
      return `Parameter '${paramName}' must be one of: ${paramDef.enum.join(", ")}`;
    }
  }

  return null;
}

/**
 * Validates a single parameter value against its type definition.
 */
function validateParameterType(
  paramName: string,
  value: any,
  paramDef: ToolParameter,
): string | null {
  switch (paramDef.type) {
    case "string":
      if (typeof value !== "string") {
        return `Parameter '${paramName}' must be a string`;
      }
      break;
    case "number":
      if (typeof value !== "number" || isNaN(value)) {
        return `Parameter '${paramName}' must be a number`;
      }
      break;
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return `Parameter '${paramName}' must be an integer`;
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        return `Parameter '${paramName}' must be a boolean`;
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        return `Parameter '${paramName}' must be an array`;
      }
      break;
    case "object":
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return `Parameter '${paramName}' must be an object`;
      }
      break;
    default:
      return `Parameter '${paramName}' has unsupported type: ${paramDef.type}`;
  }

  return null;
}

