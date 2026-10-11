import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ActorContext } from "../types/context.js";
import { ProjectService } from "../services/project-service.js";
import { EpicService } from "../services/epic-service.js";
import { StoryService } from "../services/story-service.js";
import { formatToolError, formatToolSuccess, withTimeout } from "../utils/errors.js";

/**
 * Registers the 6 authoritative read-only tools for Reqly on the MCP Server instance.
 * All operations are strictly scoped to the authenticated actor's permissions.
 */
export function registerReadOnlyTools(server: McpServer, actor: ActorContext, timeoutMs: number = 15000) {
  // 1. list_projects
  server.registerTool(
    "list_projects",
    {
      description:
        "List all Reqly projects accessible to the authenticated user. Includes project status and summary counts of epics and stories. Use this tool first when discovering existing projects.",
      inputSchema: z.object({
        status: z
          .enum(["active", "completed", "archived", "all"])
          .optional()
          .default("active")
          .describe("Filter projects by lifecycle status. Default is 'active'."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(20)
          .describe("Maximum number of projects to return (1-50, default 20)."),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .default(0)
          .describe("Pagination offset (0 or positive integer)."),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          ProjectService.listProjects(actor, args),
          timeoutMs,
          "list_projects"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 2. get_project_details
  server.registerTool(
    "get_project_details",
    {
      description:
        "Retrieve comprehensive details for a specific project by UUID, including story status metrics, assigned team members, and client portal status. Never reveals private contact info or secrets.",
      inputSchema: z.object({
        projectId: z.string().uuid("Invalid project UUID format").describe("Unique UUID of the target project."),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          ProjectService.getProjectDetails(actor, args.projectId),
          timeoutMs,
          "get_project_details"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 3. list_epics
  server.registerTool(
    "list_epics",
    {
      description:
        "List all epics belonging to a specific project. Epics represent major feature domains and are strictly ordered newest first (created_at DESC). Includes priority and story counts.",
      inputSchema: z.object({
        projectId: z.string().uuid("Invalid project UUID format").describe("Unique UUID of the project."),
        status: z
          .enum(["all", "backlog", "todo", "in_progress", "qa_review", "done"])
          .optional()
          .default("all")
          .describe("Optional filter by Kanban column status."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(50)
          .describe("Page limit between 1 and 100."),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .default(0)
          .describe("Pagination offset."),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          EpicService.listEpics(actor, args),
          timeoutMs,
          "list_epics"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 4. list_stories
  server.registerTool(
    "list_stories",
    {
      description:
        "List user stories within a project, optionally filtered by epic, story lifecycle status, or dual-review status. Stories are ordered by updated_at DESC.",
      inputSchema: z.object({
        projectId: z.string().uuid("Invalid project UUID format").describe("Unique UUID of the project."),
        epicId: z.string().uuid("Invalid epic UUID format").optional().describe("Optional filter by specific epic UUID."),
        status: z
          .enum(["all", "new", "active", "done", "draft", "review", "changes_requested", "approved", "in_development", "completed"])
          .optional()
          .default("all")
          .describe("Filter by story lifecycle status."),
        teamReviewStatus: z
          .enum(["all", "pending", "approved", "changes_requested"])
          .optional()
          .default("all")
          .describe("Filter by team review status."),
        clientReviewStatus: z
          .enum(["all", "pending", "approved", "changes_requested"])
          .optional()
          .default("all")
          .describe("Filter by client review status."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(50)
          .describe("Number of stories to return (1-100, default 50)."),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .default(0)
          .describe("Pagination offset."),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          StoryService.listStories(actor, args),
          timeoutMs,
          "list_stories"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 5. get_story_details
  server.registerTool(
    "get_story_details",
    {
      description:
        "Retrieve full specification for a single story: acceptance criteria list, assumptions, clarifications, review approvals, assigned reviewers, and revision history count.",
      inputSchema: z.object({
        storyId: z.string().uuid("Invalid story UUID format").describe("Unique UUID of the story to inspect."),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          StoryService.getStoryDetails(actor, args.storyId),
          timeoutMs,
          "get_story_details"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );

  // 6. get_pending_reviews
  server.registerTool(
    "get_pending_reviews",
    {
      description:
        "Fetch stories currently awaiting review across one or all accessible projects. Returns stories pending team review, client review, or in general review status. Essential for review workflows.",
      inputSchema: z.object({
        projectId: z
          .string()
          .uuid("Invalid project UUID format")
          .optional()
          .describe("Optional project UUID filter. If omitted, searches across all projects accessible to the user."),
        reviewType: z
          .enum(["team", "client", "any"])
          .optional()
          .default("any")
          .describe("Type of review required: 'team' (internal reviewer), 'client' (client portal), or 'any'."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(20)
          .describe("Maximum stories to return (1-50, default 20)."),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .default(0)
          .describe("Pagination offset."),
      }),
    },
    async (args) => {
      try {
        const result = await withTimeout(
          StoryService.getPendingReviews(actor, args),
          timeoutMs,
          "get_pending_reviews"
        );
        return formatToolSuccess(result);
      } catch (err) {
        return formatToolError(err);
      }
    }
  );
}
