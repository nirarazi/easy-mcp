# Integration Testing Guide

This guide explains how to test EasyMCP with real MCP clients like Claude Desktop and Cursor.

## Overview

EasyMCP implements the Model Context Protocol (MCP) specification and can be used with any MCP-compatible client. This guide provides step-by-step instructions for testing with popular MCP clients.

## Prerequisites

- EasyMCP framework installed and built
- Node.js installed (v18 or higher)
- An MCP client installed (Claude Desktop, Cursor, etc.)

## Automated Integration Tests

EasyMCP includes automated integration tests using a mock MCP client. These tests verify protocol compliance without requiring external clients.

### Running Automated Tests

```bash
# Run integration tests
pnpm test test/integration

# Run with coverage
pnpm test:cov test/integration
```

The automated tests verify:
- Full MCP protocol flow (initialize → tools/list → tools/call)
- Protocol version validation
- Error handling
- Multiple tool calls
- Tool argument validation

See [test/integration/README.md](../test/integration/README.md) for more details.

## Testing with Claude Desktop

Claude Desktop is Anthropic's official MCP client. Follow these steps to test EasyMCP with Claude Desktop:

### Step 1: Create an MCP Server Script

Create a file `my-mcp-server.js`:

```javascript
const { EasyMCP } = require('easy-mcp-nest');

const config = {
  tools: [
    {
      name: 'getWeather',
      description: 'Gets the current weather for a location',
      function: async (args) => {
        const { location } = args;
        return JSON.stringify({ 
          location, 
          temperature: '72°F', 
          condition: 'Sunny' 
        });
      },
      inputSchema: {
        type: 'OBJECT',
        properties: {
          location: {
            type: 'STRING',
            description: 'The city and state, e.g. San Francisco, CA',
          },
        },
        required: ['location'],
      },
    },
  ],
  serverInfo: {
    name: 'my-mcp-server',
    version: '1.0.0',
  },
};

async function main() {
  await EasyMCP.initialize(config);
  await EasyMCP.run();
}

main().catch(console.error);
```

### Step 2: Make Script Executable

```bash
chmod +x my-mcp-server.js
```

### Step 3: Configure Claude Desktop

1. Open Claude Desktop
2. Navigate to Settings → Developer → MCP Servers
3. Add a new server configuration:

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "node",
      "args": ["/path/to/my-mcp-server.js"]
    }
  }
}
```

Replace `/path/to/my-mcp-server.js` with the actual path to your server script.

### Step 4: Restart Claude Desktop

Restart Claude Desktop to load the new MCP server configuration.

### Step 5: Test the Server

1. Open a new conversation in Claude Desktop
2. Ask Claude to use your tool: "What's the weather in San Francisco?"
3. Claude should call your `getWeather` tool and return the result

### Troubleshooting Claude Desktop

**Server not appearing:**
- Check that the server script path is correct
- Verify the script is executable
- Check Claude Desktop logs for errors

**Tools not working:**
- Verify tool names and descriptions are clear
- Check that tool schemas are valid JSON Schema
- Review server logs (stderr) for errors

**Connection issues:**
- Ensure Node.js is in your PATH
- Verify the server script runs independently
- Check file permissions

## Testing with Cursor

Cursor is a code editor with built-in MCP support. Follow these steps to test EasyMCP with Cursor:

### Step 1: Create MCP Server Configuration

Create a file `cursor-mcp-config.json`:

```json
{
  "mcpServers": {
    "easy-mcp": {
      "command": "node",
      "args": ["/path/to/my-mcp-server.js"],
      "env": {}
    }
  }
}
```

### Step 2: Configure Cursor

1. Open Cursor Settings
2. Navigate to MCP Settings
3. Add the server configuration from Step 1
4. Save and restart Cursor

### Step 3: Test the Server

1. Open a new chat in Cursor
2. Ask the AI to use your tools
3. Verify tool execution works correctly

### Troubleshooting Cursor

**Server not connecting:**
- Verify the command and args are correct
- Check that Node.js is available
- Review Cursor's MCP logs

**Tools not appearing:**
- Ensure the server initializes correctly
- Check tool registration logs
- Verify tool schemas are valid

## Testing with Other MCP Clients

EasyMCP should work with any MCP-compatible client that supports stdio transport. The general steps are:

1. Create an MCP server script using EasyMCP
2. Configure the client to run your server script
3. Test tool execution through the client

### Common Configuration Patterns

Most MCP clients expect:
- Server runs as a subprocess
- Communication via stdin/stdout
- JSON-RPC 2.0 messages
- Newline-delimited JSON or Content-Length framing

## Verifying Protocol Compliance

To verify that your EasyMCP server is protocol-compliant:

1. **Run Integration Tests**: The automated integration tests verify basic compliance
2. **Check Protocol Version**: Ensure your server returns protocol version "2024-11-05"
3. **Verify Error Codes**: Test error scenarios and verify correct error codes are returned
4. **Test Tool Schemas**: Ensure tool schemas match JSON Schema format expected by clients

## Debugging Tips

### Enable Debug Logging

Enable debug logging by setting the `DEBUG` environment variable:

```bash
DEBUG=1 node your-server.js
# or
DEBUG=true node your-server.js
```

Or in your server script:

```javascript
process.env.DEBUG = '1';
// or
process.env.DEBUG = 'true';
```

**Note**: The `DEBUG` environment variable accepts either `'1'` or `'true'` (case-sensitive) to enable debug logging.

### Check Server Logs

MCP servers should log to stderr (not stdout). Check stderr output for:
- Initialization messages
- Tool registration confirmations
- Error messages
- Protocol violations

### Common Issues

**Protocol Version Mismatch:**
- Ensure client sends protocol version "2024-11-05"
- Check server logs for version validation errors

**Tool Execution Failures:**
- Verify tool functions handle errors gracefully
- Check tool argument validation
- Review tool execution logs

**Transport Issues:**
- Ensure stdio is not being redirected incorrectly
- Check for buffering issues
- Verify newline handling

## Example: Complete Test Server

Here's a complete example server for testing:

```javascript
const { EasyMCP } = require('easy-mcp-nest');

const config = {
  tools: [
    {
      name: 'echo',
      description: 'Echoes back the input message',
      function: async (args) => {
        return `Echo: ${args.message}`;
      },
      inputSchema: {
        type: 'OBJECT',
        properties: {
          message: {
            type: 'STRING',
            description: 'The message to echo',
          },
        },
        required: ['message'],
      },
    },
    {
      name: 'add',
      description: 'Adds two numbers',
      function: async (args) => {
        return String(Number(args.a) + Number(args.b));
      },
      inputSchema: {
        type: 'OBJECT',
        properties: {
          a: {
            type: 'NUMBER',
            description: 'First number',
          },
          b: {
            type: 'NUMBER',
            description: 'Second number',
          },
        },
        required: ['a', 'b'],
      },
    },
  ],
  serverInfo: {
    name: 'test-server',
    version: '1.0.0',
  },
};

async function main() {
  try {
    console.error('Initializing EasyMCP server...');
    await EasyMCP.initialize(config);
    console.error('Starting MCP server...');
    await EasyMCP.run();
  } catch (error) {
    console.error('Server error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.error('Received SIGTERM, shutting down...');
  await EasyMCP.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.error('Received SIGINT, shutting down...');
  await EasyMCP.shutdown();
  process.exit(0);
});

main();
```

## Next Steps

- Review the [README](../README.md) for API documentation
- Check [examples](../examples/) for more server examples
- Read the [MCP Protocol Specification](https://modelcontextprotocol.io) for detailed protocol information

