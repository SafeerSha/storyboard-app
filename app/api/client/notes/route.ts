import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const client = await getAuthenticatedClient();
    if (!client || !client.project_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: notes, error } = await admin
      .from("project_notes")
      .select("id, project_id, title, content, tags, images, status, created_by_name, created_at, updated_at")
      .eq("project_id", client.project_id)
      .eq("is_client_visible", true)
      .neq("status", "archived")
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("[Client Notes] Error fetching notes:", error.message);
      return NextResponse.json({ notes: [] });
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (err: any) {
    console.error("[Client Notes Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to load notes" }, { status: 500 });
  }
}
