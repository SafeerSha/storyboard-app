"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  ExternalLink,
  FolderKanban,
  Layers,
  Link2,
  Loader2,
  Mail,
  MoreHorizontal,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Video,
  XCircle,
  CheckCircle2,
  Copy,
  Edit2,
  FileText,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/lib/toast";
import {
  MEETING_PLATFORM_CONFIG,
  MEETING_STATUS_CONFIG,
  MEETING_TYPE_CONFIG,
  MeetingPlatform,
  MeetingStatus,
  MeetingType,
  ProjectMeeting,
} from "@/lib/types/meeting";
import {
  copyTextToClipboard,
  formatMeetingDate,
  formatMeetingInvitationPlainText,
  formatMeetingTimeRange,
  getMeetingDurationText,
} from "./meeting-utils";
import { MeetingScheduleModal } from "./MeetingScheduleModal";
import { MeetingDetailsModal } from "./MeetingDetailsModal";
import { ShareMeetingModal } from "./ShareMeetingModal";
import { CancelMeetingModal } from "./CancelMeetingModal";
import { Modal } from "@/components/ui/Modal";

export interface ProjectOption {
  id: string;
  name: string;
  description?: string | null;
}

export interface AdminMeetingItem extends ProjectMeeting {
  projectName?: string;
}

interface AdminMeetingsWorkspaceProps {
  initialProjects: ProjectOption[];
  initialMeetings?: AdminMeetingItem[];
}

