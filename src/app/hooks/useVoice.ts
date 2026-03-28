"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// ============================================
// TYPES
// ============================================

export interface VoiceState {
  /** Is TTS currently speaking? */
  isSpeaking: boolean;
  /** Is STT currently listening? */
  isListening: boolean;
  /** Interim transcript (while speaking) */
  transcript: string;
  /** Is voice supported in this browser? */
  supported: boolean;
  /** Available TTS voices */
  voices: SpeechSynthesisVoice[];
}

// ============================================
// HOOK
// ============================================

export function useVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const recognitionRef = useRef<any>(null);

  // Check support
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const sttSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Load voices
  useEffect(() => {
    if (!ttsSupported) return;
    const loadVoices = () => {
      const v = speechSynthesis.getVoices();
      setVoices(v);
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }, [ttsSupported]);

  // ---- TTS: Speak text ----
  const speak = useCallback((text: string, voiceName?: string) => {
    if (!ttsSupported || !text) return;

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Select voice
    if (voiceName) {
      const voice = voices.find((v) => v.name === voiceName || v.name.includes(voiceName));
      if (voice) utterance.voice = voice;
    } else {
      // Default: prefer English voice
      const englishVoice = voices.find((v) => v.lang.startsWith("en") && v.name.includes("Google")) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0];
      if (englishVoice) utterance.voice = englishVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechSynthesis.speak(utterance);
  }, [ttsSupported, voices]);

  // ---- TTS: Stop speaking ----
  const stopSpeaking = useCallback(() => {
    if (ttsSupported) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [ttsSupported]);

  // ---- STT: Start listening ----
  const startListening = useCallback((onResult: (text: string) => void) => {
    if (!sttSupported) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(interim || final);
      if (final) {
        onResult(final);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [sttSupported]);

  // ---- STT: Stop listening ----
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, []);

  return {
    // State
    isSpeaking,
    isListening,
    transcript,
    voices,
    supported: ttsSupported || sttSupported,
    ttsSupported,
    sttSupported,
    // Actions
    speak,
    stopSpeaking,
    startListening,
    stopListening,
  };
}
