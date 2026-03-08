"use client";
import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import type { DailyCall } from "@daily-co/daily-js";

type LessonStatus = "idle" | "joining" | "live" | "ended";

interface LessonState {
  roomId: string | null;
  roomUrl: string | null;
  token: string | null;
  studentName: string | null;
  status: LessonStatus;
}

interface LessonContextValue extends LessonState {
  callObject: DailyCall | null;
  joinLesson: (params: {
    roomId: string;
    roomUrl: string;
    token: string;
    studentName: string;
  }) => Promise<void>;
  leaveLesson: () => Promise<void>;
}

const LessonContext = createContext<LessonContextValue | null>(null);

export function LessonProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LessonState>({
    roomId: null,
    roomUrl: null,
    token: null,
    studentName: null,
    status: "idle",
  });

  const callRef = useRef<DailyCall | null>(null);
  const [callVersion, setCallVersion] = useState(0);

  const joinLesson = useCallback(async ({
    roomId, roomUrl, token, studentName,
  }: {
    roomId: string; roomUrl: string; token: string; studentName: string;
  }) => {
    if (callRef.current) {
      await callRef.current.leave().catch(() => {});
      callRef.current.destroy();
      callRef.current = null;
    }

    setState({ roomId, roomUrl, token, studentName, status: "joining" });

    // Dynamic import — avoids any SSR issues with daily-js
    const DailyIframe = (await import("@daily-co/daily-js")).default;
    const co = DailyIframe.createCallObject();
    callRef.current = co;
    setCallVersion((v) => v + 1);

    await co.join({ url: roomUrl, token });

    // Music mode — disable noise cancellation
    try {
      await co.updateInputSettings({ audio: { processor: { type: "none" } } });
    } catch { /* ignore */ }

    setState((s) => ({ ...s, status: "live" }));
  }, []);

  const leaveLesson = useCallback(async () => {
    if (callRef.current) {
      await callRef.current.leave().catch(() => {});
      callRef.current.destroy();
      callRef.current = null;
      setCallVersion((v) => v + 1);
    }
    setState({ roomId: null, roomUrl: null, token: null, studentName: null, status: "idle" });
  }, []);

  void callVersion;

  return (
    <LessonContext.Provider value={{
      ...state,
      callObject: callRef.current,
      joinLesson,
      leaveLesson,
    }}>
      {children}
    </LessonContext.Provider>
  );
}

export function useLesson(): LessonContextValue {
  const ctx = useContext(LessonContext);
  if (!ctx) throw new Error("useLesson must be used inside LessonProvider");
  return ctx;
}
