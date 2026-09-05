import { NextResponse } from "next/server";
import { deleteClientSession } from "@/lib/client-session";
export async function POST() { await deleteClientSession(); return NextResponse.json({ ok: true }); }
