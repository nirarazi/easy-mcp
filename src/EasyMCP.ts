import { NestFactory } from "@nestjs/core";
import { INestApplicationContext } from "@nestjs/common";
import { AppModule } from "./app.module";
import { McpConfig } from "./config/mcp-config.interface";
import { CONFIG_TOKEN } from "./config/constants";
import { McpServerService } from "./core/mcp-server/mcp-server.service"; // Assuming this service is the entry point
import { ConfigHolderService } from "./config/config-holder.service";

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

    // 1. Create the NestJS application context
    const moduleRef = await NestFactory.createApplicationContext(AppModule);
    this.app = moduleRef;

    // 2. Inject the runtime configuration object into the application context
    // Retrieve the ConfigHolderService using its token and assert its type
    const configHolder = moduleRef.get<ConfigHolderService>(CONFIG_TOKEN);
    configHolder.setConfig(config);

    console.log("EasyMCP Framework initialized successfully.");
  }

  /**
   * Starts the core logic of the Easy MCP Framework.
   * This typically involves starting the layer that handles incoming messages (Layer 1/3).
   * * FIX: Defined as a static method to resolve the TS2339 error in src/main.ts.
   */
  public static async run(): Promise<void> {
    if (!this.app) {
      throw new Error(
        "EasyMCP is not initialized. Call EasyMCP.initialize() first.",
      );
    }

    console.log("Starting EasyMCP core services...");

    try {
      // Retrieve the central orchestration service (Layer 3: Abstraction Core)
      // Assuming McpServerService is the main entry point for protocol handling
      const mcpServer = this.app.get(McpServerService);

      // Assume the main service has a method to start listening for client messages
      // This is where the WebSocket or HTTP listener would typically be initialized.
      // Replace with your actual startup method if it differs.
      await mcpServer.startListening();

      console.log(
        "EasyMCP core services are now running and listening for client connections.",
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
}
