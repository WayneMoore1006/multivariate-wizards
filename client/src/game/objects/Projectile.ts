// client/src/game/objects/Projectile.ts
import Phaser from "phaser";
import type { WizardKind } from "@shared/types";

const ORB: Record<WizardKind, number> = {
  fire: 0xff6b35, ice: 0x67e8f9, thunder: 0xfacc15, dark: 0x7c3aed,
};

export function castProjectile(
  scene: Phaser.Scene,
  from: { x: number; y: number },
  to: { x: number; y: number },
  kind: WizardKind,
  onImpact: () => void,
  opts: { scale?: number } = {}
) {
  const color = ORB[kind];
  const scale = opts.scale ?? 1;
  const orb = scene.add.circle(from.x, from.y, 12 * scale, color, 1);
  const glow = scene.add.circle(from.x, from.y, 22 * scale, color, 0.3);

  // trail
  const trailTimer = scene.time.addEvent({
    delay: 16, repeat: -1, callback: () => {
      const t = scene.add.circle(orb.x, orb.y, 8 * scale, color, 0.5);
      scene.tweens.add({ targets: t, alpha: 0, scale: 0.2, duration: 280, onComplete: () => t.destroy() });
    },
  });

  scene.tweens.add({
    targets: [orb, glow], x: to.x, y: to.y, duration: 420, ease: "Quad.in",
    onComplete: () => {
      trailTimer.remove();
      orb.destroy(); glow.destroy();
      impact(scene, to.x, to.y, color, scale);
      onImpact();
    },
  });
}

/**
 * Triple cast — fires three projectiles of the SAME wizard kind in quick
 * succession (120–180ms apart). PURELY VISUAL: only the final bolt invokes
 * onImpact (the single damage application happens via the HIT event, once).
 */
export function castTripleProjectile(
  scene: Phaser.Scene,
  from: { x: number; y: number },
  to: { x: number; y: number },
  kind: WizardKind,
  onImpact: () => void
) {
  const gaps = [0, 150, 300];
  gaps.forEach((delay, i) => {
    scene.time.delayedCall(delay, () => {
      const jitter = (i - 1) * 16;
      castProjectile(scene, { x: from.x, y: from.y + jitter }, { x: to.x, y: to.y + jitter }, kind,
        i === gaps.length - 1 ? onImpact : () => {}, { scale: 0.85 });
    });
  });
}

function impact(scene: Phaser.Scene, x: number, y: number, color: number, scale = 1) {
  // expanding ring
  const ring = scene.add.circle(x, y, 6 * scale, color, 0.6);
  scene.tweens.add({ targets: ring, radius: 60 * scale, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
  // shards (more for bigger blasts)
  const shards = Math.round(10 * scale);
  for (let i = 0; i < shards; i++) {
    const a = (Math.PI * 2 * i) / shards;
    const shard = scene.add.circle(x, y, 4 * scale, color, 1);
    scene.tweens.add({
      targets: shard, x: x + Math.cos(a) * 50 * scale, y: y + Math.sin(a) * 50 * scale,
      alpha: 0, duration: 350, onComplete: () => shard.destroy(),
    });
  }
  // magic-circle flash on the ground
  const circle = scene.add.circle(x, y + 40, 30 * scale, color, 0.0).setStrokeStyle(3, color, 0.8);
  scene.tweens.add({ targets: circle, scale: 1.6, alpha: 0, duration: 450, onComplete: () => circle.destroy() });
}
