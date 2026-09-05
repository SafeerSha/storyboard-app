"use client";

import { useEffect, useState } from "react";
import { LogOut, Sparkles, Shield, User, Bot } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setEmail(data.user.email);
      setLoading(false);
    });
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div>
      <DashboardHeader category="MANAGE" title="Settings" />

      <main className="mx-auto max-w-[1000px] px-6 py-8 lg:px-9 space-y-8">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-950">Settings</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Manage your freelancer account, workspace preferences, and AI configurations.
          </p>
        </div>

        {/* Account Profile Section */}
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <div className="flex items-center gap-3 border-b border-line pb-4 mb-5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <User size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">Freelancer Account</h3>
              <p className="text-xs text-neutral-400">Authenticated Supabase credentials</p>
            </div>
          </div>

          <div className="space-y-4 max-w-xl">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Email Address</label>
              <p className="mt-1 text-sm font-medium text-neutral-900">
                {loading ? "Loading account..." : email || "freelancer@storyboard"}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Authentication Method</label>
              <p className="mt-1 text-sm text-neutral-600">Supabase Auth (Freelancer session)</p>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-100/60 transition"
              >
                <LogOut size={16} /> Sign out of StoryBoard
              </button>
            </div>
          </div>
        </section>

        {/* AI & Generation Engine */}
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <div className="flex items-center gap-3 border-b border-line pb-4 mb-5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <Bot size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">AI Intelligence Engine</h3>
              <p className="text-xs text-neutral-400">Powered by Google Gemini GenAI</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-medium">Model</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Active
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-neutral-900">Gemini 2.5 Flash</p>
              <p className="mt-1 text-xs text-neutral-500">Fast structured output with JSON schema</p>
            </div>

            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-medium">Capabilities</span>
                <Sparkles size={14} className="text-indigo-500" />
              </div>
              <p className="mt-2 text-sm font-semibold text-neutral-900">Requirement Breakdown</p>
              <p className="mt-1 text-xs text-neutral-500">User stories, criteria & Epic auto-correction</p>
            </div>
          </div>
        </section>

        {/* Security & Access Isolation */}
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <div className="flex items-center gap-3 border-b border-line pb-4 mb-4">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <Shield size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">Authentication & Security Isolation</h3>
              <p className="text-xs text-neutral-400">Client vs Freelancer Separation</p>
            </div>
          </div>

          <p className="text-sm text-neutral-600 leading-relaxed max-w-2xl">
            Freelancers authenticate exclusively via Supabase Auth. Clients authenticate via custom, project-scoped 6-digit credential tokens. Client sessions never access freelancer admin endpoints.
          </p>
        </section>
      </main>
    </div>
  );
}
