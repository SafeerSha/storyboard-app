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
        <section className="rounded-2xl border border-[#EBE7F2] bg-[#FAF9FC]/88 p-5 sm:p-6 shadow-card backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-3 border-b border-[#EBE7F2] pb-4">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(184,148,78,0.10)] border border-[rgba(184,148,78,0.15)] text-[#80642F] shrink-0 shadow-xs">
              <User size={17} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#252331] tracking-tight">
                {roleTitle}
              </h3>
              <p className="text-xs text-[#706C7D]">{roleSubtitle}</p>
            </div>
          </div>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1">
                Email Address
              </label>
              <p className="text-sm font-semibold text-[#252331]">
                {loading ? "Loading account..." : email || "freelancer@storyboard"}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1">
                Authentication Method
              </label>
              <div className="flex items-center gap-2 text-xs text-[#4D4959]">
                <CheckCircle2 size={14} className="text-[#2E8B70]" />
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
        <section className="rounded-2xl border border-[#EBE7F2] bg-[#FAF9FC]/88 p-5 sm:p-6 shadow-card backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-3 border-b border-[#EBE7F2] pb-4">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(184,148,78,0.10)] border border-[rgba(184,148,78,0.15)] text-[#80642F] shrink-0">
              <Bot size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#252331] tracking-tight">
                AI Requirements Engine
              </h3>
              <p className="text-xs text-[#706C7D]">Powered by Google Gemini</p>
            </div>
          </div>

          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[#EBE7F2] bg-white/70 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9994A5] font-medium">Model</span>
                <Badge variant="approved" size="sm" showIcon={false}>
                  Active
                </Badge>
              </div>
              <p className="mt-2 text-sm font-semibold text-[#252331]">Gemini 2.5 Flash</p>
              <p className="mt-1 text-xs text-[#706C7D]">Fast structured JSON output schema</p>
            </div>

            <div className="rounded-xl border border-[#EBE7F2] bg-white/70 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9994A5] font-medium">Features</span>
                <Sparkles size={14} className="text-[#B8944E]" />
              </div>
              <p className="mt-2 text-sm font-semibold text-[#252331]">Story Decomposition</p>
              <p className="mt-1 text-xs text-[#706C7D]">Criteria, assumptions & Epic correction</p>
            </div>
          </div>
        </section>

        {/* Security Architecture Card */}
        <section className="rounded-2xl border border-[#EBE7F2] bg-[#FAF9FC]/88 p-5 sm:p-6 shadow-card backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-3 border-b border-[#EBE7F2] pb-4">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#E3F4ED] border border-[#C5E8DB] text-[#2E8B70] shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#252331] tracking-tight">
                Role & Session Isolation
              </h3>
              <p className="text-xs text-[#706C7D]">Client vs Team vs Admin Boundary</p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#4D4959] leading-relaxed max-w-2xl">
            Freelancers authenticate via Supabase Auth. Clients authenticate via custom, project-scoped 6-digit credential PINs. Team members authenticate via assigned user sessions. All API routes enforce strict role boundaries and project authorization.
          </p>
        </section>
      </main>
    </div>
  );
}
