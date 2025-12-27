import { Injectable } from "@nestjs/common";
import { ToolRegistryService } from "../../tooling/tool-registry/tool-registry.service";
import { CancellationToken } from "../../tooling/tool.interface";
import { McpContext } from "../context/mcp-context.interface";
import { ProgressCallback } from "../progress/progress-notifier.service";
import { logger } from "../utils/logger.util";
import { sanitizeErrorMessage } from "../utils/sanitize.util";

/**
 * Batch tool execution request
 */
export interface BatchToolRequest {
  tool: string;
  args: Record<string, any>;
}

/**
 * Batch tool execution result
 */
export interface BatchToolResult {
  tool: string;
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * Service for executing multiple tools in batch.
 */
@Injectable()
export class BatchExecutorService {
  // Maximum batch size to prevent DoS
  private static readonly MAX_BATCH_SIZE = 100;
  // Maximum concurrent executions to prevent resource exhaustion
  private static readonly MAX_CONCURRENCY = 10;

  constructor(private readonly toolRegistry: ToolRegistryService) {}

  /**
   * Executes multiple tools in parallel with concurrency limits.
   */
  async executeBatch(
    requests: BatchToolRequest[],
    cancellationToken?: CancellationToken,
    context?: McpContext,
    progress?: ProgressCallback
  ): Promise<BatchToolResult[]> {
    if (requests.length === 0) {
      return [];
    }

    // Enforce maximum batch size
    if (requests.length > BatchExecutorService.MAX_BATCH_SIZE) {
      logger.warn("BatchExecutorService", `Batch size ${requests.length} exceeds maximum ${BatchExecutorService.MAX_BATCH_SIZE}`, {
        component: "Batch",
        batchSize: requests.length,
        maxBatchSize: BatchExecutorService.MAX_BATCH_SIZE,
      });
      return requests.slice(0, BatchExecutorService.MAX_BATCH_SIZE).map((request) => ({
        tool: request.tool,
        success: false,
        error: "Batch size limit exceeded",
      }));
    }

    // Report initial progress
    progress?.({ progress: 0, message: `Executing ${requests.length} tools...` });

    // Execute tools with concurrency limit
    const results: BatchToolResult[] = [];
    const concurrency = Math.min(BatchExecutorService.MAX_CONCURRENCY, requests.length);

    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const batchPromises = batch.map(async (request, batchIndex) => {
        const index = i + batchIndex;
        // Check for cancellation before starting each tool
        if (cancellationToken?.isCancelled) {
          return {
            tool: request.tool,
            success: false,
            error: "Batch cancelled",
          } as BatchToolResult;
        }
        try {
          const result = await this.toolRegistry.executeTool(
            request.tool,
            request.args,
            cancellationToken,
            context,
            progress
              ? (p) => {
                  // Scale progress for this individual tool
                  const baseProgress = index / requests.length;
                  const toolProgress = p.progress / requests.length;
                  progress({
                    progress: baseProgress + toolProgress,
                    message: p.message || `Executing ${request.tool}...`,
                  });
                }
              : undefined
          );

          return {
            tool: request.tool,
            success: true,
            result,
          } as BatchToolResult;
        } catch (error) {
          // Sanitize error message to prevent internal details leakage
          const sanitizedError = sanitizeErrorMessage(error);
          logger.error("BatchExecutorService", `Batch tool execution failed: ${request.tool}`, {
            component: "Batch",
            tool: request.tool,
            error: sanitizedError,
          });

          // Return generic error message to client (not internal details)
          return {
            tool: request.tool,
            success: false,
            error: "Tool execution failed",
          } as BatchToolResult;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Update progress
      const currentProgress = Math.min((i + batch.length) / requests.length, 1);
      progress?.({ progress: currentProgress, message: `Executing ${requests.length} tools...` });
    }

    // Report completion
    progress?.({ progress: 1, message: `Completed ${requests.length} tools` });

    return results;
  }
}
