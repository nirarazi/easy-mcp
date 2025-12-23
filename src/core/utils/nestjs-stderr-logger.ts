/**
 * Custom NestJS logger that writes structured JSON logs to stderr.
 * This is required for MCP protocol compliance - only JSON-RPC messages should go to stdout.
 * All logs are output as structured JSON for better parsing and compliance with logging standards.
 * Includes security measures to prevent DoS attacks and sensitive data leakage.
 */
import { LoggerService } from '@nestjs/common';
import { sanitizeObject, sanitizeErrorMessage } from './sanitize.util';

interface StructuredLogEntry {
  timestamp: string;
  level: string;
  component: string;
  message: string;
  metadata?: Record<string, any>;
  trace?: string;
}

/**
 * Safely stringifies a value, handling circular references and serialization errors.
 * @param value The value to stringify
 * @param fallback Fallback string if serialization fails
 * @returns String representation of the value
 */
function safeStringify(value: any, fallback: string = '[non-serializable]'): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    // Handle circular references or other serialization errors
    return fallback;
  }
}

/**
 * Sanitizes trace information to prevent stack exposure.
 * Removes file paths and limits trace length.
 * @param trace The trace string to sanitize
 * @returns Sanitized trace string
 */
function sanitizeTrace(trace: string): string {
  if (!trace || typeof trace !== 'string') {
    return '';
  }

  // Limit trace length to prevent excessive logging
  const maxTraceLength = 500;
  let sanitized = trace;

  // Remove absolute file paths (common in stack traces)
  sanitized = sanitized.replace(/\/[^\s]+/g, '[path]');

  // Truncate if too long
  if (sanitized.length > maxTraceLength) {
    sanitized = sanitized.substring(0, maxTraceLength) + '... [truncated]';
  }

  return sanitized;
}

export class NestjsStderrLogger implements LoggerService {
  log(message: any, context?: string) {
    this.writeToStderr('info', message, context);
  }

  error(message: any, trace?: string, context?: string) {
    this.writeToStderr('error', message, context, trace);
  }

  warn(message: any, context?: string) {
    this.writeToStderr('warn', message, context);
  }

  debug(message: any, context?: string) {
    this.writeToStderr('debug', message, context);
  }

  verbose(message: any, context?: string) {
    this.writeToStderr('verbose', message, context);
  }

  private writeToStderr(level: string, message: any, context?: string, trace?: string) {
    try {
      // Safely convert message to string, handling circular references
      let messageStr: string;
      let metadata: Record<string, any> | undefined;

      if (typeof message === 'string') {
        messageStr = message;
      } else if (typeof message === 'object' && message !== null && !Array.isArray(message)) {
        // Handle object messages - extract message field and sanitize metadata
        const { message: msg, ...rest } = message;
        
        // Extract message string safely
        if (msg !== undefined) {
          messageStr = typeof msg === 'string' ? msg : safeStringify(msg, '[message could not be serialized]');
        } else {
          messageStr = safeStringify(message, '[object could not be serialized]');
        }

        // Sanitize metadata to prevent sensitive data leakage
        if (Object.keys(rest).length > 0) {
          try {
            metadata = sanitizeObject(rest, ['password', 'token', 'apiKey', 'secret', 'auth', 'credential', 'key', 'apikey']);
          } catch {
            metadata = { error: '[metadata could not be sanitized]' };
          }
        }
      } else {
        // For other types, safely stringify
        messageStr = safeStringify(message, '[value could not be serialized]');
      }

      // Create structured log entry
      const logEntry: StructuredLogEntry = {
        timestamp: new Date().toISOString(),
        level: level.toLowerCase(),
        component: context || 'NestJS',
        message: messageStr,
      };

      // Add sanitized metadata if present
      if (metadata) {
        logEntry.metadata = metadata;
      }

      // Add sanitized trace if provided (prevent stack exposure)
      if (trace) {
        logEntry.trace = sanitizeTrace(trace);
      }

      // Safely stringify the entire log entry
      try {
        const logJson = JSON.stringify(logEntry);
        process.stderr.write(logJson + '\n');
      } catch (error) {
        // If even the log entry can't be stringified, write a minimal error log
        const fallbackEntry: StructuredLogEntry = {
          timestamp: new Date().toISOString(),
          level: 'error',
          component: 'NestjsStderrLogger',
          message: 'Failed to serialize log entry',
          metadata: { originalLevel: level, originalContext: context },
        };
        try {
          process.stderr.write(JSON.stringify(fallbackEntry) + '\n');
        } catch {
          // Last resort: write a plain text error if JSON serialization completely fails
          process.stderr.write(`[${new Date().toISOString()}] ERROR NestjsStderrLogger: Failed to write log entry\n`);
        }
      }
    } catch (error) {
      // Catch-all error handler to prevent logger from crashing the process
      // Write a minimal error log without using the logger itself to avoid recursion
      try {
        const errorEntry: StructuredLogEntry = {
          timestamp: new Date().toISOString(),
          level: 'error',
          component: 'NestjsStderrLogger',
          message: 'Logger error: ' + sanitizeErrorMessage(error),
        };
        process.stderr.write(JSON.stringify(errorEntry) + '\n');
      } catch {
        // Absolute last resort: plain text error
        process.stderr.write(`[${new Date().toISOString()}] ERROR NestjsStderrLogger: Critical logger failure\n`);
      }
    }
  }
}

