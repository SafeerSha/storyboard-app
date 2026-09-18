import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeProjectMember } from "@/lib/project-auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: projectId, noteId } = await params;
    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized || !auth.actor) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 403 });
    }
    const actor = auth.actor;


    const body = await req.json();
    const mode = body.mode || "new_epic_and_stories"; // "new_epic_and_stories" | "existing_epic_stories" | "epic_only"
    const targetEpicId = body.targetEpicId ? String(body.targetEpicId).trim() : null;
    const epicData = body.epic || {};
    const storiesData = Array.isArray(body.stories) ? body.stories : [];

    const admin = createAdminClient();

    // Verify the note exists
    const { data: note, error: noteErr } = await admin
      .from("project_notes")
      .select("*")
      .eq("id", noteId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (noteErr || !note) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }

    let finalEpic: any = null;
    let finalEpicId: string | null = null;

    if (mode === "existing_epic_stories") {
      if (!targetEpicId) {
        return NextResponse.json({ error: "Target Epic ID is required for existing epic conversion." }, { status: 400 });
      }

      const { data: existingEpic, error: epicFetchErr } = await admin
        .from("epics")
        .select("*")
        .eq("id", targetEpicId)
        .eq("project_id", projectId)
        .maybeSingle();

      if (epicFetchErr || !existingEpic) {
        return NextResponse.json({ error: "Target Epic not found in this project." }, { status: 404 });
      }

      finalEpic = existingEpic;
      finalEpicId = existingEpic.id;
    } else {
      // Create new Epic
      const epicName = String(epicData.name || note.title || "New Epic").trim();
      const epicDescription = String(epicData.description || note.content || "").trim();

      const { data: createdEpic, error: createEpicErr } = await admin
        .from("epics")
        .insert({
          project_id: projectId,
          name: epicName,
          description: epicDescription || null,
          status: "active",
          sort_order: 0,
          created_by_id: actor.id,
        })
        .select()
        .single();

      if (createEpicErr) {
        console.error("Failed to create Epic:", createEpicErr);
        return NextResponse.json({ error: createEpicErr.message || "Failed to create Epic" }, { status: 500 });
      }

      finalEpic = createdEpic;
      finalEpicId = createdEpic.id;
    }

    let insertedStories: any[] = [];

    // Create Stories if not epic_only mode
    if (mode !== "epic_only" && storiesData.length > 0) {
      const rowsToInsert = storiesData
        .filter((s: any) => s && s.title && s.title.trim())
        .map((s: any) => ({
          project_id: projectId,
          epic_id: finalEpicId,
          title: String(s.title).trim(),
          description: String(s.description || "").trim(),
          acceptance_criteria: Array.isArray(s.acceptanceCriteria) ? s.acceptanceCriteria : [],
          assumptions: Array.isArray(s.assumptions) ? s.assumptions : [],
          clarifications: Array.isArray(s.clarifications) ? s.clarifications : [],
          raw_requirement: note.content || note.title,
          status: s.status || "draft",
          created_by_id: actor.id,
        }));

      if (rowsToInsert.length > 0) {
        const { data: newStories, error: storiesErr } = await admin
          .from("stories")
          .insert(rowsToInsert)
          .select();

        if (storiesErr) {
          console.error("Failed to create stories during conversion:", storiesErr);
          return NextResponse.json({ error: storiesErr.message || "Failed to create stories." }, { status: 500 });
        }

        insertedStories = newStories || [];
      }
    }

    // Update the note status to converted
    const now = new Date().toISOString();
    const { data: updatedNote, error: updateNoteErr } = await admin
      .from("project_notes")
      .update({
        status: "converted",
        converted_epic_id: finalEpicId,
        converted_at: now,
        updated_at: now,
      })
      .eq("id", noteId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (updateNoteErr) {
      console.warn("Note status update warning:", updateNoteErr.message);
    }

    return NextResponse.json({
      epic: finalEpic,
      stories: insertedStories,
      note: updatedNote || { ...note, status: "converted", converted_epic_id: finalEpicId, converted_at: now },
    }, { status: 201 });
  } catch (err: any) {
    console.error("Conversion commit failed:", err);
    return NextResponse.json({ error: err.message || "Failed to commit conversion." }, { status: 500 });
  }
}
