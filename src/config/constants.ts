// Core Configuration Tokens
export const CONFIG_TOKEN = "MCP_CONFIG_HOLDER";
export const SYSTEM_INSTRUCTION_TOKEN = "SYSTEM_INSTRUCTION";

// Layer 2: Memory Service Token (for IMemoryService contract)
export const MEMORY_SERVICE_TOKEN = "IMemoryService";

// Layer 1: Interface Layer Token (for IInterfaceLayer contract)
export const INTERFACE_LAYER_TOKEN = "IInterfaceLayer";

// Layer 4: Provider-Specific Tokens (Used for concrete clients)

// LLM Provider (e.g., GeminiClientService) configuration token
export const LLM_PROVIDER_CONFIG_TOKEN = "LLM_PROVIDER_CONFIG";

// FIX: New token for the Embedding Client Service dependency
export const EMBEDDING_CLIENT_TOKEN = "IEmbeddingClientService";
export const EMBEDDING_CONFIG = "EMBEDDING_CONFIG";

// VectorDB Provider configuration token
export const VECTOR_DB_CONFIG = "VECTOR_DB_CONFIG";
