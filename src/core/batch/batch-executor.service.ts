import { Injectable } from "@nestjs/common";
import { ToolRegistryService } from "../../tooling/tool-registry/tool-registry.service";
import { CancellationToken } from "../../tooling/tool.interface";
import { McpContext } from "../context/mcp-context.interface";
import { ProgressCallback } from "../progress/progress-notifier.service";
import { logger } from "../utils/logger.util";

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
  constructor(private readonly toolRegistry: ToolRegistryService) {}

  /**
   * Executes multiple tools in parallel.
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

    // Report initial progress
    progress?.({ progress: 0, message: `Executing ${requests.length} tools...` });

    // Execute all tools in parallel
    const promises = requests.map(async (request, index) => {
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("BatchExecutorService", `Batch tool execution failed: ${request.tool}`, {
          component: "Batch",
          tool: request.tool,
          error: errorMessage,
        });

        return {
          tool: request.tool,
          success: false,
          error: errorMessage,
        } as BatchToolResult;
      }
    });

    const results = await Promise.all(promises);

    // Report completion
    progress?.({ progress: 1, message: `Completed ${requests.length} tools` });

    return results;
  }
}
