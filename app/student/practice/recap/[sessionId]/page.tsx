"use client";
import React, { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../../../lib/supabase/client";
import { useAuth } from "../../../../../lib/context/AuthContext";
import type { PracticeSessionRow } from "../../../../../lib/types";
import { useI18n } from "../../../../../lib/context/I18nContext";

const MUSIC_FACTS = [
  "Billie Eilish recorded her debut album in her childhood bedroom. She was 17 when it came out — and it won 5 Grammys.",
  "The Minecraft soundtrack was made by one person, C418, mostly in a single afternoon. It's now one of the most streamed game soundtracks ever.",
  "Olivia Rodrigo wrote 'drivers license' in one night at 16. It broke the Spotify record for fastest song to 100 million streams.",
  "Taylor Swift taught herself guitar at age 12 by having a computer repairman show her three chords. The rest is history.",
  "The Super Mario Bros. theme was composed on a computer in 1985 — with no keyboard, just a pixel grid for notes.",
  "Your brain releases dopamine (the 'feel good' chemical) both when you anticipate a musical moment AND when it hits. Music literally gives you chills on purpose.",
  "BTS has more YouTube subscribers than any musician ever — but all 7 members also had to pass intense music and dance tests just to get signed.",
  "Harry Styles learned guitar specifically to write songs. He said he was terrible at first and just kept going anyway.",
  "The 'Happy Birthday' song was copyrighted for 80 years. Companies had to pay to use it in movies. It became public domain in 2016.",
  "There are more possible ways to arrange the notes in a melody than there are atoms in the observable universe.",
  "Glass armonica, invented by Benjamin Franklin, was banned in some European cities in the 1800s. People thought it made you go insane.",
  "K-pop trainees practice 12–16 hours a day for years before debuting. BLACKPINK trained for 4–6 years before their first song.",
  "Lil Nas X made 'Old Town Road' in one day on a $30 beat he bought online. It broke the record for longest #1 song in Billboard history.",
  "'7 Nation Army' by The White Stripes is one of the most recognizable riffs in history — and it's only 7 notes.",
  "The world's largest instrument is an organ in Atlantic City. It has 33,114 pipes and is as loud as 25 brass bands combined.",
  "Logic's '1-800-273-8255' caused a 50% spike in calls to the National Suicide Prevention Lifeline the night it dropped at the VMAs.",
  "A study found that babies respond to music before they're even born — they start reacting to rhythm and melody at about 7 months in the womb.",
  "Mozart's brain scans (simulated from historical accounts) show his auditory cortex was nearly 30% larger than average. His brain was literally wired for music.",
  "Sabrina Carpenter started posting covers on YouTube at age 10. She had to keep it secret because her family didn't have a computer with a microphone yet.",
  "Shawn Mendes started his career by posting 15-second guitar clips on Vine. He got a record deal at 15.",
  "The bass drop in electronic music was accidentally invented — producers noticed that crowds went crazy when the bass came back in after a quiet moment.",
  "Ed Sheeran has prosopagnosia — he can't recognize faces, including his own. He uses voice recognition to tell people apart.",
  "Guitar Hero and Rock Band were so popular they caused a 33% spike in guitar sales. Then they got too hard for casual players and sales crashed.",
  "The 'Wilhelm Scream' sound effect has been used in over 400 movies and games. You've heard it. It was recorded by a single actor in 1951.",
  "Practicing while you sleep is real — your brain consolidates muscle memory and replays what you learned that day. Sleep after practice = faster improvement.",
  "A study of concert pianists found their brains are wired differently from birth AND from practice. You're literally rewiring your brain right now.",
  "A violin has over 70 pieces of wood and takes about 200 hours to make. Yet a master can play 1,000 notes a minute on it.",
  "Post Malone taught himself guitar from YouTube tutorials when he was 14. He can also play beer pong guitar solos. Both are impressive.",
  "The first song ever uploaded to YouTube was 'Me at the zoo' in 2005 — but the first music video was 'Bohemian Rhapsody' by Queen in 1975.",
  "Playing an instrument is the only activity scientists have found that exercises ALL parts of the brain at the same time — like a full-body workout, but for your mind.",
  "The loudest band ever recorded is MANOWAR at 139 decibels. A jet engine is 140. They literally competed with a jet.",
  "Ariana Grande has a 4-octave vocal range. Most trained singers have 2–3. She says she barely practiced when she was young and just… could always do it.",
  "The song 'Africa' by Toto plays on a loop, forever, in the Namib desert. A Namibian artist set it up on solar-powered speakers in the wilderness in 2019.",
  "Scientists found that people who play instruments are significantly better at learning languages, math, and reading — your practice sessions are literally making you smarter.",
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
