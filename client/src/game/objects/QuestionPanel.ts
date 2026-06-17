// client/src/game/objects/QuestionPanel.ts
import Phaser from "phaser";

export interface PanelData {
  text: string;
  chapter?: string;
  years?: string[];
  difficulty?: string;
  showChapter: boolean;
  showYear: boolean;
}

export class QuestionPanel extends Phaser.GameObjects.Container {
  private scroll: Phaser.GameObjects.Graphics;
  private qtext: Phaser.GameObjects.Text;
  private chips: Phaser.GameObjects.Container;
  private W = 720; private H = 120;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.scroll = scene.add.graphics();
    this.drawScroll();
    this.qtext = scene.add.text(0, 4, "", {
      fontFamily: "Spectral, Georgia, serif", fontSize: "20px", color: "#1b1205",
      align: "center", wordWrap: { width: this.W - 90 },
    }).setOrigin(0.5);
    this.chips = scene.add.container(0, -this.H / 2 - 4);
    this.add([this.scroll, this.qtext, this.chips]);
    scene.add.existing(this);
    scene.tweens.add({ targets: this, y: y + 8, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  }

  private drawScroll() {
    const g = this.scroll; const w = this.W, h = this.H;
    g.fillStyle(0xead7a7, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.lineStyle(3, 0xc9a14a, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    // rolled ends
    g.fillStyle(0xc9a14a, 1);
    g.fillRoundedRect(-w / 2 - 10, -h / 2 - 6, 20, h + 12, 8);
    g.fillRoundedRect(w / 2 - 10, -h / 2 - 6, 20, h + 12, 8);
  }

  update(d: PanelData) {
    this.qtext.setText(d.text);
    this.chips.removeAll(true);
    const labels: { t: string; c: number }[] = [];
    if (d.showChapter && d.chapter) labels.push({ t: d.chapter, c: 0x6d28d9 });
    if (d.showYear && d.years?.length) labels.push({ t: d.years.join(" / "), c: 0x0e7490 });
    if (d.difficulty) labels.push({ t: d.difficulty.toUpperCase(), c: 0xb45309 });
    let cx = 0;
    const widths = labels.map((l) => Math.max(56, l.t.length * 9 + 22));
    const total = widths.reduce((a, b) => a + b + 8, -8);
    cx = -total / 2;
    labels.forEach((l, i) => {
      const w = widths[i];
      const chip = this.scene.add.graphics();
      chip.fillStyle(l.c, 0.95); chip.fillRoundedRect(cx, -12, w, 24, 12);
      const txt = this.scene.add.text(cx + w / 2, 0, l.t, {
        fontFamily: "JetBrains Mono, monospace", fontSize: "13px", color: "#ffffff",
      }).setOrigin(0.5);
      this.chips.add([chip, txt]);
      cx += w + 8;
    });
  }
}
