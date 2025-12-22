import { Injectable } from "@nestjs/common";
import { McpConfig } from "./mcp-config.interface";
import { logger } from "../core/utils/logger.util";

@Injectable()
export class ConfigHolderService {
  private config: McpConfig;

  public setConfig(config: McpConfig): void {
    this.config = config;
    logger.info("ConfigHolderService", "Configuration successfully loaded into ConfigHolderService", {
      component: "Config",
      toolCount: config.tools?.length || 0,
    });
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
