import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeProjectMember } from "@/lib/project-auth";
import { convertNoteToRequirements } from "@/lib/ai/gemini";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: projectId, noteId } = await params;
    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const targetEpicId = body.targetEpicId ? String(body.targetEpicId).trim() : null;

    const admin = createAdminClient();
    const { data: note, error: noteErr } = await admin
      .from("project_notes")
      .select("*")
      .eq("id", noteId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (noteErr || !note) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }

    if (!note.content && !note.title) {
      return NextResponse.json({ error: "Note is empty. Please add discussion points before converting." }, { status: 400 });
    }

    let targetEpicName: string | undefined = undefined;
    if (targetEpicId) {
      const { data: epic } = await admin
        .from("epics")
        .select("id, name")
        .eq("id", targetEpicId)
        .eq("project_id", projectId)
        .maybeSingle();

      if (epic) {
        targetEpicName = epic.name;
      }
    }

    // Call AI to generate requirements preview
    const result = await convertNoteToRequirements(
      note.title || "Discussion Note",
      note.content || note.title,
      { targetEpicName }
    );

    return NextResponse.json({
      epic: result.epic,
      stories: result.stories.map((s) => ({
        ...s,
        enabled: true,
      })),
    });
  } catch (err: any) {
    console.error("Conversion preview failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate conversion preview. Please verify AI configuration." },
      { status: 500 }
    );
  }
}
