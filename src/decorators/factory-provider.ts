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
  // If no factory provided, create one that resolves factory-injected dependencies
  if (!factory) {
    factory = (...args: any[]) => {
      // Get constructor parameter factories
      const constructorFactories = getServiceFactories(target);

      // Resolve factory dependencies, sorted by parameter index to ensure correct order
      const resolvedArgs = constructorFactories
        .sort((a, b) => a.index - b.index)
        .map(({ factory: factoryFn }) => factoryFn());

      // Create instance with resolved dependencies
      return new target(...resolvedArgs);
    };
  }

  return {
    provide: target,
    useFactory: factory,
  };
}
