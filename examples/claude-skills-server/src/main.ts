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
  const googleApiKey = process.env.GOOGLE_API_KEY;
  const vectorDbEndpoint = process.env.VECTOR_DB_ENDPOINT || 'https://your-vectordb.com';
  const vectorDbCollection = process.env.VECTOR_DB_COLLECTION || 'documents';

  // Validate required environment variables
  if (!googleApiKey) {
    throw new Error(
      'GOOGLE_API_KEY environment variable is required. ' +
      'Please set it in your .env file or environment.'
    );
  }

  console.log('='.repeat(60));
  console.log('Claude Skills MCP Server');
  console.log('='.repeat(60));
  console.log(`Skills directory: ${skillsDir}`);
  console.log(`VectorDB endpoint: ${vectorDbEndpoint}`);
  console.log(`VectorDB collection: ${vectorDbCollection}`);
  console.log('='.repeat(60));

  // Load skills from directory
  console.log('\nLoading Claude Skills...');
  const skills = await loadSkillsFromDirectory(skillsDir);

  if (skills.length === 0) {
    console.warn('No skills loaded. The server will start with no tools.');
  } else {
    console.log(`Successfully loaded ${skills.length} skill(s)\n`);
  }

  // Convert skills to tools
  const tools = parseSkillsToTools(skills);

  // Configure EasyMCP
  const config: McpConfig = {
    persistence: {
      type: 'FIRESTORE',
      appId: 'claude-skills-server',
      authToken: process.env.FIREBASE_AUTH_TOKEN || null,
      config: (() => {
        if (process.env.FIREBASE_CONFIG) {
          try {
            return JSON.parse(process.env.FIREBASE_CONFIG);
          } catch (error) {
            throw new Error(
              `Failed to parse FIREBASE_CONFIG environment variable: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
        // Default Firebase config (for development)
        // In production, provide proper Firebase config via FIREBASE_CONFIG env var
        return {
          projectId: 'claude-skills-dev',
        };
      })(),
    },
    llmProvider: {
      model: process.env.LLM_MODEL || 'gemini-1.5-flash',
      apiKey: googleApiKey,
      systemInstruction:
        process.env.SYSTEM_INSTRUCTION ||
        'You are a helpful assistant with access to Claude Skills. ' +
        'Use the available tools to help users accomplish their tasks.',
    },
    ltmConfig: {
      vectorDB: {
        type: 'VECTOR_DB_SERVICE',
        endpoint: vectorDbEndpoint,
        collectionName: vectorDbCollection,
      },
      retrievalK: parseInt(process.env.RETRIEVAL_K || '3', 10),
    },
    tools,
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

