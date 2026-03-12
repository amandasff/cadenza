"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

const MIN_BPM = 30;
const MAX_BPM = 240;

function angleToBpm(angle: number): number {
  // angle in degrees, 0 = top (12 o'clock), clockwise
  // Map 0-360 to MIN_BPM-MAX_BPM
  const normalized = ((angle % 360) + 360) % 360;
  return Math.round(MIN_BPM + (normalized / 360) * (MAX_BPM - MIN_BPM));
}

function bpmToAngle(bpm: number): number {
  return ((bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 360;
}

function getAngleFromCenter(cx: number, cy: number, x: number, y: number): number {
  const dx = x - cx;
  const dy = cy - y; // invert Y since screen Y goes down
  let angle = Math.atan2(dx, dy) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return angle;
}

// Tempo markings positioned around the dial
const TEMPO_MARKS = [
  { bpm: 40, label: "Largo" },
  { bpm: 72, label: "Adagio" },
  { bpm: 108, label: "Andante" },
  { bpm: 120, label: "Moderato" },
  { bpm: 144, label: "Allegro" },
  { bpm: 176, label: "Vivace" },
  { bpm: 208, label: "Presto" },
];

interface MetronomeProps {
  onClose?: () => void;
}

export default function Metronome({ onClose }: MetronomeProps) {
  const [bpm, setBpm] = useState(120);
  const [playing, setPlaying] = useState(false);
  const [beats, setBeats] = useState(4);
  const [accentOn, setAccentOn] = useState(true);
  const [soundMode, setSoundMode] = useState<"click" | "voice">("click");
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [dragging, setDragging] = useState(false);

  const dialRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const beatRef = useRef(0);

  // Pre-generated voice buffers
  const voiceBuffersRef = useRef<AudioBuffer[]>([]);

  // Generate pleasant piano-like tones for voice counting
  const generateVoiceTone = useCallback((ctx: AudioContext, number: number, isAccent: boolean): AudioBuffer => {
    const sampleRate = ctx.sampleRate;
    const duration = 0.15;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Use different pitched tones for each beat number
    // Musical intervals based on beat number (pentatonic feel)
    const baseFreq = isAccent ? 880 : 660;
    const freqs: Record<number, number> = {
      1: baseFreq,
      2: baseFreq * 0.75,
      3: baseFreq * 0.84,
      4: baseFreq * 0.67,
      5: baseFreq * 0.63,
      6: baseFreq * 0.56,
    };
    const freq = freqs[number] || baseFreq * 0.75;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 20) * (isAccent ? 0.6 : 0.35);
      // Blend of sine + soft harmonics for a marimba/wood-block feel
      const val =
        Math.sin(2 * Math.PI * freq * t) * 0.7 +
        Math.sin(2 * Math.PI * freq * 2.01 * t) * 0.2 +
        Math.sin(2 * Math.PI * freq * 3.98 * t) * 0.1;
      data[i] = val * envelope;
    }
    return buffer;
  }, []);

  // Circular dial interaction
  const handleDialInteraction = useCallback((clientX: number, clientY: number) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = getAngleFromCenter(cx, cy, clientX, clientY);
    const newBpm = angleToBpm(angle);
    setBpm(Math.max(MIN_BPM, Math.min(MAX_BPM, newBpm)));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleDialInteraction(e.clientX, e.clientY);
  }, [handleDialInteraction]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    handleDialInteraction(e.clientX, e.clientY);
  }, [dragging, handleDialInteraction]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Metronome audio engine
  useEffect(() => {
    if (!playing) {
      setCurrentBeat(-1);
      return;
    }

    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    // Pre-generate voice buffers
    if (soundMode === "voice") {
      const buffers: AudioBuffer[] = [];
      for (let i = 1; i <= 6; i++) {
        buffers.push(generateVoiceTone(ctx, i, accentOn && i === 1));
      }
      voiceBuffersRef.current = buffers;
    }

    beatRef.current = 0;
    const intervalMs = Math.round((60 / bpm) * 1000);

    function tick() {
      const beat = beatRef.current;
      const isAccent = accentOn && beat === 0;
      setCurrentBeat(beat);

      if (soundMode === "click") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = isAccent ? 1100 : 800;
        gain.gain.setValueAtTime(isAccent ? 0.7 : 0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
      } else {
        const bufferIndex = beat % voiceBuffersRef.current.length;
        const buffer = voiceBuffersRef.current[bufferIndex];
        if (buffer) {
          // Re-generate with correct accent for beat 0
          const actualBuffer = generateVoiceTone(ctx, beat + 1, isAccent);
          const source = ctx.createBufferSource();
          source.buffer = actualBuffer;
          source.connect(ctx.destination);
          source.start();
        }
      }

      beatRef.current = (beat + 1) % beats;
    }

    tick();
    const id = setInterval(tick, intervalMs);
    schedulerRef.current = id as unknown as number;

    return () => {
      clearInterval(id);
      schedulerRef.current = null;
    };
  }, [playing, bpm, beats, accentOn, soundMode, generateVoiceTone]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const angle = bpmToAngle(bpm);
  const dialSize = 200;
  const center = dialSize / 2;
  const radius = dialSize / 2 - 16;
  // Knob position
  const knobAngleRad = ((angle - 90) * Math.PI) / 180 + Math.PI / 2;
  const knobX = center + radius * Math.sin((angle * Math.PI) / 180);
  const knobY = center - radius * Math.cos((angle * Math.PI) / 180);

  // Arc path for progress
  const startAngle = -90;
  const endAngle = startAngle + angle;
  const largeArc = angle > 180 ? 1 : 0;
  const endRad = (endAngle * Math.PI) / 180;
  const arcEndX = center + radius * Math.cos(endRad);
  const arcEndY = center + radius * Math.sin(endRad);
  const arcStartX = center + radius * Math.cos((startAngle * Math.PI) / 180);
  const arcStartY = center + radius * Math.sin((startAngle * Math.PI) / 180);

  // Tempo label
  let tempoLabel = "Moderato";
  for (const mark of TEMPO_MARKS) {
    if (bpm >= mark.bpm - 10) tempoLabel = mark.label;
  }

  return (
    <div style={{
      background: "var(--white)",
      borderRadius: 16,
      border: "1px solid var(--border)",
      padding: "1.25rem",
      fontFamily: "Inter, sans-serif",
      width: "100%",
      maxWidth: 320,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>Metronome</span>
        {onClose && (
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--muted)", fontSize: "1.25rem", padding: "0 0.25rem",
            lineHeight: 1,
          }}>×</button>
        )}
      </div>

      {/* Circular dial */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.75rem" }}>
        <div
          ref={dialRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            width: dialSize,
            height: dialSize,
            position: "relative",
            cursor: "pointer",
            touchAction: "none",
            userSelect: "none",
          }}
        >
          <svg width={dialSize} height={dialSize} style={{ position: "absolute", top: 0, left: 0 }}>
            {/* Background track */}
            <circle
              cx={center} cy={center} r={radius}
              fill="none" stroke="var(--border)" strokeWidth={6}
            />
            {/* Active arc */}
            {angle > 0.5 && (
              <path
                d={`M ${arcStartX} ${arcStartY} A ${radius} ${radius} 0 ${largeArc} 1 ${arcEndX} ${arcEndY}`}
                fill="none" stroke="#4CAF84" strokeWidth={6} strokeLinecap="round"
              />
            )}
            {/* Tick marks around the dial */}
            {Array.from({ length: 24 }).map((_, i) => {
              const a = (i * 15 - 90) * (Math.PI / 180);
              const isMajor = i % 6 === 0;
              const inner = radius - (isMajor ? 10 : 6);
              const outer = radius + 2;
              return (
                <line
                  key={i}
                  x1={center + inner * Math.cos(a)}
                  y1={center + inner * Math.sin(a)}
                  x2={center + outer * Math.cos(a)}
                  y2={center + outer * Math.sin(a)}
                  stroke={isMajor ? "var(--charcoal)" : "var(--border-strong)"}
                  strokeWidth={isMajor ? 1.5 : 0.75}
                  opacity={isMajor ? 0.5 : 0.3}
                />
              );
            })}
            {/* Knob */}
            <circle
              cx={knobX} cy={knobY} r={10}
              fill="#4CAF84"
              stroke="white" strokeWidth={3}
              style={{ filter: dragging ? "drop-shadow(0 0 6px rgba(76,175,132,0.5))" : "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}
            />
          </svg>

          {/* Center BPM display */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            pointerEvents: "none",
          }}>
            <div style={{
              fontSize: "2.25rem", fontWeight: 300, color: "var(--charcoal)",
              lineHeight: 1, letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}>
              {bpm}
            </div>
            <div style={{
              fontSize: "0.625rem", fontWeight: 500, color: "var(--muted)",
              letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2,
            }}>
              BPM
            </div>
            <div style={{
              fontSize: "0.6875rem", fontWeight: 500, color: "#4CAF84",
              marginTop: 4,
            }}>
              {tempoLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Beat indicators */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: "1rem" }}>
        {Array.from({ length: beats }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 10, height: 10, borderRadius: "50%",
              background: currentBeat === i
                ? (i === 0 && accentOn ? "#4CAF84" : "var(--charcoal)")
                : "var(--border)",
              transition: "background 0.05s, transform 0.05s",
              transform: currentBeat === i ? "scale(1.3)" : "scale(1)",
            }}
          />
        ))}
      </div>

      {/* Play button */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
        <button
          onClick={() => setPlaying(p => !p)}
          style={{
            width: 48, height: 48, borderRadius: "50%",
            background: playing ? "var(--charcoal)" : "#4CAF84",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s, transform 0.1s",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          }}
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        {/* Beats per bar */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: "0.5625rem", color: "var(--muted)",
            letterSpacing: "0.07em", textTransform: "uppercase",
            marginBottom: "0.3rem",
          }}>
            Beats
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {[2, 3, 4, 5, 6].map(n => (
              <button
                key={n}
                onClick={() => setBeats(n)}
                style={{
                  flex: 1, height: 26, borderRadius: 4, cursor: "pointer",
                  fontFamily: "Inter, sans-serif", fontWeight: beats === n ? 600 : 400,
                  fontSize: "0.75rem",
                  background: beats === n ? "var(--charcoal)" : "var(--cream)",
                  border: `1px solid ${beats === n ? "var(--charcoal)" : "var(--border)"}`,
                  color: beats === n ? "var(--white)" : "var(--muted)",
                  transition: "all 0.12s",
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sound mode + accent */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={() => setAccentOn(a => !a)}
          style={{
            flex: 1, height: 28, borderRadius: 4, cursor: "pointer",
            fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: "0.6875rem",
            background: accentOn ? "rgba(76,175,132,0.1)" : "var(--cream)",
            border: `1px solid ${accentOn ? "#4CAF84" : "var(--border)"}`,
            color: accentOn ? "#4CAF84" : "var(--muted)",
            transition: "all 0.12s",
          }}
        >
          Accent 1
        </button>
        <div style={{
          flex: 1, display: "flex",
          border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden",
        }}>
          {(["click", "voice"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setSoundMode(mode)}
              style={{
                flex: 1, height: 26, cursor: "pointer", border: "none",
                fontFamily: "Inter, sans-serif", fontWeight: soundMode === mode ? 600 : 400,
                fontSize: "0.6875rem",
                background: soundMode === mode ? "var(--charcoal)" : "transparent",
                color: soundMode === mode ? "var(--white)" : "var(--muted)",
                transition: "all 0.12s",
              }}
            >
              {mode === "click" ? "Click" : "Tone"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
