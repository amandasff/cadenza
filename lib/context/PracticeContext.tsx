"use client";
import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from "react";
import { saveDraft, clearDraft } from "../practiceDb";

export interface ClipResult {
  blob: Blob;
  startElapsed: number;
  endElapsed: number;
  index: number;
}

interface PracticeContextValue {
  /** A practice session is in progress (recording or paused) */
  isActive: boolean;
  /** Mic is actively recording right now */
  recording: boolean;
  /** Seconds since session started (counts while recording) */
  elapsed: number;
  /** AnalyserNode for waveform visualization */
  analyserNode: AnalyserNode | null;
  /** A teacher clip is being recorded right now */
  clipping: boolean;
  /** How many clips have been captured this session */
  clipCount: number;
  /** Seconds since current clip started */
  clipElapsed: number;

  startPractice: () => Promise<void>;
  pausePractice: () => void;
  resumePractice: () => void;
  /** Stops recording and returns the audio blob + total elapsed time */
  finishPractice: () => Promise<{ blob: Blob | null; elapsed: number }>;
  /** Discard session without saving */
  cancelPractice: () => void;
  /** Start recording a clip (teacher-visible segment) */
  startClip: () => void;
  /** Stop the current clip and return its data */
  stopClip: () => Promise<ClipResult | null>;
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
  const [clipping, setClipping] = useState(false);
  const [clipCount, setClipCount] = useState(0);
  const [clipElapsed, setClipElapsed] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const boostedStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mimeTypeRef = useRef<string>("");
  const elapsedRef = useRef(0);

  // Clip recorder — second MediaRecorder on the same stream
  const clipRecorderRef = useRef<MediaRecorder | null>(null);
  const clipChunksRef = useRef<Blob[]>([]);
  const clipStartElapsedRef = useRef(0);
  const clipCountRef = useRef(0);

  // Free hardware resources if the provider unmounts mid-session
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.onstop = () => {};
        mediaRecorderRef.current.stop();
      }
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // Main session timer — increments only while recording
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(e => {
      elapsedRef.current = e + 1;
      return e + 1;
    }), 1000);
    return () => clearInterval(id);
  }, [recording]);

  // Clip timer
  useEffect(() => {
    if (!clipping) { setClipElapsed(0); return; }
    const id = setInterval(() => setClipElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [clipping]);

  // Auto-save draft to IndexedDB every 30 s while recording (crash recovery)
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      if (chunksRef.current.length > 0) {
        void saveDraft({
          chunks: [...chunksRef.current],
          mimeType: mimeTypeRef.current,
          elapsed: elapsedRef.current,
          savedAt: Date.now(),
        });
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [recording]);

  // Warn before closing the tab while a session is active
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isActive) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isActive]);

  // Resume AudioContext when the tab becomes visible again
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible" && audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  function makeMimeOpts(): { mimeType?: string; audioBitsPerSecond: number } {
    const preferredTypes = [
      "audio/webm;codecs=opus",
      "audio/ogg;codecs=opus",
      "audio/mp4;codecs=aac",
      "audio/webm",
    ];
    const mimeType = preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) ?? "";
    if (!mimeTypeRef.current) mimeTypeRef.current = mimeType;
    const opts: { mimeType?: string; audioBitsPerSecond: number } = { audioBitsPerSecond: 128000 };
    if (mimeType) opts.mimeType = mimeType;
    return opts;
  }

  const startPractice = useCallback(async () => {
    if (isActive) return;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    // Disable all voice-call processing — these harm music quality
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

    // Gentle gain boost (1.5×) — phone/laptop mics are often quiet for instruments.
    // Lower than the 2× used for voice notes to avoid clipping loud passages.
    const gain = ctx.createGain();
    gain.gain.value = 1.5;
    const dest = ctx.createMediaStreamDestination();
    source.connect(gain);
    gain.connect(dest);
    const boostedStream = dest.stream;
    boostedStreamRef.current = boostedStream;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    gain.connect(analyser);
    analyserRef.current = analyser;
    setAnalyserNode(analyser);

    if (typeof MediaRecorder !== "undefined") {
      const opts = makeMimeOpts();
      const recorder = new MediaRecorder(boostedStream, opts);
      chunksRef.current = [];
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
    }

    clipCountRef.current = 0;
    setClipCount(0);
    setElapsed(0);
    elapsedRef.current = 0;
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

  const startClip = useCallback(() => {
    const stream = boostedStreamRef.current ?? micStreamRef.current;
    if (!stream || clipping) return;
    const opts = makeMimeOpts();
    const clipRecorder = new MediaRecorder(stream, opts);
    clipChunksRef.current = [];
    clipRecorder.ondataavailable = e => {
      if (e.data.size > 0) clipChunksRef.current.push(e.data);
    };
    clipRecorder.start(250);
    clipRecorderRef.current = clipRecorder;
    clipStartElapsedRef.current = elapsedRef.current;
    setClipping(true);
  }, [clipping]);

  const stopClip = useCallback((): Promise<ClipResult | null> => {
    return new Promise(resolve => {
      const recorder = clipRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        setClipping(false);
        resolve(null);
        return;
      }
      const startElapsed = clipStartElapsedRef.current;
      const endElapsed = elapsedRef.current;
      const index = clipCountRef.current;

      recorder.onstop = () => {
        const blob = new Blob(clipChunksRef.current, {
          type: mimeTypeRef.current || "audio/webm",
        });
        clipChunksRef.current = [];
        clipRecorderRef.current = null;
        clipCountRef.current += 1;
        setClipCount(c => c + 1);
        setClipping(false);
        resolve({ blob, startElapsed, endElapsed, index });
      };
      recorder.stop();
    });
  }, []);

  const cleanup = useCallback(() => {
    // Stop clip if running
    if (clipRecorderRef.current && clipRecorderRef.current.state !== "inactive") {
      clipRecorderRef.current.onstop = () => {};
      clipRecorderRef.current.stop();
    }
    clipRecorderRef.current = null;
    clipChunksRef.current = [];

    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setAnalyserNode(null);
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    elapsedRef.current = 0;
    setRecording(false);
    setIsActive(false);
    setElapsed(0);
    setClipping(false);
    setClipCount(0);
    setClipElapsed(0);
    void clearDraft();
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
          const finish = (b: Blob) => { URL.revokeObjectURL(url); resolve({ blob: b, elapsed: currentElapsed }); };
          audio.addEventListener("error", () => finish(blob), { once: true });
          audio.addEventListener("loadedmetadata", () => {
            if (audio.duration === Infinity) {
              audio.currentTime = 1e101;
              audio.addEventListener("timeupdate", () => {
                audio.currentTime = 0;
                finish(blob);
              }, { once: true });
            } else {
              finish(blob);
            }
          }, { once: true });
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
      recorder.onstop = () => {};
      recorder.stop();
    }
    cleanup();
  }, [cleanup]);

  return (
    <PracticeContext.Provider value={{
      isActive, recording, elapsed, analyserNode,
      clipping, clipCount, clipElapsed,
      startPractice, pausePractice, resumePractice, finishPractice, cancelPractice,
      startClip, stopClip,
    }}>
      {children}
    </PracticeContext.Provider>
  );
}
