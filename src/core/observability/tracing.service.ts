import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

/**
 * Generates a cryptographically secure UUID v4.
 * Uses Node.js crypto.randomUUID() for secure random generation.
 */
function generateUUID(): string {
  // Use crypto.randomUUID() if available (Node.js 14.17.0+)
  if (typeof randomUUID === "function") {
    return randomUUID();
  }

  // Fallback: use crypto.getRandomValues() for older Node.js versions
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

    // Convert to UUID string format
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  // Last resort fallback (should not be reached in Node.js environments)
  // This is kept for compatibility but should be avoided
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
   * Validates and sanitizes a trace ID to prevent spoofing and injection.
   * @param traceId The trace ID to validate
   * @returns Validated trace ID or null if invalid
   */
  private validateTraceId(traceId: any): string | null {
    if (!traceId || typeof traceId !== "string") {
      return null;
    }

    // Remove control characters and newlines to prevent injection
    let sanitized = traceId.replace(/[\x00-\x1F\x7F-\x9F\n\r]/g, "");

    // Enforce maximum length to prevent DoS
    const MAX_TRACE_ID_LENGTH = 128;
    if (sanitized.length > MAX_TRACE_ID_LENGTH) {
      return null;
    }

    // Validate UUID format (optional - can be any alphanumeric with dashes/underscores)
    // Allow UUID v4 format or custom trace ID formats
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sanitized)) {
      return null;
    }

    return sanitized;
  }

  /**
   * Extracts trace context from request headers/metadata.
   * Validates and sanitizes trace IDs to prevent spoofing and injection.
   */
  extractTraceContext(headers?: Record<string, any>): TraceContext | undefined {
    if (!headers) {
      return undefined;
    }

    const traceId = headers["x-trace-id"] || headers["trace-id"];
    const spanId = headers["x-span-id"] || headers["span-id"];
    const parentSpanId = headers["x-parent-span-id"] || headers["parent-span-id"];

    // Validate trace ID - if invalid, don't extract context (prevent spoofing)
    const validatedTraceId = traceId ? this.validateTraceId(traceId) : null;
    if (!validatedTraceId) {
      return undefined;
    }

    // Validate span IDs if provided
    const validatedSpanId = spanId ? this.validateTraceId(spanId) : null;
    const validatedParentSpanId = parentSpanId ? this.validateTraceId(parentSpanId) : null;

    return {
      traceId: validatedTraceId,
      spanId: validatedSpanId || generateUUID(),
      parentSpanId: validatedParentSpanId || undefined,
      startTime: Date.now(),
    };
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
