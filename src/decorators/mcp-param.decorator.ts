import "reflect-metadata";
import { z } from "zod";
import { zodToJsonSchema } from "../validation/zod-integration";

/**
 * Metadata key for storing parameter schemas
 */
const MCP_PARAM_SCHEMA_METADATA_KEY = Symbol("mcp:param:schema");
const MCP_PARAM_INDEX_METADATA_KEY = Symbol("mcp:param:index");

/**
 * Decorator to specify a Zod schema for a tool method parameter.
 * This enables TypeScript-first validation with full type safety.
 * 
 * @example
 * ```typescript
 * const CreateBuildingSchema = z.object({
 *   name: z.string(),
 *   address: z.string(),
 *   floors: z.number().int().min(1).max(100),
 * });
 * 
 * @McpTool({ name: 'create_building' })
 * async createBuilding(
 *   @McpParam(CreateBuildingSchema) params: z.infer<typeof CreateBuildingSchema>
 * ) {
 *   // params is fully typed and validated
 *   return this.service.createBuilding(params);
 * }
 * ```
 */
export function McpParam<T extends z.ZodTypeAny>(schema: T): ParameterDecorator {
  return (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey === undefined) {
      return;
    }

    // Store the schema for this parameter
    const existingSchemas: Map<number, z.ZodTypeAny> =
      Reflect.getMetadata(MCP_PARAM_SCHEMA_METADATA_KEY, target, propertyKey) || new Map();
    
    existingSchemas.set(parameterIndex, schema);
    Reflect.defineMetadata(MCP_PARAM_SCHEMA_METADATA_KEY, existingSchemas, target, propertyKey);

    // Store parameter indices that have schemas
    const existingIndices: number[] =
      Reflect.getMetadata(MCP_PARAM_INDEX_METADATA_KEY, target, propertyKey) || [];
    
    if (!existingIndices.includes(parameterIndex)) {
      existingIndices.push(parameterIndex);
      Reflect.defineMetadata(MCP_PARAM_INDEX_METADATA_KEY, existingIndices, target, propertyKey);
    }
  };
}

/**
 * Gets the Zod schema for a parameter at the given index.
 * @internal
 */
export function getParamSchema(
  target: any,
  propertyKey: string | symbol,
  parameterIndex: number
): z.ZodTypeAny | undefined {
  const schemas: Map<number, z.ZodTypeAny> =
    Reflect.getMetadata(MCP_PARAM_SCHEMA_METADATA_KEY, target, propertyKey) || new Map();
  return schemas.get(parameterIndex);
}

/**
 * Gets all parameter schemas for a method.
 * @internal
 */
export function getAllParamSchemas(
  target: any,
  propertyKey: string | symbol
): Map<number, z.ZodTypeAny> {
  return Reflect.getMetadata(MCP_PARAM_SCHEMA_METADATA_KEY, target, propertyKey) || new Map();
}

/**
 * Converts all parameter schemas to JSON Schema format.
 * @internal
 */
export function getParamSchemasAsJsonSchema(
  target: any,
  propertyKey: string | symbol
): { type: "object"; properties?: Record<string, any>; required?: string[] } | null {
  const schemas = getAllParamSchemas(target, propertyKey);
  
  // For MCP tools, we expect a single parameter object
  // The first parameter (index 0) should be the params object
  const paramsSchema = schemas.get(0);
  
  if (!paramsSchema) {
    return null;
  }

  // Convert Zod schema to JSON Schema
  return zodToJsonSchema(paramsSchema) as { type: "object"; properties?: Record<string, any>; required?: string[] };
}

