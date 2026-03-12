"use client";
import { useRef, useState, useEffect } from "react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
  }, [speed]);

  // Reset when src changes
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  function onLoadedMetadata() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isFinite(audio.duration)) setDuration(audio.duration);
  }

  function onDurationChange() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
  }

  function onTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || dragging) return;
    setCurrentTime(audio.currentTime);
  }

  function onEnded() {
    setPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      await audio.play();
      setPlaying(true);
    }
  }

  function onScrubChange(e: React.ChangeEvent<HTMLInputElement>) {
    setScrubValue(Number(e.target.value));
  }

  function onScrubStart() {
    setDragging(true);
    setScrubValue(currentTime);
  }

  function onScrubEnd() {
    setDragging(false);
    setCurrentTime(scrubValue);
    if (audioRef.current) audioRef.current.currentTime = scrubValue;
  }

  const progress = duration > 0 ? (dragging ? scrubValue : currentTime) / duration : 0;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={onDurationChange}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        preload="metadata"
      />

      {/* Seek bar */}
      <div style={{ position: "relative", height: 18, display: "flex", alignItems: "center" }}>
        {/* Track */}
        <div style={{ position: "absolute", left: 0, right: 0, height: 4, background: "var(--border)", borderRadius: 2 }}>
          {/* Filled portion */}
          <div style={{
            position: "absolute", left: 0, top: 0, height: "100%",
            width: `${progress * 100}%`,
            background: "var(--charcoal)", borderRadius: 2, pointerEvents: "none",
          }} />
          {/* Thumb knob */}
          <div style={{
            position: "absolute", top: "50%",
            left: `${progress * 100}%`,
            transform: "translate(-50%, -50%)",
            width: 12, height: 12, borderRadius: "50%",
            background: "var(--charcoal)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            pointerEvents: "none",
            transition: dragging ? "none" : "left 0.05s",
          }} />
        </div>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.01}
          value={dragging ? scrubValue : currentTime}
          onMouseDown={onScrubStart}
          onTouchStart={onScrubStart}
          onChange={onScrubChange}
          onMouseUp={onScrubEnd}
          onTouchEnd={onScrubEnd}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            opacity: 0, cursor: "pointer", margin: 0,
          }}
        />
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        {/* Play/pause */}
        <button
          onClick={togglePlay}
          style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "var(--charcoal)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          {playing ? (
            <svg width="10" height="12" viewBox="0 0 10 12" fill="var(--white)">
              <rect x="0" y="0" width="3.5" height="12" rx="1" />
              <rect x="6.5" y="0" width="3.5" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="10" height="12" viewBox="0 0 10 12" fill="var(--white)">
              <path d="M1 0.5L9.5 6L1 11.5V0.5Z" />
            </svg>
          )}
        </button>

        {/* Time */}
        <span style={{ fontSize: "0.75rem", color: "var(--muted)", letterSpacing: "0.02em", minWidth: 70 }}>
          {fmt(dragging ? scrubValue : currentTime)} / {fmt(duration)}
        </span>

        {/* Speed */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.25rem" }}>
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => {
                setSpeed(s);
                if (audioRef.current) audioRef.current.playbackRate = s;
              }}
              style={{
                padding: "0.125rem 0.375rem", fontSize: "0.6875rem",
                fontFamily: "Inter, sans-serif", fontWeight: speed === s ? 600 : 400,
                border: `1px solid ${speed === s ? "var(--charcoal)" : "var(--border)"}`,
                borderRadius: 3, background: speed === s ? "var(--charcoal)" : "transparent",
                color: speed === s ? "var(--white)" : "var(--muted)",
                cursor: "pointer", letterSpacing: "0.02em",
              }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
