"use client";
import React from "react";
import { LessonProvider } from "../lib/context/LessonContext";
import LessonPip from "./LessonPip";

export default function LessonProviderClient({ children }: { children: React.ReactNode }) {
  return (
    <LessonProvider>
      {children}
      <LessonPip />
    </LessonProvider>
  );
}
