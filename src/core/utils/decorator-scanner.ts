import "reflect-metadata";
import { getToolMethods, ToolMethodMetadata } from "../../decorators/mcp-tool.decorator";
import { getParamSchema, getAllParamSchemas } from "../../decorators/mcp-param.decorator";
import { getContextParameterIndices } from "../../decorators/mcp-context.decorator";
import { getServiceFactories } from "../../decorators/mcp-service.decorator";
import { ToolDefinition, ToolFunction } from "../../tooling/tool.interface";
import { zodToJsonSchema } from "../../validation/zod-integration";
import { McpContext } from "../context/mcp-context.interface";
import { CancellationToken } from "../../tooling/tool.interface";
import { logger } from "./logger.util";

/**
 * Scans a class for @McpTool decorated methods and converts them to ToolDefinitions.
 * This enables automatic tool registration from decorator-based classes.
 *
 * @param targetClass The class constructor to scan
 * @param instance Optional instance of the class (if already instantiated)
 * @returns Array of ToolDefinitions discovered from the class
 */
export function scanClassForTools(
  targetClass: new (...args: any[]) => any,
  instance?: any
): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  const classInstance = instance || new targetClass();
  const toolMethods = getToolMethods(targetClass.prototype);

  for (const toolMetadata of toolMethods) {
    const methodName = toolMetadata.methodName;
    const method = classInstance[methodName];

    if (typeof method !== "function") {
      logger.warn("DecoratorScanner", `Method ${methodName} is not a function`, {
        component: "DecoratorScanner",
        className: targetClass.name,
        methodName,
      });
      continue;
    }

    // Get parameter schemas from @McpParam decorators
    const paramSchemasMap = getAllParamSchemas(classInstance, methodName);
    const contextParamIndices = getContextParameterIndices(classInstance, methodName);
    const serviceFactories = getServiceFactories(classInstance, methodName);

    // Build input schema from Zod schemas
    let inputSchema: ToolDefinition["inputSchema"] = {
      type: "object",
      properties: {},
      required: [],
    };

    // If we have parameter schemas, use the first one (typically the args parameter at index 0)
    if (paramSchemasMap.size > 0) {
      const firstSchema = paramSchemasMap.get(0);
      if (firstSchema) {
        const jsonSchema = zodToJsonSchema(firstSchema);
        if (jsonSchema.type === "object") {
          inputSchema = jsonSchema as ToolDefinition["inputSchema"];
        } else {
          // Wrap non-object schemas in an object
          inputSchema = {
            type: "object",
            properties: {
              value: jsonSchema,
            },
            required: ["value"],
          };
        }
      }
    }

    // Create the tool execution function
    const execute: ToolFunction = async (
      args: Record<string, any>,
      cancellationToken?: CancellationToken,
      context?: McpContext
    ) => {
      // Prepare method arguments
      const methodArgs: any[] = [];

      // Get the original method
      const originalMethod = classInstance[methodName].bind(classInstance);

      // Build arguments based on decorators
      // Handle @McpParam decorated parameters (typically at index 0)
      const paramSchemasArray = Array.from(paramSchemasMap.entries()).sort((a, b) => a[0] - b[0]);
      for (const [paramIndex, schema] of paramSchemasArray) {
        if (paramIndex === 0) {
          // First parameter is typically the args object
          methodArgs.push(args);
        } else {
          // For additional parameters, try to extract from args
          methodArgs.push(undefined);
        }
      }

      // Handle @McpContext decorated parameters
      for (const contextIndex of contextParamIndices) {
        // Ensure we have enough arguments
        while (methodArgs.length <= contextIndex) {
          methodArgs.push(undefined);
        }
        methodArgs[contextIndex] = context;
      }

      // Handle @McpService decorated parameters (factory injection)
      for (const factoryInfo of serviceFactories) {
        while (methodArgs.length <= factoryInfo.index) {
          methodArgs.push(undefined);
        }
        methodArgs[factoryInfo.index] = factoryInfo.factory();
      }

      // If no decorators were found, use default: args, cancellationToken, context
      if (methodArgs.length === 0) {
        methodArgs.push(args);
        if (cancellationToken) {
          methodArgs.push(cancellationToken);
        }
        if (context) {
          methodArgs.push(context);
        }
      }

      // Execute the method
      return await originalMethod(...methodArgs);
    };

    // Create tool definition
    const toolDefinition: ToolDefinition = {
      name: toolMetadata.name,
      description: toolMetadata.description,
      execute,
      inputSchema,
      icon: toolMetadata.icon,
      requiredScopes: toolMetadata.requiredScopes,
      rateLimit: toolMetadata.rateLimit,
      retry: toolMetadata.retry,
      version: toolMetadata.version,
    };

    tools.push(toolDefinition);
  }

  return tools;
}

/**
 * Scans multiple classes for tools and returns all discovered tools.
 *
 * @param classes Array of class constructors to scan
 * @param instances Optional map of class to instance (if already instantiated)
 * @returns Array of all ToolDefinitions discovered
 */
export function scanClassesForTools(
  classes: Array<new (...args: any[]) => any>,
  instances?: Map<new (...args: any[]) => any, any>
): ToolDefinition[] {
  const allTools: ToolDefinition[] = [];

  for (const targetClass of classes) {
    const instance = instances?.get(targetClass);
    const tools = scanClassForTools(targetClass, instance);
    allTools.push(...tools);
  }

  return allTools;
}

