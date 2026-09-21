"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ActionTaskResult } from "@/lib/ai/assistant-tools";
import { toast } from "@/lib/toast";
import { useVoiceInput } from "@/hooks/useVoiceInput";

export interface AssistantChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  tasks?: ActionTaskResult[];
}

/**
 * Determines whether the assistant's response ends in a question directed to the user.
 */
export function isQuestionText(text: string): boolean {
  if (!text) return false;
  const clean = text.replace(/[*#_`]/g, "").trim();
  // Check if text ends with a question mark (with optional trailing quotes/brackets)
  if (/\?['"”’\)]*\s*$/.test(clean)) return true;
  // Check if last sentence contains a question mark
  const sentences = clean.split(/[.!\n]+/).filter(Boolean);
  const lastSentence = sentences[sentences.length - 1]?.trim() || "";
  return lastSentence.includes("?");
}

interface AssistantContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  isFloatingBarVisible: boolean;
  setIsFloatingBarVisible: (visible: boolean) => void;
  floatingText: string;
  setFloatingText: (text: string) => void;
  floatingStatus: "idle" | "listening" | "processing" | "speaking";
  setFloatingStatus: (status: "idle" | "listening" | "processing" | "speaking") => void;
  openFloatingBar: (initialText?: string) => void;
  closeFloatingBar: () => void;
  minimizeToFloatingBar: () => void;
  expandToDrawer: () => void;
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  voiceFeedbackEnabled: boolean;
  setVoiceFeedbackEnabled: (enabled: boolean) => void;
  activityLogs: ActionTaskResult[];
  chatMessages: AssistantChatMessage[];
  isProcessing: boolean;
  isSpeaking: boolean;
  autoListenRequestId: string | null;
  triggerVoiceAutoListen: () => void;
  executeCommand: (command: string) => Promise<void>;
  clearActivityLogs: () => void;
  clearChat: () => void;
  speakResponse: (text: string, onEnd?: () => void) => void;
  voiceSupported: boolean;
  isListening: boolean;
  isStandby: boolean;
  standbyHeard: string;
  interimTranscript: string;
  startListening: (initialTranscript?: string) => void;
  stopListening: () => void;
  toggleListening: () => void;
  startStandby: () => void;
}

const AssistantContext = createContext<AssistantContextType | null>(null);

const STORAGE_KEY_ENABLED = "storyboard:assistant:enabled";
const STORAGE_KEY_VOICE_FEEDBACK = "storyboard:assistant:voice-feedback";
const STORAGE_KEY_LOGS = "storyboard:assistant:activity-logs";

export function AssistantProvider({
  children,
  isSuperAdmin = false,
}: {
  children: React.ReactNode;
  isSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isFloatingBarVisible, setIsFloatingBarVisible] = useState(false);
  const [floatingText, setFloatingText] = useState("Reqly ready for commands.");
  const [floatingStatus, setFloatingStatus] = useState<"idle" | "listening" | "processing" | "speaking">("idle");
  const [isEnabled, setIsEnabledState] = useState(true);
  const [voiceFeedbackEnabled, setVoiceFeedbackState] = useState(true);
  const [activityLogs, setActivityLogs] = useState<ActionTaskResult[]>([]);
  const [chatMessages, setChatMessages] = useState<AssistantChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoListenRequestId, setAutoListenRequestId] = useState<string | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const executeCommandRef = useRef<(cmd: string) => Promise<void>>(async () => {});
  const lastHandledReqIdRef = useRef<string | null>(null);

  // Persistent global voice recognition across the entire app for Super Admin
  const {
    isSupported: voiceSupported,
    isListening,
    isStandby,
    standbyHeard,
    interimTranscript,
    startListening,
    startStandby,
    stopListening,
    stopAll: stopAllVoice,
    toggleListening,
  } = useVoiceInput({
    autoStopAfterSilenceMs: 1400,
    enableWakeWordStandby: true,
    isPaused: isProcessing || isSpeaking,
    onTranscript: () => {},
    onSpeechComplete: (finalText) => {
      const clean = finalText.trim();
      if (clean) {
        executeCommandRef.current?.(clean);
      }
    },
    onWakeWordDetected: (remainder) => {
      // Calling "Reqly" or "Hey Reqly" from ANYWHERE across the app!
      setIsFloatingBarVisible(true);
      if (remainder && remainder.trim()) {
        executeCommandRef.current?.(remainder.trim());
      }
    },
  });

  // Persistent background wake-word listener: active across ALL pages in StoryBoard for Super Admin
  useEffect(() => {
    if (isSuperAdmin && isEnabled && voiceSupported && !isSpeaking && !isProcessing && !isListening) {
      const timer = setTimeout(() => {
        startStandby();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isSuperAdmin, isEnabled, voiceSupported, isSpeaking, isProcessing, isListening, startStandby]);

  // Pause microphone while assistant is speaking or processing so it never self-transcribes
  useEffect(() => {
    if (isSpeaking || isProcessing) {
      stopAllVoice();
    }
  }, [isSpeaking, isProcessing, stopAllVoice]);

  // Google Assistant auto-reply: when assistant asks a question and finishes speaking, auto-enable mic ONCE
  useEffect(() => {
    if (
      autoListenRequestId &&
      autoListenRequestId !== lastHandledReqIdRef.current &&
      voiceSupported &&
      !isProcessing &&
      !isSpeaking
    ) {
      lastHandledReqIdRef.current = autoListenRequestId;
      const timer = setTimeout(() => {
        startListening();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [autoListenRequestId, voiceSupported, isProcessing, isSpeaking, startListening]);

  const triggerVoiceAutoListen = useCallback(() => {
    setAutoListenRequestId(crypto.randomUUID());
  }, []);

  const openFloatingBar = useCallback((initialText?: string) => {
    if (initialText) setFloatingText(initialText);
    setIsFloatingBarVisible(true);
    setIsOpen(false);
  }, []);

  const closeFloatingBar = useCallback(() => {
    setIsFloatingBarVisible(false);
  }, []);

  const minimizeToFloatingBar = useCallback(() => {
    setIsOpen(false);
    setIsFloatingBarVisible(true);
  }, []);

  const expandToDrawer = useCallback(() => {
    setIsFloatingBarVisible(false);
    setIsOpen(true);
  }, []);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED);
      if (savedEnabled !== null) setIsEnabledState(savedEnabled === "true");

      const savedVoice = localStorage.getItem(STORAGE_KEY_VOICE_FEEDBACK);
      if (savedVoice !== null) setVoiceFeedbackState(savedVoice === "true");
      else setVoiceFeedbackState(true);

      const savedLogs = localStorage.getItem(STORAGE_KEY_LOGS);
      if (savedLogs) {
        const parsed = JSON.parse(savedLogs);
        if (Array.isArray(parsed)) setActivityLogs(parsed.slice(0, 50));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Update enabled state with persistence
  const setIsEnabled = useCallback((enabled: boolean) => {
    setIsEnabledState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
      if (!enabled) setIsOpen(false);
    } catch {}
  }, []);

  // Update voice feedback state with persistence
  const setVoiceFeedbackEnabled = useCallback((enabled: boolean) => {
    setVoiceFeedbackState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY_VOICE_FEEDBACK, String(enabled));
    } catch {}
  }, []);

  const toggleOpen = useCallback(() => {
    if (!isEnabled) {
      toast.info("Assistant is currently disabled in Settings.");
      return;
    }
    setIsOpen((prev) => !prev);
  }, [isEnabled]);

  // Voice speech synthesis helper with onEnd completion callback
  const speakResponse = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!voiceFeedbackEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
        onEnd?.();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[*#_`]/g, "").trim();
        if (!cleanText) {
          onEnd?.();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        currentUtteranceRef.current = utterance;

        let finished = false;
        const handleEnd = () => {
          if (!finished) {
            finished = true;
            currentUtteranceRef.current = null;
            // Delay 400ms so laptop speaker sound reverberation in the room dissipates
            // completely before speech recognition standby is permitted to turn back on!
            setTimeout(() => {
              setIsSpeaking(false);
              onEnd?.();
            }, 400);
          }
        };

        utterance.onend = handleEnd;
        utterance.onerror = handleEnd;

        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);

        // Fallback timer in case browser drops speech onend
        const words = cleanText.split(/\s+/).length;
        const maxExpectedMs = Math.max(2000, (words / 2.0) * 1000 + 1500);
        setTimeout(() => {
          if (!finished && currentUtteranceRef.current === utterance) {
            handleEnd();
          }
        }, maxExpectedMs);
      } catch {
        setIsSpeaking(false);
        onEnd?.();
      }
    },
    [voiceFeedbackEnabled]
  );

  // Execute a command
  const executeCommand = useCallback(
    async (commandText: string) => {
      const text = commandText.trim();
      if (!text || isProcessing) return;

      // Always cancel any prior auto-listen and stop voice input immediately so mic doesn't capture background noise
      setAutoListenRequestId(null);
      stopAllVoice();

      const userMsgId = crypto.randomUUID();
      const userMsg: AssistantChatMessage = {
        id: userMsgId,
        role: "user",
        text,
        timestamp: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);
      setFloatingStatus("processing");
      setFloatingText(`Reqly thinking: "${text.length > 40 ? text.slice(0, 38) + "..." : text}"`);

      // Real-time optimistic task in Activity Log
      const pendingTaskId = "pending-" + Date.now();
      const pendingTask: ActionTaskResult = {
        id: pendingTaskId,
        title: `Executing: "${text.length > 36 ? text.slice(0, 33) + "..." : text}"`,
        tool: "orchestrator",
        status: "in_progress",
        message: "Fetching live workspace records and executing action...",
        timestamp: new Date().toISOString(),
      };
      setActivityLogs((prev) => [pendingTask, ...prev]);

      // Extract recent history for conversational memory
      const history = chatMessages.slice(-6).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      try {
        const res = await fetch("/api/assistant/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: text, history }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to execute command.");
        }

        const data = await res.json();
        const rawTasks: ActionTaskResult[] = data.actionTasks || [];

        // If no explicit action tasks were returned (e.g. conversational banter),
        // log a completed dialogue task so the activity log stays updated in real-time
        const finalTasks: ActionTaskResult[] =
          rawTasks.length > 0
            ? rawTasks
            : [
                {
                  id: crypto.randomUUID(),
                  title: `Reqly: "${text.length > 36 ? text.slice(0, 33) + "..." : text}"`,
                  tool: "dialogue",
                  status: "completed",
                  message: data.responseMessage || "Responded to dialogue.",
                  timestamp: new Date().toISOString(),
                },
              ];

        // Replace pending task with the real-time executed tasks
        setActivityLogs((prev) => {
          const withoutPending = prev.filter((t) => t.id !== pendingTaskId);
          const updated = [...finalTasks, ...withoutPending].slice(0, 50);
          try {
            localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        const assistantMsg: AssistantChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: data.responseMessage || "Done.",
          timestamp: new Date().toISOString(),
          tasks: finalTasks,
        };

        setChatMessages((prev) => [...prev, assistantMsg]);

        // Check if navigation was executed
        const navTask = finalTasks.find((t) => t.tool === "navigate_to" && t.status === "completed");
        const hasNavigated = Boolean(navTask?.quickAction?.href);

        // Check if the assistant ended with a question to the user (STRICTLY FALSE when navigating)
        const hasQuestion = !hasNavigated && isQuestionText(data.responseMessage || "");

        // When navigation happens: navigate immediately and switch to floating mode
        if (hasNavigated && navTask?.quickAction?.href) {
          const targetHref = navTask.quickAction.href;
          const targetLabel = navTask.details?.label || "Team Members";

          // Client-side Next.js route transition
          router.push(targetHref);
          toast.success(`Navigating to ${targetLabel}...`);

          // Seamless transition: close bulky drawer and activate sleek floating mode
          setIsOpen(false);
          setIsFloatingBarVisible(true);
          setFloatingText(data.responseMessage || `Taking you to ${targetLabel} now.`);
        } else {
          setFloatingText(data.responseMessage || "Done.");
        }

        // Speak aloud if voice feedback is on
        if (data.responseMessage && voiceFeedbackEnabled) {
          setFloatingStatus("speaking");
          speakResponse(data.responseMessage, () => {
            setIsProcessing(false);
            setFloatingStatus("idle");
            if (hasQuestion) {
              triggerVoiceAutoListen();
              setFloatingStatus("listening");
            }
          });
        } else {
          setIsProcessing(false);
          setFloatingStatus("idle");
          if (hasQuestion) {
            setTimeout(() => {
              triggerVoiceAutoListen();
              setFloatingStatus("listening");
            }, 700);
          }
        }
      } catch (err: any) {
        setIsProcessing(false);
        toast.error(err.message || "Command failed");
        setFloatingStatus("idle");
        setFloatingText(`Error: ${err.message || "Failed to process instruction."}`);

        // Mark pending task as failed
        setActivityLogs((prev) =>
          prev.map((t) =>
            t.id === pendingTaskId
              ? {
                  ...t,
                  status: "failed",
                  message: err.message || "Failed to execute command.",
                }
              : t
          )
        );

        const errorMsg: AssistantChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `⚠️ Error: ${err.message || "Failed to process instruction."}`,
          timestamp: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, errorMsg]);
      }
    },
    [chatMessages, isProcessing, router, speakResponse, triggerVoiceAutoListen, voiceFeedbackEnabled, stopAllVoice]
  );

  // Keep ref up to date for useVoiceInput
  executeCommandRef.current = executeCommand;

  const clearActivityLogs = useCallback(() => {
    setActivityLogs([]);
    try {
      localStorage.removeItem(STORAGE_KEY_LOGS);
    } catch {}
  }, []);

  const clearChat = useCallback(() => {
    setChatMessages([]);
  }, []);

  // Only provide functional context if user is Super Admin
  if (!isSuperAdmin) {
    return (
      <AssistantContext.Provider
        value={{
          isOpen: false,
          setIsOpen: () => {},
          toggleOpen: () => {},
          isFloatingBarVisible: false,
          setIsFloatingBarVisible: () => {},
          floatingText: "",
          setFloatingText: () => {},
          floatingStatus: "idle",
          setFloatingStatus: () => {},
          openFloatingBar: () => {},
          closeFloatingBar: () => {},
          minimizeToFloatingBar: () => {},
          expandToDrawer: () => {},
          isEnabled: false,
          setIsEnabled: () => {},
          voiceFeedbackEnabled: false,
          setVoiceFeedbackEnabled: () => {},
          activityLogs: [],
          chatMessages: [],
          isProcessing: false,
          isSpeaking: false,
          autoListenRequestId: null,
          triggerVoiceAutoListen: () => {},
          executeCommand: async () => {},
          clearActivityLogs: () => {},
          clearChat: () => {},
          speakResponse: () => {},
          voiceSupported: false,
          isListening: false,
          isStandby: false,
          standbyHeard: "",
          interimTranscript: "",
          startListening: () => {},
          stopListening: () => {},
          toggleListening: () => {},
          startStandby: () => {},
        }}
      >
        {children}
      </AssistantContext.Provider>
    );
  }

  return (
    <AssistantContext.Provider
      value={{
        isOpen,
        setIsOpen,
        toggleOpen,
        isFloatingBarVisible,
        setIsFloatingBarVisible,
        floatingText,
        setFloatingText,
        floatingStatus,
        setFloatingStatus,
        openFloatingBar,
        closeFloatingBar,
        minimizeToFloatingBar,
        expandToDrawer,
        isEnabled,
        setIsEnabled,
        voiceFeedbackEnabled,
        setVoiceFeedbackEnabled,
        activityLogs,
        chatMessages,
        isProcessing,
        isSpeaking,
        autoListenRequestId,
        triggerVoiceAutoListen,
        executeCommand,
        clearActivityLogs,
        clearChat,
        speakResponse,
        voiceSupported,
        isListening,
        isStandby,
        standbyHeard,
        interimTranscript,
        startListening,
        stopListening,
        toggleListening,
        startStandby,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

const defaultAssistantContext: AssistantContextType = {
  isOpen: false,
  setIsOpen: () => {},
  toggleOpen: () => {},
  isFloatingBarVisible: false,
  setIsFloatingBarVisible: () => {},
  floatingText: "",
  setFloatingText: () => {},
  floatingStatus: "idle",
  setFloatingStatus: () => {},
  openFloatingBar: () => {},
  closeFloatingBar: () => {},
  minimizeToFloatingBar: () => {},
  expandToDrawer: () => {},
  isEnabled: false,
  setIsEnabled: () => {},
  voiceFeedbackEnabled: false,
  setVoiceFeedbackEnabled: () => {},
  activityLogs: [],
  chatMessages: [],
  isProcessing: false,
  isSpeaking: false,
  autoListenRequestId: null,
  triggerVoiceAutoListen: () => {},
  executeCommand: async () => {},
  clearActivityLogs: () => {},
  clearChat: () => {},
  speakResponse: () => {},
  voiceSupported: false,
  isListening: false,
  isStandby: false,
  standbyHeard: "",
  interimTranscript: "",
  startListening: () => {},
  stopListening: () => {},
  toggleListening: () => {},
  startStandby: () => {},
};

export function useAssistant() {
  const context = useContext(AssistantContext);
  return context || defaultAssistantContext;
}
