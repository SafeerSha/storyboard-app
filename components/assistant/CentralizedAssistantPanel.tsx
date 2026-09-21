"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  Mic,
  MicOff,
  Send,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Radio,
  Clock,
  FolderPlus,
  FileText,
  Bookmark,
  Layers,
  Users,
  Compass,
  Volume2,
  VolumeX,
  Loader2,
  Minimize2,
} from "lucide-react";
import { useAssistant, isQuestionText } from "@/hooks/useAssistant";
import type { ActionTaskResult } from "@/lib/ai/assistant-tools";

export function CentralizedAssistantPanel() {
  const {
    isOpen,
    setIsOpen,
    minimizeToFloatingBar,
    isEnabled,
    activityLogs,
    chatMessages,
    isProcessing,
    isSpeaking,
    executeCommand,
    clearActivityLogs,
    voiceFeedbackEnabled,
    setVoiceFeedbackEnabled,
    speakResponse,
    voiceSupported,
    isListening,
    isStandby,
    standbyHeard,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
  } = useAssistant();

  const [inputText, setInputText] = useState("");
  const [activeTab, setActiveTab] = useState<"activity" | "chat">("activity");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  // Sync interim transcript to input box when speaking in panel
  useEffect(() => {
    if (interimTranscript && isListening) {
      setInputText(interimTranscript);
    }
  }, [interimTranscript, isListening]);

  // Google Assistant behavior: automatically start listening ONLY when panel first opens (false -> true)
  useEffect(() => {
    if (isOpen && !wasOpenRef.current && voiceSupported && !isProcessing && !isSpeaking) {
      wasOpenRef.current = true;
      const timer = setTimeout(() => {
        startListening();
      }, 350);
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, voiceSupported, isProcessing, isSpeaking, startListening]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, activityLogs]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isEnabled || !isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    executeCommand(inputText.trim());
    setInputText("");
  };

  const handleQuickPrompt = (prompt: string) => {
    executeCommand(prompt);
  };

  // Helper to get tool icon
  const getToolIcon = (tool: string) => {
    switch (tool) {
      case "create_project":
      case "list_projects":
        return <FolderPlus size={14} className="text-amber-600" />;
      case "create_epic":
      case "list_epics":
        return <Layers size={14} className="text-indigo-600" />;
      case "create_story":
      case "list_stories":
      case "update_story_status":
        return <Bookmark size={14} className="text-emerald-600" />;
      case "create_discussion_note":
      case "list_notes":
        return <FileText size={14} className="text-blue-600" />;
      case "create_inbox_item":
      case "list_inbox":
        return <Sparkles size={14} className="text-purple-600" />;
      case "get_workspace_summary":
        return <Sparkles size={14} className="text-amber-600" />;
      case "invite_team_user":
        return <Users size={14} className="text-teal-600" />;
      case "navigate_to":
        return <Compass size={14} className="text-rose-600" />;
      case "orchestrator":
        return <Bot size={14} className="text-[#80642F]" />;
      case "dialogue":
        return <Bot size={14} className="text-indigo-600" />;
      default:
        return <Bot size={14} className="text-[#80642F]" />;
    }
  };

  const latestAssistantMsg = chatMessages.slice().reverse().find((m) => m.role === "assistant");

  return (
    <aside
      aria-label="Super Admin Centralized Assistant"
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-white/95 backdrop-blur-xl border-l border-[rgba(74,61,100,0.12)] shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[rgba(74,61,100,0.08)] bg-[#FAF9FC]/90 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#B8944E]/20 to-[#80642F]/25 border border-[rgba(184,148,78,0.3)] text-[#80642F]">
            <Bot size={17} />
            {isListening && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs sm:text-sm font-bold text-[#252331] leading-tight">
                AI Central Assistant
              </h3>
              <span className="rounded bg-[rgba(184,148,78,0.12)] px-1.5 py-0.2 text-[9px] font-bold text-[#80642F]">
                Super Admin
              </span>
            </div>
            <p className="text-[10px] text-[#706C7D]">
              {isSpeaking
                ? "Reqly speaking response..."
                : isListening
                  ? "Listening... speak command"
                  : isStandby
                    ? "Standby: say 'Reqly' to wake"
                    : isProcessing
                      ? "Executing ..."
                      : "Voice & command orchestrator"}
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Voice Feedback Toggle */}
          <button
            type="button"
            onClick={() => setVoiceFeedbackEnabled(!voiceFeedbackEnabled)}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${voiceFeedbackEnabled
                ? "bg-[rgba(184,148,78,0.12)] border-[rgba(184,148,78,0.3)] text-[#80642F]"
                : "bg-white border-[rgba(74,61,100,0.10)] text-[#9994A5] hover:text-[#252331]"
              }`}
            title={voiceFeedbackEnabled ? "Voice speech synthesis enabled" : "Enable voice speech synthesis"}
          >
            {voiceFeedbackEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>

          {/* Clear Activity Logs */}
          {activityLogs.length > 0 && (
            <button
              type="button"
              onClick={clearActivityLogs}
              className="p-1.5 rounded-lg border border-[rgba(74,61,100,0.10)] bg-white text-[#9994A5] hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Clear activity log"
            >
              <Trash2 size={13} />
            </button>
          )}

          {/* Minimize to Floating Bar */}
          <button
            type="button"
            onClick={minimizeToFloatingBar}
            className="p-1.5 rounded-lg border border-[rgba(74,61,100,0.10)] bg-white text-[#706C7D] hover:text-[#80642F] hover:bg-amber-50/50 transition cursor-pointer"
            title="Minimize to Floating Bar"
          >
            <Minimize2 size={13} />
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg border border-[rgba(74,61,100,0.10)] bg-white text-[#706C7D] hover:text-[#252331] hover:bg-gray-100 transition cursor-pointer"
            title="Close Assistant Panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tabs Switcher: Action Task Activity Log vs Conversation */}
      <div className="px-4 py-2 border-b border-[rgba(74,61,100,0.06)] bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 bg-[#FAF9FC] p-0.5 rounded-xl border border-[rgba(74,61,100,0.08)] text-[11px] w-full">
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`flex-1 py-1 rounded-lg font-medium transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${activeTab === "activity"
                ? "bg-white text-[#252331] shadow-2xs font-semibold"
                : "text-[#706C7D] hover:text-[#252331]"
              }`}
          >
            <Sparkles size={11} className={activeTab === "activity" ? "text-[#80642F]" : ""} />
            <span>Action Activity Log</span>
            {activityLogs.length > 0 && (
              <span className="rounded-full bg-[rgba(184,148,78,0.15)] text-[#80642F] px-1.5 text-[9px] font-bold">
                {activityLogs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex-1 py-1 rounded-lg font-medium transition cursor-pointer text-center flex items-center justify-center gap-1.5 ${activeTab === "chat"
                ? "bg-white text-[#252331] shadow-2xs font-semibold"
                : "text-[#706C7D] hover:text-[#252331]"
              }`}
          >
            <Bot size={11} className={activeTab === "chat" ? "text-[#80642F]" : ""} />
            <span>Conversation</span>
            {chatMessages.length > 0 && (
              <span className="rounded-full bg-[rgba(74,61,100,0.08)] text-[#706C7D] px-1.5 text-[9px] font-bold">
                {chatMessages.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {/* TAB 1: Live Action Task Activity Log */}
        {activeTab === "activity" && (
          <div className="space-y-3">
            {/* Real-Time Live Assistant Spoken/Text Response Banner (Always visible alongside Activity Log) */}
            {(isProcessing || latestAssistantMsg) && (
              <div className="rounded-2xl border border-[rgba(184,148,78,0.25)] bg-gradient-to-br from-[#FAF9FC] to-[#F7F4EE] p-3.5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="grid h-6 w-6 place-items-center rounded-lg bg-[rgba(184,148,78,0.15)] text-[#80642F] shrink-0 border border-[rgba(184,148,78,0.30)]">
                      <Bot size={13} />
                    </div>
                    <span className="text-xs font-bold text-[#252331]">
                      Reqly Response
                    </span>
                    {isProcessing && (
                      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Loader2 size={10} className="animate-spin text-amber-600" />
                        Replying ...
                      </span>
                    )}
                    {isSpeaking && (
                      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Volume2 size={10} className="animate-pulse text-emerald-600" />
                        Speaking...
                      </span>
                    )}
                    {!isSpeaking && !isProcessing && latestAssistantMsg && isQuestionText(latestAssistantMsg.text) && isListening && (
                      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 animate-pulse">
                        <Mic size={10} className="text-purple-600" />
                        Listening for your answer...
                      </span>
                    )}
                  </div>

                  {latestAssistantMsg && !isProcessing && (
                    <button
                      type="button"
                      onClick={() => {
                        speakResponse(latestAssistantMsg.text, () => {
                          if (isQuestionText(latestAssistantMsg.text)) {
                            setTimeout(() => startListening(), 250);
                          }
                        });
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#80642F] hover:text-[#5E471F] cursor-pointer bg-white/90 px-2 py-0.5 rounded-md border border-[rgba(184,148,78,0.25)] shadow-2xs transition"
                      title="Replay spoken audio"
                    >
                      <Volume2 size={11} />
                      <span>Replay Voice</span>
                    </button>
                  )}
                </div>

                {isProcessing ? (
                  <div className="flex items-center gap-2 text-xs text-[#706C7D] py-1">
                    <div className="flex items-center gap-1 h-3">
                      <span className="w-1 bg-[#B8944E] rounded-full animate-bounce h-2"></span>
                      <span className="w-1 bg-[#80642F] rounded-full animate-bounce delay-150 h-3"></span>
                      <span className="w-1 bg-[#B8944E] rounded-full animate-bounce delay-300 h-2"></span>
                    </div>
                    <span className="text-[11px] text-[#706C7D] italic">
                      Querying live database & orchestrating results...
                    </span>
                  </div>
                ) : (
                  latestAssistantMsg && (
                    <p className="text-xs text-[#252331] leading-relaxed font-normal whitespace-pre-wrap">
                      {latestAssistantMsg.text}
                    </p>
                  )
                )}
              </div>
            )}

            {/* Activity Tasks Section Header */}
            {activityLogs.length > 0 && (
              <div className="flex items-center justify-between pt-1 pb-0.5 px-0.5">
                <span className="text-[10px] font-bold text-[#9994A5] uppercase tracking-wider">
                  Live Action Tasks ({activityLogs.length})
                </span>
                <span className="text-[9px] text-[#B8944E] font-medium flex items-center gap-1">
                  <Radio size={8} className="animate-pulse text-emerald-500" />
                  Realtime Synced
                </span>
              </div>
            )}

            {activityLogs.length === 0 && !isProcessing && !latestAssistantMsg ? (
              <div className="p-8 text-center space-y-3 my-8">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(184,148,78,0.10)] text-[#80642F] mx-auto border border-[rgba(184,148,78,0.20)]">
                  <Sparkles size={20} />
                </div>
                <h4 className="text-xs font-bold text-[#252331]">No Actions Logged Yet</h4>
                <p className="text-[11px] text-[#706C7D] max-w-xs mx-auto">
                  Speak into the mic or type a command below. Every action task executed across your app will appear here with live parameters and links.
                </p>
                <div className="pt-2 flex flex-col gap-1.5 text-[11px] max-w-xs mx-auto text-left">
                  <span className="text-[10px] font-bold text-[#9994A5] uppercase tracking-wider">
                    Try Saying:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuickPrompt("How many projects, stories, or epics do we have?")}
                    className="p-2 rounded-xl border border-[rgba(74,61,100,0.08)] bg-white text-xs text-[#252331] hover:border-[#B8944E] transition text-left cursor-pointer shadow-2xs"
                  >
                    👉 &quot;How many projects, stories, or epics do we have?&quot;
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPrompt("Create a project called Fitness App")}
                    className="p-2 rounded-xl border border-[rgba(74,61,100,0.08)] bg-white text-xs text-[#252331] hover:border-[#B8944E] transition text-left cursor-pointer shadow-2xs"
                  >
                    👉 &quot;Create a project called Fitness App&quot;
                  </button>
                </div>
              </div>
            ) : (
              activityLogs.map((task: ActionTaskResult) => {
                const isSuccess = task.status === "completed";
                const isInProgress = task.status === "in_progress";
                return (
                  <div
                    key={task.id}
                    className={`rounded-xl border p-3 transition shadow-2xs ${isInProgress
                        ? "border-amber-300 bg-amber-50/40 animate-pulse"
                        : isSuccess
                          ? "border-[rgba(74,61,100,0.10)] bg-white hover:border-[rgba(184,148,78,0.3)]"
                          : "border-rose-200 bg-rose-50/50"
                      }`}
                  >
                    {/* Task Title Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="grid h-6 w-6 place-items-center rounded-lg bg-[#FAF9FC] border border-[rgba(74,61,100,0.08)] shrink-0">
                          {getToolIcon(task.tool)}
                        </div>
                        <span className="text-xs font-bold text-[#252331] truncate">
                          {task.title}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[9px] font-bold shrink-0 ${isInProgress
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : isSuccess
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-100 text-rose-700 border border-rose-200"
                          }`}
                      >
                        {isInProgress ? (
                          <>
                            <Loader2 size={10} className="animate-spin text-amber-700" />
                            <span>Processing</span>
                          </>
                        ) : isSuccess ? (
                          <>
                            <CheckCircle2 size={10} />
                            <span>Success</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle size={10} />
                            <span>Failed</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Message / Description */}
                    <p className="text-[11px] text-[#706C7D] mt-1.5 leading-relaxed">
                      {task.message}
                    </p>

                    {/* Parameters Details Preview */}
                    {task.details && Object.keys(task.details).length > 0 && (
                      <div className="mt-2 p-2 rounded-lg bg-[#FAF9FC] border border-[rgba(74,61,100,0.06)] text-[10px] text-[#706C7D] space-y-0.5 font-mono">
                        {Object.entries(task.details).map(([key, val]) => (
                          <div key={key} className="flex items-start gap-1">
                            <span className="text-[#9994A5] font-semibold">{key}:</span>
                            <span className="text-[#252331] truncate">
                              {typeof val === "object" ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Footer Row: Timestamp & Quick Action Link */}
                    <div className="mt-2.5 flex items-center justify-between gap-2 pt-1 border-t border-[rgba(74,61,100,0.05)] text-[10px] text-[#9994A5]">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(task.timestamp).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>

                      {task.quickAction && (
                        <a
                          href={task.quickAction.href}
                          className="inline-flex items-center gap-1 font-semibold text-[#80642F] hover:underline"
                        >
                          <span>{task.quickAction.label}</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: Conversation View */}
        {activeTab === "chat" && (
          <div className="space-y-3">
            {chatMessages.length === 0 ? (
              <div className="p-8 text-center space-y-2 text-[#706C7D]">
                <Bot size={22} className="mx-auto text-[#9994A5]" />
                <p className="text-xs font-semibold text-[#252331]">No messages yet</p>
                <p className="text-[11px]">Speak or type your command below.</p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${isUser
                          ? "bg-[#252331] text-white rounded-br-xs shadow-xs"
                          : "bg-[#FAF9FC] border border-[rgba(74,61,100,0.08)] text-[#252331] rounded-bl-xs shadow-2xs"
                        }`}
                    >
                      <p>{msg.text}</p>
                    </div>
                    <span className="text-[9px] text-[#9994A5] mt-1 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Google Assistant Voice Listening Active Overlay */}
      {isListening && (
        <div className="px-4 py-3 bg-gradient-to-r from-[#FAF9FC] to-[#F5F2EB] border-t border-[rgba(184,148,78,0.25)] flex flex-col gap-2 shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {/* Google Assistant 4 animated colored wave bars */}
              <div className="flex items-center gap-1 h-5">
                <span className="w-1 bg-[#4285F4] rounded-full animate-[bounce_0.8s_infinite_100ms] h-3.5"></span>
                <span className="w-1 bg-[#EA4335] rounded-full animate-[bounce_0.8s_infinite_200ms] h-5"></span>
                <span className="w-1 bg-[#FBBC05] rounded-full animate-[bounce_0.8s_infinite_300ms] h-3"></span>
                <span className="w-1 bg-[#34A853] rounded-full animate-[bounce_0.8s_infinite_400ms] h-4.5"></span>
              </div>
              <div>
                <span className="text-xs font-bold text-[#252331]">
                  {interimTranscript
                    ? "Hearing you..."
                    : latestAssistantMsg && isQuestionText(latestAssistantMsg.text)
                      ? "Reqly asked a question — Listening for your answer..."
                      : "Listening... speak now"}
                </span>
                <p className="text-[10px] text-[#9994A5]">Auto-executes when you pause speaking</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (interimTranscript.trim()) {
                  executeCommand(interimTranscript.trim());
                }
                stopListening();
              }}
              className="px-2.5 py-1 rounded-lg bg-[#252331] text-white text-[10px] font-bold hover:bg-[#3B384A] transition cursor-pointer"
            >
              Send Now
            </button>
          </div>

          {/* Live speech preview */}
          {interimTranscript && (
            <div className="px-3 py-1.5 rounded-lg bg-white border border-[rgba(184,148,78,0.25)] text-xs text-[#252331] font-medium shadow-2xs animate-in fade-in">
              &quot;{interimTranscript}&quot;
            </div>
          )}
        </div>
      )}

      {/* Processing State Banner */}
      {isProcessing && !isListening && !isSpeaking && (
        <div className="px-4 py-2.5 bg-[rgba(184,148,78,0.08)] border-t border-[rgba(184,148,78,0.20)] flex items-center justify-between gap-2 shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B8944E] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#80642F]"></span>
            </span>
            <span className="text-xs font-medium text-[#80642F]">
              Executing ...
            </span>
          </div>
          <Bot size={14} className="text-[#80642F] animate-pulse" />
        </div>
      )}

      {/* Speaking State Banner */}
      {isSpeaking && !isListening && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-[rgba(184,148,78,0.12)] to-[#FAF9FC] border-t border-[rgba(184,148,78,0.25)] flex items-center justify-between gap-2 shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 text-[#80642F]">
              <span className="w-0.5 h-2 bg-[#80642F] rounded-full animate-pulse" />
              <span className="w-0.5 h-3.5 bg-[#80642F] rounded-full animate-pulse [animation-delay:150ms]" />
              <span className="w-0.5 h-2 bg-[#80642F] rounded-full animate-pulse [animation-delay:300ms]" />
            </div>
            <span className="text-xs font-semibold text-[#80642F]">
              Reqly is speaking...
            </span>
          </div>
          <Volume2 size={14} className="text-[#80642F] animate-pulse" />
        </div>
      )}

      {/* Wake Word Standby Ribbon */}
      {isStandby && !isListening && !isProcessing && !isSpeaking && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-amber-50/80 to-[#FAF9FC] border-t border-[rgba(184,148,78,0.25)] flex flex-col gap-1 shrink-0 animate-in fade-in">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="text-xs font-semibold text-[#80642F] truncate">
                Voice Standby — Say &ldquo;Reqly&rdquo; or &ldquo;Assistant&rdquo;
              </span>
            </div>
            <button
              type="button"
              onClick={() => startListening()}
              className="text-[10px] font-bold text-[#80642F] hover:underline cursor-pointer shrink-0"
            >
              Tap to speak
            </button>
          </div>

          {standbyHeard && (
            <div className="text-[10px] text-[#9994A5] truncate pl-4 animate-in fade-in">
              Hearing: <span className="text-[#252331] font-mono font-medium">&ldquo;{standbyHeard}&rdquo;</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom Command & Voice Console */}
      <div className="p-3 sm:p-4 border-t border-[rgba(74,61,100,0.08)] bg-white shrink-0 space-y-2.5">
        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px]">
          <button
            type="button"
            onClick={() => handleQuickPrompt("Create a project called ")}
            className="rounded-full bg-[#FAF9FC] border border-[rgba(74,61,100,0.10)] px-2.5 py-1 text-[#706C7D] hover:text-[#252331] hover:border-[#B8944E] transition whitespace-nowrap cursor-pointer"
          >
            + Create project
          </button>
          <button
            type="button"
            onClick={() => handleQuickPrompt("Add a user story for ")}
            className="rounded-full bg-[#FAF9FC] border border-[rgba(74,61,100,0.10)] px-2.5 py-1 text-[#706C7D] hover:text-[#252331] hover:border-[#B8944E] transition whitespace-nowrap cursor-pointer"
          >
            + Add story
          </button>
          <button
            type="button"
            onClick={() => handleQuickPrompt("Create discussion note")}
            className="rounded-full bg-[#FAF9FC] border border-[rgba(74,61,100,0.10)] px-2.5 py-1 text-[#706C7D] hover:text-[#252331] hover:border-[#B8944E] transition whitespace-nowrap cursor-pointer"
          >
            + Discussion note
          </button>
          <button
            type="button"
            onClick={() => handleQuickPrompt("Give me a workspace summary")}
            className="rounded-full bg-[#FAF9FC] border border-[rgba(74,61,100,0.10)] px-2.5 py-1 text-[#706C7D] hover:text-[#252331] hover:border-[#B8944E] transition whitespace-nowrap cursor-pointer"
          >
            Summary
          </button>
        </div>

        {/* Input Bar Form */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* Microphone Voice Button */}
          <button
            type="button"
            onClick={toggleListening}
            disabled={!voiceSupported || isProcessing}
            aria-label={isListening ? "Stop voice input" : "Speak command"}
            className={`grid h-9 w-9 place-items-center rounded-xl border transition cursor-pointer shrink-0 ${isListening
                ? "bg-rose-500 text-white border-rose-600 shadow-xs ring-2 ring-rose-300 animate-pulse"
                : isStandby
                  ? "bg-[rgba(184,148,78,0.18)] border-[rgba(184,148,78,0.4)] text-[#80642F]"
                  : "bg-[rgba(184,148,78,0.10)] border-[rgba(184,148,78,0.25)] text-[#80642F] hover:bg-[rgba(184,148,78,0.20)]"
              }`}
            title={
              !voiceSupported
                ? "Voice input not supported in this browser"
                : isListening
                  ? "Click to stop listening"
                  : isStandby
                    ? "Standby: say 'Reqly' or click to speak"
                    : "Click and speak your command"
            }
          >
            {isListening ? (
              <Radio size={16} className="animate-spin" />
            ) : !voiceSupported ? (
              <MicOff size={15} />
            ) : (
              <Mic size={16} />
            )}
          </button>

          {/* Text Command Input */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isListening
                  ? "Listening..."
                  : isStandby
                    ? "Say 'Reqly' or type command..."
                    : "Speak or type an app command..."
              }
              disabled={isProcessing}
              className="w-full h-9 pl-3 pr-8 text-xs rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] text-[#252331] outline-none focus:border-[#B8944E] focus:bg-white transition"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="grid h-9 w-9 place-items-center rounded-xl bg-[#252331] text-white hover:bg-[#343144] disabled:opacity-40 transition shrink-0 cursor-pointer"
            title="Send command"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </aside>
  );
}
