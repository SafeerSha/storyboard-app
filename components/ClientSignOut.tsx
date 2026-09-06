"use client";
import { LogOut } from "lucide-react";
export function ClientSignOut(){async function out(){await fetch("/api/client/logout",{method:"POST"});location.href="/login";}return <button onClick={out} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm text-neutral-600"><LogOut size={15}/> Sign out</button>}
