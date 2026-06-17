// client/src/components/SettingsPanel.tsx
import { useState } from "react";
import type { GameSettings, Difficulty, LanguageMode } from "@shared/types";
import { Segmented, Toggle } from "./ui";
import { audio } from "../game/systems/AudioManager";

export default function SettingsPanel(props: {
  settings: GameSettings;
  onChange: (s: GameSettings) => void;
  onBack: () => void;
}) {
  const s = props.settings;
  const set = (patch: Partial<GameSettings>) => props.onChange({ ...s, ...patch });
  const [muted, setMuted] = useState(audio.isMuted);
  const [master, setMaster] = useState(0.8);
  const [bgm, setBgm] = useState(0.5);
  const [sfx, setSfx] = useState(0.8);

  return (
    <div className="form-wrap float-in">
      <div className="row between" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 26 }}>Settings</h2>
        <button className="btn btn-ghost btn-sm" onClick={props.onBack}>← Back</button>
      </div>

      <div className="panel form-card stack" style={{ gap: 24 }}>
        <div className="field">
          <label>Questions per duel</label>
          <Segmented
            value={s.questionCount}
            onChange={(v) => set({ questionCount: v })}
            options={[5, 10, 15, 20].map((n) => ({ label: String(n), value: n }))}
          />
        </div>

        <div className="field">
          <label>Time per question</label>
          <Segmented
            value={s.timePerQuestion}
            onChange={(v) => set({ timePerQuestion: v })}
            options={[15, 20, 30, 45, 60].map((n) => ({ label: `${n}s`, value: n }))}
          />
        </div>

        <div className="field">
          <label>Language</label>
          <Segmented<LanguageMode>
            value={s.languageMode}
            onChange={(v) => set({ languageMode: v })}
            options={[
              { label: "English", value: "en" },
              { label: "English + 中文", value: "en_zh" },
              { label: "中文", value: "zh" },
            ]}
          />
        </div>

        <div className="field">
          <label>Bot difficulty (1vBot)</label>
          <Segmented<Difficulty>
            value={s.botDifficulty ?? "normal"}
            onChange={(v) => set({ botDifficulty: v })}
            options={[
              { label: "Apprentice", value: "easy" },
              { label: "Adept", value: "normal" },
              { label: "Archmage", value: "hard" },
            ]}
          />
        </div>

        <hr className="hairline" style={{ margin: 0 }} />

        <div className="row between">
          <Toggle checked={s.showChapterTag} onChange={(v) => set({ showChapterTag: v })} label="Show chapter tag" />
          <Toggle checked={s.showYearTag} onChange={(v) => set({ showYearTag: v })} label="Show year tag" />
        </div>

        <hr className="hairline" style={{ margin: 0 }} />

        <div className="field">
          <label>Audio</label>
          <div className="stack" style={{ gap: 12 }}>
            <VolRow label="Master" value={master} onChange={(v) => { audio.unlock(); setMaster(v); audio.setMaster(v); }} />
            <VolRow label="BGM" value={bgm} onChange={(v) => { audio.unlock(); setBgm(v); audio.setBgm(v); }} />
            <VolRow label="SFX" value={sfx} onChange={(v) => { audio.unlock(); setSfx(v); audio.setSfx(v); audio.sfx("click"); }} />
            <div className="row between">
              <Toggle
                checked={!muted}
                onChange={(v) => { audio.unlock(); audio.setMuted(!v); setMuted(!v); if (v) audio.bgm("lobby"); }}
                label="Sound on"
              />
              <span className="faint" style={{ fontSize: 12 }}>Audio is synthesized in-browser — drop mp3s in /public/audio to override.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VolRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="row" style={{ gap: 12, alignItems: "center" }}>
      <span className="faint" style={{ width: 64, fontSize: 13 }}>{label}</span>
      <input
        type="range" min={0} max={1} step={0.05} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1 }}
      />
      <span className="timer-mono" style={{ width: 38, textAlign: "right", fontSize: 12 }}>{Math.round(value * 100)}</span>
    </div>
  );
}
