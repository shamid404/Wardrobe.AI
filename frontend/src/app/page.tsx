"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";

// ─── SVG Icons ──────────────────────────────────────────────────
function IconWardrobe() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2"/>
      <line x1="12" y1="3" x2="12" y2="21"/>
      <path d="M9 8h1m4 0h1M9 16h1m4 0h1"/>
    </svg>
  );
}
function IconSparkle() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
  );
}
function IconBot() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="12" rx="3"/>
      <path d="M9 13h.01M15 13h.01M12 2v4M8 8V6a4 4 0 018 0v2"/>
      <line x1="6" y1="20" x2="6" y2="22"/>
      <line x1="18" y1="20" x2="18" y2="22"/>
    </svg>
  );
}
function IconSun() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  );
}
function IconArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}
function IconMinus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}
function IconGrid() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function IconCamera() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

// ─── Data ────────────────────────────────────────────────────────
const features = [
  { Icon: IconWardrobe, title: "Smart Wardrobe", desc: "Upload your clothes once. AI automatically detects category, color, and season for every item.", accent: "#C8826D", bg: "rgba(200,130,109,0.07)" },
  { Icon: IconSparkle, title: "Virtual Try-On", desc: "See how outfits look on you before getting dressed. Powered by state-of-the-art AI generation.", accent: "#7C9BC0", bg: "rgba(124,155,192,0.07)" },
  { Icon: IconBot, title: "AI Style Assistant", desc: "Chat with your personal stylist. It knows your wardrobe and weather to build perfect outfits.", accent: "#6B9E72", bg: "rgba(107,158,114,0.07)" },
  { Icon: IconSun, title: "Weather-Aware", desc: "Get outfit suggestions based on today's forecast and your local 7-day weather.", accent: "#B07896", bg: "rgba(176,120,150,0.07)" },
];

const steps = [
  { num: "01", Icon: IconUpload, title: "Upload your clothes", desc: "Snap or upload photos. AI tags each item with category, color, material, and season — instantly." },
  { num: "02", Icon: IconGrid, title: "Build outfits", desc: "Mix and match pieces on a visual canvas, or simply ask the AI assistant for suggestions." },
  { num: "03", Icon: IconCamera, title: "Try them on virtually", desc: "Generate a photorealistic try-on with your own photo. See it before you wear it." },
];

const stats = [
  { value: "10s", label: "to classify a garment" },
  { value: "AI", label: "powered styling engine" },
  { value: "Free", label: "to get started" },
];

const perks = ["No credit card required", "Works with any wardrobe size", "Private & secure"];

const beforeItems = [
  "Can't remember what clothes you own",
  "Spend 20+ min deciding every morning",
  "Buy duplicates without realizing",
  "No idea if outfit matches the weather",
  "Good clothes forgotten at the back",
];

const afterItems = [
  "Full digital inventory, always in your pocket",
  "AI builds your outfit in seconds",
  "See every item you own, visually organized",
  "Weather-aware suggestions every day",
  "Try on any combination before wearing it",
];

const faqItems = [
  { q: "Is it really free?", a: "Yes — Wardrobe.AI is completely free to use. Upload your wardrobe, build outfits, and chat with the AI stylist at no cost." },
  { q: "How does virtual try-on work?", a: "Upload a photo of yourself, select clothing items from your wardrobe, and our AI generates a photorealistic image of you wearing that outfit. It typically takes under 30 seconds." },
  { q: "Do I need to upload my entire wardrobe?", a: "Not at all. You can start with a few items and add more over time. The AI gets smarter the more items you add, but even 10–15 pieces are enough to start getting great outfit ideas." },
  { q: "Is my data and photos private?", a: "Your photos and wardrobe data are stored securely and never shared or used to train AI models without your consent. You can delete your data at any time." },
  { q: "What clothing categories are supported?", a: "Tops, bottoms, outerwear, dresses, shoes, headwear, and accessories — the AI recognizes all standard clothing types and auto-classifies them on upload." },
  { q: "Does it work for all body types?", a: "Yes. The virtual try-on works with any body type and photo orientation. We're constantly improving the model to be more accurate and inclusive." },
];

