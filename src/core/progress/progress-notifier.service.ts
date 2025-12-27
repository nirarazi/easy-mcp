import { Injectable } from "@nestjs/common";
import { ProgressNotification } from "../../interface/mcp-protocol.interface";
import { IInterfaceLayer } from "../../interface/interface.interface";
import { INTERFACE_LAYER_TOKEN } from "../../config/constants";
import { Inject, Optional } from "@nestjs/common";
import { logger } from "../utils/logger.util";

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: {
  progress: number; // 0.0 to 1.0
  total?: number;
  message?: string;
}) => void;

/**
 * Service for sending progress notifications during long-running tool operations.
 */
@Injectable()
export class ProgressNotifierService {
  private progressTokens = new Map<string | number, string>();
  private nextTokenId = 0;

  constructor(
    @Optional() @Inject(INTERFACE_LAYER_TOKEN) private interfaceLayer?: IInterfaceLayer
  ) {}

  /**
   * Creates a progress callback for a specific request.
   * The callback can be passed to tool functions to report progress.
   *
   * @param requestId The JSON-RPC request ID
   * @returns Progress callback function
   */
  createProgressCallback(requestId: string | number | null): ProgressCallback {
    if (requestId === null || requestId === undefined) {
      // Return no-op callback if no request ID
      return () => {};
    }

    const progressToken = this.getOrCreateProgressToken(requestId);

    return (progress: { progress: number; total?: number; message?: string }) => {
      this.sendProgress(requestId, progressToken, progress);
    };
  }

  /**
   * Gets or creates a progress token for a request.
   */
  private getOrCreateProgressToken(requestId: string | number): string {
    if (!this.progressTokens.has(requestId)) {
      const token = `progress_${this.nextTokenId++}_${Date.now()}`;
      this.progressTokens.set(requestId, token);
    }
    return this.progressTokens.get(requestId)!;
  }

  /**
   * Sends a progress notification.
   */
  private sendProgress(
    requestId: string | number,
    progressToken: string,
    progress: { progress: number; total?: number; message?: string }
  ): void {
    if (!this.interfaceLayer) {
      // If no interface layer, just log
      logger.debug("ProgressNotifierService", "Progress update", {
        component: "ProgressNotifier",
        requestId,
        progress: progress.progress,
        message: progress.message,
      });
      return;
    }

    // Clamp progress to 0.0-1.0
    const clampedProgress = Math.max(0, Math.min(1, progress.progress));

    const notification: ProgressNotification = {
      jsonrpc: "2.0",
      method: "notifications/progress",
      params: {
        progressToken,
        progress: clampedProgress,
        ...(progress.total !== undefined && { total: progress.total }),
        ...(progress.message && { message: progress.message }),
      },
    };

    // Send notification via interface layer
    // Note: Interface layer needs to support sending notifications
    // For stdio, this would write to stdout
    try {
      if (this.interfaceLayer.sendNotification) {
        this.interfaceLayer.sendNotification(notification);
      } else {
        // Fallback: log the notification
        logger.debug("ProgressNotifierService", "Progress notification", {
          component: "ProgressNotifier",
          requestId,
          notification,
        });
      }
    } catch (error) {
      logger.error("ProgressNotifierService", "Failed to send progress notification", {
        component: "ProgressNotifier",
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Cleans up progress token for a request.
   */
  cleanup(requestId: string | number | null): void {
    if (requestId !== null && requestId !== undefined) {
      this.progressTokens.delete(requestId);
    }
  }
}

