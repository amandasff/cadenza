"use client";
import React, { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../../../lib/supabase/client";
import { useAuth } from "../../../../../lib/context/AuthContext";
import type { PracticeSessionRow } from "../../../../../lib/types";
import { useI18n } from "../../../../../lib/context/I18nContext";

const MUSIC_FACTS = [
  "Mozart wrote his first symphony at age 8. His first piano concerto? Age 4. He literally learned to walk and compose at the same time.",
  "Beethoven was completely deaf when he wrote his 9th Symphony — one of the most famous pieces ever. He never heard a single note of it performed.",
  "Liszt was the world's first rock star. Fans would fight over his broken piano strings as souvenirs. One time a crowd literally tore his coat apart.",
  "Bach had 20 children. Several became famous composers. He basically started a music dynasty with his family.",
  "Chopin only performed publicly about 30 times in his entire life — he had bad stage fright. Yet everyone knew who he was.",
  "Mozart heard a piece called Allegri's Miserere at age 14 — it was so secret the Vatican banned anyone from copying it. He went home and wrote out the entire thing from memory.",
  "Yo-Yo Ma started playing cello at age 4 and performed for President Kennedy at age 7. He's now considered the greatest cellist alive.",
  "Clara Schumann was performing sold-out concerts at age 9. She was also one of the first pianists ever to play an entire concert from memory — before her, everyone used sheet music on stage.",
  "Paganini could play three octaves across four strings in one hand-span — a stretch most violinists still can't do. Teachers said it was physically impossible until he did it in front of them.",
  "Schubert wrote over 600 songs — and he died at just 31. That's roughly one song every two weeks of his life, starting from childhood.",
  "The theremin is the only instrument you play without touching it. You just move your hands near it and it makes sound. It was invented in 1920 and is still used today.",
  "Handel wrote the entire Messiah — all 260 pages of it — in just 24 days. He reportedly didn't stop to eat or sleep much. It's still performed every Christmas.",
  "A Stradivarius violin from the 1700s is worth $10–20 million today. Nobody has been able to figure out exactly why they sound better than modern violins.",
  "Tchaikovsky hated The Nutcracker. He thought it was a silly assignment and complained about it the whole time he wrote it. It's now performed more than any other ballet in history.",
  "The piano has over 12,000 parts — 10,000 of which are moving. It's one of the most mechanically complex objects ever invented.",
  "Debussy was almost expelled from music school for his 'unacceptable' chord ideas. Those ideas literally changed the direction of all music after him.",
  "When Beethoven played his famous 'Moonlight Sonata' for the first time, the audience was so silent you could hear people crying. He was already half-deaf.",
  "A concert grand piano can weigh up to 990 pounds — about as much as a small car. Moving one requires a professional team and sometimes a crane.",
  "The violin is made from over 70 pieces of wood, takes 200+ hours to build, and a skilled player can draw over 1,000 distinct notes per minute from it.",
  "Mozart's 'Rondo alla Turca' — one of the most recognizable piano pieces ever — was written to imitate the sound of Turkish military bands. He was obsessed with that style.",
  "At age 13, Felix Mendelssohn wrote a string symphony so advanced that professional musicians initially thought an adult must have composed it.",
  "Chopin loved performing in small, cozy rooms for just a handful of friends rather than big concert halls — he said the energy felt more real and personal that way.",
  "The first recording of music was made in 1877 by Thomas Edison. He sang 'Mary Had a Little Lamb' into a tin foil cylinder. Classical musicians thought recording would kill live music.",
  "Bach was fired from one of his early jobs for being 'too creative.' His boss complained he was playing too many surprising notes during church services.",
  "Playing a musical instrument is the only activity proven to exercise ALL parts of the brain simultaneously — logic, creativity, memory, motor control, and emotion at once.",
  "The world's longest piano piece is 'Vexations' by Erik Satie. It's the same section repeated 840 times. The full performance takes about 18 hours.",
  "An orchestra can have up to 100 musicians, but the conductor doesn't make a single sound. Their whole job is just to shape how everyone else plays.",
  "Beethoven's 5th Symphony opens with four notes: da-da-da-DUM. He worked on just those four notes for over six years to get them exactly right.",
  "The word 'piano' is short for 'pianoforte,' which means 'soft-loud' in Italian. It was called that because — unlike the harpsichord — it could actually play quietly or loudly depending on touch.",
  "Liszt could sight-read almost any piece of music put in front of him — including pieces that other professional pianists said were 'unplayable.' He would just... play them.",
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
  const { user } = useAuth();
  const firstName = user?.displayName?.split(" ")[0] ?? null;

  const MOOD_DISPLAY: Record<string, { label: string; emoji: string }> = {
    great: { label: t.student.moodGreat, emoji: "🌟" },
    good:  { label: t.student.moodGood,  emoji: "😊" },
    okay:  { label: t.student.moodOkay,  emoji: "😐" },
    hard:  { label: t.student.moodHard,  emoji: "😓" },
  };

  const [session, setSession] = useState<PracticeSessionRow | null>(null);
  const [pieceName, setPieceName] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const factRef = useRef<string>(getRandomFact());

  // Load session once — check for existing AI feedback, but don't poll
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
        if (s.ai_feedback) setFeedback(s.ai_feedback);

        if (s.piece_id) {
          supabase.from("pieces").select("title").eq("id", s.piece_id).single()
            .then((r: { data: { title: string } | null }) => { if (r.data) setPieceName(r.data.title); });
        }
      });
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎉</div>
          <h1 style={{
            fontFamily: "Cormorant Garamond, Georgia, serif", fontWeight: 600,
            fontSize: "1.875rem", color: "var(--charcoal)", margin: "0 0 0.25rem",
            letterSpacing: "-0.01em",
          }}>
            {firstName ? `Well done, ${firstName}!` : "Well done!"}
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

          {feedback ? (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", margin: 0, lineHeight: 1.65 }}>
              {feedback}
            </p>
          ) : (
            <div>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "var(--charcoal)", margin: "0 0 0.25rem", fontWeight: 500 }}>
                Coming soon ✨
              </p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
                Your AI coach will listen to your sessions and give you personalized tips. Stay tuned!
              </p>
            </div>
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

        {/* Music fact */}
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

        {/* CTAs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <button
            onClick={() => router.replace("/student/pitch")}
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.875rem", fontSize: "0.9375rem" }}
          >
            🎮 Play a Game
          </button>
          <button
            onClick={() => router.replace("/student")}
            style={{
              width: "100%", padding: "0.75rem", fontSize: "0.875rem",
              background: "transparent", border: "1px solid var(--border)",
              borderRadius: 8, cursor: "pointer",
              fontFamily: "Inter, sans-serif", color: "var(--muted)",
            }}
          >
            {t.student.recapBackToHome}
          </button>
        </div>

      </div>
    </div>
  );
}
