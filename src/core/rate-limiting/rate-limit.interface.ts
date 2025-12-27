import { RateLimitConfig } from "../../decorators/mcp-tool.decorator";

/**
 * Re-export RateLimitConfig for use in rate limiting services
 */
export type { RateLimitConfig };

/**
 * Rate limit entry tracking
 */
export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}
