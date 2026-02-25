"use client";
import { useState, use } from "react";
import Link from "next/link";

const initialComments = [
  { id:1, time:"2:34", text:"Watch LH fingering here — try 2-1 not 3-1" },
  { id:2, time:"3:10", text:"Beautiful phrasing improvement here! 🎉" },
  { id:3, time:"4:45", text:"Slight rush — slow metronome to 55 BPM" },
];
const segments = [
  { label:"Scales C Major", color:"var(--sage)", width:"28%" },
  { label:"Bach Minuet mm. 1–8", color:"var(--rose)", width:"60%" },
  { label:"Arpeggios", color:"var(--sage)", width:"12%" },
];

export default function RecordingReview({ params }: { params: Promise<{ id:string }> }) {
  use(params);
  const [comments, setComments] = useState(initialComments);
  const [newComment, setNewComment] = useState("");
  const [approved, setApproved] = useState<null|boolean>(null);
  const [playhead, setPlayhead] = useState(30);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"1.5rem" }}>
        <Link href="/teacher/review" style={{ color:"var(--muted)", textDecoration:"none", fontSize:"1.1rem" }}>←</Link>
        <div>
          <h1 style={{ fontFamily:"Nunito,sans-serif", fontWeight:800, fontSize:"1.2rem", color:"var(--charcoal)" }}>Emma Chen — Recording Review</h1>
          <p style={{ color:"var(--muted)", fontSize:"0.8rem" }}>Feb 22, 2025 · 23 minutes</p>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:"1.5rem" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ background:"var(--white)", borderRadius:20, padding:"1.25rem", border:"1.5px solid var(--border)" }}>
            <div style={{ fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.72rem", color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.75rem" }}>Student Reflection</div>
            <div style={{ display:"flex", gap:"2rem" }}>
              <div><div style={{ fontSize:"0.72rem", color:"var(--rose)", fontFamily:"Nunito,sans-serif", fontWeight:600 }}>Felt hard</div><div style={{ fontSize:"0.875rem", color:"var(--charcoal)", marginTop:2 }}>Measures 5-8 left hand</div></div>
              <div><div style={{ fontSize:"0.72rem", color:"var(--sage)", fontFamily:"Nunito,sans-serif", fontWeight:600 }}>Improved</div><div style={{ fontSize:"0.875rem", color:"var(--charcoal)", marginTop:2 }}>Right hand dynamics</div></div>
            </div>
          </div>
          <div style={{ background:"var(--white)", borderRadius:20, padding:"1.25rem", border:"1.5px solid var(--border)" }}>
            <div style={{ fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.72rem", color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.875rem" }}>Recording</div>
            <div style={{ display:"flex", marginBottom:"0.75rem", borderRadius:8, overflow:"hidden", height:26 }}>
              {segments.map((s,i) => <div key={i} style={{ width:s.width, background:s.color, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 4px" }}><span style={{ fontSize:"0.58rem", color:"white", fontFamily:"Nunito,sans-serif", fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.label}</span></div>)}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:2, height:72, background:"var(--cream)", borderRadius:12, padding:"0 0.75rem", marginBottom:"0.75rem", position:"relative", overflow:"hidden" }}>
              {Array.from({length:55}).map((_,i) => <div key={i} style={{ width:3, flexShrink:0, borderRadius:2, height:`${18+Math.sin(i*0.4)*16+Math.sin(i*0.2)*8+18}%`, background: i/55*100 < playhead/230*100 ? "var(--sky)" : "var(--border)" }} />)}
              <div style={{ position:"absolute", top:0, bottom:0, width:2, background:"var(--peach)", left:`${playhead/230*100}%` }} />
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.875rem" }}>
              <button style={{ width:34, height:34, borderRadius:100, background:"var(--peach)", border:"none", cursor:"pointer", color:"white", fontSize:"0.85rem" }}>▶</button>
              <input type="range" min={0} max={230} value={playhead} onChange={e=>setPlayhead(Number(e.target.value))} style={{ flex:1 }} />
              <span style={{ fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.8rem", color:"var(--muted)", minWidth:36 }}>{Math.floor(playhead/60)}:{String(playhead%60).padStart(2,"0")}</span>
              <select style={{ border:"1.5px solid var(--border)", borderRadius:8, padding:"0.2rem 0.4rem", fontFamily:"Nunito,sans-serif", fontSize:"0.72rem", background:"var(--cream)", cursor:"pointer" }}><option>1x</option><option>0.75x</option><option>0.5x</option></select>
            </div>
            <div style={{ display:"flex", gap:"0.5rem" }}>
              <input value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder={`Comment at ${Math.floor(playhead/60)}:${String(playhead%60).padStart(2,"0")}…`} style={{ flex:1, borderRadius:100, border:"1.5px solid var(--border)", padding:"0.5rem 0.875rem", fontFamily:"DM Sans,sans-serif", fontSize:"0.8rem", outline:"none", background:"var(--cream)" }} />
              <button onClick={() => { if(newComment.trim()){setComments(c=>[...c,{id:Date.now(),time:`${Math.floor(playhead/60)}:${String(playhead%60).padStart(2,"0")}`,text:newComment}]);setNewComment("");}}} style={{ background:"var(--sky)", color:"white", border:"none", borderRadius:100, padding:"0.5rem 1rem", cursor:"pointer", fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.8rem" }}>Add</button>
            </div>
          </div>
          <div style={{ display:"flex", gap:"0.75rem" }}>
            <button onClick={()=>setApproved(true)} style={{ flex:1, padding:"0.85rem", borderRadius:100, border:"none", cursor:"pointer", background: approved===true?"var(--sage)":"var(--sage-bg)", color: approved===true?"white":"var(--sage)", fontFamily:"Nunito,sans-serif", fontWeight:800, fontSize:"0.9rem", transition:"all 0.15s" }}>✓ Approve Goal</button>
            <button onClick={()=>setApproved(false)} style={{ flex:1, padding:"0.85rem", borderRadius:100, border:"none", cursor:"pointer", background: approved===false?"var(--rose)":"var(--rose-bg)", color: approved===false?"white":"var(--rose)", fontFamily:"Nunito,sans-serif", fontWeight:800, fontSize:"0.9rem", transition:"all 0.15s" }}>↩ Needs More Work</button>
          </div>
        </div>
        <div style={{ background:"var(--white)", borderRadius:20, padding:"1.25rem", border:"1.5px solid var(--border)", height:"fit-content" }}>
          <div style={{ fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.72rem", color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"0.875rem" }}>Comments ({comments.length})</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.875rem" }}>
            {comments.map(c => (
              <div key={c.id} style={{ borderLeft:"3px solid var(--sky-light)", paddingLeft:"0.875rem" }}>
                <span style={{ fontFamily:"Nunito,sans-serif", fontWeight:700, color:"var(--sky)", fontSize:"0.75rem" }}>{c.time}</span>
                <p style={{ fontSize:"0.83rem", color:"var(--charcoal)", lineHeight:1.5, marginTop:2 }}>{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}