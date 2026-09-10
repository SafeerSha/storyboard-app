import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

const ProjectEstimateSchema = {
  type: "object",
  properties: {
    projectSummary: {
      type: "object",
      properties: {
        complexity: { type: "string" },
        summary: { type: "string" },
        deploymentHours: { type: "number" },
        deploymentReasoning: { type: "string" },
        databaseDesignHours: { type: "number" },
        databaseDesignReasoning: { type: "string" }
      },
      required: ["complexity", "summary"]
    },
    stories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          storyId: { type: "string" },
          title: { type: "string" },
          epicId: { type: "string", nullable: true },
          complexity: { type: "string" },
          effort: {
            type: "object",
            properties: {
              frontendHours: { type: "number" },
              backendHours: { type: "number" },
              databaseHours: { type: "number" },
              unitTestingHours: { type: "number" },
              integrationHours: { type: "number" },
              testingHours: { type: "number" },
              totalHours: { type: "number" }
            },
            required: ["frontendHours", "backendHours", "databaseHours", "unitTestingHours", "integrationHours", "testingHours", "totalHours"]
          },
          confidence: { type: "string" },
          reasoning: { type: "string" }
        },
        required: ["storyId", "complexity", "effort", "confidence", "reasoning"]
      }
    }
  },
  required: ["projectSummary", "stories"]
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, scope = "both", includeDbDesign = true, includeUnitTesting = true, unitTestIntensity = "lean", includeDeployment = false, customPrompt = "" } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check project authorization
    const { data: project } = await admin
      .from("projects")
      .select("id, name, description, owner_id")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .maybeSingle();

    let authorizedProject = project;

    if (!project) {
      // Might be a super admin, let's check
      const { data: profile } = await admin
        .from("freelancer_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
        
      if (profile?.role !== "super_admin") {
         return NextResponse.json({ error: "Forbidden or Project Not Found" }, { status: 403 });
      }
      
      // If super admin, fetch project without owner_id check
      const { data: adminProject } = await admin
        .from("projects")
        .select("id, name, description, owner_id")
        .eq("id", projectId)
        .maybeSingle();
        
      if (!adminProject) {
        return NextResponse.json({ error: "Project Not Found" }, { status: 404 });
      }
      authorizedProject = adminProject;
    }

    // Fetch Epics
    const { data: epics } = await admin
      .from("epics")
      .select("id, name, description")
      .eq("project_id", projectId);

    // Fetch Stories
    const { data: stories } = await admin
      .from("stories")
      .select("id, epic_id, title, description, raw_requirement, acceptance_criteria, assumptions, clarifications")
      .eq("project_id", projectId);

    if (!stories || stories.length === 0) {
      return NextResponse.json({ error: "No stories found in this project to estimate." }, { status: 400 });
    }

    const promptText = `
You are estimating software implementation effort from structured product requirements.
Estimate realistic engineering effort, not arbitrary numbers.

Project Scope & Architectural Disciplines:
- Engineering Scope: ${scope === "frontend" ? "FRONTEND ONLY (UI components, styling, client state, interaction, responsiveness). Server-side backend is OUT OF SCOPE." : scope === "backend" ? "BACKEND ONLY (APIs, business services, authentication, server-side data processing). Frontend UI is OUT OF SCOPE." : "FULL STACK (Both Frontend UI and Backend server services are in-scope)."}
- Database Design & Architecture: ${includeDbDesign ? "INCLUDED in project scope. Estimate database modeling, schema migrations, and indexing effort (in databaseHours for each story, plus overall databaseDesignHours in projectSummary)." : "EXCLUDED from project scope. Set databaseHours to 0 and databaseDesignHours to 0."}
- Unit Testing & Code Quality: ${includeUnitTesting ? `INCLUDED in project scope. Keep unit testing effort lean, realistic, and strictly proportional to implementation effort (around 10% to 15% of development hours, NEVER equal to or near dev time).
  * Unit tests strictly cover essential logic: happy paths, input validation, and primary edge cases.
  * Simple stories: 0.5 to 1.0 hour maximum.
  * Medium stories: 1.0 to 1.5 hours maximum.
  * Complex stories: 1.5 to 2.5 hours maximum.
  * Do NOT inflate or overestimate unit testing hours.` : "EXCLUDED from project scope. Set unitTestingHours to 0 and testingHours to 0."}
- Deployment & DevOps: ${includeDeployment ? "INCLUDED in project scope. Provide estimated deploymentHours in projectSummary for cloud environment provisioning, CI/CD pipelines, containerization, domain/SSL, and production rollout." : "EXCLUDED. Set deploymentHours to 0."}

For each story:
- Provide breakdown for frontendHours, backendHours, databaseHours, unitTestingHours, integrationHours, testingHours.
- testingHours must equal unitTestingHours.
- Set totalHours according to the active scope (${scope}):
  * If frontend: totalHours = frontendHours + (includeUnitTesting ? unitTestingHours : 0) + (integrationHours * 0.4)
  * If backend: totalHours = backendHours + (includeDbDesign ? databaseHours : 0) + (includeUnitTesting ? unitTestingHours : 0) + (integrationHours * 0.6)
  * If both: totalHours = frontendHours + backendHours + (includeDbDesign ? databaseHours : 0) + (includeUnitTesting ? unitTestingHours : 0) + integrationHours

Do not assume undocumented complex functionality.
${customPrompt ? `\nSpecial Instructions from User:\n${customPrompt}\n` : ""}
Return structured JSON only.

Project Name: ${authorizedProject?.name}
Project Description: ${authorizedProject?.description || "None"}

Epics:
${epics?.map(e => `- [${e.id}] ${e.name}: ${e.description || ""}`).join('\n') || "None"}

Stories to estimate:
${stories.map(s => `
---
Story ID: ${s.id}
Epic ID: ${s.epic_id || "None"}
Title: ${s.title}
Description: ${s.description || "None"}
Raw Requirement: ${s.raw_requirement || "None"}
Acceptance Criteria: ${JSON.stringify(s.acceptance_criteria || [])}
Assumptions: ${JSON.stringify(s.assumptions || [])}
Clarifications: ${JSON.stringify(s.clarifications || [])}
`).join('\n')}
    `;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const response = await ai.models.generateContent({
      model,
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: ProjectEstimateSchema,
      }
    });

    if (!response.text) {
      throw new Error("No text returned from Gemini");
    }

    const estimateJson = JSON.parse(response.text);

    // Enrich stories with actual database titles and epic names
    const storyMap = new Map((stories || []).map(s => [s.id, s]));
    const epicMap = new Map((epics || []).map(e => [e.id, e]));

    estimateJson.stories = (estimateJson.stories || []).map((item: any) => {
      const dbStory = storyMap.get(item.storyId) ||
        (stories || []).find(s => s.id === item.storyId || s.id.startsWith(item.storyId) || (item.storyId && item.storyId.startsWith(s.id)));
      
      const dbEpic = dbStory?.epic_id ? epicMap.get(dbStory.epic_id) : (item.epicId ? epicMap.get(item.epicId) : null);

      const rawUnitTestHours = item.effort?.unitTestingHours ?? item.effort?.testingHours ?? 0;
      const fe = item.effort?.frontendHours || 0;
      const be = item.effort?.backendHours || 0;
      const db = includeDbDesign ? (item.effort?.databaseHours || 0) : 0;
      const integ = item.effort?.integrationHours || 0;
      const devHours = fe + be;

      // Calibration guardrail: unit test hours should be ~12-18% of dev effort, capped so it never bloats
      const ratio = unitTestIntensity === "comprehensive" ? 0.25 : unitTestIntensity === "standard" ? 0.18 : 0.12;
      const maxReasonableHours = devHours > 0
        ? Math.max(0.5, Math.round(devHours * ratio * 10) / 10)
        : rawUnitTestHours;
      const unitTestHours = includeUnitTesting
        ? Math.min(rawUnitTestHours, maxReasonableHours)
        : 0;

      let totalHours = 0;
      if (scope === "frontend") {
        totalHours = Math.round((fe + (unitTestHours * 0.6) + (integ * 0.4)) * 10) / 10;
      } else if (scope === "backend") {
        totalHours = Math.round((be + db + (unitTestHours * 0.4) + (integ * 0.6)) * 10) / 10;
      } else {
        totalHours = Math.round((fe + be + db + unitTestHours + integ) * 10) / 10;
      }

      return {
        ...item,
        title: dbStory?.title || item.title || "Untitled Story",
        epicName: dbEpic?.name || "Uncategorized",
        epicId: dbStory?.epic_id || item.epicId || null,
        storyId: dbStory?.id || item.storyId,
        projectId,
        effort: {
          ...item.effort,
          unitTestingHours: unitTestHours,
          testingHours: unitTestHours,
          totalHours,
        },
      };
    });

    return NextResponse.json({ estimate: estimateJson });
    
  } catch (err: any) {
    console.error("Estimation error:", err);
    return NextResponse.json({ error: "Unable to generate estimate. Please try again." }, { status: 500 });
  }
}
