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
        risks: { type: "array", items: { type: "string" } },
        assumptions: { type: "array", items: { type: "string" } }
      },
      required: ["complexity", "summary", "risks", "assumptions"]
    },
    stories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          storyId: { type: "string" },
          epicId: { type: "string", nullable: true },
          complexity: { type: "string" },
          effort: {
            type: "object",
            properties: {
              frontendHours: { type: "number" },
              backendHours: { type: "number" },
              databaseHours: { type: "number" },
              integrationHours: { type: "number" },
              testingHours: { type: "number" },
              totalHours: { type: "number" }
            },
            required: ["frontendHours", "backendHours", "databaseHours", "integrationHours", "testingHours", "totalHours"]
          },
          confidence: { type: "string" },
          reasoning: { type: "string" },
          assumptions: { type: "array", items: { type: "string" } },
          risks: { type: "array", items: { type: "string" } }
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

    const { projectId } = await req.json();

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
Consider frontend, backend, data, integrations, security, testing, edge cases, and requirement uncertainty.
Do not assume undocumented complex functionality.
Where information is missing, identify the assumption and reduce confidence.

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

    return NextResponse.json({ estimate: estimateJson });
    
  } catch (err: any) {
    console.error("Estimation error:", err);
    return NextResponse.json({ error: "Unable to generate estimate. Please try again." }, { status: 500 });
  }
}
