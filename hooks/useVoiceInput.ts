"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "@/lib/toast";

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
}

interface SpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

// Global active recognition tracker to ensure only one microphone records at any time across the app
let activeGlobalRecognition: ISpeechRecognition | null = null;
let stopGlobalActive: (() => void) | null = null;

export interface UseVoiceInputOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
  lang?: string;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const { onTranscript, lang = "en-US" } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const isStoppingRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

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

  const stopListening = useCallback(() => {
    isStoppingRef.current = true;
    const instance = recognitionRef.current;
    if (instance) {
      try {
        instance.stop();
      } catch {
        // Recognition may already be stopped
      }
      recognitionRef.current = null;
    }

    if (activeGlobalRecognition === instance) {
      activeGlobalRecognition = null;
      stopGlobalActive = null;
    }

    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;

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

    // Stop any existing recognition session across the app
    if (stopGlobalActive && stopGlobalActive !== stopListening) {
      stopGlobalActive();
    }

    // Stop current if already listening
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore abort error
      }
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;
      recognition.maxAlternatives = 1;

      isStoppingRef.current = false;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript("");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let finalSegment = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            finalSegment += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }

        if (finalSegment.trim()) {
          onTranscriptRef.current?.(finalSegment.trim(), true);
          setInterimTranscript("");
        } else if (interim) {
          setInterimTranscript(interim);
          onTranscriptRef.current?.(interim, false);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // Avoid noisy toast if error occurs during user-initiated stop
        if (isStoppingRef.current) return;

        switch (event.error) {
          case "not-allowed":
          case "service-not-allowed":
            toast.error("Microphone permission was denied.", {
              description: "Please allow microphone access in your browser settings to use voice input.",
            });
            break;
          case "audio-capture":
            toast.error("No microphone detected.", {
              description: "Please ensure a working microphone is connected to your device.",
            });
            break;
          case "network":
            toast.error("Speech recognition network error.", {
              description: "Please check your internet connection and try again.",
            });
            break;
          case "no-speech":
            // Ignored; normal silence when user pauses
            break;
          case "aborted":
            // Normal abort
            break;
          default:
            toast.error("Something went wrong while listening.", {
              description: "Please try speaking again or type directly.",
            });
            break;
        }

        setIsListening(false);
        setInterimTranscript("");
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
        if (activeGlobalRecognition === recognition) {
          activeGlobalRecognition = null;
          stopGlobalActive = null;
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      activeGlobalRecognition = recognition;
      stopGlobalActive = stopListening;
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      toast.error("Unable to access microphone.", {
        description: "Please check your browser permissions.",
      });
      setIsListening(false);
      setInterimTranscript("");
    }
  }, [lang, stopListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      const instance = recognitionRef.current;
      if (instance) {
        try {
          instance.abort();
        } catch {
          // Ignore abort errors on unmount
        }
        recognitionRef.current = null;
      }
      if (activeGlobalRecognition === instance) {
        activeGlobalRecognition = null;
        stopGlobalActive = null;
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
  };
}
