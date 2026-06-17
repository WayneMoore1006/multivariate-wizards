// client/src/PhaserBattle.tsx
// Mounts the Phaser duel canvas. React owns everything else (menus, inputs,
// reveal overlay); Phaser owns only the battle visuals. Both 1vBot and online
// modes drive the same EventBus, so this component is mode-agnostic.
import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { BootScene } from "./game/scenes/BootScene";
import { PreloadScene } from "./game/scenes/PreloadScene";
import { BattleScene, type BattleInit } from "./game/scenes/BattleScene";

export default function PhaserBattle({ init }: { init: BattleInit }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: 1024,
      height: 576,
      backgroundColor: "#08081a",
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: { antialias: true, pixelArt: false },
      scene: [BootScene, PreloadScene, BattleScene],
    });
    gameRef.current = game;

    // hand the battle config to the boot scene → preload → battle
    game.scene.start("Boot", init);

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="phaser-host" ref={hostRef} />;
}
