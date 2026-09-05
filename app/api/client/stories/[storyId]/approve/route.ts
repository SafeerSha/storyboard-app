import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";

export async function POST(req: Request, { params }: { params: Promise<{ storyId: string }> }) {
  const client = await getAuthenticatedClient();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storyId } = await params;
  const db = createAdminClient();
  const { data: story } = await db.from("stories").select("id,project_id").eq("id", storyId).eq("project_id", client.project_id).single();
  
  if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });

  const { error } = await db.from("stories").update({ 
    status: "approved", 
    updated_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    approved_by_client_id: client.id
  }).eq("id", story.id);

  if (error) return NextResponse.json({ error: "Action failed." }, { status: 400 });

  return NextResponse.json({ ok: true, status: "approved" });
}
