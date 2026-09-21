import { NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { GoogleGenAI } from "@google/genai";
import {
  ASSISTANT_TOOL_DEFINITIONS,
  executeAssistantTool,
  ActionTaskResult,
} from "@/lib/ai/assistant-tools";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 1. Verify Super Admin Access
    const superAdmin = await verifySuperAdmin();
    if (!superAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Centralized Assistant is restricted to Super Admin." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const command = String(body.command || "").trim();
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];

    if (!command) {
      return NextResponse.json({ error: "Command is required." }, { status: 400 });
    }

    // 2. Fetch Live Workspace Context in parallel
    const admin = createAdminClient();
    const [projectsRes, epicsRes, storiesRes, notesRes, inboxRes, teamRes] =
      await Promise.all([
        admin
          .from("projects")
          .select("id, name, status, description")
          .order("created_at", { ascending: false })
          .limit(20),
        admin
          .from("epics")
          .select("id, name, status, project_id", { count: "exact" })
          .limit(40),
        admin
          .from("stories")
          .select("id, title, status, project_id", { count: "exact" })
          .limit(100),
        admin
          .from("project_notes")
          .select("id, title, project_id", { count: "exact" })
          .limit(30),
        admin
          .from("project_inbox_items")
          .select("id, title, status, priority", { count: "exact" })
          .limit(30),
        admin
          .from("team_users")
          .select("id, name, role", { count: "exact" }),
      ]);

    if (projectsRes.error) console.error("[Assistant Projects Query Error]:", projectsRes.error);
    if (epicsRes.error) console.error("[Assistant Epics Query Error]:", epicsRes.error);
    if (storiesRes.error) console.error("[Assistant Stories Query Error]:", storiesRes.error);
    if (notesRes.error) console.error("[Assistant Notes Query Error]:", notesRes.error);
    if (inboxRes.error) console.error("[Assistant Inbox Query Error]:", inboxRes.error);
    if (teamRes.error) console.error("[Assistant Team Query Error]:", teamRes.error);

    const projects = projectsRes.data || [];
    const totalProjects = projects.length;
    const projectSummary = projects
      .map((p) => `"${p.name}" (${p.status || "active"})`)
      .slice(0, 10)
      .join(", ");

    const totalEpics = epicsRes.count ?? (epicsRes.data?.length || 0);
    const epicSample = (epicsRes.data || [])
      .slice(0, 8)
      .map((e) => `"${e.name}"`)
      .join(", ");

    const stories = storiesRes.data || [];
    const totalStories = storiesRes.count ?? stories.length;
    const completedStories = stories.filter(
      (s) => s.status === "completed" || s.status === "done"
    ).length;
    const inProgressStories = stories.filter(
      (s) => s.status === "in_progress"
    ).length;
    const pendingStories = stories.filter(
      (s) => s.status === "todo" || s.status === "draft" || !s.status
    ).length;

    const totalNotes = notesRes.count ?? (notesRes.data?.length || 0);
    const totalInbox = inboxRes.count ?? (inboxRes.data?.length || 0);
    const totalTeam = teamRes.count ?? (teamRes.data?.length || 0);

    const liveWorkspaceSnapshot = `
CURRENT REAL-TIME WORKSPACE DATA:
- Administrator Name: ${superAdmin.name || "Super Admin"} (${superAdmin.email || ""})
- Total Projects (${totalProjects}): ${projectSummary || "No projects created yet"}
- Total Epics (${totalEpics}): ${epicSample || "No epics yet"}
- Total Stories (${totalStories}): ${completedStories} completed, ${inProgressStories} in progress, ${pendingStories} to do/backlog
- Total Discussion Notes: ${totalNotes}
- Total Inbox Items: ${totalInbox}
- Total Team Collaborators: ${totalTeam}
`;

    const conversationHistoryText =
      history.length > 0
        ? `RECENT CONVERSATION HISTORY:\n${history
            .map(
              (h: any) =>
                `${h.role === "user" ? "Super Admin" : "Reqly"}: ${h.text}`
            )
            .join("\n")}\n\n`
        : "";

    // 3. Deterministic Inquiry Intent Detection & Pre-Execution
    const lower = command.toLowerCase();
    const isMutation = /\b(create|make|add|new|insert|update|delete|remove|change|set|edit|invite|rename)\b/.test(lower);
    
    const asksProjects = /\b(project|projects)\b/.test(lower);
    const asksEpics = /\b(epic|epics)\b/.test(lower);
    const asksStories = /\b(story|stories|task|tasks)\b/.test(lower);
    const asksInbox = /\b(inbox|ideas?|leads?)\b/.test(lower);
    const asksNotes = /\b(note|notes|meeting|discussions?)\b/.test(lower);
    const asksSummary = /\b(summary|overview|status|metrics|stats|breakdown|everything|all of it)\b/.test(lower);

    const isListingQuery = !isMutation && (asksProjects || asksEpics || asksStories || asksInbox || asksNotes || asksSummary);

    const preExecutedTasks: ActionTaskResult[] = [];
    const execCtx = {
      adminUserId: superAdmin.id,
      adminName: superAdmin.name,
      adminEmail: superAdmin.email || "",
    };

    if (isListingQuery) {
      if (asksProjects) {
        preExecutedTasks.push(await executeAssistantTool("list_projects", { limit: 25 }, execCtx));
      }
      if (asksEpics) {
        preExecutedTasks.push(await executeAssistantTool("list_epics", {}, execCtx));
      }
      if (asksStories) {
        preExecutedTasks.push(await executeAssistantTool("list_stories", {}, execCtx));
      }
      if (asksInbox) {
        preExecutedTasks.push(await executeAssistantTool("list_inbox", {}, execCtx));
      }
      if (asksNotes) {
        preExecutedTasks.push(await executeAssistantTool("list_notes", {}, execCtx));
      }
      if (asksSummary && preExecutedTasks.length === 0) {
        preExecutedTasks.push(await executeAssistantTool("get_workspace_summary", {}, execCtx));
      }
    }

    const preExecutedDataText =
      preExecutedTasks.length > 0
        ? `\nLIVE REAL-TIME DATABASE RESULTS FOR THIS QUERY:\n${preExecutedTasks
            .map((t) => `- [${t.title}]: ${t.message}`)
            .join("\n")}\n`
        : "";

    // 4. Initialize Gemini AI
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in environment." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const systemPrompt = `
You are Reqly, an executive, voice-first AI Assistant for StoryBoard, personal partner to the Super Admin (${superAdmin.name || "Safeer"}).

${liveWorkspaceSnapshot}
${preExecutedDataText}
AVAILABLE ACTION TOOLS:
${JSON.stringify(ASSISTANT_TOOL_DEFINITIONS, null, 2)}

YOUR CORE BEHAVIORS:
1. Inquiring About Projects, Stories, Epics or Workspace Counts:
   - When the user asks for projects, stories, epics, or counts:
     - You MUST explicitly LIST the items out clearly in "responseMessage": state the total counts, recite the project names, the epic names, and the story numbers/breakdown so the Super Admin hears and sees the actual list!
     - e.g. "You have 2 projects: [Name 1] and [Name 2]. Across these projects, there are 4 epics: [Name A, Name B...] and 12 user stories: 5 completed, 4 in progress, and 3 backlog."
     - If database results are provided above, use those exact verified results.
     ${preExecutedTasks.length > 0 ? '- Note: Listing tools were already executed and will be logged in real-time, so you can leave "actions": [] unless additional tools are needed.' : '- Call the relevant listing tools in "actions" (e.g. "list_projects", "list_epics", "list_stories").'}
2. Conversational & Human-like:
   - When the Super Admin says greetings ("hey", "how are you", "what's up", "good morning", "thank you", "who are you") or chats casually with NO workspace data requests, respond naturally, warmly, and concisely as a sharp, capable human executive partner.
   - For purely conversational small-talk, leave "actions": [].
3. Executing Commands / Mutations:
   - When the user instructs you to create, modify, or delete (e.g. "create a project", "add an epic", "add a story", "post a note", "send to inbox", "invite a user", "navigate to inbox"):
     - Include the tool call in "actions" with appropriate parameters.
     - CRITICAL: In "responseMessage", you MUST confirm that the action HAS BEEN COMPLETED using past or present perfect tense (e.g., "I've created the 'Voice Assistant' epic in your Test project, Safeer." or "Done! I created the epic for you." or "All set! I've added that story.").
     - NEVER say "I am creating...", "I'm creating...", "I will create...", "I'm working on...", or "I'm adding..." because your tools execute immediately on the server before this message is spoken. Saying "I am creating..." confuses the user into waiting for a second confirmation message that will never arrive!
4. Output Schema:
   - Your response MUST be strictly valid JSON:
   {
     "thought": "Short reasoning",
     "actions": [
       { "tool": "tool_name", "params": { ... } }
     ],
     "responseMessage": "The spoken-friendly, natural message spoken aloud to the Super Admin."
   }
`;

    const promptContents = `${systemPrompt}\n\n${conversationHistoryText}Super Admin: "${command}"`;

    const aiResponse = await ai.models.generateContent({
      model,
      contents: promptContents,
      config: {
        responseMimeType: "application/json",
      },
    });

    const rawText = aiResponse.text?.trim() || "{}";
    let parsed: {
      thought?: string;
      actions?: Array<{ tool: string; params: Record<string, any> }>;
      responseMessage?: string;
    };

    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    }

    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    const executionTasks: ActionTaskResult[] = [...preExecutedTasks];

    // 5. Execute any remaining tools sequentially on behalf of Super Admin
    for (const action of actions) {
      if (action.tool) {
        // Skip if already pre-executed the same tool
        const alreadyDone = preExecutedTasks.some((t) => t.tool === action.tool);
        if (!alreadyDone) {
          const result = await executeAssistantTool(
            action.tool,
            action.params || {},
            execCtx
          );
          executionTasks.push(result);
        }
      }
    }

    let responseMessage =
      parsed.responseMessage ||
      (executionTasks.length > 0
        ? `Executed ${executionTasks.length} action(s) successfully.`
        : "I'm right here. How can I help?");

    // Post-processor: If mutation tools were executed, sanitize any progressive "I'm creating" phrasing
    const hasMutations = executionTasks.some(
      (t) =>
        t.status === "completed" &&
        ["create_project", "create_epic", "create_story", "create_note", "create_inbox_item", "invite_team_user"].includes(t.tool)
    );

    if (hasMutations && responseMessage) {
      responseMessage = responseMessage
        .replace(/\b(?:i am creating|i'm creating|i'll create|i will create)\b/gi, "I've created")
        .replace(/\b(?:i am adding|i'm adding|i'll add|i will add)\b/gi, "I've added")
        .replace(/\b(?:i am making|i'm making|i'll make|i will make)\b/gi, "I've made")
        .replace(/\b(?:i am setting up|i'm setting up|i'll set up)\b/gi, "I've set up")
        .replace(/\s+right now\b/gi, "")
        .replace(/\s+right away\b/gi, "");
    }

    return NextResponse.json({
      ok: true,
      thought: parsed.thought || "",
      responseMessage,
      actionTasks: executionTasks,
    });
  } catch (err: any) {
    console.error("[Assistant Command Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process assistant command." },
      { status: 500 }
    );
  }
}
