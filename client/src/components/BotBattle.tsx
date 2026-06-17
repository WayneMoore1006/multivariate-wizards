// client/src/components/BotBattle.tsx
// Wires the local bot engine to the shared Battle screen. Loads the question
// bank, picks a round set, and lets BattleManager drive the EventBus that both
// the Phaser scene and the Battle UI listen to.
import { useEffect, useRef, useState } from "react";
import type { GameSettings, WizardKind } from "@shared/types";
import { loadQuestions, pick } from "../game/systems/QuestionManager";
import { BattleManager } from "../game/systems/BattleManager";
import Battle, { type MatchResult } from "./Battle";
import { WIZARDS } from "./ui";

const BOT_NAMES = ["Spectre", "Mordred", "Nyx", "Vael", "Orrin", "Sable"];

export default function BotBattle(props: {
  nickname: string;
  wizard: WizardKind;
  settings: GameSettings;
  onResult: (r: MatchResult) => void;
  onQuit: () => void;
}) {
  const [ready, setReady] = useState(false);
  const mgrRef = useRef<BattleManager | null>(null);
  const botRef = useRef<{ name: string; wizard: WizardKind }>({
    name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
    wizard: WIZARDS.filter((w) => w.kind !== props.wizard)[
      Math.floor(Math.random() * 3)
    ].kind,
  });

  useEffect(() => {
    let disposed = false;
    loadQuestions().then((all) => {
      if (disposed) return;
      const set = pick(all, props.settings.questionCount);
      const mgr = new BattleManager(props.settings, set, props.nickname, `${botRef.current.name} (Bot)`);
      mgrRef.current = mgr;
      setReady(true);
      // give the Phaser scene a beat to boot before the countdown starts
      setTimeout(() => mgr.start(), 400);
    });
    return () => {
      disposed = true;
      mgrRef.current?.dispose();
      mgrRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return <p className="muted pulse" style={{ textAlign: "center", marginTop: 80 }}>Loading the question bank…</p>;
  }

  return (
    <Battle
      meName={props.nickname}
      meWizard={props.wizard}
      oppName={`${botRef.current.name} (Bot)`}
      oppWizard={botRef.current.wizard}
      settings={props.settings}
      onGameOver={props.onResult}
      onQuit={props.onQuit}
    />
  );
}
