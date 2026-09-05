import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function randomLoginId() { return String(Math.floor(100000 + Math.random() * 900000)); }
function randomPassword() { return crypto.randomUUID().replaceAll("-", "").slice(0, 12); }

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("clients").select("id,name,login_id,status,project_id,projects(name)").eq("projects.owner_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = String(body.name || "").trim();
  const projectId = String(body.projectId || "").trim();
  if (!name || !projectId) return NextResponse.json({ error: "Client name and project are required." }, { status: 400 });
  const admin = createAdminClient();
  const { data: project } = await admin.from("projects").select("id").eq("id", projectId).eq("owner_id", user.id).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  let loginId = String(body.loginId || "").trim();
  let password = String(body.password || "");
  if (!/^\d{6}$/.test(loginId)) loginId = randomLoginId();
  if (!password) password = randomPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const { data: client, error } = await admin.from("clients").insert({ project_id: projectId, name, login_id: loginId, password_hash: passwordHash }).select("id,name,login_id,status,project_id").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Login ID already exists. Generate another one." : error.message }, { status: 400 });
  return NextResponse.json({ client, generatedPassword: password }, { status: 201 });
}
