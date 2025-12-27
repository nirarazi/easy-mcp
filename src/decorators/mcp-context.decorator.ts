import "reflect-metadata";

/**
 * Metadata key for storing context parameter index
 */
const MCP_CONTEXT_METADATA_KEY = Symbol("mcp:context");

/**
 * Decorator to inject MCP context into a tool method parameter.
 *
 * @example
 * ```typescript
 * @McpTool({ name: 'create_building' })
 * async createBuilding(
 *   @McpParam() params: CreateBuildingDto,
 *   @McpContext() context: McpContext
 * ) {
 *   return this.service.createBuilding(context.userId, params);
 * }
 * ```
 */
export function McpContext(): ParameterDecorator {
  return (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey === undefined) {
      return;
    }

    // Store the parameter index that should receive context
    const existingContextParams: number[] =
      Reflect.getMetadata(MCP_CONTEXT_METADATA_KEY, target, propertyKey) || [];

    existingContextParams.push(parameterIndex);
    Reflect.defineMetadata(MCP_CONTEXT_METADATA_KEY, existingContextParams, target, propertyKey);
  };
}

/**
 * Gets the parameter indices that should receive context for a given method.
 * @internal
 */
export function getContextParameterIndices(
  target: any,
  propertyKey: string | symbol,
): number[] {
  return Reflect.getMetadata(MCP_CONTEXT_METADATA_KEY, target, propertyKey) || [];
}
