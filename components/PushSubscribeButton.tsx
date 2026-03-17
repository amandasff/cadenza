"use client";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

type State = "loading" | "unsupported" | "subscribed" | "ready" | "denied";

export default function PushSubscribeButton({
  title = "Daily practice reminders",
  description = "A nudge each day keeps your streak alive",
}: {
  title?: string;
  description?: string;
} = {}) {
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
      <div style={{
        background: "linear-gradient(135deg, #FFF8EC 0%, #FFF2D8 100%)",
        border: "1px solid #EDD08A",
        borderRadius: 12,
        padding: "0.875rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.875rem",
      }}>
        <Bell size={28} strokeWidth={1.5} color="#8A7A50" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "0.8125rem", color: "#2C2824", marginBottom: "0.2rem" }}>
            {title}
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: "0.6875rem", color: "#8A7A50", lineHeight: 1.4 }}>
            {description}
          </div>
        </div>
        <button
          onClick={subscribe}
          disabled={subscribing}
          style={{
            flexShrink: 0,
            background: subscribing ? "#C8A84B" : "#C8911A",
            border: "none",
            borderRadius: 6,
            padding: "0.5rem 0.875rem",
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: "0.75rem",
            color: "#fff",
            cursor: subscribing ? "default" : "pointer",
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
          }}
        >
          {subscribing ? "Enabling…" : "Enable →"}
        </button>
      </div>
    </div>
  );
}
