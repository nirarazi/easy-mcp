/**
 * Contract for the Layer 1: Interface component (e.g., WebSocket Gateway, HTTP Listener).
 */
export interface IInterfaceLayer {
    /**
     * Initializes and starts listening for client connections (WebSockets, HTTP, etc.).
     * This is the method McpServerService.startListening() will call.
     */
    start(): Promise<void>;

    /**
     * Sends a processed message back to a specific client/session.
     */
    sendMessage(sessionId: string, output: any): Promise<void>;
}

export const INTERFACE_LAYER_TOKEN = 'IInterfaceLayer';
