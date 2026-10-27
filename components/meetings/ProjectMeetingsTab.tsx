"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  Clock,
  ExternalLink,
  Filter,
  Layers,
  Link2,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  PhoneCall,
  Plus,
  Search,
  Share2,
  Video,
  XCircle,
  CheckCircle2,
  Copy,
  Edit2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/SearchableSelect";
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

interface ProjectMeetingsTabProps {
  projectId: string;
  projectName: string;
  projectTeamMembers?: Array<{ id: string; name: string; username?: string; email?: string }>;
  clientEmail?: string | null;
}

export function ProjectMeetingsTab({
  projectId,
  projectName,
  projectTeamMembers = [],
  clientEmail,
}: ProjectMeetingsTabProps) {
  const [meetings, setMeetings] = useState<ProjectMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Tabs
  const [activeSubTab, setActiveSubTab] = useState<"upcoming" | "past" | "cancelled" | "all">("upcoming");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [meetingToEdit, setMeetingToEdit] = useState<ProjectMeeting | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<ProjectMeeting | null>(null);
  const [shareTarget, setShareTarget] = useState<ProjectMeeting | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ProjectMeeting | null>(null);

  // Options for meeting type filter
  const meetingTypeOptions: SearchableSelectOption[] = useMemo(
    () => [
      {
        value: "all",
        label: "All Types",
        icon: <Layers size={13} className="text-[#64748B]" />,
      },
      {
        value: "demo",
        label: "Demo",
        icon: <span className="h-2 w-2 rounded-full bg-purple-500 shrink-0" />,
      },
      {
        value: "planning",
        label: "Planning",
        icon: <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />,
      },
      {
        value: "discussion",
        label: "Discussion",
        icon: <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />,
      },
    ],
    []
  );

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/projects/${projectId}/meetings`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load meetings");
      setMeetings(data.meetings || []);
    } catch (err: any) {
      setError(err.message || "Failed to load project meetings");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Current time for splitting upcoming vs past
  const nowTime = new Date().getTime();

  // Metric counts
  const upcomingMeetings = useMemo(
    () =>
      meetings
        .filter((m) => m.status === "scheduled" && new Date(m.end_at).getTime() >= nowTime)
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [meetings, nowTime]
  );

  const pastMeetings = useMemo(
    () =>
      meetings
        .filter((m) => m.status === "completed" || (m.status === "scheduled" && new Date(m.end_at).getTime() < nowTime))
        .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()),
    [meetings, nowTime]
  );

  const cancelledMeetings = useMemo(
    () =>
      meetings
        .filter((m) => m.status === "cancelled")
        .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()),
    [meetings]
  );

  // Filtered List based on activeSubTab, typeFilter, searchQuery
  const displayedMeetings = useMemo(() => {
    let list: ProjectMeeting[] = [];
    if (activeSubTab === "upcoming") list = upcomingMeetings;
    else if (activeSubTab === "past") list = pastMeetings;
    else if (activeSubTab === "cancelled") list = cancelledMeetings;
    else list = [...meetings].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    if (typeFilter !== "all") {
      list = list.filter((m) => m.meeting_type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.agenda.toLowerCase().includes(q) ||
          m.created_by_name.toLowerCase().includes(q)
      );
    }

    return list;
  }, [activeSubTab, upcomingMeetings, pastMeetings, cancelledMeetings, meetings, typeFilter, searchQuery]);

  const handleQuickCopy = async (m: ProjectMeeting, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = formatMeetingInvitationPlainText(m, projectName);
    const success = await copyTextToClipboard(text);
    if (success) {
      toast.success("Invitation copied!");
      fetch(`/api/projects/${projectId}/meetings/${m.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "clipboard" }),
      }).catch(() => {});
    }
  };

  const handleMeetingSaved = (saved: ProjectMeeting) => {
    setMeetings((prev) => {
      const exists = prev.some((m) => m.id === saved.id);
      if (exists) {
        return prev.map((m) => (m.id === saved.id ? saved : m));
      }
      return [saved, ...prev];
    });
    if (selectedMeeting?.id === saved.id) {
      setSelectedMeeting(saved);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-[rgba(15,23,42,0.10)] bg-white p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Upcoming
          </span>
          <p className="text-2xl font-bold text-[#0F172A]">{upcomingMeetings.length}</p>
          <p className="text-[11px] text-emerald-700 font-medium">Nearest date scheduled</p>
        </div>

        <div className="rounded-2xl border border-[rgba(15,23,42,0.10)] bg-white p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Completed
          </span>
          <p className="text-2xl font-bold text-[#0F172A]">
            {meetings.filter((m) => m.status === "completed").length}
          </p>
          <p className="text-[11px] text-[#334155]">Past discussions</p>
        </div>

        <div className="rounded-2xl border border-[rgba(15,23,42,0.10)] bg-white p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Cancelled
          </span>
          <p className="text-2xl font-bold text-[#0F172A]">{cancelledMeetings.length}</p>
          <p className="text-[11px] text-rose-600">Preserved in history</p>
        </div>

        <div className="rounded-2xl border border-[rgba(15,23,42,0.10)] bg-white p-4 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Total Meetings
          </span>
          <p className="text-2xl font-bold text-[#0F172A]">{meetings.length}</p>
          <p className="text-[11px] text-[#785312]">All time logged</p>
        </div>
      </div>

      {/* 2. Controls & Actions Bar */}
      <div className="rounded-2xl border border-[rgba(15,23,42,0.10)] bg-white p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        {/* Sub-Tabs (Upcoming, Past, Cancelled, All) */}
        <div className="flex items-center gap-1.5 p-1 bg-[#f4f2f8] rounded-xl overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab("upcoming")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === "upcoming"
                ? "bg-white text-[#0F172A] shadow-2xs"
                : "text-[#334155] hover:text-[#0F172A]"
            }`}
          >
            Upcoming ({upcomingMeetings.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("past")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === "past"
                ? "bg-white text-[#0F172A] shadow-2xs"
                : "text-[#334155] hover:text-[#0F172A]"
            }`}
          >
            Past ({pastMeetings.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("cancelled")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === "cancelled"
                ? "bg-white text-[#0F172A] shadow-2xs"
                : "text-[#334155] hover:text-[#0F172A]"
            }`}
          >
            Cancelled ({cancelledMeetings.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === "all"
                ? "bg-white text-[#0F172A] shadow-2xs"
                : "text-[#334155] hover:text-[#0F172A]"
            }`}
          >
            All ({meetings.length})
          </button>
        </div>

        {/* Search, Type Filter & Schedule Action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative w-full sm:w-56">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[rgba(15,23,42,0.12)] bg-[#F8F9FB] pl-8 pr-3 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#CCA038]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Type Filter */}
            <SearchableSelect
              options={meetingTypeOptions}
              value={typeFilter}
              onChange={setTypeFilter}
              searchable={false}
              menuWidthClass="w-44 sm:w-48"
              ariaLabel="Filter meetings by type"
            />

            {/* Schedule Meeting Primary Action */}
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setMeetingToEdit(null);
                setScheduleModalOpen(true);
              }}
              className="flex-1 sm:flex-initial whitespace-nowrap shadow-xs font-semibold"
              leftIcon={<Plus size={14} />}
            >
              <span className="sm:hidden">Schedule</span>
              <span className="hidden sm:inline">Schedule Meeting</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Meetings Content / List */}
      {loading ? (
        <div className="rounded-2xl border border-[rgba(15,23,42,0.08)] bg-white p-12 text-center space-y-3">
          <Loader2 size={24} className="animate-spin text-[#CCA038] mx-auto" />
          <p className="text-xs text-[#334155]">Loading project meetings...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6 text-center space-y-2">
          <p className="text-xs text-rose-700">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchMeetings}>
            Retry
          </Button>
        </div>
      ) : displayedMeetings.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(15,23,42,0.08)] bg-white p-10 text-center">
          <EmptyState
            icon={Calendar}
            title={
              activeSubTab === "upcoming"
                ? "No upcoming meetings scheduled"
                : activeSubTab === "past"
                ? "No past meetings found"
                : activeSubTab === "cancelled"
                ? "No cancelled meetings"
                : "No meetings found"
            }
            description={
              activeSubTab === "upcoming"
                ? "Schedule a Demo, Planning, or Discussion meeting with team members and clients."
                : "Meetings scheduled for this project will appear here."
            }
            action={
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setMeetingToEdit(null);
                  setScheduleModalOpen(true);
                }}
                leftIcon={<Plus size={14} />}
              >
                Schedule First Meeting
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedMeetings.map((m) => {
            const typeConfig = MEETING_TYPE_CONFIG[m.meeting_type] || { label: m.meeting_type };
            const platformConfig = MEETING_PLATFORM_CONFIG[m.platform] || { label: m.platform };
            const statusConfig = MEETING_STATUS_CONFIG[m.status] || { label: m.status };

            const formattedDate = formatMeetingDate(m.start_at);
            const timeRange = formatMeetingTimeRange(m.start_at, m.end_at);
            const durationText = getMeetingDurationText(m.start_at, m.end_at);

            return (
              <div
                key={m.id}
                onClick={() => setSelectedMeeting(m)}
                className="rounded-2xl border border-[rgba(15,23,42,0.10)] bg-white p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-[#CCA038]/40 transition-all flex flex-col justify-between space-y-3.5 cursor-pointer group"
              >
                {/* Top Card Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeConfig.badgeClass}`}
                      >
                        {typeConfig.label}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.badgeClass}`}
                      >
                        <span className={`h-1 w-1 rounded-full ${statusConfig.dotClass}`} />
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Platform Tag */}
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#334155]">
                      {m.platform === "whatsapp_call" ? (
                        <PhoneCall size={12} className="text-emerald-600" />
                      ) : (
                        <Video size={12} className="text-[#785312]" />
                      )}
                      <span>{platformConfig.label}</span>
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-sm sm:text-base text-[#0F172A] group-hover:text-[#785312] transition-colors line-clamp-2">
                    {m.title}
                  </h3>
                </div>

                {/* Middle Info: Date, Time & Agenda preview */}
                <div className="rounded-xl border border-[rgba(15,23,42,0.06)] bg-[#F8F9FB] p-3 space-y-2 text-xs text-[#334155]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium text-[#0F172A]">
                      <Calendar size={12} className="text-[#64748B]" />
                      <span>{formattedDate}</span>
                    </span>
                    <span className="text-[11px] text-[#334155]">
                      {timeRange}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-[rgba(15,23,42,0.05)] pt-1.5 text-[11px]">
                    <span>Duration: <strong>{durationText}</strong></span>
                    <span>By: <strong className="text-[#0F172A]">{m.created_by_name}</strong></span>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[rgba(15,23,42,0.06)]">
                  {/* Join Link (if online link available) */}
                  {m.meeting_url && m.platform !== "whatsapp_call" ? (
                    <a
                      href={m.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#785312] hover:text-[#6a5327] hover:underline"
                    >
                      <ExternalLink size={12} />
                      <span>Join Call</span>
                    </a>
                  ) : (
                    <span className="text-[11px] text-[#64748B]">WhatsApp Meeting</span>
                  )}

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => handleQuickCopy(m, e)}
                      title="Copy invitation"
                      className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8F9FB] transition-colors cursor-pointer"
                    >
                      <Copy size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setShareTarget(m)}
                      title="Share invitation"
                      className="p-1.5 rounded-lg text-[#64748B] hover:text-[#785312] hover:bg-[rgba(204,160,56,0.08)] transition-colors cursor-pointer"
                    >
                      <Share2 size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMeetingToEdit(m);
                        setScheduleModalOpen(true);
                      }}
                      title="Edit meeting"
                      className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8F9FB] transition-colors cursor-pointer"
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Modals */}
      {/* Schedule / Edit Modal */}
      {scheduleModalOpen && (
        <MeetingScheduleModal
          isOpen={scheduleModalOpen}
          onClose={() => {
            setScheduleModalOpen(false);
            setMeetingToEdit(null);
          }}
          projectId={projectId}
          projectName={projectName}
          meetingToEdit={meetingToEdit}
          onSuccess={handleMeetingSaved}
        />
      )}

      {/* Details Modal */}
      {selectedMeeting && (
        <MeetingDetailsModal
          isOpen={Boolean(selectedMeeting)}
          onClose={() => setSelectedMeeting(null)}
          meeting={selectedMeeting}
          projectName={projectName}
          onEdit={(m) => {
            setSelectedMeeting(null);
            setMeetingToEdit(m);
            setScheduleModalOpen(true);
          }}
          onShare={(m) => setShareTarget(m)}
          onStatusChange={handleMeetingSaved}
          onCancelMeeting={(m) => setCancelTarget(m)}
        />
      )}

      {/* Share Modal */}
      {shareTarget && (
        <ShareMeetingModal
          isOpen={Boolean(shareTarget)}
          onClose={() => setShareTarget(null)}
          meeting={shareTarget}
          projectName={projectName}
          projectTeamMembers={projectTeamMembers}
          clientEmail={clientEmail}
          onSuccess={fetchMeetings}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <CancelMeetingModal
          isOpen={Boolean(cancelTarget)}
          onClose={() => setCancelTarget(null)}
          meeting={cancelTarget}
          onSuccess={(updated) => {
            handleMeetingSaved(updated);
            if (selectedMeeting?.id === updated.id) {
              setSelectedMeeting(updated);
            }
          }}
        />
      )}
    </div>
  );
}
