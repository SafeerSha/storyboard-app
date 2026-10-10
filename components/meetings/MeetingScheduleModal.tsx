"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  ExternalLink,
  Layers,
  Link2,
  Loader2,
  Lock,
  PhoneCall,
  Save,
  Video,
  X,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import {
  MEETING_PLATFORM_CONFIG,
  MEETING_TYPE_CONFIG,
  MeetingPlatform,
  MeetingType,
  ProjectMeeting,
} from "@/lib/types/meeting";
import { isValidMeetingUrl } from "./meeting-utils";

interface MeetingScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  meetingToEdit?: ProjectMeeting | null;
  onSuccess: (meeting: ProjectMeeting) => void;
}

export function MeetingScheduleModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  meetingToEdit,
  onSuccess,
}: MeetingScheduleModalProps) {
  const isEditing = Boolean(meetingToEdit);

  // Form State
  const [title, setTitle] = useState("");
  const [meetingType, setMeetingType] = useState<MeetingType>("discussion");
  const [platform, setPlatform] = useState<MeetingPlatform>("google_meet");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("10:30");
  const [durationPreset, setDurationPreset] = useState<number>(30);
  const [agenda, setAgenda] = useState("");
  const [invitationMessage, setInvitationMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Today string for min date (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split("T")[0];

  // Initialize form state
  useEffect(() => {
    if (!isOpen) return;

    if (meetingToEdit) {
      setTitle(meetingToEdit.title);
      setMeetingType(meetingToEdit.meeting_type);
      setPlatform(meetingToEdit.platform);
      setMeetingUrl(meetingToEdit.meeting_url || "");
      setAgenda(meetingToEdit.agenda);
      setInvitationMessage(meetingToEdit.invitation_message || "");
      setInternalNote(meetingToEdit.internal_note || "");

      try {
        const start = new Date(meetingToEdit.start_at);
        const end = new Date(meetingToEdit.end_at);
        setMeetingDate(start.toISOString().split("T")[0]);
        setStartTime(
          `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`
        );
        setEndTime(
          `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`
        );
        const diff = Math.round((end.getTime() - start.getTime()) / (60 * 1000));
        setDurationPreset(diff > 0 ? diff : 30);
      } catch {
        setMeetingDate(todayStr);
      }
    } else {
      // Defaults for new meeting
      setTitle("");
      setMeetingType("discussion");
      setPlatform("google_meet");
      setMeetingUrl("");
      setMeetingDate(todayStr);
      setStartTime("10:00");
      setEndTime("10:30");
      setDurationPreset(30);
      setAgenda("1. Review current milestones\n2. Address open questions\n3. Agree on action items");
      setInvitationMessage("");
      setInternalNote("");
    }
    setErrors({});
  }, [isOpen, meetingToEdit, todayStr]);

  // Handle changing start time or duration preset
  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);
    if (!newStartTime) return;
    const [h, m] = newStartTime.split(":").map(Number);
    const startMinutes = h * 60 + m;
    const endMinutes = startMinutes + durationPreset;
    const endH = Math.floor(endMinutes / 60) % 24;
    const endM = endMinutes % 60;
    setEndTime(`${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`);
  };

  const handleDurationPresetChange = (mins: number) => {
    setDurationPreset(mins);
    if (!startTime) return;
    const [h, m] = startTime.split(":").map(Number);
    const startMinutes = h * 60 + m;
    const endMinutes = startMinutes + mins;
    const endH = Math.floor(endMinutes / 60) % 24;
    const endM = endMinutes % 60;
    setEndTime(`${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`);
  };

  // Validate form
  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!title.trim()) {
      errs.title = "Please enter a meeting title.";
    }

    if (!agenda.trim()) {
      errs.agenda = "Please provide an agenda describing topics to discuss.";
    }

    if (platform !== "whatsapp_call") {
      if (!meetingUrl.trim()) {
        errs.meetingUrl = `Meeting link is required for ${MEETING_PLATFORM_CONFIG[platform].label}.`;
      } else if (!isValidMeetingUrl(meetingUrl)) {
        errs.meetingUrl = "Please enter a valid HTTP/HTTPS URL (e.g., https://meet.google.com/...).";
      }
    }

    if (!meetingDate) {
      errs.meetingDate = "Please choose a meeting date.";
    }

    if (!startTime) {
      errs.startTime = "Please select a start time.";
    }

    if (!endTime) {
      errs.endTime = "Please select an end time.";
    }

    if (startTime && endTime) {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;
      if (endMinutes <= startMinutes) {
        errs.endTime = "End time must be after start time.";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const startIso = new Date(`${meetingDate}T${startTime}:00`).toISOString();
      const endIso = new Date(`${meetingDate}T${endTime}:00`).toISOString();

      const payload = {
        title: title.trim(),
        agenda: agenda.trim(),
        meeting_type: meetingType,
        platform,
        meeting_url: platform === "whatsapp_call" ? null : meetingUrl.trim(),
        start_at: startIso,
        end_at: endIso,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        invitation_message: invitationMessage.trim(),
        internal_note: internalNote.trim() || null,
      };

      const url = isEditing
        ? `/api/projects/${projectId}/meetings/${meetingToEdit?.id}`
        : `/api/projects/${projectId}/meetings`;

      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save meeting");
      }

      toast.success(isEditing ? "Meeting updated successfully!" : "Meeting scheduled successfully!");
      onSuccess(data.meeting);
      onClose();
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, form: err.message || "Failed to save meeting." }));
      toast.error(err.message || "Failed to save meeting");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-[rgba(74,61,100,0.15)] bg-white px-3.5 py-2 text-xs sm:text-sm text-[#252331] placeholder-[#9994A5] focus:outline-none focus:ring-2 focus:ring-[#B8944E]/30 focus:border-[#B8944E] transition-all";
  const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-[#706C7D] mb-1.5";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Meeting" : "Schedule Project Meeting"}
      description={`Project: ${projectName}`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 pt-1">
        {errors.form && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}

        {/* 1. Title */}
        <div>
          <label className={labelClass}>
            Meeting Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Homepage Design Review, Sprint Planning..."
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
            }}
            className={`${inputClass} ${errors.title ? "border-rose-400 focus:ring-rose-200" : ""}`}
            autoFocus
          />
          {errors.title && <p className="mt-1 text-[11px] text-rose-600">{errors.title}</p>}
        </div>

        {/* 2. Meeting Type & Platform Selector Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Meeting Type Selection */}
          <div>
            <label className={labelClass}>Meeting Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(["demo", "planning", "discussion"] as MeetingType[]).map((type) => {
                const conf = MEETING_TYPE_CONFIG[type];
                const isSelected = meetingType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMeetingType(type)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#B8944E] bg-[rgba(184,148,78,0.12)] text-[#80642F] shadow-2xs"
                        : "border-[rgba(74,61,100,0.12)] bg-white text-[#706C7D] hover:bg-[#faf9fc]"
                    }`}
                  >
                    {conf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Meeting Platform Selection */}
          <div>
            <label className={labelClass}>Platform / Location</label>
            <div className="grid grid-cols-2 gap-2">
              {(["google_meet", "teams", "zoom", "whatsapp_call"] as MeetingPlatform[]).map((plat) => {
                const conf = MEETING_PLATFORM_CONFIG[plat];
                const isSelected = platform === plat;
                return (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => {
                      setPlatform(plat);
                      if (plat === "whatsapp_call") {
                        setMeetingUrl("");
                      }
                      if (errors.meetingUrl) {
                        setErrors((prev) => ({ ...prev, meetingUrl: "" }));
                      }
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#B8944E] bg-[rgba(184,148,78,0.12)] text-[#80642F] shadow-2xs"
                        : "border-[rgba(74,61,100,0.12)] bg-white text-[#706C7D] hover:bg-[#faf9fc]"
                    }`}
                  >
                    {plat === "whatsapp_call" ? (
                      <PhoneCall size={12} className="text-emerald-600 shrink-0" />
                    ) : (
                      <Video size={12} className="text-[#80642F] shrink-0" />
                    )}
                    <span className="truncate">{conf.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Conditional Meeting URL */}
        {platform !== "whatsapp_call" && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#706C7D]">
                {MEETING_PLATFORM_CONFIG[platform].label} Link <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-[#9994A5]">Must begin with http:// or https://</span>
            </div>
            <div className="relative">
              <input
                type="url"
                placeholder={MEETING_PLATFORM_CONFIG[platform].defaultPlaceholder}
                value={meetingUrl}
                onChange={(e) => {
                  setMeetingUrl(e.target.value);
                  if (errors.meetingUrl) setErrors((prev) => ({ ...prev, meetingUrl: "" }));
                }}
                className={`${inputClass} pl-8 ${
                  errors.meetingUrl ? "border-rose-400 focus:ring-rose-200" : ""
                }`}
              />
              <Link2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9994A5]" />
            </div>
            {errors.meetingUrl && (
              <p className="mt-1 text-[11px] text-rose-600">{errors.meetingUrl}</p>
            )}
          </div>
        )}

        {/* 4. Date, Start Time, End Time & Duration Presets */}
        <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-3.5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>
                Meeting Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                min={isEditing ? undefined : todayStr}
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className={inputClass}
              />
              {errors.meetingDate && (
                <p className="mt-1 text-[11px] text-rose-600">{errors.meetingDate}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className={inputClass}
              />
              {errors.startTime && (
                <p className="mt-1 text-[11px] text-rose-600">{errors.startTime}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  if (errors.endTime) setErrors((prev) => ({ ...prev, endTime: "" }));
                }}
                className={`${inputClass} ${errors.endTime ? "border-rose-400" : ""}`}
              />
              {errors.endTime && (
                <p className="mt-1 text-[11px] text-rose-600">{errors.endTime}</p>
              )}
            </div>
          </div>

          {/* Quick Duration Buttons */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-[10px] font-bold text-[#706C7D] uppercase tracking-wider">
              Quick Duration:
            </span>
            {[15, 30, 45, 60, 90].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => handleDurationPresetChange(mins)}
                className={`px-2.5 py-0.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  durationPreset === mins
                    ? "bg-[#B8944E] text-white border-[#B8944E]"
                    : "bg-white text-[#706C7D] border-[rgba(74,61,100,0.12)] hover:bg-[#f1eff7]"
                }`}
              >
                {mins < 60 ? `${mins}m` : mins === 60 ? "1 hr" : "1.5 hr"}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Agenda */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#706C7D]">
              Agenda Items <span className="text-rose-500">*</span>
            </label>
            <span className="text-[10px] text-[#9994A5]">Numbered list or separate by line</span>
          </div>
          <textarea
            rows={3}
            placeholder="1. Review homepage UI components&#10;2. Discuss client feedback&#10;3. Finalize next steps"
            value={agenda}
            onChange={(e) => {
              setAgenda(e.target.value);
              if (errors.agenda) setErrors((prev) => ({ ...prev, agenda: "" }));
            }}
            className={`${inputClass} resize-y min-h-[75px] font-sans ${
              errors.agenda ? "border-rose-400 focus:ring-rose-200" : ""
            }`}
          />
          {errors.agenda && <p className="mt-1 text-[11px] text-rose-600">{errors.agenda}</p>}
        </div>

        {/* 6. Invitation Message */}
        <div>
          <label className={labelClass}>Invitation Message (Included in Shares)</label>
          <input
            type="text"
            value={invitationMessage}
            onChange={(e) => setInvitationMessage(e.target.value)}
            className={inputClass}
            placeholder="Custom invitation message"
          />
        </div>

        {/* 7. Internal Meeting Note (Private) */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-amber-800">
            <Lock size={12} className="shrink-0 text-amber-700" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Internal Note — Not Shared
            </span>
          </div>
          <p className="text-[11px] text-amber-900/70">
            Private notes for application history, follow-up, and team reference. This note is never sent to clients or included in external invitations.
          </p>
          <textarea
            rows={2}
            placeholder="Add internal discussion points, sensitive prep notes, or follow-up items..."
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs text-[#252331] placeholder-[#9994A5] focus:outline-none focus:ring-1 focus:ring-[#B8944E]"
          />
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[rgba(74,61,100,0.08)]">
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={submitting}
            isLoading={submitting}
            leftIcon={<Save size={14} />}
          >
            {isEditing ? "Save Changes" : "Schedule Meeting"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
