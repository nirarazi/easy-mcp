import { Router, Request, Response, json } from "express";
import { MAX_MESSAGE_SIZE_BYTES } from "../../config/constants";
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
import { sanitizeErrorMessage } from "../../core/utils/sanitize.util";
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
    // If it's a class constructor, it should be registered as a NestJS provider
    // For now, we require ToolRegistrationInput format for the express adapter
    // Class-based tools should be registered via NestJS modules
    if (typeof tool === "function") {
      throw new Error("Class-based tools are not directly supported in createMcpExpressRouter. Please convert them to ToolRegistrationInput format or register them via NestJS modules.");
    }
    // Otherwise, it's an invalid format
    throw new Error("Tools must be in ToolRegistrationInput format or a class constructor. Use the config-based or decorator-based approach.");
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
    if (mcpServerService) {
      httpGateway.setMcpServerService(mcpServerService);
    }
  })();

  // Middleware to ensure initialization
  router.use(async (req: Request, res: Response, next) => {
    try {
      await initPromise;
      next();
    } catch (error) {
      logger.error("ExpressAdapter", "Failed to initialize EasyMCP", {
        error: sanitizeErrorMessage(error),
      });
      res.status(500).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal error",
        },
      });
    }
  });

  // Auth middleware (if provided, takes precedence over OAuth)
  if (options.auth) {
    router.use(options.auth);
  } else if (options.oauth) {
    // OAuth configuration (only if auth middleware is not provided)
    const oauthProvider = new OAuthProviderService();
    oauthProvider.setConfig(options.oauth);
    router.use(createOAuthMiddleware(oauthProvider));
  }

  // Extract context from request (helper function)
  // Security: Only trust context set by auth middleware when auth is configured
  // Headers are never trusted when auth middleware is configured to prevent spoofing
  const extractContext = (req: Request): McpContext | undefined => {
    // Extract from request (set by auth middleware) - this is always trusted
    if ((req as any).mcpContext) {
      return (req as any).mcpContext as McpContext;
    }

    // If auth middleware is configured, only trust mcpContext set by middleware
    // Do not fall back to headers to prevent spoofing if middleware fails silently
    if (options.auth || options.oauth) {
      return undefined;
    }

    // Only extract from headers if NO auth middleware is configured
    // SECURITY WARNING: This is for development/testing scenarios only
    // Headers are not authenticated and can be spoofed by clients
    // Do NOT use this in production without proper authentication middleware
    const context: Partial<McpContext> = {};
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

    if (Object.keys(context).length > 0) {
      // Log warning when using unauthenticated headers (dev mode only)
      logger.warn("ExpressAdapter", "Using unauthenticated headers for context extraction", {
        component: "ExpressAdapter",
        warning: "Headers are not authenticated and can be spoofed. Use auth middleware in production.",
      });
      return context as McpContext;
    }

    return undefined;
  };

  // Main JSON-RPC endpoint
  // Configure body parser with size limit to prevent DoS
  router.post("/", json({ limit: MAX_MESSAGE_SIZE_BYTES }), async (req: Request, res: Response) => {
    if (!httpGateway || !mcpServerService) {
      res.status(500).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal error",
        },
      });
      return;
    }

    const context = extractContext(req);
    await httpGateway.handleHttpRequest(req, res, context);
  });

  // Health check endpoints
  router.get(`${pathPrefix}/health`, (req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "mcp-server",
      version: config.serverInfo?.version || "unknown",
    });
  });

  router.get(`${pathPrefix}/health/ready`, (req: Request, res: Response) => {
    // Basic readiness check - server is ready if it has tools
    const ready = tools.length > 0;
    res.status(ready ? 200 : 503).json({ ready });
  });

  router.get(`${pathPrefix}/health/live`, (req: Request, res: Response) => {
    res.status(200).json({ alive: true });
  });

  // Metrics endpoint (Prometheus format)
  router.get(`${pathPrefix}/metrics`, (req: Request, res: Response) => {
    res.status(200).set("Content-Type", "text/plain").send("# Metrics endpoint - implement with MetricsService");
  });

  return router;
}
