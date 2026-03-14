"use client";
import React from "react";
import { LessonProvider } from "../lib/context/LessonContext";
import LessonPip from "./LessonPip";
import FloatingDrawing from "./FloatingDrawing";
import FunModeCanvas from "./FunModeCanvas";
import { useTheme } from "@/lib/context/ThemeContext";

function AppOverlays() {
  const { showDrawModal, closeDrawModal } = useTheme();
  return (
    <>
      <FloatingDrawing />
      {showDrawModal && <FunModeCanvas onClose={closeDrawModal} />}
    </>
  );
}

export default function LessonProviderClient({ children }: { children: React.ReactNode }) {
  return (
    <LessonProvider>
      {children}
      <LessonPip />
      <AppOverlays />
    </LessonProvider>
  );
}
