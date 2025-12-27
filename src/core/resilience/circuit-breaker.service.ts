import { Injectable } from "@nestjs/common";
import {
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitState,
} from "./circuit-breaker.interface";
import { logger } from "../utils/logger.util";

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  errorThreshold: 0.5, // 50% error rate
  timeWindow: 60000, // 1 minute
  minRequests: 10,
  halfOpenTimeout: 30000, // 30 seconds
};

/**
 * Service for circuit breaker pattern implementation.
 */
@Injectable()
export class CircuitBreakerService {
  private circuits = new Map<string, CircuitBreakerState>();
  private configs = new Map<string, CircuitBreakerConfig>();

  /**
   * Gets or creates circuit breaker state for a tool.
   */
  private getCircuit(toolName: string, config?: CircuitBreakerConfig): CircuitBreakerState {
    if (!this.circuits.has(toolName)) {
      this.circuits.set(toolName, {
        state: "closed",
        failures: 0,
        successes: 0,
      });
      this.configs.set(toolName, config || DEFAULT_CONFIG);
    }
    return this.circuits.get(toolName)!;
  }

  /**
   * Checks if circuit is open (should reject request).
   */
  isOpen(toolName: string, config?: CircuitBreakerConfig): boolean {
    const circuit = this.getCircuit(toolName, config);
    const now = Date.now();

    // Check if we should transition from half-open to open
    if (circuit.state === "half-open" && circuit.nextAttemptTime && now < circuit.nextAttemptTime) {
      return false; // Allow request in half-open state
    }

    // Check if we should transition from open to half-open
    if (circuit.state === "open") {
      const cfg = this.configs.get(toolName) || config || DEFAULT_CONFIG;
      if (circuit.nextAttemptTime && now >= circuit.nextAttemptTime) {
        circuit.state = "half-open";
        circuit.failures = 0;
        circuit.successes = 0;
        logger.info("CircuitBreakerService", `Circuit half-open for ${toolName}`, {
          component: "Resilience",
          toolName,
        });
        return false; // Allow request in half-open state
      }
      return true; // Reject request in open state
    }

    return false; // Allow request in closed or half-open state
  }

  /**
   * Records a successful execution.
   */
  recordSuccess(toolName: string): void {
    const circuit = this.getCircuit(toolName);
    circuit.successes++;
    circuit.lastSuccessTime = Date.now();

    // If in half-open state and we have a success, close the circuit
    if (circuit.state === "half-open") {
      circuit.state = "closed";
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.nextAttemptTime = undefined;
      logger.info("CircuitBreakerService", `Circuit closed for ${toolName}`, {
        component: "Resilience",
        toolName,
      });
    }
  }

  /**
   * Records a failed execution.
   */
  recordFailure(toolName: string): void {
    const circuit = this.getCircuit(toolName);
    const config = this.configs.get(toolName) || DEFAULT_CONFIG;
    circuit.failures++;
    circuit.lastFailureTime = Date.now();

    const total = circuit.failures + circuit.successes;
    const errorRate = circuit.failures / total;

    // Check if we should open the circuit
    if (
      circuit.state === "closed" &&
      total >= config.minRequests &&
      errorRate >= config.errorThreshold
    ) {
      circuit.state = "open";
      circuit.nextAttemptTime = Date.now() + config.halfOpenTimeout;
      logger.warn("CircuitBreakerService", `Circuit opened for ${toolName}`, {
        component: "Resilience",
        toolName,
        errorRate,
        failures: circuit.failures,
        total,
      });
    } else if (circuit.state === "half-open") {
      // If we fail in half-open state, go back to open
      circuit.state = "open";
      circuit.nextAttemptTime = Date.now() + config.halfOpenTimeout;
      logger.warn("CircuitBreakerService", `Circuit re-opened for ${toolName}`, {
        component: "Resilience",
        toolName,
      });
    }
  }

  /**
   * Gets circuit state for a tool.
   */
  getState(toolName: string): CircuitState {
    const circuit = this.getCircuit(toolName);
    return circuit.state;
  }

  /**
   * Resets circuit breaker for a tool (useful for testing).
   */
  reset(toolName?: string): void {
    if (toolName) {
      this.circuits.delete(toolName);
      this.configs.delete(toolName);
    } else {
      this.circuits.clear();
      this.configs.clear();
    }
  }
}

