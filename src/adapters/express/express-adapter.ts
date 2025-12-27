import { Router, Request, Response, json } from "express";
import { NestFactory } from "@nestjs/core";
import { INestApplicationContext } from "@nestjs/common";
import { AppModule } from "../../app.module";
import { EasyMCP } from "../../EasyMCP";
import { McpConfig, ToolRegistrationInput } from "../../config/mcp-config.interface";
import { HttpGatewayService } from "./http-gateway.service";
import { INTERFACE_LAYER_TOKEN } from "../../config/constants";
import { CreateMcpExpressRouterOptions } from "./types";
import { McpContext } from "../../core/context/mcp-context.interface";
import { logger } from "../../core/utils/logger.util";
import { McpServerService } from "../../core/mcp-server/mcp-server.service";
import { OAuthProviderService } from "../../auth/oauth/oauth-provider.service";
import { createOAuthMiddleware } from "../../auth/oauth/oauth-middleware";

/**
 * Creates an Express router for MCP protocol over HTTP.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createMcpExpressRouter } from 'easy-mcp-nest/adapters/express';
 *
 * const app = express();
 * app.use(express.json());
 *
 * const mcpRouter = createMcpExpressRouter({
 *   tools: [BuildingTools, PaymentTools],
 *   resources: [BuildingResources],
 *   auth: mcpAuthMiddleware,
 * });
 *
 * app.use('/mcp', mcpRouter);
 * app.listen(3000);
 * ```
 */
export function createMcpExpressRouter(
  options: CreateMcpExpressRouterOptions
): Router {
  const router = Router();
  const pathPrefix = options.pathPrefix || "/mcp";

  // Convert tools to ToolRegistrationInput format if needed
  const tools: ToolRegistrationInput[] = (options.tools || []).map((tool) => {
    // If it's already a ToolRegistrationInput, use it
    if (tool && typeof tool === "object" && "name" in tool && "function" in tool) {
      return tool as ToolRegistrationInput;
    }
    // Otherwise, assume it's a class and needs to be converted
    // For now, we'll require ToolRegistrationInput format
    throw new Error("Tools must be in ToolRegistrationInput format. Use the config-based approach.");
  });

  // Initialize EasyMCP with provided configuration
  const config: McpConfig = {
    tools,
    resources: options.resources || [],
    prompts: options.prompts || [],
    serverInfo: options.serverInfo,
  };

  // Create a promise to initialize EasyMCP and get services
  let mcpServerService: McpServerService | null = null;
  let httpGateway: HttpGatewayService | null = null;

  const initPromise = (async () => {
    await EasyMCP.initialize(config);
    const appContext = (EasyMCP as any).app as INestApplicationContext;

    // Get McpServerService
    mcpServerService = appContext.get(McpServerService);

    // Create HttpGatewayService and inject McpServerService
    httpGateway = new HttpGatewayService();
    httpGateway.setMcpServerService(mcpServerService);
  })();

  // Middleware to ensure initialization
  router.use(async (req: Request, res: Response, next) => {
    try {
      await initPromise;
      next();
    } catch (error) {
      logger.error("ExpressAdapter", "Failed to initialize EasyMCP", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal error: Failed to initialize MCP server",
        },
      });
    }
  });

  // OAuth configuration (if provided)
  let oauthProvider: OAuthProviderService | null = null;
  if (options.oauth) {
    oauthProvider = new OAuthProviderService();
    oauthProvider.setConfig(options.oauth);
    router.use(createOAuthMiddleware(oauthProvider));
  }

  // Auth middleware (if provided, takes precedence over OAuth)
  if (options.auth) {
    router.use(options.auth);
  }

  // Extract context from request (helper function)
  const extractContext = (req: Request): McpContext | undefined => {
    const context: Partial<McpContext> = {};

    // Extract from request (set by auth middleware)
    if ((req as any).mcpContext) {
      return (req as any).mcpContext as McpContext;
    }

    // Try to extract from headers
    if (req.headers["x-user-id"]) {
      context.userId = String(req.headers["x-user-id"]);
    }
    if (req.headers["x-scopes"]) {
      const scopes = req.headers["x-scopes"];
      context.scopes = Array.isArray(scopes)
        ? scopes.map(String)
        : String(scopes).split(",").map(s => s.trim());
    }
    if (req.headers["x-building-ids"]) {
      const buildingIds = req.headers["x-building-ids"];
      context.buildingIds = Array.isArray(buildingIds)
        ? buildingIds.map(String)
        : String(buildingIds).split(",").map(s => s.trim());
    }

    return Object.keys(context).length > 0 ? (context as McpContext) : undefined;
  };

  // Main JSON-RPC endpoint
  router.post("/", json(), async (req: Request, res: Response) => {
    if (!httpGateway || !mcpServerService) {
      res.status(500).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal error: MCP server not initialized",
        },
      });
      return;
    }

    const context = extractContext(req);
    await httpGateway.handleHttpRequest(req, res, context);
  });

  // Health check endpoint
  router.get(`${pathPrefix}/health`, (req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "mcp-server",
      version: config.serverInfo?.version || "unknown",
    });
  });

  return router;
}
