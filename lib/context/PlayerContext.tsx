"use client";
import React, { createContext, useContext, useState, useCallback } from "react";

export interface PlayerTrack {
  id: string;   // YouTube video ID
  title: string;
  thumbnail?: string;
}

interface PlayerContextValue {
  current: PlayerTrack | null;
  queue: PlayerTrack[];
  queueIndex: number;
  play: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  playIndex: (i: number) => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  addToQueue: (track: PlayerTrack) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);

  const current = queue[queueIndex] ?? null;

  const play = useCallback((track: PlayerTrack, newQueue?: PlayerTrack[]) => {
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.id === track.id);
      setQueueIndex(idx >= 0 ? idx : 0);
    } else {
      setQueue(prev => {
        const exists = prev.findIndex(t => t.id === track.id);
        if (exists >= 0) { setQueueIndex(exists); return prev; }
        const next = [...prev, track];
        setQueueIndex(next.length - 1);
        return next;
      });
    }
  }, []);

  const playIndex = useCallback((i: number) => {
    if (i >= 0 && i < queue.length) setQueueIndex(i);
  }, [queue.length]);

  const next = useCallback(() => {
    setQueueIndex(i => Math.min(i + 1, queue.length - 1));
  }, [queue.length]);

  const prev = useCallback(() => {
    setQueueIndex(i => Math.max(i - 1, 0));
  }, []);

  const stop = useCallback(() => {
    setQueue([]);
    setQueueIndex(0);
  }, []);

  const addToQueue = useCallback((track: PlayerTrack) => {
    setQueue(prev => prev.some(t => t.id === track.id) ? prev : [...prev, track]);
  }, []);

  return (
    <PlayerContext.Provider value={{ current, queue, queueIndex, play, playIndex, next, prev, stop, addToQueue }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
