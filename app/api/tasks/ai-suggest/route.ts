import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in environment variables." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { projectId, storyId, prompt = "", mode = "single", category } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. Fetch project details
    const { data: project } = await admin
      .from("projects")
      .select("id, name, description")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 2. Fetch linked story details if storyId provided, or all project stories for context
    let storyData: any = null;
    let projectStories: any[] = [];

    if (storyId) {
      const { data: story } = await admin
        .from("stories")
        .select("id, title, description, acceptance_criteria, assumptions, clarifications, status")
        .eq("id", storyId)
        .maybeSingle();
      storyData = story;
    }

    // Fetch brief list of project stories for context matching
    const { data: allStories } = await admin
      .from("stories")
      .select("id, title, status")
      .eq("project_id", projectId)
      .limit(20);
    projectStories = allStories || [];

    // 3. Fetch connected assignees for this project
    const assigneesList: Array<{ id: string; name: string; role?: string; type: string }> = [];

    // Owner
    const { data: ownerProfile } = await admin
      .from("freelancer_profiles")
      .select("id, name, email, role")
      .limit(1)
      .maybeSingle();
    if (ownerProfile) {
      assigneesList.push({
        id: ownerProfile.id,
        name: ownerProfile.name || "Owner",
        role: "Project Owner / Lead",
        type: "freelancer",
      });
    }

    // Team users
    const { data: teamRes } = await admin
      .from("project_team_members")
      .select("team_user_id, team_users(id, name, role)")
      .eq("project_id", projectId);

    if (teamRes) {
      for (const row of teamRes) {
        const u = (row as any).team_users;
        if (u) {
          assigneesList.push({
            id: u.id,
            name: u.name,
            role: u.role || "Team Member",
            type: "team_user",
          });
        }
      }
    }

    // Clients
    const { data: clientRes } = await admin
      .from("clients")
      .select("id, name")
      .eq("project_id", projectId)
      .neq("status", "disabled");

    if (clientRes) {
      for (const c of clientRes) {
        assigneesList.push({
          id: c.id,
          name: c.name,
          role: "Client",
          type: "client",
        });
      }
    }

    // 4. Build prompt for Gemini
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const promptContext = `
You are an expert Technical Project Manager and Agile Scrum Lead.
Your goal is to automatically generate practical, high-quality, actionable to-do tasks so developers, team members, and clients don't have to write them manually.

======================================================================
PROJECT CONTEXT:
- Name: "${project.name}"
- Description: "${project.description || "N/A"}"
${category ? `- DOMAIN / CATEGORY FILTER: "${category.toUpperCase()}" (Task MUST strictly align with ${category} specialization: frontend UI, backend API/db, fullstack end-to-end, or test/QA automation)` : ""}

LINKED STORY CONTEXT:
${
  storyData
    ? `
