// client/src/components/MainMenu.tsx
// Statistical Magic Academy home screen. Dark starfield, glowing gold bilingual
// title, floating runes, and the main action buttons including 題庫長廊.
import { useMemo } from "react";
import type { WizardKind, LanguageMode } from "@shared/types";
import { WizardPicker } from "./ui";

const RUNES = ["ᚠ", "ᚦ", "ᛉ", "ᚱ", "ᛟ", "ᛗ", "ψ", "Σ", "λ", "μ", "∑", "√"];

// Self-made floating "academy / palace" crest — pure inline SVG (no copyright,
// no emoji). White-gold, with a slow float + glow handled in CSS.
function PalaceCrest() {
  return (
    <div className="palace-crest" aria-hidden>
      <svg viewBox="0 0 120 96" width="96" height="76" role="img">
        <defs>
          <linearGradient id="pc-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fdf3d0" />
            <stop offset="0.5" stopColor="#e7c873" />
            <stop offset="1" stopColor="#b79a52" />
          </linearGradient>
        </defs>
        <g fill="url(#pc-gold)" stroke="#fff6da" strokeWidth="0.6">
          {/* pediment */}
          <polygon points="60,6 108,32 12,32" />
          {/* architrave */}
          <rect x="14" y="33" width="92" height="7" rx="1.5" />
          {/* columns */}
          {[20, 36, 52, 68, 84].map((x) => (
            <rect key={x} x={x} y="42" width="9" height="38" rx="1" />
          ))}
          {/* base / steps */}
          <rect x="10" y="81" width="100" height="6" rx="1.5" />
          <rect x="4" y="88" width="112" height="6" rx="1.5" opacity="0.85" />
        </g>
        {/* tiny apex star */}
        <circle cx="60" cy="4" r="2.4" fill="#fff6da" />
      </svg>
    </div>
  );
}

const L = (lang: LanguageMode) => {
  const zh = lang !== "en";
  const en = lang !== "zh";
  const both = lang === "en_zh";
  return {
    eyebrow: both ? "A fill-in-the-blank wizard duel · 填空魔法對戰" : zh ? "填空魔法對戰" : "A fill-in-the-blank wizard duel",
    subtitle: both ? "統計魔法學院・期末決戰 — Statistical Magic Academy" : zh ? "統計魔法學院・期末決戰" : "Statistical Magic Academy · Final Battle",
    blurb: both
      ? "施展統計魔法，以真實多變量期末考題驅動你的法術。答得又快又對，傷害越高。十八年考古題，一座競技場。"
      : zh
      ? "施展統計魔法，以真實多變量期末考題驅動你的法術。答得又快又對，傷害越高。十八年考古題，一座競技場。"
      : "Power your spells with real multivariate-statistics exam questions. Faster, correct answers hit harder. Eighteen years of finals, one arena.",
    name: both ? "巫師名稱 / Wizard name" : zh ? "巫師名稱" : "Wizard name",
    school: both ? "選擇學派 / Choose your school" : zh ? "選擇學派" : "Choose your school",
    bot: both ? "1 vs Bot 對戰" : zh ? "對戰 AI 巫師" : "Duel the Bot",
    online: both ? "1 vs 1 連線對戰" : zh ? "連線對戰" : "Online 1v1",
    gallery: both ? "歷史長廊 / History Gallery" : zh ? "歷史長廊" : "History Gallery",
    settings: both ? "設定 / Settings" : zh ? "設定" : "Settings",
    stats: both ? "題庫統計 / Stats" : zh ? "題庫統計" : "Question Bank",
  };
};

export default function MainMenu(props: {
  nickname: string;
  wizard: WizardKind;
  uiLang: LanguageMode;
  onUiLang: (l: LanguageMode) => void;
  onNickname: (s: string) => void;
  onWizard: (k: WizardKind) => void;
  onPlayBot: () => void;
  onPlayOnline: () => void;
  onSettings: () => void;
  onStats: () => void;
  onGallery: () => void;
}) {
  const t = L(props.uiLang);
  const stars = useMemo(
    () => Array.from({ length: 70 }, () => ({
      x: Math.random() * 100, y: Math.random() * 100,
      s: Math.random() * 2 + 0.5, d: Math.random() * 4, o: Math.random() * 0.6 + 0.2,
    })), []);
  const runes = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      r: RUNES[i % RUNES.length], x: Math.random() * 96 + 2, y: Math.random() * 92 + 2,
      sz: Math.random() * 16 + 14, d: Math.random() * 8, o: Math.random() * 0.18 + 0.05,
    })), []);

  return (
    <div className="home float-in">
      {/* animated backdrop */}
      <div className="home-sky" aria-hidden>
        {stars.map((s, i) => (
          <span key={i} className="star" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o, animationDelay: `${s.d}s` }} />
        ))}
        {runes.map((r, i) => (
          <span key={i} className="rune" style={{ left: `${r.x}%`, top: `${r.y}%`, fontSize: r.sz, opacity: r.o, animationDelay: `${r.d}s` }}>{r.r}</span>
        ))}
        <div className="magic-ring ring-a" />
        <div className="magic-ring ring-b" />
      </div>

      {/* language toggle */}
      <div className="home-lang seg">
        {(["en", "en_zh", "zh"] as LanguageMode[]).map((l) => (
          <button key={l} className={"opt" + (l === props.uiLang ? " active" : "")} onClick={() => props.onUiLang(l)} type="button">
            {l === "en" ? "EN" : l === "zh" ? "中" : "EN+中"}
          </button>
        ))}
      </div>

      <div className="home-inner">
        <div className="home-hero">
          <PalaceCrest />
          <span className="eyebrow">{t.eyebrow}</span>
          <h1 className="home-title">
            <span className="home-title-zh">多變量巫師對戰</span>
            <span className="home-title-en">Multivariate Wizards</span>
          </h1>
          <p className="home-subtitle">✦ {t.subtitle} ✦</p>
          <p className="muted home-blurb">{t.blurb}</p>
        </div>

        <div className="home-card panel">
          <div className="field" style={{ marginBottom: 16 }}>
            <label>{t.name}</label>
            <input className="input" maxLength={18} value={props.nickname} placeholder="Archmage…" onChange={(e) => props.onNickname(e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 20 }}>
            <label>{t.school}</label>
            <WizardPicker value={props.wizard} onChange={props.onWizard} />
          </div>

          <div className="menu-actions">
            <button className="btn btn-primary btn-block" onClick={props.onPlayBot}>⚔ {t.bot}</button>
            <button className="btn btn-gold btn-block" onClick={props.onPlayOnline}>{t.online}</button>
            <button className="btn btn-arcane btn-block" onClick={props.onGallery}>📚 {t.gallery}</button>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn btn-ghost grow" onClick={props.onSettings}>{t.settings}</button>
              <button className="btn btn-ghost grow" onClick={props.onStats}>{t.stats}</button>
            </div>
          </div>
        </div>
      </div>

      <p className="home-foot">多變量統計 · Ch6 MANOVA · Ch7 Discriminant Analysis · 18-year exam archive</p>
    </div>
  );
}
