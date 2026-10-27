import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Clock,
  Tag,
  ArrowLeft,
  Calendar,
  Image as ImageIcon,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";
import type { ProjectNote } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientNotesPage() {
  const client = await getAuthenticatedClient();
  if (!client) redirect("/login");
  if (!client.is_password_changed) redirect("/client/set-password");

  const db = createAdminClient();

  const [{ data: project }, { data: notesData }, { data: epicsData }] = await Promise.all([
    db
      .from("projects")
      .select("name, description")
      .eq("id", client.project_id)
      .single(),
    db
      .from("project_notes")
      .select("id, project_id, epic_id, title, content, tags, images, status, created_by_name, created_at, updated_at")
      .eq("project_id", client.project_id)
      .eq("is_client_visible", true)
      .neq("status", "archived")
      .order("updated_at", { ascending: false }),
    db
      .from("epics")
      .select("id, name")
      .eq("project_id", client.project_id),
  ]);

  const notes = (notesData || []) as ProjectNote[];
  const epicMap = new Map<string, string>();
  (epicsData || []).forEach((ep) => epicMap.set(ep.id, ep.name));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(15,23,42,0.08)] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#785312] uppercase tracking-wider mb-1">
            <span>{project?.name || "Project"}</span>
            <span>&bull;</span>
            <span>Shared Documents</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
            Meeting &amp; Discussion Notes
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#334155]">
            Review meeting summaries, key requirement decisions, and discussion notes shared by your project team.
          </p>
        </div>

        <Link
          href="/client"
          className="inline-flex items-center gap-1.5 self-start sm:self-center text-xs font-semibold text-[#785312] bg-white border border-[rgba(15,23,42,0.10)] px-3 py-2 rounded-xl hover:bg-[#F8F9FB] transition shadow-2xs"
        >
          <ArrowLeft size={13} />
          <span>Back to Overview</span>
        </Link>
      </div>

      {/* Notes Content */}
      {notes.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(15,23,42,0.08)] bg-white/90 p-8 sm:p-12 text-center shadow-card backdrop-blur-xl space-y-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(204,160,56,0.10)] text-[#785312] mx-auto border border-[rgba(204,160,56,0.18)]">
            <FileText size={24} />
          </div>
          <h3 className="text-base font-bold text-[#0F172A]">No Notes Shared Yet</h3>
          <p className="text-xs sm:text-sm text-[#334155] max-w-md mx-auto">
            When your project lead or developer shares meeting summaries, action items, or discussion notes with you, they will appear right here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-2xl border border-[rgba(15,23,42,0.08)] bg-white/90 p-5 sm:p-6 shadow-card backdrop-blur-xl space-y-4 transition hover:border-[rgba(204,160,56,0.3)]"
            >
              {/* Note Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(15,23,42,0.06)] pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight">
                      {note.title}
                    </h2>
                    {note.epic_id && epicMap.get(note.epic_id) && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(204,160,56,0.12)] px-2 py-0.5 text-[10px] font-semibold text-[#785312] border border-[rgba(204,160,56,0.20)]">
                        <Layers size={10} />
                        Epic: {epicMap.get(note.epic_id)}
                      </span>
                    )}
                    {note.status === "converted" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={11} />
                        Converted into Requirements
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-[#64748B]">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(note.updated_at || note.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {note.created_by_name && (
                    <span>By {note.created_by_name}</span>
                  )}
                </div>
              </div>

              {/* Tags */}
              {note.tags && note.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag size={12} className="text-[#64748B]" />
                  {note.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-[rgba(15,23,42,0.05)] px-2 py-0.5 text-[11px] font-medium text-[#334155]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Content Body */}
              <div className="text-xs sm:text-sm text-[#0F172A] whitespace-pre-wrap leading-relaxed font-sans bg-[#F8F9FB]/60 p-4 rounded-xl border border-[rgba(15,23,42,0.05)]">
                {note.content || "No detailed notes recorded."}
              </div>

              {/* Attached Images */}
              {note.images && note.images.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#785312]">
                    <ImageIcon size={13} />
                    <span>Attached Visuals &amp; Screenshots ({note.images.length})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {note.images.map((img) => (
                      <a
                        key={img.id}
                        href={img.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative block aspect-video rounded-xl overflow-hidden border border-[rgba(15,23,42,0.10)] bg-neutral-100 hover:border-[#CCA038] transition shadow-2xs"
                      >
                        <img
                          src={img.url}
                          alt={img.name || "Attachment"}
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
