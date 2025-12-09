import { Injectable } from "@nestjs/common";
import { McpConfig } from "./mcp-config.interface";

@Injectable()
export class ConfigHolderService {
  private config: McpConfig;

  public setConfig(config: McpConfig): void {
    this.config = config;
    console.log("Configuration successfully loaded into ConfigHolderService.");
  }

  public getConfig(): McpConfig {
    if (!this.config) {
      throw new Error(
        "EasyMCP Configuration not set. Call EasyMCP.initialize() first.",
      );
    }
    return this.config;
  }
}
