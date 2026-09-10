"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, X, Clock, User, Sparkles, DollarSign, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import type { RemunerationDiscussionThread, RemunerationDiscussionMessage } from "@/lib/types";

interface SectionDiscussionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  estimateId: string;
  sectionKey: string;
  sectionTitle: string;
  initialThread?: RemunerationDiscussionThread;
  currency?: string;
  isClientViewer?: boolean;
  onThreadUpdated: (thread: RemunerationDiscussionThread, newPublishingStatus?: string) => void;
}

export function SectionDiscussionDrawer({
  isOpen,
  onClose,
  estimateId,
  sectionKey,
  sectionTitle,
  initialThread,
  currency = "INR",
  isClientViewer = false,
  onThreadUpdated,
}: SectionDiscussionDrawerProps) {
  const [thread, setThread] = useState<RemunerationDiscussionThread | undefined>(initialThread);
  const [messageText, setMessageText] = useState("");
  const [showCounterOffer, setShowCounterOffer] = useState(false);
  const [proposedHours, setProposedHours] = useState<string>("");
  const [proposedAmount, setProposedAmount] = useState<string>("");
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setThread(initialThread);
  }, [initialThread]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  }, [isOpen, thread?.messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim()) return;

    setIsSending(true);
    try {
      const payload = {
        estimateId,
        sectionKey,
        sectionTitle,
        message: messageText.trim(),
        proposedHours: showCounterOffer && proposedHours ? parseFloat(proposedHours) : undefined,
        proposedAmount: showCounterOffer && proposedAmount ? parseFloat(proposedAmount) : undefined,
      };

      const res = await fetch("/api/remuneration/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to post message");
      }

      setThread(data.thread);
      onThreadUpdated(data.thread, data.publishingStatus);
      setMessageText("");
      setProposedHours("");
      setProposedAmount("");
      setShowCounterOffer(false);
      toast.success("Message sent.");
    } catch (err: any) {
      console.error("Failed to send message:", err);
      toast.error(err.message || "Unable to send message.");
    } finally {
      setIsSending(false);
    }
  };

  const messages: RemunerationDiscussionMessage[] = thread?.messages || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Discussion: ${sectionTitle}`}
      description="Collaborate, ask questions, or negotiate deliverables & hours for this section."
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {isClientViewer && (
              <button
                type="button"
                onClick={() => setShowCounterOffer(!showCounterOffer)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition ${
                  showCounterOffer
                    ? "bg-[#B8944E]/10 text-[#80642F] border-[#B8944E]/40"
                    : "text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {showCounterOffer ? "✕ Remove Counter-Offer" : "+ Propose Counter-Offer"}
              </button>
            )}
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="flex flex-col h-[460px]">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-2">
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-zinc-700">No discussions on this section yet</p>
              <p className="text-[11px] text-zinc-400 max-w-xs mt-1">
                {isClientViewer
                  ? "You can share questions, suggest hour adjustments, or propose budget counter-offers here."
                  : "Clients can post feedback or bargaining notes here. Your replies will appear immediately in their portal."}
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isClientMsg = msg.author_type === "client";
              const isMe = isClientViewer ? isClientMsg : !isClientMsg;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-zinc-400">
                    <span className="font-semibold text-zinc-700">{msg.author_name}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        isClientMsg
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-amber-50 text-[#80642F] border border-amber-200"
                      }`}
                    >
                      {isClientMsg ? "Client" : "Freelancer"}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                      isMe
                        ? "bg-[#B8944E] text-white rounded-tr-xs"
                        : "bg-zinc-100 text-zinc-800 rounded-tl-xs"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.message}</p>

                    {/* Counter Offer Box */}
                    {(msg.proposed_hours !== undefined || msg.proposed_amount !== undefined) && (
                      <div
                        className={`mt-2 pt-2 border-t flex flex-wrap items-center gap-3 text-[11px] font-semibold ${
                          isMe ? "border-white/20 text-white/95" : "border-zinc-200 text-zinc-900"
                        }`}
                      >
                        <span className="opacity-80">Proposed Terms:</span>
                        {msg.proposed_hours !== undefined && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/10">
                            <Clock className="w-3 h-3" />
                            {msg.proposed_hours} hrs
                          </span>
                        )}
                        {msg.proposed_amount !== undefined && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/10">
                            <DollarSign className="w-3 h-3" />
                            {currency} {msg.proposed_amount.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Box */}
        <div className="pt-3 mt-2 border-t border-zinc-100 space-y-2">
          {showCounterOffer && (
            <div className="p-2.5 rounded-xl bg-[#B8944E]/[0.06] border border-[#B8944E]/25 grid grid-cols-2 gap-3 animate-in fade-in duration-150">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 block mb-1">
                  Proposed Hours
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="e.g. 4.0"
                    value={proposedHours}
                    onChange={(e) => setProposedHours(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-[#B8944E] focus:outline-none"
                  />
                  <span className="text-[11px] text-zinc-500 font-medium">hrs</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 block mb-1">
                  Proposed Target Budget ({currency})
                </label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  placeholder="e.g. 4500"
                  value={proposedAmount}
                  onChange={(e) => setProposedAmount(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-[#B8944E] focus:outline-none"
                />
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <textarea
              rows={1}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                isClientViewer
                  ? "Discuss or bargain on this section (Press Enter to send)..."
                  : "Reply to client discussion..."
              }
              className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/30 focus:outline-none resize-none"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isSending || !messageText.trim()}
              isLoading={isSending}
              className="h-9 w-9 p-0 flex items-center justify-center rounded-xl shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </Modal>
  );
}
