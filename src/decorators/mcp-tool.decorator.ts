import "reflect-metadata";

/**
 * Metadata keys for storing tool decorator information
 */
const MCP_TOOL_METADATA_KEY = Symbol("mcp:tool");
const MCP_TOOL_METHODS_METADATA_KEY = Symbol("mcp:tool:methods");

/**
 * Rate limit configuration for a tool
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  max: number;
  /** Time window (e.g., '1m', '1h', '60s') */
  window: string;
}

/**
 * Retry configuration for a tool
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Backoff strategy: 'exponential' | 'linear' | 'fixed' */
  backoff: "exponential" | "linear" | "fixed";
  /** Initial delay in milliseconds (for exponential/linear) */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
}

/**
 * Options for the @McpTool decorator
 */
export interface McpToolOptions {
  /** Tool name (required) */
  name: string;
  /** Tool description (required) */
  description: string;
  /** Required scopes/permissions for this tool */
  requiredScopes?: string[];
  /** Rate limiting configuration */
  rateLimit?: RateLimitConfig;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Tool version */
  version?: string;
  /** Optional icon URI */
  icon?: string;
}

/**
 * Metadata stored for a tool method
 */
export interface ToolMethodMetadata extends McpToolOptions {
  /** Method name */
  methodName: string;
  /** Target class */
  target: any;
}

/**
 * Decorator to mark a method as an MCP tool.
 * This enables declarative tool registration with automatic discovery.
 *
 * @example
 * ```typescript
 * @McpTool({
 *   name: 'create_building',
 *   description: 'Creates a new building',
 *   requiredScopes: ['building:write'],
 *   rateLimit: { max: 10, window: '1m' }
 * })
 * async createBuilding(
 *   @McpParam(CreateBuildingSchema) params: z.infer<typeof CreateBuildingSchema>,
 *   @McpContext() context: McpContext
 * ) {
 *   return this.service.createBuilding(context.userId, params);
 * }
 * ```
 */
export function McpTool(options: McpToolOptions): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    if (!options.name || !options.description) {
      throw new Error(
        `@McpTool decorator requires 'name' and 'description' options. Found on ${target.constructor.name}.${String(propertyKey)}`
      );
    }

    const methodName = String(propertyKey);
    const metadata: ToolMethodMetadata = {
      ...options,
      methodName,
      target,
    };

    // Store metadata on the method
    Reflect.defineMetadata(MCP_TOOL_METADATA_KEY, metadata, target, propertyKey);

    // Also store in a map of all tool methods on the class
    const existingMethods: ToolMethodMetadata[] =
      Reflect.getMetadata(MCP_TOOL_METHODS_METADATA_KEY, target) || [];
    existingMethods.push(metadata);
    Reflect.defineMetadata(MCP_TOOL_METHODS_METADATA_KEY, existingMethods, target);
  };
}

/**
 * Gets the tool metadata for a specific method.
 * @internal
 */
export function getToolMetadata(
  target: any,
  propertyKey: string | symbol
): ToolMethodMetadata | undefined {
  return Reflect.getMetadata(MCP_TOOL_METADATA_KEY, target, propertyKey);
}

/**
 * Gets all tool methods from a class.
 * @internal
 */
export function getToolMethods(target: any): ToolMethodMetadata[] {
  return Reflect.getMetadata(MCP_TOOL_METHODS_METADATA_KEY, target) || [];
}

/**
 * Checks if a method is decorated with @McpTool.
 * @internal
 */
export function isToolMethod(target: any, propertyKey: string | symbol): boolean {
  return Reflect.hasMetadata(MCP_TOOL_METADATA_KEY, target, propertyKey);
}
