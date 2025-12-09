// src/interface/websocket-gateway.service.ts

import { Injectable } from "@nestjs/common";
import { ConfigHolderService } from "../config/config-holder.service";
import { McpServerService } from "../core/mcp-server/mcp-server.service";
import { IInterfaceLayer } from "./interface.interface";
import { McpMessageOutput } from "./mcp.interface";

@Injectable()
export class WebSocketGatewayService implements IInterfaceLayer {
  // The message processor (Layer 3)
  private mcpServerService: McpServerService;
  private port: number;

  constructor(private readonly configHolder: ConfigHolderService) {
    // Placeholder for port retrieval (e.g., from configHolder)
    this.port = 3000;
    console.log("[Layer 1: Interface] WebSocketGatewayService initialized.");
  }

  /**
   * Used by CoreModule's OnModuleInit to resolve the circular dependency.
   */
  public setMcpServerService(service: McpServerService) {
    this.mcpServerService = service;
  }

  /**
   * Implements the IInterfaceLayer.start() method.
   */
  public async start(): Promise<void> {
    // In a real NestJS application, this is where the WebSocket server starts listening
    console.log(`[Layer 1] Starting WebSocket Server on port ${this.port}...`);
    console.log(
      `[Layer 1] Server is running and listening for client connections.`,
    );

    await Promise.resolve();

    // MOCK DEMO: Initiate a mock message exchange to test the full stack
    setTimeout(() => {
      void this.mockReceiveMessage(
        "DEMO_SESSION_123",
        "Hello, can you tell me about the Easy MCP 4-Layer Architecture?",
      );
    }, 500);
  }

  public async sendMessage(
    sessionId: string,
    output: McpMessageOutput,
  ): Promise<void> {
    // Placeholder for sending data back over the socket connection
    console.log(`\n[Layer 1 ➡️ Client] Session ${sessionId} Response:`);
    console.log(`- Text: ${output.response}`);
    if (output.action) {
      console.log(
        `- Action: ${output.action.name} (Args: ${JSON.stringify(output.action.args)})`,
      );
    }
    console.log("--- End of Turn ---\n");
    await Promise.resolve();
  }

  // --- MOCK MESSAGE RECEIVE LOGIC ---
  public async mockReceiveMessage(sessionId: string, text: string) {
    if (!this.mcpServerService) {
      console.error("McpServerService not set. Cannot process message.");
      return;
    }

    console.log(
      `[Layer 1 ⬅️ Client] Message received from ${sessionId}: "${text}"`,
    );

    // Delegate processing to Layer 3
    const output = await this.mcpServerService.handleMessage({
      sessionId,
      text,
    });

    // Send the processed output back to the client
    await this.sendMessage(sessionId, output);
  }
}
