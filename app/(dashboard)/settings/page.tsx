"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bot,
  Calculator,
  CheckCircle2,
  Copy,
  Check,
  LogOut,
  Mail,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  KeyRound,
  UploadCloud,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { RemunerationClient } from "@/app/(dashboard)/remuneration/RemunerationClient";
import { MediaUploadZone } from "@/components/media/MediaUploadZone";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"general" | "remuneration" | "quotations">("general");
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string>("freelancer");
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Super Admin — Create Freelancer state
  const [showCreateFreelancer, setShowCreateFreelancer] = useState(false);
  const [newFreelancerName, setNewFreelancerName] = useState("");
  const [newFreelancerEmail, setNewFreelancerEmail] = useState("");
  const [newFreelancerPassword, setNewFreelancerPassword] = useState("");
  const [creatingFreelancer, setCreatingFreelancer] = useState(false);
  const [createFreelancerError, setCreateFreelancerError] = useState("");
  const [createdFreelancerCreds, setCreatedFreelancerCreds] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);
  const [copiedFreelancerCreds, setCopiedFreelancerCreds] = useState(false);

  function generatePassword() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
    let p = "";
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
    return p;
  }

  async function handleCreateFreelancer(e: React.FormEvent) {
    e.preventDefault();
    if (!newFreelancerName.trim() || !newFreelancerEmail.trim() || !newFreelancerPassword.trim()) return;
    setCreatingFreelancer(true);
    setCreateFreelancerError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFreelancerName.trim(),
          email: newFreelancerEmail.trim().toLowerCase(),
          password: newFreelancerPassword,
          role: "freelancer",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create account.");
      toast.success("Freelancer account created successfully");
      setCreatedFreelancerCreds({
        name: newFreelancerName.trim(),
        email: newFreelancerEmail.trim().toLowerCase(),
        password: newFreelancerPassword,
      });
      setShowCreateFreelancer(false);
      setNewFreelancerName("");
      setNewFreelancerEmail("");
      setNewFreelancerPassword("");
    } catch (err: any) {
      setCreateFreelancerError(err.message || "Failed to create account.");
    } finally {
      setCreatingFreelancer(false);
    }
  }

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
        className={`mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6 transition-all duration-200 ${activeTab === "remuneration" || activeTab === "quotations" ? "max-w-5xl" : "max-w-4xl"
          }`}
      >
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => handleTabChange("general")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${activeTab === "general"
              ? "bg-[#CCA038] text-white shadow-sm"
              : "bg-white/80 border border-[#E2E8F0] text-[#334155] hover:bg-white hover:text-[#0F172A]"
              }`}
          >
            <User size={15} className={activeTab === "general" ? "text-white" : "text-[#64748B]"} />
            <span>Account & Workspace</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("remuneration")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${activeTab === "remuneration"
              ? "bg-[#CCA038] text-white shadow-sm"
              : "bg-white/80 border border-[#E2E8F0] text-[#334155] hover:bg-white hover:text-[#0F172A]"
              }`}
          >
            <Calculator
              size={15}
              className={activeTab === "remuneration" ? "text-white" : "text-[#CCA038]"}
            />
            <span>Invoice Generator</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${activeTab === "remuneration"
                ? "bg-[#785312] text-white"
                : "bg-[rgba(204,160,56,0.10)] text-[#785312] border border-[rgba(204,160,56,0.18)]"
                }`}
            >
              Estimator
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("quotations")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${activeTab === "quotations"
              ? "bg-[#CCA038] text-white shadow-sm"
              : "bg-white/80 border border-[#E2E8F0] text-[#334155] hover:bg-white hover:text-[#0F172A]"
              }`}
          >
            <Send
              size={14}
              className={activeTab === "quotations" ? "text-white" : "text-[#CCA038]"}
            />
            <span>Sent Quotations</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${activeTab === "quotations"
                ? "bg-[#785312] text-white"
                : "bg-[rgba(204,160,56,0.10)] text-[#785312] border border-[rgba(204,160,56,0.18)]"
                }`}
            >
              Proposals
            </span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "remuneration" || activeTab === "quotations" ? (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8F9FB]/88 p-5 sm:p-6 shadow-card backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-[rgba(204,160,56,0.10)] border border-[rgba(204,160,56,0.18)] text-[#785312] shrink-0 shadow-xs">
                    {activeTab === "quotations" ? <Send size={20} /> : <Calculator size={20} />}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight">
                      {activeTab === "quotations" ? "Sent Quotations & Client Proposals" : "Project Remuneration Estimator"}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#334155] mt-0.5">
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
            <section className="rounded-2xl border border-[#E2E8F0] bg-[#F8F9FB]/88 p-5 sm:p-6 shadow-card backdrop-blur-xl space-y-4">
              <div className="flex items-center gap-3 border-b border-[#E2E8F0] pb-4">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(204,160,56,0.10)] border border-[rgba(204,160,56,0.15)] text-[#785312] shrink-0 shadow-xs">
                  <User size={17} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A] tracking-tight">
                    {roleTitle}
                  </h3>
                  <p className="text-xs text-[#334155]">{roleSubtitle}</p>
                </div>
              </div>

              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                    Email Address
                  </label>
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {loading ? "Loading account..." : email || "freelancer@storyboard"}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                    Authentication Method
                  </label>
                  <div className="flex items-center gap-2 text-xs text-[#4D4959]">
                    <CheckCircle2 size={14} className="text-[#059669]" />
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

            {/* Security & Password Card */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-[#F8F9FB]/88 p-5 sm:p-6 shadow-card backdrop-blur-xl space-y-4">
              <div className="flex items-center gap-3 border-b border-[#E2E8F0] pb-4">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(204,160,56,0.10)] border border-[rgba(204,160,56,0.15)] text-[#785312] shrink-0 shadow-xs">
                  <KeyRound size={17} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A] tracking-tight">
                    Security & Password
                  </h3>
                  <p className="text-xs text-[#334155]">Manage your account login credentials</p>
                </div>
              </div>

              <div className="space-y-4 max-w-md">
                <p className="text-xs text-[#585365] leading-relaxed">
                  To protect your account, changing your password requires entering a 6-digit one-time verification code sent to your registered email address ({email || "your account email"}).
                </p>

                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<KeyRound size={14} className="text-[#CCA038]" />}
                    onClick={() => setShowChangePassword(true)}
                    disabled={loading || !email}
                  >
                    Change Password
                  </Button>
                </div>
              </div>
            </section>

            {/* Email & Notifications Card */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-[#F8F9FB]/88 p-5 sm:p-6 shadow-card backdrop-blur-xl space-y-4">
              <div className="flex items-center gap-3 border-b border-[#E2E8F0] pb-4">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(204,160,56,0.10)] border border-[rgba(204,160,56,0.15)] text-[#785312] shrink-0 shadow-xs">
                  <Mail size={17} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A] tracking-tight">
                    Email & Notifications
                  </h3>
                  <p className="text-xs text-[#334155]">Configure the sender identity for outgoing email notifications</p>
                </div>
              </div>

              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Your Name"
                    disabled={settingsLoading}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder-[#B8B4C2] focus:outline-none focus:ring-2 focus:ring-[#CCA038]/30 focus:border-[#CCA038] transition-all disabled:opacity-50"
                  />
                  <p className="mt-1 text-[11px] text-[#64748B]">
                    Your name as it appears in sent emails
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Email From Address
                  </label>
                  <input
                    type="text"
                    value={emailFrom}
                    onChange={(e) => setEmailFrom(e.target.value)}
                    placeholder='e.g. Your Name <your-email@reqly.in>'
                    disabled={settingsLoading}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder-[#B8B4C2] focus:outline-none focus:ring-2 focus:ring-[#CCA038]/30 focus:border-[#CCA038] transition-all disabled:opacity-50 font-mono text-xs"
                  />
                  <p className="mt-1 text-[11px] text-[#64748B]">
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
                    <span className="text-xs text-[#059669] font-medium animate-in fade-in duration-300">
                      ✓ Settings updated
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* AI Engine Card — Super Admin Only */}
            {role === "super_admin" && (
              <section className="rounded-2xl border border-[#E2E8F0] bg-[#F8F9FB]/88 p-5 sm:p-6 shadow-card backdrop-blur-xl space-y-4">
                <div className="flex items-center gap-3 border-b border-[#E2E8F0] pb-4">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(204,160,56,0.10)] border border-[rgba(204,160,56,0.15)] text-[#785312] shrink-0">
                    <Bot size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#0F172A] tracking-tight">
                      AI Requirements Engine
                    </h3>
                    <p className="text-xs text-[#334155]">Powered by Google Gemini</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#E2E8F0] bg-white/70 p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#64748B] font-medium">Model</span>
                      <Badge variant="approved" size="sm" showIcon={false}>
                        Active
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#0F172A]">Gemini 2.5 Flash</p>
                    <p className="mt-1 text-xs text-[#334155]">Fast structured JSON output schema</p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-white/70 p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#64748B] font-medium">Features</span>
                      <Sparkles size={14} className="text-[#CCA038]" />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#0F172A]">Story Decomposition</p>
                    <p className="mt-1 text-xs text-[#334155]">Criteria, assumptions & Epic correction</p>
                  </div>
                </div>
              </section>
            )}

            {/* Security Architecture Card — Super Admin Only */}
            {role === "super_admin" && (
              <section className="rounded-2xl border border-[#E2E8F0] bg-[#F8F9FB]/88 p-5 sm:p-6 shadow-card backdrop-blur-xl space-y-4">
                <div className="flex items-center gap-3 border-b border-[#E2E8F0] pb-4">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#E3F4ED] border border-[#C5E8DB] text-[#059669] shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#0F172A] tracking-tight">
                      Role & Session Isolation
                    </h3>
                    <p className="text-xs text-[#334155]">Client vs Team vs Admin Boundary</p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-[#4D4959] leading-relaxed max-w-2xl">
                  Freelancers authenticate via Supabase Auth. Clients authenticate via custom, project-scoped 6-digit credential PINs. Team members authenticate via assigned user sessions. All API routes enforce strict role boundaries and project authorization.
                </p>
              </section>
            )}

            {/* Media & Asset Uploads Card (Story 2) */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-[#F8F9FB]/88 p-5 sm:p-6 shadow-card backdrop-blur-xl space-y-4">
              <div className="flex items-center gap-3 border-b border-[#E2E8F0] pb-4">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(204,160,56,0.10)] border border-[rgba(204,160,56,0.15)] text-[#785312] shrink-0 shadow-xs">
                  <UploadCloud size={17} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0F172A] tracking-tight">
                    Media & Asset Uploads
                  </h3>
                  <p className="text-xs text-[#334155]">Upload project visual assets, screenshots, and walkthrough videos</p>
                </div>
              </div>

              <div className="max-w-2xl">
                <p className="text-xs text-[#585365] mb-4 leading-relaxed">
                  Upload project assets, epic mockups, or video demonstrations. Supports PNG, JPG, WebP, GIF, SVG (up to 15MB) and MP4, WebM, MOV (up to 100MB) with automatic format validation and instant playback preview.
                </p>
                <MediaUploadZone
                  onUploadComplete={(result) => {
                    toast.success("Media asset uploaded successfully", result.fileName);
                  }}
                />
              </div>
            </section>

            {/* Super Admin Only — User Management Card */}
            {role === "super_admin" && (
              <section className="rounded-2xl border border-[#D4B896] bg-[#FBF8F3]/90 p-5 sm:p-6 shadow-card backdrop-blur-xl space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(204,160,56,0.12)] border border-[rgba(204,160,56,0.25)] text-[#785312] shrink-0 shadow-xs">
                      <Users size={17} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-[#0F172A] tracking-tight">User Management</h3>
                        <span className="inline-flex items-center rounded-md bg-[rgba(204,160,56,0.12)] border border-[rgba(204,160,56,0.25)] px-2 py-0.5 text-[10px] font-semibold text-[#785312]">
                          Super Admin Only
                        </span>
                      </div>
                      <p className="text-xs text-[#334155]">Create and manage freelancer workspace accounts</p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={() => {
                      setNewFreelancerName("");
                      setNewFreelancerEmail("");
                      setNewFreelancerPassword(generatePassword());
                      setCreateFreelancerError("");
                      setShowCreateFreelancer(true);
                    }}
                  >
                    Add Freelancer
                  </Button>
                </div>

                <div className="rounded-xl border border-dashed border-[#D4B896] bg-[rgba(204,160,56,0.04)] p-4">
                  <p className="text-xs text-[#334155] leading-relaxed">
                    Freelancer accounts have access to their own projects, clients, inbox, and settings — but cannot access team member management or other users' data. Only Super Admins can create new freelancer accounts.
                  </p>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Create Freelancer Modal — Super Admin Only */}
      <Modal
        isOpen={showCreateFreelancer}
        onClose={() => setShowCreateFreelancer(false)}
        title="Add Freelancer Account"
        description="Create a new freelancer workspace account with Supabase Auth access."
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => setShowCreateFreelancer(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="create-freelancer-form"
              isLoading={creatingFreelancer}
              disabled={!newFreelancerName.trim() || !newFreelancerEmail.trim() || !newFreelancerPassword.trim()}
            >
              Create Account
            </Button>
          </>
        }
      >
        <form id="create-freelancer-form" onSubmit={handleCreateFreelancer} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#334155] mb-1.5">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={newFreelancerName}
              onChange={(e) => setNewFreelancerName(e.target.value)}
              placeholder="e.g. Vivek Babu"
              className="h-10 w-full rounded-xl border border-[#E2E8F0] bg-white px-3.5 text-sm text-[#0F172A] outline-none transition focus:border-[#CCA038] focus:ring-1 focus:ring-[rgba(204,160,56,0.14)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#334155] mb-1.5">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={newFreelancerEmail}
              onChange={(e) => setNewFreelancerEmail(e.target.value.toLowerCase())}
              placeholder="e.g. vivek@example.com"
              className="h-10 w-full rounded-xl border border-[#E2E8F0] bg-white px-3.5 text-sm font-mono text-[#0F172A] outline-none transition focus:border-[#CCA038] focus:ring-1 focus:ring-[rgba(204,160,56,0.14)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#334155]">
                Initial Password <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setNewFreelancerPassword(generatePassword())}
                className="text-xs text-[#785312] hover:underline"
              >
                Regenerate
              </button>
            </div>
            <input
              type="text"
              required
              value={newFreelancerPassword}
              onChange={(e) => setNewFreelancerPassword(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#E2E8F0] bg-white px-3.5 text-sm font-mono text-[#0F172A] outline-none transition focus:border-[#CCA038] focus:ring-1 focus:ring-[rgba(204,160,56,0.14)]"
            />
            <p className="mt-1 text-[11px] text-[#64748B]">Share this with the freelancer — they should change it after first login.</p>
          </div>

          {createFreelancerError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg">{createFreelancerError}</p>
          )}
        </form>
      </Modal>

      {/* Credentials Reveal Modal */}
      <Modal
        isOpen={Boolean(createdFreelancerCreds)}
        onClose={() => setCreatedFreelancerCreds(null)}
        title="Freelancer Account Created"
        description="Share these credentials with the freelancer to grant them access."
        footer={
          <Button variant="primary" onClick={() => setCreatedFreelancerCreds(null)}>
            Done
          </Button>
        }
      >
        {createdFreelancerCreds && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#C5E8DB] bg-[#E3F4ED]/60 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#059669] font-medium">
                <span>Full Name:</span>
                <span className="font-semibold text-[#0F172A]">{createdFreelancerCreds.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#059669] font-medium">
                <span>Email:</span>
                <span className="font-mono font-bold text-[#0F172A]">{createdFreelancerCreds.email}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#059669] font-medium">
                <span>Password:</span>
                <span className="font-mono font-bold text-[#0F172A]">{createdFreelancerCreds.password}</span>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              leftIcon={copiedFreelancerCreds ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              onClick={() => {
                const text = `Reqly Login\nURL: ${window.location.origin}/login\nEmail: ${createdFreelancerCreds.email}\nPassword: ${createdFreelancerCreds.password}`;
                navigator.clipboard.writeText(text);
                setCopiedFreelancerCreds(true);
                setTimeout(() => setCopiedFreelancerCreds(false), 2000);
                toast.success("Credentials copied to clipboard");
              }}
            >
              {copiedFreelancerCreds ? "Copied!" : "Copy credentials"}
            </Button>
          </div>
        )}
      </Modal>

      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        userEmail={email || ""}
      />
    </div>
  );
}
