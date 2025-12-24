# MCP Protocol Integration Tests

This directory contains integration tests for the EasyMCP framework to verify MCP protocol compliance.

## Overview

The integration tests use a mock MCP client (`mock-mcp-client.ts`) that implements the MCP protocol specification to test EasyMCP without requiring external MCP clients like Claude Desktop or Cursor.

## Running Integration Tests

```bash
# Run all integration tests
pnpm test test/integration

# Run with coverage
pnpm test:cov test/integration
```

## Test Structure

### `mock-mcp-client.ts`

A mock MCP client that:
- Spawns an EasyMCP server process
- Communicates via stdio using JSON-RPC 2.0
- Supports both Content-Length framing and newline-delimited JSON
- Provides helper methods for MCP protocol methods (initialize, tools/list, tools/call)

### `mcp-protocol.spec.ts`

Integration tests that verify:
- Full MCP protocol flow (initialize → tools/list → tools/call)
- Protocol version validation
- Error handling for invalid requests
- Multiple tool calls
- Tool argument validation

## Testing with Real MCP Clients

While the mock client provides automated testing, you should also test with real MCP clients:

### Claude Desktop

1. Create an MCP server configuration file
2. Configure Claude Desktop to use your EasyMCP server
3. Test tool execution through Claude Desktop

### Cursor

1. Configure Cursor's MCP settings
2. Point to your EasyMCP server executable
3. Test tool execution through Cursor

See `docs/INTEGRATION_TESTING.md` for detailed instructions on testing with real clients.

## Adding New Integration Tests

When adding new integration tests:

1. Use the `MockMcpClient` class to interact with the server
2. Follow the MCP protocol flow: initialize → tools/list → tools/call
3. Test both success and error scenarios
4. Ensure tests clean up resources (stop server process)

Example:

```typescript
it('should handle custom tool', async () => {
  await client.start(serverScript);
  await client.initialize();
  
  const tools = await client.listTools();
  const result = await client.callTool('myTool', { param: 'value' });
  
  expect(result).toBeDefined();
});
```



