// client/src/game/systems/AudioManager.ts
// Web Audio wrapper that NEVER throws if a sound file is missing.
// If no audio assets are present, it synthesizes simple tones so the game
// still has feedback. All playback is gated behind a user gesture (unlock()).

type SfxKey =
  | "click" | "countdown" | "correct" | "wrong"
  | "cast" | "hit" | "victory" | "defeat";

const SFX_FILES: Record<SfxKey, string> = {
  click: "/audio/sfx/click.mp3",
  countdown: "/audio/sfx/countdown.mp3",
  correct: "/audio/sfx/correct.mp3",
  wrong: "/audio/sfx/wrong.mp3",
  cast: "/audio/sfx/cast.mp3",
  hit: "/audio/sfx/hit.mp3",
  victory: "/audio/sfx/victory.mp3",
  defeat: "/audio/sfx/defeat.mp3",
};

const BGM_FILES = {
  lobby: "/audio/bgm/lobby.mp3",
  battle: "/audio/bgm/battle.mp3",
  result: "/audio/bgm/result.mp3",
};

class AudioManager {
  private ctx: AudioContext | null = null;
  private master = 0.8;
  private bgmVol = 0.5;
  private sfxVol = 0.8;
  private muted = false;
  private unlocked = false;
  private buffers = new Map<string, AudioBuffer | null>();
  private bgmNode: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private synth: SynthBgm | null = null;
  private currentBgm: string | null = null;

  unlock() {
    if (this.unlocked) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.unlocked = true;
    } catch { this.unlocked = false; }
  }

  setMaster(v: number) { this.master = v; this.applyBgmVol(); }
  setBgm(v: number) { this.bgmVol = v; this.applyBgmVol(); }
  setSfx(v: number) { this.sfxVol = v; }
  setMuted(m: boolean) { this.muted = m; this.applyBgmVol(); }
  get isMuted() { return this.muted; }

  private applyBgmVol() {
    const g = this.gain(this.bgmVol);
    if (this.bgmNode) this.bgmNode.gain.gain.value = g;
    if (this.synth) this.synth.setVolume(g);
  }

  private gain(v: number) { return this.muted ? 0 : this.master * v; }

  private async load(url: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(url)) return this.buffers.get(url)!;
    if (!this.ctx) return null;
    try {
      const r = await fetch(url);
      if (!r.ok) { this.buffers.set(url, null); return null; }
      const arr = await r.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(arr);
      this.buffers.set(url, buf);
      return buf;
    } catch { this.buffers.set(url, null); return null; }
  }

  async sfx(key: SfxKey) {
    if (!this.unlocked || !this.ctx || this.muted) return;
    const buf = await this.load(SFX_FILES[key]);
    if (buf) { this.playBuffer(buf, this.gain(this.sfxVol)); }
    else { this.tone(key); } // synth fallback
  }

  async bgm(key: keyof typeof BGM_FILES) {
    if (!this.unlocked || !this.ctx) return;
    if (this.currentBgm === key) return; // already playing this track
    this.stopBgm();
    this.currentBgm = key;
    const buf = await this.load(BGM_FILES[key]);
    if (buf) {
      const src = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      src.buffer = buf; src.loop = true; gain.gain.value = this.gain(this.bgmVol);
      src.connect(gain).connect(this.ctx.destination);
      src.start();
      this.bgmNode = { src, gain };
      return;
    }
    // No file → synthesize an ambient loop so there is always music.
    this.synthBgm(key);
  }

  stopBgm() {
    if (this.bgmNode) { try { this.bgmNode.src.stop(); } catch {} this.bgmNode = null; }
    if (this.synth) { this.synth.stop(); this.synth = null; }
    this.currentBgm = null;
  }

  private playBuffer(buf: AudioBuffer, vol: number) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = buf; gain.gain.value = vol;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
  }

  // synthesized fallback blips so the game has audio feedback with zero assets
  private tone(key: SfxKey) {
    if (!this.ctx) return;
    const presets: Record<SfxKey, { f: number; type: OscillatorType; dur: number }> = {
      click: { f: 520, type: "triangle", dur: 0.06 },
      countdown: { f: 380, type: "sine", dur: 0.1 },
      correct: { f: 740, type: "sine", dur: 0.18 },
      wrong: { f: 160, type: "sawtooth", dur: 0.22 },
      cast: { f: 300, type: "triangle", dur: 0.15 },
      hit: { f: 110, type: "square", dur: 0.16 },
      victory: { f: 660, type: "sine", dur: 0.4 },
      defeat: { f: 130, type: "sine", dur: 0.5 },
    };
    const p = presets[key];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = p.type; osc.frequency.value = p.f;
    gain.gain.value = this.gain(this.sfxVol) * 0.5;
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + p.dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + p.dur);
  }

  private synthBgm(key: keyof typeof BGM_FILES) {
    if (!this.ctx) return;
    this.synth = new SynthBgm(this.ctx, key as BgmScene, this.gain(this.bgmVol));
    this.synth.start();
  }
}

// ---------------------------------------------------------------------------
// SynthBgm — a tiny procedural music loop (pad chords + arpeggio) used as a
// zero-asset fallback so every scene has fitting "magic duel" music even when
// no licensed mp3 files are present. Drop real tracks in /public/audio/bgm to
// override (see assets/audio/credits.md).
// ---------------------------------------------------------------------------
type BgmScene = "lobby" | "battle" | "result";
const SCENE_MUSIC: Record<BgmScene, { root: number; scale: number[]; bpm: number; wave: OscillatorType; arp: boolean }> = {
  lobby:  { root: 220.0, scale: [0, 3, 5, 7, 10, 12], bpm: 70,  wave: "sine",     arp: true },
  battle: { root: 174.6, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 116, wave: "triangle", arp: true },
  result: { root: 261.6, scale: [0, 4, 7, 11, 12], bpm: 60,  wave: "sine",     arp: false },
};

class SynthBgm {
  private master: GainNode;
  private timer?: number;
  private step = 0;
  private cfg: (typeof SCENE_MUSIC)[BgmScene];
  private stopped = false;

  constructor(private ctx: AudioContext, key: BgmScene, vol: number) {
    this.cfg = SCENE_MUSIC[key] ?? SCENE_MUSIC.lobby;
    this.master = ctx.createGain();
    this.master.gain.value = vol * 0.35;
    this.master.connect(ctx.destination);
  }

  setVolume(v: number) { this.master.gain.value = v * 0.35; }

  start() {
    const beatMs = ((60 / this.cfg.bpm) * 1000) / 2;
    const tick = () => {
      if (this.stopped) return;
      this.playStep();
      this.step++;
      this.timer = window.setTimeout(tick, beatMs);
    };
    tick();
  }

  private playStep() {
    const { root, scale, wave, arp } = this.cfg;
    if (this.step % 8 === 0) {
      const chordRoots = [0, 5, 3, 7];
      const base = chordRoots[(this.step / 8) % chordRoots.length];
      [0, 3, 7].forEach((iv) => this.note((root * Math.pow(2, (base + iv) / 12)) / 2, "sine", 2.4, 0.16));
    }
    if (arp) {
      const deg = scale[(this.step * 3) % scale.length];
      const oct = this.step % 16 < 8 ? 1 : 2;
      this.note(root * Math.pow(2, deg / 12) * oct, wave, 0.32, 0.2);
    }
  }

  private note(freq: number, type: OscillatorType, dur: number, vol: number) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    try { this.master.disconnect(); } catch {}
  }
}

export const audio = new AudioManager();
