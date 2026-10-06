"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileText,
  FolderKanban,
  Lightbulb,
  Link as LinkIcon,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ConvertToProjectModal } from "@/components/inbox/ConvertToProjectModal";
import { InboxDiscussionWorkspace } from "@/components/inbox/InboxDiscussionWorkspace";
import { InboxInsightsWorkspace } from "@/components/inbox/InboxInsightsWorkspace";
import { InboxPeopleWorkspace } from "@/components/inbox/InboxPeopleWorkspace";
import { AddCollaboratorModal } from "@/components/inbox/AddCollaboratorModal";
import { toast } from "@/lib/toast";
import { Textarea } from "@/components/ui/Textarea";
import type {
  InboxItemPriority,
  InboxItemStatus,
  InboxItemType,
  ProjectInboxItem,
  ProjectInboxLink,
  ProjectInboxMember,
} from "@/lib/types";

type InboxTab = "discussion" | "insights" | "details" | "people";

export default function InboxItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [item, setItem] = useState<ProjectInboxItem | null>(null);
  const [links, setLinks] = useState<ProjectInboxLink[]>([]);
  const [members, setMembers] = useState<ProjectInboxMember[]>([]);
  const [insightsCount, setInsightsCount] = useState(0);
  const [activeTab, setActiveTab] = useState<InboxTab>("discussion");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editable fields in Details tab
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<InboxItemType>("idea");
  const [status, setStatus] = useState<InboxItemStatus>("inbox");
  const [priority, setPriority] = useState<InboxItemPriority>("medium");
  const [notes, setNotes] = useState("");
  const [researchNotes, setResearchNotes] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Link addition
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);

  // Conversion & Delete modals
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingIdea, setDeletingIdea] = useState(false);

  // Quick add people modal from header
  const [addPeopleOpen, setAddPeopleOpen] = useState(false);

  const loadItem = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/inbox/${id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load idea workspace.");
      }
      setItem(data.item);
      setLinks(data.item.links || []);
      setMembers(data.item.members || []);
      setInsightsCount(data.item.insights_count || 0);

      setTitle(data.item.title || "");
      setDescription(data.item.description || "");
      setType(data.item.type || "idea");
      setStatus(data.item.status || "inbox");
      setPriority(data.item.priority || "medium");
      setNotes(data.item.notes || "");
      setResearchNotes(data.item.research_notes || "");
    } catch (err: any) {
      setError(err.message || "Failed to load idea workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItem();
  }, [id]);

  const isOwner = Boolean(
    item?.currentUserRole === "owner" || (item as any)?.isOwner
  );
  const canManageCollaborators = Boolean(
    isOwner || (item as any)?.canManageCollaborators
  );

  const handleSaveDetails = async () => {
    if (!title.trim()) {
      toast.warning("Title cannot be empty");
      return;
    }
    setSavingDetails(true);
    setSavedSuccess(false);
    try {
      const res = await fetch(`/api/inbox/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          type,
          status,
          priority,
          notes,
          research_notes: researchNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save changes.");
      }
      setItem((prev) => (prev ? { ...prev, ...data.item } : data.item));
      setSavedSuccess(true);
      toast.success("Idea updated");
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      toast.error("Unable to save changes", { description: err.message || "Please check your input and try again." });
    } finally {
      setSavingDetails(false);
    }
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;

    setAddingLink(true);
    try {
      const res = await fetch(`/api/inbox/${id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newLinkTitle.trim(),
          url: newLinkUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add link.");

      setLinks((prev) => [...prev, data.link]);
      setNewLinkTitle("");
      setNewLinkUrl("");
      setShowAddLink(false);
      toast.success("Link added");
    } catch (err: any) {
      toast.error("Unable to add link", { description: err.message || "Please verify the link URL." });
    } finally {
      setAddingLink(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      const res = await fetch(`/api/inbox/${id}/links/${linkId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== linkId));
        toast.success("Link removed");
      } else {
        toast.error("Unable to remove link");
      }
    } catch {
      toast.error("Unable to remove link");
    }
  };

  const handleConfirmDeleteItem = async () => {
    setDeletingIdea(true);
    try {
      const res = await fetch(`/api/inbox/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.flash("success", "Idea deleted");
        router.push("/inbox");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error("Unable to delete idea", { description: data?.error || "Failed to delete idea." });
      }
    } catch {
      toast.error("Unable to delete idea", { description: "An unexpected network error occurred." });
    } finally {
      setDeletingIdea(false);
      setConfirmDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-xs font-medium text-slate-500">
          <Loader2 size={16} className="animate-spin text-[#4F46E5]" />
          <span>Loading idea workspace...</span>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center">
        <EmptyState
          icon={Compass}
          title="Idea not found"
          description={error || "This inbox item may have been removed or you may not have access."}
          action={
            <Link href="/inbox">
              <Button variant="secondary" size="md" leftIcon={<ArrowLeft size={14} />}>
                Back to Project Inbox
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      {/* Top Header */}
      <DashboardHeader
        eyebrow="PROJECT INBOX"
        title={item.title}
        backHref="/inbox"
        backLabel="Project Inbox"
        badge={
          <div className="flex items-center gap-1.5">
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200/80 capitalize">
              {item.type.replace("_", " ")}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200 capitalize">
              {item.status}
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {!item.converted_project_id ? (
              isOwner && (
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<FolderKanban size={14} />}
                  onClick={() => setConvertModalOpen(true)}
                >
                  Convert to Project
                </Button>
              )
            ) : (
              <Link href={`/project/${item.converted_project_id}`}>
                <Button variant="secondary" size="md" rightIcon={<ArrowRight size={14} />}>
                  Open Project
                </Button>
              </Link>
            )}

            {activeTab === "details" && isOwner && (
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Save size={14} />}
                isLoading={savingDetails}
                onClick={handleSaveDetails}
              >
                {savedSuccess ? "Saved ✓" : "Save changes"}
              </Button>
            )}
          </div>
        }
      />

      <main className="mx-auto max-w-[1720px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 space-y-6">
        {/* Item Header Banner: Title, Description & People Stack */}
        <div className="rounded-2xl border border-[#E2E6EF] bg-white p-5 sm:p-6 shadow-card space-y-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111827]">
              {item.title}
            </h1>
            {item.description ? (
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
                {item.description}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">No description provided yet.</p>
            )}
          </div>

          {/* People Row */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
                People:
              </span>

              {/* People Avatar Stack */}
              {members.slice(0, 6).map((m) => (
                <div
                  key={m.id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
                    m.role === "owner"
                      ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                  title={`${m.name || "Member"} (${m.role})`}
                >
                  <span className="font-semibold">{m.name || "Member"}</span>
                  {m.role === "owner" && (
                    <span className="text-[10px] uppercase font-bold text-indigo-600">(Owner)</span>
                  )}
                </div>
              ))}

              {members.length > 6 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("people")}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  +{members.length - 6} more
                </button>
              )}

              {canManageCollaborators && (
                <button
                  type="button"
                  onClick={() => setAddPeopleOpen(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#4F46E5] hover:bg-indigo-50/50 hover:border-indigo-300 transition"
                >
                  <Plus size={12} />
                  <span>Add</span>
                </button>
              )}
            </div>

            <span className="text-xs text-slate-400">
              Updated {new Date(item.updated_at).toLocaleDateString()}
            </span>
          </div>

          {/* Tab Navigation */}
          <div className="pt-2 flex items-center gap-2 border-t border-slate-100 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab("discussion")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition ${
                activeTab === "discussion"
                  ? "bg-[#111827] text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <MessageSquare size={15} />
              <span>Discussion</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("insights")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition ${
                activeTab === "insights"
                  ? "bg-[#111827] text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Lightbulb size={15} />
              <span>Insights</span>
              {insightsCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    activeTab === "insights"
                      ? "bg-[#B8944E] text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {insightsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition ${
                activeTab === "details"
                  ? "bg-[#111827] text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <FileText size={15} />
              <span>Details</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("people")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition ${
                activeTab === "people"
                  ? "bg-[#111827] text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Users size={15} />
              <span>People</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  activeTab === "people"
                    ? "bg-slate-700 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {members.length}
              </span>
            </button>
          </div>
        </div>

        {/* Tab 1: Discussion Workspace */}
        {activeTab === "discussion" && (
          <InboxDiscussionWorkspace
            item={item}
            onInsightSaved={() => {
              setInsightsCount((prev) => prev + 1);
            }}
          />
        )}

        {/* Tab 2: Saved Insights Workspace */}
        {activeTab === "insights" && (
          <InboxInsightsWorkspace
            inboxItemId={item.id}
            isOwner={isOwner}
            onCountChange={(cnt) => setInsightsCount(cnt)}
          />
        )}

        {/* Tab 3: Details & Research Workspace */}
        {activeTab === "details" && (
          <div className="space-y-6">
            {/* Overview & Metadata Card */}
            <section className="rounded-2xl border border-[#E2E6EF] bg-white p-5 sm:p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Idea Overview
                </h3>
                <span className="text-[11px] text-slate-400">
                  Created {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    disabled={!isOwner}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#E2E6EF] bg-white px-3.5 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Description & Context
                  </label>
                  <Textarea
                    rows={3}
                    value={description}
                    disabled={!isOwner}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What problem does this solve? Who is it for?"
                    className="w-full rounded-xl border border-[#E2E6EF] bg-white p-3 text-xs sm:text-sm text-[#111827] outline-none transition focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] resize-none leading-relaxed disabled:bg-slate-50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Type
                    </label>
                    <select
                      value={type}
                      disabled={!isOwner}
                      onChange={(e) => setType(e.target.value as InboxItemType)}
                      className="h-9 w-full rounded-xl border border-[#E2E6EF] bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition focus:border-[#4F46E5] cursor-pointer disabled:bg-slate-50"
                    >
                      <option value="idea">Product Idea</option>
                      <option value="upcoming_project">Upcoming Project</option>
                      <option value="research">Research</option>
                      <option value="opportunity">Opportunity</option>
                      <option value="experiment">Experiment</option>
                      <option value="feature">Feature</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Status
                    </label>
                    <select
                      value={status}
                      disabled={!isOwner}
                      onChange={(e) => setStatus(e.target.value as InboxItemStatus)}
                      className="h-9 w-full rounded-xl border border-[#E2E6EF] bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition focus:border-[#4F46E5] cursor-pointer disabled:bg-slate-50"
                    >
                      <option value="inbox">Inbox</option>
                      <option value="exploring">Exploring</option>
                      <option value="researching">Researching</option>
                      <option value="planned">Planned</option>
                      <option value="ready">Ready</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Priority
                    </label>
                    <select
                      value={priority}
                      disabled={!isOwner}
                      onChange={(e) => setPriority(e.target.value as InboxItemPriority)}
                      className="h-9 w-full rounded-xl border border-[#E2E6EF] bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition focus:border-[#4F46E5] cursor-pointer disabled:bg-slate-50"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* Notes Card */}
            <section className="rounded-2xl border border-[#E2E6EF] bg-white p-5 sm:p-6 shadow-card space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                    Notes & Assumptions
                  </h3>
                  <p className="text-xs text-slate-500">
                    Rough architecture thoughts, target audiences, or pricing models.
                  </p>
                </div>
              </div>

              <Textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Write your notes here..."
                className="w-full rounded-xl border border-[#E2E6EF] bg-slate-50/40 p-3 text-xs sm:text-sm text-[#111827] outline-none transition focus:bg-white focus:border-[#4F46E5] leading-relaxed font-mono"
              />
            </section>

            {/* Research Notes Card */}
            <section className="rounded-2xl border border-[#E2E6EF] bg-white p-5 sm:p-6 shadow-card space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                    Research Questions
                  </h3>
                  <p className="text-xs text-slate-500">
                    Key assumptions to test or technical feasibility checks.
                  </p>
                </div>
              </div>

              <Textarea
                rows={4}
                value={researchNotes}
                onChange={(e) => setResearchNotes(e.target.value)}
                placeholder="Key questions to validate..."
                className="w-full rounded-xl border border-[#E2E6EF] bg-slate-50/40 p-3 text-xs sm:text-sm text-[#111827] outline-none transition focus:bg-white focus:border-[#4F46E5] leading-relaxed"
              />
            </section>

            {/* Reference Links Card */}
            <section className="rounded-2xl border border-[#E2E6EF] bg-white p-5 sm:p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                    References & Links
                  </h3>
                  <p className="text-xs text-slate-500">
                    Competitors, APIs, and inspiring articles.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus size={13} />}
                  onClick={() => setShowAddLink(true)}
                >
                  Add link
                </Button>
              </div>

              {showAddLink && (
                <form
                  onSubmit={handleAddLink}
                  className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-3 animate-in fade-in duration-150"
                >
                  <p className="text-xs font-semibold text-indigo-900">Add Reference Link</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Title"
                      value={newLinkTitle}
                      onChange={(e) => setNewLinkTitle(e.target.value)}
                      className="h-8 rounded-lg border border-[#E2E6EF] bg-white px-2.5 text-xs text-[#111827] outline-none focus:border-[#4F46E5]"
                    />
                    <input
                      type="text"
                      placeholder="URL"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      className="h-8 rounded-lg border border-[#E2E6EF] bg-white px-2.5 text-xs text-[#111827] outline-none focus:border-[#4F46E5]"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowAddLink(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={addingLink}
                      disabled={!newLinkTitle.trim() || !newLinkUrl.trim()}
                    >
                      Save Link
                    </Button>
                  </div>
                </form>
              )}

              {links.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No reference links saved yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-3">
                        <LinkIcon size={14} className="text-slate-400 shrink-0" />
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-[#4F46E5] hover:underline truncate"
                        >
                          {link.title}
                        </a>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <ExternalLink size={13} />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteLink(link.id)}
                          className="text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Danger Zone (Owner Only) */}
            {isOwner && (
              <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                <span>Delete idea permanently</span>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="text-rose-600 hover:underline font-medium"
                >
                  Delete Idea
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: People Workspace */}
        {activeTab === "people" && (
          <InboxPeopleWorkspace
            inboxItemId={item.id}
            members={members}
            canManageCollaborators={canManageCollaborators}
            onRefresh={loadItem}
          />
        )}
      </main>

      {/* Convert Modal */}
      <ConvertToProjectModal
        open={convertModalOpen}
        item={item}
        onClose={() => setConvertModalOpen(false)}
        onConverted={() => loadItem()}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Delete Idea"
        description={`Permanently delete idea "${item?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deletingIdea}
        onConfirm={handleConfirmDeleteItem}
        onClose={() => setConfirmDeleteOpen(false)}
      />

      {/* Add People Modal from Header */}
      <AddCollaboratorModal
        isOpen={addPeopleOpen}
        onClose={() => setAddPeopleOpen(false)}
        inboxItemId={item.id}
        onAdded={loadItem}
      />
    </div>
  );
}
