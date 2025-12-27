import "reflect-metadata";

/**
 * Metadata key for storing factory function
 */
const MCP_SERVICE_FACTORY_METADATA_KEY = Symbol("mcp:service:factory");

/**
 * Decorator to inject a service using a factory function instead of DI container.
 *
 * @example
 * ```typescript
 * @McpTool({ name: 'create_building' })
 * export class BuildingTools {
 *   constructor(
 *     @McpService(() => getBuildingService())
 *     private buildingService: BuildingService
 *   ) {}
 * }
 * ```
 *
 * @param factory Function that returns the service instance
 */
export function McpService<T = any>(factory: () => T): ParameterDecorator {
  return (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (propertyKey !== undefined) {
      // For method parameters, store on the method
      const existingFactories: Array<{ index: number; factory: () => any }> =
        Reflect.getMetadata(MCP_SERVICE_FACTORY_METADATA_KEY, target, propertyKey) || [];

      existingFactories.push({ index: parameterIndex, factory });
      Reflect.defineMetadata(MCP_SERVICE_FACTORY_METADATA_KEY, existingFactories, target, propertyKey);
    } else {
      // For constructor parameters, store on the constructor
      const existingFactories: Array<{ index: number; factory: () => any }> =
        Reflect.getMetadata(MCP_SERVICE_FACTORY_METADATA_KEY, target) || [];

      existingFactories.push({ index: parameterIndex, factory });
      Reflect.defineMetadata(MCP_SERVICE_FACTORY_METADATA_KEY, existingFactories, target);
    }
  };
}

/**
 * Gets factory functions for a given target (class or method).
 * @internal
 */
export function getServiceFactories(
  target: any,
  propertyKey?: string | symbol,
): Array<{ index: number; factory: () => any }> {
  if (propertyKey !== undefined) {
    return Reflect.getMetadata(MCP_SERVICE_FACTORY_METADATA_KEY, target, propertyKey) || [];
  }
  return Reflect.getMetadata(MCP_SERVICE_FACTORY_METADATA_KEY, target) || [];
}
