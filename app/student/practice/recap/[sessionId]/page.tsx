"use client";
import React, { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../../../lib/supabase/client";
import type { PracticeSessionRow } from "../../../../../lib/types";
import { useI18n } from "../../../../../lib/context/I18nContext";

const MUSIC_FACTS = [
  "Beethoven continued composing even after he lost his hearing — he felt the vibrations through the floor by sawing the legs off his piano.",
  "Mozart could write out an entire piece from memory after hearing it just once — he did this with Allegri's Miserere at age 14.",
  "Chopin only performed publicly about 30 times in his life — he preferred the intimacy of small salons.",
  "Bach had 20 children. Several of them became famous composers too.",
  "The piano has over 12,000 parts, 10,000 of which are moving.",
  "Clara Schumann was touring as a concert pianist at age 9 — and she was one of the first performers to play entire concerts from memory.",
  "Liszt was the first musician to give solo recitals — before him, concerts always featured multiple performers.",
  "A violin is made of over 70 individual pieces of wood.",
  "Debussy was almost expelled from the Paris Conservatoire for his 'unacceptable' harmonic ideas. Those ideas changed music forever.",
  "Tchaikovsky wrote The Nutcracker in just 6 weeks while suffering from depression — and he hated it.",
  "The world's longest piano piece, Vexations by Erik Satie, takes about 18 hours to perform.",
  "Yo-Yo Ma was performing for President Kennedy at age 7.",
  "Stradivarius made over 1,000 instruments. About 600 survive, and each is worth millions.",
  "The metronome was invented in 1815 — Beethoven was one of the first composers to use it for tempo markings.",
  "Jimi Hendrix couldn't read music. Neither could Paul McCartney or Elvis Presley.",
  "An oboe is the instrument orchestras tune to because its pitch is consistent even in varying humidity.",
  "The first music video was made in 1894 — before film had sound — with slides synced to a live piano.",
  "Mozart wrote his first symphony at age 8.",
  "Playing an instrument uses nearly every area of the brain simultaneously.",
  "The guitar is the most-played instrument in the world, with over a billion players.",
  "Handel wrote the entire Messiah — all 260 pages — in just 24 days.",
  "The word 'piano' is short for pianoforte, meaning 'soft-loud' in Italian.",
  "Paganini's violin technique was so extraordinary that some people genuinely believed he had made a deal with the devil.",
  "The trumpet is one of the oldest instruments in the world — a version was found in Tutankhamun's tomb.",
  "Music activates the same reward centers in your brain as food, love, and exercise.",
  "Chopin's heart was removed after his death and buried in Warsaw — his body is in Paris.",
  "The theremin is the only instrument you play without touching it.",
  "Schubert wrote over 600 songs — and he died at 31.",
  "A concert grand piano can weigh up to 990 pounds (450 kg).",
  "The first recording of music was made in 1877 by Thomas Edison — he sang 'Mary Had a Little Lamb.'",
];

function getRandomFact(): string {
  return MUSIC_FACTS[Math.floor(Math.random() * MUSIC_FACTS.length)];
}

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function PracticeRecapPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { t } = useI18n();

  const MOOD_DISPLAY: Record<string, { label: string; emoji: string }> = {
    great: { label: t.student.moodGreat, emoji: "🌟" },
    good:  { label: t.student.moodGood,  emoji: "😊" },
    okay:  { label: t.student.moodOkay,  emoji: "😐" },
    hard:  { label: t.student.moodHard,  emoji: "😓" },
  };

  const [session, setSession] = useState<PracticeSessionRow | null>(null);
  const [pieceName, setPieceName] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);
  const [dots, setDots] = useState("●");
  const factRef = useRef<string>(getRandomFact());

  // Load session once
  useEffect(() => {
    supabase
      .from("practice_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()
      .then((result: { data: PracticeSessionRow | null; error: unknown }) => {
        if (!result.data) return;
        const s = result.data;
        setSession(s);
        if (s.ai_feedback) { setFeedback(s.ai_feedback); setPolling(false); }

        // Load piece name if present
        if (s.piece_id) {
          supabase.from("pieces").select("title").eq("id", s.piece_id).single()
            .then((r: { data: { title: string } | null }) => { if (r.data) setPieceName(r.data.title); });
        }
      });
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for AI feedback
  useEffect(() => {
    if (!polling) return;
    let attempts = 0;
    const max = 20; // 60s max
    const id = setInterval(async () => {
      attempts++;
      const { data } = await supabase
        .from("practice_sessions")
        .select("ai_feedback")
        .eq("id", sessionId)
        .single();
      if (data?.ai_feedback) {
        setFeedback(data.ai_feedback);
        setPolling(false);
        clearInterval(id);
      } else if (attempts >= max) {
        setPolling(false);
        clearInterval(id);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [polling, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animated dots for loading state
  useEffect(() => {
    if (!polling) return;
    const frames = ["●○○", "●●○", "●●●", "○●●", "○○●", "○○○"];
    let i = 0;
    const id = setInterval(() => { setDots(frames[i % frames.length]); i++; }, 400);
    return () => clearInterval(id);
  }, [polling]);

  if (!session) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="skeleton" style={{ width: 320, height: 400, borderRadius: 16 }} />
      </div>
    );
  }

  const moodMatch = session.notes?.match(/\[mood:(\w+)\]/);
  const mood = moodMatch?.[1] ?? null;
  const wentWell = session.notes?.match(/Well: ([^|]+)/)?.[1]?.trim() ?? null;
  const focusNext = session.notes?.match(/Focus: ([^|]+)/)?.[1]?.trim() ?? null;
  const moodDisplay = mood ? MOOD_DISPLAY[mood] : null;

  return (
    <div style={{
      minHeight: "100dvh", background: "var(--cream)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-start", padding: "2.5rem 1.25rem 4rem",
    }}>
      <div style={{ width: "100%", maxWidth: 360 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎵</div>
          <h1 style={{
            fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600,
            fontSize: "1.75rem", color: "var(--charcoal)", margin: "0 0 0.375rem",
            letterSpacing: "-0.01em",
          }}>
            {t.student.recapSessionComplete}
          </h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
            {fmt(session.duration_seconds)}{pieceName ? ` · ${pieceName}` : ""}
            {moodDisplay ? `  ${moodDisplay.emoji} ${moodDisplay.label}` : ""}
          </p>
        </div>

        {/* Student notes */}
        {(wentWell || focusNext) && (
          <div className="card-base" style={{ padding: "1rem 1.125rem", marginBottom: "1rem" }}>
            {wentWell && (
              <div style={{ marginBottom: focusNext ? "0.625rem" : 0 }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.25rem" }}>{t.student.recapWentWell}</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", lineHeight: 1.5 }}>{wentWell}</div>
              </div>
            )}
            {focusNext && (
              <div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.25rem" }}>{t.student.recapFocusNext}</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", lineHeight: 1.5 }}>{focusNext}</div>
              </div>
            )}
          </div>
        )}

        {/* AI Feedback card */}
        <div className="card-base" style={{
          padding: "1.25rem 1.25rem",
          marginBottom: "1.25rem",
          borderLeft: "3px solid var(--charcoal)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "1rem" }}>🤖</span>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.625rem", fontWeight: 600, color: "var(--charcoal)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {t.student.recapAiCoach}
            </div>
          </div>

          {polling ? (
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 0.5rem" }}>
                Listening to your session…
              </p>
              <p style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.25rem", color: "var(--charcoal)", margin: 0, letterSpacing: "0.08em" }}>
                {dots}
              </p>
            </div>
          ) : feedback ? (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", margin: 0, lineHeight: 1.65 }}>
              {feedback}
            </p>
          ) : (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
              Your teacher received your session notes. Audio analysis wasn&apos;t available this time — keep practicing!
            </p>
          )}
        </div>

        {/* Note about teacher */}
        <div style={{
          background: "var(--white)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "0.875rem 1rem",
          marginBottom: "1.5rem",
          display: "flex", alignItems: "center", gap: "0.625rem",
        }}>
          <span style={{ fontSize: "1rem", flexShrink: 0 }}>📩</span>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.5 }}>
            {t.student.recapSentToTeacher}
          </div>
        </div>

        {/* Music fact unlock */}
        <div style={{
          background: "linear-gradient(135deg, var(--butter-bg) 0%, var(--cream) 100%)",
          border: "1px solid var(--butter-light)",
          borderRadius: 10, padding: "1rem 1.125rem",
          marginBottom: "1.5rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem" }}>🎼</span>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.5625rem", fontWeight: 700, color: "var(--butter)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Did you know?
            </div>
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--charcoal)", margin: 0, lineHeight: 1.6 }}>
            {factRef.current}
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={() => router.replace("/student")}
          className="btn btn-primary"
          style={{ width: "100%", padding: "0.875rem", fontSize: "0.9375rem" }}
        >
          {t.student.recapBackToHome}
        </button>

      </div>
    </div>
  );
}
