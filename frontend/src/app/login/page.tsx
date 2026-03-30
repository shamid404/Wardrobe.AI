"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveAuth } from "@/lib/auth";

/* ── SVG clothing icons ─────────────────────────────────────────── */
function HangerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 70" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 3 C44 3 39 8 39 14 C39 19 42 23 47 24.5 L47 28 L8 52 L92 52 L53 28 L53 24.5 C58 23 61 19 61 14 C61 8 56 3 50 3 Z M50 8 C53.3 8 56 10.7 56 14 C56 17.3 53.3 20 50 20 C46.7 20 44 17.3 44 14 C44 10.7 46.7 8 50 8 Z"/>
      <rect x="5" y="52" width="90" height="8" rx="4"/>
    </svg>
  );
}

function TShirtIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 80" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M35 2 C35 2 31 16 17 17 L1 27 L15 52 L26 46 L26 78 L74 78 L74 46 L85 52 L99 27 L83 17 C69 16 65 2 65 2 C62 9 57 13 50 13 C43 13 38 9 35 2 Z"/>
    </svg>
  );
}

function DressIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 110" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M28 0 L52 0 L52 5 C55 10 60 17 65 28 L75 48 L55 56 L62 110 L18 110 L25 56 L5 48 L15 28 C20 17 25 10 28 5 Z"/>
    </svg>
  );
}

function BagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 85" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M28 22 C28 14 33 8 40 8 C47 8 52 14 52 22 L68 22 C69 22 70 23 70 24 L75 80 C75 81 74 82 73 82 L7 82 C6 82 5 81 5 80 L10 24 C10 23 11 22 12 22 Z"/>
      <path d="M28 22 C28 14 33 8 40 8 C47 8 52 14 52 22" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="3"/>
    </svg>
  );
}

function ShoeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 110 65" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 48 C8 48 12 22 50 24 L75 24 L75 16 C75 16 86 15 92 24 C98 33 100 48 100 48 Z"/>
      <ellipse cx="54" cy="53" rx="46" ry="8"/>
    </svg>
  );
}

function JacketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 90" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M35 2 L20 20 L2 28 L14 55 L26 48 L26 88 L74 88 L74 48 L86 55 L98 28 L80 20 L65 2 C62 10 57 15 50 15 C43 15 38 10 35 2 Z M42 2 L42 30 L50 35 L58 30 L58 2 Z"/>
    </svg>
  );
}

/* ── Floating background items ──────────────────────────────────── */
const floatingItems = [
  { Icon: HangerIcon,  style: { top: "4%",   left: "4%",   width: 90,  opacity: 0.10, animation: "float 7s ease-in-out infinite",      animationDelay: "0s" } },
  { Icon: TShirtIcon,  style: { top: "8%",   right: "7%",  width: 100, opacity: 0.08, animation: "floatAlt 9s ease-in-out infinite",   animationDelay: "1.5s" } },
  { Icon: DressIcon,   style: { top: "38%",  left: "2%",   width: 65,  opacity: 0.09, animation: "floatSlow 8s ease-in-out infinite",  animationDelay: "3s" } },
  { Icon: BagIcon,     style: { bottom: "12%", left: "7%", width: 75,  opacity: 0.10, animation: "float 10s ease-in-out infinite",     animationDelay: "0.5s" } },
  { Icon: ShoeIcon,    style: { bottom: "6%", right: "5%", width: 110, opacity: 0.08, animation: "floatAlt 7s ease-in-out infinite",   animationDelay: "2s" } },
  { Icon: HangerIcon,  style: { top: "62%",  right: "4%",  width: 70,  opacity: 0.09, animation: "floatSlow 9s ease-in-out infinite",  animationDelay: "4s" } },
  { Icon: TShirtIcon,  style: { top: "76%",  left: "18%",  width: 80,  opacity: 0.07, animation: "float 8s ease-in-out infinite",      animationDelay: "1s" } },
  { Icon: JacketIcon,  style: { top: "3%",   right: "28%", width: 60,  opacity: 0.09, animation: "floatAlt 10s ease-in-out infinite",  animationDelay: "5s" } },
  { Icon: BagIcon,     style: { bottom: "28%", right: "14%", width: 65, opacity: 0.07, animation: "floatSlow 8s ease-in-out infinite", animationDelay: "2.5s" } },
  { Icon: DressIcon,   style: { bottom: "42%", left: "16%", width: 55, opacity: 0.08, animation: "float 9s ease-in-out infinite",      animationDelay: "6s" } },
];

/* ── Page ───────────────────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail;
        setError(Array.isArray(detail) ? "Проверьте правильность заполнения полей" : (detail || "Ошибка входа"));
        return;
      }
      saveAuth(data.access_token, data.user);
      router.push("/tryon");
    } catch {
      setError("Сервер недоступен");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4"
         style={{ background: "linear-gradient(135deg, #0d0d1f 0%, #1a0a2e 40%, #0d1a2e 100%)" }}>

      {/* ── Floating clothing icons ── */}
      {floatingItems.map(({ Icon, style }, i) => (
        <div key={i} className="absolute pointer-events-none select-none text-white"
             style={{ ...style, width: style.width, color: "white" }}>
          <Icon style={{ width: style.width, height: "auto" }} />
        </div>
      ))}

      {/* ── Radial glow spots ── */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
           style={{ background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)" }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none"
           style={{ background: "radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)" }} />

      {/* ── Glass card ── */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl p-8"
           style={{
             background: "rgba(255,255,255,0.06)",
             backdropFilter: "blur(24px)",
             WebkitBackdropFilter: "blur(24px)",
             border: "1px solid rgba(255,255,255,0.12)",
             boxShadow: "0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
           }}>

        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
               style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <HangerIcon style={{ width: 32, height: "auto", color: "white" }} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Wardrobe<span style={{ color: "rgba(167,139,250,1)" }}>.AI</span></h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Войдите в свой аккаунт</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.75)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "white",
              }}
              onFocus={(e) => { e.target.style.border = "1px solid rgba(167,139,250,0.6)"; e.target.style.background = "rgba(255,255,255,0.12)"; }}
              onBlur={(e)  => { e.target.style.border = "1px solid rgba(255,255,255,0.15)"; e.target.style.background = "rgba(255,255,255,0.08)"; }}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.75)" }}>
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
              onFocus={(e) => { e.target.style.border = "1px solid rgba(167,139,250,0.6)"; e.target.style.background = "rgba(255,255,255,0.12)"; }}
              onBlur={(e)  => { e.target.style.border = "1px solid rgba(255,255,255,0.15)"; e.target.style.background = "rgba(255,255,255,0.08)"; }}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-center py-2 px-3 rounded-xl"
               style={{ color: "#fca5a5", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)" }}>
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all mt-2"
            style={{
              background: loading ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.95)",
              color: "#0d0d1f",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 4px 20px rgba(255,255,255,0.15)",
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "rgba(255,255,255,1)"; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "rgba(255,255,255,0.95)"; }}
          >
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>или</span>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>

        <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
          Нет аккаунта?{" "}
          <Link href="/register"
                className="font-medium transition-colors"
                style={{ color: "rgba(167,139,250,0.9)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(196,181,253,1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(167,139,250,0.9)"; }}>
            Зарегистрироваться
          </Link>
        </p>

      </div>
    </div>
  );
}
