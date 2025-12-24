import { Injectable } from "@nestjs/common";
import { ResourceDefinition, ResourceRegistrationInput } from "./resource.interface";
import { logger } from "../core/utils/logger.util";

@Injectable()
export class ResourceRegistryService {
  private readonly registry = new Map<string, ResourceDefinition>();
  private readonly contentProviders = new Map<string, () => Promise<string | { type: string; data: string; mimeType?: string }>>();

  /**
   * Registers a new resource.
   * @param definition The resource definition
   * @param getContent Function that returns the resource content
   */
  public registerResource(
    definition: ResourceDefinition,
    getContent: () => Promise<string | { type: string; data: string; mimeType?: string }>
  ): void {
    if (this.registry.has(definition.uri)) {
      throw new Error(`Resource with URI '${definition.uri}' already registered.`);
    }
    this.registry.set(definition.uri, definition);
    this.contentProviders.set(definition.uri, getContent);
    logger.info("ResourceRegistryService", `Resource registered: ${definition.uri}`, {
      component: "ResourceRegistry",
      resourceUri: definition.uri,
    });
  }

  /**
   * Registers a resource from configuration input.
   * @param resourceInput The resource configuration
   */
  public registerResourceFromConfig(resourceInput: ResourceRegistrationInput): void {
    const definition: ResourceDefinition = {
      uri: resourceInput.uri,
      name: resourceInput.name,
      description: resourceInput.description,
      mimeType: resourceInput.mimeType,
      icon: resourceInput.icon,
    };
    this.registerResource(definition, resourceInput.getContent);
  }

  /**
   * Gets all registered resources.
   * @returns Array of resource definitions
   */
  public getAllResources(): ResourceDefinition[] {
    return Array.from(this.registry.values());
  }

  /**
   * Gets a resource by URI.
   * @param uri The resource URI
   * @returns Resource definition or undefined
   */
  public getResource(uri: string): ResourceDefinition | undefined {
    return this.registry.get(uri);
  }

  /**
   * Gets the content of a resource.
   * @param uri The resource URI
   * @returns Resource content
   */
  public async getResourceContent(uri: string): Promise<string | { type: string; data: string; mimeType?: string }> {
    const getContent = this.contentProviders.get(uri);
    if (!getContent) {
      throw new Error(`Resource not found: ${uri}`);
    }
    return await getContent();
  }
}

