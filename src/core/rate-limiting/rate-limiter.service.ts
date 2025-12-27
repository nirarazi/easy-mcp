import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { RateLimitConfig, RateLimitResult, RateLimitEntry } from "./rate-limit.interface";
import { logger } from "../utils/logger.util";
import { sanitizeActorId } from "../utils/sanitize.util";

/**
 * Parses time window string (e.g., '1m', '60s', '1h') to milliseconds
 * Returns a default value if parsing fails to prevent crashes
 */
function parseTimeWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/);
  if (!match) {
    logger.warn("RateLimiterService", `Invalid time window format: ${window}. Using default 1 minute`, {
      component: "RateLimiter",
      invalidWindow: window,
    });
    // Return default 1 minute window instead of throwing
    return 60 * 1000;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (isNaN(value) || value <= 0) {
    logger.warn("RateLimiterService", `Invalid time window value: ${value}. Using default 1 minute`, {
      component: "RateLimiter",
      invalidValue: value,
    });
    return 60 * 1000;
  }

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const multiplier = multipliers[unit];
  if (!multiplier) {
    logger.warn("RateLimiterService", `Invalid time window unit: ${unit}. Using default 1 minute`, {
      component: "RateLimiter",
      invalidUnit: unit,
    });
    return 60 * 1000;
  }

  return value * multiplier;
}

/**
 * Service for rate limiting tool executions.
 */
@Injectable()
export class RateLimiterService implements OnModuleInit, OnModuleDestroy {
  private rateLimiters = new Map<string, Map<string, RateLimitEntry>>();
  private cleanupInterval?: NodeJS.Timeout;
  // Maximum number of entries per tool to prevent unbounded memory growth
  private static readonly MAX_ENTRIES_PER_TOOL = 10000;
  // Cleanup interval in milliseconds (5 minutes)
  private static readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

  /**
   * Called when the module is initialized.
   * Starts automatic cleanup of expired rate limit entries.
   */
  onModuleInit() {
    // Start periodic cleanup to prevent memory exhaustion
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, RateLimiterService.CLEANUP_INTERVAL_MS);
  }

  /**
   * Called when the module is destroyed.
   * Stops the cleanup interval.
   */
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Checks if a request is allowed based on rate limit configuration.
   */
  checkRateLimit(
    toolName: string,
    identifier: string,
    config: RateLimitConfig
  ): RateLimitResult {
    try {
      const windowMs = parseTimeWindow(config.window);
      const now = Date.now();

      // Get or create rate limiter for this tool
      if (!this.rateLimiters.has(toolName)) {
        this.rateLimiters.set(toolName, new Map());
      }
      const toolLimiter = this.rateLimiters.get(toolName)!;

      // Prevent unbounded memory growth by limiting entries per tool
      if (toolLimiter.size >= RateLimiterService.MAX_ENTRIES_PER_TOOL) {
        // Clean up oldest entries (expired first, then by resetTime)
        const entries = Array.from(toolLimiter.entries());
        const expired = entries.filter(([, entry]) => entry.resetTime < now);
        if (expired.length > 0) {
          // Remove expired entries
          expired.forEach(([id]) => toolLimiter.delete(id));
        } else {
          // If no expired entries, remove oldest 10% to make room
          const sorted = entries.sort(([, a], [, b]) => a.resetTime - b.resetTime);
          const toRemove = Math.floor(sorted.length * 0.1);
          sorted.slice(0, toRemove).forEach(([id]) => toolLimiter.delete(id));
        }
      }

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
    } catch (error) {
      // Defensive error handling: if rate limiting fails, fail closed (deny the request)
      // This is more secure than failing open, as it prevents bypassing rate limits
      // Log the error for investigation with sanitized identifier to prevent PII exposure
      logger.error("RateLimiterService", "Rate limit check failed", {
        component: "RateLimiter",
        toolName: sanitizeActorId(toolName),
        identifier: sanitizeActorId(identifier),
        error: error instanceof Error ? error.message : String(error),
      });
      // Fail closed: deny the request if rate limiting fails
      // This prevents bypassing rate limits due to internal errors
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000, // Default 1 minute window
      };
    }
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
