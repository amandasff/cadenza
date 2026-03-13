"use client";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../supabase/client";
import { ChatService } from "../services/ChatService";

export interface RecordingTarget {
  studioId: string;
  senderId: string;
  senderName: string;
  /** null = announcement channel */
  recipientId: string | null;
  /** Called after the voice note is successfully sent */
  onSent?: () => Promise<void>;
}

interface RecordingContextValue {
  isRecording: boolean;
  recordingSeconds: number;
  uploadingAudio: boolean;
  audioError: string | null;
  startRecording: (target: RecordingTarget) => Promise<void>;
  stopRecording: () => void;
  clearError: () => void;
}

const RecordingContext = createContext<RecordingContextValue | null>(null);

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetRef = useRef<RecordingTarget | null>(null);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const startRecording = useCallback(async (target: RecordingTarget) => {
    setAudioError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setAudioError("Voice recording is not supported in this browser.");
      return;
    }
    try {
      targetRef.current = target;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
        setRecordingSeconds(0);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const t = targetRef.current;
        if (!t || blob.size === 0) return;

        setUploadingAudio(true);
        try {
          const supabase = getSupabaseBrowserClient();
          const path = `${t.studioId}/${t.senderId}/${Date.now()}.webm`;
          const { error } = await supabase.storage
            .from("chat-voice-notes")
            .upload(path, blob, { upsert: true, contentType: "audio/webm" });
          if (error) throw error;
          const { data } = supabase.storage.from("chat-voice-notes").getPublicUrl(path);
          const content = `AUDIO:${data.publicUrl}`;
          const svc = ChatService.create(supabase);
          if (t.recipientId) {
            await svc.sendPrivateMessage(t.studioId, t.senderId, t.senderName, t.recipientId, content);
          } else {
            await svc.postAnnouncement(t.studioId, t.senderId, t.senderName, content);
          }
          await t.onSent?.();
        } catch (err) {
          setAudioError(`Failed to send voice note: ${(err as Error)?.message ?? "unknown error"}`);
        } finally {
          setUploadingAudio(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      setAudioError(
        msg.includes("denied") || msg.includes("Permission")
          ? "Microphone access denied — check your browser permissions."
          : `Microphone error: ${msg}`
      );
    }
  }, []);

  const clearError = useCallback(() => setAudioError(null), []);

  return (
    <RecordingContext.Provider value={{ isRecording, recordingSeconds, uploadingAudio, audioError, startRecording, stopRecording, clearError }}>
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecording() {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error("useRecording must be used within RecordingProvider");
  return ctx;
}
