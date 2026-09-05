import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";

export async function GET() {
  const client = await getAuthenticatedClient();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data: stories, error } = await db.from("stories").select("*").eq("project_id", client.project_id).order("created_at");
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stories: stories ?? [] });
}
