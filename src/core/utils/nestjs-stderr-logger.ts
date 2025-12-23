/**
 * Custom NestJS logger that writes structured JSON logs to stderr.
 * This is required for MCP protocol compliance - only JSON-RPC messages should go to stdout.
 * All logs are output as structured JSON for better parsing and compliance with logging standards.
 */
import { LoggerService } from '@nestjs/common';

interface StructuredLogEntry {
  timestamp: string;
  level: string;
  component: string;
  message: string;
  metadata?: Record<string, any>;
  trace?: string;
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
    // Convert message to string if it's not already
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    
    // Create structured log entry
    const logEntry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level: level.toLowerCase(),
      component: context || 'NestJS',
      message: messageStr,
    };

    // Add trace if provided
    if (trace) {
      logEntry.trace = trace;
    }

    // Add metadata if message is an object with additional properties
    if (typeof message === 'object' && message !== null && !Array.isArray(message)) {
      const { message: msg, ...rest } = message as any;
      if (Object.keys(rest).length > 0) {
        logEntry.metadata = rest;
      }
      if (msg !== undefined) {
        logEntry.message = typeof msg === 'string' ? msg : JSON.stringify(msg);
      }
    }

    // Write structured JSON to stderr
    process.stderr.write(JSON.stringify(logEntry) + '\n');
  }
}

