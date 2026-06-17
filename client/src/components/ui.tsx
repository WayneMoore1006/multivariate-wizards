// client/src/components/ui.tsx
import type { WizardKind, Difficulty } from "@shared/types";

export const WIZARDS: { kind: WizardKind; name: string; element: string; orb: string }[] = [
  { kind: "fire", name: "Pyromancer", element: "Fire", orb: "orb-fire" },
  { kind: "ice", name: "Cryomancer", element: "Ice", orb: "orb-ice" },
  { kind: "thunder", name: "Stormcaller", element: "Thunder", orb: "orb-thunder" },
  { kind: "dark", name: "Nightweaver", element: "Dark", orb: "orb-dark" },
];

export const wizardMeta = (k: WizardKind) => WIZARDS.find((w) => w.kind === k)!;

export function Segmented<T extends string | number>({
  value, options, onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={String(o.value)}
          className={"opt" + (o.value === value ? " active" : "")}
          onClick={() => onChange(o.value)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div className={"switch" + (checked ? " on" : "")} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
      <span className="track"><span className="knob" /></span>
      {label && <span className="muted" style={{ fontSize: 14 }}>{label}</span>}
    </div>
  );
}

export function WizardPicker({ value, onChange }: { value: WizardKind; onChange: (k: WizardKind) => void }) {
  return (
    <div className="wizard-grid">
      {WIZARDS.map((w) => (
        <div
          key={w.kind}
          className={"wizard-card" + (w.kind === value ? " active" : "")}
          onClick={() => onChange(w.kind)}
        >
          <div className={"wizard-orb " + w.orb} />
          <div className="wizard-name">{w.name}</div>
          <div className="faint">{w.element}</div>
        </div>
      ))}
    </div>
  );
}

export function DifficultyChip({ d }: { d: Difficulty }) {
  return <span className={"chip " + d}>{d}</span>;
}
