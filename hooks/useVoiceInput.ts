"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "@/lib/toast";
import { playWakeChime } from "@/lib/audio-chime";
import { matchWakeWord } from "@/lib/wake-word";

// SpeechRecognition type definitions for cross-browser Web Speech API
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onspeechend?: ((this: ISpeechRecognition, ev: Event) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

// Global active recognition tracker to ensure only one microphone records at any time across the app
let activeGlobalRecognition: ISpeechRecognition | null = null;
let stopGlobalActive: (() => void) | null = null;

export interface UseVoiceInputOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onSpeechComplete?: (finalText: string) => void;
  onWakeWordDetected?: (remainderText?: string) => void;
  autoStopAfterSilenceMs?: number;
  enableWakeWordStandby?: boolean;
  lang?: string;
  isPaused?: boolean;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const defaultLang =
    typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";

  const {
    onTranscript,
    onSpeechComplete,
    onWakeWordDetected,
    autoStopAfterSilenceMs = 1400,
    enableWakeWordStandby = true,
    lang = defaultLang,
    isPaused = false,
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isStandby, setIsStandby] = useState(false);
  const [standbyHeard, setStandbyHeard] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const modeRef = useRef<"idle" | "active" | "standby">("idle");
  const isStoppingRef = useRef(false);
  const isPausedRef = useRef(Boolean(isPaused));
  isPausedRef.current = Boolean(isPaused);

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const onSpeechCompleteRef = useRef(onSpeechComplete);
  onSpeechCompleteRef.current = onSpeechComplete;

  const onWakeWordDetectedRef = useRef(onWakeWordDetected);
  onWakeWordDetectedRef.current = onWakeWordDetected;

  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const standbyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const clearStandbyHeardTimerRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTextRef = useRef<string>("");
  const hasDispatchedRef = useRef<boolean>(false);

  // Feature detection on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const Win = window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };
      const hasSpeech = Boolean(Win.SpeechRecognition || Win.webkitSpeechRecognition);
      setIsSupported(hasSpeech);
    }
  }, []);

  const stopAll = useCallback(() => {
    isStoppingRef.current = true;
    modeRef.current = "idle";

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (standbyTimerRef.current) {
      clearTimeout(standbyTimerRef.current);
      standbyTimerRef.current = null;
    }
    if (clearStandbyHeardTimerRef.current) {
      clearTimeout(clearStandbyHeardTimerRef.current);
      clearStandbyHeardTimerRef.current = null;
    }

    const instance = recognitionRef.current;
    if (instance) {
      try {
        instance.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (activeGlobalRecognition === instance) {
      activeGlobalRecognition = null;
      stopGlobalActive = null;
    }

    setIsListening(false);
    setIsStandby(false);
    setStandbyHeard("");
    setInterimTranscript("");
  }, []);

  // Auto-stop everything when paused (e.g. while AI is speaking or executing)
  useEffect(() => {
    if (isPaused) {
      stopAll();
    }
  }, [isPaused, stopAll]);

  const startStandby = useCallback(() => {
    if (typeof window === "undefined" || !enableWakeWordStandby || isPausedRef.current) return;
    isStoppingRef.current = false;

    // If browser speech synthesis is currently speaking, wait for it to finish
    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      window.speechSynthesis.speaking
    ) {
      if (standbyTimerRef.current) clearTimeout(standbyTimerRef.current);
      standbyTimerRef.current = setTimeout(() => {
        if (!isStoppingRef.current && modeRef.current !== "active" && !isPausedRef.current) {
          startStandby();
        }
      }, 700);
      return;
    }

    const Win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechConstructor = Win.SpeechRecognition || Win.webkitSpeechRecognition;
    if (!SpeechConstructor) return;

    // Stop active if running
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;
      recognition.maxAlternatives = 5; // Collect top 5 phonetic candidates

      modeRef.current = "standby";
      isStoppingRef.current = false;

      recognition.onstart = () => {
        setIsStandby(true);
        setIsListening(false);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Discard if paused or if browser is actively synthesizing voice
        if (
          isPausedRef.current ||
          (typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking)
        ) {
          return;
        }

        let primaryText = "";
        let matchedResult: {
          matched: boolean;
          wakeWordMatched?: string;
          remainder: string;
        } | null = null;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const best = res[0]?.transcript || "";
          primaryText += best + " ";

          // Test primary and all phonetic alternatives returned by the engine
          for (let alt = 0; alt < res.length; ++alt) {
            const candidate = res[alt].transcript;
            const match = matchWakeWord(candidate);
            if (match.matched) {
              matchedResult = match;
              break;
            }
          }
          if (matchedResult) break;
        }

        const heardSnippet = primaryText.trim();
        if (heardSnippet) {
          setStandbyHeard(heardSnippet);
          if (clearStandbyHeardTimerRef.current) clearTimeout(clearStandbyHeardTimerRef.current);
          clearStandbyHeardTimerRef.current = setTimeout(() => {
            setStandbyHeard("");
          }, 2000);
        }

        // Also test the full accumulated string
        if (!matchedResult) {
          const fullMatch = matchWakeWord(primaryText);
          if (fullMatch.matched) matchedResult = fullMatch;
        }

        // Trigger wake chime and start listening!
        if (matchedResult && matchedResult.matched) {
          playWakeChime();
          const remainder = matchedResult.remainder;

          try {
            recognition.abort();
          } catch {}
          setIsStandby(false);
          setStandbyHeard("");

          onWakeWordDetectedRef.current?.(remainder);
          startListening(remainder);
        }
      };

      recognition.onerror = () => {
        setIsStandby(false);
      };

      recognition.onend = () => {
        setIsStandby(false);
        // Seamlessly restart standby listener unless user intentionally stopped or switched to active or is paused
        if (modeRef.current === "standby" && !isStoppingRef.current && !isPausedRef.current) {
          if (standbyTimerRef.current) clearTimeout(standbyTimerRef.current);
          standbyTimerRef.current = setTimeout(() => {
            if (modeRef.current === "standby" && !isStoppingRef.current && !isPausedRef.current) {
              startStandby();
            }
          }, 350);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      activeGlobalRecognition = recognition;
      stopGlobalActive = stopAll;
    } catch {
      setIsStandby(false);
    }
  }, [enableWakeWordStandby, lang, stopAll]);

  const startListening = useCallback(
    (initialTranscript?: string) => {
      if (typeof window === "undefined" || isPausedRef.current) return;

      const Win = window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };
      const SpeechConstructor = Win.SpeechRecognition || Win.webkitSpeechRecognition;

      if (!SpeechConstructor) {
        toast.warning("Voice input isn't available in this browser.", {
          description: "Please try Chrome, Edge, or Safari for native speech recognition.",
        });
        return;
      }

      if (standbyTimerRef.current) {
        clearTimeout(standbyTimerRef.current);
        standbyTimerRef.current = null;
      }

      // Stop any existing recognition session across the app
      if (stopGlobalActive && stopGlobalActive !== stopAll) {
        stopGlobalActive();
      }

      // Stop current if running
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }

      try {
        const recognition = new SpeechConstructor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang;
        recognition.maxAlternatives = 3;

        modeRef.current = "active";
        isStoppingRef.current = false;
        hasDispatchedRef.current = false;
        accumulatedTextRef.current = initialTranscript || "";

        recognition.onstart = () => {
          setIsListening(true);
          setIsStandby(false);
          setStandbyHeard("");
          setInterimTranscript(initialTranscript || "");

          if (initialTranscript && autoStopAfterSilenceMs) {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (!hasDispatchedRef.current && accumulatedTextRef.current.trim()) {
                hasDispatchedRef.current = true;
                const textToDispatch = accumulatedTextRef.current.trim();
                stopListeningAndEnterStandby();
                onSpeechCompleteRef.current?.(textToDispatch);
              }
            }, autoStopAfterSilenceMs);
          }
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let finalWords = "";
          let interimWords = "";

          for (let i = 0; i < event.results.length; ++i) {
            const result = event.results[i];
            if (result.isFinal) {
              finalWords += result[0].transcript + " ";
            } else {
              interimWords += result[0].transcript;
            }
          }

          const fullSpoken = (finalWords + interimWords).trim();
          accumulatedTextRef.current = fullSpoken;

          if (fullSpoken) {
            setInterimTranscript(fullSpoken);
            onTranscriptRef.current?.(fullSpoken, false);

            // Reset silence timer on every spoken syllable
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

            if (autoStopAfterSilenceMs && autoStopAfterSilenceMs > 0) {
              silenceTimerRef.current = setTimeout(() => {
                if (!hasDispatchedRef.current && accumulatedTextRef.current.trim()) {
                  hasDispatchedRef.current = true;
                  const textToDispatch = accumulatedTextRef.current.trim();
                  stopListeningAndEnterStandby();
                  onSpeechCompleteRef.current?.(textToDispatch);
                }
              }, autoStopAfterSilenceMs);
            }
          }
        };

        // Native browser speech silence detector
        recognition.onspeechend = () => {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (!hasDispatchedRef.current && accumulatedTextRef.current.trim()) {
              hasDispatchedRef.current = true;
              const textToDispatch = accumulatedTextRef.current.trim();
              stopListeningAndEnterStandby();
              onSpeechCompleteRef.current?.(textToDispatch);
            }
          }, 700);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (isStoppingRef.current) return;

          switch (event.error) {
            case "not-allowed":
            case "service-not-allowed":
              toast.error("Microphone permission was denied.", {
                description:
                  "Please allow microphone access in your browser settings to use voice input.",
              });
              break;
            case "audio-capture":
              toast.error("No microphone detected.", {
                description:
                  "Please ensure a working microphone is connected to your device.",
              });
              break;
            case "network":
              toast.error("Speech recognition network error.", {
                description:
                  "Please check your internet connection and try again.",
              });
              break;
            case "no-speech":
              break;
            case "aborted":
              break;
            default:
              toast.error("Something went wrong while listening.", {
                description: "Please try speaking again or type directly.",
              });
              break;
          }

          setIsListening(false);
          setInterimTranscript("");
          // Re-enter standby on error if enabled
          if (enableWakeWordStandby && !isStoppingRef.current) {
            startStandby();
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          setInterimTranscript("");
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          if (activeGlobalRecognition === recognition) {
            activeGlobalRecognition = null;
            stopGlobalActive = null;
          }
          if (
            !hasDispatchedRef.current &&
            accumulatedTextRef.current.trim() &&
            !isStoppingRef.current
          ) {
            hasDispatchedRef.current = true;
            const textToDispatch = accumulatedTextRef.current.trim();
            onSpeechCompleteRef.current?.(textToDispatch);
          }

          // Automatically return to standby wake word mode when active listening ends
          if (
            enableWakeWordStandby &&
            !isStoppingRef.current &&
            modeRef.current !== "idle" &&
            !isPausedRef.current
          ) {
            if (standbyTimerRef.current) clearTimeout(standbyTimerRef.current);
            standbyTimerRef.current = setTimeout(() => {
              if (modeRef.current !== "active" && !isStoppingRef.current && !isPausedRef.current) {
                startStandby();
              }
            }, 600);
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
        activeGlobalRecognition = recognition;
        stopGlobalActive = stopAll;
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
        setIsListening(false);
        setInterimTranscript("");
      }
    },
    [autoStopAfterSilenceMs, enableWakeWordStandby, lang, startStandby, stopAll]
  );

  const stopListeningAndEnterStandby = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const instance = recognitionRef.current;
    if (instance) {
      try {
        instance.stop();
      } catch {}
      recognitionRef.current = null;
    }

    setIsListening(false);
    setInterimTranscript("");

    // Enter standby wake word listener only if not paused
    if (enableWakeWordStandby && !isStoppingRef.current && !isPausedRef.current) {
      modeRef.current = "standby";
      if (standbyTimerRef.current) clearTimeout(standbyTimerRef.current);
      standbyTimerRef.current = setTimeout(() => {
        if (!isStoppingRef.current && modeRef.current === "standby" && !isPausedRef.current) {
          startStandby();
        }
      }, 700);
    }
  }, [enableWakeWordStandby, startStandby]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListeningAndEnterStandby();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListeningAndEnterStandby]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);

  return {
    isSupported,
    isListening,
    isStandby,
    standbyHeard,
    interimTranscript,
    startListening,
    startStandby,
    stopListening: stopListeningAndEnterStandby,
    stopAll,
    toggleListening,
  };
}
