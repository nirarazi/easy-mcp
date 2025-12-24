import { LoadedSkill, SkillParameter } from './skill-loader';
import { ToolRegistrationInput, ToolNamingValidator } from 'easy-mcp-nest';

/**
 * Type mapping from Claude Skill parameter types to EasyMCP framework types
 */
const TYPE_MAP: Record<string, 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'> = {
  string: 'string',
  number: 'number',
  integer: 'integer',
  boolean: 'boolean',
  array: 'array',
  object: 'object',
};

/**
 * Creates an executable function for a skill
 * For now, this is a simple implementation that returns the skill content.
 * In a real implementation, this could execute scripts, call APIs, etc.
 * 
 * @param skill The loaded skill
 * @returns An async function that executes the skill
 */
function createSkillExecutor(skill: LoadedSkill): (args: Record<string, any>) => Promise<string> {
  return async (args: Record<string, any>): Promise<string> => {
    // Basic implementation: return skill content with substituted parameters
    // In a real scenario, this might:
    // - Execute a script defined in the skill
    // - Call an external API
    // - Process data based on the skill's logic
    
    let result = skill.content;
    
    // Simple parameter substitution in the content
    for (const [key, value] of Object.entries(args)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Remove any remaining (e.g., optional) placeholders to avoid leaking them
    result = result.replace(/\{\{.*?\}\}/g, '');

    // If the skill has a custom executor defined in metadata, use it
    // For now, we'll just return the processed content
    // In a production implementation, you might:
    // - Check for a 'script' field and execute it
    // - Check for an 'api' field and make HTTP requests
    // - Check for a 'function' field and call a registered function
    
    return result;
  };
}

/**
 * Converts a Claude Skill parameter to EasyMCP framework format
 * @param paramName The parameter name
 * @param paramDef The parameter definition from the skill
 * @returns The parameter in EasyMCP format
 */
function convertParameter(
  paramName: string,
  paramDef: SkillParameter
): { type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'; description: string; enum?: string[] } {
  const frameworkType = TYPE_MAP[paramDef.type];
  
  if (!frameworkType) {
    throw new Error(
      `Skill '${paramName}' has unsupported parameter type '${paramDef.type}'. ` +
      `Supported types: ${Object.keys(TYPE_MAP).join(', ')}`
    );
  }

  const converted: { type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'; description: string; enum?: string[] } = {
    type: frameworkType,
    description: paramDef.description,
  };

  if (paramDef.enum && paramDef.enum.length > 0) {
    converted.enum = paramDef.enum;
  }

  return converted;
}

/**
 * Converts a loaded Claude Skill to a ToolRegistrationInput for EasyMCP
 * @param skill The loaded skill to convert
 * @returns A ToolRegistrationInput that can be used with EasyMCP.initialize()
 */
export function parseSkillToTool(skill: LoadedSkill): ToolRegistrationInput {
  const { metadata } = skill;

  // Convert parameters from skill format to EasyMCP format
  const properties: Record<string, { type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'; description: string; enum?: string[] }> = {};

  if (metadata.parameters) {
    for (const [paramName, paramDef] of Object.entries(metadata.parameters)) {
      properties[paramName] = convertParameter(paramName, paramDef as SkillParameter);
    }
  }

  // Get required parameters
  const required = metadata.required || [];

  // Validate that all required parameters exist in properties
  for (const requiredParam of required) {
    if (!properties[requiredParam]) {
      throw new Error(
        `Skill '${metadata.name}' marks '${requiredParam}' as required, but it's not defined in parameters`
      );
    }
  }

  // Validate and transform tool name if it matches reserved patterns
  let toolName = metadata.name;
  const namingError = ToolNamingValidator.validate(toolName);
  if (namingError) {
    const suggestedName = ToolNamingValidator.suggest(toolName);
    console.error(`Warning: Skill '${toolName}' has an invalid tool name. Auto-transforming to '${suggestedName}'`);
    toolName = suggestedName;
  }

  // Create the tool registration input
  const tool: ToolRegistrationInput = {
    name: toolName,
    description: metadata.description,
    function: createSkillExecutor(skill),
    inputSchema: {
      type: 'object',
      properties,
      required,
    },
  };

  return tool;
}

/**
 * Converts multiple loaded skills to ToolRegistrationInput array
 * @param skills Array of loaded skills
 * @returns Array of ToolRegistrationInput objects
 */
export function parseSkillsToTools(skills: LoadedSkill[]): ToolRegistrationInput[] {
  return skills.map(skill => parseSkillToTool(skill));
}

