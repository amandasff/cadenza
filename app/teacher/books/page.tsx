"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../../../lib/context/AuthContext";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import { Teacher } from "../../../lib/models/Teacher";
import { BookOpen, X, Upload, Plus, ChevronLeft, Trash2 } from "lucide-react";

// ─── Data Types ────────────────────────────────────────────────────────────────

interface BookRow {
  id: string;
  teacher_id: string;
  studio_id: string | null;
  title: string;
  publisher: string | null;
  cover_url: string | null;
  created_at: string;
}

interface BookPageRow {
  id: string;
  book_id: string;
  page_number: number;
  image_url: string;
  created_at: string;
}

interface BookWithPageCount extends BookRow {
  pageCount: number;
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--cream)",
  padding: "2rem 1.5rem",
  fontFamily: "Inter, sans-serif",
  color: "var(--charcoal)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "2rem",
  flexWrap: "wrap",
  gap: "1rem",
};

const headingStyle: React.CSSProperties = {
  fontFamily: "Cormorant Garamond, serif",
  fontSize: "2rem",
  fontWeight: 600,
  color: "var(--charcoal)",
  margin: 0,
  letterSpacing: "-0.01em",
};

const btnPrimaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  background: "var(--charcoal)",
  color: "var(--white)",
  border: "none",
  borderRadius: "6px",
  padding: "0.5rem 1rem",
  fontSize: "0.875rem",
  fontFamily: "Inter, sans-serif",
  cursor: "pointer",
  fontWeight: 500,
  transition: "opacity 0.15s",
};

const btnGhostStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  background: "none",
  color: "var(--charcoal)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  padding: "0.5rem 1rem",
  fontSize: "0.875rem",
  fontFamily: "Inter, sans-serif",
  cursor: "pointer",
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  fontSize: "0.875rem",
  fontFamily: "Inter, sans-serif",
  background: "var(--white)",
  color: "var(--charcoal)",
  outline: "none",
  boxSizing: "border-box",
};

const cardStyle: React.CSSProperties = {
  background: "var(--white)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "1.25rem",
  cursor: "pointer",
  transition: "border-color 0.15s, box-shadow 0.15s",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  background: "var(--cream)",
  color: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: "99px",
  padding: "0.125rem 0.625rem",
  fontSize: "0.75rem",
  fontWeight: 500,
  width: "fit-content",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
  borderRadius: "6px",
  padding: "0.75rem 1rem",
  fontSize: "0.875rem",
  marginBottom: "1rem",
};

const skeletonStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--cream) 25%, var(--border) 50%, var(--cream) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s infinite",
  borderRadius: "10px",
  height: "120px",
};

// ─── Inline Form ───────────────────────────────────────────────────────────────

function NewBookForm({
  onCancel,
  onCreated,
  teacherId,
  studioId,
}: {
  onCancel: () => void;
  onCreated: (book: BookRow) => void;
  teacherId: string;
  studioId: string | null;
}) {
  const [title, setTitle] = useState("");
  const [publisher, setPublisher] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error: err } = await supabase
      .from("books")
      .insert({
        teacher_id: teacherId,
        studio_id: studioId ?? null,
        title: title.trim(),
        publisher: publisher.trim() || null,
      })
      .select()
      .single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    onCreated(data as BookRow);
  }

  return (
    <form
      onSubmit={handleCreate}
      style={{
        background: "var(--white)",
        border: "1px solid var(--border-strong)",
        borderRadius: "10px",
        padding: "1.25rem",
        marginBottom: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--charcoal)" }}>New Book</div>
      {error && <div style={errorStyle}>{error}</div>}
      <input
        style={inputStyle}
        placeholder="Title (e.g. Hal Leonard Guitar Grade 1)"
        value={title}
        onChange={e => setTitle(e.target.value)}
        autoFocus
        required
      />
      <input
        style={inputStyle}
        placeholder="Publisher (optional)"
        value={publisher}
        onChange={e => setPublisher(e.target.value)}
      />
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="submit" style={btnPrimaryStyle} disabled={saving || !title.trim()}>
          {saving ? "Creating…" : "Create Book"}
        </button>
        <button type="button" style={btnGhostStyle} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ─── Book Card ─────────────────────────────────────────────────────────────────

function BookCard({
  book,
  onClick,
}: {
  book: BookWithPageCount;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        ...cardStyle,
        borderColor: hovered ? "var(--border-strong)" : "var(--border)",
        boxShadow: hovered ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ fontWeight: 600, fontSize: "0.9375rem", lineHeight: 1.3, color: "var(--charcoal)" }}>
          {book.title}
        </div>
        <BookOpen size={16} strokeWidth={1.5} style={{ color: "var(--muted)", flexShrink: 0, marginTop: "2px" }} />
      </div>
      {book.publisher && (
        <div style={{ fontSize: "0.8125rem", color: "var(--muted)", fontStyle: "italic" }}>
          {book.publisher}
        </div>
      )}
      <div style={badgeStyle}>
        {book.pageCount} {book.pageCount === 1 ? "page" : "pages"}
      </div>
    </div>
  );
}

