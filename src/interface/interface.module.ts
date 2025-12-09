import { Module, Global } from '@nestjs/common';
import { WebSocketGatewayService } from './websocket-gateway.service';
import { INTERFACE_LAYER_TOKEN } from './interface.interface';

@Global()
@Module({
    providers: [
        WebSocketGatewayService,
        {
            provide: INTERFACE_LAYER_TOKEN,
            useExisting: WebSocketGatewayService,
        },
    ],
    // Export both the token (for DI) and the concrete service (for setup)
    exports: [INTERFACE_LAYER_TOKEN, WebSocketGatewayService],
})
export class InterfaceModule {}
