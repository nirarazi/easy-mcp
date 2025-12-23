# Cursor Integration Example

This example shows how to configure EasyMCP to work with Cursor's MCP client.

## Prerequisites

- Cursor installed
- EasyMCP framework installed
- Node.js installed (v18 or higher)

## Step 1: Create Your MCP Server

Create a file `cursor-mcp-server.js`:

```javascript
const { EasyMCP } = require('easy-mcp-framework');

const config = {
  tools: [
    {
      name: 'readFile',
      description: 'Reads the contents of a file',
      function: async (args) => {
        const { filePath } = args;
        const fs = require('fs').promises;
        try {
          const content = await fs.readFile(filePath, 'utf8');
          return content;
        } catch (error) {
          throw new Error(`Failed to read file: ${error.message}`);
        }
      },
      inputSchema: {
        type: 'OBJECT',
        properties: {
          filePath: {
            type: 'STRING',
            description: 'The path to the file to read',
          },
        },
        required: ['filePath'],
      },
    },
    {
      name: 'writeFile',
      description: 'Writes content to a file',
      function: async (args) => {
        const { filePath, content } = args;
        const fs = require('fs').promises;
        try {
          await fs.writeFile(filePath, content, 'utf8');
          return JSON.stringify({ success: true, filePath });
        } catch (error) {
          throw new Error(`Failed to write file: ${error.message}`);
        }
      },
      inputSchema: {
        type: 'OBJECT',
        properties: {
          filePath: {
            type: 'STRING',
            description: 'The path to the file to write',
          },
          content: {
            type: 'STRING',
            description: 'The content to write to the file',
          },
        },
        required: ['filePath', 'content'],
      },
    },
    {
      name: 'listFiles',
      description: 'Lists files in a directory',
      function: async (args) => {
        const { directory } = args;
        const fs = require('fs').promises;
        try {
          const files = await fs.readdir(directory);
          return JSON.stringify({ directory, files });
        } catch (error) {
          throw new Error(`Failed to list files: ${error.message}`);
        }
      },
      inputSchema: {
        type: 'OBJECT',
        properties: {
          directory: {
            type: 'STRING',
            description: 'The directory path to list',
          },
        },
        required: ['directory'],
      },
    },
  ],
  serverInfo: {
    name: 'cursor-easymcp-server',
    version: '1.0.0',
  },
};

async function main() {
  try {
    console.error('Initializing EasyMCP server for Cursor...');
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

## Step 2: Configure Cursor

1. Open Cursor Settings (Cmd/Ctrl + ,)
2. Search for "MCP" or navigate to MCP Settings
3. Add your server configuration:

```json
{
  "mcpServers": {
    "easymcp": {
      "command": "node",
      "args": ["/absolute/path/to/cursor-mcp-server.js"],
      "env": {}
    }
  }
}
```

**Important:** Use absolute paths for the server script.

## Step 3: Restart Cursor

Restart Cursor completely to load the new MCP server configuration.

## Step 4: Test Your Server

1. Open a new chat in Cursor
2. Ask the AI to use your tools:
   - "Read the file package.json"
   - "List files in the src directory"
   - "Write 'Hello, World!' to test.txt"
3. The AI should call your tools and return results

## Troubleshooting

### Server Not Connecting

- **Check the path**: Ensure the absolute path to your server script is correct
- **Verify Node.js**: Make sure `node` is in your PATH
- **Check permissions**: Ensure the script is executable
- **Review Cursor logs**: Check Cursor's developer console for errors

### Tools Not Appearing

- **Check initialization**: Ensure the server initializes correctly
- **Verify tool registration**: Check server logs for tool registration messages
- **Review schemas**: Ensure tool input schemas are valid JSON Schema
- **Check descriptions**: Make tool descriptions clear

### Tool Execution Failures

- **Check error messages**: Review tool execution errors in Cursor
- **Verify permissions**: Ensure file operations have proper permissions
- **Test independently**: Run your server script directly to test

## Security Considerations

⚠️ **Warning**: The example tools above perform file system operations. In production:

- Validate file paths to prevent directory traversal attacks
- Restrict file operations to safe directories
- Implement proper authentication and authorization
- Sanitize all inputs

## Debugging

To debug your server:

1. **Add logging**: Use `console.error()` for debug output (goes to stderr)
2. **Check Cursor logs**: Review Cursor's developer console
3. **Test independently**: Run your server script directly to verify it works
4. **Use integration tests**: Run the automated integration tests

## Next Steps

- Customize your tools for your specific use case
- Add more tools as needed
- Review the [main README](../../README.md) for API documentation
- Check [Integration Testing Guide](../../docs/INTEGRATION_TESTING.md) for more details

