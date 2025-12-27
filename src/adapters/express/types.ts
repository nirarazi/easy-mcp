import { Request, Response, NextFunction } from "express";
import { McpContext } from "../../core/context/mcp-context.interface";
import { OAuthProviderConfig } from "../../auth/oauth/oauth-config.interface";

/**
 * Express middleware for extracting context from requests.
 * This middleware should extract user information from headers, auth tokens, etc.
 */
export type McpAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Options for creating an MCP Express router.
 */
export interface CreateMcpExpressRouterOptions {
  /** Array of tool classes or tool registration inputs */
  tools?: any[];

  /** Array of resource registration inputs */
  resources?: any[];

  /** Array of prompt registration inputs */
  prompts?: any[];

  /** Optional authentication middleware */
  auth?: McpAuthMiddleware;

  /** Optional OAuth configuration (alternative to auth middleware) */
  oauth?: OAuthProviderConfig;

  /** Optional server info */
  serverInfo?: {
    name: string;
    version: string;
  };

  /** Path prefix for MCP endpoints (default: '/mcp') */
  pathPrefix?: string;
}
