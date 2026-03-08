"use client";
import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { DailyProvider } from "@daily-co/daily-react";
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

  // Keep callObject in a ref so it doesn't cause re-renders on its own
  const callRef = useRef<DailyCall | null>(null);
  // Force re-render when call object changes
  const [callVersion, setCallVersion] = useState(0);

  const joinLesson = useCallback(
    async ({
      roomId,
      roomUrl,
      token,
      studentName,
    }: {
      roomId: string;
      roomUrl: string;
      token: string;
      studentName: string;
    }) => {
      // Destroy any existing call
      if (callRef.current) {
        await callRef.current.leave().catch(() => {});
        callRef.current.destroy();
        callRef.current = null;
      }

      setState({ roomId, roomUrl, token, studentName, status: "joining" });

      const DailyIframe = (await import("@daily-co/daily-js")).default;
      const co = DailyIframe.createCallObject();
      callRef.current = co;
      setCallVersion((v) => v + 1);

      await co.join({ url: roomUrl, token });

      // Music mode — disable noise cancellation
      try {
        await co.updateInputSettings({
          audio: { processor: { type: "none" } },
        });
      } catch { /* ignore if not supported */ }

      setState((s) => ({ ...s, status: "live" }));
    },
    []
  );

  const leaveLesson = useCallback(async () => {
    if (callRef.current) {
      await callRef.current.leave().catch(() => {});
      callRef.current.destroy();
      callRef.current = null;
      setCallVersion((v) => v + 1);
    }
    setState({ roomId: null, roomUrl: null, token: null, studentName: null, status: "idle" });
  }, []);

  const value: LessonContextValue = {
    ...state,
    callObject: callRef.current,
    joinLesson,
    leaveLesson,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void callVersion; // referenced to suppress lint warning — triggers re-render

  return (
    <LessonContext.Provider value={value}>
      {callRef.current ? (
        <DailyProvider callObject={callRef.current}>
          {children}
        </DailyProvider>
      ) : (
        children
      )}
    </LessonContext.Provider>
  );
}

export function useLesson(): LessonContextValue {
  const ctx = useContext(LessonContext);
  if (!ctx) throw new Error("useLesson must be used inside LessonProvider");
  return ctx;
}
