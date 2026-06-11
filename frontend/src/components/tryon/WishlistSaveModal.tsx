"use client";

import React, { useRef, useState } from "react";

export type WishlistSource = "pinterest" | "wildberries" | "kaspi" | "pinduoduo" | "store" | "other";

export interface WishlistSaveData {
  source: WishlistSource | null;
  product_url: string;
  description: string;
  tag_photo_url: string | null;
}

interface Props {
  onSave: (data: WishlistSaveData) => void;
  onCancel: () => void;
  uploading?: boolean;
  geminiEnabled?: boolean;
  clothingImageBase64?: string | null;
  initialData?: Partial<WishlistSaveData & { id: string }>;
}

const SOURCES: { id: WishlistSource; label: string; color: string; icon: React.ReactNode }[] = [
  {
    id: "pinterest",
    label: "Pinterest",
    color: "#E60023",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
      </svg>
    ),
  },
  {
    id: "wildberries",
    label: "Wildberries",
    color: "#8B00FF",
    icon: <img src="/icons/wildberries-sign-logo.svg" width="22" height="22" style={{ objectFit: "contain" }} alt="Wildberries" />,
  },
  {
    id: "kaspi",
    label: "Kaspi",
    color: "#FF4B3A",
    icon: <img src="/icons/kaspikz_128x128.svg" width="22" height="22" style={{ objectFit: "contain" }} alt="Kaspi" />,
  },
  {
    id: "pinduoduo",
    label: "Temu / PDD",
    color: "#FF6900",
    icon: <img src="/icons/pinduoduo-seeklogo.svg" width="22" height="22" style={{ objectFit: "contain" }} alt="Pinduoduo" />,
  },
  {
    id: "store",
    label: "В магазине",
    color: "#2563EB",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: "other",
    label: "Other",
    color: "#6B7280",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
      </svg>
    ),
  },
];

export function getSourceMeta(source: string | null | undefined) {
  return SOURCES.find((s) => s.id === source) ?? null;
}

export function WishlistSaveModal({ onSave, onCancel, uploading, geminiEnabled, clothingImageBase64, initialData }: Props) {
  const [source, setSource] = useState<WishlistSource | null>((initialData?.source as WishlistSource) ?? null);
  const [productUrl, setProductUrl] = useState(initialData?.product_url ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [tagPhoto, setTagPhoto] = useState<string | null>(initialData?.tag_photo_url ?? null);
  const [tagUploading, setTagUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const getAuthHeader = (): Record<string, string> => {
    const token = localStorage.getItem("wardrobe_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const analyzeClothing = React.useCallback(() => {
    if (!clothingImageBase64) return;
    setAnalyzing(true);
    fetch("/shopping/analyze-clothing", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ image_base64: clothingImageBase64 }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.description) setDescription(data.description);
        else if (data.name) setDescription(data.name);
      })
      .catch(() => {})
      .finally(() => setAnalyzing(false));
  }, [clothingImageBase64]);

  React.useEffect(() => {
    if (!geminiEnabled || !clothingImageBase64 || initialData?.description) return;
    analyzeClothing();
  }, []);

  const handleTagPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTagUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target?.result as string;
      try {
        const res = await fetch("/shopping/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ image_base64: b64 }),
        });
        if (res.ok) {
          const { url } = await res.json();
          setTagPhoto(url);
        } else {
          setTagPhoto(b64);
        }
      } catch {
        setTagPhoto(b64);
      } finally {
        setTagUploading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(20,14,10,0.7)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div style={{
        background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-subtle)", padding: "24px",
        width: "100%", maxWidth: "400px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        display: "flex", flexDirection: "column", gap: "18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="panel-title" style={{ fontSize: "16px" }}>{initialData?.id ? "Edit Wishlist Item" : "Save to Wishlist"}</div>
          <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: "2px", display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Source selector */}
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px", letterSpacing: "0.04em" }}>SOURCE</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
            {SOURCES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                style={{
                  padding: "8px 4px", borderRadius: "8px", cursor: "pointer",
                  border: `1.5px solid ${source === s.id ? s.color : "var(--border-subtle)"}`,
                  background: source === s.id ? `${s.color}18` : "transparent",
                  color: source === s.id ? s.color : "var(--text-secondary)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                  fontSize: "10px", fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s",
                }}
              >
                <span style={{ color: source === s.id ? s.color : "var(--text-secondary)" }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tag photo for physical store */}
        {source === "store" && (
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px", letterSpacing: "0.04em" }}>TAG PHOTO (OPTIONAL)</div>
            <input ref={tagInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleTagPhoto} />
            {tagPhoto ? (
              <div style={{ position: "relative", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-subtle)", height: "80px" }}>
                <img src={tagPhoto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="tag" />
                <button onClick={() => setTagPhoto(null)} style={{ position: "absolute", top: "4px", right: "4px", background: "rgba(20,14,10,0.7)", border: "none", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ) : (
              <button className="upload-btn" onClick={() => tagInputRef.current?.click()} style={{ width: "100%", height: "60px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "12px" }}>
                {tagUploading
                  ? <svg style={{ animation: "spin 0.8s linear infinite" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 11-6.22-8.56"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                }
                {tagUploading ? "Uploading…" : "Photo of price tag"}
              </button>
            )}
          </div>
        )}

        {/* URL */}
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", letterSpacing: "0.04em" }}>LINK (OPTIONAL)</div>
          <input
            type="url"
            placeholder="https://..."
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            style={{
              width: "100%", padding: "8px 10px", borderRadius: "8px",
              border: "1px solid var(--border-subtle)", background: "var(--bg-primary)",
              color: "var(--text-primary)", fontSize: "13px", fontFamily: "inherit",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Description */}
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "6px" }}>
            DESCRIPTION (OPTIONAL)
            {analyzing
              ? <span style={{ fontSize: "10px", color: "var(--accent-color)", display: "flex", alignItems: "center", gap: "4px" }}><svg style={{ animation: "spin 0.8s linear infinite" }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 11-6.22-8.56"/></svg>AI analyzing…</span>
              : clothingImageBase64 && geminiEnabled && (
                <button onClick={analyzeClothing} title="Regenerate AI description" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-color)", padding: "1px", display: "flex", alignItems: "center" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                </button>
              )
            }
          </div>
          <textarea
            placeholder="e.g. white linen shirt, size M, ~4000₸"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{
              width: "100%", padding: "8px 10px", borderRadius: "8px",
              border: "1px solid var(--border-subtle)", background: "var(--bg-primary)",
              color: "var(--text-primary)", fontSize: "13px", fontFamily: "inherit",
              outline: "none", resize: "vertical", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-ghost" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={uploading || tagUploading}
            onClick={() => onSave({ source, product_url: productUrl, description, tag_photo_url: tagPhoto })}
            style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
          >
            {uploading
              ? <><svg style={{ animation: "spin 0.8s linear infinite" }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 11-6.22-8.56"/></svg>Saving…</>
              : initialData?.id ? "Save Changes" : "♥ Save to Wishlist"
            }
          </button>
        </div>
      </div>
    </div>
  );
}
