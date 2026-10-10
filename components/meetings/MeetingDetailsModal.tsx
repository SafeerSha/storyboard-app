"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Edit2,
  ExternalLink,
  History,
  Link2,
  Lock,
  Mail,
  MessageSquare,
  PhoneCall,
  Share2,
  Trash2,
  Video,
  XCircle,
  AlertCircle,
  Save,
  Loader2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import {
  MEETING_PLATFORM_CONFIG,
  MEETING_STATUS_CONFIG,
  MEETING_TYPE_CONFIG,
  ProjectMeeting,
  ProjectMeetingEvent,
} from "@/lib/types/meeting";
import {
  copyTextToClipboard,
  formatMeetingDate,
  formatMeetingInvitationPlainText,
  formatMeetingTimeRange,
  getMeetingDurationText,
  parseAgendaItems,
} from "./meeting-utils";

interface MeetingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: ProjectMeeting | null;
  projectName: string;
  onEdit: (meeting: ProjectMeeting) => void;
  onShare: (meeting: ProjectMeeting) => void;
  onStatusChange: (updated: ProjectMeeting) => void;
  onCancelMeeting: (meeting: ProjectMeeting) => void;
}

export function MeetingDetailsModal({
  isOpen,
  onClose,
  meeting,
  projectName,
  onEdit,
  onShare,
  onStatusChange,
  onCancelMeeting,
}: MeetingDetailsModalProps) {
  const [events, setEvents] = useState<ProjectMeetingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Quick edit note state
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [completing, setCompleting] = useState(false);

  const fetchMeetingEvents = useCallback(async () => {
    if (!meeting?.id || !meeting.project_id) return;
    setLoadingEvents(true);
    try {
      const res = await fetch(`/api/projects/${meeting.project_id}/meetings/${meeting.id}`);
      const data = await res.json();
      if (res.ok && data.events) {
        setEvents(data.events);
      }
    } catch {
      // Non-blocking
    } finally {
      setLoadingEvents(false);
    }
  }, [meeting?.id, meeting?.project_id]);

  useEffect(() => {
    if (isOpen && meeting) {
      setNoteValue(meeting.internal_note || "");
      setEditingNote(false);
      fetchMeetingEvents();
    }
  }, [isOpen, meeting, fetchMeetingEvents]);

  if (!meeting) return null;

  const typeConfig = MEETING_TYPE_CONFIG[meeting.meeting_type] || { label: meeting.meeting_type };
  const platformConfig = MEETING_PLATFORM_CONFIG[meeting.platform] || { label: meeting.platform };
  const statusConfig = MEETING_STATUS_CONFIG[meeting.status] || { label: meeting.status };

  const formattedDate = formatMeetingDate(meeting.start_at);
  const timeRange = formatMeetingTimeRange(meeting.start_at, meeting.end_at);
  const durationText = getMeetingDurationText(meeting.start_at, meeting.end_at);
  const agendaItems = parseAgendaItems(meeting.agenda);

  const handleCopy = async () => {
    const text = formatMeetingInvitationPlainText(meeting, projectName);
    const success = await copyTextToClipboard(text);
    if (success) {
      toast.success("Meeting invitation copied to clipboard!");
      fetch(`/api/projects/${meeting.project_id}/meetings/${meeting.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "clipboard" }),
      }).catch(() => {});
    }
  };

  const handleMarkCompleted = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/projects/${meeting.project_id}/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update meeting status");
      toast.success("Meeting marked as completed!");
      onStatusChange(data.meeting);
      fetchMeetingEvents();
    } catch (err: any) {
      toast.error(err.message || "Failed to mark as completed");
    } finally {
      setCompleting(false);
    }
  };

  const handleSaveNote = async () => {
    setSavingNote(true);
    try {
      const res = await fetch(`/api/projects/${meeting.project_id}/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internal_note: noteValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update note");
      toast.success("Internal note updated!");
      setEditingNote(false);
      onStatusChange(data.meeting);
      fetchMeetingEvents();
    } catch (err: any) {
      toast.error(err.message || "Failed to update note");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={meeting.title}
      description={`Project: ${projectName}`}
      maxWidth="xl"
    >
      <div className="space-y-5 pt-1">
        {/* Top Header Card */}
        <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.badgeClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotClass}`} />
              {statusConfig.label}
            </span>

            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${typeConfig.badgeClass}`}
            >
              {typeConfig.label}
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-[rgba(74,61,100,0.12)] text-[#252331]">
              {meeting.platform === "whatsapp_call" ? (
                <PhoneCall size={12} className="text-emerald-600" />
              ) : (
                <Video size={12} className="text-[#80642F]" />
              )}
              {platformConfig.label}
            </span>
          </div>

          {/* Prominent Action: Join Online Meeting (if link exists and not whatsapp call) */}
          {meeting.meeting_url && meeting.platform !== "whatsapp_call" && (
            <a
              href={meeting.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#B8944E] hover:bg-[#9F7D3E] text-white text-xs sm:text-sm font-semibold px-4 py-2 transition-all shadow-xs shrink-0"
            >
              <ExternalLink size={14} />
              <span>Join Meeting</span>
            </a>
          )}
        </div>

        {/* 2-Column Content Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Left Column (2 spans): Details & Agenda */}
          <div className="md:col-span-2 space-y-4">
            {/* Meta Schedule Info Card */}
            <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-white p-4 space-y-2.5 text-xs text-[#706C7D]">
              <div className="flex items-center justify-between py-1 border-b border-[rgba(74,61,100,0.05)]">
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-[#9994A5]" />
                  <span>Date:</span>
                </span>
                <span className="font-semibold text-[#252331]">{formattedDate}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[rgba(74,61,100,0.05)]">
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className="text-[#9994A5]" />
                  <span>Time:</span>
                </span>
                <span className="font-semibold text-[#252331]">
                  {timeRange} {durationText && <span className="font-normal text-[#706C7D]">({durationText})</span>}
                </span>
              </div>

              {meeting.meeting_url && meeting.platform !== "whatsapp_call" && (
                <div className="flex items-center justify-between py-1 border-b border-[rgba(74,61,100,0.05)]">
                  <span className="flex items-center gap-1.5">
                    <Link2 size={13} className="text-[#9994A5]" />
                    <span>Meeting Link:</span>
                  </span>
                  <a
                    href={meeting.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#80642F] hover:underline truncate max-w-[220px]"
                  >
                    {meeting.meeting_url}
                  </a>
                </div>
              )}

              <div className="flex items-center justify-between py-1">
                <span>Organizer:</span>
                <span className="font-semibold text-[#252331]">{meeting.created_by_name}</span>
              </div>
            </div>

            {/* Agenda */}
            <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-white p-4 space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#80642F]">
                Agenda Items
              </h4>
              <ul className="space-y-1.5 text-xs text-[#353140] pl-1">
                {agendaItems.length > 0 ? (
                  agendaItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="font-bold text-[#80642F] shrink-0">{idx + 1}.</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-[#9994A5]">Open discussion.</li>
                )}
              </ul>
            </div>

            {/* Cancellation reason banner if cancelled */}
            {meeting.status === "cancelled" && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-800 space-y-1">
                <span className="font-bold">Cancellation Reason:</span>
                <p>{meeting.cancellation_reason || "No specific reason provided."}</p>
              </div>
            )}
          </div>

          {/* Right Column (1 span): Internal Notes & Audit History */}
          <div className="space-y-4">
            {/* Internal Note Card (Private) */}
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-amber-200/50 pb-2">
                <span className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Lock size={12} className="text-amber-700" />
                  <span>Internal Note</span>
                </span>
                {!editingNote ? (
                  <button
                    type="button"
                    onClick={() => setEditingNote(true)}
                    className="text-[10px] font-semibold text-[#80642F] hover:underline cursor-pointer"
                  >
                    Edit Note
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingNote(false)}
                    className="text-[10px] font-semibold text-[#706C7D] hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {!editingNote ? (
                <div className="min-h-[50px] text-amber-900/90 whitespace-pre-wrap leading-relaxed">
                  {meeting.internal_note ? (
                    meeting.internal_note
                  ) : (
                    <span className="text-amber-800/50 italic">
                      No internal notes recorded. Click "Edit Note" to add private prep notes.
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={3}
                    value={noteValue}
                    onChange={(e) => setNoteValue(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E]"
                    placeholder="Add internal notes..."
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveNote}
                      disabled={savingNote}
                      isLoading={savingNote}
                    >
                      Save Note
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline Audit Events */}
            <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-white p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.06)] pb-2">
                <span className="font-bold text-[#252331] flex items-center gap-1.5">
                  <History size={13} className="text-[#9994A5]" />
                  <span>Meeting History</span>
                </span>
              </div>

              {loadingEvents ? (
                <div className="py-4 text-center text-[#9994A5]">
                  <Loader2 size={16} className="animate-spin mx-auto" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-[#9994A5] text-[11px] py-2">No history recorded yet.</p>
              ) : (
                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                  {events.map((ev) => (
                    <div key={ev.id} className="text-[11px] border-l-2 border-[rgba(184,148,78,0.4)] pl-2 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#252331]">{ev.title}</span>
                        <span className="text-[10px] text-[#9994A5]">
                          {new Date(ev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-[#706C7D]">{ev.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[rgba(74,61,100,0.08)]">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShare(meeting)}
              leftIcon={<Share2 size={13} />}
            >
              Share Invitation
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              leftIcon={<Copy size={13} />}
            >
              Copy Text
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {meeting.status === "scheduled" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkCompleted}
                  disabled={completing}
                  leftIcon={<CheckCircle2 size={13} className="text-emerald-600" />}
                >
                  Mark Completed
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCancelMeeting(meeting)}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                  leftIcon={<XCircle size={13} />}
                >
                  Cancel Meeting
                </Button>
              </>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={() => onEdit(meeting)}
              leftIcon={<Edit2 size={13} />}
            >
              Edit Meeting
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