// ─── Pages View ────────────────────────────────────────────────────────────────

function PagesView({
  book,
  onBack,
  onBookDeleted,
}: {
  book: BookRow;
  onBack: () => void;
  onBookDeleted: (bookId: string) => void;
}) {
  const [pages, setPages] = useState<BookPageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Paste state
  const [pasteMode, setPasteMode] = useState(false);
  const [pendingPastes, setPendingPastes] = useState<File[]>([]);
  const [pastePreviewUrls, setPastePreviewUrls] = useState<string[]>([]);

  // Delete book confirm
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Hover state for thumbnails
  const [hoveredPageId, setHoveredPageId] = useState<string | null>(null);

  useEffect(() => {
    loadPages();
  }, [book.id]);

  // Clipboard paste listener
  useEffect(() => {
    if (!pasteMode) return;
    function onPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItems = items.filter(i => i.type.startsWith("image/"));
      if (imageItems.length === 0) return;
      imageItems.forEach(item => {
        const file = item.getAsFile();
        if (!file) return;
        setPendingPastes(prev => [...prev, file]);
        setPastePreviewUrls(prev => [...prev, URL.createObjectURL(file)]);
      });
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [pasteMode]);

  async function loadPages() {
    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error: err } = await supabase
      .from("book_pages")
      .select("*")
      .eq("book_id", book.id)
      .order("page_number", { ascending: true });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setPages((data ?? []) as BookPageRow[]);
  }

  function nextPageNumber(): number {
    if (pages.length === 0) return 1;
    return Math.max(...pages.map(p => p.page_number)) + 1;
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    const supabase = getSupabaseBrowserClient();
    let pageNum = nextPageNumber();
    const newPages: BookPageRow[] = [];

    for (const file of files) {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
      const filename = file.name || `paste_${Date.now()}.${ext}`;
      const storagePath = `${book.id}/${pageNum}_${filename}`;

      const { error: storageErr } = await supabase.storage
        .from("book-pages")
        .upload(storagePath, file, { upsert: false });

      if (storageErr) {
        setUploadError(`Upload failed for page ${pageNum}: ${storageErr.message}`);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("book-pages").getPublicUrl(storagePath);
      const imageUrl = urlData.publicUrl;

      const { data: inserted, error: insertErr } = await supabase
        .from("book_pages")
        .insert({ book_id: book.id, page_number: pageNum, image_url: imageUrl })
        .select()
        .single();

      if (insertErr) {
        setUploadError(`DB insert failed: ${insertErr.message}`);
        setUploading(false);
        return;
      }

      newPages.push(inserted as BookPageRow);
      pageNum++;
    }

    setPages(prev => [...prev, ...newPages].sort((a, b) => a.page_number - b.page_number));
    setUploading(false);
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    await uploadFiles(files);
    e.target.value = "";
  }

  function cancelPaste() {
    setPasteMode(false);
    setPendingPastes([]);
    setPastePreviewUrls(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return []; });
  }

  async function confirmPasteUpload() {
    const toUpload = [...pendingPastes];
    setPasteMode(false);
    setPendingPastes([]);
    setPastePreviewUrls(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return []; });
    await uploadFiles(toUpload);
  }

  async function deletePage(page: BookPageRow) {
    const supabase = getSupabaseBrowserClient();
    // Derive storage path from the public URL
    const url = page.image_url;
    const bucketMarker = "/book-pages/";
    const pathStart = url.indexOf(bucketMarker);
    if (pathStart !== -1) {
      const storagePath = url.slice(pathStart + bucketMarker.length);
      await supabase.storage.from("book-pages").remove([storagePath]);
    }
    await supabase.from("book_pages").delete().eq("id", page.id);
    setPages(prev => prev.filter(p => p.id !== page.id));
  }

  async function handleDeleteBook() {
    setDeleting(true);
    const supabase = getSupabaseBrowserClient();
    // Delete all pages first
    for (const page of pages) {
      const url = page.image_url;
      const bucketMarker = "/book-pages/";
      const pathStart = url.indexOf(bucketMarker);
      if (pathStart !== -1) {
        const storagePath = url.slice(pathStart + bucketMarker.length);
        await supabase.storage.from("book-pages").remove([storagePath]);
      }
    }
    await supabase.from("book_pages").delete().eq("book_id", book.id);
    await supabase.from("books").delete().eq("id", book.id);
    setDeleting(false);
    onBookDeleted(book.id);
  }

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={onBack}
            style={{ ...btnGhostStyle, padding: "0.375rem 0.75rem" }}
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
            Books
          </button>
          <h2 style={{ ...headingStyle, fontSize: "1.5rem", margin: 0 }}>{book.title}</h2>
          {book.publisher && (
            <span style={{ fontSize: "0.875rem", color: "var(--muted)", fontStyle: "italic" }}>{book.publisher}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {/* Upload button */}
          <button
            style={{ ...btnGhostStyle, padding: "0.375rem 0.75rem" }}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={14} strokeWidth={1.5} />
            Upload Pages
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleFileInput}
          />

          {/* Paste button */}
          <button
            style={{
              ...btnGhostStyle,
              padding: "0.375rem 0.75rem",
              background: pasteMode ? "var(--charcoal)" : "none",
              color: pasteMode ? "var(--white)" : "var(--charcoal)",
              borderColor: pasteMode ? "var(--charcoal)" : "var(--border)",
            }}
            onClick={() => { if (pasteMode) cancelPaste(); else { setPasteMode(true); setPendingPastes([]); setPastePreviewUrls([]); } }}
            title="Paste from clipboard (Ctrl+V / ⌘V)"
          >
            Paste
          </button>

          {/* Delete book */}
          {!confirmDelete ? (
            <button
              style={{ ...btnGhostStyle, padding: "0.375rem 0.75rem", color: "#b91c1c", borderColor: "#fecaca" }}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} strokeWidth={1.5} />
              Delete Book
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.375rem 0.75rem" }}>
              <span style={{ fontSize: "0.8125rem", color: "#b91c1c" }}>Delete?</span>
              <button
                style={{ background: "#b91c1c", color: "var(--white)", border: "none", borderRadius: "4px", padding: "0.25rem 0.625rem", fontSize: "0.8125rem", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                onClick={handleDeleteBook}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Yes"}
              </button>
              <button
                style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: "0.8125rem", fontFamily: "Inter, sans-serif" }}
                onClick={() => setConfirmDelete(false)}
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Paste mode banner */}
      {pasteMode && (
        <div style={{
          background: "var(--charcoal)",
          color: "var(--white)",
          borderRadius: "8px",
          padding: "0.75rem 1rem",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "0.875rem", flex: 1 }}>
            {pendingPastes.length === 0
              ? <>Press <strong>Ctrl+V</strong> / <strong>⌘V</strong> to paste an image — paste again for more pages</>
              : <>{pendingPastes.length} image{pendingPastes.length > 1 ? "s" : ""} ready — paste more or click Upload</>}
          </span>
          {pendingPastes.length > 0 && (
            <button
              onClick={confirmPasteUpload}
              style={{ ...btnPrimaryStyle, background: "var(--sage)", padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
            >
              <Upload size={13} strokeWidth={1.5} />
              Upload {pendingPastes.length}
            </button>
          )}
          <button
            onClick={cancelPaste}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", lineHeight: 1, padding: 0 }}
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Paste previews */}
      {pastePreviewUrls.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          {pastePreviewUrls.map((url, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img
                src={url}
                alt={`Pasted page ${i + 1}`}
                style={{ width: 64, height: 88, objectFit: "cover", borderRadius: "4px", border: "1px solid var(--border-strong)" }}
              />
              <div style={{
                position: "absolute", bottom: 2, left: 0, right: 0, textAlign: "center",
                fontSize: "0.625rem", color: "var(--white)",
                background: "rgba(0,0,0,0.45)", borderRadius: "0 0 3px 3px", padding: "1px 0",
              }}>
                {nextPageNumber() + i}
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadError && <div style={errorStyle}>{uploadError}</div>}
      {error && <div style={errorStyle}>{error}</div>}

      {uploading && (
        <div style={{ color: "var(--muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>Uploading pages…</div>
      )}

      {/* Pages grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: "1rem" }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ width: 64, height: 88, background: "var(--border)", borderRadius: "4px", opacity: 0.5 }} />
          ))}
        </div>
      ) : pages.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "3rem 1rem", color: "var(--muted)",
          border: "1px dashed var(--border)", borderRadius: "10px",
        }}>
          <BookOpen size={32} strokeWidth={1} style={{ marginBottom: "0.75rem", opacity: 0.4 }} />
          <div style={{ fontSize: "0.9375rem" }}>No pages yet</div>
          <div style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>Upload scanned or photographed pages above</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          {pages.map(page => (
            <div
              key={page.id}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}
              onMouseEnter={() => setHoveredPageId(page.id)}
              onMouseLeave={() => setHoveredPageId(null)}
            >
              <div style={{ position: "relative" }}>
                <img
                  src={page.image_url}
                  alt={`Page ${page.page_number}`}
                  style={{
                    width: 64,
                    height: 88,
                    objectFit: "cover",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    display: "block",
                  }}
                />
                {/* Delete button on hover */}
                {hoveredPageId === page.id && (
                  <button
                    onClick={() => deletePage(page)}
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#b91c1c",
                      color: "var(--white)",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      lineHeight: 1,
                    }}
                    title="Delete page"
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                )}
              </div>
              <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>{page.page_number}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BooksPage() {
  const { user } = useAuth();
  const teacher = user as Teacher | null;

  const [books, setBooks] = useState<BookWithPageCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookRow | null>(null);

  useEffect(() => {
    if (!teacher?.id) return;
    loadBooks();
  }, [teacher?.id]);

  async function loadBooks() {
    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();

    const { data: booksData, error: booksErr } = await supabase
      .from("books")
      .select("*")
      .eq("teacher_id", teacher!.id)
      .order("created_at", { ascending: false });

    if (booksErr) { setError(booksErr.message); setLoading(false); return; }

    const bookRows = (booksData ?? []) as BookRow[];

    // Fetch page counts for all books
    let pageCounts: Record<string, number> = {};
    if (bookRows.length > 0) {
      const { data: countData } = await supabase
        .from("book_pages")
        .select("book_id")
        .in("book_id", bookRows.map(b => b.id));

      for (const row of (countData ?? [])) {
        pageCounts[row.book_id] = (pageCounts[row.book_id] ?? 0) + 1;
      }
    }

    setBooks(bookRows.map(b => ({ ...b, pageCount: pageCounts[b.id] ?? 0 })));
    setLoading(false);
  }

  function handleBookCreated(book: BookRow) {
    setBooks(prev => [{ ...book, pageCount: 0 }, ...prev]);
    setShowNewForm(false);
    setSelectedBook(book);
  }

  function handleBookDeleted(bookId: string) {
    setBooks(prev => prev.filter(b => b.id !== bookId));
    setSelectedBook(null);
  }

  // When returning from pages view, refresh page counts
  function handleBack() {
    setSelectedBook(null);
    loadBooks();
  }

  // ── Pages view ──
  if (selectedBook) {
    return (
      <div style={pageStyle}>
        <PagesView
          book={selectedBook}
          onBack={handleBack}
          onBookDeleted={handleBookDeleted}
        />
      </div>
    );
  }

  // ── Book grid ──
  return (
    <div style={pageStyle}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (max-width: 600px) {
          .books-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div style={headerStyle}>
        <h1 style={headingStyle}>📚 Book Library</h1>
        <button
          style={btnPrimaryStyle}
          onClick={() => setShowNewForm(v => !v)}
        >
          <Plus size={15} strokeWidth={2} />
          New Book
        </button>
      </div>

      {showNewForm && teacher && (
        <NewBookForm
          teacherId={teacher.id}
          studioId={teacher.studioId ?? null}
          onCancel={() => setShowNewForm(false)}
          onCreated={handleBookCreated}
        />
      )}

      {error && <div style={errorStyle}>{error}</div>}

      {loading ? (
        <div
          className="books-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1rem",
          }}
        >
          {[...Array(6)].map((_, i) => (
            <div key={i} style={skeletonStyle} />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "4rem 1rem",
          color: "var(--muted)",
          border: "1px dashed var(--border)",
          borderRadius: "10px",
        }}>
          <BookOpen size={40} strokeWidth={1} style={{ marginBottom: "1rem", opacity: 0.35 }} />
          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.375rem", fontWeight: 600, color: "var(--charcoal)", marginBottom: "0.25rem" }}>
            No books yet
          </div>
          <div style={{ fontSize: "0.875rem" }}>
            Add a method book above to start uploading pages
          </div>
        </div>
      ) : (
        <div
          className="books-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1rem",
          }}
        >
          {books.map(book => (
            <BookCard
              key={book.id}
              book={book}
              onClick={() => setSelectedBook(book)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
