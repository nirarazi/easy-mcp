import { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { EasyMCP } from "../EasyMCP";
import { McpConfig, ToolRegistrationInput } from "../config/mcp-config.interface";
import { ToolRegistryService } from "../tooling/tool-registry/tool-registry.service";
import { McpContext } from "../core/context/mcp-context.interface";
import { CancellationToken } from "../tooling/tool.interface";
import { mockMcpContext } from "./mock-context";

/**
 * Test MCP application for testing tools.
 */
export class McpTestApp {
  private app: INestApplicationContext;
  private toolRegistry: ToolRegistryService;

  constructor(app: INestApplicationContext) {
    this.app = app;
    this.toolRegistry = app.get(ToolRegistryService);
  }

  /**
   * Calls a tool by name with parameters and optional context.
   *
   * @example
   * ```typescript
   * const app = await createMcpTestApp([myTool]);
   * const result = await app.callTool('create_building', { name: 'Test' }, context);
   * ```
   */
  async callTool(
    name: string,
    params: Record<string, any>,
    context?: McpContext,
    cancellationToken?: CancellationToken
  ): Promise<any> {
    return this.toolRegistry.executeTool(name, params, cancellationToken, context);
  }

  /**
   * Gets the tool registry service.
   */
  getToolRegistry(): ToolRegistryService {
    return this.toolRegistry;
  }

  /**
   * Gets a service from the application context.
   */
  getService<T>(token: string | symbol): T {
    return this.app.get<T>(token);
  }

  /**
   * Closes the test application.
   */
  async close(): Promise<void> {
    await this.app.close();
  }
}

/**
 * Creates a test MCP application for testing tools.
 *
 * @example
 * ```typescript
 * import { createMcpTestApp, mockMcpContext } from 'easy-mcp-nest/testing';
 *
 * const app = await createMcpTestApp([BuildingTools]);
 * const context = mockMcpContext({ userId: '123', scopes: [...] });
 * const result = await app.callTool('create_building', params, context);
 * await app.close();
 * ```
 */
export async function createMcpTestApp(
  tools: ToolRegistrationInput[],
  config?: Partial<McpConfig>
): Promise<McpTestApp> {
  const fullConfig: McpConfig = {
    tools,
    ...config,
  };

  await EasyMCP.initialize(fullConfig);
  const app = (EasyMCP as any).app as INestApplicationContext;

  return new McpTestApp(app);
}
