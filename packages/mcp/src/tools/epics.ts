import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ActorContext } from "../types/context.js";
import { EpicService } from "../services/epic-service.js";
import { formatToolError, formatToolSuccess, withTimeout } from "../utils/errors.js";

export function registerEpicTools(server: McpServer, actor: ActorContext, timeoutMs: number) {
  // 1. reqly_list_epics (Read-only)
  server.registerTool(
    "reqly_list_epics",
    {
      description: "List all epics for a project ordered by created_at DESC (newest first), with priority and story counts.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("UUID of the project"),
        status: z
          .enum(["all", "backlog", "todo", "in_progress", "qa_review", "done"])
          .optional()
          .default("all")
          .describe("Filter by Kanban status"),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          EpicService.listEpics(actor, args),
          timeoutMs,
          "reqly_list_epics"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 2. reqly_get_epic (Read-only)
  server.registerTool(
    "reqly_get_epic",
    {
      description: "Retrieve details for a single epic including its priority and story count.",
      inputSchema: z.object({
        epicId: z.string().uuid().describe("UUID of the epic"),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          EpicService.getEpic(actor, args.epicId),
          timeoutMs,
          "reqly_get_epic"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 3. reqly_create_epic (Write)
  server.registerTool(
    "reqly_create_epic",
    {
      description: "Create a new epic within a project, specifying priority and Kanban status.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Target project UUID"),
        name: z.string().min(1).max(200).describe("Name/title of the epic"),
        description: z.string().max(5000).optional().describe("Epic scope and objectives"),
        priority: z.enum(["low", "medium", "high"]).optional().default("medium").describe("Epic priority level"),
        status: z
          .enum(["backlog", "todo", "in_progress", "qa_review", "done"])
          .optional()
          .default("backlog")
          .describe("Initial Kanban status (default: 'backlog')"),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          EpicService.createEpic(actor, args),
          timeoutMs,
          "reqly_create_epic"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 4. reqly_update_epic (Write)
  server.registerTool(
    "reqly_update_epic",
    {
      description: "Update an epic's name, description, priority, or status.",
      inputSchema: z.object({
        epicId: z.string().uuid().describe("UUID of the epic to update"),
        name: z.string().min(1).max(200).optional().describe("New epic name"),
        description: z.string().max(5000).optional().describe("New description"),
        priority: z.enum(["low", "medium", "high"]).optional().describe("New priority"),
        status: z
          .enum(["backlog", "todo", "in_progress", "qa_review", "done"])
          .optional()
          .describe("New Kanban status"),
      }),
    },
    async (args) => {
      try {
        const { epicId, ...updateFields } = args;
        const result = await withTimeout(
          EpicService.updateEpic(actor, epicId, updateFields),
          timeoutMs,
          "reqly_update_epic"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );
}
