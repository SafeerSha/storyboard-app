"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  AlertCircle,
  Bot,
  ChevronDown,
  CornerDownLeft,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import type { ProjectInboxAiMessage, ProjectInboxAiThread, ProjectInboxItem } from "@/lib/types";

interface InboxAiWorkspaceProps {
  item: ProjectInboxItem;
}

const STARTER_PROMPTS = [
  "Is this idea worth building?",
  "What should the MVP include?",
  "Research competitors and existing alternatives",
  "Identify technical risks and architecture choices",
  "Break this into phased milestones",
];

export function InboxAiWorkspace({ item }: InboxAiWorkspaceProps) {
  const [threads, setThreads] = useState<ProjectInboxAiThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ProjectInboxAiMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showThreadDropdown, setShowThreadDropdown] = useState(false);
  const [newThreadModal, setNewThreadModal] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Load threads
  const loadThreads = async () => {
    try {
      const res = await fetch(`/api/inbox/${item.id}/ai/threads`);
      const data = await res.json();
      if (res.ok && data.threads) {
        setThreads(data.threads);
        if (data.threads.length > 0 && !activeThreadId) {
          setActiveThreadId(data.threads[0].id);
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setLoadingThreads(false);
    }
  };

  useEffect(() => {
    loadThreads();
  }, [item.id]);

  // 2. Load messages for active thread
  const loadMessages = async (threadId: string) => {
    setLoadingMessages(true);
    setError("");
    try {
      const res = await fetch(`/api/inbox/${item.id}/ai/threads/${threadId}/messages`);
      const data = await res.json();
      if (res.ok && data.messages) {
        setMessages(data.messages);
      }
    } catch (e: any) {
      setError("Failed to load conversation history.");
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeThreadId) {
      loadMessages(activeThreadId);
    } else {
      setMessages([]);
    }
  }, [activeThreadId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // 3. Create a new thread
  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThreadTitle.trim()) return;

    try {
      const res = await fetch(`/api/inbox/${item.id}/ai/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newThreadTitle.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.thread) {
        setThreads((prev) => [...prev, data.thread]);
        setActiveThreadId(data.thread.id);
        setNewThreadTitle("");
        setNewThreadModal(false);
        toast.success("AI conversation created");
      } else {
        toast.error("Unable to create conversation", { description: data?.error || "Please try again." });
      }
    } catch {
      toast.error("Unable to create conversation", { description: "An unexpected error occurred." });
    }
  };

  // 4. Send message to AI
  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || sending) return;

    // Ensure we have an active thread, or create one on the fly
    let targetThreadId = activeThreadId;
    if (!targetThreadId) {
      try {
        const createRes = await fetch(`/api/inbox/${item.id}/ai/threads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "General Discussion" }),
        });
        const createData = await createRes.json();
        if (createRes.ok && createData.thread) {
          setThreads([createData.thread]);
          setActiveThreadId(createData.thread.id);
          targetThreadId = createData.thread.id;
        } else {
          setError("Could not create conversation thread.");
          toast.error("Unable to create conversation thread");
          return;
        }
      } catch {
        setError("Could not create conversation thread.");
        toast.error("Unable to create conversation thread");
        return;
      }
    }

    if (!targetThreadId) {
      setError("No active discussion thread.");
      return;
    }

    const currentThreadId = targetThreadId;
    setInputPrompt("");
    setSending(true);
    setError("");

    // Optimistic user message in UI
    const tempUserMsg: ProjectInboxAiMessage = {
      id: `temp-${Date.now()}`,
      thread_id: currentThreadId,
      role: "user",
      content: prompt,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/inbox/${item.id}/ai/threads/${currentThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: prompt }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "AI could not respond right now.");
      }

      // Replace temp message with server response and append assistant message
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        data.userMessage,
        data.assistantMessage,
      ]);
    } catch (err: any) {
      const msg = err.message || "AI could not respond right now.";
      setError(msg);
      toast.error("Unable to generate response", { description: msg });
    } finally {
      setSending(false);
    }
  };

  const activeThread = threads.find((t) => t.id === activeThreadId);

  return (
    <div className="flex flex-col h-[640px] rounded-2xl border border-[#EBE7F2] bg-[#FAF9FC]/88 shadow-glass-elevated backdrop-blur-[20px] overflow-hidden">
      {/* AI Header */}
      <div className="flex items-center justify-between border-b border-[#EBE7F2] bg-white/60 px-4 py-3 shrink-0">
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

        {/* Thread selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowThreadDropdown((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-lg border border-[#EBE7F2] bg-white px-2.5 py-1 text-xs font-medium text-[#4D4959] hover:bg-[#FAF9FC] transition shadow-xs"
          >
            <MessageSquare size={13} className="text-[#9994A5]" />
            <span className="max-w-[110px] truncate">{activeThread?.title || "Conversations"}</span>
            <ChevronDown size={12} className="text-[#9994A5]" />
          </button>

          {showThreadDropdown && (
            <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-[#EBE7F2] bg-[#FAF9FC]/95 p-1 shadow-dropdown backdrop-blur-xl z-30 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9994A5] border-b border-[#EBE7F2] flex items-center justify-between">
                <span>Threads</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowThreadDropdown(false);
                    setNewThreadModal(true);
                  }}
                  className="text-[#80642F] hover:underline font-semibold"
                >
                  + New
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto py-1">
                {threads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveThreadId(t.id);
                      setShowThreadDropdown(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition ${
                      t.id === activeThreadId
                        ? "bg-[rgba(184,148,78,0.09)] font-semibold text-[#80642F]"
                        : "text-[#353140] hover:bg-white"
                    }`}
                  >
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-transparent">
        {loadingMessages ? (
          <div className="flex h-full items-center justify-center text-xs text-[#9994A5] gap-2">
            <Loader2 size={16} className="animate-spin text-[#B8944E]" />
            <span>Loading discussion...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col justify-center items-center text-center p-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[rgba(184,148,78,0.10)] text-[#B8944E] mb-3">
              <Sparkles size={20} />
            </div>
            <h4 className="text-sm font-semibold text-[#252331]">
              Explore this idea with AI
            </h4>
            <p className="mt-1 text-xs text-[#706C7D] max-w-xs leading-relaxed">
              Ask about technical risks, MVP scope, alternatives, or competitor landscapes.
            </p>

            {/* Starter Prompts */}
            <div className="mt-5 w-full max-w-sm space-y-1.5 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9994A5] mb-1">
                Suggested exploration
              </p>
              {STARTER_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  disabled={sending}
                  className="flex w-full items-center justify-between rounded-xl border border-[#EBE7F2] bg-white/90 p-2.5 text-xs font-medium text-[#353140] hover:border-[#B8944E] hover:text-[#80642F] hover:bg-[#FAF9FC] transition group text-left shadow-xs"
                >
                  <span>{prompt}</span>
                  <CornerDownLeft size={12} className="text-[#9994A5] group-hover:text-[#80642F]" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex gap-3 text-xs sm:text-sm ${
                  isUser ? "justify-end" : "justify-start"
                }`}
              >
                {!isUser && (
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#B8944E] text-white shadow-xs mt-0.5">
                    <Sparkles size={13} />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed ${
                    isUser
                      ? "bg-[#B8944E] text-white rounded-br-sm shadow-xs"
                      : "bg-white border border-[#EBE7F2] text-[#252331] rounded-bl-sm shadow-xs"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 opacity-70">
                    {isUser ? "You" : "StoryBoard AI"}
                  </p>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>

                {isUser && (
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#353140] text-white shadow-xs mt-0.5">
                    <User size={13} />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Thinking Indicator */}
        {sending && (
          <div className="flex gap-3 text-xs items-start">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#B8944E] text-white shadow-xs mt-0.5 animate-pulse">
              <Sparkles size={13} />
            </div>
            <div className="rounded-2xl border border-[#EBE7F2] bg-white px-4 py-2.5 shadow-xs text-[#706C7D] flex items-center gap-2">
              <Loader2 size={13} className="animate-spin text-[#B8944E]" />
              <span className="text-xs">StoryBoard AI is analyzing your idea...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-[#C25D72] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => handleSendMessage()}
              className="font-semibold text-[#A84358] hover:underline shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-[#EBE7F2] bg-white/70 backdrop-blur-md shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Ask anything about this idea..."
            disabled={sending}
            className="h-10 flex-1 rounded-xl border border-[#EBE7F2] bg-[#FAF9FC] px-3.5 text-xs sm:text-sm text-[#252331] placeholder:text-[#9994A5] outline-none transition focus:bg-white focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!inputPrompt.trim() || sending}
            isLoading={sending}
          >
            Send
          </Button>
        </form>
      </div>

      {/* New Thread Modal */}
      {newThreadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14121B]/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[#EBE7F2] bg-[#FAF9FC] p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-semibold text-[#252331]">New Discussion Thread</h4>
            <p className="text-xs text-[#706C7D]">
              Create a focused sub-conversation (e.g. &ldquo;MVP Planning&rdquo;, &ldquo;Technical Architecture&rdquo;).
            </p>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Competitor Research"
              value={newThreadTitle}
              onChange={(e) => setNewThreadTitle(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#EBE7F2] bg-white px-3 text-xs sm:text-sm text-[#252331] outline-none focus:border-[#B8944E]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setNewThreadModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateThread}
                disabled={!newThreadTitle.trim()}
              >
                Create Thread
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
