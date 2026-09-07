"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  LogOut,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string>("freelancer");
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data?.authenticated && data?.user) {
          setEmail(data.user.email);
          setRole(data.user.role);
          setName(data.user.name);
        }
      })
      .catch(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
          if (data?.user?.email) setEmail(data.user.email);
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.flash("success", "Signed out successfully");
    window.location.href = "/login";
  }

  const roleTitle = role === "super_admin" ? "Super Admin Account" : "Freelancer Account";
  const roleSubtitle =
    role === "super_admin"
      ? "Authenticated workspace primary administrator"
      : "Authenticated workspace freelancer";

  return (
    <div>
      <DashboardHeader
        eyebrow="MANAGE"
        title="Settings"
        description="Account preferences and system configurations."
        maxWidth="max-w-4xl"
      />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        {/* Account Profile Card */}
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white shrink-0 shadow-xs">
              <User size={17} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                {roleTitle}
              </h3>
              <p className="text-xs text-zinc-400">{roleSubtitle}</p>
            </div>
          </div>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Email Address
              </label>
              <p className="text-sm font-semibold text-slate-900">
                {loading ? "Loading account..." : email || "freelancer@storyboard"}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Authentication Method
              </label>
              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Supabase Secure Auth Session</span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="danger"
                size="sm"
                leftIcon={<LogOut size={14} />}
                onClick={handleSignOut}
              >
                Sign out of StoryBoard
              </Button>
            </div>
          </div>
        </section>

        {/* AI Engine Card */}
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <Bot size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                AI Requirements Engine
              </h3>
              <p className="text-xs text-zinc-400">Powered by Google Gemini</p>
            </div>
          </div>

          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-medium">Model</span>
                <Badge variant="approved" size="sm" showIcon={false}>
                  Active
                </Badge>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">Gemini 2.5 Flash</p>
              <p className="mt-1 text-xs text-zinc-500">Fast structured JSON output schema</p>
            </div>

            <div className="rounded-xl border border-zinc-200/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-medium">Features</span>
                <Sparkles size={14} className="text-indigo-600" />
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">Story Decomposition</p>
              <p className="mt-1 text-xs text-zinc-500">Criteria, assumptions & Epic correction</p>
            </div>
          </div>
        </section>

        {/* Security Architecture Card */}
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                Role & Session Isolation
              </h3>
              <p className="text-xs text-zinc-400">Client vs Team vs Admin Boundary</p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-2xl">
            Freelancers authenticate via Supabase Auth. Clients authenticate via custom, project-scoped 6-digit credential PINs. Team members authenticate via assigned user sessions. All API routes enforce strict role boundaries and project authorization.
          </p>
        </section>
      </main>
    </div>
  );
}