export function AdminMeetingsWorkspace({
  initialProjects,
  initialMeetings = [],
}: AdminMeetingsWorkspaceProps) {
  const [projects] = useState<ProjectOption[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [meetings, setMeetings] = useState<AdminMeetingItem[]>(initialMeetings);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Sub-tabs & Filters
  const [activeSubTab, setActiveSubTab] = useState<"upcoming" | "past" | "cancelled" | "all">("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Modals state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [projectPickerModalOpen, setProjectPickerModalOpen] = useState(false);
  const [activeProjectForSchedule, setActiveProjectForSchedule] = useState<ProjectOption | null>(
    projects.length > 0 ? projects[0] : null
  );

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<AdminMeetingItem | null>(null);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [meetingToShare, setMeetingToShare] = useState<AdminMeetingItem | null>(null);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [meetingToCancel, setMeetingToCancel] = useState<AdminMeetingItem | null>(null);

  const [meetingToEdit, setMeetingToEdit] = useState<AdminMeetingItem | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // Team members cache per project for sharing modal
  const [projectTeamMembersMap, setProjectTeamMembersMap] = useState<Record<string, any[]>>({});

  // Fetch meetings from API
  const loadMeetings = useCallback(async (showIndicator = false) => {
    if (showIndicator) setRefreshing(true);
    else setLoading(true);

    try {
      const url = new URL("/api/meetings", window.location.origin);
      if (selectedProjectId !== "all") {
        url.searchParams.set("projectId", selectedProjectId);
      }
      if (typeFilter !== "all") {
        url.searchParams.set("type", typeFilter);
      }

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings || []);
      } else {
        toast.error("Failed to load meetings list");
      }
    } catch {
      toast.error("Error communicating with meetings service");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedProjectId, typeFilter]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  // Load team members for sharing
  const loadProjectTeamMembers = useCallback(async (projectId: string) => {
    if (projectTeamMembersMap[projectId]) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/team-members`);
      if (res.ok) {
        const data = await res.json();
        setProjectTeamMembersMap((prev) => ({
          ...prev,
          [projectId]: data.teamMembers || [],
        }));
      }
    } catch {
      // Silently catch
    }
  }, [projectTeamMembersMap]);

  // Handle Mark Completed directly from list
  const handleMarkCompleted = async (m: AdminMeetingItem) => {
    try {
      const res = await fetch(`/api/projects/${m.project_id}/meetings/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Meeting marked as completed");
        setMeetings((prev) =>
          prev.map((item) => (item.id === m.id ? { ...item, ...data.meeting } : item))
        );
      } else {
        toast.error("Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setActiveActionMenuId(null);
    }
  };

  // Filter meetings by sub-tab and search query
  const now = new Date().toISOString();
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchAgenda = m.agenda?.toLowerCase().includes(q);
        const matchProject = m.projectName?.toLowerCase().includes(q);
        const matchPlatform = m.platform.toLowerCase().includes(q);
        if (!matchTitle && !matchAgenda && !matchProject && !matchPlatform) {
          return false;
        }
      }

      // Sub-tab filtering
      if (activeSubTab === "upcoming") {
        return m.status === "scheduled" && m.end_at >= now;
      }
      if (activeSubTab === "past") {
        return m.status === "completed" || (m.status === "scheduled" && m.end_at < now);
      }
      if (activeSubTab === "cancelled") {
        return m.status === "cancelled";
      }
      return true;
    });
  }, [meetings, searchQuery, activeSubTab, now]);

  // Statistics
  const upcomingCount = useMemo(
    () => meetings.filter((m) => m.status === "scheduled" && m.end_at >= now).length,
    [meetings, now]
  );
  const completedCount = useMemo(
    () => meetings.filter((m) => m.status === "completed").length,
    [meetings]
  );
  const cancelledCount = useMemo(
    () => meetings.filter((m) => m.status === "cancelled").length,
    [meetings]
  );
  const uniqueProjectsCount = useMemo(
    () => new Set(meetings.map((m) => m.project_id)).size,
    [meetings]
  );

  // Click on "Schedule Meeting"
  const handleInitiateSchedule = () => {
    if (selectedProjectId !== "all") {
      const found = projects.find((p) => p.id === selectedProjectId);
      if (found) {
        setActiveProjectForSchedule(found);
        setMeetingToEdit(null);
        setScheduleModalOpen(true);
        return;
      }
    }

    if (projects.length === 1) {
      setActiveProjectForSchedule(projects[0]);
      setMeetingToEdit(null);
      setScheduleModalOpen(true);
      return;
    }

    // Prompt user to pick a project
    setProjectPickerModalOpen(true);
  };

  const getPlatformBadgeStyle = (platform: MeetingPlatform) => {
    switch (platform) {
      case "google_meet":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "zoom":
        return "bg-blue-50 text-blue-700 border border-blue-200";
      case "teams":
        return "bg-indigo-50 text-indigo-700 border border-indigo-200";
      case "whatsapp_call":
      default:
        return "bg-green-50 text-green-700 border border-green-200";
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(74,61,100,0.08)] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[rgba(184,148,78,0.12)] text-[#80642F] border border-[rgba(184,148,78,0.20)]">
              <Calendar size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#252331]">
                Meetings & Schedule Center
              </h1>
              <p className="text-xs sm:text-sm text-[#706C7D]">
                Schedule, track, and coordinate review sessions, demos, and calls across all projects.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Button
            variant="outline"
            size="md"
            onClick={() => loadMeetings(true)}
            disabled={refreshing}
            className="text-xs font-semibold"
            leftIcon={<RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleInitiateSchedule}
            className="text-xs font-semibold shadow-xs"
            leftIcon={<Plus size={15} />}
          >
            Schedule Meeting
          </Button>
        </div>
      </div>

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white p-4 sm:p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9994A5]">
              Upcoming Calls
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#252331]">{upcomingCount}</p>
          <p className="text-[11px] text-emerald-700 font-medium">Scheduled & Active</p>
        </div>

        <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white p-4 sm:p-5 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9994A5]">
            Completed
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#252331]">{completedCount}</p>
          <p className="text-[11px] text-zinc-500 font-medium">Recorded in archive</p>
        </div>

        <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white p-4 sm:p-5 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9994A5]">
            Cancelled
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#252331]">{cancelledCount}</p>
          <p className="text-[11px] text-rose-600 font-medium">Preserved history</p>
        </div>

        <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white p-4 sm:p-5 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9994A5]">
            Projects with Calls
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#252331]">{uniqueProjectsCount}</p>
          <p className="text-[11px] text-[#80642F] font-medium">Across active clients</p>
        </div>
      </div>

      {/* 3. Controls & Filter Bar */}
      <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white p-3.5 sm:p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        {/* Left: Project Selector & Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Project Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-[#FAF9FC] border border-[rgba(74,61,100,0.12)] rounded-xl px-2.5 py-1 text-xs">
            <FolderKanban size={13} className="text-[#9994A5] shrink-0" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#252331] focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">All Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sub-Tabs: Upcoming, Past, Cancelled, All */}
          <div className="flex items-center gap-1 p-1 bg-[#F4F2F8] rounded-xl overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveSubTab("upcoming")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                activeSubTab === "upcoming"
                  ? "bg-white text-[#252331] shadow-2xs"
                  : "text-[#706C7D] hover:text-[#252331]"
              }`}
            >
              Upcoming ({upcomingCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("past")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                activeSubTab === "past"
                  ? "bg-white text-[#252331] shadow-2xs"
                  : "text-[#706C7D] hover:text-[#252331]"
              }`}
            >
              Past ({completedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("cancelled")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                activeSubTab === "cancelled"
                  ? "bg-white text-[#252331] shadow-2xs"
                  : "text-[#706C7D] hover:text-[#252331]"
              }`}
            >
              Cancelled ({cancelledCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                activeSubTab === "all"
                  ? "bg-white text-[#252331] shadow-2xs"
                  : "text-[#706C7D] hover:text-[#252331]"
              }`}
            >
              All ({meetings.length})
            </button>
          </div>
        </div>

        {/* Right: Search & Type Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9994A5]" />
            <input
              type="text"
              placeholder="Search by title, agenda, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] pl-8 pr-3 py-1.5 text-xs text-[#252331] placeholder:text-[#9994A5] focus:outline-none focus:ring-1 focus:ring-[#B8944E]"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] px-2.5 py-1.5 text-xs font-semibold text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E] cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="demo">Demo</option>
            <option value="planning">Planning</option>
            <option value="discussion">Discussion</option>
          </select>
        </div>
      </div>

      {/* 4. Meetings Cards Grid */}
      {loading ? (
        <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white p-12 text-center space-y-3">
          <Loader2 size={24} className="animate-spin text-[#B8944E] mx-auto" />
          <p className="text-xs text-[#706C7D]">Loading meetings across projects...</p>
        </div>
      ) : filteredMeetings.length === 0 ? (
        <EmptyState
          title={
            activeSubTab === "upcoming"
              ? "No Upcoming Meetings Scheduled"
              : activeSubTab === "past"
              ? "No Past Meetings Logged"
              : activeSubTab === "cancelled"
              ? "No Cancelled Meetings"
              : "No Meetings Found"
          }
          description={
            searchQuery
              ? "No meetings match your search query or filter."
              : "Schedule a client demo, sprint review, or team planning call to get started."
          }
          icon={Calendar}
          action={
            <Button
              variant="primary"
              size="md"
              onClick={handleInitiateSchedule}
              leftIcon={<Plus size={14} />}
            >
              Schedule Meeting
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMeetings.map((m) => {
            const platformConfig = MEETING_PLATFORM_CONFIG[m.platform];
            const typeConfig = MEETING_TYPE_CONFIG[m.meeting_type];
            const statusConfig = MEETING_STATUS_CONFIG[m.status];
            const dateStr = formatMeetingDate(m.start_at);
            const timeRangeStr = formatMeetingTimeRange(m.start_at, m.end_at);
            const durationStr = getMeetingDurationText(m.start_at, m.end_at);
            const platformBadgeClass = getPlatformBadgeStyle(m.platform);

            return (
              <div
                key={m.id}
                className="group relative rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white p-4 shadow-2xs hover:shadow-md hover:border-[#B8944E]/30 transition-all flex flex-col justify-between"
              >
                {/* Header: Project Badge + Status & Menu */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <Link
                      href={`/project/${m.project_id}?tab=meetings`}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[rgba(184,148,78,0.08)] text-[11px] font-bold text-[#80642F] hover:bg-[rgba(184,148,78,0.16)] transition truncate max-w-[200px]"
                      title={`Go to ${m.projectName || "Project"}`}
                    >
                      <FolderKanban size={11} className="shrink-0" />
                      <span className="truncate">{m.projectName || "Project"}</span>
                    </Link>

                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${statusConfig.badgeClass}`}>
                        {statusConfig.label}
                      </span>

                      {/* Action Menu Popover */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveActionMenuId((prev) => (prev === m.id ? null : m.id))
                          }
                          aria-label="Meeting actions"
                          className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
                        >
                          <MoreHorizontal size={14} />
                        </button>

                        {activeActionMenuId === m.id && (
                          <div
                            className="absolute right-0 top-8 z-30 w-44 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl text-xs space-y-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMeeting(m);
                                setDetailsModalOpen(true);
                                setActiveActionMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 text-zinc-700 font-medium text-left cursor-pointer"
                            >
                              <FileText size={13} className="text-zinc-400" />
                              View Details
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMeetingToShare(m);
                                loadProjectTeamMembers(m.project_id);
                                setShareModalOpen(true);
                                setActiveActionMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 text-zinc-700 font-medium text-left cursor-pointer"
                            >
                              <Share2 size={13} className="text-[#80642F]" />
                              Share Invitation
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                copyTextToClipboard(
                                  formatMeetingInvitationPlainText(m, m.projectName || "Project")
                                );
                                setActiveActionMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 text-zinc-700 font-medium text-left cursor-pointer"
                            >
                              <Copy size={13} className="text-zinc-400" />
                              Copy Plain Text
                            </button>

                            {m.status !== "completed" && m.status !== "cancelled" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const proj = projects.find((p) => p.id === m.project_id);
                                    if (proj) setActiveProjectForSchedule(proj);
                                    setMeetingToEdit(m);
                                    setScheduleModalOpen(true);
                                    setActiveActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 text-zinc-700 font-medium text-left cursor-pointer"
                                >
                                  <Edit2 size={13} className="text-zinc-400" />
                                  Edit / Reschedule
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleMarkCompleted(m)}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 text-emerald-700 font-medium text-left cursor-pointer"
                                >
                                  <CheckCircle2 size={13} className="text-emerald-500" />
                                  Mark Completed
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setMeetingToCancel(m);
                                    setCancelModalOpen(true);
                                    setActiveActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 font-medium text-left cursor-pointer"
                                >
                                  <XCircle size={13} className="text-rose-500" />
                                  Cancel Meeting
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Title & Platform Pill */}
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${platformBadgeClass}`}>
                        {platformConfig?.label || m.platform}
                      </span>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                        {typeConfig?.label || m.meeting_type}
                      </span>
                    </div>

                    <h3
                      onClick={() => {
                        setSelectedMeeting(m);
                        setDetailsModalOpen(true);
                      }}
                      className="text-sm font-bold text-[#252331] group-hover:text-[#80642F] transition-colors cursor-pointer line-clamp-1"
                      title={m.title}
                    >
                      {m.title}
                    </h3>
                  </div>

                  {/* Date, Time & Duration */}
                  <div className="rounded-xl bg-[#FAF9FC] p-2.5 border border-[rgba(74,61,100,0.06)] space-y-1 text-xs mb-3">
                    <div className="flex items-center justify-between text-zinc-700 font-semibold">
                      <span>{dateStr}</span>
                      <span className="text-[11px] font-mono text-[#80642F]">{durationStr}</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono">
                      {timeRangeStr}
                    </div>
                  </div>

                  {/* Agenda Snippet */}
                  {m.agenda && (
                    <p className="text-xs text-zinc-500 line-clamp-2 mb-3">
                      {m.agenda}
                    </p>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-[rgba(74,61,100,0.06)] flex items-center justify-between gap-2 mt-auto">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMeetingToShare(m);
                        loadProjectTeamMembers(m.project_id);
                        setShareModalOpen(true);
                      }}
                      className="text-xs px-2.5 py-1 text-zinc-700"
                      leftIcon={<Share2 size={12} />}
                    >
                      Share
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedMeeting(m);
                        setDetailsModalOpen(true);
                      }}
                      className="text-xs px-2 py-1 text-zinc-500 hover:text-zinc-800"
                    >
                      Details
                    </Button>
                  </div>

                  {m.meeting_url && m.status !== "cancelled" ? (
                    <a
                      href={m.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#B8944E] hover:bg-[#A3803C] text-white text-xs font-bold shadow-2xs transition"
                    >
                      <span>Join</span>
                      <ExternalLink size={11} />
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Project Picker Modal (when scheduling from All Projects) */}
      <Modal
        isOpen={projectPickerModalOpen}
        onClose={() => setProjectPickerModalOpen(false)}
        title="Select Project for Meeting"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#706C7D]">
            Choose which project this call or review session belongs to:
          </p>

          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActiveProjectForSchedule(p);
                  setProjectPickerModalOpen(false);
                  setMeetingToEdit(null);
                  setScheduleModalOpen(true);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-200 hover:border-[#B8944E] hover:bg-[rgba(184,148,78,0.04)] text-left transition group cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-900 group-hover:text-[#80642F] truncate">
                    {p.name}
                  </p>
                  {p.description && (
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                      {p.description}
                    </p>
                  )}
                </div>
                <span className="text-xs font-semibold text-[#80642F] opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                  Select →
                </span>
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-zinc-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProjectPickerModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* 6. Schedule Meeting Modal */}
      {activeProjectForSchedule && (
        <MeetingScheduleModal
          isOpen={scheduleModalOpen}
          onClose={() => {
            setScheduleModalOpen(false);
            setMeetingToEdit(null);
          }}
          projectId={activeProjectForSchedule.id}
          projectName={activeProjectForSchedule.name}
          meetingToEdit={meetingToEdit}
          onSuccess={() => {
            setScheduleModalOpen(false);
            setMeetingToEdit(null);
            loadMeetings();
          }}
        />
      )}

      {/* 7. Meeting Details Modal */}
      {selectedMeeting && (
        <MeetingDetailsModal
          isOpen={detailsModalOpen}
          onClose={() => {
            setDetailsModalOpen(false);
            setSelectedMeeting(null);
          }}
          meeting={selectedMeeting}
          projectName={selectedMeeting?.projectName || "Project"}
          onEdit={(m) => {
            const proj = projects.find((p) => p.id === m.project_id);
            if (proj) setActiveProjectForSchedule(proj);
            setMeetingToEdit(m);
            setDetailsModalOpen(false);
            setScheduleModalOpen(true);
          }}
          onShare={(m) => {
            setMeetingToShare(m);
            loadProjectTeamMembers(m.project_id);
            setDetailsModalOpen(false);
            setShareModalOpen(true);
          }}
          onCancelMeeting={(m) => {
            setMeetingToCancel(m);
            setDetailsModalOpen(false);
            setCancelModalOpen(true);
          }}
          onStatusChange={(updated) => {
            setMeetings((prev) =>
              prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
            );
          }}
        />
      )}

      {/* 8. Share Meeting Modal */}
      {meetingToShare && (
        <ShareMeetingModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setMeetingToShare(null);
          }}
          meeting={meetingToShare}
          projectName={meetingToShare.projectName || "Project"}
          projectTeamMembers={projectTeamMembersMap[meetingToShare.project_id] || []}
          onSuccess={() => {
            loadMeetings();
          }}
        />
      )}

      {/* 9. Cancel Meeting Modal */}
      {meetingToCancel && (
        <CancelMeetingModal
          isOpen={cancelModalOpen}
          onClose={() => {
            setCancelModalOpen(false);
            setMeetingToCancel(null);
          }}
          meeting={meetingToCancel}
          onSuccess={(cancelled) => {
            setCancelModalOpen(false);
            setMeetingToCancel(null);
            setMeetings((prev) =>
              prev.map((item) => (item.id === cancelled.id ? { ...item, ...cancelled } : item))
            );
          }}
        />
      )}
    </div>
  );
}
