import { Request, Response, NextFunction } from "express";
import { OAuthProviderService } from "./oauth-provider.service";
import { McpContext } from "../../core/context/mcp-context.interface";
import { logger } from "../../core/utils/logger.util";
import { sanitizeErrorMessage } from "../../core/utils/sanitize.util";

/**
 * Creates Express middleware for OAuth token validation.
 * Validates tokens and attaches context to request.
 *
 * @example
 * ```typescript
 * import { createOAuthMiddleware } from 'easy-mcp-nest/auth/oauth';
 *
 * const oauthMiddleware = createOAuthMiddleware(oauthProviderService);
 * app.use('/mcp', oauthMiddleware, mcpRouter);
 * ```
 */
export function createOAuthMiddleware(
  oauthProvider: OAuthProviderService
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract token from request
      const token = oauthProvider.extractTokenFromRequest(req);

      if (!token) {
        res.status(401).json({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32000,
            message: "Unauthorized: No token provided",
          },
        });
        return;
      }

      // Validate token and extract context
      const context = await oauthProvider.validateAndExtractContext(token);

      // Attach context to request for use in MCP handlers
      (req as any).mcpContext = context;

      next();
    } catch (error) {
      logger.error("OAuthMiddleware", "Token validation failed", {
        error: sanitizeErrorMessage(error),
      });

      res.status(401).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: "Unauthorized: Invalid token",
        },
      });
    }
  };
}
