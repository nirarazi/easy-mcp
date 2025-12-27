import { Injectable } from "@nestjs/common";
import { OAuthProviderConfig, OAuthTokenValidator, OAuthContextExtractor } from "./oauth-config.interface";
import { McpContext } from "../../core/context/mcp-context.interface";
import { logger } from "../../core/utils/logger.util";
import { sanitizeErrorMessage } from "../../core/utils/sanitize.util";

/**
 * Service for OAuth token validation and context extraction.
 */
@Injectable()
export class OAuthProviderService {
  private config: OAuthProviderConfig | null = null;

  /**
   * Sets the OAuth provider configuration.
   */
  setConfig(config: OAuthProviderConfig): void {
    this.config = config;
    logger.info("OAuthProviderService", `OAuth provider configured: ${config.provider}`, {
      component: "OAuth",
    });
  }

  /**
   * Validates an OAuth token and extracts context.
   * @param token The OAuth token to validate
   * @returns The extracted context
   * @throws Error if token is invalid
   */
  async validateAndExtractContext(token: string): Promise<McpContext> {
    if (!this.config) {
      throw new Error("OAuth provider not configured");
    }

    try {
      // Validate token
      const payload = await this.config.validateToken(token);

      // Extract context from payload
      const context = this.config.extractContext(payload);

      logger.debug("OAuthProviderService", "Token validated and context extracted", {
        component: "OAuth",
        // Do not log userId (PII) in production logs
      });

      return context;
    } catch (error) {
      logger.error("OAuthProviderService", "Token validation failed", {
        component: "OAuth",
        error: sanitizeErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Extracts token from request (default: Authorization header).
   */
  extractTokenFromRequest(req: any): string | null {
    if (!this.config) {
      return null;
    }

    // Use custom extractor if provided
    if (this.config.extractToken) {
      return this.config.extractToken(req);
    }

    // Default: extract from Authorization header using req.get() to handle header variations
    const authHeader = req.get?.("Authorization") || req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader) {
      return null;
    }

    // Support "Bearer <token>" format - ensure it's properly formatted
    const parts = String(authHeader).split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      return parts[1];
    }

    // If not Bearer format, return null for security
    return null;
  }
}
