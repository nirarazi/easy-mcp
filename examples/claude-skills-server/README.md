# Claude Skills Server Example

This example demonstrates how to use the **EasyMCP Framework** to build an MCP (Model Context Protocol) server that automatically loads and serves Claude Skills from `SKILL.md` files stored in a directory.

## Overview

The Claude Skills Server automatically:
1. Scans a directory for `SKILL.md` files
2. Parses YAML frontmatter to extract skill metadata
3. Converts skills to tools compatible with EasyMCP
4. Registers them with the MCP server
5. Makes them available for LLM execution

## Prerequisites

- Node.js 18+ and npm/pnpm/yarn
- TypeScript knowledge (for understanding the code)

## Installation

1. **Install dependencies:**

```bash
cd examples/claude-skills-server
npm install
# or
pnpm install
```

2. **Install peer dependencies:**

```bash
npm install @nestjs/common@^11.0.1 @nestjs/core@^11.0.1 @nestjs/platform-express@^11.0.1
```

## SKILL.md File Format

Each Claude Skill must be stored as a `SKILL.md` file with YAML frontmatter. The format is:

```markdown
---
name: skill_name
description: A clear description of what the skill does
parameters:
  param1:
    type: string
    description: Description of parameter 1
  param2:
    type: number
    description: Description of parameter 2
    default: 10
  param3:
    type: string
    description: Parameter with enum values
    enum: ['option1', 'option2', 'option3']
required:
  - param1
  - param2
---

# Skill Title

Markdown content describing the skill, its usage, examples, etc.
```

### Required Fields

- **name**: Unique identifier for the skill (used as tool name)
- **description**: Clear description of what the skill does

### Optional Fields

- **parameters**: Object defining input parameters
  - Each parameter must have `type` and `description`
  - Supported types: `string`, `number`, `integer`, `boolean`, `array`, `object`
  - Optional: `enum` (array of allowed values), `default` (default value)
- **required**: Array of parameter names that are required

### Parameter Types

| Skill Type | EasyMCP Type | Description |
|------------|--------------|-------------|
| `string` | `STRING` | Text values |
| `number` | `NUMBER` | Floating-point numbers |
| `integer` | `INTEGER` | Whole numbers |
| `boolean` | `BOOLEAN` | true/false values |
| `array` | `ARRAY` | Arrays of values |
| `object` | `OBJECT` | Nested objects |

## Directory Structure

Organize your skills in a directory structure like this:

```
skills/
├── SKILL.md              # Skills can be at the root
├── category1/
│   └── SKILL.md          # Or in subdirectories
└── category2/
    └── SKILL.md
```

The loader will recursively find all `SKILL.md` files in the specified directory.

## Configuration

### Environment Variables

Create a `.env` file (see `.env.example` for template):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SKILLS_DIR` | No | `./skills` | Path to directory containing SKILL.md files |

## Running the Server

### Development Mode

```bash
npm run start:dev
```

### Production Mode

```bash
npm run build
npm start
```

## Example Skills

The `skills/` directory includes example skills:

1. **greet_user**: Greets a user in multiple languages
2. **calculate**: Performs basic mathematical operations
3. **get_weather**: Template for weather information retrieval

## How It Works

### Architecture Flow

```
SKILL.md Files
    ↓
SkillLoader (reads & parses files)
    ↓
SkillParser (converts to ToolRegistrationInput)
    ↓
EasyMCP.initialize() (registers tools)
    ↓
MCP Server Running (tools available to LLM)
```

### Code Structure

- **`src/skill-loader.ts`**: Loads and parses SKILL.md files
- **`src/skill-parser.ts`**: Converts skills to EasyMCP tool format
- **`src/main.ts`**: Main entry point that initializes and runs the server

### Skill Execution

Currently, skills execute by:
1. Receiving parameters from the LLM
2. Substituting parameters in the skill's markdown content (using `{{param}}` syntax)
3. Returning the processed content

**Note**: This is a basic implementation. In production, you might want to:
- Execute scripts defined in skills
- Make API calls
- Process data with custom logic
- Use a plugin system for different skill types

To customize skill execution, modify the `createSkillExecutor` function in `src/skill-parser.ts`.

## Error Handling

The server handles various error scenarios:

- **Missing required fields**: Throws clear error messages
- **Invalid parameter types**: Validates and reports issues
- **File parsing errors**: Catches and reports YAML parsing errors
- **Missing skills directory**: Warns but continues (server starts with no tools)

## Troubleshooting

### No skills loaded

- Check that `SKILLS_DIR` points to the correct directory
- Verify that files are named `SKILL.md` (case-sensitive)
- Check that files have valid YAML frontmatter

### Skills not executing

- Verify skill parameters match the schema
- Check that required parameters are provided
- Review server logs for error messages

### API errors

- Verify `GOOGLE_API_KEY` is set correctly
- Check that the API key has proper permissions
- Ensure network connectivity to Google's API

## Extending the Example

### Custom Skill Executors

Modify `createSkillExecutor` in `src/skill-parser.ts` to add custom execution logic:

```typescript
function createSkillExecutor(skill: LoadedSkill): (args: Record<string, any>) => Promise<string> {
  return async (args: Record<string, any>): Promise<string> => {
    // Check for custom executor type
    if (skill.metadata.executor === 'script') {
      // Execute a script
      return await executeScript(skill.metadata.script, args);
    } else if (skill.metadata.executor === 'api') {
      // Make API call
      return await callAPI(skill.metadata.apiUrl, args);
    }
    // Default behavior
    return skill.content;
  };
}
```

### File Watching

Add file watching to reload skills without restarting:

```typescript
import { watch } from 'fs';

watch(skillsDir, async (eventType, filename) => {
  if (filename.endsWith('SKILL.md')) {
    console.log('Skill file changed, reloading...');
    // Reload skills and re-register tools
  }
});
```

## Integration with EasyMCP Framework

This example demonstrates:

- ✅ Loading tools from external sources (files)
- ✅ Converting custom formats to `ToolRegistrationInput`
- ✅ Using `EasyMCP.initialize()` with dynamically loaded tools
- ✅ Graceful shutdown handling
- ✅ Error handling and validation

## License

MIT License - see the main repository LICENSE file.

## Support

For issues and questions:
- Open an issue in the main repository: [GitHub Issues](https://github.com/nirarazi/easy-mcp/issues)
- Review the main framework README: [EasyMCP README](../../README.md)

