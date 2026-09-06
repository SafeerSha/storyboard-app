import { NextResponse } from "next/server";
import { deleteTeamSession } from "@/lib/team-session";

export async function POST() {
  await deleteTeamSession();
  return NextResponse.json({ success: true, redirect: "/team/login" });
}
