import { Injectable } from "@nestjs/common";
import { RetryConfig } from "../../decorators/mcp-tool.decorator";
import { logger } from "../utils/logger.util";

/**
 * Service for retrying failed tool executions.
 */
@Injectable()
export class RetryService {
  /**
   * Executes a function with retry logic.
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig
  ): Promise<T> {
    let lastError: Error | undefined;
    const initialDelay = config.initialDelay || 100;
    const maxDelay = config.maxDelay || 10000;

    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on last attempt
        if (attempt === config.maxAttempts - 1) {
          throw lastError;
        }

        // Calculate delay based on backoff strategy
        const delay = this.calculateDelay(attempt, initialDelay, maxDelay, config.backoff);

        logger.debug("RetryService", `Retry attempt ${attempt + 1}/${config.maxAttempts}`, {
          component: "Resilience",
          attempt: attempt + 1,
          maxAttempts: config.maxAttempts,
          delay,
          error: lastError.message,
        });

        await this.sleep(delay);
      }
    }

    throw lastError || new Error("Retry failed");
  }

  /**
   * Calculates delay based on backoff strategy.
   */
  private calculateDelay(
    attempt: number,
    initialDelay: number,
    maxDelay: number,
    strategy: "exponential" | "linear" | "fixed"
  ): number {
    let delay: number;

    switch (strategy) {
      case "exponential":
        delay = initialDelay * Math.pow(2, attempt);
        break;
      case "linear":
        delay = initialDelay * (attempt + 1);
        break;
      case "fixed":
        delay = initialDelay;
        break;
      default:
        delay = initialDelay;
    }

    // Add jitter (random 0-20% of delay)
    const jitter = delay * 0.2 * Math.random();
    delay = delay + jitter;

    // Clamp to max delay
    return Math.min(delay, maxDelay);
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

