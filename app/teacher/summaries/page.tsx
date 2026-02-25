import Link from "next/link";

export default function Summaries() {
  const summaries = [
    { date:"Feb 22, 2025", student:"Emma Chen", excerpt:"Good progress on Bach. LH measures 9-12 need work…", goals:3 },
    { date:"Feb 15, 2025", student:"Emma Chen", excerpt:"Started hands-together on Bach Minuet. Scales looking solid.", goals:2 },
    { date:"Feb 8, 2025", student:"Emma Chen", excerpt:"Excellent scale work. Introduced Bach Minuet in G.", goals:4 },
  ];
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.5rem" }}>
        <div>
          <h1 style={{ fontFamily:"Nunito,sans-serif", fontWeight:800, fontSize:"1.4rem", color:"var(--charcoal)", marginBottom:"0.25rem" }}>Lesson Summaries</h1>
          <p style={{ color:"var(--muted)", fontSize:"0.875rem" }}>Write summaries to generate path nodes automatically.</p>
        </div>
        <Link href="/teacher/summaries/new" style={{ background:"var(--peach)", color:"white", padding:"0.7rem 1.25rem", borderRadius:100, textDecoration:"none", fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.875rem" }}>+ New Summary</Link>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem", maxWidth:680 }}>
        {summaries.map((s,i) => (
          <div key={i} style={{ background:"var(--white)", borderRadius:20, padding:"1.25rem", border:"1.5px solid var(--border)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.5rem" }}>
              <span style={{ fontFamily:"Nunito,sans-serif", fontWeight:700, fontSize:"0.875rem", color:"var(--charcoal)" }}>{s.date}</span>
              <span style={{ background:"var(--sage-bg)", color:"var(--sage)", padding:"0.2rem 0.6rem", borderRadius:100, fontSize:"0.72rem", fontFamily:"Nunito,sans-serif", fontWeight:700 }}>{s.goals} goals created</span>
            </div>
            <p style={{ fontSize:"0.85rem", color:"var(--muted)" }}>{s.excerpt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}