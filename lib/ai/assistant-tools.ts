import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionTaskResult {
  id: string;
  title: string;
  tool: string;
  status: "completed" | "failed" | "in_progress";
  details?: Record<string, any>;
  message: string;
  quickAction?: {
    label: string;
    href: string;
  };
  timestamp: string;
}

export interface AssistantExecutionContext {
  adminUserId: string;
  adminName: string;
  adminEmail: string;
}

/**
 * Declarative specifications of all actions the Centralized Assistant can perform.
 */
export const ASSISTANT_TOOL_DEFINITIONS = [
  {
    name: "create_project",
    description: "Creates a new client project in StoryBoard.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "The project title/name" },
        description: { type: "string", description: "Brief overview of the project scope" },
        clientEmail: { type: "string", description: "Optional client contact email" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_projects",
    description: "Lists active or all projects in the workspace.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "archived", "all"], description: "Status filter" },
        search: { type: "string", description: "Optional search query" },
        limit: { type: "number", description: "Max number of projects to return (default 25)" },
      },
    },
  },
  {
    name: "create_epic",
    description: "Creates a feature epic/module inside a project.",
    parameters: {
      type: "object",
      properties: {
        projectNameOrId: { type: "string", description: "Project name or Project UUID" },
        name: { type: "string", description: "Name of the epic (e.g. Authentication, Billing, Dashboard)" },
        description: { type: "string", description: "Description of the epic module" },
      },
      required: ["projectNameOrId", "name"],
    },
  },
  {
    name: "list_epics",
    description: "Lists epics/modules in the workspace or inside a specific project.",
    parameters: {
      type: "object",
      properties: {
        projectNameOrId: { type: "string", description: "Optional project name or UUID to filter epics" },
      },
    },
  },
  {
    name: "create_story",
    description: "Creates a user story with acceptance criteria in an epic/project.",
    parameters: {
      type: "object",
      properties: {
        projectNameOrId: { type: "string", description: "Target project name or UUID" },
        epicNameOrId: { type: "string", description: "Optional target epic name or UUID" },
        title: { type: "string", description: "Story title (e.g. User Profile Password Reset)" },
        description: { type: "string", description: "Story description" },
        acceptanceCriteria: {
          type: "array",
          items: { type: "string" },
          description: "List of concise acceptance criteria",
        },
        status: {
          type: "string",
          enum: ["draft", "review", "changes_requested", "approved", "in_development", "completed"],
          description: "Initial story status (default draft)",
        },
      },
      required: ["projectNameOrId", "title"],
    },
  },
  {
    name: "list_stories",
    description: "Lists user stories in the workspace or a project, with counts, statuses and titles.",
    parameters: {
      type: "object",
      properties: {
        projectNameOrId: { type: "string", description: "Optional project name or UUID" },
        status: {
          type: "string",
          enum: ["draft", "review", "changes_requested", "approved", "in_development", "completed"],
          description: "Optional status filter",
        },
      },
    },
  },
  {
    name: "update_story_status",
    description: "Updates the review/workflow status of an existing user story.",
    parameters: {
      type: "object",
      properties: {
        storyTitleOrId: { type: "string", description: "The story title or UUID" },
        status: {
          type: "string",
          enum: ["draft", "review", "changes_requested", "approved", "in_development", "completed"],
          description: "New status to assign",
        },
      },
      required: ["storyTitleOrId", "status"],
    },
  },
  {
    name: "create_discussion_note",
    description: "Creates a meeting or discussion note inside a project.",
    parameters: {
      type: "object",
      properties: {
        projectNameOrId: { type: "string", description: "Target project name or UUID" },
        title: { type: "string", description: "Note title (e.g. Client Kickoff Decisions)" },
        content: { type: "string", description: "Note content, bullet points, or discussion minutes" },
        tags: { type: "array", items: { type: "string" }, description: "Tags e.g. ['meeting', 'ux']" },
      },
      required: ["projectNameOrId", "title", "content"],
    },
  },
  {
    name: "list_notes",
    description: "Lists discussion and meeting notes recorded across projects.",
    parameters: {
      type: "object",
      properties: {
        projectNameOrId: { type: "string", description: "Optional project filter" },
      },
    },
  },
  {
    name: "create_inbox_item",
    description: "Adds a new idea, feature concept, or research lead into the Project Inbox.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Concept or lead title" },
        description: { type: "string", description: "Detailed notes or market context" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Priority level" },
        type: { type: "string", enum: ["idea", "lead", "research", "architecture"], description: "Item category" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_inbox",
    description: "Lists project inbox ideas, concepts, and market leads.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by inbox status" },
      },
    },
  },
  {
    name: "invite_team_user",
    description: "Invites or creates a new team member/collaborator account.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Team member full name" },
        email: { type: "string", description: "Team member email address" },
        username: { type: "string", description: "Unique username for login" },
        role: { type: "string", enum: ["collaborator", "reviewer", "admin"], description: "Role" },
      },
      required: ["name", "username"],
    },
  },
  {
    name: "get_workspace_summary",
    description: "Retrieves an executive summary of current projects, stories, notes, and activity.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "navigate_to",
    description: "Navigates the application view to a specific section or project.",
    parameters: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          description: "Target view: 'projects', 'inbox', 'settings', 'users', or project name/id",
        },
      },
      required: ["destination"],
    },
  },
];

