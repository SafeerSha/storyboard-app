import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";

const schema = z.object({ comment: z.string().max(3000) });

export async function POST(req: Request, { params }: { params: Promise<{ storyId: string }> }) {
  const client = await getAuthenticatedClient();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { storyId } = await params;
    const input = schema.parse(await req.json());
    const db = createAdminClient();
    const { data: story } = await db.from("stories").select("id,project_id").eq("id", storyId).eq("project_id", client.project_id).single();
    
    if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });

    const { error } = await db.from("stories").update({ 
      status: "changes_requested", 
      updated_at: new Date().toISOString() 
    }).eq("id", story.id);

    if (error) throw error;

    if (input.comment.trim()) {
      await db.from("story_comments").insert({ 
        story_id: story.id, 
        author_name: client.name, 
        body: input.comment.trim() 
      });
    }

    return NextResponse.json({ ok: true, status: "changes_requested" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Action failed." }, { status: 400 });
  }
}
