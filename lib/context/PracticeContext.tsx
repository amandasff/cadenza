"use client";
import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from "react";

interface PracticeContextValue {
  /** A practice session is in progress (recording or paused) */
  isActive: boolean;
  /** Mic is actively recording right now */
  recording: boolean;
  /** Seconds since session started (counts while recording) */
  elapsed: number;
  /** AnalyserNode for waveform visualization */
  analyserNode: AnalyserNode | null;

  startPractice: () => Promise<void>;
  pausePractice: () => void;
  resumePractice: () => void;
  /** Stops recording and returns the audio blob + total elapsed time */
  finishPractice: () => Promise<{ blob: Blob | null; elapsed: number }>;
  /** Discard session without saving */
  cancelPractice: () => void;
}

const PracticeContext = createContext<PracticeContextValue | null>(null);

export function usePractice() {
  const ctx = useContext(PracticeContext);
  if (!ctx) throw new Error("usePractice must be used within PracticeProvider");
  return ctx;
}

export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mimeTypeRef = useRef<string>("");

  // Timer — increments only while recording
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const startPractice = useCallback(async () => {
    if (isActive) return;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    // Disable all voice-call processing — these are designed for speech and
    // actively harm music: AGC causes the "volume fade" on desktop, and
    // noise suppression / echo cancellation mangle instrument tones on mobile.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation:  false,
        noiseSuppression:  false,
        autoGainControl:   false,
        sampleRate:        48000,
        channelCount:      1,
      },
    });
    micStreamRef.current = stream;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    setAnalyserNode(analyser);

    // MediaRecorder
    if (typeof MediaRecorder !== "undefined") {
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4;codecs=aac",
        "audio/webm",
      ];
      const mimeType = preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) ?? "";
      mimeTypeRef.current = mimeType;
      const opts: MediaRecorderOptions = { audioBitsPerSecond: 128000 };
      if (mimeType) opts.mimeType = mimeType;
      const recorder = new MediaRecorder(stream, opts);
      chunksRef.current = [];
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
    }

    setElapsed(0);
    setRecording(true);
    setIsActive(true);
  }, [isActive]);

  const pausePractice = useCallback(() => {
    try {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.pause();
    } catch {}
    setRecording(false);
  }, []);

  const resumePractice = useCallback(() => {
    try {
      if (mediaRecorderRef.current?.state === "paused") mediaRecorderRef.current.resume();
    } catch {}
    setRecording(true);
  }, []);

  const cleanup = useCallback(() => {
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setAnalyserNode(null);
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setIsActive(false);
    setElapsed(0);
  }, []);

  const finishPractice = useCallback((): Promise<{ blob: Blob | null; elapsed: number }> => {
    return new Promise(resolve => {
      const currentElapsed = elapsed;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, {
            type: mimeTypeRef.current || "audio/webm",
          });
          cleanup();
          // Fix WebM duration metadata issue
          const url = URL.createObjectURL(blob);
          const audio = document.createElement("audio");
          audio.src = url;
          audio.addEventListener("loadedmetadata", () => {
            if (audio.duration === Infinity) {
              audio.currentTime = 1e101;
              audio.addEventListener("timeupdate", () => {
                audio.currentTime = 0;
                URL.revokeObjectURL(url);
                resolve({ blob, elapsed: currentElapsed });
              }, { once: true });
            } else {
              URL.revokeObjectURL(url);
              resolve({ blob, elapsed: currentElapsed });
            }
          });
        };
        recorder.stop();
      } else {
        cleanup();
        resolve({ blob: null, elapsed: currentElapsed });
      }
    });
  }, [elapsed, cleanup]);

  const cancelPractice = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {}; // discard
      recorder.stop();
    }
    cleanup();
  }, [cleanup]);

  return (
    <PracticeContext.Provider value={{
      isActive, recording, elapsed, analyserNode,
      startPractice, pausePractice, resumePractice, finishPractice, cancelPractice,
    }}>
      {children}
    </PracticeContext.Provider>
  );
}
