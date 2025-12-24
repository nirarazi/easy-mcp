# Claude Desktop Integration Example

This example shows how to configure EasyMCP to work with Claude Desktop.

## Prerequisites

- Claude Desktop installed
- EasyMCP framework installed
- Node.js installed (v18 or higher)

## Step 1: Create Your MCP Server

Create a file `claude-mcp-server.js`:

```javascript
const { EasyMCP } = require('easy-mcp-framework');

const config = {
  tools: [
    {
      name: 'getWeather',
      description: 'Gets the current weather for a location',
      function: async (args) => {
        const { location } = args;
        // In a real implementation, you would call a weather API
        return JSON.stringify({ 
          location, 
          temperature: '72°F', 
          condition: 'Sunny',
          humidity: '65%'
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
    {
      name: 'searchWeb',
      description: 'Searches the web for information',
      function: async (args) => {
        const { query } = args;
        // In a real implementation, you would call a search API
        return JSON.stringify({
          query,
          results: [
            { title: 'Result 1', url: 'https://example.com/1' },
            { title: 'Result 2', url: 'https://example.com/2' },
          ],
        });
      },
      inputSchema: {
        type: 'OBJECT',
        properties: {
          query: {
            type: 'STRING',
            description: 'The search query',
          },
        },
        required: ['query'],
      },
    },
  ],
  serverInfo: {
    name: 'claude-easymcp-server',
    version: '1.0.0',
  },
};

async function main() {
  try {
    console.error('Initializing EasyMCP server for Claude Desktop...');
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

## Step 2: Make Script Executable

```bash
chmod +x claude-mcp-server.js
```

## Step 3: Configure Claude Desktop

1. Open Claude Desktop
2. Navigate to Settings → Developer → MCP Servers
3. Add your server configuration:

**On macOS:**
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "easymcp": {
      "command": "node",
      "args": ["/absolute/path/to/claude-mcp-server.js"]
    }
  }
}
```

**On Windows:**
Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "easymcp": {
      "command": "node",
      "args": ["C:\\absolute\\path\\to\\claude-mcp-server.js"]
    }
  }
}
```

**On Linux:**
Edit `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "easymcp": {
      "command": "node",
      "args": ["/absolute/path/to/claude-mcp-server.js"]
    }
  }
}
```

**Important:** Use absolute paths for the server script.

## Step 4: Restart Claude Desktop

Restart Claude Desktop completely to load the new MCP server configuration.

## Step 5: Test Your Server

1. Open a new conversation in Claude Desktop
2. Ask Claude to use your tools:
   - "What's the weather in San Francisco?"
   - "Search the web for information about TypeScript"
3. Claude should call your tools and return results

## Troubleshooting

### Server Not Appearing

- **Check the path**: Ensure the absolute path to your server script is correct
- **Verify Node.js**: Make sure `node` is in your PATH
- **Check permissions**: Ensure the script is executable
- **Review logs**: Check Claude Desktop logs for errors

### Tools Not Working

- **Check tool names**: Ensure tool names are clear and descriptive
- **Verify schemas**: Ensure tool input schemas are valid JSON Schema
- **Review descriptions**: Make tool descriptions clear so Claude knows when to use them
- **Check server logs**: Review stderr output from your server

### Connection Issues

- **Node.js version**: Ensure you're using Node.js v18 or higher
- **Dependencies**: Make sure EasyMCP and its dependencies are installed
- **File permissions**: Verify the script file is readable and executable

## Debugging

To see debug output from your server:

1. Check Claude Desktop's developer console
2. Review server stderr output (if accessible)
3. Add console.error() statements to your server script for debugging

## Next Steps

- Customize your tools for your specific use case
- Add more tools as needed
- Review the [main README](../../README.md) for API documentation
- Check [Integration Testing Guide](../../docs/INTEGRATION_TESTING.md) for more details



