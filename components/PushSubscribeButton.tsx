"use client";
import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

type State = "loading" | "unsupported" | "subscribed" | "ready" | "denied";

export default function PushSubscribeButton() {
  const [state, setState] = useState<State>("loading");
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) { setState("unsupported"); return; }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }

    navigator.serviceWorker.register("/sw.js")
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setState(sub ? "subscribed" : "ready"))
      .catch(() => setState("unsupported"));
  }, []);

  async function subscribe() {
    setSubscribing(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      setState("subscribed");
    } catch {
      if (Notification.permission === "denied") setState("denied");
    } finally {
      setSubscribing(false);
    }
  }

  if (state !== "ready") return null;

  return (
    <div style={{ padding: "0 1.5rem 1rem" }}>
      <button
        onClick={subscribe}
        disabled={subscribing}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          padding: "0.625rem 1rem",
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          cursor: subscribing ? "default" : "pointer",
          fontFamily: "Inter, sans-serif",
          fontSize: "0.8125rem",
          color: "var(--charcoal)",
          fontWeight: 500,
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: "1rem" }}>🔔</span>
        {subscribing ? "Enabling…" : "Get practice reminders"}
        <span style={{ marginLeft: "auto", fontSize: "0.6875rem", color: "var(--muted)", fontWeight: 400 }}>
          Tap to enable
        </span>
      </button>
    </div>
  );
}
