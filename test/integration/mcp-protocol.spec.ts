/**
 * Integration tests for MCP protocol compliance
 * 
 * These tests verify that EasyMCP correctly implements the MCP protocol
 * by testing the full protocol flow with a mock MCP client.
 */

import { MockMcpClient } from './mock-mcp-client';
import { EasyMCP, McpConfig } from '../../src/index';
import * as path from 'path';
import * as fs from 'fs';

describe('MCP Protocol Integration Tests', () => {
  let client: MockMcpClient;
  let serverScript: string;

  beforeAll(() => {
    // Create a temporary server script for testing
    serverScript = path.join(__dirname, 'test-server.js');
    
    const serverCode = `
const { EasyMCP } = require('../../dist/index');

const config = {
  tools: [
    {
      name: 'testTool',
      description: 'A test tool for integration testing',
      function: async (args) => {
        return JSON.stringify({ result: 'success', input: args });
      },
      inputSchema: {
        type: 'OBJECT',
        properties: {
          message: {
            type: 'STRING',
            description: 'A test message',
          },
        },
        required: ['message'],
      },
    },
    {
      name: 'addNumbers',
      description: 'Adds two numbers together',
      function: async (args) => {
        const { a, b } = args;
        return String(Number(a) + Number(b));
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
    name: 'test-mcp-server',
    version: '1.0.0',
  },
};

async function main() {
  try {
    await EasyMCP.initialize(config);
    await EasyMCP.run();
  } catch (error) {
    console.error('Server error:', error);
    process.exit(1);
  }
}

main();
`;

    fs.writeFileSync(serverScript, serverCode);
  });

  afterAll(() => {
    // Clean up test server script
    if (fs.existsSync(serverScript)) {
      fs.unlinkSync(serverScript);
    }
  });

  beforeEach(() => {
    client = new MockMcpClient();
  });

  afterEach(async () => {
    if (client) {
      await client.stop();
    }
  });

  describe('Protocol Flow', () => {
    it('should complete full MCP protocol flow: initialize → tools/list → tools/call', async () => {
      // Start server
      await client.start(serverScript);
      
      // Wait for server to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 1: Initialize
      const initResponse = await client.initialize('2024-11-05', {
        name: 'test-client',
        version: '1.0.0',
      });

      expect(initResponse.jsonrpc).toBe('2.0');
      expect(initResponse.id).not.toBeNull();
      expect(initResponse.error).toBeUndefined();
      expect(initResponse.result).toBeDefined();
      expect(initResponse.result.protocolVersion).toBe('2024-11-05');
      expect(initResponse.result.capabilities).toBeDefined();
      expect(initResponse.result.serverInfo).toBeDefined();
      expect(initResponse.result.serverInfo.name).toBe('test-mcp-server');
      expect(initResponse.result.serverInfo.version).toBe('1.0.0');

      // Step 2: List tools
      const tools = await client.listTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      const testTool = tools.find(t => t.name === 'testTool');
      expect(testTool).toBeDefined();
      expect(testTool?.description).toBe('A test tool for integration testing');
      expect(testTool?.inputSchema.type).toBe('object');
      expect(testTool?.inputSchema.properties.message).toBeDefined();

      // Step 3: Call tool
      const toolResult = await client.callTool('testTool', {
        message: 'Hello, MCP!',
      });

      expect(toolResult).toBeDefined();
      const parsed = JSON.parse(toolResult);
      expect(parsed.result).toBe('success');
      expect(parsed.input.message).toBe('Hello, MCP!');
    }, 30000);

    it('should handle multiple tool calls', async () => {
      await client.start(serverScript);
      await new Promise(resolve => setTimeout(resolve, 1000));

      await client.initialize();

      // Call first tool
      const result1 = await client.callTool('addNumbers', { a: 5, b: 3 });
      expect(Number(result1)).toBe(8);

      // Call second tool
      const result2 = await client.callTool('addNumbers', { a: 10, b: 20 });
      expect(Number(result2)).toBe(30);
    }, 30000);

    it('should reject unsupported protocol version', async () => {
      await client.start(serverScript);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await client.initialize('2024-10-01'); // Unsupported version

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // InvalidParams
      expect(response.error?.message).toContain('Unsupported protocol version');
    }, 30000);

    it('should return error for unknown tool', async () => {
      await client.start(serverScript);
      await new Promise(resolve => setTimeout(resolve, 1000));

      await client.initialize();

      try {
        await client.callTool('unknownTool', {});
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('tools/call failed');
      }
    }, 30000);

    it('should return error for invalid tool arguments', async () => {
      await client.start(serverScript);
      await new Promise(resolve => setTimeout(resolve, 1000));

      await client.initialize();

      try {
        // Missing required parameter
        await client.callTool('testTool', {});
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('tools/call failed');
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      await client.start(serverScript);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send invalid request (missing method)
      const response = await client.sendRequest('', {});

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600); // InvalidRequest or MethodNotFound
    }, 30000);
  });
});

