import { z } from "zod";
import { JsonSchema2020_12 } from "../config/mcp-config.interface";

/**
 * Converts a Zod schema to JSON Schema 2020-12 format.
 * This enables using Zod schemas for MCP tool parameter validation.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema2020_12 {
  // Handle ZodObject (most common case for tool parameters)
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, JsonSchema2020_12> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodSchema = value as z.ZodTypeAny;
      properties[key] = zodSchemaToJsonSchema(zodSchema);

      // Check if field is required (not optional, not nullable, not default)
      if (!(zodSchema instanceof z.ZodOptional) &&
          !(zodSchema instanceof z.ZodDefault) &&
          !(zodSchema instanceof z.ZodNullable)) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  // Handle other Zod types
  return zodSchemaToJsonSchema(schema);
}

/**
 * Converts a Zod schema to JSON Schema (recursive helper).
 */
function zodSchemaToJsonSchema(schema: z.ZodTypeAny): JsonSchema2020_12 {
  // Handle optional
  if (schema instanceof z.ZodOptional) {
    return zodSchemaToJsonSchema(schema._def.innerType);
  }

  // Handle nullable
  if (schema instanceof z.ZodNullable) {
    const inner = zodSchemaToJsonSchema(schema._def.innerType);
    return {
      ...inner,
      // JSON Schema doesn't have a direct nullable, but we can use oneOf
      // Note: JSON Schema 2020-12 doesn't support "null" type, so we omit it
      oneOf: [
        inner,
        { type: "object" as const, properties: {} },
      ],
    };
  }

  // Handle default
  if (schema instanceof z.ZodDefault) {
    const inner = zodSchemaToJsonSchema(schema._def.innerType);
    return {
      ...inner,
      default: schema._def.defaultValue(),
    };
  }

  // Handle string
  if (schema instanceof z.ZodString) {
    const result: JsonSchema2020_12 = { type: "string" };
    if (schema._def.checks) {
      for (const check of schema._def.checks) {
        if (check.kind === "min") {
          result.minLength = check.value;
        } else if (check.kind === "max") {
          result.maxLength = check.value;
        } else if (check.kind === "email") {
          result.format = "email";
        } else if (check.kind === "url") {
          result.format = "url";
        } else if (check.kind === "uuid") {
          result.format = "uuid";
        } else if (check.kind === "regex") {
          result.pattern = check.regex.source;
        }
      }
    }
    return result;
  }

  // Handle number
  if (schema instanceof z.ZodNumber) {
    const result: JsonSchema2020_12 = { type: "number" };
    if (schema._def.checks) {
      for (const check of schema._def.checks) {
        if (check.kind === "min") {
          result.minimum = check.value;
        } else if (check.kind === "max") {
          result.maximum = check.value;
        } else if (check.kind === "int") {
          result.type = "integer";
        }
      }
    }
    return result;
  }

  // Handle boolean
  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }

  // Handle array
  if (schema instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodSchemaToJsonSchema(schema._def.type),
    };
  }

  // Handle enum
  if (schema instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: schema._def.values,
    };
  }

  // Handle native enum
  if (schema instanceof z.ZodNativeEnum) {
    return {
      type: "string",
      enum: Object.values(schema._def.values),
    };
  }

  // Handle union
  if (schema instanceof z.ZodUnion) {
    return {
      type: "object" as const,
      oneOf: schema._def.options.map((option: z.ZodTypeAny) => zodSchemaToJsonSchema(option)),
    };
  }

  // Handle literal
  if (schema instanceof z.ZodLiteral) {
    const value = schema._def.value;
    const valueType = typeof value;
    return {
      type: (valueType === "string" ? "string" :
             valueType === "number" ? "number" :
             valueType === "boolean" ? "boolean" :
             "object"),
      const: value,
    };
  }

  // Handle object (nested)
  if (schema instanceof z.ZodObject) {
    return zodToJsonSchema(schema);
  }

  // Handle any/unknown
  if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) {
    return { type: "object" as const };
  }

  // Fallback: return empty object schema
  return { type: "object" };
}

/**
 * Validates data against a Zod schema.
 * Throws an error if validation fails.
 */
export function validateWithZod<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validates data against a Zod schema.
 * Returns a result object instead of throwing.
 */
export function safeValidateWithZod<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
