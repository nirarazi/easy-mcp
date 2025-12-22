import { Module, Global } from "@nestjs/common";
import { StdioGatewayService } from "./stdio-gateway.service";
import { INTERFACE_LAYER_TOKEN } from "../../src/config/constants";

@Global()
@Module({
  providers: [
    StdioGatewayService,
    {
      provide: INTERFACE_LAYER_TOKEN,
      useExisting: StdioGatewayService,
    },
  ],
  // Export both the token (for DI) and the concrete service (for setup)
  exports: [INTERFACE_LAYER_TOKEN, StdioGatewayService],
})
export class InterfaceModule {}
