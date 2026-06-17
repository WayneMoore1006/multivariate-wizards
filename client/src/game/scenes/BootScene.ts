// client/src/game/scenes/BootScene.ts
import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() { super("Boot"); }
  create() {
    this.scene.start("Preload", this.scene.settings.data);
  }
}
