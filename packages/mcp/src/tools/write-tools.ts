import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ActorContext } from "../types/context.js";
import { EpicService } from "../services/epic-service.js";
import { StoryService } from "../services/story-service.js";
import { formatToolError, formatToolSuccess, withTimeout } from "../utils/errors.js";

/**
 * Registers authoritative write tools for Reqly on the MCP Server instance:
 * 1. create_epic
 * 2. create_story
 * 3. update_story
 * 4. add_acceptance_criteria
 *
 * All operations are strictly bound to the authenticated actor's permissions.
 */
export function registerWriteTools(server: McpServer, actor: ActorContext, timeoutMs: number = 15000) {
  // 1. create_epic
  server.registerTool(
    "create_epic",
    {
      description:
        "Create a new epic within a Reqly project. Requires the target project ID and epic title. Supports description, priority ('low', 'medium', 'high'), initial Kanban status, and ordering. Returns persisted epic details.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("UUID of the target project in Reqly"),
        title: z.string().min(1).max(200).describe("Title / name of the epic"),
        description: z
          .string()
          .max(5000)
          .optional()
          .describe("Epic scope, objectives, or context"),
        priority: z
          .enum(["low", "medium", "high"])
          .optional()
          .default("medium")
          .describe("Epic priority level (default: 'medium')"),
        status: z
          .enum(["backlog", "todo", "in_progress", "qa_review", "done", "active"])
          .optional()
          .default("backlog")
          .describe("Initial Kanban status (default: 'backlog')"),
        sortOrder: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Display order index for the epic (default: 0)"),
        idempotencyKey: z
          .string()
          .max(128)
          .optional()
          .describe("Optional unique idempotency token to avoid duplicate creation on network retries"),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          EpicService.createEpic(actor, {
            projectId: args.projectId,
            title: args.title,
            description: args.description,
            priority: args.priority,
            status: args.status,
            sortOrder: args.sortOrder,
            idempotencyKey: args.idempotencyKey,
          }),
          timeoutMs,
          "create_epic"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 2. create_story
  server.registerTool(
    "create_story",
    {
      description:
        "Create a feature story under an epic in a Reqly project. Requires project ID, parent epic ID, and story title. Validates parent epic relationship. Supports acceptance criteria, assumptions, clarifications, and lifecycle status.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("UUID of the target project in Reqly"),
        epicId: z.string().uuid().describe("UUID of the parent epic that contains this story"),
        title: z.string().min(1).max(500).describe("User story title (e.g. 'As a user, I want...')"),
        description: z
          .string()
          .max(10000)
          .optional()
          .default("")
          .describe("Detailed scenario or specification"),
        acceptanceCriteria: z
          .array(z.string().min(1))
          .optional()
          .default([])
          .describe("Array of verifiable acceptance criteria strings matching Reqly data model"),
        assumptions: z
          .array(z.string())
          .optional()
          .default([])
          .describe("Technical or scope assumptions"),
        clarifications: z
          .array(z.string())
          .optional()
          .default([])
          .describe("Resolved clarifications or constraints"),
        status: z
          .enum([
            "new",
            "active",
            "done",
            "draft",
            "review",
            "changes_requested",
            "approved",
            "in_development",
            "completed",
          ])
          .optional()
          .default("new")
          .describe("Initial lifecycle status (default: 'new')"),
        storyType: z
          .string()
          .optional()
          .describe("Optional story classification tag"),
        priority: z
          .enum(["low", "medium", "high"])
          .optional()
          .describe("Optional story priority tag (epics hold priority in Reqly)"),
        idempotencyKey: z
          .string()
          .max(128)
          .optional()
          .describe("Optional unique idempotency token to avoid duplicate creation on network retries"),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          StoryService.createStory(actor, args),
          timeoutMs,
          "create_story"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 3. update_story
  server.registerTool(
    "update_story",
    {
      description:
        "Update an existing story's title, description, acceptance criteria, assumptions, clarifications, epic, or status. Automatically creates revision snapshots in story_revisions on material changes and resets approved status to review.",
      inputSchema: z.object({
        storyId: z.string().uuid().describe("UUID of the story to update"),
        title: z.string().min(1).max(500).optional().describe("Updated story title"),
        description: z.string().max(10000).optional().describe("Updated story description"),
        acceptanceCriteria: z
          .array(z.string().min(1))
          .optional()
          .describe("Complete updated array of acceptance criteria"),
        assumptions: z.array(z.string()).optional().describe("Updated technical assumptions"),
        clarifications: z.array(z.string()).optional().describe("Updated clarifications"),
        epicId: z
          .string()
          .uuid()
          .optional()
          .describe("Move story to another epic in the same project"),
        status: z
          .enum([
            "new",
            "active",
            "done",
            "draft",
            "review",
            "changes_requested",
            "approved",
            "in_development",
            "completed",
          ])
          .optional()
          .describe("Updated lifecycle status"),
      }),
    },
    async (args) => {
      try {
        const { storyId, ...fields } = args;
        const result = await withTimeout(
          StoryService.updateStory(actor, storyId, fields),
          timeoutMs,
          "update_story"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 4. add_acceptance_criteria
  server.registerTool(
    "add_acceptance_criteria",
    {
      description:
        "Append one or more acceptance criteria to an existing story. Matches Reqly's native array storage model without schema changes, tracks revision snapshots, and resets approval to review if modified.",
      inputSchema: z.object({
        storyId: z.string().uuid().describe("UUID of the target story"),
        criteria: z
          .union([
            z.string().min(1).describe("Single acceptance criterion string"),
            z.array(z.string().min(1)).min(1).describe("Array of acceptance criteria strings"),
          ])
          .describe("Acceptance criteria item(s) to append to the story"),
        idempotencyKey: z
          .string()
          .max(128)
          .optional()
          .describe("Optional unique idempotency token to avoid duplicate append on network retries"),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          StoryService.addAcceptanceCriteria(actor, args.storyId, {
            criteria: args.criteria,
            idempotencyKey: args.idempotencyKey,
          }),
          timeoutMs,
          "add_acceptance_criteria"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );
}
