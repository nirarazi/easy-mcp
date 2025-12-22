/**
 * Utility functions for sanitizing sensitive data in logs and error messages.
 */

/**
 * Sanitizes a value to prevent sensitive data exposure.
 * Replaces potentially sensitive values with a redacted placeholder.
 * @param value The value to sanitize
 * @param maxLength Maximum length to show before truncating
 * @returns Sanitized string representation
 */
export function sanitizeValue(value: any, maxLength: number = 50): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === 'string') {
    // Truncate long strings
    if (value.length > maxLength) {
      return `${value.substring(0, maxLength)}... [truncated]`;
    }
    return value;
  }

  if (typeof value === 'object') {
    try {
      const jsonString = JSON.stringify(value);
      if (jsonString.length > maxLength) {
        return `${jsonString.substring(0, maxLength)}... [truncated]`;
      }
      return jsonString;
    } catch {
      // Handle circular references or other JSON serialization errors
      return '[object] [non-serializable]';
    }
  }

  return String(value);
}

/**
 * Sanitizes an object by redacting potentially sensitive fields.
 * @param obj The object to sanitize
 * @param sensitiveKeys Keys that should be redacted (case-insensitive)
 * @returns A new object with sensitive fields redacted
 */
export function sanitizeObject(
  obj: Record<string, any>,
  sensitiveKeys: string[] = ['password', 'token', 'apiKey', 'secret', 'auth', 'credential', 'key'],
): Record<string, any> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized: Record<string, any> = {};
  const lowerSensitiveKeys = sensitiveKeys.map(k => k.toLowerCase());

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if this key should be redacted
    if (lowerSensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
      sanitized[key] = '[REDACTED]';
    } else if (Array.isArray(value)) {
      // Recursively sanitize objects within arrays
      sanitized[key] = value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? sanitizeObject(item as Record<string, any>, sensitiveKeys)
          : item,
      ) as any;
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value as Record<string, any>, sensitiveKeys);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitizes tool arguments for logging.
 * @param args Tool arguments to sanitize
 * @returns Sanitized arguments object
 */
export function sanitizeToolArgs(args: Record<string, any>): Record<string, any> {
  return sanitizeObject(args, ['password', 'token', 'apiKey', 'secret', 'auth', 'credential', 'key', 'apikey']);
}

/**
 * Sanitizes tool results to prevent sensitive data exposure.
 * @param result Tool result to sanitize (can be any type)
 * @returns Sanitized result (stringified if object, otherwise as-is)
 */
export function sanitizeToolResult(result: any): string {
  if (result === null || result === undefined) {
    return String(result);
  }

  if (typeof result === 'string') {
    // For strings, check for common sensitive patterns and redact them
    let sanitized = result;
    // Redact common sensitive patterns in strings
    sanitized = sanitized.replace(/api[_-]?key['":\s]*[=:]\s*[^\s,}]+/gi, 'api[REDACTED]');
    sanitized = sanitized.replace(/token['":\s]*[=:]\s*[^\s,}]+/gi, 'token[REDACTED]');
    sanitized = sanitized.replace(/password['":\s]*[=:]\s*[^\s,}]+/gi, 'password[REDACTED]');
    sanitized = sanitized.replace(/secret['":\s]*[=:]\s*[^\s,}]+/gi, 'secret[REDACTED]');
    return sanitized;
  }

  if (typeof result === 'object') {
    try {
      // Sanitize object before stringifying
      const sanitized = sanitizeObject(result as Record<string, any>, ['password', 'token', 'apiKey', 'secret', 'auth', 'credential', 'key', 'apikey']);
      return JSON.stringify(sanitized);
    } catch {
      // Handle circular references or other serialization errors
      return '[Tool result could not be serialized]';
    }
  }

  return String(result);
}

/**
 * Sanitizes error messages to prevent sensitive information leakage.
 * @param error The error to sanitize
 * @returns A sanitized error message
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Remove stack traces and other sensitive details from error messages
    let message = error.message;
    
    // Remove common sensitive patterns
    message = message.replace(/api[_-]?key['":\s]*[=:]\s*[^\s,}]+/gi, 'api[REDACTED]');
    message = message.replace(/token['":\s]*[=:]\s*[^\s,}]+/gi, 'token[REDACTED]');
    message = message.replace(/password['":\s]*[=:]\s*[^\s,}]+/gi, 'password[REDACTED]');
    message = message.replace(/secret['":\s]*[=:]\s*[^\s,}]+/gi, 'secret[REDACTED]');
    
    return message;
  }
  
  return 'An unknown error occurred';
}

