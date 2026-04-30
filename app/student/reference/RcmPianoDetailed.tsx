"use client";
import React, { useState, useMemo } from "react";
import {
  RCM_LEVELS_DETAILED,
  getRCMLevelDetailed,
  type RCMLevelDetailed,
} from "../../../lib/data/rcmPianoDetailedRequirements";

export default function RcmPianoDetailed() {
  const [selectedLevel, setSelectedLevel] = useState("prep-a");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    repertoire: true,
    scales: true,
    chords: true,
    etudes: true,
    earTests: true,
    sightReading: true,
  });
  const [searchQuery, setSearchQuery] = useState("");

  const levels = [
    { id: "prep-a", label: "Prep A" },
    { id: "prep-b", label: "Prep B" },
    { id: "1", label: "1" },
    { id: "2", label: "2" },
  ];

  const current = getRCMLevelDetailed(selectedLevel);
  if (!current) return null;

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase();
    const matches = {
      pieces: [] as Array<{ title: string; composer: string; listName: string }>,
      composers: new Set<string>(),
      scales: [] as string[],
      chords: [] as string[],
      etudes: [] as Array<{ title: string; composer: string }>,
    };

    // Search pieces
    current.repertoire.lists.forEach((list) => {
      list.pieces.forEach((piece) => {
        if (
          piece.title.toLowerCase().includes(query) ||
          piece.composer.toLowerCase().includes(query)
        ) {
          matches.pieces.push({
            title: piece.title,
            composer: piece.composer,
            listName: list.name,
          });
          matches.composers.add(piece.composer);
        }
      });
    });

    // Search scales
    current.technicalTests.scales.forEach((scale) => {
      if (scale.type.toLowerCase().includes(query)) {
        matches.scales.push(`${scale.type} (${scale.keys.join(", ")})`);
      }
    });

    // Search chords
    current.technicalTests.chords.forEach((chord) => {
      if (chord.type.toLowerCase().includes(query)) {
        matches.chords.push(`${chord.type} (${chord.keys.join(", ")})`);
      }
    });

    // Search etudes
    current.etudes.list.forEach((etude) => {
      if (
        etude.title.toLowerCase().includes(query) ||
        etude.composer.toLowerCase().includes(query)
      ) {
        matches.etudes.push({ title: etude.title, composer: etude.composer });
      }
    });

    return matches;
  }, [searchQuery, current]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div style={{ maxWidth: "100%" }}>
      {/* Level Selector */}
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
              key={level.id}
              onClick={() => {
                setSelectedLevel(level.id);
                setSearchQuery("");
              }}
              style={{
                padding: "0.5rem 0.875rem",
                borderRadius: 6,
                border: "1px solid var(--border-strong)",
                background: selectedLevel === level.id ? "#B85C3A" : "transparent",
                color: selectedLevel === level.id ? "white" : "var(--charcoal)",
                fontFamily: "Inter, sans-serif",
                fontSize: "0.8125rem",
                fontWeight: selectedLevel === level.id ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Box */}
      <div
        style={{
          background: "var(--cream)",
          borderRadius: 10,
          padding: "1.25rem",
          marginBottom: "1.75rem",
        }}
      >
        <label
          style={{
            display: "block",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.625rem",
          }}
        >
          🔍 Search
        </label>
        <input
          type="text"
          placeholder="Search by piece name, composer, technique, or etude..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: 6,
            border: "1px solid var(--border)",
            fontFamily: "Inter, sans-serif",
            fontSize: "0.8125rem",
            boxSizing: "border-box",
          }}
        />
        {searchQuery && searchResults && (
          <div style={{ marginTop: "1rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
            Found: {searchResults.pieces.length} pieces, {searchResults.scales.length} scale
            techniques, {searchResults.chords.length} chord techniques, {searchResults.etudes.length}{" "}
            etudes
          </div>
        )}
      </div>

      {/* Search Results Display */}
      {searchQuery && searchResults && (
        <div
          style={{
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "1.25rem",
            marginBottom: "1.75rem",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--charcoal)", marginBottom: "1rem" }}>
            Search Results for "{searchQuery}"
          </div>

          {/* Pieces */}
          {searchResults.pieces.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
                🎵 Pieces ({searchResults.pieces.length})
              </div>
              <div style={{ display: "grid", gap: "0.375rem" }}>
                {searchResults.pieces.map((piece, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--cream)",
                      borderRadius: 6,
                      padding: "0.625rem",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <div style={{ fontWeight: 500, color: "var(--charcoal)" }}>{piece.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {piece.composer} • {piece.listName}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scales */}
          {searchResults.scales.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
                🎹 Scale Techniques ({searchResults.scales.length})
              </div>
              <div style={{ display: "grid", gap: "0.375rem" }}>
                {searchResults.scales.map((scale, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--cream)",
                      borderRadius: 6,
                      padding: "0.625rem",
                      fontSize: "0.8125rem",
                      color: "var(--charcoal)",
                    }}
                  >
                    {scale}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chords */}
          {searchResults.chords.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
                🎼 Chord Techniques ({searchResults.chords.length})
              </div>
              <div style={{ display: "grid", gap: "0.375rem" }}>
                {searchResults.chords.map((chord, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--cream)",
                      borderRadius: 6,
                      padding: "0.625rem",
                      fontSize: "0.8125rem",
                      color: "var(--charcoal)",
                    }}
                  >
                    {chord}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Etudes */}
          {searchResults.etudes.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
                📚 Etudes ({searchResults.etudes.length})
              </div>
              <div style={{ display: "grid", gap: "0.375rem" }}>
                {searchResults.etudes.map((etude, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--cream)",
                      borderRadius: 6,
                      padding: "0.625rem",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <div style={{ fontWeight: 500, color: "var(--charcoal)" }}>{etude.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{etude.composer}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Level Header */}
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
            marginBottom: "0.5rem",
          }}
        >
          {current.level}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.75rem" }}>
          <div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginBottom: 4 }}>
              Total Marks
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#B85C3A" }}>
              {current.totalMarks}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginBottom: 4 }}>
              Pass Mark
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#B85C3A" }}>
              {current.passMarks}
            </div>
          </div>
        </div>
      </div>

      {/* Repertoire */}
      <ExpandableSection
        title="Repertoire"
        icon="🎵"
        isExpanded={expandedSections.repertoire}
        onToggle={() => toggleSection("repertoire")}
      >
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {current.repertoire.lists.map((list, idx) => (
            <div key={idx}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  color: "var(--charcoal)",
                  marginBottom: "0.625rem",
                }}
              >
                {list.name}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
                Select {list.count} piece{list.count !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "grid", gap: "0.375rem" }}>
                {list.pieces.map((piece, i) => (
                  <div
                    key={i}
                    style={{
                      background: "var(--white)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "0.75rem",
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)" }}>
                      {piece.title}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {piece.composer}
                      {piece.page && ` • p. ${piece.page}`}
                      {piece.inCelebrationSeries && " • Celebration Series"}
                    </div>
                  </div>
                ))}
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
              💾 Memory Marks
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {current.repertoire.memoryMarksPerPiece} marks per memorized selection (up to{" "}
              {current.repertoire.memoryMarksCeiling} total)
            </div>
          </div>
        </div>
      </ExpandableSection>

      {/* Scales */}
      <ExpandableSection
        title="Scales"
        icon="🎹"
        isExpanded={expandedSections.scales}
        onToggle={() => toggleSection("scales")}
      >
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {current.technicalTests.scales.map((scale, i) => (
            <div
              key={i}
              style={{
                background: "var(--white)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "0.875rem",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
                {scale.type}
              </div>
              <div style={{ display: "grid", gap: "0.25rem", fontSize: "0.75rem", color: "var(--muted)" }}>
                <div>
                  <strong>Keys:</strong> {scale.keys.join(", ")}
                </div>
                <div>
                  <strong>Tempo:</strong> ♩ = {scale.tempo} ({scale.hands})
                </div>
                {scale.octaves && (
                  <div>
                    <strong>Octaves:</strong> {scale.octaves}
                  </div>
                )}
                {scale.style && (
                  <div>
                    <strong>Style:</strong> {scale.style}
                  </div>
                )}
                {scale.notes && (
                  <div>
                    <strong>Notes:</strong> {scale.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ExpandableSection>

      {/* Chords */}
      <ExpandableSection
        title="Chords"
        icon="🎼"
        isExpanded={expandedSections.chords}
        onToggle={() => toggleSection("chords")}
      >
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {current.technicalTests.chords.map((chord, i) => (
            <div
              key={i}
              style={{
                background: "var(--white)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "0.875rem",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.5rem" }}>
                {chord.type}
              </div>
              <div style={{ display: "grid", gap: "0.25rem", fontSize: "0.75rem", color: "var(--muted)" }}>
                <div>
                  <strong>Keys:</strong> {chord.keys.join(", ")}
                </div>
                {chord.tempo && (
                  <div>
                    <strong>Tempo:</strong> ♩ = {chord.tempo} {chord.hands && `(${chord.hands})`}
                  </div>
                )}
                {chord.inversions && (
                  <div>
                    <strong>Inversions:</strong> {chord.inversions}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ExpandableSection>

      {/* Etudes */}
      {current.etudes.count > 0 && (
        <ExpandableSection
          title={`Etudes (${current.etudes.count} required)`}
          icon="📚"
          isExpanded={expandedSections.etudes}
          onToggle={() => toggleSection("etudes")}
        >
          <div style={{ display: "grid", gap: "0.375rem" }}>
            {current.etudes.list.map((etude, i) => (
              <div
                key={i}
                style={{
                  background: "var(--white)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "0.75rem",
                }}
              >
                <div style={{ fontWeight: 500, fontSize: "0.8125rem", color: "var(--charcoal)" }}>
                  {etude.title}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {etude.composer}
                  {etude.page && ` • p. ${etude.page}`}
                </div>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Ear Tests */}
      <ExpandableSection
        title="Ear Tests"
        icon="👂"
        isExpanded={expandedSections.earTests}
        onToggle={() => toggleSection("earTests")}
      >
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {current.musicianship.earTests.map((test, i) => (
            <div
              key={i}
              style={{
                background: "var(--white)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "0.875rem",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
                {test.skill} {test.marks && <span style={{ color: "var(--muted)", fontWeight: 400 }}>({test.marks} marks)</span>}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: "1.4" }}>
                {test.description}
              </div>
              {test.details && (
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.5rem", fontStyle: "italic" }}>
                  {test.details}
                </div>
              )}
              {test.intervals && test.intervals.length > 0 && (
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.5rem" }}>
                  <strong>Intervals:</strong> {test.intervals.join(", ")}
                </div>
              )}
              {test.timeSignatures && test.timeSignatures.length > 0 && (
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                  <strong>Time Signatures:</strong> {test.timeSignatures.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      </ExpandableSection>

      {/* Sight Reading */}
      <ExpandableSection
        title="Sight Reading"
        icon="📖"
        isExpanded={expandedSections.sightReading}
        onToggle={() => toggleSection("sightReading")}
      >
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {current.musicianship.sightReading.map((test, i) => (
            <div
              key={i}
              style={{
                background: "var(--white)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "0.875rem",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--charcoal)", marginBottom: "0.25rem" }}>
                {test.type} {test.marks && <span style={{ color: "var(--muted)", fontWeight: 400 }}>({test.marks} marks)</span>}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: "1.4" }}>
                {test.description}
              </div>
              {test.details && (
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.5rem", fontStyle: "italic" }}>
                  {test.details}
                </div>
              )}
              {test.timeSignatures && test.timeSignatures.length > 0 && (
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                  <strong>Time Signatures:</strong> {test.timeSignatures.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      </ExpandableSection>
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