/**
 * Resolves a project ID from either a UUID or a fuzzy project name search.
 */
async function resolveProjectId(admin: any, nameOrId: string, ownerId: string): Promise<{ id: string; name: string } | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nameOrId);
  if (isUuid) {
    const { data } = await admin.from("projects").select("id, name").eq("id", nameOrId).maybeSingle();
    if (data) return data;
  }

  const { data: projects } = await admin
    .from("projects")
    .select("id, name")
    .ilike("name", `%${nameOrId}%`)
    .limit(1);

  if (projects && projects.length > 0) {
    return projects[0];
  }

  // Fallback: get most recent project
  const { data: recent } = await admin
    .from("projects")
    .select("id, name")
    .order("created_at", { ascending: false })
    .limit(1);

  return recent && recent.length > 0 ? recent[0] : null;
}

/**
 * Executes a single assistant tool invocation on behalf of Super Admin.
 */
export async function executeAssistantTool(
  tool: string,
  params: Record<string, any>,
  context: AssistantExecutionContext
): Promise<ActionTaskResult> {
  const admin = createAdminClient();
  const taskId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    switch (tool) {
      case "create_project": {
        const name = String(params.name || "Untitled Project").trim();
        const description = String(params.description || "");
        const clientEmail = params.clientEmail ? String(params.clientEmail).trim() : null;

        const { data: project, error } = await admin
          .from("projects")
          .insert({
            name,
            description,
            owner_id: context.adminUserId,
            status: "active",
          })
          .select()
          .single();

        if (error) throw error;

        // If client email provided, record client
        if (clientEmail && project) {
          await admin.from("clients").insert({
            project_id: project.id,
            email: clientEmail,
            name: clientEmail.split("@")[0],
          });
        }

        return {
          id: taskId,
          title: `Created Project "${name}"`,
          tool,
          status: "completed",
          details: { name, description, clientEmail },
          message: `Successfully created project "${name}".`,
          quickAction: {
            label: "Open Project",
            href: `/project/${project.id}`,
          },
          timestamp: now,
        };
      }

      case "list_projects": {
        let query = admin
          .from("projects")
          .select("id, name, description, status, created_at")
          .order("created_at", { ascending: false })
          .limit(params.limit || 25);

        if (params.status && params.status !== "all") {
          query = query.eq("status", params.status);
        }
        if (params.search) {
          query = query.ilike("name", `%${params.search}%`);
        }

        const { data: projects, error } = await query;
        if (error) throw error;

        const count = projects?.length || 0;
        const projectNames = (projects || []).map((p: any) => p.name);
        const projectList = (projects || [])
          .map((p: any) => `"${p.name}" (${p.status || "active"})`)
          .join(", ");

        return {
          id: taskId,
          title: `Workspace Projects (${count})`,
          tool,
          status: "completed",
          details: {
            count,
            projects: projectNames,
            active: (projects || []).filter((p: any) => p.status === "active").length,
          },
          message: count > 0 ? `Found ${count} project(s): ${projectList}` : "No projects found in workspace.",
          quickAction: {
            label: "View All Projects",
            href: "/projects",
          },
          timestamp: now,
        };
      }

      case "create_epic": {
        const project = await resolveProjectId(admin, params.projectNameOrId, context.adminUserId);
        if (!project) throw new Error(`Project "${params.projectNameOrId}" not found.`);

        const epicName = String(params.name || "Core Features").trim();
        const description = String(params.description || "");

        const { data: epic, error } = await admin
          .from("epics")
          .insert({
            project_id: project.id,
            name: epicName,
            description,
            status: "active",
          })
          .select()
          .single();

        if (error) throw error;

        return {
          id: taskId,
          title: `Created Epic "${epicName}" in "${project.name}"`,
          tool,
          status: "completed",
          details: { project: project.name, epicName, description },
          message: `Added Epic "${epicName}" to project "${project.name}".`,
          quickAction: {
            label: `Open ${project.name}`,
            href: `/project/${project.id}`,
          },
          timestamp: now,
        };
      }

      case "list_epics": {
        // Query epics and projects separately to avoid PostgREST foreign key embedding errors
        const [{ data: epics, error: epicsErr }, { data: projects }] = await Promise.all([
          admin.from("epics").select("id, name, description, status, project_id").order("created_at", { ascending: false }).limit(40),
          admin.from("projects").select("id, name"),
        ]);

        if (epicsErr) throw epicsErr;

        const projectMap = new Map((projects || []).map((p: any) => [p.id, p.name]));
        let filteredEpics = epics || [];

        if (params.projectNameOrId) {
          const proj = await resolveProjectId(admin, params.projectNameOrId, context.adminUserId);
          if (proj) {
            filteredEpics = filteredEpics.filter((e: any) => e.project_id === proj.id);
          }
        }

        const count = filteredEpics.length;
        const epicList = filteredEpics
          .map((e: any) => `"${e.name}"${projectMap.get(e.project_id) ? ` (${projectMap.get(e.project_id)})` : ""}`)
          .slice(0, 10)
          .join(", ");

        return {
          id: taskId,
          title: `Workspace Epics (${count})`,
          tool,
          status: "completed",
          details: {
            count,
            epics: filteredEpics.map((e: any) => ({
              name: e.name,
              project: projectMap.get(e.project_id) || "General",
            })),
          },
          message: count > 0 ? `Found ${count} epic(s): ${epicList}` : "No epics found in workspace.",
          quickAction: {
            label: "View Projects",
            href: "/projects",
          },
          timestamp: now,
        };
      }

      case "create_story": {
        const project = await resolveProjectId(admin, params.projectNameOrId, context.adminUserId);
        if (!project) throw new Error(`Project "${params.projectNameOrId}" not found.`);

        let epicId: string | null = null;
        if (params.epicNameOrId) {
          const { data: epics } = await admin
            .from("epics")
            .select("id, name")
            .eq("project_id", project.id)
            .ilike("name", `%${params.epicNameOrId}%`)
            .limit(1);

          if (epics && epics.length > 0) epicId = epics[0].id;
        }

        const title = String(params.title || "Feature Story").trim();
        const description = String(params.description || "");
        const acceptanceCriteria = Array.isArray(params.acceptanceCriteria) ? params.acceptanceCriteria : [];
        const status = params.status || "draft";

        const { data: story, error } = await admin
          .from("stories")
          .insert({
            project_id: project.id,
            epic_id: epicId,
            title,
            description,
            acceptance_criteria: acceptanceCriteria,
            status,
          })
          .select()
          .single();

        if (error) throw error;

        return {
          id: taskId,
          title: `Created Story "${title}"`,
          tool,
          status: "completed",
          details: { project: project.name, title, criteriaCount: acceptanceCriteria.length, status },
          message: `Created story "${title}" with ${acceptanceCriteria.length} acceptance criteria in "${project.name}".`,
          quickAction: {
            label: "Open Project",
            href: `/project/${project.id}`,
          },
          timestamp: now,
        };
      }

      case "list_stories": {
        // Query stories and projects separately to avoid PostgREST foreign key embedding errors
        const [{ data: stories, error: storiesErr }, { data: projects }] = await Promise.all([
          admin.from("stories").select("id, title, status, project_id").order("created_at", { ascending: false }).limit(60),
          admin.from("projects").select("id, name"),
        ]);

        if (storiesErr) throw storiesErr;

        const projectMap = new Map((projects || []).map((p: any) => [p.id, p.name]));
        let filteredStories = stories || [];

        if (params.projectNameOrId) {
          const proj = await resolveProjectId(admin, params.projectNameOrId, context.adminUserId);
          if (proj) {
            filteredStories = filteredStories.filter((s: any) => s.project_id === proj.id);
          }
        }
        if (params.status) {
          filteredStories = filteredStories.filter((s: any) => s.status === params.status);
        }

        const count = filteredStories.length;
        const completed = filteredStories.filter((s: any) => s.status === "completed" || s.status === "done" || s.status === "approved").length;
        const inProgress = filteredStories.filter((s: any) => s.status === "in_progress" || s.status === "review").length;
        const pending = filteredStories.filter((s: any) => s.status === "todo" || s.status === "draft" || !s.status).length;
        const sampleTitles = filteredStories.slice(0, 8).map((s: any) => `"${s.title}" (${s.status || "draft"})`);

        return {
          id: taskId,
          title: `Workspace Stories (${count})`,
          tool,
          status: "completed",
          details: {
            count,
            completed,
            inProgress,
            pending,
            sample: filteredStories.slice(0, 5).map((s: any) => s.title),
          },
          message: count > 0
            ? `Found ${count} user stories (${completed} approved/completed, ${inProgress} in progress/review, ${pending} backlog). Sample: ${sampleTitles.slice(0, 4).join(", ")}`
            : "No user stories found in workspace.",
          quickAction: {
            label: "View Projects",
            href: "/projects",
          },
          timestamp: now,
        };
      }

      case "update_story_status": {
        const target = String(params.storyTitleOrId).trim();
        const newStatus = String(params.status);

        // Find story by UUID or title
        let storyQuery = admin.from("stories").select("id, title, project_id");
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target)) {
          storyQuery = storyQuery.eq("id", target);
        } else {
          storyQuery = storyQuery.ilike("title", `%${target}%`);
        }

        const { data: stories, error: findError } = await storyQuery.limit(1);
        if (findError || !stories || stories.length === 0) {
          throw new Error(`Story "${target}" not found.`);
        }

        const story = stories[0];
        const { error: updateError } = await admin
          .from("stories")
          .update({ status: newStatus, updated_at: now })
          .eq("id", story.id);

        if (updateError) throw updateError;

        return {
          id: taskId,
          title: `Updated Story Status: "${story.title}" -> ${newStatus}`,
          tool,
          status: "completed",
          details: { storyTitle: story.title, newStatus },
          message: `Story "${story.title}" status changed to "${newStatus}".`,
          quickAction: {
            label: "Open Project",
            href: `/project/${story.project_id}`,
          },
          timestamp: now,
        };
      }

      case "create_discussion_note": {
        const project = await resolveProjectId(admin, params.projectNameOrId, context.adminUserId);
        if (!project) throw new Error(`Project "${params.projectNameOrId}" not found.`);

        const title = String(params.title || "Discussion Note").trim();
        const content = String(params.content || "");
        const tags = Array.isArray(params.tags) ? params.tags : ["discussion"];

        const { data: note, error } = await admin
          .from("project_notes")
          .insert({
            project_id: project.id,
            title,
            content,
            tags,
            status: "active",
            created_by_id: context.adminUserId,
            created_by_name: context.adminName,
          })
          .select()
          .single();

        if (error) throw error;

        return {
          id: taskId,
          title: `Created Discussion Note "${title}"`,
          tool,
          status: "completed",
          details: { project: project.name, title, tags },
          message: `Recorded discussion note "${title}" in "${project.name}".`,
          quickAction: {
            label: "Open Notes",
            href: `/project/${project.id}`,
          },
          timestamp: now,
        };
      }

      case "list_notes": {
        const [{ data: notes, error: notesErr }, { data: projects }] = await Promise.all([
          admin.from("project_notes").select("id, title, project_id, tags").order("created_at", { ascending: false }).limit(30),
          admin.from("projects").select("id, name"),
        ]);

        if (notesErr) throw notesErr;
        const projectMap = new Map((projects || []).map((p: any) => [p.id, p.name]));
        let filteredNotes = notes || [];

        if (params.projectNameOrId) {
          const proj = await resolveProjectId(admin, params.projectNameOrId, context.adminUserId);
          if (proj) {
            filteredNotes = filteredNotes.filter((n: any) => n.project_id === proj.id);
          }
        }

        const count = filteredNotes.length;
        const sample = filteredNotes.slice(0, 6).map((n: any) => `"${n.title}"`);

        return {
          id: taskId,
          title: `Workspace Notes (${count})`,
          tool,
          status: "completed",
          details: {
            count,
            sample: filteredNotes.slice(0, 5).map((n: any) => n.title),
          },
          message: count > 0 ? `Found ${count} discussion note(s): ${sample.join(", ")}` : "No discussion notes found.",
          quickAction: {
            label: "View Projects",
            href: "/projects",
          },
          timestamp: now,
        };
      }

      case "create_inbox_item": {
        const title = String(params.title || "New Concept").trim();
        const description = String(params.description || "");
        const priority = params.priority || "medium";
        const type = params.type || "idea";

        const { data: item, error } = await admin
          .from("project_inbox_items")
          .insert({
            owner_id: context.adminUserId,
            title,
            description,
            priority,
            type,
            status: "inbox",
          })
          .select()
          .single();

        if (error) throw error;

        return {
          id: taskId,
          title: `Captured Inbox Item "${title}"`,
          tool,
          status: "completed",
          details: { title, priority, type },
          message: `Saved "${title}" to your Project Inbox.`,
          quickAction: {
            label: "Open Inbox",
            href: "/inbox",
          },
          timestamp: now,
        };
      }

      case "list_inbox": {
        let query = admin
          .from("project_inbox_items")
          .select("id, title, priority, type, status")
          .order("created_at", { ascending: false })
          .limit(30);

        if (params.status) {
          query = query.eq("status", params.status);
        }

        const { data: items, error } = await query;
        if (error) throw error;

        const count = items?.length || 0;
        const sample = (items || []).slice(0, 6).map((i: any) => `"${i.title}"`);

        return {
          id: taskId,
          title: `Project Inbox Items (${count})`,
          tool,
          status: "completed",
          details: {
            count,
            sample: (items || []).slice(0, 5).map((i: any) => i.title),
          },
          message: count > 0 ? `Found ${count} inbox item(s): ${sample.join(", ")}` : "Inbox is currently empty.",
          quickAction: {
            label: "Open Inbox",
            href: "/inbox",
          },
          timestamp: now,
        };
      }

      case "invite_team_user": {
        const name = String(params.name || "Team Member").trim();
        const username = String(params.username || name.toLowerCase().replace(/\s+/g, ".")).trim();
        const email = params.email ? String(params.email).trim() : null;
        const role = params.role || "collaborator";

        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!";

        const { data: user, error } = await admin
          .from("team_users")
          .insert({
            owner_id: context.adminUserId,
            name,
            username,
            email,
            role,
            status: "active",
          })
          .select()
          .single();

        if (error) throw error;

        return {
          id: taskId,
          title: `Invited Team User "${name}"`,
          tool,
          status: "completed",
          details: { name, username, email, role },
          message: `Created account for ${name} (@${username}) as ${role}.`,
          quickAction: {
            label: "View Users",
            href: "/users",
          },
          timestamp: now,
        };
      }

      case "get_workspace_summary": {
        const [projectsRes, epicsRes, storiesRes, notesRes, inboxRes] = await Promise.all([
          admin.from("projects").select("id, name, status", { count: "exact" }),
          admin.from("epics").select("id, name", { count: "exact" }),
          admin.from("stories").select("id, status", { count: "exact" }),
          admin.from("project_notes").select("id", { count: "exact" }),
          admin.from("project_inbox_items").select("id", { count: "exact" }),
        ]);

        const projectCount = projectsRes.count || 0;
        const epicCount = epicsRes.count || 0;
        const storyCount = storiesRes.count || 0;
        const noteCount = notesRes.count || 0;
        const inboxCount = inboxRes.count || 0;
        const projectNames = (projectsRes.data || []).map((p: any) => p.name).slice(0, 8);

        return {
          id: taskId,
          title: `Workspace Metrics Summary`,
          tool,
          status: "completed",
          details: {
            projects: projectCount,
            epics: epicCount,
            stories: storyCount,
            notes: noteCount,
            inbox: inboxCount,
            projectNames,
          },
          message: `Workspace contains ${projectCount} project(s) [${projectNames.join(", ")}], ${epicCount} epics, ${storyCount} stories, ${noteCount} notes, and ${inboxCount} inbox items.`,
          quickAction: {
            label: "View All Projects",
            href: "/projects",
          },
          timestamp: now,
        };
      }

      case "navigate_to": {
        const dest = String(params.destination || "").toLowerCase().trim();
        let targetHref = "/projects";
        let label = "Projects";

        if (dest.includes("inbox")) {
          targetHref = "/inbox";
          label = "Project Inbox";
        } else if (dest.includes("setting")) {
          targetHref = "/settings";
          label = "Settings";
        } else if (dest.includes("user") || dest.includes("team") || dest.includes("member") || dest.includes("freelancer")) {
          targetHref = "/users";
          label = "Team Members";
        } else if (dest.includes("client")) {
          targetHref = "/clients";
          label = "Clients";
        } else if (dest.includes("remuneration") || dest.includes("estimate")) {
          targetHref = "/remuneration";
          label = "Remuneration";
        } else {
          // Check if destination is a project name
          const project = await resolveProjectId(admin, dest, context.adminUserId);
          if (project) {
            targetHref = `/project/${project.id}`;
            label = project.name;
          }
        }

        return {
          id: taskId,
          title: `Navigate to ${label}`,
          tool,
          status: "completed",
          details: { destination: targetHref, label },
          message: `Navigating to ${label} (${targetHref}).`,
          quickAction: {
            label: `Go to ${label}`,
            href: targetHref,
          },
          timestamp: now,
        };
      }

      default:
        throw new Error(`Unknown assistant tool: ${tool}`);
    }
  } catch (err: any) {
    console.error(`Error executing assistant tool [${tool}]:`, err);
    return {
      id: taskId,
      title: `Failed: ${tool.replace(/_/g, " ")}`,
      tool,
      status: "failed",
      details: params,
      message: err.message || `Failed to execute ${tool}`,
      timestamp: now,
    };
  }
}
