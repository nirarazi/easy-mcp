/**
 * Mock MCP Client for Integration Testing
 * 
 * This mock client implements the MCP protocol specification to test
 * EasyMCP framework without requiring external MCP clients.
 */

import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import { EventEmitter } from 'events';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export class MockMcpClient extends EventEmitter {
  private serverProcess: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private requestIdCounter = 0;
  private pendingRequests = new Map<string | number, {
    resolve: (response: JsonRpcResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private messageBuffer = '';
  private pendingContentLength: number | null = null;
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds

  /**
   * Starts the MCP server process
   */
  async start(serverScript: string, args: string[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', [serverScript, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.serverProcess.stdout || !this.serverProcess.stdin || !this.serverProcess.stderr) {
        reject(new Error('Failed to spawn server process'));
        return;
      }

      // Set up readline interface for reading responses
      this.rl = readline.createInterface({
        input: this.serverProcess.stdout,
        output: process.stdout,
        terminal: false,
      });

      // Handle server output line by line
      this.rl.on('line', (line: string) => {
        this.handleLine(line);
      });

      let isResolved = false;
      const doResolve = () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          resolve();
        }
      };

      // Wait for server ready signal on stderr
      const onStderrData = (data: Buffer) => {
        const message = data.toString();
        // Log stderr for debugging
        console.error(`[Server stderr] ${message}`);
        
        // Check for server ready signals
        if (
          message.includes('Starting MCP server') ||
          message.includes('Starting EasyMCP core services') ||
          message.includes('EasyMCP core services are now running') ||
          message.includes('listening for JSON-RPC requests')
        ) {
          // Server is ready, remove this listener and resolve
          this.serverProcess?.stderr?.removeListener('data', onStderrData);
          // Set up permanent stderr handler for remaining messages
          this.serverProcess.stderr?.on('data', (data: Buffer) => {
            console.error(`[Server stderr] ${data.toString()}`);
          });
          doResolve();
        }
      };

      this.serverProcess.stderr.on('data', onStderrData);

      // Handle process exit
      this.serverProcess.on('exit', (code) => {
        this.emit('exit', code);
        this.cleanup();
      });

      // Set a timeout as fallback in case server doesn't emit ready signal
      const timeout = setTimeout(() => {
        if (!isResolved) {
          this.serverProcess?.stderr?.removeListener('data', onStderrData);
          // Still resolve to allow tests to proceed, but log a warning
          console.warn('[MockMcpClient] Server ready signal not detected, proceeding after timeout');
          doResolve();
        }
      }, 5000); // 5 second timeout as fallback
    });
  }

  /**
   * Handles a line from the server output
   */
  private handleLine(line: string): void {
    // Check for Content-Length header
    const contentLengthMatch = line.match(/^Content-Length:\s*(\d+)\s*$/i);
    if (contentLengthMatch) {
      this.pendingContentLength = parseInt(contentLengthMatch[1], 10);
      this.messageBuffer = '';
      return;
    }

    // If we're waiting for content, accumulate it
    if (this.pendingContentLength !== null) {
      const lineBytes = Buffer.from(line + '\n', 'utf8');
      this.messageBuffer += line + '\n';

      if (Buffer.byteLength(this.messageBuffer, 'utf8') >= this.pendingContentLength) {
        const message = this.messageBuffer.substring(0, this.pendingContentLength);
        this.processMessage(message);
        this.pendingContentLength = null;
        this.messageBuffer = '';
      }
      return;
    }

    // Try to parse as JSON (newline-delimited mode)
    if (line.trim()) {
      this.processMessage(line);
    }
  }

  /**
   * Processes a complete message from the server
   */
  private processMessage(message: string): void {
    try {
      const response: JsonRpcResponse = JSON.parse(message);
      const pending = this.pendingRequests.get(response.id);
      
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);
        pending.resolve(response);
      }
    } catch (error) {
      console.error('Failed to parse server response:', error);
    }
  }

  /**
   * Sends a JSON-RPC request to the server
   */
  async sendRequest(method: string, params?: any): Promise<JsonRpcResponse> {
    if (!this.serverProcess?.stdin) {
      throw new Error('Server process not started');
    }

    const id = ++this.requestIdCounter;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout for method: ${method}`));
      }, this.REQUEST_TIMEOUT);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const json = JSON.stringify(request);
      this.serverProcess!.stdin!.write(json + '\n');
    });
  }

  /**
   * Sends initialize request
   */
  async initialize(protocolVersion: string = '2024-11-05', clientInfo?: { name: string; version: string }): Promise<JsonRpcResponse> {
    return this.sendRequest('initialize', {
      protocolVersion,
      capabilities: {},
      clientInfo,
    });
  }

  /**
   * Lists available tools
   */
  async listTools(): Promise<McpTool[]> {
    const response = await this.sendRequest('tools/list');
    if (response.error) {
      throw new Error(`tools/list failed: ${response.error.message}`);
    }
    return response.result?.tools || [];
  }

  /**
   * Calls a tool
   */
  async callTool(name: string, args?: Record<string, any>): Promise<any> {
    const response = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });
    
    if (response.error) {
      throw new Error(`tools/call failed: ${response.error.message}`);
    }

    // Extract text content from result
    const content = response.result?.content || [];
    const textContent = content.find((item: any) => item.type === 'text');
    return textContent?.text || response.result;
  }

  /**
   * Stops the server process
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.serverProcess) {
        this.serverProcess.once('exit', () => {
          resolve();
        });
        this.serverProcess.kill();
      } else {
        resolve();
      }
      this.cleanup();
    });
  }

  /**
   * Cleans up resources
   */
  private cleanup(): void {
    // Clear all pending requests
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Server process terminated'));
    }
    this.pendingRequests.clear();

    // Close readline interface
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    this.serverProcess = null;
  }
}

