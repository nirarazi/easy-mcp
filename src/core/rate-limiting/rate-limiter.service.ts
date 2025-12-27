import { Injectable } from "@nestjs/common";
import { RateLimitConfig, RateLimitResult, RateLimitEntry } from "./rate-limit.interface";
import { logger } from "../utils/logger.util";

/**
 * Parses time window string (e.g., '1m', '60s', '1h') to milliseconds
 */
function parseTimeWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid time window format: ${window}. Expected format: '1m', '60s', '1h'`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

/**
 * Service for rate limiting tool executions.
 */
@Injectable()
export class RateLimiterService {
  private rateLimiters = new Map<string, Map<string, RateLimitEntry>>();

  /**
   * Checks if a request is allowed based on rate limit configuration.
   */
  checkRateLimit(
    toolName: string,
    identifier: string,
    config: RateLimitConfig
  ): RateLimitResult {
    const windowMs = parseTimeWindow(config.window);
    const now = Date.now();

    // Get or create rate limiter for this tool
    if (!this.rateLimiters.has(toolName)) {
      this.rateLimiters.set(toolName, new Map());
    }
    const toolLimiter = this.rateLimiters.get(toolName)!;

    // Get or create entry for this identifier
    let entry = toolLimiter.get(identifier);
    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired entry
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      toolLimiter.set(identifier, entry);
    }

    // Check if limit exceeded
    if (entry.count >= config.max) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment count
    entry.count++;

    return {
      allowed: true,
      remaining: config.max - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Cleans up expired rate limit entries.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [toolName, toolLimiter] of this.rateLimiters.entries()) {
      for (const [identifier, entry] of toolLimiter.entries()) {
        if (entry.resetTime < now) {
          toolLimiter.delete(identifier);
        }
      }
      if (toolLimiter.size === 0) {
        this.rateLimiters.delete(toolName);
      }
    }
  }

  /**
   * Resets rate limits for a tool (useful for testing).
   */
  reset(toolName?: string): void {
    if (toolName) {
      this.rateLimiters.delete(toolName);
    } else {
      this.rateLimiters.clear();
    }
  }
}
