import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";

const schema = z.object({ storyId: z.string().uuid(), action: z.enum(["approve", "request_changes"]), comment: z.string().max(3000).optional() });
export async function POST(req: Request) {
  const client = await getAuthenticatedClient();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = schema.parse(await req.json());
    const db = createAdminClient();
    
    const { data: story } = await db.from("stories").select("id,project_id").eq("id", input.storyId).eq("project_id", client.project_id).single();
    if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });
    const status = input.action === "approve" ? "approved" : "changes_requested";
    
    // Add approved_by_client_id if needed, but not required by schema yet, leaving as is
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (status === "approved") {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by_client_id = client.id;
    }
    
    const { error } = await db.from("stories").update(updateData).eq("id", story.id);
    if (error) throw error;
    if (input.comment?.trim()) await db.from("story_comments").insert({ story_id: story.id, author_name: client.name, body: input.comment.trim() });
    return NextResponse.json({ ok: true, status });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Action failed." }, { status: 400 }); }
}
