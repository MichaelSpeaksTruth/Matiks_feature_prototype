"use client";

import React, {
  useCallback,
  useRef,
  useState,
  type DragEvent,
  type ChangeEvent,
  type FormEvent,
  type CSSProperties,
} from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  black:       "#090909",
  blackSoft:   "#141414",
  blackCard:   "#1c1c1c",
  blackHover:  "#222222",
  white:       "#ffffff",
  whiteDim:    "#b0b0b0",
  whiteMuted:  "#555555",
  mint:        "#7fffd4",
  mintDim:     "rgba(127,255,212,0.10)",
  mintBorder:  "rgba(127,255,212,0.22)",
  border:      "rgba(255,255,255,0.07)",
  borderSoft:  "rgba(255,255,255,0.04)",
  red:         "#ff5555",
  redDim:      "rgba(255,85,85,0.12)",
  redBorder:   "rgba(255,85,85,0.28)",
  green:       "#5cdb95",
  greenDim:    "rgba(92,219,149,0.12)",
  greenBorder: "rgba(92,219,149,0.28)",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ModerationResult {
  reason_tag: "political" | "none" | string;
  is_flagged: "Yes" | "No" | string;
}
type AppState = "idle" | "loading" | "success" | "error";

// ─────────────────────────────────────────────────────────────────────────────
// SVG icon props — cls for className, style for inline styles
// ─────────────────────────────────────────────────────────────────────────────
interface IconProps {
  cls?: string;
  style?: CSSProperties;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline SVG icons
// ─────────────────────────────────────────────────────────────────────────────
const SvgShield = ({ cls = "", style }: IconProps) => (
  <svg className={cls} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const SvgCheckCircle = ({ cls = "", style }: IconProps) => (
  <svg className={cls} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14.5 15 10" />
  </svg>
);
const SvgXCircle = ({ cls = "", style }: IconProps) => (
  <svg className={cls} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);
const SvgUpload = ({ cls = "", style }: IconProps) => (
  <svg className={cls} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
  </svg>
);
const SvgImage = ({ cls = "", style }: IconProps) => (
  <svg className={cls} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const SvgX = ({ cls = "", style }: IconProps) => (
  <svg className={cls} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const SvgSpark = ({ cls = "", style }: IconProps) => (
  <svg className={cls} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L9.09 9.09 2 12l7.09 2.91L12 22l2.91-7.09L22 12l-7.09-2.91L12 2z" />
  </svg>
);
const SvgAlert = ({ cls = "", style }: IconProps) => (
  <svg className={cls} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const SvgLoader = ({ cls = "", style }: IconProps) => (
  <svg className={`animate-spin ${cls}`} style={style} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.18" />
    <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────
const fmtBytes = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

// ─────────────────────────────────────────────────────────────────────────────
// NavBar
// ─────────────────────────────────────────────────────────────────────────────
function NavBar() {
  return (
    <nav
      aria-label="Main navigation"
      className="sticky top-0 z-50"
      style={{
        background: "rgba(9,9,9,0.88)",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div className="max-w-3xl mx-auto px-5 flex items-center justify-between" style={{ height: 60 }}>
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div
            className="relative w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: C.blackCard,
              border: `1px solid ${C.mintBorder}`,
              boxShadow: "0 0 16px -4px rgba(127,255,212,0.25)",
            }}
          >
            <SvgShield cls="w-[18px] h-[18px]" style={{ color: C.mint }} />
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
              style={{ background: C.mint, border: `2px solid ${C.black}` }}
            />
          </div>
          <div className="leading-none">
            <p className="text-[15px] font-extrabold tracking-tight" style={{ color: C.white }}>Matiks</p>
            <p className="text-[9px] uppercase tracking-[0.16em] font-medium" style={{ color: C.whiteMuted }}>Moderation Lab</p>
          </div>
        </div>

        {/* Badge */}
        <span
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: C.mintDim, border: `1px solid ${C.mintBorder}`, color: C.mint }}
        >
          <SvgSpark cls="w-3 h-3" />
          Groq Vision AI
        </span>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline steps
// ─────────────────────────────────────────────────────────────────────────────
function PipelineBar() {
  const steps = [
    { n: "1", title: "Upload",  sub: "Image + Caption"  },
    { n: "2", title: "Vision",  sub: "Llama 4 Maverick" },
    { n: "3", title: "Verdict", sub: "JSON Response"    },
  ];
  return (
    <div className="flex items-start justify-center mb-10" role="list" aria-label="Moderation pipeline steps">
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <div className="flex flex-col items-center gap-1.5 px-3" role="listitem">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: C.blackCard, border: `1px solid ${C.border}`, color: C.white }}
            >
              {s.n}
            </div>
            <p className="text-xs font-semibold whitespace-nowrap" style={{ color: C.white }}>{s.title}</p>
            <p className="text-[10px] whitespace-nowrap" style={{ color: C.whiteMuted }}>{s.sub}</p>
          </div>
          {i < steps.length - 1 && (
            <div className="mt-3.5">
              <svg width="24" height="16" viewBox="0 0 24 16" fill="none" aria-hidden>
                <path d="M0 8h18M14 4l6 4-6 4" stroke={C.whiteMuted} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Drop zone
// ─────────────────────────────────────────────────────────────────────────────
interface DropZoneProps {
  file: File | null; preview: string | null; dragging: boolean;
  onFile(f: File): void;
  onDragOver(e: DragEvent<HTMLDivElement>): void;
  onDragLeave(): void;
  onDrop(e: DragEvent<HTMLDivElement>): void;
  onClear(): void;
}

function DropZone({ file, preview, dragging, onFile, onDragOver, onDragLeave, onDrop, onClear }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      id="image-drop-zone"
      role="button"
      tabIndex={0}
      aria-label="Drag and drop image here, or click to browse"
      onClick={() => !file && inputRef.current?.click()}
      onKeyDown={(e) => { if (!file && (e.key === "Enter" || e.key === " ")) inputRef.current?.click(); }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative rounded-2xl border-2 border-dashed overflow-hidden select-none transition-all duration-300"
      style={{
        minHeight: 200,
        cursor: file ? "default" : "pointer",
        borderColor: dragging ? C.mint : file ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.1)",
        background: dragging ? C.mintDim : C.blackSoft,
        transform: dragging ? "scale(1.004)" : "scale(1)",
      }}
    >
      <input
        ref={inputRef} id="file-input" type="file" accept="image/*"
        className="hidden" aria-label="Image file input"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      {/* Empty state */}
      {!file && (
        <div className="flex flex-col items-center justify-center gap-4 py-12 px-8 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300"
            style={{
              background: dragging ? C.mintDim : C.blackCard,
              border: `1px solid ${dragging ? C.mintBorder : C.border}`,
              transform: dragging ? "scale(1.1)" : "scale(1)",
            }}
          >
            <SvgUpload cls="w-6 h-6" style={{ color: dragging ? C.mint : C.whiteDim }} />
          </div>
          <div>
            <p className="font-semibold text-[15px]" style={{ color: C.white }}>
              {dragging ? "Release to upload" : "Drop your image here"}
            </p>
            <p className="text-sm mt-1.5" style={{ color: C.whiteMuted }}>
              or <span className="font-medium underline-offset-2 hover:underline" style={{ color: C.mint }}>click to browse</span>
            </p>
            <p className="text-xs mt-3" style={{ color: C.whiteMuted }}>JPEG · PNG · WebP · GIF — max 20 MB</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {file && preview && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Upload preview" className="w-full object-cover rounded-2xl" style={{ maxHeight: 280 }} />
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ background: `linear-gradient(to top, rgba(9,9,9,0.85) 0%, transparent 55%)` }}
          />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl max-w-[80%] overflow-hidden"
              style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", border: `1px solid ${C.border}` }}
            >
              <SvgImage cls="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.mint }} />
              <span className="text-xs font-medium truncate" style={{ color: C.white }}>{file.name}</span>
              <span className="text-xs flex-shrink-0" style={{ color: C.whiteMuted }}>{fmtBytes(file.size)}</span>
            </div>
            <button
              id="clear-image-btn" type="button" aria-label="Remove image"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="rounded-full p-1.5 transition-colors hover:bg-white/10"
              style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}` }}
            >
              <SvgX cls="w-3.5 h-3.5" style={{ color: C.whiteDim }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div
      id="loading-skeleton"
      aria-live="polite"
      aria-label="Analysing content, please wait"
      className="rounded-2xl p-6"
      style={{ background: C.blackCard, border: `1px solid ${C.border}` }}
    >
      {[80, 52, 100, 100, 60].map((w, i) => (
        <div key={i} className="shimmer-bar mb-3" style={{ height: i === 0 ? 20 : i < 2 ? 13 : 11, width: `${w}%` }} />
      ))}
      <p className="text-xs text-center mt-4 flex items-center justify-center gap-2" style={{ color: C.whiteMuted }}>
        <SvgLoader cls="w-3 h-3" style={{ color: C.mint }} />
        Sending to Groq Vision API…
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Result card
// ─────────────────────────────────────────────────────────────────────────────
function ResultCard({ result }: { result: ModerationResult }) {
  const flagged      = result.is_flagged === "Yes";
  const accent       = flagged ? C.red       : C.green;
  const accentDim    = flagged ? C.redDim    : C.greenDim;
  const accentBorder = flagged ? C.redBorder : C.greenBorder;

  return (
    <div
      id="result-card"
      role="region"
      aria-label={`Moderation result: ${flagged ? "Flagged — Political Content" : "Safe"}`}
      className="rise-in rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${accentBorder}`,
        boxShadow: `0 0 50px -10px ${flagged ? "rgba(255,85,85,0.3)" : "rgba(92,219,149,0.25)"}`,
      }}
    >
      {/* Verdict banner */}
      <div
        className="px-6 py-5 flex items-center gap-4"
        style={{ background: accentDim, borderBottom: `1px solid ${accentBorder}` }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: accentDim, border: `1px solid ${accentBorder}` }}
        >
          {flagged
            ? <SvgXCircle cls="w-7 h-7" style={{ color: C.red }} />
            : <SvgCheckCircle cls="w-7 h-7" style={{ color: C.green }} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: accent }}>
            {flagged ? "Content Flagged" : "Content Safe"}
          </p>
          <p className="text-xl font-black leading-tight" style={{ color: C.white }}>
            {flagged ? "🚩 Flagged: Political Content" : "✅ Safe — No Political Content"}
          </p>
        </div>
        <div
          id="flagged-badge"
          className="flex items-center gap-2 px-4 py-2 rounded-full flex-shrink-0"
          style={{ background: accentDim, border: `1px solid ${accentBorder}` }}
        >
          <span
            className={flagged ? "dot-pulse" : ""}
            style={{ display: "block", width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }}
          />
          <span className="text-sm font-black tracking-wide" style={{ color: accent }}>
            {flagged ? "FLAGGED" : "SAFE"}
          </span>
        </div>
      </div>

      {/* Data tiles */}
      <div className="p-6" style={{ background: C.blackCard }}>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="rounded-xl p-4" style={{ background: C.blackSoft, border: `1px solid ${C.border}` }}>
            <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: C.whiteMuted }}>is_flagged</p>
            <p id="is-flagged-value" className="text-3xl font-black" style={{ color: accent }}>{result.is_flagged}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: C.blackSoft, border: `1px solid ${C.border}` }}>
            <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: C.whiteMuted }}>reason_tag</p>
            <p id="reason-tag-value" className="text-3xl font-black capitalize" style={{ color: C.white }}>{result.reason_tag}</p>
          </div>
        </div>
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-3"
          style={{ background: accentDim, border: `1px solid ${accentBorder}` }}
        >
          {flagged
            ? <SvgAlert cls="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: C.red }} />
            : <SvgCheckCircle cls="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: C.green }} />
          }
          <p className="text-sm leading-relaxed" style={{ color: C.whiteDim }}>
            {flagged
              ? "The Groq Vision model identified political content in this post. It has been flagged and held for human review before publication."
              : "The Groq Vision model found no political content in this post. It is cleared for publication on the Matiks platform."
            }
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Error banner
// ─────────────────────────────────────────────────────────────────────────────
function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      id="error-banner"
      role="alert"
      className="rise-in rounded-2xl p-5"
      style={{ background: C.redDim, border: `1px solid ${C.redBorder}`, boxShadow: "0 0 30px -8px rgba(255,85,85,0.18)" }}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(255,85,85,0.18)" }}>
          <SvgAlert cls="w-4 h-4" style={{ color: C.red }} />
        </div>
        <div>
          <p className="text-sm font-semibold mb-1" style={{ color: C.red }}>Request Failed</p>
          <p className="text-xs leading-relaxed" style={{ color: C.whiteDim }}>{message}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function ModerationPage() {
  const [file,     setFile]     = useState<File | null>(null);
  const [preview,  setPreview]  = useState<string | null>(null);
  const [caption,  setCaption]  = useState("");
  const [dragging, setDragging] = useState(false);
  const [state,    setState]    = useState<AppState>("idle");
  const [result,   setResult]   = useState<ModerationResult | null>(null);
  const [errMsg,   setErrMsg]   = useState("");

  const selectFile = useCallback((f: File) => {
    setFile(f); setPreview(URL.createObjectURL(f));
    setResult(null); setErrMsg(""); setState("idle");
  }, []);

  const clearFile = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setResult(null); setErrMsg(""); setState("idle");
  }, [preview]);

  const onDragOver  = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop      = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f?.type.startsWith("image/")) selectFile(f);
  }, [selectFile]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setErrMsg("NEXT_PUBLIC_API_URL is not configured. Add it to .env.local or Vercel → Settings → Environment Variables.");
      setState("error");
      return;
    }

    setState("loading"); setResult(null); setErrMsg("");

    try {
      const form = new FormData();
      form.append("image", file);
      if (caption.trim()) form.append("caption", caption.trim());

      const res = await fetch(`${apiUrl}/moderate-post`, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Server error ${res.status}: ${res.statusText}`);
      }

      const data: ModerationResult = await res.json();
      setResult(data);
      setState("success");
    } catch (err: unknown) {
      setErrMsg(err instanceof Error ? err.message : "An unexpected error occurred.");
      setState("error");
    }
  };

  const canSubmit = !!file && state !== "loading";

  return (
    <div className="min-h-screen" style={{ background: C.black }}>
      <NavBar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-14">

        {/* Hero */}
        <header className="text-center mb-12">
          <div
            className="inline-flex items-center gap-1.5 mb-5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: C.mintDim, border: `1px solid ${C.mintBorder}`, color: C.mint }}
          >
            <SvgSpark cls="w-3 h-3" />
            AI Political Content Moderation
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-4" style={{ color: C.white }}>
            Matiks <span style={{ color: C.mint }}>Moderation</span>
          </h1>
          <p className="text-[15px] max-w-sm mx-auto leading-relaxed" style={{ color: C.whiteDim }}>
            Upload an image and optional caption. Groq Vision analyses it and returns a clear{" "}
            <strong style={{ color: C.white }}>Safe</strong> or{" "}
            <strong style={{ color: C.white }}>Flagged</strong> verdict instantly.
          </p>
        </header>

        <PipelineBar />

        {/* Form card */}
        <form
          id="moderation-form"
          aria-label="Content moderation form"
          onSubmit={handleSubmit}
          className="rounded-3xl p-6 sm:p-8 mb-6 space-y-6"
          style={{ background: C.blackCard, border: `1px solid ${C.border}`, boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}
        >
          <div>
            <label htmlFor="image-drop-zone" className="block text-sm font-semibold mb-3" style={{ color: C.white }}>
              Post Image <span style={{ color: C.red }} aria-hidden="true">*</span>
            </label>
            <DropZone
              file={file} preview={preview} dragging={dragging}
              onFile={selectFile} onDragOver={onDragOver}
              onDragLeave={onDragLeave} onDrop={onDrop} onClear={clearFile}
            />
          </div>

          <div>
            <label htmlFor="caption-input" className="block text-sm font-semibold mb-2" style={{ color: C.white }}>
              Post Caption <span className="font-normal" style={{ color: C.whiteMuted }}>(optional)</span>
            </label>
            <textarea
              id="caption-input"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Enter the text caption accompanying this post…"
              rows={3}
              maxLength={2000}
              className="w-full rounded-xl px-4 py-3 text-sm resize-none transition-all duration-200"
              style={{ background: C.blackSoft, border: `1px solid ${C.border}`, color: C.white, outline: "none" }}
              onFocus={(e) => { e.target.style.borderColor = C.mintBorder; e.target.style.boxShadow = `0 0 0 3px ${C.mintDim}`; }}
              onBlur={(e)  => { e.target.style.borderColor = C.border;      e.target.style.boxShadow = "none"; }}
            />
            <p className="text-xs text-right mt-1" style={{ color: C.whiteMuted }}>{caption.length} / 2000</p>
          </div>

          <button
            id="submit-btn"
            type="submit"
            disabled={!canSubmit}
            aria-busy={state === "loading"}
            className="w-full h-12 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.98]"
            style={canSubmit ? {
              background: C.white, color: C.black, cursor: "pointer",
              boxShadow: "0 0 24px -4px rgba(255,255,255,0.2)",
            } : {
              background: C.blackHover, color: C.whiteMuted,
              border: `1px solid ${C.border}`, cursor: "not-allowed",
            }}
            onMouseEnter={(e) => { if (canSubmit) (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
            onMouseLeave={(e) => { if (canSubmit) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          >
            {state === "loading"
              ? (<><SvgLoader cls="w-4 h-4" />Analysing…</>)
              : (<><SvgSpark cls="w-4 h-4" />Analyse Content</>)
            }
          </button>
        </form>

        <div aria-live="polite" aria-atomic="true">
          {state === "loading" && <Skeleton />}
          {state === "success" && result && <ResultCard result={result} />}
          {state === "error"   && <ErrorBanner message={errMsg} />}
        </div>

      </main>

      <footer className="py-8 text-center text-xs" style={{ color: C.whiteMuted }}>
        Matiks Content Moderation · Powered by Groq Vision AI · Prototype
      </footer>
    </div>
  );
}
