/**
 * Prompt definition interface for MCP Prompts feature.
 * Prompts are templated messages and workflows for users.
 */
export interface PromptDefinition {
  /** Unique name for the prompt */
  name: string;

  /** Description of what the prompt does */
  description?: string;

  /** Array of argument definitions for the prompt */
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;

  /** Optional icon URI for the prompt */
  icon?: string;
}

/**
 * Prompt registration input from configuration.
 */
export interface PromptRegistrationInput {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  icon?: string;
  /** Function that generates the prompt content from arguments */
  getPrompt: (args: Record<string, any>) => Promise<Array<{
    role: "user" | "assistant";
    content: Array<{
      type: "text" | "image" | "resource";
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
    }>;
  }>>;
}

