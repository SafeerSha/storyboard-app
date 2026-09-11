import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  project_id: z.string().uuid().optional(),
  login_id: z.string().regex(/^\d{6}$/, "Login ID must be exactly 6 digits").optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = patchSchema.parse(await req.json());
    
    // Check if client belongs to a project owned by the freelancer
    const { data: existingClient, error: clientError } = await supabase
      .from("clients")
      .select("id, project_id, projects!inner(owner_id)")
      .eq("id", id)
      .eq("projects.owner_id", user.id)
      .maybeSingle();

    if (clientError || !existingClient) {
      return NextResponse.json({ error: "Client not found or unauthorized." }, { status: 404 });
    }

    // If changing project_id, verify the new project also belongs to the freelancer
    if (body.project_id && body.project_id !== existingClient.project_id) {
      const { data: newProject, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", body.project_id)
        .eq("owner_id", user.id)
        .maybeSingle();
      
      if (projectError || !newProject) {
        return NextResponse.json({ error: "Invalid project assignment." }, { status: 403 });
      }
    }

    // If changing login_id, it is handled uniquely by the database, but let's just let it bubble up as 409 if duplicate.

    const { data: updatedClient, error: updateError } = await supabase
      .from("clients")
      .update(body)
      .eq("id", id)
      .select("id,name,login_id,status,project_id,projects(name)")
      .single();

    if (updateError) {
      // Check for unique constraint violation on login_id
      if (updateError.code === "23505" && updateError.message.includes("login_id")) {
        return NextResponse.json({ error: "That Login ID is already in use." }, { status: 409 });
      }
      throw updateError;
    }

    return NextResponse.json({ client: updatedClient });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update client." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Verify client belongs to a project owned by this user
    const { data: existingClient, error: clientError } = await supabase
      .from("clients")
      .select("id, project_id, projects!inner(owner_id)")
      .eq("id", id)
      .eq("projects.owner_id", user.id)
      .maybeSingle();

    if (clientError || !existingClient) {
      return NextResponse.json({ error: "Client not found or unauthorized." }, { status: 404 });
    }

    // Revoke all active portal sessions first
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    await admin.from("client_sessions").delete().eq("client_id", id);

    // Delete the client record
    const { error: deleteError } = await admin
      .from("clients")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to remove client." }, { status: 500 });
  }
}

