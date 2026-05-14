"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAuth } from "@/lib/auth";

interface WardrobeAuthProps {
  defaultMode?: "login" | "register";
}

export default function WardrobeAuth({ defaultMode = "login" }: WardrobeAuthProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          const detail = data.detail;
          setError(Array.isArray(detail) ? "Please check your credentials" : (detail || "Login failed"));
          return;
        }
        saveAuth(data.access_token, data.user);
        router.push("/tryon");
      } else {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          const detail = data.detail;
          setError(Array.isArray(detail) ? "Please check the form" : (detail || "Registration failed"));
          return;
        }
        saveAuth(data.access_token, data.user);
        router.push("/tryon");
      }
    } catch {
      setError("Server unavailable");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    padding: "14px 16px",
    fontSize: 14,
    fontFamily: "var(--font-inter, 'Inter', sans-serif)",
    background: "#F4ECE0",
    border: `1px solid ${focused === field ? "#C8826D" : "#E8DFD2"}`,
    borderRadius: 12,
    color: "#2D2218",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxShadow: focused === field ? "0 0 0 2px rgba(200,130,109,0.2)" : "none",
  });

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: "var(--font-inter, 'Inter', sans-serif)",
    color: "#7A6B5C",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #F8F0E4 0%, #F2E8DA 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      fontFamily: "var(--font-inter, 'Inter', sans-serif)",
      padding: "24px 16px",
    }}>
      <style suppressHydrationWarning>{`
        @keyframes authFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardFloat {
          0%, 100% { transform: translateY(0px) rotate(var(--rot)); }
          50% { transform: translateY(-8px) rotate(var(--rot)); }
        }
        @keyframes bgFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        @keyframes bgFloatAlt {
          0%, 100% { transform: translateY(0px); }
          33% { transform: translateY(-9px); }
          66% { transform: translateY(-18px); }
        }
        @keyframes bgFloatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        input::placeholder { color: #A89A8A; }
        .auth-input-pw { padding-right: 48px !important; }
      `}</style>

      {/* Background floating clothing silhouettes */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        {/* T-shirt — top left */}
        <div style={{ position: "absolute", top: "8%", left: "5%", animation: "bgFloat 7s ease-in-out infinite" }}>
          <svg width="90" height="90" viewBox="0 0 100 100" fill="rgba(200,130,109,0.09)" xmlns="http://www.w3.org/2000/svg" style={{ transform: "rotate(-12deg)" }}>
            <path d="M28,25 C26,16 10,4 2,12 L0,28 L20,40 L20,90 L80,90 L80,40 L100,28 L98,12 C90,4 74,16 72,25 C68,14 32,14 28,25 Z" />
          </svg>
        </div>
        {/* Dress — top right */}
        <div style={{ position: "absolute", top: "10%", right: "7%", animation: "bgFloatAlt 9s ease-in-out infinite 1.5s" }}>
          <svg width="70" height="70" viewBox="0 0 100 100" fill="rgba(45,34,24,0.06)" xmlns="http://www.w3.org/2000/svg" style={{ transform: "rotate(8deg)" }}>
            <path d="M35,4 C40,16 60,16 65,4 L80,50 L100,100 L0,100 L20,50 Z" />
          </svg>
        </div>
        {/* Hanger — bottom left */}
        <div style={{ position: "absolute", bottom: "8%", left: "4%", animation: "bgFloat 8s ease-in-out infinite 0.5s" }}>
          <svg width="100" height="100" viewBox="0 0 100 95" fill="rgba(200,130,109,0.08)" xmlns="http://www.w3.org/2000/svg" style={{ transform: "rotate(-6deg)" }}>
            {/* Hook oval */}
            <ellipse cx="57" cy="13" rx="16" ry="12" />
            {/* Hook hole (bg color cut-out effect via lighter fill) */}
            <ellipse cx="57" cy="13" rx="9" ry="6" fill="rgba(248,242,234,0.9)" />
            {/* Neck */}
            <rect x="45" y="22" width="10" height="14" />
            {/* Shoulders + bar */}
            <path d="M 47,34 L 4,74 L 4,82 L 96,82 L 96,74 L 53,34 Z" />
          </svg>
        </div>
        {/* Bag — bottom right */}
        <div style={{ position: "absolute", bottom: "12%", right: "5%", animation: "bgFloatSlow 6s ease-in-out infinite 2s" }}>
          <svg width="65" height="65" viewBox="0 0 100 100" fill="rgba(45,34,24,0.05)" xmlns="http://www.w3.org/2000/svg" style={{ transform: "rotate(16deg)" }}>
            <path d="M30,45 Q25,28 50,26 Q75,28 70,45 L80,45 Q90,45 90,55 L90,85 Q90,95 80,95 L20,95 Q10,95 10,85 L10,55 Q10,45 20,45 Z" />
          </svg>
        </div>
        {/* Pants — mid left */}
        <div style={{ position: "absolute", top: "48%", left: "2%", animation: "bgFloatAlt 7.5s ease-in-out infinite 1s" }}>
          <svg width="58" height="58" viewBox="0 0 100 100" fill="rgba(200,130,109,0.07)" xmlns="http://www.w3.org/2000/svg" style={{ transform: "rotate(-8deg)" }}>
            <path d="M12,0 L12,58 L2,100 L38,100 L50,72 L62,100 L98,100 L88,58 L88,0 Z" />
          </svg>
        </div>
        {/* Small t-shirt — mid right */}
        <div style={{ position: "absolute", top: "35%", right: "3%", animation: "bgFloat 6.5s ease-in-out infinite 2.5s" }}>
          <svg width="52" height="52" viewBox="0 0 100 100" fill="rgba(45,34,24,0.05)" xmlns="http://www.w3.org/2000/svg" style={{ transform: "rotate(18deg)" }}>
            <path d="M28,25 C26,16 10,4 2,12 L0,28 L20,40 L20,90 L80,90 L80,40 L100,28 L98,12 C90,4 74,16 72,25 C68,14 32,14 28,25 Z" />
          </svg>
        </div>
        {/* Small dress — bottom center-left */}
        <div style={{ position: "absolute", bottom: "6%", left: "20%", animation: "bgFloatSlow 8.5s ease-in-out infinite 0.8s" }}>
          <svg width="45" height="45" viewBox="0 0 100 100" fill="rgba(200,130,109,0.07)" xmlns="http://www.w3.org/2000/svg" style={{ transform: "rotate(-18deg)" }}>
            <path d="M35,4 C40,16 60,16 65,4 L80,50 L100,100 L0,100 L20,50 Z" />
          </svg>
        </div>
        {/* Skirt — top right area */}
        <div style={{ position: "absolute", top: "18%", right: "19%", animation: "bgFloat 7s ease-in-out infinite 3s" }}>
          <svg width="50" height="50" viewBox="0 0 100 100" fill="rgba(45,34,24,0.05)" xmlns="http://www.w3.org/2000/svg" style={{ transform: "rotate(10deg)" }}>
            {/* Waistband */}
            <rect x="26" y="0" width="48" height="14" rx="4" />
            {/* A-line skirt body */}
            <path d="M 26,12 L 12,95 L 88,95 L 74,12 Z" />
          </svg>
        </div>
        {/* Sneaker — bottom center */}
        <div style={{ position: "absolute", bottom: "3%", left: "42%", animation: "bgFloatAlt 6.5s ease-in-out infinite 1.8s" }}>
          <svg width="72" height="72" viewBox="0 0 110 70" fill="rgba(200,130,109,0.08)" xmlns="http://www.w3.org/2000/svg" style={{ transform: "rotate(-5deg)" }}>
            {/* Sole */}
            <path d="M 2,52 Q 2,65 18,65 L 92,65 Q 110,65 110,52 L 110,45 L 2,45 Z" />
            {/* Upper / body */}
            <path d="M 2,45 L 2,30 Q 2,8 28,8 L 55,8 L 68,22 L 85,16 Q 100,12 108,30 L 110,45 Z" />
            {/* Toe cap */}
            <path d="M 2,30 Q 2,12 22,12 L 38,12 L 44,28 L 2,38 Z" fill="rgba(45,34,24,0.04)" />
          </svg>
        </div>
        {/* Cap — mid right lower */}
        <div style={{ position: "absolute", top: "62%", right: "4%", animation: "bgFloatSlow 8s ease-in-out infinite 2.2s" }}>
          <svg width="58" height="58" viewBox="0 0 100 70" fill="rgba(45,34,24,0.05)" xmlns="http://www.w3.org/2000/svg" style={{ transform: "rotate(-10deg)" }}>
            {/* Dome */}
            <path d="M 8,48 Q 8,5 50,5 Q 92,5 92,48 Z" />
            {/* Brim */}
            <path d="M 4,48 L 96,48 L 96,58 L 4,58 Z" rx="3" />
            {/* Button on top */}
            <circle cx="50" cy="7" r="5" />
          </svg>
        </div>
        {/* Small skirt — top center-left */}
        <div style={{ position: "absolute", top: "4%", left: "30%", animation: "bgFloat 6s ease-in-out infinite 3.5s" }}>
          <svg width="40" height="40" viewBox="0 0 100 100" fill="rgba(200,130,109,0.07)" xmlns="http://www.w3.org/2000/svg" style={{ transform: "rotate(14deg)" }}>
            <rect x="26" y="0" width="48" height="14" rx="4" />
            <path d="M 26,12 L 12,95 L 88,95 L 74,12 Z" />
          </svg>
        </div>
      </div>

      {/* Floating card — left */}
      <div style={{
        position: "absolute",
        left: "calc(50% - 380px)",
        top: "50%",
        transform: "translateY(-60%) rotate(-4deg)",
        width: 180,
        background: "#FAF5EE",
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(60,40,20,0.10)",
        padding: 12,
        animation: "cardFloat 6s ease-in-out infinite",
        ["--rot" as any]: "-4deg",
      } as React.CSSProperties}>
        <div style={{
          width: "100%", height: 140, borderRadius: 10, overflow: "hidden", marginBottom: 10,
          background: "#EDE3D4",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <img
            src="/auth/card-left.png"
            alt="Clothing flatlay left"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <div style={{
          display: "inline-block",
          background: "#C8826D",
          color: "#fff",
          fontSize: 11,
          fontWeight: 600,
          padding: "3px 10px",
          borderRadius: 20,
          fontFamily: "var(--font-inter, 'Inter', sans-serif)",
        }}>
          Perfect for: Brunch
        </div>
      </div>

      {/* Floating card — right */}
      <div style={{
        position: "absolute",
        right: "calc(50% - 390px)",
        top: "50%",
        transform: "translateY(-40%) rotate(3deg)",
        width: 200,
        background: "#FAF5EE",
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(60,40,20,0.10)",
        padding: 12,
        animation: "cardFloat 7s ease-in-out infinite 0.5s",
        ["--rot" as any]: "3deg",
      } as React.CSSProperties}>
        <div style={{
          width: "100%", height: 150, borderRadius: 10, overflow: "hidden", marginBottom: 10,
          background: "#EDE3D4",
        }}>
          <img
            src="/auth/card-right.png"
            alt="Clothing flatlay right"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <div style={{
          display: "inline-block",
          background: "#F4ECE0",
          color: "#2D2218",
          fontSize: 11,
          fontWeight: 600,
          padding: "3px 10px",
          borderRadius: 20,
          fontFamily: "var(--font-inter, 'Inter', sans-serif)",
        }}>
          AI-Styled
        </div>
      </div>

      {/* Main card */}
      <div style={{
        position: "relative",
        zIndex: 5,
        width: 440,
        maxWidth: "100%",
        animation: "authFadeUp 0.6s ease both",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        {/* W logo tile */}
        <div style={{
          width: 64,
          height: 64,
          background: "#2D2218",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: -24,
          zIndex: 1,
          boxShadow: "0 4px 16px rgba(45,34,24,0.25)",
        }}>
          <span style={{
            fontFamily: "var(--font-playfair, 'Playfair Display', serif)",
            fontSize: 28,
            fontWeight: 600,
            color: "#FAF5EE",
            lineHeight: 1,
          }}>W</span>
        </div>

        {/* Card */}
        <div style={{
          width: "100%",
          background: "#FAF5EE",
          borderRadius: 24,
          padding: "48px 48px 40px",
          boxShadow: "0 8px 24px rgba(60,40,20,0.12)",
          textAlign: "center",
        }}>
          {/* Wordmark */}
          <div style={{ marginBottom: 4, marginTop: 8 }}>
            <span style={{
              fontFamily: "var(--font-playfair, 'Playfair Display', serif)",
              fontSize: 28,
              fontWeight: 500,
              color: "#2D2218",
            }}>
              Wardrobe
            </span>
            <span style={{
              fontFamily: "var(--font-playfair, 'Playfair Display', serif)",
              fontSize: 18,
              fontWeight: 400,
              color: "#C8826D",
              verticalAlign: "sub",
            }}>.ai</span>
          </div>
          <div style={{
            fontFamily: "var(--font-inter, 'Inter', sans-serif)",
            fontSize: 14,
            color: "#7A6B5C",
            marginBottom: 28,
          }}>
            Your closet, reimagined
          </div>

          {/* Tab switcher */}
          <div style={{
            display: "flex",
            background: "#F4ECE0",
            borderRadius: 12,
            padding: 4,
            marginBottom: 24,
          }}>
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  fontSize: 13,
                  fontFamily: "var(--font-inter, 'Inter', sans-serif)",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  background: mode === m ? "#2D2218" : "transparent",
                  color: mode === m ? "#fff" : "#7A6B5C",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {m === "login" ? "Sign In" : "Create"}
              </button>
            ))}
          </div>

          {/* Name (register only) */}
          {mode === "register" && (
            <div style={{ marginBottom: 16, textAlign: "left", animation: "authFadeUp 0.3s ease both" }}>
              <label htmlFor="auth-name" style={labelStyle}>Name</label>
              <input
                id="auth-name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocused("name")}
                onBlur={() => setFocused(null)}
                style={inputStyle("name")}
              />
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 16, textAlign: "left" }}>
            <label htmlFor="auth-email" style={labelStyle}>Email</label>
            <input
              id="auth-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              style={inputStyle("email")}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: mode === "register" ? 16 : 8, textAlign: "left" }}>
            <label htmlFor="auth-password" style={labelStyle}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="auth-password"
                type={showPass ? "text" : "password"}
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                style={{ ...inputStyle("password"), paddingRight: 48 }}
              />
              <button
                onClick={() => setShowPass((p) => !p)}
                style={{
                  position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 2,
                  color: "#A89A8A",
                }}
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          {mode === "register" && (
            <div style={{ marginBottom: 8, textAlign: "left", animation: "authFadeUp 0.3s 0.05s ease both" }}>
              <label htmlFor="auth-confirm" style={labelStyle}>Confirm Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="auth-confirm"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm password..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setFocused("confirm")}
                  onBlur={() => setFocused(null)}
                  style={{ ...inputStyle("confirm"), paddingRight: 48 }}
                />
                <button
                  onClick={() => setShowConfirm((p) => !p)}
                  style={{
                    position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: 2,
                    color: "#A89A8A",
                  }}
                >
                  {showConfirm ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Forgot password */}
          {mode === "login" && (
            <div style={{ textAlign: "right", marginBottom: 20 }}>
              <span style={{
                fontFamily: "var(--font-inter, 'Inter', sans-serif)",
                fontSize: 13,
                color: "#C8826D",
                cursor: "pointer",
              }}>
                Forgot your password?
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(184,88,88,0.08)",
              border: "1px solid rgba(184,88,88,0.2)",
              fontSize: 13,
              color: "#B85858",
              fontFamily: "var(--font-inter, 'Inter', sans-serif)",
              textAlign: "left",
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 12,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "#A89A8A" : "#2D2218",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "var(--font-inter, 'Inter', sans-serif)",
              transition: "background 0.2s ease",
              marginBottom: 20,
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#1F1810"; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "#2D2218"; }}
          >
            {loading ? "Please wait..." : (mode === "login" ? "Sign in" : "Create account")}
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: "#E8DFD2" }} />
            <span style={{ fontSize: 13, color: "#A89A8A", fontFamily: "var(--font-inter, 'Inter', sans-serif)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "#E8DFD2" }} />
          </div>

          {/* Social buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            <button style={{
              width: "100%", padding: "11px 0",
              borderRadius: 12, border: "1px solid #E8DFD2",
              background: "#F4ECE0", cursor: "pointer",
              fontSize: 14, fontFamily: "var(--font-inter, 'Inter', sans-serif)",
              color: "#2D2218", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8,
              transition: "background 0.2s",
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#EDE3D4"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#F4ECE0"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </button>
            <button style={{
              width: "100%", padding: "11px 0",
              borderRadius: 12, border: "1px solid #E8DFD2",
              background: "#F4ECE0", cursor: "pointer",
              fontSize: 14, fontFamily: "var(--font-inter, 'Inter', sans-serif)",
              color: "#2D2218", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8,
              transition: "background 0.2s",
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#EDE3D4"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#F4ECE0"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              Continue with Apple
            </button>
          </div>

          {/* Switch mode */}
          <div style={{
            fontFamily: "var(--font-inter, 'Inter', sans-serif)",
            fontSize: 13,
            color: "#7A6B5C",
          }}>
            {mode === "login" ? (
              <>New here?{" "}
                <span
                  onClick={() => { setMode("register"); setError(""); }}
                  style={{ color: "#C8826D", cursor: "pointer", fontWeight: 500 }}
                >
                  Create an account
                </span>
              </>
            ) : (
              <>Already have an account?{" "}
                <span
                  onClick={() => { setMode("login"); setError(""); }}
                  style={{ color: "#C8826D", cursor: "pointer", fontWeight: 500 }}
                >
                  Sign in
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
