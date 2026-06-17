# Audio Credits & Licensing — Multivariate Wizards

## Current state (placeholder, zero-asset)
This build ships with **no external audio files**. All music and sound effects are
**synthesized in the browser** via the Web Audio API (`client/src/game/systems/AudioManager.ts`):

- **SFX** — short procedural tones for: `click`, `countdown`, `correct`, `wrong`,
  `cast`, `hit`, `victory`, `defeat`.
- **BGM** — a small procedural music engine (`SynthBgm`) generates a fitting loop per scene:
  - `lobby`  — slow, airy minor pad (magical academy)
  - `battle` — faster minor arpeggio (fantasy battle / JRPG feel)
  - `result` — short resolved pad

Because everything is synthesized, the game **never crashes from a missing audio file**
and contains **no copyrighted music** (no Final Fantasy / FF7 / Nintendo / Super Smash Bros /
War of Wizards tracks).

## How to drop in real (licensed) audio
Place files at these exact paths and the game will load them automatically, falling
back to synthesis only if a file is missing:

```
client/public/audio/bgm/lobby.mp3
client/public/audio/bgm/battle.mp3
client/public/audio/bgm/result.mp3
client/public/audio/sfx/click.mp3
client/public/audio/sfx/countdown.mp3
client/public/audio/sfx/correct.mp3
client/public/audio/sfx/wrong.mp3
client/public/audio/sfx/cast.mp3
client/public/audio/sfx/hit.mp3
client/public/audio/sfx/victory.mp3
client/public/audio/sfx/defeat.mp3
```

## Recommended free / royalty-free sources (CC0, Public Domain, or commercial-OK)
Use only CC0 / Public Domain / royalty-free / commercial-allowed assets. **Avoid CC-BY-NC**
and anything without a clear licence.

- **Pixabay Music / SFX** — https://pixabay.com/music/  ·  https://pixabay.com/sound-effects/ (Pixabay licence, free for commercial use, no attribution required)
- **Mixkit** — https://mixkit.co/free-stock-music/  ·  https://mixkit.co/free-sound-effects/ (Mixkit free licence)
- **Freesound** — https://freesound.org (filter by CC0; check each file's licence)
- **OpenGameArt** — https://opengameart.org (filter by CC0 / CC-BY; verify per asset)
- **itch.io free game assets** — https://itch.io/game-assets/free

### When a file requires attribution
If you add an asset that needs credit, record it below in this format:

| File | Title | Author | Source URL | Licence |
|------|-------|--------|------------|---------|
| (e.g. battle.mp3) | (track name) | (author) | (url) | (CC0 / CC-BY 4.0 / …) |

> No attribution-required assets are currently bundled (everything is synthesized).
