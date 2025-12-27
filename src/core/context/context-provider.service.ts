import { Injectable } from "@nestjs/common";
import { McpContext } from "./mcp-context.interface";
import { JsonRpcRequest } from "../../interface/jsonrpc.interface";

/**
 * Service responsible for extracting and providing context from requests.
 * Context can be extracted from headers, authentication tokens, or other request metadata.
 */
@Injectable()
export class ContextProviderService {
  private contextExtractors: Array<(request: JsonRpcRequest) => Partial<McpContext>> = [];

  /**
   * Registers a context extractor function.
   * Extractors are called in order, with later extractors overriding earlier ones.
   */
  registerExtractor(extractor: (request: JsonRpcRequest) => Partial<McpContext>): void {
    this.contextExtractors.push(extractor);
  }

  /**
   * Extracts context from a JSON-RPC request.
   * Combines all registered extractors to build the final context.
   */
  extractContext(request: JsonRpcRequest): McpContext {
    let context: McpContext = {};

    // Apply all extractors in order
    for (const extractor of this.contextExtractors) {
      const partialContext = extractor(request);
      context = { ...context, ...partialContext };
    }

    // Set default sessionId from request if not provided
    if (!context.sessionId && request.id !== null && request.id !== undefined) {
      context.sessionId = String(request.id);
    }

    return context;
  }

  /**
   * Creates a default context extractor that extracts basic info from request.
   */
  createDefaultExtractor(): (request: JsonRpcRequest) => Partial<McpContext> {
    return (request: JsonRpcRequest) => {
      const context: Partial<McpContext> = {};

      // Extract from request metadata if available
      if (request.metadata) {
        if (request.metadata.userId) {
          context.userId = request.metadata.userId;
        }
        if (request.metadata.scopes) {
          context.scopes = request.metadata.scopes;
        }
        if (request.metadata.buildingIds) {
          context.buildingIds = request.metadata.buildingIds;
        }
        if (request.metadata.sessionId) {
          context.sessionId = request.metadata.sessionId;
        }
        if (request.metadata.metadata) {
          context.metadata = request.metadata.metadata;
        }
      }

      return context;
    };
  }
}
