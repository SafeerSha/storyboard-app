import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ActorContext } from "../types/context.js";
import { ProjectService } from "../services/project-service.js";
import { formatToolError, formatToolSuccess, withTimeout } from "../utils/errors.js";

export function registerProjectTools(server: McpServer, actor: ActorContext, timeoutMs: number) {
  // 1. reqly_list_projects (Read-only)
  server.registerTool(
    "reqly_list_projects",
    {
      description: "List projects accessible to the current user with story and epic counts.",
      inputSchema: z.object({
        status: z
          .enum(["active", "completed", "archived", "all"])
          .optional()
          .default("active")
          .describe("Filter by project status (default: 'active')"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(20)
          .describe("Page limit between 1 and 50"),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .default(0)
          .describe("Pagination offset"),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          ProjectService.listProjects(actor, args),
          timeoutMs,
          "reqly_list_projects"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 2. reqly_get_project (Read-only)
  server.registerTool(
    "reqly_get_project",
    {
      description: "Retrieve comprehensive details and metrics for a specific project.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("UUID of the project to retrieve"),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          ProjectService.getProject(actor, args.projectId),
          timeoutMs,
          "reqly_get_project"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 3. reqly_create_project (Write)
  server.registerTool(
    "reqly_create_project",
    {
      description: "Create a new Reqly project owned by the current authenticated user.",
      inputSchema: z.object({
        name: z.string().min(1).max(200).describe("Name of the project"),
        description: z.string().max(5000).optional().describe("Project description or scope notes"),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          ProjectService.createProject(actor, args),
          timeoutMs,
          "reqly_create_project"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 4. reqly_update_project (Write)
  server.registerTool(
    "reqly_update_project",
    {
      description: "Update the name, description, or status of an existing project.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("UUID of the project to update"),
        name: z.string().min(1).max(200).optional().describe("New project name"),
        description: z.string().max(5000).optional().describe("New project description"),
        status: z.enum(["active", "completed", "archived"]).optional().describe("New project status"),
      }),
    },
    async (args) => {
      try {
        const { projectId, ...updateFields } = args;
        const result = await withTimeout(
          ProjectService.updateProject(actor, projectId, updateFields),
          timeoutMs,
          "reqly_update_project"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );
}
