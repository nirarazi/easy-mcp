import { Injectable } from "@nestjs/common";

/**
 * Simple UUID v4 generator (fallback if uuid package not available)
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Trace context for request tracing
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
}

/**
 * Service for request tracing and correlation.
 */
@Injectable()
export class TracingService {
  /**
   * Creates a new trace context for a request.
   */
  createTraceContext(parentTraceId?: string, parentSpanId?: string): TraceContext {
    return {
      traceId: parentTraceId || generateUUID(),
      spanId: generateUUID(),
      parentSpanId,
      startTime: Date.now(),
    };
  }

  /**
   * Extracts trace context from request headers/metadata.
   */
  extractTraceContext(headers?: Record<string, any>): TraceContext | undefined {
    if (!headers) {
      return undefined;
    }

    const traceId = headers["x-trace-id"] || headers["trace-id"];
    const spanId = headers["x-span-id"] || headers["span-id"];
    const parentSpanId = headers["x-parent-span-id"] || headers["parent-span-id"];

    if (traceId) {
      return {
        traceId: String(traceId),
        spanId: spanId ? String(spanId) : generateUUID(),
        parentSpanId: parentSpanId ? String(parentSpanId) : undefined,
        startTime: Date.now(),
      };
    }

    return undefined;
  }

  /**
   * Creates a child span from a parent trace context.
   */
  createChildSpan(parent: TraceContext): TraceContext {
    return {
      traceId: parent.traceId,
      spanId: generateUUID(),
      parentSpanId: parent.spanId,
      startTime: Date.now(),
    };
  }
}
