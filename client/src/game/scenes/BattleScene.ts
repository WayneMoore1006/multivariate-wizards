// client/src/game/scenes/BattleScene.ts
import Phaser from "phaser";
import type { WizardKind } from "@shared/types";
import { Wizard } from "../objects/Wizard";
import { HealthBar } from "../objects/HealthBar";
import { QuestionPanel } from "../objects/QuestionPanel";
import { castProjectile, castTripleProjectile } from "../objects/Projectile";
import { bus, EV } from "../EventBus";

export interface BattleInit {
  meName: string; meWizard: WizardKind;
  oppName: string; oppWizard: WizardKind;
  maxHp: number;
  showChapter: boolean; showYear: boolean;
}

export class BattleScene extends Phaser.Scene {
  private me!: Wizard; private opp!: Wizard;
  private meBar!: HealthBar; private oppBar!: HealthBar;
  private panel!: QuestionPanel;
  private timerText!: Phaser.GameObjects.Text;
  private init!: BattleInit;
  private offs: (() => void)[] = [];

  constructor() { super("Battle"); }

  create(data: BattleInit) {
    this.init = data;
    const w = this.scale.width, h = this.scale.height;
    this.add.image(w / 2, h / 2, "arena_bg").setDisplaySize(w, h);

    this.panel = new QuestionPanel(this, w / 2, 110);
    this.timerText = this.add.text(w / 2, 196, "", {
      fontFamily: "JetBrains Mono, monospace", fontSize: "30px", color: "#ffe9a8",
    }).setOrigin(0.5);

    this.me = new Wizard(this, w * 0.24, h * 0.66, data.meWizard, 1);
    this.opp = new Wizard(this, w * 0.76, h * 0.66, data.oppWizard, -1);

    this.meBar = new HealthBar(this, 40, 40, data.meName, data.maxHp, "left");
    this.oppBar = new HealthBar(this, w - 40, 40, data.oppName, data.maxHp, "right");

    this.bind();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.offs.forEach((o) => o()));
  }

  private bind() {
    this.offs.push(bus.on(EV.ROUND_START, (d: any) => {
      this.panel.update({
        text: d.question.questionEn, chapter: d.question.chapter,
        years: d.question.years, difficulty: d.question.difficulty,
        showChapter: this.init.showChapter, showYear: this.init.showYear,
      });
    }));

    this.offs.push(bus.on(EV.TICK, (d: { msLeft: number }) => {
      this.timerText.setText(Math.ceil(d.msLeft / 1000).toString());
      this.timerText.setColor(d.msLeft < 6000 ? "#ef4444" : "#ffe9a8");
    }));

    this.offs.push(bus.on(EV.CAST, (d: { who: "me" | "opp"; attackType?: "normal" | "triple" | "grand" }) => {
      const caster = d.who === "me" ? this.me : this.opp;
      const target = d.who === "me" ? this.opp : this.me;
      const from = { x: caster.x + 30 * caster.facing, y: caster.y - 30 };
      const to = { x: target.x, y: target.y - 10 };
      caster.cast();
      if (d.attackType === "triple") {
        castTripleProjectile(this, from, to, caster.kind, () => target.hit());
      } else if (d.attackType === "grand") {
        // one huge bolt (~2.6x), single impact
        castProjectile(this, from, to, caster.kind, () => target.hit(), { scale: 2.6 });
      } else {
        castProjectile(this, from, to, caster.kind, () => target.hit());
      }
    }));

    this.offs.push(bus.on(EV.HIT, (d: { who: "me" | "opp"; damage: number; attackType?: "normal" | "triple" | "grand" }) => {
      const target = d.who === "me" ? this.me : this.opp;
      const big = d.attackType === "grand";
      const dmgText = this.add.text(target.x, target.y - 60, `-${d.damage}`, {
        fontFamily: "Cinzel, serif", fontSize: big ? "40px" : "26px",
        color: big ? "#ffd24a" : "#ff5c5c", fontStyle: "bold",
      }).setOrigin(0.5);
      this.tweens.add({ targets: dmgText, y: target.y - 110, alpha: 0, duration: 900, onComplete: () => dmgText.destroy() });
      const intensity = big ? 0.016 : d.attackType === "triple" ? 0.009 : 0.006;
      this.cameras.main.shake(big ? 260 : 160, intensity);
    }));

    this.offs.push(bus.on(EV.HP, (d: { me: number; opp: number }) => {
      this.meBar.set(d.me); this.oppBar.set(d.opp);
    }));

    this.offs.push(bus.on(EV.GAME_OVER, (d: { meWon: boolean | null }) => {
      this.timerText.setText("");
      if (d.meWon === true) { this.me.win(); this.opp.lose(); }
      else if (d.meWon === false) { this.opp.win(); this.me.lose(); }
    }));
  }
}
