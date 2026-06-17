# Visual Assets — Credits & Provenance

**Short version: this game ships with zero third-party visual assets. Every
visual is drawn procedurally at runtime with Phaser's `Graphics` API.** There
is therefore nothing here that requires attribution — but this file documents
what was done and where to drop in real art if you want to.

## What is procedural (no files, no license obligations)

| Element | How it's made | Source file |
| --- | --- | --- |
| Night-sky arena background | Gradient fill + randomized starfield + elliptical platform, baked into a texture | `client/src/game/scenes/PreloadScene.ts` |
| Wizards (robe, hat, staff, orb) | `Graphics` shapes, per-element palette | `client/src/game/objects/Wizard.ts` |
| Spell projectiles, trails, impact rings/shards | `Graphics` + tweens | `client/src/game/objects/Projectile.ts` |
| Health bars | `Graphics` rectangles + tweened fill | `client/src/game/objects/HealthBar.ts` |
| Question "scroll" panel & chips | `Graphics` + Phaser text | `client/src/game/objects/QuestionPanel.ts` |
| Menu / UI chrome | CSS only (no images) | `client/src/index.css` |

Fonts are loaded from Google Fonts (Cinzel, Spectral, JetBrains Mono) via
`<link>` in `client/index.html`. These are licensed under the SIL Open Font
License 1.1 and are free for commercial use.

## Why no downloaded art?

This project was built in a sandbox whose network only permits package
registries (npm/PyPI/GitHub). Asset hosts such as itch.io, OpenGameArt, Kenney,
CraftPix, Game-icons.net, Pixabay, Mixkit and Freesound were unreachable, so
the safe, fully-runnable choice was to draw everything in code. The game starts
and plays with no missing-asset errors.

## Dropping in real art later (optional)

The loader is already wired to *try* optional images and silently fall back if
they're absent (see `OPTIONAL_IMAGES` in `PreloadScene.ts`). To use real assets:

1. Place files under `client/public/assets/` (e.g. `client/public/assets/wizard_fire.png`).
2. Register them in `PreloadScene.ts` `preload()` and swap the `Graphics`
   drawing in the relevant object for `this.add.sprite(...)`.
3. Record attribution **here** for anything that needs it.

**Only use CC0 / Public Domain / royalty-free / commercial-OK assets.** Avoid
CC-BY-NC and anything without a clear license. If an asset requires attribution,
add a row below.

| Asset | Author | Source | License |
| --- | --- | --- | --- |
| _(none used)_ | — | — | — |
