import { FactoryProvider } from "@nestjs/common";
import { getServiceFactories } from "./mcp-service.decorator";

/**
 * Creates a NestJS FactoryProvider for a class that uses @McpService decorators.
 * This allows classes with factory-injected services to work with NestJS DI.
 * 
 * @example
 * ```typescript
 * @Module({
 *   providers: [
 *     createFactoryProvider(BuildingTools, () => new BuildingTools(getBuildingService())),
 *   ],
 * })
 * export class ToolsModule {}
 * ```
 */
export function createFactoryProvider<T>(
  target: new (...args: any[]) => T,
  factory?: (...args: any[]) => T
): FactoryProvider<T> {
  const factories = getServiceFactories(target.prototype || target);
  
  // If no factory provided, create one that resolves factory-injected dependencies
  if (!factory) {
    factory = (...args: any[]) => {
      // Get constructor parameter factories
      const constructorFactories = getServiceFactories(target);
      
      // Resolve factory dependencies
      const resolvedArgs = constructorFactories.map(({ factory: factoryFn }) => factoryFn());
      
      // Create instance with resolved dependencies
      return new target(...resolvedArgs);
    };
  }

  return {
    provide: target,
    useFactory: factory,
  };
}

