// Core Configuration Tokens
export const CONFIG_TOKEN = "MCP_CONFIG_HOLDER";

// Layer 1: Interface Layer Token (for IInterfaceLayer contract)
export const INTERFACE_LAYER_TOKEN = "IInterfaceLayer";

// Security Constants
/**
 * Maximum allowed message size in bytes (10MB)
 * Prevents memory exhaustion from unbounded input
 */
export const MAX_MESSAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Maximum allowed Content-Length value
 * Prevents integer overflow and memory exhaustion
 */
export const MAX_CONTENT_LENGTH = MAX_MESSAGE_SIZE_BYTES;
