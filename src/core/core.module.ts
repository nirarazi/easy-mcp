import { Module, Global } from "@nestjs/common";
import { McpServerService } from "./mcp-server/mcp-server.service";
import { InterfaceModule } from "../interface/interface.module";
import { ResourceModule } from "../resources/resource.module";
import { PromptModule } from "../prompts/prompt.module";

@Global()
@Module({
  imports: [InterfaceModule, ResourceModule, PromptModule], // Needs Layer 1 components, Resource and Prompt modules
  providers: [McpServerService],
  exports: [McpServerService],
})
export class CoreModule {}
