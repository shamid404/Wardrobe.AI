"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";

type Props = {
  imageA: string;
  imageB: string;
  onClose: () => void;
};

export function ImageCompareSlider({ imageA, imageB, onClose }: Props) {
  const [sliderPos, setSliderPos] = useState(50); // percent 0–100
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePos = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) updatePos(e.clientX); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [updatePos]);

  const onTouchMove = (e: React.TouchEvent) => { updatePos(e.touches[0].clientX); };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(20,14,10,0.85)", backdropFilter: "blur(6px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div style={{ position: "relative", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "14px", fontWeight: 600, color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-sans,'DM Sans',sans-serif)" }}>
          Drag to compare
        </span>
        <button
          onClick={onClose}
          style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div
        ref={containerRef}
        onTouchMove={onTouchMove}
        style={{
          position: "relative",
          width: "min(360px, 90vw)",
          maxHeight: "80vh",
          aspectRatio: "9/16",
          borderRadius: "16px",
          overflow: "hidden",
          userSelect: "none",
          cursor: "col-resize",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          background: "#1a1210",
        }}
      >
        {/* Image B — right (full width, clipped on the left) */}
        <img
          src={imageB}
          alt="Look B"
          draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />

        {/* Image A — left (clipped on the right by slider) */}
        <div
          style={{
            position: "absolute", inset: 0,
            clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
          }}
        >
          <img
            src={imageA}
            alt="Look A"
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        </div>

        {/* Divider line */}
        <div
          onMouseDown={onMouseDown}
          style={{
            position: "absolute",
            top: 0, bottom: 0,
            left: `${sliderPos}%`,
            transform: "translateX(-50%)",
            width: "3px",
            background: "#fff",
            cursor: "col-resize",
            zIndex: 10,
          }}
        >
          {/* Handle circle */}
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "36px", height: "36px",
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "3px",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>

        {/* Labels */}
        <div style={{ position: "absolute", top: "10px", left: "10px", background: "rgba(20,14,10,0.6)", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "20px", letterSpacing: "0.06em", pointerEvents: "none" }}>
          A
        </div>
        <div style={{ position: "absolute", top: "10px", right: "10px", background: "rgba(20,14,10,0.6)", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "20px", letterSpacing: "0.06em", pointerEvents: "none" }}>
          B
        </div>
      </div>
    </div>
  );
}
