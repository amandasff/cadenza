"use client";
import Link from "next/link";

const sessions = [
  { id:1, student:"Emma Chen", duration:"23 min", segments:2, date:"Feb 22", time:"6:48 PM", hard:"Measures 5-8 left hand", improved:"Right hand dynamics" },
  { id:2, student:"Liam Park", duration:"18 min", segments:1, date:"Feb 21", time:"5:30 PM", hard:"Rhythm in section B", improved:"Posture at the piano" },
];

export default function ReviewQueue() {
  return (
    <div>
      <h1 style={{ fontFamily:"Nunito,sans-serif", fontWeight:800, fontSize:"1.4rem", color:"var(--charcoal)", marginBottom:"0.25rem" }}>Review Queue</h1>
      <p style={{ color:"var(--muted)", fontSize:"0.875rem", marginBottom:"1.5rem" }}>{sessions.length} sessions waiting</p>
      <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem", maxWidth:680 }}>
        {sessions.map(s => (
          <Link key={s.id} href={`/teacher/review/${s.id}`} style={{ background:"var(--white)", borderRadius:20, padding:"1.25rem", border:"1.5px solid var(--border)", textDecoration:"none", display:"block" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.75rem" }}>
              <div>
                <div style={{ fontFamily:"Nunito,sans-serif", fontWeight:800, fontSize:"1rem", color:"var(--charcoal)" }}>{s.student}</div>
                <div style={{ fontSize:"0.78rem", color:"var(--muted)" }}>{s.date} · {s.time}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.875rem", color:"var(--peach)" }}>{s.duration}</div>
                <div style={{ fontSize:"0.72rem", color:"var(--muted)" }}>{s.segments} segments</div>
              </div>
            </div>
            <div style={{ background:"var(--cream)", borderRadius:12, padding:"0.75rem", display:"flex", flexDirection:"column", gap:"0.35rem" }}>
              <div style={{ fontSize:"0.78rem" }}><span style={{ color:"var(--rose)", fontWeight:600 }}>Hard: </span><span style={{ color:"var(--charcoal)" }}>{s.hard}</span></div>
              <div style={{ fontSize:"0.78rem" }}><span style={{ color:"var(--sage)", fontWeight:600 }}>Improved: </span><span style={{ color:"var(--charcoal)" }}>{s.improved}</span></div>
            </div>
            <div style={{ marginTop:"0.75rem", color:"var(--sky)", fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.8rem" }}>Listen & Review →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}