import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InboxActor } from "@/lib/inbox-auth";
import { generateStories } from "./gemini";

export interface ActionReceipt {
  type: "story_created" | "task_created" | "story_updated" | "stories_bulk_created";
  title: string;
  id?: string;
  projectId?: string;
  epicId?: string;
  details?: Record<string, any>;
  url?: string;
}

export interface WorkspaceCopilotResponse {
  content: string;
  actionReceipts: ActionReceipt[];
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

const COPILOT_SYSTEM_PROMPT = `
You are StoryBoard Copilot, an elite full-stack product and engineering assistant embedded directly inside StoryBoard (Reqly).
Your purpose is to assist developers, freelancers, and project managers in running high-velocity software projects.

YOUR CAPABILITIES & POWERS:
1. Grounded Context: You have access to real-time project context, epics, user stories, acceptance criteria, and tasks.
2. Action Execution: You can execute actions on behalf of the user using your tools:
   - Create user stories with consolidated, client-ready acceptance criteria.
   - Create actionable development tasks with priorities (low, medium, high, urgent) and statuses.
   - Break down vague client requirements into structured stories.
   - Update story statuses.
   - Inspect workspace overview and project details.

BEHAVIORAL & VISUAL PRINCIPLES:
- Be concise, direct, and structured.
- Always provide clickable links for projects: [Project Name](/project/{projectId}) instead of raw text or raw UUIDs.
- Avoid dumping long 36-character raw UUID strings in tables. When listing projects, include the link [Project Name](/project/{id}), short description, and last updated time.
- For checklists or acceptance criteria, format with markdown checkboxes:
  - [ ] Acceptance criteria item
- When breaking down tasks, always specify priority (urgent, high, medium, low) and status (todo, in_progress, done).
- If a project ID is provided in context, default to using it unless the user specifies otherwise.
- Never invent or hallucinate fake project IDs. If no project ID is selected and you need one, list available projects and ask the user which project they want to target.
`.trim();

export async function processWorkspaceCopilotMessage({
  actor,
  prompt,
  history = [],
  activeProjectId,
}: {
  actor: InboxActor;
  prompt: string;
  history?: ChatHistoryMessage[];
  activeProjectId?: string | null;
}): Promise<WorkspaceCopilotResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const admin = createAdminClient();

