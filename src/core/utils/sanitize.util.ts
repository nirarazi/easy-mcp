/**
 * Utility functions for sanitizing sensitive data in logs and error messages.
 */

/**
 * Dangerous object keys that can be used for prototype pollution attacks.
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Checks if a key is safe to use as an object property name.
 * Prevents prototype pollution by rejecting dangerous keys.
 * @param key The key to check
 * @returns true if the key is safe, false otherwise
 */
export function isSafeObjectKey(key: string): boolean {
  if (typeof key !== 'string') {
    return false;
  }
  return !DANGEROUS_KEYS.has(key);
}

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

/**
 * Sanitizes file paths to prevent sensitive information exposure.
 * Returns only the filename or a relative path, removing absolute paths and user directories.
 * @param filePath The file path to sanitize
 * @returns A sanitized file path
 */
export function sanitizeFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    return '[invalid path]';
  }

  try {
    // Extract just the filename to avoid exposing directory structure
    const pathParts = filePath.split(/[/\\]/);
    const filename = pathParts[pathParts.length - 1];

    // If filename is reasonable length, return it
    if (filename && filename.length < 100) {
      return filename;
    }

    // Otherwise return a truncated version
    return filename ? `${filename.substring(0, 50)}...` : '[path]';
  } catch {
    // If path parsing fails, return a generic placeholder
    return '[path]';
  }
}

/**
 * Sanitizes URIs to prevent sensitive information exposure and log injection in logs.
 * Removes control characters, enforces length limits, and hashes sensitive patterns.
 * @param uri The URI to sanitize
 * @returns A sanitized URI representation safe for logging
 */
export function sanitizeUri(uri: string): string {
  if (!uri || typeof uri !== 'string') {
    return '[invalid uri]';
  }

  try {
    // Remove control characters and newlines to prevent log injection
    let sanitized = uri.replace(/[\x00-\x1F\x7F-\x9F\n\r]/g, '');

    // Enforce maximum length to prevent DoS via extremely long strings
    const MAX_LOG_STRING_LENGTH = 200;
    if (sanitized.length > MAX_LOG_STRING_LENGTH) {
      sanitized = sanitized.substring(0, MAX_LOG_STRING_LENGTH);
    }

    // For URIs that might contain tokens or are long, return a hash
    if (sanitized.length > 100 || /[?&](token|key|secret|auth|password|api[_-]?key)=/i.test(sanitized)) {
      // Simple hash function for URI (not cryptographically secure, just for logging)
      let hash = 0;
      for (let i = 0; i < sanitized.length; i++) {
        const char = sanitized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return `[uri:${Math.abs(hash).toString(36)}]`;
    }

    // For shorter URIs without sensitive patterns, return as-is (already sanitized)
    return sanitized;
  } catch {
    // If URI processing fails, return a generic placeholder
    return '[uri]';
  }
}

/**
 * Sanitizes names (like prompt names) to prevent log injection and DoS.
 * Removes control characters and enforces length limits.
 * @param name The name to sanitize
 * @returns A sanitized name safe for logging
 */
export function sanitizeName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '[invalid name]';
  }

  try {
    // Remove control characters and newlines to prevent log injection
    let sanitized = name.replace(/[\x00-\x1F\x7F-\x9F\n\r]/g, '');

    // Enforce maximum length to prevent DoS via extremely long strings
    const MAX_LOG_STRING_LENGTH = 200;
    if (sanitized.length > MAX_LOG_STRING_LENGTH) {
      sanitized = sanitized.substring(0, MAX_LOG_STRING_LENGTH);
    }

    return sanitized;
  } catch {
    // If name processing fails, return a generic placeholder
    return '[name]';
  }
}

/**
 * Sanitizes actor identifiers for audit logging to prevent PII exposure.
 * Hashes user IDs while preserving session IDs for traceability.
 * @param actorId The actor identifier (userId, sessionId, etc.)
 * @returns A sanitized actor identifier safe for audit logs
 */
export function sanitizeActorId(actorId: string | undefined): string {
  if (!actorId || typeof actorId !== 'string') {
    return 'anonymous';
  }

  try {
    // Remove control characters and newlines to prevent log injection
    let sanitized = actorId.replace(/[\x00-\x1F\x7F-\x9F\n\r]/g, '');

    // Enforce maximum length
    const MAX_LOG_STRING_LENGTH = 200;
    if (sanitized.length > MAX_LOG_STRING_LENGTH) {
      sanitized = sanitized.substring(0, MAX_LOG_STRING_LENGTH);
    }

    // If it looks like a sessionId (UUID-like or session identifier), use as-is
    // Session IDs are typically less sensitive than user IDs
    if (/^[a-f0-9-]{20,}$/i.test(sanitized) || sanitized.startsWith('session:') || sanitized.startsWith('sess:')) {
      return sanitized;
    }

    // If it looks like a user ID (potentially PII), hash it
    // This prevents PII exposure while maintaining traceability within a session
    if (sanitized.startsWith('user:') || /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(sanitized)) {
      // Simple hash function (not cryptographically secure, just for logging)
      let hash = 0;
      for (let i = 0; i < sanitized.length; i++) {
        const char = sanitized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return `user:${Math.abs(hash).toString(36)}`;
    }

    // For other identifiers, use as-is if reasonable length
    return sanitized;
  } catch {
    // If processing fails, return a generic placeholder
    return 'anonymous';
  }
}
