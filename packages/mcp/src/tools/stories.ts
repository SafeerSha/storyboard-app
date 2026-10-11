import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ActorContext } from "../types/context.js";
import { StoryService } from "../services/story-service.js";
import { formatToolError, formatToolSuccess, withTimeout } from "../utils/errors.js";

export function registerStoryTools(server: McpServer, actor: ActorContext, timeoutMs: number) {
  // 1. reqly_list_stories (Read-only)
  server.registerTool(
    "reqly_list_stories",
    {
      description: "List stories within a project, optionally filtered by epic or lifecycle status.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("UUID of the project"),
        epicId: z.string().uuid().optional().describe("Optional filter by epic UUID"),
        status: z
          .enum(["new", "active", "done", "all"])
          .optional()
          .default("all")
          .describe("Filter by lifecycle status ('new', 'active', 'done', 'all')"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(50)
          .describe("Number of stories to return (max 100)"),
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
          StoryService.listStories(actor, args),
          timeoutMs,
          "reqly_list_stories"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 2. reqly_get_story (Read-only)
  server.registerTool(
    "reqly_get_story",
    {
      description: "Retrieve comprehensive details for a single story, including acceptance criteria, assumptions, clarifications, and review statuses.",
      inputSchema: z.object({
        storyId: z.string().uuid().describe("UUID of the story to fetch"),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          StoryService.getStory(actor, args.storyId),
          timeoutMs,
          "reqly_get_story"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 3. reqly_get_pending_reviews (Read-only)
  server.registerTool(
    "reqly_get_pending_reviews",
    {
      description: "Retrieve all pending story reviews assigned to the authenticated team member across accessible projects. Optionally filter by project.",
      inputSchema: z.object({
        projectId: z.string().uuid().optional().describe("Optional filter by project UUID"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(50)
          .describe("Number of reviews to return (max 100)"),
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
          StoryService.getPendingReviews(actor, args),
          timeoutMs,
          "reqly_get_pending_reviews"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 4. reqly_create_story (Write)
  server.registerTool(
    "reqly_create_story",
    {
      description: "Create a feature story with acceptance criteria, assumptions, and clarifications assigned to an epic.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("Target project UUID"),
        epicId: z.string().uuid().describe("Epic UUID this story belongs to"),
        title: z.string().min(1).max(500).describe("User story title"),
        description: z.string().max(10000).optional().default("").describe("Detailed scenario or specification"),
        acceptanceCriteria: z
          .array(z.string().min(1))
          .min(1)
          .describe("Array of verifiable acceptance criteria (must have at least one)"),
        assumptions: z.array(z.string()).optional().default([]).describe("Technical or scope assumptions"),
        clarifications: z.array(z.string()).optional().default([]).describe("Resolved clarifications"),
        status: z
          .enum(["new", "active", "done"])
          .optional()
          .default("new")
          .describe("Initial lifecycle status (default: 'new')"),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          StoryService.createStory(actor, args),
          timeoutMs,
          "reqly_create_story"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 5. reqly_update_story (Write)
  server.registerTool(
    "reqly_update_story",
    {
      description: "Update a story's content or acceptance criteria. Automatically creates a revision snapshot in story_revisions and resets approval status if changes are material.",
      inputSchema: z.object({
        storyId: z.string().uuid().describe("UUID of the story to update"),
        title: z.string().min(1).max(500).optional().describe("Updated story title"),
        description: z.string().max(10000).optional().describe("Updated story description"),
        acceptanceCriteria: z.array(z.string()).optional().describe("Updated acceptance criteria list"),
        assumptions: z.array(z.string()).optional().describe("Updated assumptions list"),
        clarifications: z.array(z.string()).optional().describe("Updated clarifications list"),
        epicId: z.string().uuid().optional().describe("Move story to another epic in the same project"),
      }),
    },
    async (args) => {
      try {
        const { storyId, ...updateFields } = args;
        const result = await withTimeout(
          StoryService.updateStory(actor, storyId, updateFields),
          timeoutMs,
          "reqly_update_story"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 6. reqly_update_story_status (Write)
  server.registerTool(
    "reqly_update_story_status",
    {
      description: "Update the lifecycle status ('new', 'active', 'done') or team review status of a story.",
      inputSchema: z.object({
        storyId: z.string().uuid().describe("UUID of the story to update"),
        status: z.enum(["new", "active", "done"]).optional().describe("Lifecycle status"),
        teamReviewStatus: z
          .enum(["pending", "approved", "changes_requested"])
          .optional()
          .describe("Team review status"),
      }),
    },
    async (args) => {
      try {
        const { storyId, ...statusFields } = args;
        const result = await withTimeout(
          StoryService.updateStoryStatus(actor, storyId, statusFields),
          timeoutMs,
          "reqly_update_story_status"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );
}
