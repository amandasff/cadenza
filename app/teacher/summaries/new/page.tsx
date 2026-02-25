"use client";
import { useState } from "react";
import Link from "next/link";

const suggested = [
  { id:1, title:"Practice Bach LH mm. 9-12 at 50 BPM", area:"technique", color:"var(--sage)", bg:"var(--sage-bg)", icon:"🌿", points:100, boss:false },
  { id:2, title:"Bach mm. 9-12 HT at 70 BPM", area:"repertoire", color:"var(--rose)", bg:"var(--rose-bg)", icon:"🌸", points:150, boss:true },
  { id:3, title:"Clementi Sonatina mvt 1 read-through", area:"repertoire", color:"var(--rose)", bg:"var(--rose-bg)", icon:"🌸", points:100, boss:false },
];

export default function NewSummary() {
  const [text, setText] = useState("Good progress on Bach today. LH measures 9-12 need more work — try isolating at 50 BPM. Ready to start the Clementi Sonatina next week.");
  const [showSuggested, setShowSuggested] = useState(false);
  const [selected, setSelected] = useState<number[]>([0,1,2]);
  const [created, setCreated] = useState(false);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"1.5rem" }}>
        <Link href="/teacher/summaries" style={{ color:"var(--muted)", textDecoration:"none", fontSize:"1.1rem" }}>←</Link>
        <h1 style={{ fontFamily:"Nunito,sans-serif", fontWeight:800, fontSize:"1.4rem", color:"var(--charcoal)" }}>Write Lesson Summary</h1>
      </div>
      <div className="r-two-col" style={{ gridTemplateColumns:"1fr 300px" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ background:"var(--white)", borderRadius:20, padding:"1.5rem", border:"1.5px solid var(--border)" }}>
            <div style={{ display:"flex", gap:"1rem", marginBottom:"1rem", flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:160 }}>
                <label style={{ display:"block", fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.72rem", color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.4rem" }}>Student</label>
                <select style={{ width:"100%", borderRadius:12, border:"1.5px solid var(--border)", padding:"0.65rem 0.875rem", fontFamily:"Nunito,sans-serif", fontWeight:600, fontSize:"0.875rem", background:"var(--cream)", color:"var(--charcoal)", outline:"none" }}><option>Emma Chen</option><option>Liam Park</option></select>
              </div>
              <div>
                <label style={{ display:"block", fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.72rem", color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.4rem" }}>Date</label>
                <input type="date" defaultValue="2025-02-22" style={{ borderRadius:12, border:"1.5px solid var(--border)", padding:"0.65rem 0.875rem", fontFamily:"Nunito,sans-serif", fontSize:"0.875rem", background:"var(--cream)", color:"var(--charcoal)", outline:"none" }} />
              </div>
            </div>
            <label style={{ display:"block", fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.72rem", color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.4rem" }}>Summary</label>
            <textarea value={text} onChange={e=>setText(e.target.value)} rows={5} style={{ width:"100%", borderRadius:12, border:"1.5px solid var(--border)", padding:"0.75rem 1rem", fontFamily:"DM Sans,sans-serif", fontSize:"0.9rem", outline:"none", background:"var(--cream)", color:"var(--charcoal)", resize:"vertical", lineHeight:1.6 }} />
            <button onClick={()=>setShowSuggested(true)} style={{ marginTop:"1rem", background:"var(--sky-bg)", color:"var(--sky)", border:"1.5px solid var(--sky-light)", borderRadius:100, padding:"0.65rem 1.25rem", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.875rem" }}>✨ Suggest Path Nodes</button>
          </div>          {showSuggested && (
            <div style={{ background:"var(--white)", borderRadius:20, padding:"1.5rem", border:"1.5px solid var(--border)" }}>
              <div style={{ fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.875rem", color:"var(--charcoal)", marginBottom:"1rem" }}>Suggested Goals</div>
              <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
                {suggested.map((g,i) => (
                  <div key={g.id} onClick={()=>setSelected(s=>s.includes(i)?s.filter(x=>x!==i):[...s,i])} style={{ display:"flex", alignItems:"flex-start", gap:"0.75rem", padding:"0.875rem 1rem", border:`1.5px solid ${selected.includes(i)?g.color:"var(--border)"}`, borderRadius:16, cursor:"pointer", background:selected.includes(i)?g.bg:"var(--cream)", transition:"all 0.15s" }}>
                    <div style={{ width:20, height:20, borderRadius:6, border:`2px solid ${g.color}`, background:selected.includes(i)?g.color:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>{selected.includes(i)&&<span style={{ color:"white", fontSize:"0.7rem" }}>✓</span>}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.85rem", color:"var(--charcoal)" }}>{g.title}</div>
                      <div style={{ display:"flex", gap:"0.5rem", marginTop:4 }}>
                        <span style={{ background:g.bg, color:g.color, padding:"0.15rem 0.5rem", borderRadius:100, fontSize:"0.68rem", fontFamily:"Nunito,sans-serif", fontWeight:700 }}>{g.icon} {g.area}</span>
                        <span style={{ color:"var(--butter)", fontSize:"0.72rem", fontFamily:"Nunito,sans-serif", fontWeight:700 }}>⭐ {g.points} pts</span>
                        {g.boss&&<span style={{ color:"var(--peach)", fontSize:"0.68rem", fontFamily:"Nunito,sans-serif", fontWeight:700 }}>Boss</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setCreated(true)} style={{ marginTop:"1rem", width:"100%", background:created?"var(--sage)":"var(--peach)", color:"white", border:"none", borderRadius:100, padding:"0.9rem", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontWeight:800, fontSize:"0.95rem", transition:"all 0.3s" }}>{created?`✓ ${selected.length} goals added!`:`Create ${selected.length} Goals & Update Path`}</button>
            </div>
          )}
        </div>
        <div style={{ background:"var(--white)", borderRadius:20, padding:"1.25rem", border:"1.5px solid var(--border)", height:"fit-content" }}>
          <div style={{ fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.72rem", color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.875rem" }}>Path Checkpoint</div>
          <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.875rem", background:"var(--peach-bg)", borderRadius:16, border:"1.5px solid var(--peach-light)" }}>
            <span style={{ fontSize:"1.5rem" }}>🏕️</span>
            <div>
              <div style={{ fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.85rem", color:"var(--charcoal)" }}>Lesson Checkpoint</div>
              <div style={{ fontSize:"0.72rem", color:"var(--muted)" }}>Feb 22, 2025 · auto-added</div>
            </div>
          </div>
          <p style={{ fontSize:"0.78rem", color:"var(--muted)", marginTop:"0.75rem", lineHeight:1.5 }}>A checkpoint node will mark this lesson review on the student's path.</p>
        </div>
      </div>
    </div>
  );
}