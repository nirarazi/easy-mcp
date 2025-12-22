/**
 * Structured logging utility for audit trails and debugging.
 * All logs are written to stderr to avoid corrupting JSON-RPC stdout stream.
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  metadata?: Record<string, any>;
  requestId?: string | number | null;
  actor?: string;
  action?: string;
  outcome?: 'success' | 'failure';
}

/**
 * Creates a structured log entry and writes it to stderr as JSON.
 * This ensures logs are parseable and don't corrupt the JSON-RPC stdout stream.
 */
export function logStructured(
  level: LogLevel,
  component: string,
  message: string,
  metadata?: Record<string, any>,
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    ...(metadata && { metadata }),
  };

  // Write structured JSON to stderr
  process.stderr.write(JSON.stringify(entry) + '\n');
}

/**
 * Creates an audit log entry for security-relevant actions.
 * Includes actor identity, action, request correlation, and outcome.
 */
export function logAudit(
  component: string,
  action: string,
  outcome: 'success' | 'failure',
  metadata?: Record<string, any>,
  requestId?: string | number | null,
  actor?: string,
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    component,
    message: `Audit: ${action} - ${outcome}`,
    action,
    outcome,
    ...(requestId !== undefined && { requestId }),
    ...(actor && { actor }),
    ...(metadata && { metadata }),
  };

  process.stderr.write(JSON.stringify(entry) + '\n');
}

/**
 * Convenience methods for different log levels
 */
export const logger = {
  debug: (component: string, message: string, metadata?: Record<string, any>) =>
    logStructured(LogLevel.DEBUG, component, message, metadata),
  info: (component: string, message: string, metadata?: Record<string, any>) =>
    logStructured(LogLevel.INFO, component, message, metadata),
  warn: (component: string, message: string, metadata?: Record<string, any>) =>
    logStructured(LogLevel.WARN, component, message, metadata),
  error: (component: string, message: string, metadata?: Record<string, any>) =>
    logStructured(LogLevel.ERROR, component, message, metadata),
  audit: (
    component: string,
    action: string,
    outcome: 'success' | 'failure',
    metadata?: Record<string, any>,
    requestId?: string | number | null,
    actor?: string,
  ) => logAudit(component, action, outcome, metadata, requestId, actor),
};

