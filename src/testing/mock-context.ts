import { McpContext } from "../core/context/mcp-context.interface";

/**
 * Creates a mock MCP context for testing.
 *
 * @example
 * ```typescript
 * const context = mockMcpContext({
 *   userId: '123',
 *   scopes: ['read', 'write'],
 *   buildingIds: ['building-1', 'building-2'],
 * });
 * ```
 */
export function mockMcpContext(overrides?: Partial<McpContext>): McpContext {
  return {
    userId: "test-user-id",
    scopes: ["test-scope"],
    buildingIds: ["test-building-id"],
    sessionId: "test-session-id",
    metadata: {
      ip: "127.0.0.1",
      userAgent: "test-agent",
    },
    ...overrides,
  };
}
