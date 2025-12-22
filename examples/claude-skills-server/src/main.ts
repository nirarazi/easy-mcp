import { EasyMCP, McpConfig } from 'easy-mcp-framework';
import { loadSkillsFromDirectory } from './skill-loader';
import { parseSkillsToTools } from './skill-parser';
import { join } from 'path';

/**
 * Main entry point for the Claude Skills MCP Server
 */
async function bootstrap() {
  // Get configuration from environment variables
  const skillsDir = process.env.SKILLS_DIR || join(process.cwd(), 'skills');

  console.log('='.repeat(60));
  console.log('Claude Skills MCP Server');
  console.log('='.repeat(60));
  console.log(`Skills directory: ${skillsDir}`);
  console.log('='.repeat(60));

  // Load skills from directory
  console.log('\nLoading Claude Skills...');
  const skills = await loadSkillsFromDirectory(skillsDir);

  if (skills.length === 0) {
    throw new Error('No skills loaded. At least one skill is required.');
  }

  console.log(`Successfully loaded ${skills.length} skill(s)\n`);

  // Convert skills to tools
  const tools = parseSkillsToTools(skills);

  // Configure EasyMCP
  const config: McpConfig = {
    tools,
    serverInfo: {
      name: 'claude-skills-server',
      version: '1.0.0',
    },
  };

  // Initialize EasyMCP
  console.log('Initializing EasyMCP Framework...');
  await EasyMCP.initialize(config);

  // Start the MCP server
  console.log('Starting MCP server...');
  await EasyMCP.run();

  console.log('\n✅ MCP Server is running and ready to accept connections!');
  console.log('Press Ctrl+C to stop the server.\n');
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  await EasyMCP.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  await EasyMCP.shutdown();
  process.exit(0);
});

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

