"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Edit2,
  ExternalLink,
  Layers,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { GenerateStoriesModal } from "@/components/GenerateStoriesModal";
import { StoryEditor } from "@/components/StoryEditor";
import { StoryCard } from "@/components/StoryCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Story, Epic } from "@/lib/types";

type ProjectWorkspaceProps = {
  projectId: string;
  projectName: string;
  initialStories: Story[];
  initialEpics: Epic[];
};

export function ProjectWorkspace({
  projectId,
  projectName,
  initialStories,
  initialEpics,
}: ProjectWorkspaceProps) {
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [epics, setEpics] = useState<Epic[]>(initialEpics);
  const [feedbackCounts, setFeedbackCounts] = useState<Record<string, number>>({});

  const [generatingEpicId, setGeneratingEpicId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Story | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Epic creation/editing state
  const [epicModalOpen, setEpicModalOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [epicForm, setEpicForm] = useState({ name: "", description: "", status: "active" });
  const [aiCorrecting, setAiCorrecting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [aiError, setAiError] = useState("");

  const [epicFilter, setEpicFilter] = useState<string>("all");

  const loadFeedbackCounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/feedback-counts`);
      if (res.ok) {
        const data = await res.json();
        if (data.counts) setFeedbackCounts(data.counts);
      }
    } catch {
      // Silently catch
    }
  }, [projectId]);

  useEffect(() => {
    setStories(initialStories);
    setEpics(initialEpics);
    loadFeedbackCounts();
  }, [initialStories, initialEpics, loadFeedbackCounts]);

  // Story Actions
  async function updateStory(id: string, updates: Partial<Story>) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/stories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update story");
      setStories((v) => v.map((s) => (s.id === id ? data.story : s)));
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update story");
    } finally {
      setLoading(false);
    }
  }

  async function deleteStory(id: string) {
    if (!confirm("Are you sure you want to delete this story?")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/stories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete story");
      }
      setStories((v) => v.filter((s) => s.id !== id));
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete story");
    } finally {
      setLoading(false);
    }
  }

  // Epic Actions
  async function saveEpic() {
    if (!epicForm.name.trim()) return;
    setLoading(true);
    setError("");
    try {
      if (editingEpic) {
        const res = await fetch(`/api/epics/${editingEpic.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(epicForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save Epic");
        setEpics((v) => v.map((e) => (e.id === editingEpic.id ? data : e)));
      } else {
        const res = await fetch(`/api/epics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...epicForm, projectId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create Epic");
        setEpics((v) => [...v, data]);
      }
      setEpicModalOpen(false);
      setEditingEpic(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save Epic");
    } finally {
      setLoading(false);
    }
  }

  async function deleteEpic(id: string) {
    if (stories.some((s) => s.epic_id === id)) {
      alert("This Epic contains stories. Reassign or remove its stories before deleting the Epic.");
      return;
    }
    if (!confirm("Are you sure you want to delete this Epic?")) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/epics/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete Epic");
      }
      setEpics((v) => v.filter((e) => e.id !== id));
      if (epicFilter === id) setEpicFilter("all");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete Epic");
    } finally {
      setLoading(false);
    }
  }

  function openCreateEpic(name = "") {
    setEpicForm({ name, description: "", status: "active" });
    setEditingEpic(null);
    setAiSuggestions(null);
    setAiError("");
    setEpicModalOpen(true);
  }

  function openEditEpic(epic: Epic) {
    setEditingEpic(epic);
    setEpicForm({
      name: epic.name,
      description: epic.description || "",
      status: epic.status,
    });
    setAiSuggestions(null);
    setAiError("");
    setEpicModalOpen(true);
  }

  async function handleAiCorrectEpicName() {
    if (!epicForm.name.trim()) return;
    setAiCorrecting(true);
    setAiError("");
    try {
      const res = await fetch("/api/epics/correct-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: epicForm.name,
          description: epicForm.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to correct epic name.");

      const suggestions = Array.from(
        new Set([data.correctedName, ...(data.alternatives || [])])
      ).filter(Boolean);
      setAiSuggestions(suggestions);

      setEpicForm((prev) => ({
        ...prev,
        name: data.correctedName,
        description: prev.description
          ? prev.description
          : data.suggestedDescription || prev.description,
      }));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Failed to correct epic name.");
    } finally {
      setAiCorrecting(false);
    }
  }

  function handleCopyClientLink() {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/client/login`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  // Progress metrics
  const totalStoriesCount = stories.length;
  const approvedStoriesCount = stories.filter((s) => s.status === "approved").length;
  const changesRequestedCount = stories.filter((s) => s.status === "changes_requested").length;
  const draftStoriesCount = stories.filter(
    (s) => !s.status || s.status === "draft" || s.status === "review"
  ).length;

  const progressPercent = totalStoriesCount
    ? Math.round((approvedStoriesCount / totalStoriesCount) * 100)
    : 0;

  const filteredEpics =
    epicFilter === "all" ? epics : epics.filter((e) => e.id === epicFilter);

  return (
    <div>
      <DashboardHeader
        eyebrow="PROJECT"
        title={projectName}
        backHref="/projects"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              leftIcon={copiedLink ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              onClick={handleCopyClientLink}
            >
              {copiedLink ? "Link copied" : "Share client portal"}
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus size={14} />}
              onClick={() => openCreateEpic()}
            >
              Add Epic
            </Button>
          </div>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        {/* Project Summary & Progress Bar */}
        <div className="rounded-xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-zinc-100 pb-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                Requirements Hierarchy
              </h2>
              <p className="text-xs text-zinc-500">
                Epics group focused product areas. Stories contain criteria and discussions.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="text-zinc-700">{totalStoriesCount} Stories</span>
              <span className="text-emerald-700 font-semibold">{approvedStoriesCount} Approved</span>
              {changesRequestedCount > 0 && (
                <span className="text-rose-700 font-semibold">
                  {changesRequestedCount} Changes Requested
                </span>
              )}
              <span className="text-zinc-400">{draftStoriesCount} In Review</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5 font-medium">
              <span>Overall Client Sign-off</span>
              <span className="text-slate-900 font-semibold">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-slate-900 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Filter & Workspace Layout */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Filter:
            </span>
            <select
              value={epicFilter}
              onChange={(e) => setEpicFilter(e.target.value)}
              className="h-8 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Epics ({epics.length})</option>
              {epics.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-zinc-400">
            {stories.length} {stories.length === 1 ? "story" : "stories"} total
          </span>
        </div>

        {/* Split View: Epics/Stories on Left, Story Document Inspector on Right */}
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] items-start">
          {/* Left Column: Epics and Stories List */}
          <div className="space-y-6">
            {epics.length === 0 && stories.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No Epics yet"
                description="Create your first Epic to group feature stories into structured product areas."
                action={
                  <Button
                    variant="primary"
                    size="md"
                    leftIcon={<Plus size={14} />}
                    onClick={() => openCreateEpic()}
                  >
                    Create Epic
                  </Button>
                }
              />
            ) : (
              <>
                {filteredEpics.map((epic) => {
                  const epicStories = stories.filter((s) => s.epic_id === epic.id);
                  const approvedCount = epicStories.filter((s) => s.status === "approved").length;
                  const changesCount = epicStories.filter((s) => s.status === "changes_requested").length;
                  const epicProgress = epicStories.length
                    ? Math.round((approvedCount / epicStories.length) * 100)
                    : 0;

                  return (
                    <div
                      key={epic.id}
                      className="rounded-xl border border-zinc-200/80 bg-white shadow-card overflow-hidden"
                    >
                      {/* Epic Header */}
                      <div className="p-4 sm:p-5 border-b border-zinc-100 bg-zinc-50/40">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                                Epic
                              </span>
                              <span className="text-zinc-300">•</span>
                              <span className="text-[11px] font-medium text-zinc-500">
                                {epicStories.length} {epicStories.length === 1 ? "story" : "stories"}
                              </span>
                              <span className="text-zinc-300">•</span>
                              <span className="text-[11px] font-medium text-emerald-700">
                                {approvedCount} approved
                              </span>
                              {changesCount > 0 && (
                                <>
                                  <span className="text-zinc-300">•</span>
                                  <span className="text-[11px] font-medium text-rose-700">
                                    {changesCount} changes
                                  </span>
                                </>
                              )}
                            </div>

                            <h3 className="mt-1 text-base font-semibold text-slate-900 tracking-tight truncate">
                              {epic.name}
                            </h3>

                            {epic.description && (
                              <p className="mt-1 text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                                {epic.description}
                              </p>
                            )}

                            {epicStories.length > 0 && (
                              <div className="mt-3 h-1 w-full bg-zinc-200/70 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-slate-900 rounded-full transition-all duration-300"
                                  style={{ width: `${epicProgress}%` }}
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="secondary"
                              size="sm"
                              leftIcon={<Sparkles size={13} className="text-indigo-600" />}
                              onClick={() => setGeneratingEpicId(epic.id)}
                            >
                              Generate
                            </Button>

                            <DropdownMenu
                              ariaLabel={`Actions for ${epic.name}`}
                              items={[
                                {
                                  label: "Edit Epic",
                                  icon: <Edit2 size={14} />,
                                  onClick: () => openEditEpic(epic),
                                },
                                {
                                  label: "Delete Epic",
                                  icon: <Trash2 size={14} />,
                                  variant: "danger",
                                  onClick: () => deleteEpic(epic.id),
                                },
                              ]}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Stories inside Epic */}
                      <div className="p-3 sm:p-4 space-y-2.5 bg-zinc-50/20">
                        {epicStories.length === 0 ? (
                          <div className="py-6 text-center">
                            <p className="text-xs text-zinc-400">No stories in this Epic yet.</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 text-indigo-600"
                              leftIcon={<Sparkles size={13} />}
                              onClick={() => setGeneratingEpicId(epic.id)}
                            >
                              Generate stories with AI
                            </Button>
                          </div>
                        ) : (
                          epicStories.map((story) => (
                            <StoryCard
                              key={story.id}
                              story={story}
                              isSelected={editing?.id === story.id}
                              openFeedbackCount={feedbackCounts[story.id] || 0}
                              onClick={() => {
                                setEditing(story);
                                if (typeof window !== "undefined" && window.innerWidth < 1024) {
                                  setTimeout(() => {
                                    document
                                      .getElementById("story-editor-section")
                                      ?.scrollIntoView({ behavior: "smooth" });
                                  }, 100);
                                }
                              }}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Uncategorized Stories */}
                {epicFilter === "all" && stories.some((s) => s.epic_id === null) && (
                  <div className="rounded-xl border border-zinc-200/80 bg-white shadow-card overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 bg-zinc-50/40">
                      <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                        Uncategorized Stories
                      </h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Requirements not assigned to an Epic
                      </p>
                    </div>
                    <div className="p-3 sm:p-4 space-y-2.5 bg-zinc-50/20">
                      {stories
                        .filter((s) => s.epic_id === null)
                        .map((story) => (
                          <StoryCard
                            key={story.id}
                            story={story}
                            isSelected={editing?.id === story.id}
                            openFeedbackCount={feedbackCounts[story.id] || 0}
                            onClick={() => setEditing(story)}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Column: Story Document Inspector / Editor */}
          <div
            id="story-editor-section"
            className="lg:sticky lg:top-20 lg:self-start z-10"
          >
            {editing ? (
              <StoryEditor
                story={editing}
                epics={epics}
                onCancel={() => setEditing(null)}
                onFeedbackChange={loadFeedbackCounts}
                onSave={async (updated) => {
                  await updateStory(editing.id, {
                    title: updated.title,
                    description: updated.description,
                    acceptance_criteria: updated.acceptance_criteria,
                    assumptions: updated.assumptions,
                    clarifications: updated.clarifications,
                    raw_requirement: updated.raw_requirement,
                    epic_id: updated.epic_id,
                  });
                }}
                onCreateEpic={openCreateEpic}
                onDelete={() => deleteStory(editing.id)}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200/90 bg-white/70 p-8 sm:p-12 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-zinc-100 text-zinc-400 mb-3">
                  <Layers size={18} />
                </div>
                <h4 className="text-sm font-semibold text-zinc-900">
                  Select a feature story
                </h4>
                <p className="mt-1 text-xs text-zinc-500 max-w-xs mx-auto">
                  Click any story on the left to review criteria, inspect assumptions, and participate in discussion threads.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Epic Modal (Create / Edit) */}
      <Modal
        isOpen={epicModalOpen}
        onClose={() => setEpicModalOpen(false)}
        title={editingEpic ? "Edit Epic" : "Create Epic"}
        description="Epics represent major product areas or feature themes."
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              type="button"
              onClick={() => setEpicModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              form="epic-modal-form"
              isLoading={loading}
              disabled={!epicForm.name.trim()}
            >
              {editingEpic ? "Save changes" : "Create Epic"}
            </Button>
          </>
        }
      >
        <form
          id="epic-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            saveEpic();
          }}
          className="space-y-4"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Epic Name <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                disabled={aiCorrecting || !epicForm.name.trim()}
                onClick={handleAiCorrectEpicName}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40 transition"
              >
                <Sparkles size={12} />
                <span>{aiCorrecting ? "Enhancing..." : "Auto-format name"}</span>
              </button>
            </div>
            <input
              type="text"
              required
              autoFocus
              value={epicForm.name}
              onChange={(e) =>
                setEpicForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g. User Authentication & Security"
              className="h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />

            {aiSuggestions && aiSuggestions.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] text-zinc-400">Suggestions:</span>
                {aiSuggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() =>
                      setEpicForm((prev) => ({ ...prev, name: sug }))
                    }
                    className="text-[11px] rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700 hover:bg-indigo-100 transition"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
            {aiError && <p className="text-xs text-rose-600 mt-1">{aiError}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={epicForm.description}
              onChange={(e) =>
                setEpicForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Describe the scope and purpose of this Epic..."
              className="w-full rounded-xl border border-zinc-200 p-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>
        </form>
      </Modal>

      {/* AI Generate Stories Modal */}
      {generatingEpicId && (
        <GenerateStoriesModal
          projectId={projectId}
          epicId={generatingEpicId}
          onClose={() => setGeneratingEpicId(null)}
          onStoriesGenerated={(newStories) => {
            setStories((prev) => [...newStories, ...prev]);
            setGeneratingEpicId(null);
            if (newStories[0]) {
              setEditing(newStories[0]);
            }
          }}
        />
      )}
    </div>
  );
}
