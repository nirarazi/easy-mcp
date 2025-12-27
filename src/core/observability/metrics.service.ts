import { Injectable, OnModuleInit } from "@nestjs/common";
import { logger } from "../utils/logger.util";

/**
 * Metrics for a single tool
 */
export interface ToolMetrics {
  /** Tool name */
  toolName: string;
  /** Total execution count */
  executionCount: number;
  /** Total execution time in milliseconds */
  totalExecutionTime: number;
  /** Error count */
  errorCount: number;
  /** Last execution time (timestamp) */
  lastExecutionTime?: number;
}

/**
 * Service for collecting and exposing metrics about tool execution.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private toolMetrics = new Map<string, ToolMetrics>();
  private requestCount = 0;
  private activeRequests = 0;
  private startTime = Date.now();

  onModuleInit() {
    // Initialize metrics collection
    logger.info("MetricsService", "Metrics collection initialized", {
      component: "Observability",
    });
  }

  /**
   * Records the start of a tool execution.
   */
  recordToolStart(toolName: string): () => void {
    const startTime = Date.now();
    this.activeRequests++;
    this.requestCount++;

    return () => {
      // This is called when execution completes
      const executionTime = Date.now() - startTime;
      this.activeRequests--;

      const metrics = this.toolMetrics.get(toolName) || {
        toolName,
        executionCount: 0,
        totalExecutionTime: 0,
        errorCount: 0,
      };

      metrics.executionCount++;
      metrics.totalExecutionTime += executionTime;
      metrics.lastExecutionTime = Date.now();

      this.toolMetrics.set(toolName, metrics);
    };
  }

  /**
   * Records a tool execution error.
   */
  recordToolError(toolName: string): void {
    const metrics = this.toolMetrics.get(toolName) || {
      toolName,
      executionCount: 0,
      totalExecutionTime: 0,
      errorCount: 0,
    };

    metrics.errorCount++;
    this.toolMetrics.set(toolName, metrics);
  }

  /**
   * Gets metrics for a specific tool.
   */
  getToolMetrics(toolName: string): ToolMetrics | undefined {
    return this.toolMetrics.get(toolName);
  }

  /**
   * Gets all tool metrics.
   */
  getAllToolMetrics(): ToolMetrics[] {
    return Array.from(this.toolMetrics.values());
  }

  /**
   * Gets average execution time for a tool.
   */
  getAverageExecutionTime(toolName: string): number {
    const metrics = this.toolMetrics.get(toolName);
    if (!metrics || metrics.executionCount === 0) {
      return 0;
    }
    return metrics.totalExecutionTime / metrics.executionCount;
  }

  /**
   * Gets error rate for a tool (0.0 to 1.0).
   */
  getErrorRate(toolName: string): number {
    const metrics = this.toolMetrics.get(toolName);
    if (!metrics || metrics.executionCount === 0) {
      return 0;
    }
    return metrics.errorCount / metrics.executionCount;
  }

  /**
   * Gets overall server metrics.
   */
  getServerMetrics(): {
    totalRequests: number;
    activeRequests: number;
    uptime: number;
    toolCount: number;
  } {
    return {
      totalRequests: this.requestCount,
      activeRequests: this.activeRequests,
      uptime: Date.now() - this.startTime,
      toolCount: this.toolMetrics.size,
    };
  }

  /**
   * Gets Prometheus-compatible metrics format.
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    // Server metrics
    const serverMetrics = this.getServerMetrics();
    lines.push(`# HELP mcp_server_total_requests Total number of requests`);
    lines.push(`# TYPE mcp_server_total_requests counter`);
    lines.push(`mcp_server_total_requests ${serverMetrics.totalRequests}`);

    lines.push(`# HELP mcp_server_active_requests Current number of active requests`);
    lines.push(`# TYPE mcp_server_active_requests gauge`);
    lines.push(`mcp_server_active_requests ${serverMetrics.activeRequests}`);

    lines.push(`# HELP mcp_server_uptime_seconds Server uptime in seconds`);
    lines.push(`# TYPE mcp_server_uptime_seconds gauge`);
    lines.push(`mcp_server_uptime_seconds ${Math.floor(serverMetrics.uptime / 1000)}`);

    // Tool metrics
    for (const metrics of this.toolMetrics.values()) {
      const toolName = metrics.toolName.replace(/[^a-zA-Z0-9_]/g, "_");

      lines.push(`# HELP mcp_tool_executions_total Total number of tool executions`);
      lines.push(`# TYPE mcp_tool_executions_total counter`);
      lines.push(`mcp_tool_executions_total{tool="${toolName}"} ${metrics.executionCount}`);

      lines.push(`# HELP mcp_tool_execution_time_seconds Total execution time in seconds`);
      lines.push(`# TYPE mcp_tool_execution_time_seconds counter`);
      lines.push(
        `mcp_tool_execution_time_seconds{tool="${toolName}"} ${metrics.totalExecutionTime / 1000}`
      );

      lines.push(`# HELP mcp_tool_errors_total Total number of tool errors`);
      lines.push(`# TYPE mcp_tool_errors_total counter`);
      lines.push(`mcp_tool_errors_total{tool="${toolName}"} ${metrics.errorCount}`);

      const avgTime = this.getAverageExecutionTime(metrics.toolName);
      lines.push(`# HELP mcp_tool_avg_execution_time_seconds Average execution time in seconds`);
      lines.push(`# TYPE mcp_tool_avg_execution_time_seconds gauge`);
      lines.push(`mcp_tool_avg_execution_time_seconds{tool="${toolName}"} ${avgTime / 1000}`);

      const errorRate = this.getErrorRate(metrics.toolName);
      lines.push(`# HELP mcp_tool_error_rate Error rate (0.0 to 1.0)`);
      lines.push(`# TYPE mcp_tool_error_rate gauge`);
      lines.push(`mcp_tool_error_rate{tool="${toolName}"} ${errorRate}`);
    }

    return lines.join("\n");
  }

  /**
   * Resets all metrics (useful for testing).
   */
  reset(): void {
    this.toolMetrics.clear();
    this.requestCount = 0;
    this.activeRequests = 0;
    this.startTime = Date.now();
  }
}

