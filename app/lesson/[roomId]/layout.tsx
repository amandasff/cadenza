import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lesson — Cadenza",
};

export default function LessonLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
