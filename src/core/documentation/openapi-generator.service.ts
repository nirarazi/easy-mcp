import { Injectable } from "@nestjs/common";
import { ToolRegistryService } from "../../tooling/tool-registry/tool-registry.service";

/**
 * Service for generating OpenAPI documentation from tool definitions.
 */
@Injectable()
export class OpenApiGeneratorService {
  constructor(private readonly toolRegistry: ToolRegistryService) {}

  /**
   * Generates OpenAPI 3.0 specification from registered tools.
   */
  generateOpenApiSpec(info: { title: string; version: string }): any {
    const tools = this.toolRegistry.getToolSchemasForLLM();

    const spec: any = {
      openapi: "3.0.0",
      info: {
        title: info.title,
        version: info.version,
        description: "MCP Server API - Auto-generated from tool definitions",
      },
      paths: {},
      components: {
        schemas: {},
      },
    };

    // Generate paths for each tool
    for (const tool of tools) {
      const path = `/tools/${tool.function.name}`;
      spec.paths[path] = {
        post: {
          summary: tool.function.description,
          operationId: tool.function.name,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: tool.function.parameters,
              },
            },
          },
          responses: {
            "200": {
              description: "Tool execution result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      content: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            text: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid request",
            },
            "500": {
              description: "Tool execution error",
            },
          },
        },
      };
    }

    return spec;
  }

  /**
   * Generates a simple markdown documentation.
   */
  generateMarkdownDocs(info: { title: string; version: string }): string {
    const tools = this.toolRegistry.getToolSchemasForLLM();

    let markdown = `# ${info.title} API Documentation\n\n`;
    markdown += `Version: ${info.version}\n\n`;
    markdown += `## Tools\n\n`;

    for (const tool of tools) {
      markdown += `### ${tool.function.name}\n\n`;
      markdown += `${tool.function.description}\n\n`;

      if (tool.function.parameters.properties) {
        markdown += `#### Parameters\n\n`;
        for (const [paramName, paramDef] of Object.entries(tool.function.parameters.properties)) {
          markdown += `- **${paramName}** (${paramDef.type || "any"})`;
          if (paramDef.description) {
            markdown += `: ${paramDef.description}`;
          }
          markdown += `\n`;
        }
        markdown += `\n`;
      }
    }

    return markdown;
  }
}
