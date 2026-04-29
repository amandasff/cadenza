"use client";
import React, { useState } from "react";
import { RCM_PIANO_LEVELS, getRCMLevel } from "../../../lib/data/rcmPianoRequirements";

export default function RcmPiano() {
  const [selectedLevel, setSelectedLevel] = useState("3");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const levels = Object.keys(RCM_PIANO_LEVELS).sort((a, b) => {
    const order = ["prep-a", "prep-b", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    return order.indexOf(a) - order.indexOf(b);
  });

  const current = getRCMLevel(selectedLevel);
  if (!current) return null;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div style={{ maxWidth: "100%" }}>
      {/* Level selector */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.625rem",
          }}
        >
          Select Level
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
          {levels.map((level) => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              style={{
                padding: "0.5rem 0.875rem",
                borderRadius: 6,
                border: "1px solid var(--border-strong)",
                background: selectedLevel === level ? "#B85C3A" : "transparent",
                color: selectedLevel === level ? "white" : "var(--charcoal)",
                fontFamily: "Inter, sans-serif",
                fontSize: "0.8125rem",
                fontWeight: selectedLevel === level ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {RCM_PIANO_LEVELS[level].name}
            </button>
          ))}
        </div>
      </div>

      {/* Marks breakdown */}
      <div
        style={{
          background: "var(--cream)",
          borderRadius: 10,
          padding: "1.25rem",
          marginBottom: "1.75rem",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: "0.875rem",
            color: "var(--charcoal)",
            marginBottom: "1rem",
          }}
        >
          {current.level} — Total Marks: {current.marks.total} (Pass: 60)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
          {[
            { label: "Repertoire", marks: current.marks.repertoire },
            { label: "Technical Tests", marks: current.marks.technicalTests },
            ...(current.marks.etudes > 0 ? [{ label: "Etudes", marks: current.marks.etudes }] : []),
            { label: "Musicianship", marks: current.marks.musicianship },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "var(--white)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "0.75rem",
              }}
            >
              <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#B85C3A" }}>
                {item.marks}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Repertoire */}
      <ExpandableSection
        title="Repertoire"
        icon="🎵"
        isExpanded={expandedSection === "repertoire"}
        onToggle={() => toggleSection("repertoire")}
      >
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {[
            { list: "A", data: current.repertoire.listA },
            { list: "B", data: current.repertoire.listB },
            { list: "C", data: current.repertoire.listC },
            { list: "D", data: current.repertoire.listD },
            { list: "E", data: current.repertoire.listE },
            { list: "F", data: current.repertoire.listF },
          ]
            .filter((item) => item.data)
            .map((item) => (
              <div
                key={item.list}
                style={{
                  background: "var(--white)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "0.875rem",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    color: "var(--charcoal)",
                    marginBottom: "0.25rem",
                  }}
                >
                  List {item.list}: {item.data!.name}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {item.data!.count} selection{item.data!.count !== 1 ? "s" : ""} required
                </div>
              </div>
            ))}

          <div
            style={{
              background: "rgba(184, 92, 58, 0.08)",
              border: "1px solid rgba(184, 92, 58, 0.2)",
              borderRadius: 6,
              padding: "0.875rem",
            }}
          >
            <div style={{ fontSize: "0.8125rem", color: "var(--charcoal)", fontWeight: 600, marginBottom: "0.25rem" }}>
              Memory Marks
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {current.repertoire.memory.marksPerPiece} marks per memorized selection (up to {current.repertoire.memory.totalMarks} total)
            </div>
          </div>
        </div>
      </ExpandableSection>

      {/* Technical Tests */}
      <ExpandableSection
        title="Technical Tests"
        icon="🎹"
        isExpanded={expandedSection === "technical"}
        onToggle={() => toggleSection("technical")}
      >
        <div style={{ display: "grid", gap: "1rem" }}>
          {/* Scales */}
          {current.technicalTests.scales.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.625rem" }}>
                Scales
              </div>
              <div style={{ display: "grid", gap: "0.625rem" }}>
                {current.technicalTests.scales.map((scale, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--white)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "0.75rem",
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
                      {scale.type} {scale.style && `(${scale.style})`}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
                      Keys: {scale.keys.join(", ")}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Tempo: ♩ = {scale.tempo} {scale.hands && `(${scale.hands})`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chords */}
          {current.technicalTests.chords.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.625rem" }}>
                Chords
              </div>
              <div style={{ display: "grid", gap: "0.625rem" }}>
                {current.technicalTests.chords.map((chord, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--white)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "0.75rem",
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
                      {chord.type}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
                      Keys: {chord.keys.join(", ")}
                    </div>
                    {chord.tempo && (
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        Tempo: ♩ = {chord.tempo}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chromatic */}
          {current.technicalTests.chromatic && (
            <div style={{
              background: "var(--white)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "0.75rem",
            }}>
              <div style={{ fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
                Chromatic Scale
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
                Starting on {current.technicalTests.chromatic.startingNote}, {current.technicalTests.chromatic.octaves} octave(s)
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Tempo: ♩ = {current.technicalTests.chromatic.tempo} ({current.technicalTests.chromatic.hands})
              </div>
            </div>
          )}
        </div>
      </ExpandableSection>

      {/* Musicianship */}
      <ExpandableSection
        title="Musicianship"
        icon="👂"
        isExpanded={expandedSection === "musicianship"}
        onToggle={() => toggleSection("musicianship")}
      >
        <div style={{ display: "grid", gap: "1rem" }}>
          {/* Ear Tests */}
          {current.musicianship.earTests.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.625rem" }}>
                Ear Tests
              </div>
              <div style={{ display: "grid", gap: "0.625rem" }}>
                {current.musicianship.earTests.map((test, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--white)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "0.75rem",
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
                      {test.skill} {test.marks && <span style={{ color: "var(--muted)", fontWeight: 400 }}>({test.marks} marks)</span>}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {test.description}
                    </div>
                    {test.details && (
                      <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem", fontStyle: "italic" }}>
                        {test.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sight Reading */}
          {current.musicianship.sightReading.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.625rem" }}>
                Sight Reading
              </div>
              <div style={{ display: "grid", gap: "0.625rem" }}>
                {current.musicianship.sightReading.map((test, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--white)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "0.75rem",
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
                      {test.type} {test.marks && <span style={{ color: "var(--muted)", fontWeight: 400 }}>({test.marks} marks)</span>}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {test.description}
                    </div>
                    {test.details && (
                      <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem", fontStyle: "italic" }}>
                        {test.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ExpandableSection>

      {/* Etudes */}
      {current.marks.etudes > 0 && (
        <ExpandableSection
          title="Etudes"
          icon="🎼"
          isExpanded={expandedSection === "etudes"}
          onToggle={() => toggleSection("etudes")}
        >
          <div
            style={{
              background: "var(--white)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "1rem",
            }}
          >
            <div style={{ fontSize: "0.8125rem", color: "var(--charcoal)", lineHeight: "1.5" }}>
              <div style={{ marginBottom: "0.5rem" }}>
                <strong>{current.etudes.count} etude{current.etudes.count !== 1 ? "s" : ""}</strong> required
              </div>
              {current.etudes.canSubstitutePopular && (
                <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                  ✓ Can substitute with popular selection
                </div>
              )}
              {current.etudes.notes && (
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.5rem" }}>
                  {current.etudes.notes}
                </div>
              )}
            </div>
          </div>
        </ExpandableSection>
      )}
    </div>
  );
}

function ExpandableSection({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--white)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        marginBottom: "1rem",
        overflow: "hidden",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.25rem",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span style={{ fontSize: "1rem" }}>{icon}</span>
          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)" }}>
            {title}
          </span>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          {isExpanded ? "▲ hide" : "▼ show"}
        </span>
      </button>

      {isExpanded && (
        <div style={{ padding: "1.25rem", borderTop: "1px solid var(--border)" }}>
          {children}
        </div>
      )}
    </div>
  );
}
