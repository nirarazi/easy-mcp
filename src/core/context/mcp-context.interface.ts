/**
 * Context information available to MCP tools during execution.
 * This context is extracted from the request (headers, auth tokens, etc.)
 * and made available to tools via the @McpContext() decorator.
 */
export interface McpContext {
  /** User ID from authentication token or request */
  userId?: string;
  
  /** User scopes/permissions from authentication */
  scopes?: string[];
  
  /** Building IDs or other resource identifiers the user has access to */
  buildingIds?: string[];
  
  /** Session ID for tracking requests */
  sessionId?: string;
  
  /** Request metadata (IP, user agent, etc.) */
  metadata?: {
    ip?: string;
    userAgent?: string;
    [key: string]: any;
  };
  
  /** Additional custom context data */
  [key: string]: any;
}

