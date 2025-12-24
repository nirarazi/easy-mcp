import { Injectable } from "@nestjs/common";
import { PromptDefinition, PromptRegistrationInput } from "./prompt.interface";
import { logger } from "../core/utils/logger.util";

@Injectable()
export class PromptRegistryService {
  private readonly registry = new Map<string, PromptDefinition>();
  private readonly promptProviders = new Map<string, (args: Record<string, any>) => Promise<Array<{
    role: "user" | "assistant";
    content: Array<{
      type: "text" | "image" | "resource";
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    }>;
  }>>>();

  /**
   * Registers a new prompt.
   * @param definition The prompt definition
   * @param getPrompt Function that generates the prompt content
   */
  public registerPrompt(
    definition: PromptDefinition,
    getPrompt: (args: Record<string, any>) => Promise<Array<{
      role: "user" | "assistant";
      content: Array<{
        type: "text" | "image" | "resource";
        text?: string;
        data?: string;
        mimeType?: string;
        uri?: string;
      }>;
    }>>
  ): void {
    if (this.registry.has(definition.name)) {
      throw new Error(`Prompt with name '${definition.name}' already registered.`);
    }
    this.registry.set(definition.name, definition);
    this.promptProviders.set(definition.name, getPrompt);
    logger.info("PromptRegistryService", `Prompt registered: ${definition.name}`, {
      component: "PromptRegistry",
      promptName: definition.name,
    });
  }

  /**
   * Registers a prompt from configuration input.
   * @param promptInput The prompt configuration
   */
  public registerPromptFromConfig(promptInput: PromptRegistrationInput): void {
    const definition: PromptDefinition = {
      name: promptInput.name,
      description: promptInput.description,
      arguments: promptInput.arguments,
      icon: promptInput.icon,
    };
    this.registerPrompt(definition, promptInput.getPrompt);
  }

  /**
   * Gets all registered prompts.
   * @returns Array of prompt definitions
   */
  public getAllPrompts(): PromptDefinition[] {
    return Array.from(this.registry.values());
  }

  /**
   * Gets a prompt by name.
   * @param name The prompt name
   * @returns Prompt definition or undefined
   */
  public getPrompt(name: string): PromptDefinition | undefined {
    return this.registry.get(name);
  }

  /**
   * Gets the prompt content.
   * @param name The prompt name
   * @param args The prompt arguments
   * @returns Prompt messages
   */
  public async getPromptContent(
    name: string,
    args: Record<string, any>
  ): Promise<Array<{
    role: "user" | "assistant";
    content: Array<{
      type: "text" | "image" | "resource";
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    }>;
  }>> {
    const getPrompt = this.promptProviders.get(name);
    if (!getPrompt) {
      throw new Error(`Prompt not found: ${name}`);
    }
    return await getPrompt(args);
  }
}

