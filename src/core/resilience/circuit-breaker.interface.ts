/**
 * Circuit breaker state
 */
export type CircuitState = "closed" | "open" | "half-open";

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Error threshold (0.0 to 1.0) */
  errorThreshold: number;
  /** Time window in milliseconds */
  timeWindow: number;
  /** Minimum requests before opening circuit */
  minRequests: number;
  /** Timeout before attempting half-open (milliseconds) */
  halfOpenTimeout: number;
}

/**
 * Circuit breaker state
 */
export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  nextAttemptTime?: number;
}

