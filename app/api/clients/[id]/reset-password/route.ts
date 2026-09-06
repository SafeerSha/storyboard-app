import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { password } = schema.parse(await req.json());
    
    // Check ownership
    const { data: existingClient, error: clientError } = await supabase
      .from("clients")
      .select("id, projects!inner(owner_id)")
      .eq("id", id)
      .eq("projects.owner_id", user.id)
      .maybeSingle();

    if (clientError || !existingClient) {
      return NextResponse.json({ error: "Client not found or unauthorized." }, { status: 404 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    
    // Use admin client to invalidate client sessions since freelancers don't have RLS access to client_sessions table
    const admin = createAdminClient();
    
    const { error: updateError } = await admin.from("clients").update({ password_hash }).eq("id", id);
    if (updateError) throw updateError;

    const { error: sessionError } = await admin.from("client_sessions").delete().eq("client_id", id);
    if (sessionError) throw sessionError;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to reset password." }, { status: 400 });
  }
}
