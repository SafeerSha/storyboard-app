"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Bot,
  ChevronDown,
  CornerDownLeft,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { VoiceInput } from "@/components/ui/VoiceInput";
import type {
  ProjectInboxConversation,
  ProjectInboxItem,
  ProjectInboxMessage,
} from "@/lib/types";

interface InboxDiscussionWorkspaceProps {
  item: ProjectInboxItem;
  currentUserId?: string;
  onInsightSaved?: () => void;
}

const STARTER_PROMPTS = [
  "Is this idea worth building?",
  "What should the MVP include?",
  "Research competitors and existing alternatives",
  "Identify technical risks and architecture choices",
  "Break this into phased milestones",
];

export function InboxDiscussionWorkspace({
  item,
  currentUserId,
  onInsightSaved,
}: InboxDiscussionWorkspaceProps) {
  const [conversations, setConversations] = useState<ProjectInboxConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ProjectInboxMessage[]>([]);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [savingInsightIds, setSavingInsightIds] = useState<Set<string>>(new Set());

  const [inputMessage, setInputMessage] = useState("");
  const [isAiMode, setIsAiMode] = useState(true); // Ask AI vs Team Discussion
  const [sending, setSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");

  // Modals & dropdowns
  const [showConvDropdown, setShowConvDropdown] = useState(false);
  const [newConvModal, setNewConvModal] = useState(false);
  const [newConvTitle, setNewConvTitle] = useState("");
  const [creatingConv, setCreatingConv] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  // 1. Load Conversations
  const loadConversations = async () => {
    try {
      const res = await fetch(`/api/inbox/${item.id}/conversations`);
      const data = await res.json();
      if (res.ok && data.conversations) {
        setConversations(data.conversations);
        if (data.conversations.length > 0 && !activeConvId) {
          setActiveConvId(data.conversations[0].id);
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setLoadingConv(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [item.id]);

  // 2. Load Messages for Active Conversation
  const loadMessages = async (convId: string) => {
    setLoadingMessages(true);
    setError("");
    try {
      const res = await fetch(`/api/inbox/${item.id}/conversations/${convId}/messages?limit=50`);
      const data = await res.json();
      if (res.ok && data.messages) {
        setMessages(data.messages);
        setHasMore(Boolean(data.hasMore));
        if (Array.isArray(data.savedMessageIds)) {
          setSavedMessageIds(new Set(data.savedMessageIds));
        }
      }
    } catch {
      setError("Failed to load conversation history.");
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!loadingOlder) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, sending]);

  // Load older messages (keyset cursor)
  const handleLoadOlder = async () => {
    if (!activeConvId || messages.length === 0 || loadingOlder) return;
    const oldestTimestamp = messages[0]?.created_at;
    setLoadingOlder(true);
    try {
      const res = await fetch(
        `/api/inbox/${item.id}/conversations/${activeConvId}/messages?limit=50&before=${encodeURIComponent(
          oldestTimestamp
        )}`
      );
      const data = await res.json();
      if (res.ok && data.messages) {
        setMessages((prev) => [...data.messages, ...prev]);
        setHasMore(Boolean(data.hasMore));
      }
    } catch {
      toast.error("Unable to load older messages");
    } finally {
      setLoadingOlder(false);
    }
  };

  // 3. Create New Discussion
  const handleCreateConv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConvTitle.trim() || creatingConv) return;

    setCreatingConv(true);
    try {
      const res = await fetch(`/api/inbox/${item.id}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newConvTitle.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.conversation) {
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConvId(data.conversation.id);
        setNewConvTitle("");
        setNewConvModal(false);
        toast.success("Discussion created");
      } else {
        toast.error("Unable to create discussion", { description: data?.error || "Please try again." });
      }
    } catch {
      toast.error("Unable to create discussion");
    } finally {
      setCreatingConv(false);
    }
  };

  // 4. Send Message (Human or AI)
  const handleSendMessage = async (textToSend?: string, forceAi = isAiMode) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || sending) return;

    let targetConvId = activeConvId;
    if (!targetConvId) {
      // Auto-create General Discussion
      try {
        const createRes = await fetch(`/api/inbox/${item.id}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "General Discussion" }),
        });
        const createData = await createRes.json();
        if (createRes.ok && createData.conversation) {
          setConversations([createData.conversation]);
          setActiveConvId(createData.conversation.id);
          targetConvId = createData.conversation.id;
        } else {
          toast.error("Could not initialize discussion workspace");
          return;
        }
      } catch {
        toast.error("Could not initialize discussion workspace");
        return;
      }
    }

    if (!targetConvId) return;

    setInputMessage("");
    setSending(true);
    setError("");

    // Optimistic temporary message
    const tempUserMsg: ProjectInboxMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: targetConvId,
      sender_type: "user",
      user_id: currentUserId || null,
      user_name: "You",
      message: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/inbox/${item.id}/conversations/${targetConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          isAiQuery: forceAi,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process message.");
      }

      // Replace optimistic message and append AI response if available
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempUserMsg.id);
        const nextList = [...withoutTemp, data.userMessage];
        if (data.assistantMessage) {
          nextList.push(data.assistantMessage);
        }
        return nextList;
      });
    } catch (err: any) {
      const errText = err.message || "Failed to send message.";
      setError(errText);
      toast.error("Message error", { description: errText });
    } finally {
      setSending(false);
    }
  };

  // 5. Save AI Message as Insight
  const handleSaveInsight = async (aiMessage: ProjectInboxMessage) => {
    if (savedMessageIds.has(aiMessage.id) || savingInsightIds.has(aiMessage.id)) {
      return;
    }

    setSavingInsightIds((prev) => new Set(prev).add(aiMessage.id));
    try {
      const res = await fetch(`/api/inbox/${item.id}/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: aiMessage.id,
          conversationId: aiMessage.conversation_id,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSavedMessageIds((prev) => new Set(prev).add(aiMessage.id));
        toast.success("Insight saved.");
        onInsightSaved?.();
      } else {
        toast.error("Unable to save insight", { description: data?.error || "Please try again." });
      }
    } catch {
      toast.error("Unable to save insight", { description: "An unexpected error occurred." });
    } finally {
      setSavingInsightIds((prev) => {
        const next = new Set(prev);
        next.delete(aiMessage.id);
        return next;
      });
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex flex-col h-[700px] rounded-2xl border border-[#EBE7F2] bg-white shadow-card overflow-hidden">
      {/* Workspace Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#B8944E] text-white shadow-xs shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-[#252331] truncate">
              AI Thinking Partner
            </h3>
            <p className="text-[11px] text-[#706C7D] truncate">
              Contextual brainstorming for &ldquo;{item.title}&rdquo;
            </p>
          </div>
        </div>

        {/* Conversation Switcher Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowConvDropdown((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <MessageSquare size={13} className="text-slate-400" />
            <span className="max-w-[130px] truncate">{activeConv?.title || "General Discussion"}</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          {showConvDropdown && (
            <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-[#EBE7F2] bg-white p-1 shadow-dropdown z-30 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                <span>Discussions</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowConvDropdown(false);
                    setNewConvModal(true);
                  }}
                  className="text-[#80642F] hover:underline font-semibold"
                >
                  + New Discussion
                </button>
              </div>

              <div className="max-h-52 overflow-y-auto py-1">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setActiveConvId(c.id);
                      setShowConvDropdown(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition ${
                      c.id === activeConvId
                        ? "bg-[rgba(184,148,78,0.09)] font-semibold text-[#80642F]"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{c.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Message Stream */}
      <div
        ref={messageContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30"
      >
        {/* Load older messages button */}
        {hasMore && (
          <div className="text-center pb-2">
            <button
              type="button"
              onClick={handleLoadOlder}
              disabled={loadingOlder}
              className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 shadow-xs transition"
            >
              {loadingOlder && <Loader2 size={12} className="animate-spin text-slate-400" />}
              <span>Load older messages</span>
            </button>
          </div>
        )}

        {loadingMessages ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400 gap-2">
            <Loader2 size={16} className="animate-spin text-[#B8944E]" />
            <span>Loading discussion...</span>
          </div>
        ) : messages.length === 0 ? (
          /* Empty Discussion State */
          <div className="flex h-full flex-col justify-center items-center text-center p-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(184,148,78,0.10)] text-[#B8944E] mb-3">
              <Sparkles size={22} />
            </div>
            <h4 className="text-sm font-semibold text-[#111827]">
              Start exploring this idea with your team or AI
            </h4>
            <p className="mt-1 text-xs text-slate-500 max-w-sm leading-relaxed">
              Ask about technical risks, MVP scope, alternatives, or invite team members to brainstorm.
            </p>

            {/* Suggested Exploration Prompts */}
            <div className="mt-6 w-full max-w-md space-y-1.5 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Suggested exploration
              </p>
              {STARTER_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(prompt, true)}
                  disabled={sending}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 text-xs font-medium text-slate-700 hover:border-[#B8944E] hover:text-[#80642F] hover:bg-amber-50/20 transition group text-left shadow-xs"
                >
                  <span>{prompt}</span>
                  <CornerDownLeft size={12} className="text-slate-400 group-hover:text-[#80642F]" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isAi = m.sender_type === "ai";
            const isCurrentUser = !isAi && (m.user_id === currentUserId || m.user_name === "You");
            const isSaved = savedMessageIds.has(m.id);
            const isSaving = savingInsightIds.has(m.id);

            return (
              <div
                key={m.id}
                className={`flex gap-3 text-xs sm:text-sm ${
                  isCurrentUser ? "justify-end" : "justify-start"
                }`}
              >
                {/* Left avatar for AI or other team members */}
                {!isCurrentUser && (
                  <div
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white shadow-xs mt-0.5 ${
                      isAi ? "bg-[#B8944E]" : "bg-slate-700"
                    }`}
                  >
                    {isAi ? <Sparkles size={13} /> : <User size={13} />}
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed ${
                    isCurrentUser
                      ? "bg-[#B8944E] text-white rounded-br-sm shadow-xs"
                      : isAi
                      ? "bg-white border border-[#EBE7F2] text-[#111827] rounded-bl-sm shadow-xs"
                      : "bg-white border border-slate-200 text-[#111827] rounded-bl-sm shadow-xs"
                  }`}
                >
                  {/* Sender Header */}
                  <div className="flex items-center justify-between gap-3 mb-1.5 opacity-75">
                    <p className="text-[10px] font-semibold uppercase tracking-wider">
                      {isCurrentUser
                        ? "You"
                        : isAi
                        ? "AI Thinking Partner"
                        : `${m.user_name} ${m.user_type === "team_user" ? "• Team Member" : ""}`}
                    </p>
                    <span className="text-[10px] opacity-60">
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Message Body */}
                  <div className="whitespace-pre-wrap leading-relaxed">{m.message}</div>

                  {/* AI Response Action: Save Insight */}
                  {isAi && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleSaveInsight(m)}
                        disabled={isSaved || isSaving}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          isSaved
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 cursor-default"
                            : "bg-amber-50 text-[#80642F] border border-amber-200 hover:bg-amber-100/70 cursor-pointer shadow-2xs"
                        }`}
                      >
                        {isSaving ? (
                          <Loader2 size={12} className="animate-spin text-[#80642F]" />
                        ) : isSaved ? (
                          <BookmarkCheck size={13} className="text-emerald-600" />
                        ) : (
                          <Bookmark size={13} className="text-[#80642F]" />
                        )}
                        <span>{isSaved ? "✓ Saved" : "Save Insight"}</span>
                      </button>

                      <span className="text-[10px] text-slate-400 italic">
                        {isSaved ? "Stored in Insights tab" : "Pin finding to research"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right avatar for current user */}
                {isCurrentUser && (
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#353140] text-white shadow-xs mt-0.5">
                    <User size={13} />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Sending / Thinking Indicator */}
        {sending && (
          <div className="flex gap-3 text-xs items-start">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#B8944E] text-white shadow-xs mt-0.5 animate-pulse">
              <Sparkles size={13} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-xs text-slate-600 flex items-center gap-2">
              <Loader2 size={13} className="animate-spin text-[#B8944E]" />
              <span className="text-xs">
                {isAiMode ? "AI Thinking Partner is analyzing your idea..." : "Posting message..."}
              </span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => handleSendMessage()}
              className="font-semibold text-rose-800 hover:underline shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input & Control Bar */}
      <div className="p-3 border-t border-slate-100 bg-white shrink-0 space-y-2">
        {/* Mode Selector Pill */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsAiMode(true)}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                isAiMode
                  ? "bg-amber-100/70 text-[#80642F] border border-amber-300"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Sparkles size={11} />
              <span>Ask AI Partner</span>
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setIsAiMode(false)}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                !isAiMode
                  ? "bg-slate-200 text-slate-800 border border-slate-300"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Users size={11} />
              <span>Team Discussion</span>
            </button>
          </div>

          <span className="text-[10px] text-slate-400 hidden sm:inline">
            {isAiMode ? "Answers ground in this idea" : "Visible to all collaborators"}
          </span>
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <VoiceInput
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              isAiMode
                ? "Ask anything about this idea..."
                : "Share your thoughts with the team..."
            }
            disabled={sending}
            className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-xs sm:text-sm text-[#111827] placeholder:text-slate-400 outline-none transition focus:bg-white focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.2)]"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!inputMessage.trim() || sending}
            isLoading={sending}
            leftIcon={!sending ? <Send size={13} /> : undefined}
          >
            Send
          </Button>
        </form>
      </div>

      {/* New Discussion Modal */}
      {newConvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14121B]/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-[#E2E6EF] bg-white p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-semibold text-[#111827]">New Discussion Workspace</h4>
            <p className="text-xs text-slate-500">
              Create a dedicated discussion (e.g. &ldquo;MVP Planning&rdquo;, &ldquo;Technical Architecture&rdquo;, &ldquo;Competitor Research&rdquo;).
            </p>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Competitor Research"
              value={newConvTitle}
              onChange={(e) => setNewConvTitle(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs sm:text-sm text-[#111827] outline-none focus:border-[#B8944E] focus:bg-white"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setNewConvModal(false)}
                disabled={creatingConv}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateConv}
                isLoading={creatingConv}
                disabled={!newConvTitle.trim() || creatingConv}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
