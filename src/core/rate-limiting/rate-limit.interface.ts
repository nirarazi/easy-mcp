import { RateLimitConfig } from "../../decorators/mcp-tool.decorator";

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