  // Define Function Declarations for Gemini Tool Calling
  const functionDeclarations: any[] = [
    {
      name: "get_workspace_overview",
      description: "Get a high-level summary of all accessible projects, total story counts, and open tasks for the user.",
      parameters: {
        type: "object",
        properties: {
          includeStats: { type: "boolean", description: "Whether to include counts of stories and tasks" },
        },
      },
    },
    {
      name: "list_projects",
      description: "List projects accessible to the user with their names, descriptions, and IDs.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max projects to return (default 10)" },
        },
      },
    },
    {
      name: "get_project_context",
      description: "Get detailed information for a specific project including its epics, stories, and pending tasks.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "The UUID of the project" },
        },
        required: ["projectId"],
      },
    },
    {
      name: "create_story",
      description: "Create a new user story under a project and epic with clear acceptance criteria.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "UUID of the project" },
          epicId: { type: "string", description: "UUID of the epic (optional; if not known, top epic is selected)" },
          title: { type: "string", description: "Clear, action-oriented story title" },
          description: { type: "string", description: "Short 1-2 sentence description" },
          acceptanceCriteria: {
            type: "array",
            items: { type: "string" },
            description: "List of concise, behavior-driven acceptance criteria strings",
          },
          assumptions: {
            type: "array",
            items: { type: "string" },
            description: "List of assumptions",
          },
          clarifications: {
            type: "array",
            items: { type: "string" },
            description: "List of open clarifications",
          },
        },
        required: ["projectId", "title", "description", "acceptanceCriteria"],
      },
    },
    {
      name: "create_task",
      description: "Create a development/engineering task linked to a project and optional story.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "UUID of the project" },
          storyId: { type: "string", description: "UUID of the story (optional)" },
          title: { type: "string", description: "Concise actionable task title" },
          description: { type: "string", description: "Task details or acceptance steps" },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            description: "Task priority level",
          },
          status: {
            type: "string",
            enum: ["todo", "in_progress", "in_review", "done"],
            description: "Task status (default todo)",
          },
          category: {
            type: "string",
            enum: ["frontend", "backend", "fullstack", "test"],
            description: "Optional task engineering category",
          },
        },
        required: ["projectId", "title"],
      },
    },
    {
      name: "breakdown_and_create_stories",
      description: "Take a raw feature requirement, break it down into multiple deliverable feature stories using AI, and save them directly to the specified project and epic.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "UUID of the project" },
          epicId: { type: "string", description: "UUID of the target epic (optional)" },
          rawRequirement: { type: "string", description: "The client requirement or feature description" },
        },
        required: ["projectId", "rawRequirement"],
      },
    },
  ];

  // Tool Executor Map
  const actionReceipts: ActionReceipt[] = [];

  const executeTool = async (name: string, args: any): Promise<any> => {
    try {
      if (name === "list_projects") {
        const limit = args.limit || 10;
        let query = admin.from("projects").select("id, name, description, updated_at").order("updated_at", { ascending: false }).limit(limit);
        if (!actor.isSuperAdmin && actor.type === "freelancer") {
          query = query.eq("owner_id", actor.id);
        }
        const { data: projects, error } = await query;
        if (error) return { error: error.message };
        return {
          projects: projects?.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description || "",
            updatedAt: p.updated_at,
          })),
        };
      }

      if (name === "get_workspace_overview") {
        let projectsQuery = admin.from("projects").select("id, name");
        if (!actor.isSuperAdmin && actor.type === "freelancer") {
          projectsQuery = projectsQuery.eq("owner_id", actor.id);
        }
        const { data: projects } = await projectsQuery;
        const projectIds = (projects || []).map((p) => p.id);

        let storiesCount = 0;
        let tasksCount = 0;

        if (projectIds.length > 0) {
          const { count: sCount } = await admin
            .from("stories")
            .select("id", { count: "exact", head: true })
            .in("project_id", projectIds);
          storiesCount = sCount || 0;

          const { count: tCount } = await admin
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .in("project_id", projectIds)
            .neq("status", "done");
          tasksCount = tCount || 0;
        }

        return {
          totalProjects: projects?.length || 0,
          projectsSummary: projects?.slice(0, 5).map((p) => ({ id: p.id, name: p.name })),
          totalStories: storiesCount,
          openTasksCount: tasksCount,
          activeProjectId: activeProjectId || null,
        };
      }

      if (name === "get_project_context") {
        const targetProjectId = args.projectId || activeProjectId;
        if (!targetProjectId) return { error: "No projectId provided." };

        const { data: project } = await admin
          .from("projects")
          .select("id, name, description")
          .eq("id", targetProjectId)
          .maybeSingle();

        if (!project) return { error: "Project not found." };

        const { data: epics } = await admin
          .from("epics")
          .select("id, name, description, status, priority")
          .eq("project_id", targetProjectId)
          .order("sort_order", { ascending: true });

        const { data: stories } = await admin
          .from("stories")
          .select("id, epic_id, title, description, status, acceptance_criteria")
          .eq("project_id", targetProjectId)
          .order("created_at", { ascending: false })
          .limit(15);

        const { data: tasks } = await admin
          .from("tasks")
          .select("id, title, status, priority, category")
          .eq("project_id", targetProjectId)
          .order("updated_at", { ascending: false })
          .limit(15);

        return {
          project,
          epics: epics || [],
          stories: stories || [],
          tasks: tasks || [],
        };
      }

      if (name === "create_story") {
        const targetProjectId = args.projectId || activeProjectId;
        if (!targetProjectId) return { error: "Missing projectId." };

        let targetEpicId = args.epicId;
        if (!targetEpicId) {
          // Find first available epic or default
          const { data: firstEpic } = await admin
            .from("epics")
            .select("id")
            .eq("project_id", targetProjectId)
            .order("sort_order", { ascending: true })
            .limit(1)
            .maybeSingle();
          targetEpicId = firstEpic?.id || null;
        }

        const { data: story, error } = await admin
          .from("stories")
          .insert({
            project_id: targetProjectId,
            epic_id: targetEpicId,
            title: args.title,
            description: args.description || "",
            acceptance_criteria: args.acceptanceCriteria || [],
            assumptions: args.assumptions || [],
            clarifications: args.clarifications || [],
            status: "draft",
          })
          .select("id, title, project_id, epic_id, status")
          .single();

        if (error) return { error: error.message };

        const receipt: ActionReceipt = {
          type: "story_created",
          title: story.title,
          id: story.id,
          projectId: story.project_id,
          epicId: story.epic_id,
          url: `/project/${story.project_id}`,
        };
        actionReceipts.push(receipt);

        return { success: true, story, message: `Story '${story.title}' created successfully.` };
      }

      if (name === "create_task") {
        const targetProjectId = args.projectId || activeProjectId;
        if (!targetProjectId) return { error: "Missing projectId." };

        const { data: task, error } = await admin
          .from("tasks")
          .insert({
            project_id: targetProjectId,
            story_id: args.storyId || null,
            title: args.title,
            description: args.description || "",
            priority: args.priority || "medium",
            status: args.status || "todo",
            category: args.category || "fullstack",
          })
          .select("id, title, priority, status, project_id")
          .single();

        if (error) return { error: error.message };

        const receipt: ActionReceipt = {
          type: "task_created",
          title: task.title,
          id: task.id,
          projectId: task.project_id,
          details: { priority: task.priority, status: task.status },
          url: `/tasks?projectId=${task.project_id}`,
        };
        actionReceipts.push(receipt);

        return { success: true, task, message: `Task '${task.title}' created successfully.` };
      }

      if (name === "breakdown_and_create_stories") {
        const targetProjectId = args.projectId || activeProjectId;
        if (!targetProjectId) return { error: "Missing projectId." };

        let targetEpicId = args.epicId;
        if (!targetEpicId) {
          const { data: firstEpic } = await admin
            .from("epics")
            .select("id")
            .eq("project_id", targetProjectId)
            .order("sort_order", { ascending: true })
            .limit(1)
            .maybeSingle();
          targetEpicId = firstEpic?.id || null;
        }

        // Call our specialized breakdown generator
        const generated = await generateStories(args.rawRequirement);
        const storiesToInsert = generated.stories.map((s) => ({
          project_id: targetProjectId,
          epic_id: targetEpicId,
          raw_requirement: args.rawRequirement,
          title: s.title,
          description: s.description,
          acceptance_criteria: s.acceptanceCriteria,
          assumptions: s.assumptions || [],
          clarifications: s.clarifications || [],
          status: "draft",
        }));

        const { data: insertedStories, error } = await admin
          .from("stories")
          .insert(storiesToInsert)
          .select("id, title, status");

        if (error) return { error: error.message };

        const receipt: ActionReceipt = {
          type: "stories_bulk_created",
          title: `Generated ${insertedStories?.length || 0} stories from requirement`,
          projectId: targetProjectId,
          epicId: targetEpicId,
          details: { count: insertedStories?.length || 0, storyTitles: insertedStories?.map((s) => s.title) },
          url: `/project/${targetProjectId}`,
        };
        actionReceipts.push(receipt);

        return {
          success: true,
          count: insertedStories?.length || 0,
          stories: insertedStories,
        };
      }

      return { error: `Unknown tool: ${name}` };
    } catch (err: any) {
      return { error: err.message || "Failed executing tool" };
    }
  };

  // Build Context Header
  let contextHeader = `USER: ${actor.name} (${actor.emailOrUsername}), Role: ${actor.type}\n`;
  if (activeProjectId) {
    contextHeader += `ACTIVE PROJECT ID: ${activeProjectId}\n(The user is currently on this project page. Target this project unless instructed otherwise.)\n`;
  }

  // Format History for Gemini Content
  const contents: any[] = [];
  const boundedHistory = history.slice(-8);
  for (const h of boundedHistory) {
    contents.push({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content }],
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: `${contextHeader}\nUser Request: ${prompt}` }],
  });

  // Call Gemini Model with Tools
  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: COPILOT_SYSTEM_PROMPT,
      tools: [{ functionDeclarations }],
    },
  });

  const candidate = response.candidates?.[0];
  const functionCalls = response.functionCalls || [];

  // If Gemini decided to call tools, execute them and perform follow-up turn
  if (functionCalls.length > 0) {
    const modelParts = candidate?.content?.parts || [];
    const functionResponseParts: any[] = [];
    const toolResultsMap: Record<string, any> = {};

    for (const fc of functionCalls) {
      if (!fc.name) continue;
      const toolResult = await executeTool(fc.name, fc.args);
      toolResultsMap[fc.name] = toolResult;

      functionResponseParts.push({
        functionResponse: {
          id: fc.id || `call_${Date.now()}`,
          name: fc.name,
          response: { output: toolResult },
        },
      });
    }

    // Follow-up call so Gemini translates tool execution results into a user-friendly answer
    const followUpContents = [
      ...contents,
      { role: "model", parts: modelParts },
      { role: "user", parts: functionResponseParts },
    ];

    let finalReply = "";

    try {
      const followUpResponse = await ai.models.generateContent({
        model,
        contents: followUpContents,
        config: {
          systemInstruction: COPILOT_SYSTEM_PROMPT,
        },
      });

      finalReply =
        followUpResponse.text ||
        followUpResponse.candidates?.[0]?.content?.parts
          ?.filter((p: any) => !p.thought && p.text)
          ?.map((p: any) => p.text)
          .join("\n\n") ||
        "";
    } catch (err: any) {
      console.error("Workspace Copilot follow-up error:", err);
    }

    // Fallback if LLM output was too brief or empty
    if (!finalReply || finalReply.trim() === "Action executed successfully.") {
      if (toolResultsMap["get_workspace_overview"]) {
        const ov = toolResultsMap["get_workspace_overview"];
        const projectList = (ov.projectsSummary || [])
          .map((p: any) => `- **[${p.name}](/project/${p.id})**${p.description ? ` — _${p.description}_` : ""}`)
          .join("\n");

        finalReply = `### 📊 Workspace Overview\n\n` +
          `You have **${ov.totalProjects}** projects, **${ov.totalStories}** stories, and **${ov.openTasksCount}** open tasks.\n\n` +
          `#### Active Projects:\n${projectList || "No projects found."}\n\n` +
          `_You can click on any project above or ask me to inspect a specific project's epics and tasks._`;
      } else if (toolResultsMap["list_projects"]) {
        const lp = toolResultsMap["list_projects"];
        const projectList = (lp.projects || [])
          .map((p: any) => `- **[${p.name}](/project/${p.id})**\n  ${p.description || "No description provided."}`)
          .join("\n\n");
        finalReply = `### 📁 Your Projects\n\n${projectList || "No projects found."}`;
      } else if (toolResultsMap["get_project_context"]) {
        const ctx = toolResultsMap["get_project_context"];
        finalReply = `### 📋 Project: **${ctx.project?.name || "Selected Project"}**\n\n` +
          `- **Epics:** ${ctx.epics?.length || 0}\n` +
          `- **Stories:** ${ctx.stories?.length || 0}\n` +
          `- **Tasks:** ${ctx.tasks?.length || 0}\n\n` +
          `Ask me to draft new stories or break down requirements for this project!`;
      } else if (toolResultsMap["create_story"]) {
        const cs = toolResultsMap["create_story"];
        finalReply = `✨ Created story **${cs.story?.title || "New Story"}** successfully! Click the card below to view it.`;
      } else if (toolResultsMap["create_task"]) {
        const ct = toolResultsMap["create_task"];
        finalReply = `📋 Created task **${ct.task?.title || "New Task"}** [${ct.task?.priority || "medium"}]! Click the card below to view it.`;
      } else {
        finalReply = "Done! I have completed your request.";
      }
    }

    return {
      content: finalReply,
      actionReceipts,
    };
  }

  // Standard textual response without tools
  const directReply =
    candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n\n") ||
    "I'm here to assist with your stories, tasks, and project requirements.";

  return {
    content: directReply,
    actionReceipts,
  };
}
