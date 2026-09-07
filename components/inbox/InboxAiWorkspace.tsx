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
    <div className="flex flex-col h-[640px] rounded-2xl border border-[#E2E6EF] bg-white shadow-card overflow-hidden">
      {/* AI Header */}
      <div className="flex items-center justify-between border-b border-[#E2E6EF] bg-[#F8F9FC] px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#7C3AED] text-white shadow-xs shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-[#111827] truncate">
              AI Thinking Partner
            </h3>
            <p className="text-[11px] text-[#64748B] truncate">
              Contextual brainstorming for &ldquo;{item.title}&rdquo;
            </p>
          </div>
        </div>

        {/* Thread selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowThreadDropdown((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-lg border border-[#E2E6EF] bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            <MessageSquare size={13} className="text-slate-400" />
            <span className="max-w-[110px] truncate">{activeThread?.title || "Conversations"}</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          {showThreadDropdown && (
            <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-[#E2E6EF] bg-white p-1 shadow-dropdown z-30 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                <span>Threads</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowThreadDropdown(false);
                    setNewThreadModal(true);
                  }}
                  className="text-[#4F46E5] hover:underline font-semibold"
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
                        ? "bg-[#EEF2FF] font-semibold text-[#4F46E5]"
                        : "text-slate-700 hover:bg-slate-50"
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {loadingMessages ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400 gap-2">
            <Loader2 size={16} className="animate-spin text-[#4F46E5]" />
            <span>Loading discussion...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col justify-center items-center text-center p-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-[#7C3AED] mb-3">
              <Sparkles size={20} />
            </div>
            <h4 className="text-sm font-semibold text-[#111827]">
              Explore this idea with AI
            </h4>
            <p className="mt-1 text-xs text-[#64748B] max-w-xs leading-relaxed">
              Ask about technical risks, MVP scope, alternatives, or competitor landscapes.
            </p>

            {/* Starter Prompts */}
            <div className="mt-5 w-full max-w-sm space-y-1.5 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Suggested exploration
              </p>
              {STARTER_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  disabled={sending}
                  className="flex w-full items-center justify-between rounded-xl border border-[#E2E6EF] bg-white p-2.5 text-xs font-medium text-slate-700 hover:border-[#4F46E5] hover:text-[#4F46E5] hover:bg-[#EEF2FF]/40 transition group text-left"
                >
                  <span>{prompt}</span>
                  <CornerDownLeft size={12} className="text-slate-300 group-hover:text-[#4F46E5]" />
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
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#7C3AED] text-white shadow-xs mt-0.5">
                    <Sparkles size={13} />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed ${
                    isUser
                      ? "bg-[#4F46E5] text-white rounded-br-sm shadow-xs"
                      : "bg-white border border-[#E2E6EF] text-[#111827] rounded-bl-sm shadow-xs"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 opacity-70">
                    {isUser ? "You" : "StoryBoard AI"}
                  </p>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>

                {isUser && (
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-900 text-white shadow-xs mt-0.5">
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
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#7C3AED] text-white shadow-xs mt-0.5 animate-pulse">
              <Sparkles size={13} />
            </div>
            <div className="rounded-2xl border border-[#E2E6EF] bg-white px-4 py-2.5 shadow-xs text-slate-500 flex items-center gap-2">
              <Loader2 size={13} className="animate-spin text-[#7C3AED]" />
              <span className="text-xs">StoryBoard AI is analyzing your idea...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
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

      {/* Input Bar */}
      <div className="p-3 border-t border-[#E2E6EF] bg-white shrink-0">
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
            className="h-10 flex-1 rounded-xl border border-[#E2E6EF] bg-slate-50/50 px-3.5 text-xs sm:text-sm text-[#111827] outline-none transition focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-[#E2E6EF] bg-white p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-semibold text-[#111827]">New Discussion Thread</h4>
            <p className="text-xs text-[#64748B]">
              Create a focused sub-conversation (e.g. &ldquo;MVP Planning&rdquo;, &ldquo;Technical Architecture&rdquo;).
            </p>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Competitor Research"
              value={newThreadTitle}
              onChange={(e) => setNewThreadTitle(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#E2E6EF] px-3 text-xs sm:text-sm outline-none focus:border-[#4F46E5]"
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
