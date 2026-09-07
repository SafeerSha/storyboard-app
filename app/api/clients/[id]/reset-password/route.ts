import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import bcrypt from "bcryptjs";
import { generateTemporaryPassword } from "@/lib/client-credentials";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit password resets: max 10 per minute per user
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(`reset-client-password:${user.id}:${ip}`, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: `Too many password reset requests. Please wait ${rateLimit.resetInSeconds} seconds.` },
      { status: 429 }
    );
  }

  try {
    // Check ownership and load client info
    const { data: existingClient, error: clientError } = await supabase
      .from("clients")
      .select("id, name, login_id, project_id, projects!inner(name, owner_id)")
      .eq("id", id)
      .eq("projects.owner_id", user.id)
      .maybeSingle();

    if (clientError || !existingClient) {
      return NextResponse.json({ error: "Client not found or unauthorized." }, { status: 404 });
    }

    // Generate a secure new initial password
    const initialPassword = generateTemporaryPassword();
    const password_hash = await bcrypt.hash(initialPassword, 12);

    const admin = createAdminClient();

    // Update password_hash and set is_password_changed = false
    let updatePayload: Record<string, any> = {
      password_hash,
      is_password_changed: false,
      password_changed_at: null,
    };

    let { error: updateError } = await admin.from("clients").update(updatePayload).eq("id", id);

    if (updateError && (updateError.code === "42703" || updateError.message.includes("is_password_changed"))) {
      // Column is_password_changed not yet migrated in Supabase; update password_hash only
      delete updatePayload.is_password_changed;
      delete updatePayload.password_changed_at;
      const retry = await admin.from("clients").update(updatePayload).eq("id", id);
      updateError = retry.error;
    }

    if (updateError) throw updateError;

    // Immediately revoke all existing client sessions so former passwords or sessions no longer work
    await admin.from("client_sessions").delete().eq("client_id", id);

    const clientProject: any = existingClient.projects;
    const projectName = clientProject?.name || "Assigned Project";

    return NextResponse.json({
      ok: true,
      initialPassword,
      client: {
        id: existingClient.id,
        name: existingClient.name,
        login_id: existingClient.login_id,
        project_id: existingClient.project_id,
        projectName,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to reset password." }, { status: 400 });
  }
}
