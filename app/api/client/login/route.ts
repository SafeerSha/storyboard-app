import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClientSession } from "@/lib/client-session";

const schema = z.object({ loginId: z.string().regex(/^\d{6}$/), password: z.string().min(1).max(200) });
export async function POST(req: Request) {
  try {
    const input = schema.parse(await req.json());
    const supabase = createAdminClient();
    const { data: client } = await supabase.from("clients").select("id,status").eq("login_id", input.loginId).maybeSingle();
    if (!client || client.status !== "active") return NextResponse.json({ error: "Invalid login ID or password." }, { status: 401 });
    const { data: full } = await supabase.from("clients").select("password_hash").eq("id", client.id).single();
    if (!full || !(await bcrypt.compare(input.password, full.password_hash))) return NextResponse.json({ error: "Invalid login ID or password." }, { status: 401 });
    await createClientSession(client.id);
    return NextResponse.json({ ok: true });
  } catch (error: any) { 
    console.error("Login error:", error);
    return NextResponse.json({ error: error?.message || "Unable to sign in." }, { status: 400 }); 
  }
}
