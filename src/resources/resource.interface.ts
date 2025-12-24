/**
 * Resource definition interface for MCP Resources feature.
 * Resources provide contextual data that can be read by clients.
 */
export interface ResourceDefinition {
  /** Unique identifier for the resource (URI) */
  uri: string;

  /** Human-readable name for the resource */
  name: string;

  /** Description of what the resource contains */
  description?: string;

  /** MIME type of the resource content */
  mimeType?: string;

  /** Optional icon URI for the resource */
  icon?: string;
}

/**
 * Resource registration input from configuration.
 */
export interface ResourceRegistrationInput {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  icon?: string;
  /** Function that returns the resource content */
  getContent: () => Promise<string | { type: string; data: string; mimeType?: string }>;
}

