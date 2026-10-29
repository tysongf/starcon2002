/**
 * Web Audio API procedural sound synthesizer.
 * Generates sci-fi thruster hums, docking chimes, and UI blips with zero audio asset downloads.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private thrusterOsc: OscillatorNode | null = null;
  private thrusterGain: GainNode | null = null;
  private thrusterFilter: BiquadFilterNode | null = null;
  private isThrusterPlaying: boolean = false;

  private initContext(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Plays a pristine two-tone holographic chime when docking clamps engage
   */
  public playDockingChime(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Tone 1: High harmonic ping (C5: 523.25 Hz)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.18); // Glide to E5

    gain1.gain.setValueAtTime(0.01, now);
    gain1.gain.linearRampToValueAtTime(0.25, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.65);

    // Tone 2: Warm undertone (A4: 440 Hz -> E4: 329.6 Hz)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440.0, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(587.33, now + 0.25); // D5

    gain2.gain.setValueAtTime(0.01, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.18, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);

    osc2.start(now + 0.08);
    osc2.stop(now + 0.75);
  }

  /**
   * Plays an airlock hiss / clamp release when undocking
   */
  public playUndockSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  /**
   * Crisp UI button click feedback
   */
  public playUiBlip(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.05);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Sets thruster engine audio intensity
   */
  public setThrusterActive(active: boolean, throttle: number = 1.0): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    if (active) {
      if (!this.isThrusterPlaying) {
        this.thrusterOsc = this.ctx.createOscillator();
        this.thrusterFilter = this.ctx.createBiquadFilter();
        this.thrusterGain = this.ctx.createGain();

        this.thrusterOsc.type = 'sawtooth';
        this.thrusterOsc.frequency.setValueAtTime(55, now);

        this.thrusterFilter.type = 'lowpass';
        this.thrusterFilter.frequency.setValueAtTime(180, now);

        this.thrusterGain.gain.setValueAtTime(0.001, now);
        this.thrusterGain.gain.linearRampToValueAtTime(0.08 * throttle, now + 0.1);

        this.thrusterOsc.connect(this.thrusterFilter);
        this.thrusterFilter.connect(this.thrusterGain);
        this.thrusterGain.connect(this.ctx.destination);

        this.thrusterOsc.start(now);
        this.isThrusterPlaying = true;
      } else if (this.thrusterGain && this.thrusterFilter) {
        this.thrusterGain.gain.linearRampToValueAtTime(0.08 * throttle, now + 0.05);
        this.thrusterFilter.frequency.setValueAtTime(160 + throttle * 120, now);
      }
    } else {
      if (this.isThrusterPlaying && this.thrusterGain && this.thrusterOsc) {
        this.thrusterGain.gain.linearRampToValueAtTime(0.0001, now + 0.15);
        this.thrusterOsc.stop(now + 0.16);
        this.isThrusterPlaying = false;
        this.thrusterOsc = null;
        this.thrusterGain = null;
        this.thrusterFilter = null;
      }
    }
  }

  /**
   * Sci-fi resonant energy discharge sound when Action Points (AP) are spent
   */
  public playApSpendSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.22);
    filter.Q.setValueAtTime(4.0, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Dual-pulse low-frequency buzzer alert when an AP action fails due to insufficient points
   */
  public playApWarningSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    [0, 0.12].forEach((offset) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(160, now + offset);

      gain.gain.setValueAtTime(0.12, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + offset);
      osc.stop(now + offset + 0.08);
    });
  }

  /**
   * Hyperspace Warp Drive charging and capacitor surge sound
   */
  public playWarpDriveEngage(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Sub-bass charging ramp (40 Hz -> 320 Hz)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(45, now);
    subOsc.frequency.exponentialRampToValueAtTime(320, now + 1.1);

    subGain.gain.setValueAtTime(0.01, now);
    subGain.gain.linearRampToValueAtTime(0.25, now + 0.8);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 1.1);

    subOsc.connect(filter);
    filter.connect(subGain);
    subGain.connect(this.ctx.destination);

    subOsc.start(now);
    subOsc.stop(now + 1.25);

    // Harmonic capacitor whistle (glissando 400 Hz -> 1600 Hz)
    const whistler = this.ctx.createOscillator();
    const whistlerGain = this.ctx.createGain();
    whistler.type = 'sine';
    whistler.frequency.setValueAtTime(440, now);
    whistler.frequency.exponentialRampToValueAtTime(1760, now + 1.0);

    whistlerGain.gain.setValueAtTime(0.01, now);
    whistlerGain.gain.linearRampToValueAtTime(0.12, now + 0.9);
    whistlerGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    whistler.connect(whistlerGain);
    whistlerGain.connect(this.ctx.destination);

    whistler.start(now);
    whistler.stop(now + 1.2);
  }

  /**
   * Hyperspace breakout / exit shockwave sound
   */
  public playWarpExitChime(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.45);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  /**
   * Cash transaction sound when purchasing cargo
   */
  public playTradeBuySound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.06); // A5

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  /**
   * Rewarding credits payout chime when selling cargo
   */
  public playTradeSellSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    [523.25, 659.25, 1046.5].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);

      gain.gain.setValueAtTime(0.12, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.28);
    });
  }

  /**
   * Procedural sci-fi laser / pulse blaster discharge
   */
  public playLaserFire(isEnemy: boolean = false): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isEnemy ? 'sawtooth' : 'sine';
    const startFreq = isEnemy ? 620 : 880;
    const endFreq = isEnemy ? 110 : 160;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.14);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Resonant electromagnetic ping when shields deflect a laser bolt
   */
  public playShieldDeflection(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.18);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Low-frequency kinetic explosion rumble when an entity is destroyed
   */
  public playExplosion(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.65);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.7);
  }

  /**
   * Heavy resonance plasma cannon discharge
   */
  public playPlasmaFire(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.32);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Punchy multi-pellet scatter flak burst
   */
  public playFlakFire(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [0, 0.04, 0.08].forEach((delay) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(740, now + delay);
      osc.frequency.exponentialRampToValueAtTime(140, now + delay + 0.08);

      gain.gain.setValueAtTime(0.12, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.09);
    });
  }

  /**
   * Resonant crystalline shatter sound when shields collapse to 0%
   */
  public playShieldBreakSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.45);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.48);
  }
}



