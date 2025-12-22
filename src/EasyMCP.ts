import { NestFactory } from "@nestjs/core";
import { INestApplicationContext } from "@nestjs/common";
import { AppModule } from "./app.module";
import { McpConfig } from "./config/mcp-config.interface";
import { CONFIG_TOKEN } from "./config/constants";
import { McpServerService } from "./core/mcp-server/mcp-server.service"; // Assuming this service is the entry point
import { ConfigHolderService } from "./config/config-holder.service";
import { ConfigValidator } from "./config/config-validator";
import { ToolRegistryService } from "./tooling/tool-registry/tool-registry.service";

// Ensure all classes used within EasyMCP are correctly exported in their respective files.

export class EasyMCP {
  private static app: INestApplicationContext;

  /**
   * Initializes the Easy MCP Framework by creating the NestJS application context
   * and injecting the runtime configuration.
   * @param config The full McpConfig object.
   */
  public static async initialize(config: McpConfig): Promise<void> {
    if (this.app) {
      console.warn("EasyMCP is already initialized.");
      return;
    }

    // 0. Validate configuration before proceeding
    ConfigValidator.validate(config);

    // 1. Create the NestJS application context
    const moduleRef = await NestFactory.createApplicationContext(AppModule);
    this.app = moduleRef;

    // 2. Inject the runtime configuration object into the application context
    // Retrieve the ConfigHolderService using its token and assert its type
    const configHolder = moduleRef.get<ConfigHolderService>(CONFIG_TOKEN);
    configHolder.setConfig(config);

    // 3. Auto-register tools from config
    if (config.tools && config.tools.length > 0) {
      const toolRegistry = moduleRef.get<ToolRegistryService>(ToolRegistryService);
      for (const tool of config.tools) {
        try {
          toolRegistry.registerToolFromConfig(tool);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to register tool '${tool.name}': ${errorMessage}`);
        }
      }
      console.error(`Registered ${config.tools.length} tool(s) from configuration.`);
    }

    console.error("EasyMCP Framework initialized successfully.");
  }

  /**
   * Starts the core logic of the Easy MCP Framework.
   * This starts the stdio JSON-RPC server to handle MCP protocol requests.
   */
  public static async run(): Promise<void> {
    if (!this.app) {
      throw new Error(
        "EasyMCP is not initialized. Call EasyMCP.initialize() first.",
      );
    }

    console.error("Starting EasyMCP core services...");

    try {
      // Retrieve the central orchestration service (Layer 3: Abstraction Core)
      const mcpServer = this.app.get(McpServerService);

      // Start listening for JSON-RPC requests via stdio
      await mcpServer.startListening();

      console.error(
        "EasyMCP core services are now running and listening for JSON-RPC requests via stdio.",
      );
    } catch (error) {
      console.error("Failed to start EasyMCP core services:", error);
      // Optionally close the application context on failure
      await this.app.close();
      throw error;
    }
  }

  /**
   * Utility method to retrieve any service or provider from the application context.
   * @param token The class or token of the service to retrieve.
   */
  public static getService<T>(token: string | symbol): T {
    if (!this.app) {
      throw new Error("EasyMCP is not initialized.");
    }
    // NestJS uses the token/class to look up the provider
    return this.app.get<T>(token);
  }

  /**
   * Gracefully shuts down the EasyMCP framework.
   * Closes the NestJS application context and cleans up resources.
   * Should be called when the application is terminating (e.g., on SIGTERM, SIGINT).
   */
  public static async shutdown(): Promise<void> {
    if (!this.app) {
      console.warn("EasyMCP is not initialized. Nothing to shutdown.");
      return;
    }

    console.error("Shutting down EasyMCP framework...");

    try {
      await this.app.close();
      this.app = null as any; // Clear the reference
      console.error("EasyMCP framework shut down successfully.");
    } catch (error) {
      console.error("Error during EasyMCP shutdown:", error);
      throw error;
    }
  }
}