// ─── Scroll Fade ─────────────────────────────────────────────────
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: delay / 1000, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const { scrollY } = useScroll();

  const navTop = useTransform(scrollY, [0, 60], ["16px", "0px"]);
  const navSide = useTransform(scrollY, [0, 60], ["16px", "0px"]);
  const navRadius = useTransform(scrollY, [0, 60], ["16px", "0px"]);
  const navBg = useTransform(scrollY, [0, 60], ["rgba(250,245,238,0.88)", "rgba(244,236,224,0.97)"]);
  const navShadow = useTransform(scrollY, [0, 60], ["0 4px 24px rgba(60,40,20,0.10)", "0 2px 20px rgba(60,40,20,0.08)"]);

  return (
    <div style={{ fontFamily: "var(--font-sans, Inter, sans-serif)", background: "#F4ECE0", color: "#2D2218", minHeight: "100vh", overflowX: "hidden" }}>

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <motion.nav style={{
        position: "fixed", top: navTop, left: navSide, right: navSide, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", height: "60px",
        borderRadius: navRadius,
        background: navBg,
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(232,223,210,0.8)",
        boxShadow: navShadow,
      }}>
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ fontFamily: "var(--font-serif,'Playfair Display',serif)", fontSize: "20px", fontWeight: 700, letterSpacing: "0.04em", userSelect: "none" }}
        >
          WARDROBE<span style={{ color: "#C8826D" }}>.AI</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ display: "flex", gap: "10px" }}
        >
          <NavBtn onClick={() => router.push("/login")} outline>Sign in</NavBtn>
          <NavBtn onClick={() => router.push("/register")}>Get started</NavBtn>
        </motion.div>
      </motion.nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", padding: "120px 48px 80px", position: "relative", overflow: "hidden", maxWidth: "1300px", margin: "0 auto", gap: "64px" }}>
        {/* Orbs */}
        <motion.div aria-hidden animate={{ y: [0, -18, 0], x: [0, 8, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", top: "10%", left: "-100px", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(200,130,109,0.15) 0%,transparent 70%)", pointerEvents: "none" }} />
        <motion.div aria-hidden animate={{ y: [0, 14, 0], x: [0, -10, 0] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", bottom: "5%", right: "30%", width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,155,192,0.13) 0%,transparent 70%)", pointerEvents: "none" }} />

        {/* Left — text */}
        <div style={{ flex: "1 1 480px", minWidth: 0 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C8826D", background: "rgba(200,130,109,0.1)", border: "1px solid rgba(200,130,109,0.28)", borderRadius: "20px", padding: "5px 14px", marginBottom: "32px" }}>
            <motion.span animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#C8826D", display: "inline-block" }} />
            AI-Powered Fashion
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ fontFamily: "var(--font-serif,'Playfair Display',serif)", fontSize: "clamp(40px,5.5vw,76px)", fontWeight: 700, lineHeight: 1.06, letterSpacing: "-0.02em", marginBottom: "28px" }}>
            Your wardrobe,<br />
            <span style={{ color: "#C8826D", position: "relative", display: "inline-block" }}>
              reimagined
              <motion.span aria-hidden initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, delay: 0.7 }}
                style={{ position: "absolute", bottom: "-4px", left: 0, right: 0, height: "3px", background: "linear-gradient(90deg,#C8826D,rgba(200,130,109,0.3))", borderRadius: "2px", transformOrigin: "left" }} />
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.32 }}
            style={{ fontSize: "clamp(16px,1.6vw,19px)", color: "#7A6B5C", lineHeight: 1.7, maxWidth: "480px", marginBottom: "40px" }}>
            Manage your clothes, build outfits, and virtually try them on — all powered by AI that knows your style and the weather.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.44 }}
            style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "36px" }}>
            <PrimaryBtn onClick={() => router.push("/register")} icon={<IconArrow />}>Start for free</PrimaryBtn>
            <GhostBtn onClick={() => router.push("/login")}>Sign in</GhostBtn>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.6 }}
            style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            {perks.map((p, i) => (
              <motion.div key={p} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.65 + i * 0.08 }}
                style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#7A6B5C" }}>
                <span style={{ color: "#6B9E72", display: "flex" }}><IconCheck /></span>
                {p}
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Right — photo */}
        <motion.div
          initial={{ opacity: 0, x: 40, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ flex: "1 1 420px", minWidth: 0, position: "relative", maxWidth: "520px" }}
        >
          <div style={{ borderRadius: "24px", overflow: "hidden", boxShadow: "0 32px 80px rgba(60,40,20,0.18)", aspectRatio: "4/5", position: "relative" }}>
            <img
              src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&q=80&fit=crop"
              alt="Fashion wardrobe"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(45,34,24,0.3) 0%, transparent 50%)" }} />
          </div>

          {/* Floating badge — top left */}
          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            style={{ position: "absolute", top: "24px", left: "-20px", background: "#fff", borderRadius: "14px", padding: "10px 16px", boxShadow: "0 8px 28px rgba(60,40,20,0.14)", display: "flex", alignItems: "center", gap: "10px" }}
          >
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(200,130,109,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#C8826D" }}><IconSparkle /></div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#2D2218" }}>AI Stylist</div>
              <div style={{ fontSize: "11px", color: "#7A6B5C" }}>Outfit ready ✓</div>
            </div>
          </motion.div>

          {/* Floating badge — bottom right */}
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            style={{ position: "absolute", bottom: "32px", right: "-16px", background: "#2D2218", borderRadius: "14px", padding: "12px 18px", boxShadow: "0 8px 28px rgba(45,34,24,0.25)", display: "flex", alignItems: "center", gap: "10px" }}
          >
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#6B9E72", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "12px", color: "#F4ECE0", fontWeight: 600 }}>48 items organized</div>
              <div style={{ fontSize: "11px", color: "rgba(244,236,224,0.55)" }}>Updated just now</div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── MARQUEE ─────────────────────────────────────────────── */}
      <div style={{ overflow: "hidden", borderTop: "1px solid #E8DFD2", borderBottom: "1px solid #E8DFD2", background: "#FAF5EE", padding: "18px 0" }}>
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
          style={{ display: "flex", whiteSpace: "nowrap", width: "max-content" }}
        >
          {[...Array(2)].flatMap(() =>
            ["Smart Wardrobe","Virtual Try-On","AI Styling","Weather-Aware","Outfit Builder","Style Assistant"].map((label, i) => (
              <span key={label + i} style={{ display: "inline-flex", alignItems: "center", gap: "16px", padding: "0 36px", fontSize: "13px", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: i === 0 || i === 3 ? "#C8826D" : "#A89A8A" }}>
                {label}
                <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#D4C8B8", display: "inline-block" }} />
              </span>
            ))
          )}
        </motion.div>
      </div>

      {/* ── CLOTHING PHOTO GRID ─────────────────────────────────── */}
      <section style={{ padding: "80px 0", background: "#F4ECE0", overflow: "hidden" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: "48px", padding: "0 24px" }}>
            <SectionLabel>Your style, digitized</SectionLabel>
            <SectionTitle>Every piece you own, always at hand</SectionTitle>
          </div>
        </FadeIn>
        <ClothingPhotoGrid />
      </section>

      {/* ── APP MOCKUP ──────────────────────────────────────────── */}
      <section style={{ padding: "100px 24px", background: "#F4ECE0", overflow: "hidden" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <SectionLabel>See it in action</SectionLabel>
              <SectionTitle>Your wardrobe, beautifully organized</SectionTitle>
              <SectionSub>Everything you need in one clean, intuitive interface.</SectionSub>
            </div>
          </FadeIn>

          <FadeIn delay={100}>
            <AppMockup />
          </FadeIn>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────── */}
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "100px 24px" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <SectionLabel>Features</SectionLabel>
            <SectionTitle>Everything you need to dress better</SectionTitle>
            <SectionSub>One app to organize, style, and visualize your entire wardrobe.</SectionSub>
          </div>
        </FadeIn>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "20px" }}>
          {features.map((f, i) => <FadeIn key={f.title} delay={i * 80}><FeatureCard {...f} /></FadeIn>)}
        </div>
      </section>

      {/* ── TRY-ON SHOWCASE ─────────────────────────────────────── */}
      <section style={{ padding: "100px 24px", background: "#F4ECE0" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <SectionLabel>Virtual Try-On</SectionLabel>
              <SectionTitle>See it on you, before you wear it</SectionTitle>
              <SectionSub>Upload your photo, pick an outfit — AI shows you the result in seconds.</SectionSub>
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <TryOnShowcase />
          </FadeIn>
        </div>
      </section>

      {/* ── COMPARISON ──────────────────────────────────────────── */}
      <section style={{ background: "#FAF5EE", borderTop: "1px solid #E8DFD2", borderBottom: "1px solid #E8DFD2", padding: "100px 24px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "64px" }}>
              <SectionLabel>Why Wardrobe.AI</SectionLabel>
              <SectionTitle>Old way vs. the smart way</SectionTitle>
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <ComparisonSection />
          </FadeIn>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────── */}
      <section style={{ background: "#2D2218", padding: "100px 24px", position: "relative", overflow: "hidden" }}>
        <Orb top="-80px" right="-80px" size={500} color="rgba(200,130,109,0.08)" />
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "72px" }}>
              <SectionLabel>How it works</SectionLabel>
              <SectionTitle light>Three steps to your perfect look</SectionTitle>
            </div>
          </FadeIn>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "24px" }}>
            {steps.map((s, i) => <FadeIn key={s.num} delay={i * 100}><StepCard {...s} /></FadeIn>)}
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────────── */}
      <section style={{ background: "#F4ECE0", borderBottom: "1px solid #E8DFD2", padding: "72px 24px" }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
          style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "48px", textAlign: "center" }}
        >
          {stats.map((s) => (
            <motion.div
              key={s.label}
              variants={{
                hidden: { opacity: 0, scale: 0.6, y: 20 },
                visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 20 } },
              }}
            >
              <div style={{ fontFamily: "var(--font-serif,'Playfair Display',serif)", fontSize: "clamp(36px,5vw,56px)", fontWeight: 700, color: "#2D2218", lineHeight: 1, marginBottom: "8px" }}>{s.value}</div>
              <div style={{ fontSize: "14px", color: "#7A6B5C", letterSpacing: "0.02em" }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto" }}>
          <FadeIn>
            <div style={{ textAlign: "center", marginBottom: "56px" }}>
              <SectionLabel>FAQ</SectionLabel>
              <SectionTitle>Common questions</SectionTitle>
            </div>
          </FadeIn>
          <FadeIn delay={80}>
            <FAQSection />
          </FadeIn>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section style={{ padding: "40px 24px 120px", textAlign: "center" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 32 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ maxWidth: "680px", margin: "0 auto", position: "relative" }}
        >
          {/* Glow ring — inspired by ShinyButton concept, adapted to warm palette */}
          <motion.div
            aria-hidden
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ position: "absolute", inset: "-2px", borderRadius: "30px", background: "conic-gradient(from 0deg, transparent 60%, rgba(200,130,109,0.4) 75%, rgba(124,155,192,0.3) 85%, transparent 95%)", pointerEvents: "none", zIndex: 0 }}
          />
          <div style={{ position: "relative", zIndex: 1, padding: "72px 48px", background: "linear-gradient(135deg,#FAF5EE 0%,#F4ECE0 100%)", border: "1px solid rgba(200,130,109,0.2)", borderRadius: "28px", boxShadow: "0 8px 48px rgba(60,40,20,0.08)", overflow: "hidden" }}>
            <motion.div
              aria-hidden
              animate={{ y: [0, -16, 0], x: [0, 10, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              style={{ position: "absolute", top: "-60px", right: "-60px", width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle,rgba(200,130,109,0.14) 0%,transparent 70%)", pointerEvents: "none" }}
            />
            <motion.div
              aria-hidden
              animate={{ y: [0, 12, 0], x: [0, -8, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
              style={{ position: "absolute", bottom: "-40px", left: "-40px", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,155,192,0.12) 0%,transparent 70%)", pointerEvents: "none" }}
            />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
              style={{ fontFamily: "var(--font-serif,'Playfair Display',serif)", fontSize: "clamp(26px,4vw,40px)", fontWeight: 700, lineHeight: 1.2, marginBottom: "16px", letterSpacing: "-0.01em", position: "relative" }}
            >
              Ready to transform your style?
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.32, duration: 0.6 }}
              style={{ color: "#7A6B5C", fontSize: "16px", lineHeight: 1.65, marginBottom: "36px", position: "relative" }}
            >
              Join thousands of people who dressed smarter with AI.<br />Free to use. No credit card required.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.44, duration: 0.5, type: "spring", stiffness: 300, damping: 20 }}
              style={{ position: "relative" }}
            >
              <PrimaryBtn accent onClick={() => router.push("/register")} icon={<IconArrow />}>
                Create your wardrobe
              </PrimaryBtn>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid #E8DFD2", background: "#FAF5EE", padding: "32px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ fontFamily: "var(--font-serif,'Playfair Display',serif)", fontSize: "17px", fontWeight: 700, letterSpacing: "0.04em" }}>
          WARDROBE<span style={{ color: "#C8826D" }}>.AI</span>
        </div>
        <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
          {["Features", "How it works", "Sign in"].map((link) => (
            <span key={link} onClick={() => router.push(link === "Sign in" ? "/login" : "#")}
              style={{ fontSize: "14px", color: "#7A6B5C", cursor: "pointer", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#2D2218")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#7A6B5C")}>{link}</span>
          ))}
        </div>
        <div style={{ fontSize: "13px", color: "#A89A8A" }}>© {new Date().getFullYear()} Wardrobe.AI</div>
      </footer>

      <style>{`
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
      `}</style>
    </div>
  );
}

// ─── Shared Primitives ───────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "inline-block", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C8826D", marginBottom: "16px" }}>{children}</div>;
}
function SectionTitle({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return <h2 style={{ fontFamily: "var(--font-serif,'Playfair Display',serif)", fontSize: "clamp(28px,4vw,44px)", fontWeight: 700, lineHeight: 1.15, marginBottom: "16px", letterSpacing: "-0.01em", color: light ? "#F4ECE0" : "#2D2218" }}>{children}</h2>;
}
function SectionSub({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: "17px", color: "#7A6B5C", maxWidth: "480px", margin: "0 auto", lineHeight: 1.65 }}>{children}</p>;
}
function Orb({ top, bottom, left, right, size, color }: { top?: string; bottom?: string; left?: string; right?: string; size: number; color: string }) {
  return <div aria-hidden style={{ position: "absolute", top, bottom, left, right, width: size, height: size, borderRadius: "50%", background: `radial-gradient(circle,${color} 0%,transparent 70%)`, pointerEvents: "none" }} />;
}
function NavBtn({ children, onClick, outline }: { children: React.ReactNode; onClick: () => void; outline?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03, y: outline ? 0 : -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      style={{ padding: "8px 20px", borderRadius: "10px", border: outline ? "1px solid rgba(45,34,24,0.18)" : "none", background: outline ? "transparent" : "#2D2218", color: outline ? "#2D2218" : "#F4ECE0", fontSize: "14px", fontWeight: outline ? 500 : 600, cursor: "pointer", fontFamily: "inherit" }}
    >
      {children}
    </motion.button>
  );
}
function PrimaryBtn({ children, onClick, icon, accent }: { children: React.ReactNode; onClick: () => void; icon?: React.ReactNode; accent?: boolean }) {
  const bg = accent ? "#C8826D" : "#2D2218";
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 18 }}
      style={{ padding: "16px 36px", borderRadius: "12px", border: "none", background: bg, color: "#F4ECE0", fontSize: "15px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: "8px", boxShadow: accent ? "0 6px 24px rgba(200,130,109,0.4)" : "0 4px 20px rgba(45,34,24,0.25)" }}
    >
      {children}{icon}
    </motion.button>
  );
}
function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -1, borderColor: "rgba(45,34,24,0.35)" }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 18 }}
      style={{ padding: "16px 36px", borderRadius: "12px", border: "1px solid rgba(45,34,24,0.2)", background: "rgba(250,245,238,0.8)", color: "#2D2218", fontSize: "15px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
    >
      {children}
    </motion.button>
  );
}

