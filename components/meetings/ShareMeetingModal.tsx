"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Mail,
  MessageSquare,
  Send,
  Loader2,
  Share2,
  User,
  AlertCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { ProjectMeeting } from "@/lib/types/meeting";
import {
  copyTextToClipboard,
  formatMeetingInvitationPlainText,
  getWhatsAppShareUrl,
} from "./meeting-utils";

interface ShareMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: ProjectMeeting;
  projectName: string;
  projectTeamMembers?: Array<{ id: string; name: string; username?: string; email?: string }>;
  clientEmail?: string | null;
  onSuccess?: () => void;
}

export function ShareMeetingModal({
  isOpen,
  onClose,
  meeting,
  projectName,
  projectTeamMembers = [],
  clientEmail,
  onSuccess,
}: ShareMeetingModalProps) {
  const [activeTab, setActiveTab] = useState<"whatsapp" | "email" | "copy">("whatsapp");

  // WhatsApp state
  const [recipientPhone, setRecipientPhone] = useState("");

  // Email state
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [customEmailInput, setCustomEmailInput] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Copy state
  const [copied, setCopied] = useState(false);

  // Pre-generate standard plain-text invitation
  const invitationPlainText = formatMeetingInvitationPlainText(meeting, projectName);

  // Pre-populate recipients if available
  useEffect(() => {
    if (!isOpen) return;
    const defaults: string[] = [];
    if (clientEmail && clientEmail.includes("@")) {
      defaults.push(clientEmail);
    }
    setRecipientEmails(defaults);
    setCustomEmailInput("");
    setEmailError("");
    setCopied(false);
  }, [isOpen, clientEmail]);

  // Handle WhatsApp Click
  const handleOpenWhatsApp = async () => {
    try {
      const shareUrl = getWhatsAppShareUrl(invitationPlainText, recipientPhone);
      window.open(shareUrl, "_blank", "noopener,noreferrer");

      // Log sharing event
      await fetch(`/api/projects/${meeting.project_id}/meetings/${meeting.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "whatsapp",
          recipientPhone: recipientPhone || null,
        }),
      }).catch(() => {});

      toast.success("WhatsApp share opened!");
      onSuccess?.();
    } catch {
      toast.error("Could not launch WhatsApp");
    }
  };

  // Handle Copy
  const handleCopy = async () => {
    const success = await copyTextToClipboard(invitationPlainText);
    if (success) {
      setCopied(true);
      toast.success("Meeting invitation copied to clipboard!");

      // Log event
      await fetch(`/api/projects/${meeting.project_id}/meetings/${meeting.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "clipboard" }),
      }).catch(() => {});

      onSuccess?.();
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error("Failed to copy to clipboard.");
    }
  };

  // Handle Add Email
  const handleAddEmail = (emailToAdd: string) => {
    const clean = emailToAdd.trim();
    if (!clean || !clean.includes("@")) return;
    if (!recipientEmails.includes(clean)) {
      setRecipientEmails((prev) => [...prev, clean]);
    }
    setCustomEmailInput("");
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setRecipientEmails((prev) => prev.filter((e) => e !== emailToRemove));
  };

  // Handle Send Email
  const handleSendEmail = async () => {
    let finalRecipients = [...recipientEmails];
    if (customEmailInput.trim() && customEmailInput.includes("@")) {
      finalRecipients.push(customEmailInput.trim());
    }

    if (finalRecipients.length === 0) {
      setEmailError("Please enter or select at least one recipient email address.");
      return;
    }

    setSendingEmail(true);
    setEmailError("");
    try {
      const res = await fetch(`/api/projects/${meeting.project_id}/meetings/${meeting.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          recipients: finalRecipients,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch email invitations.");

      toast.success(`Meeting invitation sent to ${finalRecipients.length} recipient(s)!`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setEmailError(err.message || "Failed to send email.");
      toast.error(err.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Meeting Invitation"
      description={meeting.title}
      maxWidth="md"
    >
      <div className="space-y-4 pt-1">
        {/* Sharing Channel Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-[#f4f2f8] rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("whatsapp")}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "whatsapp"
                ? "bg-white text-emerald-800 shadow-2xs font-bold"
                : "text-[#706C7D] hover:text-[#252331]"
            }`}
          >
            <MessageSquare size={13} className="text-emerald-600" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("email")}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "email"
                ? "bg-white text-[#80642F] shadow-2xs font-bold"
                : "text-[#706C7D] hover:text-[#252331]"
            }`}
          >
            <Mail size={13} className="text-[#80642F]" />
            <span>Email</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("copy")}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "copy"
                ? "bg-white text-[#252331] shadow-2xs font-bold"
                : "text-[#706C7D] hover:text-[#252331]"
            }`}
          >
            <Copy size={13} className="text-[#706C7D]" />
            <span>Copy Text</span>
          </button>
        </div>

        {/* Tab 1: WhatsApp */}
        {activeTab === "whatsapp" && (
          <div className="space-y-4 animate-in fade-in duration-100">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#706C7D] mb-1.5">
                Recipient Phone Number (Optional)
              </label>
              <input
                type="tel"
                placeholder="e.g. +91 9876543210 (Leave blank to choose in WhatsApp)"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                className="w-full rounded-xl border border-[rgba(74,61,100,0.15)] bg-white px-3.5 py-2 text-xs sm:text-sm text-[#252331] placeholder-[#9994A5] focus:outline-none focus:ring-1 focus:ring-[#B8944E]"
              />
              <p className="mt-1 text-[11px] text-[#9994A5]">
                WhatsApp will open with the invitation pre-filled. You can review the message before sending.
              </p>
            </div>

            {/* Preview Box */}
            <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-3 text-xs text-[#353140] max-h-40 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed select-all">
              {invitationPlainText}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(74,61,100,0.06)]">
              <Button variant="secondary" size="md" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleOpenWhatsApp}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                leftIcon={<MessageSquare size={14} />}
              >
                Open in WhatsApp
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2: Email */}
        {activeTab === "email" && (
          <div className="space-y-4 animate-in fade-in duration-100">
            {emailError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{emailError}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#706C7D] mb-1.5">
                Recipients
              </label>

              {/* Recipient Chips */}
              {recipientEmails.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {recipientEmails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-white border border-[rgba(74,61,100,0.12)] text-[#252331]"
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(email)}
                        className="text-[#9994A5] hover:text-rose-600 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add custom email */}
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Add recipient email..."
                  value={customEmailInput}
                  onChange={(e) => setCustomEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddEmail(customEmailInput);
                    }
                  }}
                  className="flex-1 rounded-xl border border-[rgba(74,61,100,0.15)] bg-white px-3 py-1.5 text-xs sm:text-sm text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E]"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => handleAddEmail(customEmailInput)}
                >
                  Add
                </Button>
              </div>

              {/* Quick suggestions from team */}
              {projectTeamMembers.length > 0 && (
                <div className="mt-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9994A5]">
                    Quick Add Team:
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {projectTeamMembers.map((tm) => {
                      const emailCandidate = tm.email || (tm.username?.includes("@") ? tm.username : null);
                      if (!emailCandidate) return null;
                      const isAdded = recipientEmails.includes(emailCandidate);
                      return (
                        <button
                          key={tm.id}
                          type="button"
                          onClick={() => (isAdded ? handleRemoveEmail(emailCandidate) : handleAddEmail(emailCandidate))}
                          className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                            isAdded
                              ? "bg-amber-50 text-[#80642F] border-amber-200"
                              : "bg-white text-[#706C7D] border-[rgba(74,61,100,0.1)] hover:bg-[#faf9fc]"
                          }`}
                        >
                          {tm.name} {isAdded ? "✓" : "+"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#faf9fc] p-3 text-xs text-[#706C7D] space-y-1">
              <p className="font-semibold text-[#252331]">Includes in Email:</p>
              <p>• Meeting Title, Type, and Project</p>
              <p>• Date, Time, and Duration in local time</p>
              <p>• Direct Meeting Join Button (Teams / Meet / Zoom)</p>
              <p>• Numbered Agenda List</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(74,61,100,0.06)]">
              <Button variant="secondary" size="md" onClick={onClose} disabled={sendingEmail}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSendEmail}
                disabled={sendingEmail}
                isLoading={sendingEmail}
                leftIcon={<Send size={14} />}
              >
                Send Email Invitations
              </Button>
            </div>
          </div>
        )}

        {/* Tab 3: Copy Plain Text */}
        {activeTab === "copy" && (
          <div className="space-y-4 animate-in fade-in duration-100">
            <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-3 text-xs text-[#353140] max-h-56 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed select-all">
              {invitationPlainText}
            </div>

            <p className="text-[11px] text-[#9994A5]">
              Internal notes are strictly excluded from the copied invitation text.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-[rgba(74,61,100,0.06)]">
              <Button variant="secondary" size="md" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleCopy}
                leftIcon={copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
              >
                {copied ? "Copied to Clipboard!" : "Copy Invitation"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
