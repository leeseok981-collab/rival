import { WeaponId } from './weapons';

class RivalsAudioEngine {
  private ctx: AudioContext | null = null;
  public isMuted = false;

  private ensureContext(): AudioContext | null {
    if (this.isMuted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private randomPitch(range = 0.08): number {
    return 1 + (Math.random() * 2 - 1) * range;
  }

  public playWeaponFire(weaponId: WeaponId) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const pitch = this.randomPitch(0.06);

    if (weaponId === 'sniper') {
      // Heavy booming crack + metallic bolt echo
      this.playNoiseBurst(ctx, now, 0.28, 1200 * pitch, 0.35);
      this.playTone(ctx, 'sawtooth', 165 * pitch, 38, now, 0.32, 0.38);
      this.playTone(ctx, 'triangle', 680 * pitch, 220, now + 0.24, 0.12, 0.14);
      return;
    }

    if (weaponId === 'shotgun') {
      // Wide low-mid punch + pump clack
      this.playNoiseBurst(ctx, now, 0.22, 900 * pitch, 0.34);
      this.playTone(ctx, 'square', 130 * pitch, 42, now, 0.22, 0.32);
      this.playTone(ctx, 'triangle', 420 * pitch, 280, now + 0.26, 0.09, 0.12);
      return;
    }

    if (weaponId === 'revolver') {
      // Crisp high-caliber magnum pop
      this.playNoiseBurst(ctx, now, 0.14, 1600 * pitch, 0.26);
      this.playTone(ctx, 'sawtooth', 260 * pitch, 65, now, 0.16, 0.28);
      return;
    }

    if (weaponId === 'katana' || weaponId === 'scythe' || weaponId === 'fists') {
      // Metallic blade slash or air whoosh
      const startFreq = weaponId === 'katana' ? 920 : weaponId === 'scythe' ? 540 : 320;
      this.playNoiseBurst(ctx, now, 0.12, 2400 * pitch, 0.18);
      this.playTone(ctx, 'sine', startFreq * pitch, 140, now, 0.14, 0.22);
      return;
    }

    if (weaponId === 'grenade' || weaponId === 'molotov' || weaponId === 'tripmine') {
      // Utility throw / placement chirp
      this.playTone(ctx, 'sine', 520 * pitch, 880 * pitch, now, 0.14, 0.2);
      return;
    }

    if (weaponId === 'medkit') {
      // Healing harmonic chime
      this.playTone(ctx, 'sine', 523.25, 659.25, now, 0.18, 0.22);
      this.playTone(ctx, 'sine', 659.25, 1046.5, now + 0.12, 0.24, 0.22);
      return;
    }

    // Default AR / Burst / Uzi / Flare
    const baseFreq = weaponId === 'uzi' ? 340 : weaponId === 'burst' ? 290 : 240;
    this.playNoiseBurst(ctx, now, 0.085, 1800 * pitch, 0.22);
    this.playTone(ctx, 'sawtooth', baseFreq * pitch, 75, now, 0.09, 0.22);
  }

  public playHitmarker(isHeadshot: boolean, isKill = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const pitch = this.randomPitch(0.04);

    // Classic RIVALS crisp tick
    this.playTone(ctx, 'triangle', 1450 * pitch, 900, now, 0.045, 0.26);

    if (isHeadshot) {
      // Crisp metallic dink bell
      this.playTone(ctx, 'sine', 2150 * pitch, 2480 * pitch, now + 0.01, 0.14, 0.3);
    }

    if (isKill) {
      // Satisfying elimination chord pop
      this.playTone(ctx, 'triangle', 587.33, 880, now + 0.03, 0.18, 0.28);
      this.playTone(ctx, 'sine', 1174.66, 1760, now + 0.07, 0.24, 0.26);
    }
  }

  public playDeflectClang() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const pitch = this.randomPitch(0.05);
    this.playTone(ctx, 'square', 1320 * pitch, 2640 * pitch, now, 0.14, 0.28);
    this.playTone(ctx, 'sine', 1980 * pitch, 990 * pitch, now + 0.02, 0.22, 0.25);
  }

  public playJumpOrSlide(isSlide: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const pitch = this.randomPitch(0.08);
    if (isSlide) {
      this.playNoiseBurst(ctx, now, 0.22, 750 * pitch, 0.16);
      this.playTone(ctx, 'sine', 220 * pitch, 110, now, 0.18, 0.16);
    } else {
      this.playTone(ctx, 'sine', 190 * pitch, 390 * pitch, now, 0.11, 0.16);
    }
  }

  public playTelegraphWarning(archetype: string) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const startF = archetype === 'phantom' ? 740 : archetype === 'demolisher' ? 440 : 580;
    this.playTone(ctx, 'sawtooth', startF, startF * 1.45, now, 0.22, 0.14);
  }

  public playExplosion(isSubspace = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playNoiseBurst(ctx, now, 0.42, isSubspace ? 1600 : 520, 0.36);
    this.playTone(ctx, 'sawtooth', isSubspace ? 480 : 120, 28, now, 0.45, 0.36);
    if (isSubspace) {
      this.playTone(ctx, 'sine', 1680, 320, now, 0.38, 0.26);
    }
  }

  public playPlayerHurt() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playTone(ctx, 'sawtooth', 160, 58, now, 0.18, 0.28);
    this.playNoiseBurst(ctx, now, 0.12, 480, 0.22);
  }

  public playRoundBanner(type: 'start' | 'win' | 'lose') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (type === 'start') {
      this.playTone(ctx, 'triangle', 440, 440, now, 0.12, 0.2);
      this.playTone(ctx, 'triangle', 659.25, 880, now + 0.14, 0.25, 0.24);
    } else if (type === 'win') {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((n, idx) => {
        this.playTone(ctx, 'triangle', n, n * 1.01, now + idx * 0.09, 0.22, 0.24);
      });
    } else {
      const notes = [392.0, 349.23, 311.13, 261.63];
      notes.forEach((n, idx) => {
        this.playTone(ctx, 'sawtooth', n, n * 0.98, now + idx * 0.11, 0.24, 0.2);
      });
    }
  }

  private playTone(
    ctx: AudioContext,
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    startTime: number,
    duration: number,
    peakGain: number
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, startFreq), startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private playNoiseBurst(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    cutoffHz: number,
    peakGain: number
  ) {
    const sampleCount = Math.max(256, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, startTime);
    filter.frequency.exponentialRampToValueAtTime(140, startTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(startTime);
    src.stop(startTime + duration + 0.02);
  }
}

export const soundFX = new RivalsAudioEngine();
