import { Injectable, Optional, Inject } from "@nestjs/common";
import { ToolRegistryService } from "../../tooling/tool-registry/tool-registry.service";
import { MetricsService } from "../observability/metrics.service";

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: "healthy" | "unhealthy" | "degraded";
  checks: {
    server: { status: string; uptime: number };
    tools: { status: string; count: number };
    metrics?: { status: string; activeRequests: number };
  };
  timestamp: string;
}

/**
 * Service for health checks.
 */
@Injectable()
export class HealthCheckService {
  constructor(
    private readonly toolRegistry: ToolRegistryService,
    @Optional() private readonly metricsService?: MetricsService
  ) {}

  /**
   * Performs a basic health check.
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const tools = this.toolRegistry.getToolSchemasForLLM();
    const toolCount = tools.length;

    const checks: HealthCheckResult["checks"] = {
      server: {
        status: "healthy",
        uptime: process.uptime(),
      },
      tools: {
        status: toolCount > 0 ? "healthy" : "unhealthy",
        count: toolCount,
      },
    };

    if (this.metricsService) {
      const serverMetrics = this.metricsService.getServerMetrics();
      checks.metrics = {
        status: serverMetrics.activeRequests < 100 ? "healthy" : "degraded",
        activeRequests: serverMetrics.activeRequests,
      };
    }

    const allHealthy = Object.values(checks).every(
      (check) => check.status === "healthy" || check.status === "degraded"
    );

    return {
      status: allHealthy ? "healthy" : "unhealthy",
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Performs a readiness check (is server ready to accept requests?).
   */
  async checkReadiness(): Promise<{ ready: boolean; reason?: string }> {
    const tools = this.toolRegistry.getToolSchemasForLLM();
    if (tools.length === 0) {
      return { ready: false, reason: "No tools registered" };
    }
    return { ready: true };
  }

  /**
   * Performs a liveness check (is server alive?).
   */
  async checkLiveness(): Promise<{ alive: boolean }> {
    return { alive: true };
  }
}

