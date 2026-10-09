import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAnyFreelancer } from "@/lib/super-admin";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z
    .string()
    .email("Invalid email format")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v && typeof v === "string" && v.trim() !== "" ? v.trim().toLowerCase() : null)),
  project_id: z.string().uuid().optional(),
  login_id: z.string().regex(/^\d{6}$/, "Login ID must be exactly 6 digits").optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await verifyAnyFreelancer();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  try {
    const body = patchSchema.parse(await req.json());
    
    // Check if client exists and belongs to the freelancer (or actor is super admin)
    let clientQuery = admin
      .from("clients")
      .select("id, project_id, projects!inner(owner_id)")
      .eq("id", id);

    if (!actor.isSuperAdmin) {
      clientQuery = clientQuery.eq("projects.owner_id", actor.id);
    }

    const { data: existingClient, error: clientError } = await clientQuery.maybeSingle();

    if (clientError || !existingClient) {
      return NextResponse.json({ error: "Client not found or unauthorized." }, { status: 404 });
    }

    // If changing project_id, verify the new project also belongs to the freelancer (if not super admin)
    if (body.project_id && body.project_id !== existingClient.project_id && !actor.isSuperAdmin) {
      const { data: newProject, error: projectError } = await admin
        .from("projects")
        .select("id")
        .eq("id", body.project_id)
        .eq("owner_id", actor.id)
        .maybeSingle();
      
      if (projectError || !newProject) {
        return NextResponse.json({ error: "Invalid project assignment." }, { status: 403 });
      }
    }

    let { data: updatedClient, error: updateError } = await admin
      .from("clients")
      .update(body)
      .eq("id", id)
      .select("id,name,email,login_id,status,project_id,projects(name)")
      .single();

    if (updateError && (updateError.code === "42703" || updateError.message.includes("email"))) {
      const { email: _omitEmail, ...retryBody } = body;
      const retry = await admin
        .from("clients")
        .update(retryBody)
        .eq("id", id)
        .select("id,name,login_id,status,project_id,projects(name)")
        .single();
      
      updatedClient = retry.data ? { ...retry.data, email: body.email } : null;
      updateError = retry.error;
    }

    if (updateError) {
      if (updateError.code === "23505" && updateError.message.includes("login_id")) {
        return NextResponse.json({ error: "That Login ID is already in use." }, { status: 409 });
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ client: updatedClient });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to update client" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await verifyAnyFreelancer();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  try {
    let clientQuery = admin
      .from("clients")
      .select("id, project_id, projects!inner(owner_id)")
      .eq("id", id);

    if (!actor.isSuperAdmin) {
      clientQuery = clientQuery.eq("projects.owner_id", actor.id);
    }

    const { data: existingClient, error: clientError } = await clientQuery.maybeSingle();

    if (clientError || !existingClient) {
      return NextResponse.json({ error: "Client not found or unauthorized." }, { status: 404 });
    }

    // Revoke all active portal sessions first
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
