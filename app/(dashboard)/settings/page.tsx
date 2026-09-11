"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bot,
  Calculator,
  CheckCircle2,
  LogOut,
  Mail,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { RemunerationClient } from "@/app/(dashboard)/remuneration/RemunerationClient";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"general" | "remuneration" | "quotations">("general");
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string>("freelancer");
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Email settings state
  const [emailFrom, setEmailFrom] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Fetch email settings from DB
  const fetchEmailSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data?.ok && data?.settings) {
        setEmailFrom(data.settings.email_from || "");
        setFullName(data.settings.full_name || "");
      }
    } catch (err) {
      console.error("Failed to load email settings:", err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmailSettings();
  }, [fetchEmailSettings]);

  async function handleSaveEmailSettings() {
    setSettingsSaving(true);
    setSettingsSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_from: emailFrom.trim(),
          full_name: fullName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      toast.success("Email settings saved successfully.");
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err: any) {
      toast.error(err.message || "Failed to save email settings.");
    } finally {
      setSettingsSaving(false);
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "remuneration") {
        setActiveTab("remuneration");
      } else if (tabParam === "quotations" || tabParam === "sent_quotations") {
        setActiveTab("quotations");
      }
    }

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

  function handleTabChange(tab: "general" | "remuneration" | "quotations") {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "general") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", tab);
      }
      window.history.replaceState({}, "", url.toString());
    }
  }

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
        description={
          activeTab === "remuneration"
            ? "Calculate project effort, rate models, and expected remuneration."
            : activeTab === "quotations"
            ? "Track sent quotations, client review decisions, negotiation discussions, and revocations."
            : "Account preferences and system configurations."
        }
        maxWidth={activeTab === "remuneration" || activeTab === "quotations" ? "max-w-5xl" : "max-w-4xl"}
      />

      <main
        className={`mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6 transition-all duration-200 ${
          activeTab === "remuneration" || activeTab === "quotations" ? "max-w-5xl" : "max-w-4xl"
        }`}
      >
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#EBE7F2] pb-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => handleTabChange("general")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "general"
                ? "bg-[#B8944E] text-white shadow-sm"
                : "bg-white/80 border border-[#EBE7F2] text-[#706C7D] hover:bg-white hover:text-[#252331]"
            }`}
          >
            <User size={15} className={activeTab === "general" ? "text-white" : "text-[#9994A5]"} />
            <span>Account & Workspace</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("remuneration")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "remuneration"
                ? "bg-[#B8944E] text-white shadow-sm"
                : "bg-white/80 border border-[#EBE7F2] text-[#706C7D] hover:bg-white hover:text-[#252331]"
            }`}
          >
            <Calculator
              size={15}
              className={activeTab === "remuneration" ? "text-white" : "text-[#B8944E]"}
            />
            <span>Remuneration Calculator</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                activeTab === "remuneration"
                  ? "bg-[#80642F] text-white"
                  : "bg-[rgba(184,148,78,0.10)] text-[#80642F] border border-[rgba(184,148,78,0.18)]"
              }`}
            >
              Estimator
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("quotations")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "quotations"
                ? "bg-[#B8944E] text-white shadow-sm"
                : "bg-white/80 border border-[#EBE7F2] text-[#706C7D] hover:bg-white hover:text-[#252331]"
            }`}
          >
            <Send
              size={14}
              className={activeTab === "quotations" ? "text-white" : "text-[#B8944E]"}
            />
            <span>Sent Quotations</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                activeTab === "quotations"
                  ? "bg-[#80642F] text-white"
                  : "bg-[rgba(184,148,78,0.10)] text-[#80642F] border border-[rgba(184,148,78,0.18)]"
              }`}
            >
              Proposals
            </span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "remuneration" || activeTab === "quotations" ? (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="rounded-2xl border border-[#EBE7F2] bg-[#FAF9FC]/88 p-5 sm:p-6 shadow-card backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EBE7F2] pb-5">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-[rgba(184,148,78,0.10)] border border-[rgba(184,148,78,0.18)] text-[#80642F] shrink-0 shadow-xs">
                    {activeTab === "quotations" ? <Send size={20} /> : <Calculator size={20} />}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#252331] tracking-tight">
                      {activeTab === "quotations" ? "Sent Quotations & Client Proposals" : "Project Remuneration Estimator"}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#706C7D] mt-0.5">
                      {activeTab === "quotations"
                        ? "Track sent quotations, client review decisions, negotiation threads, and recall or edit proposals."
                        : "Estimate story effort, calculate expected earnings, and export estimates to PDF & Excel."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <RemunerationClient
                  activeView={activeTab === "quotations" ? "quotations" : "calculator"}
                  onViewChange={(view) => handleTabChange(view === "quotations" ? "quotations" : "remuneration")}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-200">
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
                    Sign out of Reqly
                  </Button>
                </div>
              </div>
            </section>

            {/* Email & Notifications Card */}
            <section className="rounded-2xl border border-[#EBE7F2] bg-[#FAF9FC]/88 p-5 sm:p-6 shadow-card backdrop-blur-xl space-y-4">
              <div className="flex items-center gap-3 border-b border-[#EBE7F2] pb-4">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(184,148,78,0.10)] border border-[rgba(184,148,78,0.15)] text-[#80642F] shrink-0 shadow-xs">
                  <Mail size={17} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#252331] tracking-tight">
                    Email & Notifications
                  </h3>
                  <p className="text-xs text-[#706C7D]">Configure the sender identity for outgoing email notifications</p>
                </div>
              </div>

              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Safeer Shah"
                    disabled={settingsLoading}
                    className="w-full rounded-lg border border-[#EBE7F2] bg-white px-3 py-2.5 text-sm text-[#252331] placeholder-[#B8B4C2] focus:outline-none focus:ring-2 focus:ring-[#B8944E]/30 focus:border-[#B8944E] transition-all disabled:opacity-50"
                  />
                  <p className="mt-1 text-[11px] text-[#9994A5]">
                    Your name as it appears in sent emails
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
                    Email From Address
                  </label>
                  <input
                    type="text"
                    value={emailFrom}
                    onChange={(e) => setEmailFrom(e.target.value)}
                    placeholder='e.g. Safeer Shah <safeer@gmail.com>'
                    disabled={settingsLoading}
                    className="w-full rounded-lg border border-[#EBE7F2] bg-white px-3 py-2.5 text-sm text-[#252331] placeholder-[#B8B4C2] focus:outline-none focus:ring-2 focus:ring-[#B8944E]/30 focus:border-[#B8944E] transition-all disabled:opacity-50 font-mono text-xs"
                  />
                  <p className="mt-1 text-[11px] text-[#9994A5]">
                    The &quot;From&quot; header on quotation emails, discussion notifications, and recall notices. Format: <code className="bg-[#F4F1F9] px-1 py-0.5 rounded text-[10px]">Name &lt;email@domain.com&gt;</code>
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={settingsSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                    onClick={handleSaveEmailSettings}
                    disabled={settingsSaving || settingsLoading}
                  >
                    {settingsSaving ? "Saving..." : settingsSaved ? "Saved" : "Save Email Settings"}
                  </Button>
                  {settingsSaved && (
                    <span className="text-xs text-[#2E8B70] font-medium animate-in fade-in duration-300">
                      ✓ Settings updated
                    </span>
                  )}
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
          </div>
        )}
      </main>
    </div>
  );
}
