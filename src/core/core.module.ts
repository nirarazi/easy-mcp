import { Module, Global } from "@nestjs/common";
import { McpServerService } from "./mcp-server/mcp-server.service";
import { InterfaceModule } from "../interface/interface.module";

@Global()
@Module({
  imports: [InterfaceModule], // Needs Layer 1 components
  providers: [McpServerService],
  exports: [McpServerService],
})
export class CoreModule {}
