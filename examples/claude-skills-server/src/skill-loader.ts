import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import * as yaml from 'js-yaml';
import { glob } from 'glob';

/**
 * Represents the metadata extracted from a Claude Skill's YAML frontmatter
 */
export interface SkillMetadata {
  name: string;
  description: string;
  parameters?: Record<string, SkillParameter>;
  required?: string[];
  [key: string]: any; // Allow additional metadata fields
}

/**
 * Represents a parameter definition in a Claude Skill
 */
export interface SkillParameter {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  default?: any;
}

/**
 * Represents a loaded Claude Skill with its metadata and content
 */
export interface LoadedSkill {
  metadata: SkillMetadata;
  content: string; // The markdown content after the frontmatter
  filePath: string; // Path to the source file
}

/**
 * Parses YAML frontmatter from a markdown file
 * @param content The full file content
 * @returns An object with frontmatter and content
 */
function parseFrontmatter(content: string): { frontmatter: any; content: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error('SKILL.md file must start with YAML frontmatter (--- ... ---)');
  }

  const frontmatterYaml = match[1];
  const markdownContent = match[2];

  try {
    // Use safe schema to prevent prototype pollution and unsafe type parsing
    const frontmatter = yaml.load(frontmatterYaml, { schema: yaml.DEFAULT_SAFE_SCHEMA }) as any;
    return { frontmatter, content: markdownContent.trim() };
  } catch (error) {
    throw new Error(`Failed to parse YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validates that a skill metadata object has all required fields
 * @param metadata The skill metadata to validate
 * @param filePath Path to the file for error reporting
 */
function validateSkillMetadata(metadata: any, filePath: string): void {
  if (!metadata.name || typeof metadata.name !== 'string') {
    throw new Error(`Skill in ${filePath} is missing required field 'name'`);
  }

  if (!metadata.description || typeof metadata.description !== 'string') {
    throw new Error(`Skill '${metadata.name}' in ${filePath} is missing required field 'description'`);
  }

  // Validate parameters if present
  if (metadata.parameters) {
    if (typeof metadata.parameters !== 'object' || Array.isArray(metadata.parameters)) {
      throw new Error(`Skill '${metadata.name}' in ${filePath} has invalid 'parameters' field (must be an object)`);
    }

    for (const [paramName, paramDef] of Object.entries(metadata.parameters)) {
      if (!paramDef || typeof paramDef !== 'object') {
        throw new Error(`Skill '${metadata.name}' in ${filePath} has invalid parameter '${paramName}'`);
      }

      const param = paramDef as SkillParameter;
      if (!param.type || !param.description) {
        throw new Error(`Skill '${metadata.name}' in ${filePath} parameter '${paramName}' is missing 'type' or 'description'`);
      }

      const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object'];
      if (!validTypes.includes(param.type)) {
        throw new Error(`Skill '${metadata.name}' in ${filePath} parameter '${paramName}' has invalid type '${param.type}'`);
      }
    }
  }
}

/**
 * Loads a single SKILL.md file and parses it
 * @param filePath Path to the SKILL.md file
 * @returns A LoadedSkill object
 */
export async function loadSkillFile(filePath: string): Promise<LoadedSkill> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const { frontmatter, content: markdownContent } = parseFrontmatter(content);

    // Validate the metadata
    validateSkillMetadata(frontmatter, filePath);

    return {
      metadata: frontmatter as SkillMetadata,
      content: markdownContent,
      filePath,
    };
  } catch (error) {
    throw new Error(`Failed to load skill from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Finds all SKILL.md files in a directory (recursively)
 * @param directoryPath Path to the directory to search
 * @returns Array of file paths
 */
export async function findSkillFiles(directoryPath: string): Promise<string[]> {
  try {
    // Use glob to find all SKILL.md files recursively
    const pattern = join(directoryPath, '**', 'SKILL.md');
    const files = await glob(pattern, { absolute: true });
    return files;
  } catch (error) {
    throw new Error(`Failed to scan directory ${directoryPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Loads all Claude Skills from a directory
 * @param directoryPath Path to the directory containing SKILL.md files
 * @returns Array of loaded skills
 */
export async function loadSkillsFromDirectory(directoryPath: string): Promise<LoadedSkill[]> {
  const skillFiles = await findSkillFiles(directoryPath);

  if (skillFiles.length === 0) {
    console.warn(`No SKILL.md files found in ${directoryPath}`);
    return [];
  }

  console.log(`Found ${skillFiles.length} skill file(s) in ${directoryPath}`);

  const skills: LoadedSkill[] = [];
  const errors: string[] = [];

  // Load each skill file
  for (const filePath of skillFiles) {
    try {
      const skill = await loadSkillFile(filePath);
      skills.push(skill);
      console.log(`Loaded skill: ${skill.metadata.name} from ${filePath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(errorMsg);
      console.error(`Error loading skill from ${filePath}: ${errorMsg}`);
    }
  }

  if (errors.length > 0 && skills.length === 0) {
    throw new Error(`Failed to load any skills. Errors:\n${errors.join('\n')}`);
  }

  if (errors.length > 0) {
    console.warn(`Some skills failed to load:\n${errors.join('\n')}`);
  }

  return skills;
}

