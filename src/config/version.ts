import * as fs from "fs";
import * as path from "path";

/**
 * Reads package.json to get version and name information.
 * Works in both development (TypeScript) and production (compiled JS) scenarios.
 */
function readPackageJson(): { name: string; version: string } {
  // Get the directory of the current file
  // In development: src/config/version.ts -> __dirname = src/config
  // In production: dist/config/version.js -> __dirname = dist/config
  // Both resolve to ../../package.json (project root)
  const currentDir = __dirname;
  const packageJsonPath = path.resolve(currentDir, "../../package.json");
  
  try {
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);
    
    return {
      name: packageJson.name || "easy-mcp-framework",
      version: packageJson.version || "0.0.0",
    };
  } catch (error) {
    // Fallback if package.json cannot be read
    console.warn(
      `Warning: Could not read package.json from ${packageJsonPath}. Using fallback version.`,
    );
    return {
      name: "easy-mcp-framework",
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

