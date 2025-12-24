/**
 * Validates tool names according to MCP 2025-11-25 naming guidelines.
 * 
 * Tool naming guidelines:
 * - Should be lowercase
 * - Should use underscores to separate words
 * - Should be descriptive and clear
 * - Should follow a consistent pattern
 */
export class ToolNamingValidator {
  /**
   * Validates a tool name according to MCP 2025-11-25 guidelines.
   * @param name The tool name to validate
   * @returns Validation error message if invalid, null if valid
   */
  static validate(name: string): string | null {
    if (!name || typeof name !== "string") {
      return "Tool name must be a non-empty string";
    }

    // Check length
    if (name.length === 0) {
      return "Tool name cannot be empty";
    }

    if (name.length > 100) {
      return "Tool name must be 100 characters or less";
    }

    // Check for valid characters (alphanumeric, underscores, hyphens)
    // MCP guidelines suggest lowercase with underscores, but we'll be lenient
    const validPattern = /^[a-z][a-z0-9_-]*$/;
    if (!validPattern.test(name)) {
      return "Tool name must start with a lowercase letter and contain only lowercase letters, numbers, underscores, and hyphens";
    }

    // Check for reserved names or patterns
    const reservedPatterns = [
      /^_/,
      /__/,
      /-$/,
      /^system/,
      /^internal/,
    ];

    for (const pattern of reservedPatterns) {
      if (pattern.test(name)) {
        return `Tool name '${name}' matches a reserved pattern`;
      }
    }

    return null;
  }

  /**
   * Provides a suggestion for a better tool name based on common patterns.
   * @param name The current tool name
   * @returns A suggested improved name
   */
  static suggest(name: string): string {
    if (!name) {
      return "tool_name";
    }

    // Convert to lowercase
    let suggested = name.toLowerCase();

    // Replace spaces and dots with underscores
    suggested = suggested.replace(/[\s.]+/g, "_");

    // Remove invalid characters
    suggested = suggested.replace(/[^a-z0-9_-]/g, "");

    // Ensure it starts with a letter
    if (!/^[a-z]/.test(suggested)) {
      suggested = "tool_" + suggested;
    }

    // Remove consecutive underscores
    suggested = suggested.replace(/_+/g, "_");

    // Remove leading/trailing underscores
    suggested = suggested.replace(/^_+|_+$/g, "");

    // Handle reserved patterns by adding a prefix
    const reservedPatterns = [
      /^system/,
      /^internal/,
    ];

    for (const pattern of reservedPatterns) {
      if (pattern.test(suggested)) {
        suggested = "skill_" + suggested;
        break;
      }
    }

    // Handle leading underscore
    if (/^_/.test(suggested)) {
      suggested = "tool" + suggested;
    }

    // Handle trailing hyphen
    if (/-$/.test(suggested)) {
      suggested = suggested.slice(0, -1) + "_tool";
    }

    // Ensure it's not empty
    if (suggested.length === 0) {
      suggested = "tool_name";
    }

    return suggested;
  }
}

