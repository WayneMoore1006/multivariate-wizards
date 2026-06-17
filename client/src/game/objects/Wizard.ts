// client/src/game/objects/Wizard.ts
import Phaser from "phaser";
import type { WizardKind } from "@shared/types";

const PALETTE: Record<WizardKind, { robe: number; trim: number; orb: number; name: string }> = {
  fire:    { robe: 0x7f1d1d, trim: 0xf59e0b, orb: 0xff6b35, name: "Fire" },
  ice:     { robe: 0x1e3a8a, trim: 0x93c5fd, orb: 0x67e8f9, name: "Ice" },
  thunder: { robe: 0x4c1d95, trim: 0xfde047, orb: 0xfacc15, name: "Thunder" },
  dark:    { robe: 0x1f2937, trim: 0xa78bfa, orb: 0x7c3aed, name: "Dark" },
};

export class Wizard extends Phaser.GameObjects.Container {
  kind: WizardKind;
  facing: 1 | -1;
  private bodyGfx!: Phaser.GameObjects.Graphics;
  private orb: Phaser.GameObjects.Arc;
  private idleTween?: Phaser.Tweens.Tween;
  colorOrb: number;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: WizardKind, facing: 1 | -1) {
    super(scene, x, y);
    this.kind = kind; this.facing = facing;
    const p = PALETTE[kind];
    this.colorOrb = p.orb;

    this.bodyGfx = scene.add.graphics();
    this.draw(p);
    this.add(this.bodyGfx);

    // floating spell orb at the staff tip
    this.orb = scene.add.circle(28 * facing, -34, 7, p.orb, 0.9);
    this.add(this.orb);
    scene.tweens.add({ targets: this.orb, alpha: 0.4, scale: 1.3, duration: 700, yoyo: true, repeat: -1 });

    scene.add.existing(this);
    this.startIdle();
  }

  private draw(p: { robe: number; trim: number }) {
    const g = this.bodyGfx;
    g.clear();
    const f = this.facing;
    // robe
    g.fillStyle(p.robe, 1);
    g.fillTriangle(-26, 40, 26, 40, 0, -18);
    g.fillStyle(p.trim, 1);
    g.fillTriangle(-26, 40, -16, 40, -8, 20); // robe trim hint
    // head
    g.fillStyle(0xf1d9b5, 1);
    g.fillCircle(0, -26, 11);
    // hat
    g.fillStyle(p.robe, 1);
    g.fillTriangle(-15, -30, 15, -30, 0, -64);
    g.fillStyle(p.trim, 1);
    g.fillRect(-16, -32, 32, 5);
    // staff
    g.lineStyle(4, 0x8b5a2b, 1);
    g.beginPath(); g.moveTo(20 * f, 38); g.lineTo(30 * f, -30); g.strokePath();
  }

  private startIdle() {
    this.idleTween = this.scene.tweens.add({
      targets: this, y: this.y - 6, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.inOut",
    });
  }

  cast() {
    this.scene.tweens.add({
      targets: this, scaleX: 1.08, scaleY: 0.92, duration: 120, yoyo: true,
    });
    this.scene.tweens.add({ targets: this.orb, scale: 2, alpha: 1, duration: 150, yoyo: true });
  }

  hit() {
    const ox = this.x;
    this.scene.tweens.add({ targets: this, x: ox + 10 * -this.facing, duration: 50, yoyo: true, repeat: 3 });
    this.flash(0xffffff);
  }

  private flash(color: number) {
    const overlay = this.scene.add.rectangle(0, 0, 90, 110, color, 0.6);
    this.add(overlay);
    this.scene.tweens.add({ targets: overlay, alpha: 0, duration: 220, onComplete: () => overlay.destroy() });
  }

  lose() {
    this.idleTween?.stop();
    this.scene.tweens.add({ targets: this, angle: this.facing * 80, y: this.y + 30, alpha: 0.35, duration: 700 });
  }

  win() {
    this.scene.tweens.add({ targets: this, y: this.y - 18, duration: 350, yoyo: true, repeat: 2, ease: "Sine.inOut" });
  }
}
