import { NestFactory } from "@nestjs/core";
import { INestApplicationContext } from "@nestjs/common";
import { AppModule } from "./app.module";
import { McpConfig } from "./config/mcp-config.interface";
import { CONFIG_TOKEN } from "./config/constants";
import { McpServerService } from "./core/mcp-server/mcp-server.service"; // Assuming this service is the entry point
import { ConfigHolderService } from "./config/config-holder.service";
import { ConfigValidator } from "./config/config-validator";
import { ToolRegistryService } from "./tooling/tool-registry/tool-registry.service";
import { ResourceRegistryService } from "./resources/resource-registry.service";
import { PromptRegistryService } from "./prompts/prompt-registry.service";
import { logger } from "./core/utils/logger.util";
import { sanitizeErrorMessage, sanitizeUri, sanitizeName } from "./core/utils/sanitize.util";
import { NestjsStderrLogger } from "./core/utils/nestjs-stderr-logger";

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
      logger.warn("EasyMCP", "EasyMCP is already initialized", {
        component: "EasyMCP",
      });
      return;
    }

    // 0. Validate configuration before proceeding
    ConfigValidator.validate(config);

    // 1. Create the NestJS application context
    // Use custom stderr logger to redirect NestJS logs to stderr for MCP protocol compliance
    // This allows NestJS framework logs while preventing stdout pollution
    const moduleRef = await NestFactory.createApplicationContext(AppModule, {
      logger: new NestjsStderrLogger(), // Use custom logger to redirect NestJS logs to stderr
    });
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
          const sanitizedToolName = sanitizeName(tool.name);
          // Log detailed error internally for debugging
          logger.error("EasyMCP", "Failed to register tool", {
            component: "EasyMCP",
            toolName: sanitizedToolName,
            error: sanitizeErrorMessage(error),
          });
          // Return generic error message to prevent leaking internal details
          throw new Error(`Failed to register tool '${sanitizedToolName}'`);
        }
      }
      logger.info("EasyMCP", `Registered ${config.tools.length} tool(s) from configuration`, {
        component: "EasyMCP",
        toolCount: config.tools.length,
      });
    }

    // 4. Auto-register resources from config
    if (config.resources && config.resources.length > 0) {
      const resourceRegistry = moduleRef.get<ResourceRegistryService>(ResourceRegistryService);
      for (const resource of config.resources) {
        try {
          resourceRegistry.registerResourceFromConfig(resource);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const sanitizedUri = sanitizeUri(resource.uri);
          // Log detailed error internally for debugging
          logger.error("EasyMCP", "Failed to register resource", {
            component: "EasyMCP",
            uri: sanitizedUri,
            error: sanitizeErrorMessage(error),
          });
          // Return generic error message to prevent leaking internal details
          throw new Error(`Failed to register resource '${sanitizedUri}'`);
        }
      }
      logger.info("EasyMCP", `Registered ${config.resources.length} resource(s) from configuration`, {
        component: "EasyMCP",
        resourceCount: config.resources.length,
      });
    }

    // 5. Auto-register prompts from config
    if (config.prompts && config.prompts.length > 0) {
      const promptRegistry = moduleRef.get<PromptRegistryService>(PromptRegistryService);
      for (const prompt of config.prompts) {
        try {
          promptRegistry.registerPromptFromConfig(prompt);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const sanitizedPromptName = sanitizeName(prompt.name);
          // Log detailed error internally for debugging
          logger.error("EasyMCP", "Failed to register prompt", {
            component: "EasyMCP",
            promptName: sanitizedPromptName,
            error: sanitizeErrorMessage(error),
          });
          // Return generic error message to prevent leaking internal details
          throw new Error(`Failed to register prompt '${sanitizedPromptName}'`);
        }
      }
      logger.info("EasyMCP", `Registered ${config.prompts.length} prompt(s) from configuration`, {
        component: "EasyMCP",
        promptCount: config.prompts.length,
      });
    }

    logger.info("EasyMCP", "EasyMCP Framework initialized successfully", {
      component: "EasyMCP",
    });
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

    logger.info("EasyMCP", "Starting EasyMCP core services", {
      component: "EasyMCP",
    });

    try {
      // Retrieve the central orchestration service (Layer 3: Abstraction Core)
      const mcpServer = this.app.get(McpServerService);

      // Start listening for JSON-RPC requests via stdio
      await mcpServer.startListening();

      logger.info("EasyMCP", "EasyMCP core services are now running and listening for JSON-RPC requests via stdio", {
        component: "EasyMCP",
      });
    } catch (error) {
      logger.error("EasyMCP", "Failed to start EasyMCP core services", {
        component: "EasyMCP",
        error: sanitizeErrorMessage(error),
      });
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
      logger.warn("EasyMCP", "EasyMCP is not initialized. Nothing to shutdown", {
        component: "EasyMCP",
      });
      return;
    }

    logger.info("EasyMCP", "Shutting down EasyMCP framework", {
      component: "EasyMCP",
    });

    try {
      await this.app.close();
      this.app = null as any; // Clear the reference
      logger.info("EasyMCP", "EasyMCP framework shut down successfully", {
        component: "EasyMCP",
      });
    } catch (error) {
      logger.error("EasyMCP", "Error during EasyMCP shutdown", {
        component: "EasyMCP",
        error: sanitizeErrorMessage(error),
      });
      throw error;
    }
  }
}
