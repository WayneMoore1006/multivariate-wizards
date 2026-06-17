// client/src/game/scenes/PreloadScene.ts
import Phaser from "phaser";

// Optional art. If these files are absent the loader fires 'filecomplete'/'loaderror'
// and we simply proceed with procedural Graphics — the game never crashes.
const OPTIONAL_IMAGES: { key: string; url: string }[] = [
  { key: "bg_sky", url: "/characters/../backgrounds/arena.png" }, // placeholder path; missing is fine
];

export class PreloadScene extends Phaser.Scene {
  constructor() { super("Preload"); }

  preload() {
    const w = this.scale.width, h = this.scale.height;
    const bar = this.add.rectangle(w / 2, h / 2, 10, 14, 0x52e3c2).setOrigin(0.5);
    const frame = this.add.rectangle(w / 2, h / 2, 320, 18).setStrokeStyle(2, 0xc9a14a);
    this.add.text(w / 2, h / 2 - 36, "Summoning the arena…",
      { fontFamily: "Cinzel, serif", fontSize: "20px", color: "#f4e8c1" }).setOrigin(0.5);

    this.load.on("progress", (p: number) => { bar.width = 312 * p; });
    this.load.on("loaderror", () => { /* swallow — placeholders cover it */ });

    OPTIONAL_IMAGES.forEach((i) => this.load.image(i.key, i.url));
  }

  create() {
    // generate a starfield texture so the battle background needs no asset
    const w = 1024, h = 576;
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a0a1f, 0x0a0a1f, 0x1a1340, 0x241a52, 1);
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * w, y = Math.random() * h * 0.7;
      g.fillStyle(0xffffff, Math.random() * 0.8 + 0.2);
      g.fillCircle(x, y, Math.random() * 1.6 + 0.4);
    }
    // arena platform
    g.fillStyle(0x2a1f55, 1);
    g.fillEllipse(w / 2, h - 70, w * 0.9, 120);
    g.fillStyle(0x3a2a72, 0.6);
    g.fillEllipse(w / 2, h - 80, w * 0.7, 70);
    g.generateTexture("arena_bg", w, h);
    g.destroy();

    this.scene.start("Battle", this.scene.settings.data);
  }
}
