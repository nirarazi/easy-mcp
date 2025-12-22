/**
 * Base error class for all EasyMCP framework errors.
 */
export class EasyMcpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EasyMcpError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when configuration validation fails.
 */
export class ConfigurationError extends EasyMcpError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Thrown when tool execution fails.
 */
export class ToolExecutionError extends EasyMcpError {
  constructor(message: string, public readonly toolName?: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

/**
 * Thrown when a requested tool is not found in the registry.
 */
export class ToolNotFoundError extends EasyMcpError {
  constructor(toolName: string) {
    super(`Tool '${toolName}' not found in registry`);
    this.name = 'ToolNotFoundError';
  }
}

/**
 * Thrown when LLM API calls fail (network errors, rate limits, authentication, etc.).
 */
export class LlmApiError extends EasyMcpError {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'LlmApiError';
  }
}

