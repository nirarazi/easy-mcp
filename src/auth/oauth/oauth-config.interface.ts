import { McpContext } from "../../core/context/mcp-context.interface";

/**
 * OAuth token validation function.
 * Should validate the token and return the decoded payload or throw an error.
 */
export type OAuthTokenValidator = (token: string) => Promise<any> | any;

/**
 * Function to extract context from OAuth token payload.
 * Converts OAuth payload to McpContext format.
 */
export type OAuthContextExtractor = (payload: any) => McpContext;

/**
 * OAuth provider configuration.
 */
export interface OAuthProviderConfig {
  /** Provider name (e.g., 'custom', 'google', 'auth0') */
  provider: string;

  /** Function to validate OAuth token */
  validateToken: OAuthTokenValidator;

  /** Function to extract context from token payload */
  extractContext: OAuthContextExtractor;

  /** Optional token extraction function (default: extracts from Authorization header) */
  extractToken?: (req: any) => string | null;
}

/**
 * OAuth configuration for MCP module.
 */
export interface OAuthConfig {
  /** OAuth provider configuration */
  oauth: OAuthProviderConfig;
}
