# Migration Guide: EasyMCP 2024-11-05 to 2025-11-25

This guide helps you migrate your EasyMCP server from protocol version 2024-11-05 to 2025-11-25.

## Breaking Changes

### 1. Protocol Version Update

**Before:**
```typescript
// Client must send protocol version 2024-11-05
```

**After:**
```typescript
// Client must send protocol version 2025-11-25
```

Update your MCP client configuration to use protocol version `2025-11-25`.

### 2. JSON Schema 2020-12 Migration

The most significant change is the migration from custom type system to JSON Schema 2020-12 format.

#### Tool Schema Format Change

**Before (2024-11-05):**
```typescript
{
  name: 'getUser',
  description: 'Retrieves user details',
  function: getUser,
  inputSchema: {
    type: 'OBJECT',  // Uppercase
    properties: {
      userId: {
        type: 'STRING',  // Uppercase
        description: 'The user ID',
      },
    },
    required: ['userId'],
  },
}
```

**After (2025-11-25):**
```typescript
{
  name: 'get_user',  // Lowercase with underscores (naming guidelines)
  description: 'Retrieves user details',
  function: getUser,
  inputSchema: {
    type: 'object',  // Lowercase - JSON Schema 2020-12
    properties: {
      userId: {
        type: 'string',  // Lowercase - JSON Schema 2020-12
        description: 'The user ID',
      },
    },
    required: ['userId'],
  },
  icon: 'https://example.com/icons/user.svg',  // Optional icon
}
```

#### Type Mapping

| Old Format (2024-11-05) | New Format (2025-11-25) |
|-------------------------|------------------------|
| `'OBJECT'` | `'object'` |
| `'STRING'` | `'string'` |
| `'NUMBER'` | `'number'` |
| `'INTEGER'` | `'integer'` |
| `'BOOLEAN'` | `'boolean'` |
| `'ARRAY'` | `'array'` |

#### Additional JSON Schema 2020-12 Features

You can now use additional JSON Schema 2020-12 features:

```typescript
{
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['active', 'inactive', 'pending'],
        default: 'active',  // Default values supported
      },
      metadata: {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      },
    },
    required: ['status'],
  },
}
```

### 3. Tool Naming Guidelines

Tool names are now validated according to MCP 2025-11-25 guidelines:

- Must start with a lowercase letter
- Can contain lowercase letters, numbers, underscores, and hyphens
- Should use underscores to separate words
- Must be 100 characters or less

**Before:**
```typescript
{ name: 'GetUser' }  // ❌ Invalid - uppercase
{ name: 'get-user' }  // ⚠️ Valid but not recommended
```

**After:**
```typescript
{ name: 'get_user' }  // ✅ Valid and recommended
{ name: 'getUser' }   // ⚠️ Valid but not following guidelines
```

## New Features

### 1. Resources Support

You can now register resources that clients can read:

```typescript
const config: McpConfig = {
  tools: [...],
  resources: [
    {
      uri: 'file:///path/to/document.md',
      name: 'Documentation',
      description: 'Project documentation',
      mimeType: 'text/markdown',
      icon: 'https://example.com/icons/doc.svg',
      getContent: async () => {
        return fs.readFileSync('/path/to/document.md', 'utf8');
      },
    },
  ],
};
```

### 2. Prompts Support

You can now register prompt templates:

```typescript
const config: McpConfig = {
  tools: [...],
  prompts: [
    {
      name: 'code_review',
      description: 'Generate a code review prompt',
      arguments: [
        { name: 'file_path', description: 'Path to the file', required: true },
        { name: 'language', description: 'Programming language' },
      ],
      icon: 'https://example.com/icons/review.svg',
      getPrompt: async (args) => {
        return [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please review the code in ${args.file_path}`,
              },
            ],
          },
        ];
      },
    },
  ],
};
```

### 3. Icons/Metadata Support

All tools, resources, and prompts can now include optional icons:

```typescript
{
  name: 'get_user',
  description: 'Gets user information',
  icon: 'https://example.com/icons/user.svg',  // Optional
  // ...
}
```

### 4. Cancellation Support

Tool functions can now accept a cancellation token:

```typescript
async function longRunningTool(
  args: Record<string, any>,
  cancellationToken?: CancellationToken
): Promise<string> {
  for (let i = 0; i < 100; i++) {
    if (cancellationToken?.isCancelled) {
      throw new Error('Operation cancelled');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return 'Done';
}
```

## Migration Steps

1. **Update Protocol Version**: Ensure your MCP client uses `2025-11-25`

2. **Update Tool Schemas**: Convert all tool schemas from uppercase types to lowercase JSON Schema 2020-12 format

3. **Update Tool Names**: Rename tools to follow naming guidelines (lowercase with underscores)

4. **Add Optional Features**: Consider adding icons, resources, or prompts to enhance your server

5. **Test Thoroughly**: Run your integration tests to ensure everything works correctly

## Example: Complete Migration

**Before:**
```typescript
const config: McpConfig = {
  tools: [
    {
      name: 'GetUser',
      description: 'Gets user by ID',
      function: getUser,
      inputSchema: {
        type: 'OBJECT',
        properties: {
          userId: {
            type: 'STRING',
            description: 'User ID',
          },
        },
        required: ['userId'],
      },
    },
  ],
};
```

**After:**
```typescript
const config: McpConfig = {
  tools: [
    {
      name: 'get_user',  // Lowercase with underscore
      description: 'Gets user by ID',
      function: getUser,
      inputSchema: {
        type: 'object',  // Lowercase
        properties: {
          userId: {
            type: 'string',  // Lowercase
            description: 'User ID',
          },
        },
        required: ['userId'],
      },
      icon: 'https://example.com/icons/user.svg',  // Optional
    },
  ],
  // New optional features
  resources: [...],
  prompts: [...],
};
```

## Need Help?

If you encounter issues during migration:

1. Check the [README](../README.md) for updated API documentation
2. Review the [Integration Testing Guide](INTEGRATION_TESTING.md)
3. Open an issue on GitHub with your migration questions