// ─── App Mockup ──────────────────────────────────────────────────
function AppMockup() {
  const clothes = [
    { color: "#7C9BC0", label: "Blue shirt", cat: "Top" },
    { color: "#C8826D", label: "Knit sweater", cat: "Top" },
    { color: "#6B9E72", label: "Cargo pants", cat: "Bottom" },
    { color: "#2D2218", label: "Black jeans", cat: "Bottom" },
    { color: "#B07896", label: "Midi dress", cat: "Dress" },
    { color: "#A89A8A", label: "Trench coat", cat: "Outer" },
  ];
  const chatMessages = [
    { role: "user", text: "What should I wear today? It's 12°C outside." },
    { role: "ai", text: "For 12°C I'd suggest the knit sweater with black jeans and the trench coat. Cozy and polished." },
    { role: "user", text: "Can you show it on a flatlay?" },
    { role: "ai", text: "Done! Outfit ready on your canvas." },
  ];

  return (
    <div style={{ position: "relative" }}>
      {/* Browser chrome */}
      <div style={{ borderRadius: "16px", overflow: "hidden", boxShadow: "0 32px 80px rgba(60,40,20,0.18), 0 0 0 1px rgba(60,40,20,0.08)", background: "#FAF5EE" }}>
        {/* Title bar */}
        <div style={{ background: "#2D2218", padding: "12px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", gap: "7px" }}>
            {["#B85858","#C8826D","#6B9E72"].map((c) => <div key={c} style={{ width: "12px", height: "12px", borderRadius: "50%", background: c }} />)}
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: "6px", padding: "5px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#6B9E72" }} />
            <span style={{ fontSize: "12px", color: "rgba(244,236,224,0.6)", fontFamily: "monospace" }}>wardrobe.ai/studio</span>
          </div>
        </div>

        {/* App UI */}
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 240px", minHeight: "440px" }}>

          {/* Sidebar — wardrobe */}
          <div style={{ borderRight: "1px solid #E8DFD2", padding: "20px 0", background: "#FAF5EE" }}>
            <div style={{ padding: "0 16px 16px", fontFamily: "var(--font-serif,'Playfair Display',serif)", fontSize: "15px", fontWeight: 600, color: "#2D2218" }}>My Wardrobe</div>
            {[{ label: "Tops", items: 2 }, { label: "Bottoms", items: 2 }, { label: "Dresses", items: 1 }, { label: "Outerwear", items: 1 }].map((cat, ci) => (
              <div key={cat.label} style={{ marginBottom: "16px" }}>
                <div style={{ padding: "0 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#7A6B5C", letterSpacing: "0.02em" }}>{cat.label}</span>
                  <span style={{ fontSize: "11px", background: "#C8826D", color: "#fff", borderRadius: "10px", padding: "1px 7px", fontWeight: 600 }}>{cat.items}</span>
                </div>
                <div style={{ display: "flex", gap: "8px", padding: "0 16px", overflowX: "hidden" }}>
                  {clothes.slice(ci * 2, ci * 2 + (ci < 2 ? 2 : 1)).map((item) => (
                    <div key={item.label} style={{ width: "68px", borderRadius: "10px", border: "1px solid #E8DFD2", background: "#fff", overflow: "hidden", flexShrink: 0 }}>
                      <div style={{ height: "54px", background: item.color + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: item.color, opacity: 0.8 }} />
                      </div>
                      <div style={{ padding: "4px 6px", fontSize: "9px", color: "#7A6B5C", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Canvas */}
          <div style={{ background: "#F4ECE0", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px", padding: "24px" }}>
            {/* Grid bg */}
            <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(176,132,86,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(176,132,86,0.1) 1px,transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none" }} />
            <div style={{ position: "relative", fontSize: "12px", fontWeight: 600, color: "#A89A8A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Outfit Canvas</div>
            {/* Clothing arrangement */}
            <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
              {[clothes[1], clothes[3], clothes[5]].map((item, i) => (
                <div key={item.label} style={{ background: "#fff", border: "1.5px solid " + (i === 1 ? "#C8826D" : "#E8DFD2"), borderRadius: "12px", padding: "10px 16px", display: "flex", alignItems: "center", gap: "10px", boxShadow: i === 1 ? "0 4px 16px rgba(200,130,109,0.2)" : "0 2px 8px rgba(60,40,20,0.06)", width: "180px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: item.color + "33", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "16px", height: "16px", borderRadius: "4px", background: item.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#2D2218" }}>{item.label}</div>
                    <div style={{ fontSize: "10px", color: "#A89A8A" }}>{item.cat}</div>
                  </div>
                  {i === 1 && <div style={{ marginLeft: "auto", width: "16px", height: "16px", borderRadius: "50%", background: "#C8826D", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: "9px", fontWeight: 700 }}>✓</span></div>}
                </div>
              ))}
            </div>
          </div>

          {/* AI Chat */}
          <div style={{ borderLeft: "1px solid #E8DFD2", background: "#FAF5EE", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #E8DFD2", display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#2D2218", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#C8826D", fontSize: "13px" }}>✦</span>
              </div>
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#2D2218" }}>Style Assistant</div>
                <div style={{ fontSize: "10px", color: "#6B9E72" }}>● Online</div>
              </div>
            </div>
            <div style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", gap: "10px", overflowY: "hidden" }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "85%", padding: "8px 11px", borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: msg.role === "user" ? "#2D2218" : "#fff", color: msg.role === "user" ? "#F4ECE0" : "#2D2218", fontSize: "11px", lineHeight: 1.5, border: msg.role === "ai" ? "1px solid #E8DFD2" : "none", boxShadow: "0 1px 4px rgba(60,40,20,0.06)" }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 12px", borderTop: "1px solid #E8DFD2", display: "flex", gap: "8px" }}>
              <div style={{ flex: 1, background: "#fff", border: "1px solid #E8DFD2", borderRadius: "8px", padding: "7px 12px", fontSize: "11px", color: "#A89A8A" }}>Ask your stylist...</div>
              <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "#C8826D", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", top: "60px", right: "-28px", background: "#fff", border: "1px solid #E8DFD2", borderRadius: "12px", padding: "10px 14px", boxShadow: "0 8px 24px rgba(60,40,20,0.12)", display: "flex", alignItems: "center", gap: "8px" }}
      >
        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(107,158,114,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B9E72" }}><IconSparkle /></div>
        <div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#2D2218" }}>AI Analysis</div>
          <div style={{ fontSize: "11px", color: "#7A6B5C" }}>Outfit score: 94%</div>
        </div>
      </motion.div>
      <motion.div
        animate={{ y: [0, 7, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", bottom: "60px", left: "-24px", background: "#2D2218", borderRadius: "12px", padding: "10px 16px", boxShadow: "0 8px 24px rgba(45,34,24,0.2)", display: "flex", alignItems: "center", gap: "8px" }}
      >
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#C8826D" }} />
        <span style={{ fontSize: "12px", color: "#F4ECE0", fontWeight: 500 }}>12°C · Partly cloudy</span>
      </motion.div>
    </div>
  );
}

// ─── Comparison ──────────────────────────────────────────────────
const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const itemLeft =  { hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0, transition: { duration: 0.4 } } };
const itemRight = { hidden: { opacity: 0, x:  10 }, visible: { opacity: 1, x: 0, transition: { duration: 0.4 } } };

function ComparisonSection() {
  const beforeItems = [
    "Can't remember what clothes you own",
    "Spend 20+ min deciding every morning",
    "Buying duplicates without realizing",
    "No idea if outfit matches the weather",
    "Good clothes forgotten at the back",
  ];
  const afterItems = [
    "Full digital inventory, always with you",
    "AI builds your outfit in seconds",
    "See every item you own, visually",
    "Weather-aware suggestions every day",
    "Try on any combination before wearing",
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "0", alignItems: "stretch" }}>
      {/* Before */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        variants={listVariants}
        style={{ background: "#fff", border: "1px solid #E8DFD2", borderRadius: "20px 0 0 20px", padding: "36px 32px", borderRight: "none" }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#B85858", background: "rgba(184,88,88,0.08)", borderRadius: "8px", padding: "5px 12px", marginBottom: "28px" }}>
          <IconX />Without AI
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {beforeItems.map((item) => (
            <motion.div key={item} variants={itemLeft} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(184,88,88,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px", color: "#B85858" }}><IconX /></div>
              <span style={{ fontSize: "14px", color: "#7A6B5C", lineHeight: 1.55 }}>{item}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Divider */}
      <div style={{ width: "1px", background: "linear-gradient(to bottom,transparent,#E8DFD2 20%,#E8DFD2 80%,transparent)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", width: "36px", height: "36px", borderRadius: "50%", background: "#FAF5EE", border: "1px solid #E8DFD2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: "#C8826D", boxShadow: "0 2px 8px rgba(60,40,20,0.06)" }}
        >vs</motion.div>
      </div>

      {/* After */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        variants={listVariants}
        style={{ background: "#2D2218", borderRadius: "0 20px 20px 0", padding: "36px 32px" }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6B9E72", background: "rgba(107,158,114,0.12)", borderRadius: "8px", padding: "5px 12px", marginBottom: "28px" }}>
          <IconCheck />With Wardrobe.AI
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {afterItems.map((item) => (
            <motion.div key={item} variants={itemRight} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(107,158,114,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px", color: "#6B9E72" }}><IconCheck /></div>
              <span style={{ fontSize: "14px", color: "rgba(244,236,224,0.8)", lineHeight: 1.55 }}>{item}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────
function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {faqItems.map((item, i) => {
        const isOpen = open === i;
        return (
          <motion.div
            key={i}
            animate={{
              borderColor: isOpen ? "rgba(200,130,109,0.35)" : "#E8DFD2",
              boxShadow: isOpen ? "0 4px 20px rgba(60,40,20,0.07)" : "0 0 0 rgba(60,40,20,0)",
            }}
            transition={{ duration: 0.2 }}
            style={{ background: "#FAF5EE", border: "1px solid #E8DFD2", borderRadius: "14px", overflow: "hidden" }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              style={{ width: "100%", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", gap: "16px" }}
            >
              <span style={{ fontSize: "15px", fontWeight: 600, color: "#2D2218", lineHeight: 1.4 }}>{item.q}</span>
              <motion.span
                animate={{ backgroundColor: isOpen ? "#C8826D" : "rgba(45,34,24,0.07)", color: isOpen ? "#fff" : "#7A6B5C", rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ flexShrink: 0, width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <IconPlus />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ padding: "0 24px 20px", fontSize: "14px", color: "#7A6B5C", lineHeight: 1.7 }}>
                    {item.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Feature Card ────────────────────────────────────────────────
function FeatureCard({ Icon, title, desc, accent, bg }: { Icon: () => React.JSX.Element; title: string; desc: string; accent: string; bg: string }) {
  return (
    <motion.div
      whileHover={{ y: -6, backgroundColor: "#FFFFFF", boxShadow: "0 16px 48px rgba(60,40,20,0.12)", borderColor: "rgba(45,34,24,0.1)" }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      style={{ background: "#FAF5EE", border: "1px solid #E8DFD2", borderRadius: "20px", padding: "32px 28px", cursor: "default", boxShadow: "0 2px 8px rgba(60,40,20,0.04)" }}
    >
      <motion.div
        whileHover={{ scale: 1.1 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
        style={{ width: "52px", height: "52px", borderRadius: "14px", background: bg, color: accent, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}
      >
        <Icon />
      </motion.div>
      <div style={{ fontFamily: "var(--font-serif,'Playfair Display',serif)", fontWeight: 600, fontSize: "18px", marginBottom: "10px", color: "#2D2218" }}>{title}</div>
      <div style={{ fontSize: "14px", color: "#7A6B5C", lineHeight: 1.7 }}>{desc}</div>
    </motion.div>
  );
}

// ─── Step Card ───────────────────────────────────────────────────
function StepCard({ num, Icon, title, desc }: { num: string; Icon: () => React.JSX.Element; title: string; desc: string }) {
  return (
    <motion.div
      whileHover={{ y: -6, backgroundColor: "rgba(255,255,255,0.07)", borderColor: "rgba(200,130,109,0.35)", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(244,236,224,0.1)", borderRadius: "20px", padding: "36px 28px", cursor: "default" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "20px" }}>
        <div style={{ fontFamily: "var(--font-serif,'Playfair Display',serif)", fontSize: "42px", fontWeight: 700, color: "rgba(200,130,109,0.3)", lineHeight: 1, flexShrink: 0 }}>{num}</div>
        <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(200,130,109,0.12)", color: "#C8826D", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "4px" }}><Icon /></div>
      </div>
      <div style={{ fontFamily: "var(--font-serif,'Playfair Display',serif)", fontWeight: 600, fontSize: "18px", marginBottom: "10px", color: "#F4ECE0" }}>{title}</div>
      <div style={{ fontSize: "14px", color: "rgba(244,236,224,0.6)", lineHeight: 1.7 }}>{desc}</div>
    </motion.div>
  );
}

// ─── Clothing Photo Grid ──────────────────────────────────────────
const clothingPhotos = [
  { src: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&q=80&fit=crop", label: "Outerwear" },
  { src: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80&fit=crop", label: "Footwear" },
  { src: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&q=80&fit=crop", label: "Tops" },
  { src: "https://images.unsplash.com/photo-1495105787522-5334e3ffa0ef?w=400&q=80&fit=crop", label: "Bottoms" },
  { src: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80&fit=crop", label: "Bags" },
  { src: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400&q=80&fit=crop", label: "Dresses" },
  { src: "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=400&q=80&fit=crop", label: "Accessories" },
  { src: "https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=400&q=80&fit=crop", label: "Knitwear" },
];

function ClothingPhotoGrid() {
  return (
    <div style={{ overflow: "hidden" }}>
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
        style={{ display: "flex", gap: "20px", width: "max-content" }}
      >
        {[...clothingPhotos, ...clothingPhotos].map((item, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -8, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{ flexShrink: 0, width: "200px", borderRadius: "18px", overflow: "hidden", boxShadow: "0 4px 20px rgba(60,40,20,0.10)", background: "#fff", cursor: "default" }}
          >
            <div style={{ height: "240px", overflow: "hidden" }}>
              <img src={item.src} alt={item.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#2D2218" }}>{item.label}</span>
              <span style={{ fontSize: "11px", background: "rgba(200,130,109,0.1)", color: "#C8826D", borderRadius: "8px", padding: "2px 8px", fontWeight: 600 }}>AI tagged</span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Try-On Showcase ─────────────────────────────────────────────
function TryOnShowcase() {
  const [active, setActive] = useState<"before" | "after">("before");

  const panels = {
    before: {
      label: "Original photo",
      tag: "Your look",
      src: "/main_page/original.png",
      desc: "Upload any photo of yourself",
    },
    after: {
      label: "AI Try-On",
      tag: "Styled by AI ✦",
      src: "/main_page/original_dressed.png",
      desc: "See the outfit on you instantly",
    },
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        {(["before", "after"] as const).map((side) => {
          const p = panels[side];
          const isActive = active === side;
          return (
            <motion.div
              key={side}
              onClick={() => setActive(side)}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              style={{ borderRadius: "24px", overflow: "hidden", cursor: "pointer", position: "relative", boxShadow: isActive ? "0 20px 60px rgba(60,40,20,0.18)" : "0 4px 20px rgba(60,40,20,0.08)", border: `2px solid ${isActive ? "#C8826D" : "transparent"}`, transition: "border-color 0.3s, box-shadow 0.3s" }}
            >
              <div style={{ aspectRatio: "3/4", overflow: "hidden" }}>
                <img src={p.src} alt={p.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(45,34,24,0.55) 0%, transparent 55%)" }} />
              </div>
              <div style={{ position: "absolute", top: "16px", left: "16px" }}>
                <span style={{ background: isActive ? "#C8826D" : "rgba(250,245,238,0.9)", color: isActive ? "#fff" : "#7A6B5C", fontSize: "12px", fontWeight: 700, padding: "5px 12px", borderRadius: "20px", letterSpacing: "0.04em" }}>
                  {p.tag}
                </span>
              </div>

              {/* Clothing item badge — only on "after" panel */}
              {side === "after" && (
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  style={{ position: "absolute", top: "16px", right: "16px", background: "rgba(250,245,238,0.95)", backdropFilter: "blur(8px)", borderRadius: "14px", padding: "8px", boxShadow: "0 4px 16px rgba(60,40,20,0.15)", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", width: "64px" }}
                >
                  <img
                    src="/main_page/dress.png"
                    alt="Applied outfit"
                    style={{ width: "48px", height: "64px", objectFit: "contain" }}
                  />
                  <span style={{ fontSize: "9px", fontWeight: 700, color: "#C8826D", letterSpacing: "0.04em", textTransform: "uppercase" }}>Applied</span>
                </motion.div>
              )}

              <div style={{ position: "absolute", bottom: "0", left: "0", right: "0", padding: "24px" }}>
                <div style={{ fontFamily: "var(--font-serif,'Playfair Display',serif)", fontSize: "20px", fontWeight: 700, color: "#F4ECE0", marginBottom: "4px" }}>{p.label}</div>
                <div style={{ fontSize: "13px", color: "rgba(244,236,224,0.7)" }}>{p.desc}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "24px" }}>
        {(["before", "after"] as const).map((side) => (
          <button key={side} onClick={() => setActive(side)}
            style={{ width: active === side ? "28px" : "8px", height: "8px", borderRadius: "4px", border: "none", background: active === side ? "#C8826D" : "#D4C8B8", cursor: "pointer", transition: "all 0.3s ease", padding: 0 }} />
        ))}
      </div>
    </div>
  );
}