- Title: "${storyData.title}"
- Description: "${storyData.description || ""}"
- Acceptance Criteria: ${JSON.stringify(storyData.acceptance_criteria || [])}
- Assumptions: ${JSON.stringify(storyData.assumptions || [])}
`
    : "No specific story currently linked."
}

AVAILABLE STORIES IN PROJECT:
${JSON.stringify(projectStories.map((s) => ({ id: s.id, title: s.title })))}

CONNECTED ASSIGNEES (MEMBERS & CLIENTS):
${JSON.stringify(assigneesList)}

USER ROUGH PROMPT / INTENT:
"${prompt.trim() || (storyData ? `Auto-generate implementation task for story: ${storyData.title}` : "Create next high-priority to-do task")}"
======================================================================

TASK INSTRUCTIONS:
1. Title: Action-oriented, concise, professional (e.g. "Implement OAuth session handling & JWT refresh flow", "Design responsive client approval modal").
2. Description: High-quality, organized markdown with bullet points / checklist items:
   - "### Scope & Objectives"
   - "- [ ] Key item 1"
   - "- [ ] Key item 2"
   - "- [ ] Edge cases or validation"
3. Priority: one of: "low", "medium", "high", "urgent". Base this on story importance or deadline urgency.
4. Category: one of: "frontend", "backend", "fullstack", "test". Match best domain.
5. Suggested Days from today: An integer (e.g. 3, 5, 7) representing reasonable target completion time.
6. Suggested Assignee ID: Pick the best matching assignee from CONNECTED ASSIGNEES based on role/title (e.g. frontend dev for frontend tasks, QA for test tasks), or null if ambiguous.
7. Suggested Story ID: If not already linked, pick the most relevant story ID from AVAILABLE STORIES, or keep ${storyId ? `"${storyId}"` : "null"}.
`;

    if (mode === "polish_desc") {
      const polishPrompt = `
You are a senior engineering manager and agile lead.
Refine the following rough task description into a clear, professional, structured Markdown checklist with acceptance criteria.
Task Title: "${body.title || "Task"}"
Project: "${project.name}"
Raw notes / text:
"${prompt}"

Structure the output with:
### Scope & Implementation Steps
- [ ] Step 1
- [ ] Step 2
- [ ] Step 3
### Acceptance Criteria & Verification
- [ ] Verification item 1
- [ ] Verification item 2

Return STRICT JSON matching this schema:
{
  "description": "string (markdown checklist)"
}
`;

      const response = await ai.models.generateContent({
        model,
        contents: polishPrompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      return NextResponse.json({
        description: parsed.description || prompt,
      });
    }

    if (mode === "breakdown") {
      const breakdownPrompt = `
${promptContext}

MODE: BREAKDOWN INTO SUBTASKS
Breakdown this story or requirement into 2 to 4 distinct, cohesive, independently achievable tasks (e.g. Frontend UI, Backend API, Validation/Tests, or Client Review).

Return STRICT JSON matching this schema:
{
  "tasks": [
    {
      "title": "string",
      "description": "string (markdown checklist)",
      "priority": "low" | "medium" | "high" | "urgent",
      "category": "frontend" | "backend" | "fullstack" | "test",
      "suggestedDays": number,
      "suggestedAssigneeId": "string or null"
    }
  ]
}
`;

      const response = await ai.models.generateContent({
        model,
        contents: breakdownPrompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      const today = new Date();

      const enrichedTasks = (parsed.tasks || []).map((t: any) => {
        const days = Number(t.suggestedDays) || 4;
        const targetDate = new Date(today);
        targetDate.setDate(targetDate.getDate() + days);
        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
        const dd = String(targetDate.getDate()).padStart(2, "0");

        return {
          title: t.title,
          description: t.description,
          priority: ["low", "medium", "high", "urgent"].includes(t.priority)
            ? t.priority
            : "medium",
          category: ["frontend", "backend", "fullstack", "test"].includes(t.category)
            ? t.category
            : category || null,
          due_date: `${yyyy}-${mm}-${dd}`,
          assignee_id: t.suggestedAssigneeId || null,
          assignee: assigneesList.find((a) => a.id === t.suggestedAssigneeId) || null,
        };
      });

      return NextResponse.json({ tasks: enrichedTasks });
    }

    // Single Task Auto-fill
    const singlePrompt = `
${promptContext}

MODE: SINGLE TASK AUTO-FILL
Generate the primary or next most valuable task for this requirement or story.

Return STRICT JSON matching this schema:
{
  "title": "string",
  "description": "string (markdown with bullet points and checkboxes)",
  "priority": "low" | "medium" | "high" | "urgent",
  "category": "frontend" | "backend" | "fullstack" | "test",
  "suggestedDays": number,
  "suggestedAssigneeId": "string or null",
  "suggestedStoryId": "string or null",
  "reasoning": "brief 1-sentence note"
}
`;

    const response = await ai.models.generateContent({
      model,
      contents: singlePrompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const days = Number(parsed.suggestedDays) || 4;
    const today = new Date();
    today.setDate(today.getDate() + days);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const formattedDueDate = `${yyyy}-${mm}-${dd}`;

    const matchingAssignee = assigneesList.find(
      (a) => a.id === parsed.suggestedAssigneeId
    );

    const resolvedCategory = ["frontend", "backend", "fullstack", "test"].includes(parsed.category)
      ? parsed.category
      : category || null;

    return NextResponse.json({
      title: parsed.title || "Implement feature capability",
      description: parsed.description || "",
      priority: ["low", "medium", "high", "urgent"].includes(parsed.priority)
        ? parsed.priority
        : "medium",
      category: resolvedCategory,
      due_date: formattedDueDate,
      suggestedAssigneeId: parsed.suggestedAssigneeId || null,
      suggestedAssignee: matchingAssignee || null,
      suggestedStoryId: parsed.suggestedStoryId || storyId || null,
      reasoning: parsed.reasoning || "Generated with AI",
    });
  } catch (err: any) {
    console.error("POST /api/tasks/ai-suggest error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate task with AI" },
      { status: 500 }
    );
  }
}
