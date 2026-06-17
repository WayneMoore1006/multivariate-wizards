// client/src/game/objects/HealthBar.ts
import Phaser from "phaser";

export class HealthBar extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private fill: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private barW = 220; private barH = 18;
  private max: number;

  constructor(scene: Phaser.Scene, x: number, y: number, name: string, max: number, align: "left" | "right") {
    super(scene, x, y);
    this.max = max;
    const anchor = align === "left" ? 0 : 1;
    this.bg = scene.add.rectangle(0, 0, this.barW, this.barH, 0x0b1020, 0.85).setOrigin(anchor, 0.5).setStrokeStyle(2, 0xc9a14a);
    this.fill = scene.add.rectangle(align === "left" ? 2 : -2, 0, this.barW - 4, this.barH - 4, 0x52e3c2).setOrigin(anchor, 0.5);
    this.label = scene.add.text(0, -20, name, { fontFamily: "Cinzel, serif", fontSize: "16px", color: "#f4e8c1" })
      .setOrigin(anchor, 0.5);
    this.add([this.bg, this.fill, this.label]);
    scene.add.existing(this);
  }

  set(hp: number) {
    const ratio = Phaser.Math.Clamp(hp / this.max, 0, 1);
    this.scene.tweens.add({ targets: this.fill, scaleX: ratio, duration: 350, ease: "Quad.out" });
    const c = ratio > 0.5 ? 0x52e3c2 : ratio > 0.25 ? 0xf5b942 : 0xef4444;
    this.fill.setFillStyle(c);
  }
}
