"use client";

import React, { useState, useEffect } from "react";
import { Send, Users, Check, AlertCircle, ShieldCheck, MessageSquare, Mail, Undo2, Tag } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import type { RemunerationPublishingInfo } from "@/lib/types";

interface ProjectClient {
  id: string;
  name: string;
  login_id: string;
  email?: string | null;
  status: string;
}

interface PublishEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  estimateId?: string;
  estimateData: any;
  storyEstimates: any[];
  currentPublishing?: RemunerationPublishingInfo;
  initialEstimateLabel?: string;
  onPublished: (publishingInfo: RemunerationPublishingInfo, estimateId: string) => void;
  onRecallClick?: () => void;
}

export function PublishEstimateModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  estimateId,
  estimateData,
  storyEstimates,
  currentPublishing,
  initialEstimateLabel,
  onPublished,
  onRecallClick,
}: PublishEstimateModalProps) {
  const [clients, setClients] = useState<ProjectClient[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [clientEmails, setClientEmails] = useState<Record<string, string>>({});
  const [fromEmail, setFromEmail] = useState<string>(
    currentPublishing?.from_email || ""
  );
  const [estimateLabel, setEstimateLabel] = useState<string>(
    initialEstimateLabel || currentPublishing?.estimate_label || estimateData?.project_summary?.estimate_label || ""
  );
  const [publishNote, setPublishNote] = useState<string>("");
  const [isLoadingClients, setIsLoadingClients] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !projectId) return;

    setIsLoadingClients(true);
    fetch(`/api/remuneration/clients?projectId=${projectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.clients) {
          setClients(data.clients);
          // If already published, pre-select those clients. Otherwise, select all active clients by default.
          if (currentPublishing?.published_to_client_ids?.length) {
            setSelectedClientIds(currentPublishing.published_to_client_ids);
          } else {
            setSelectedClientIds(data.clients.map((c: ProjectClient) => c.id));
          }

          // Preload emails from client records and current publishing info
          const preloadedEmails: Record<string, string> = {};
          data.clients.forEach((c: ProjectClient) => {
            if (c.email) {
              preloadedEmails[c.id] = c.email;
            } else if (c.name.toLowerCase().includes("amal")) {
              preloadedEmails[c.id] = "amajobm@gmail.com";
            }
          });

          setClientEmails((prev) => ({
            ...preloadedEmails,
            ...(currentPublishing?.client_emails || {}),
            ...prev,
          }));

          if (currentPublishing?.from_email) {
            setFromEmail(currentPublishing.from_email);
          } else {
            // Fetch the saved email_from from admin settings
            fetch("/api/settings")
              .then((r) => r.json())
              .then((sData) => {
                if (sData?.ok && sData?.settings?.email_from) {
                  setFromEmail((prev) => prev || sData.settings.email_from);
                }
              })
              .catch(() => {});
          }
          if (currentPublishing?.publish_note) {
            setPublishNote(currentPublishing.publish_note);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load project clients:", err);
        toast.error("Failed to load project clients.");
      })
      .finally(() => {
        setIsLoadingClients(false);
      });
  }, [isOpen, projectId, currentPublishing]);

  const toggleClient = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
  };

  const toggleAll = () => {
    if (selectedClientIds.length === clients.length) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(clients.map((c) => c.id));
    }
  };

  const handlePublish = async () => {
    if (selectedClientIds.length === 0) {
      toast.error("Please select at least one client to share with.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        estimateId,
        project_id: projectId,
        estimateData,
        storyEstimates,
        selectedClientIds,
        clientEmails,
        estimateLabel: estimateLabel.trim() || undefined,
        fromEmail: fromEmail.trim(),
        publishNote: publishNote.trim(),
      };

      const res = await fetch("/api/remuneration/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to publish estimate.");
      }

      toast.success(
        currentPublishing?.status === "published"
          ? "Quotation access updated."
          : "Quotation published to client portal successfully!"
      );
      onPublished(data.publishing, data.estimateId);
      onClose();
    } catch (err: any) {
      console.error("Publish error:", err);
      toast.error(err.message || "Failed to publish estimate.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAlreadyPublished = currentPublishing?.status === "published" || currentPublishing?.status === "negotiating" || currentPublishing?.status === "approved";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAlreadyPublished ? "Manage Client Quotation Access" : "Publish Quotation to Client"}
      description={`Make this project remuneration estimate visible to selected clients in ${projectName}.`}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            {isAlreadyPublished && onRecallClick && (
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onRecallClick();
                }}
                className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 text-xs font-semibold flex items-center gap-1.5"
                title="Withdraw this quotation from client portal"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Recall Quotation
              </Button>
            )}
          </div>
          <Button
            variant="primary"
            onClick={handlePublish}
            isLoading={isSubmitting}
            disabled={isLoadingClients || clients.length === 0 || selectedClientIds.length === 0}
            className="flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            {isAlreadyPublished ? "Update Publication" : "Publish to Client Portal"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Banner Info */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#B8944E]/[0.08] border border-[#B8944E]/25 text-xs text-zinc-700 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-[#80642F] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-zinc-900">Read-Only with Interactive Bargaining:</span>
            <p className="mt-0.5 text-zinc-600">
              Clients can review deliverables, hours, and rates in a read-only portal. They can post bargaining comments on specific sections and submit an official Approval or Revision Request.
            </p>
          </div>
        </div>

        {/* Milestone / Phase Label */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#B8944E]" />
              Milestone / Phase Label (Optional)
            </label>
            <span className="text-[10px] text-zinc-400 font-medium">Included in emails &amp; export files</span>
          </div>
          <input
            type="text"
            value={estimateLabel}
            onChange={(e) => setEstimateLabel(e.target.value)}
            placeholder="e.g., Phase 1, Phase 2, MVP, Sprint 1-4"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/30 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10.5px] text-zinc-400 mr-1">Presets:</span>
            {["Phase 1", "Phase 2", "Phase 3", "MVP", "Milestone 1"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setEstimateLabel(preset)}
                className={`px-2 py-0.5 rounded text-[10.5px] font-semibold transition ${
                  estimateLabel === preset
                    ? "bg-[#B8944E] text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Client Selection Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#B8944E]" />
              Select Clients for this Project ({selectedClientIds.length}/{clients.length})
            </label>
            {clients.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-semibold text-[#80642F] hover:underline"
              >
                {selectedClientIds.length === clients.length ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>

          {isLoadingClients ? (
            <div className="py-6 text-center text-xs text-zinc-400">Loading project clients...</div>
          ) : clients.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-center">
              <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-zinc-700">No active clients assigned to this project.</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Add a client in the Clients management section before publishing.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 max-h-56 overflow-y-auto">
              {clients.map((client) => {
                const isChecked = selectedClientIds.includes(client.id);
                return (
                  <div
                    key={client.id}
                    className={`p-3 transition ${isChecked ? "bg-zinc-50/50" : "hover:bg-zinc-50/40"}`}
                  >
                    <div
                      onClick={() => toggleClient(client.id)}
                      className="flex items-center justify-between cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-zinc-300 text-[#B8944E] focus:ring-[#B8944E]"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 truncate">{client.name}</p>
                          <p className="text-xs text-zinc-400">Login PIN: {client.login_id}</p>
                        </div>
                      </div>
                      {isChecked && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Check className="w-3 h-3" /> Selected
                        </span>
                      )}
                    </div>

                    {/* Email Input for Selected Client */}
                    {isChecked && (
                      <div className="mt-2.5 pl-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-1">
                          <Mail className="w-3 h-3 text-[#B8944E]" />
                          <span>Email Notification Address (optional)</span>
                        </div>
                        <input
                          type="email"
                          value={clientEmails[client.id] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setClientEmails((prev) => ({ ...prev, [client.id]: val }));
                          }}
                          placeholder={`e.g., client@company.com`}
                          className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/30 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sender / From Address Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#B8944E]" />
              From / Sender Email Address
            </label>
            <span className="text-[10px] text-zinc-400 font-medium">Customizable</span>
          </div>
          <input
            type="text"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder='e.g., Project Workspace <onboarding@resend.dev> or Safeer <hello@yourdomain.com>'
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/30 focus:outline-none"
          />
          <p className="text-[11px] text-zinc-500">
            This sender address will appear in the client&apos;s email inbox.
          </p>
        </div>

        {/* Message / Notes to Client */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-[#B8944E]" />
            Note to Client (Optional)
          </label>
          <textarea
            rows={2}
            value={publishNote}
            onChange={(e) => setPublishNote(e.target.value)}
            placeholder="e.g., Hi team, here is our formal scope & estimation breakdown. Feel free to review and leave comments on any item!"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/30 focus:outline-none resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}

