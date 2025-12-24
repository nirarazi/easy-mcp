import { logger } from "../core/utils/logger.util";

interface PackageJson {
  name?: string;
  version?: string;
}

/**
 * Reads package.json to get version and name information.
 * Works in both development (TypeScript) and production (compiled JS) scenarios.
 * Uses require() for simpler JSON loading without exposing filesystem paths.
 */
function readPackageJson(): { name: string; version: string } {
  try {
    // require() is the idiomatic way to read JSON files in Node.js.
    // It caches the result, handles parsing, and resolves paths correctly.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const packageJson = require("../../package.json") as PackageJson;
    
    // Add type checks to ensure values are strings before using them
    const name = typeof packageJson.name === "string" 
      ? packageJson.name 
      : "easy-mcp-nest";
    const version = typeof packageJson.version === "string" 
      ? packageJson.version 
      : "0.0.0";
    
    return {
      name,
      version,
    };
  } catch (error) {
    // Fallback if package.json cannot be read
    // Use structured logging without exposing filesystem paths
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn("version", "Could not read package.json. Using fallback version.", {
      error: errorMessage,
    });
    return {
      name: "easy-mcp-nest",
      version: "0.0.0",
    };
  }
}

const packageInfo = readPackageJson();

/**
 * Package name from package.json
 */
export const PACKAGE_NAME = packageInfo.name;

/**
 * Package version from package.json
 */
export const VERSION = packageInfo.version;

/**
 * Gets the current package version.
 * @returns The version string from package.json
 */
export function getVersion(): string {
  return VERSION;
}

/**
 * Gets the package name.
 * @returns The package name from package.json
 */
export function getPackageName(): string {
  return PACKAGE_NAME;
}

