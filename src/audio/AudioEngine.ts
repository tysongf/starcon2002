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

  // Day 20: Star Control II Lander Thrusters & Precursor Resonance Drone
  private landerThrusterOsc: OscillatorNode | null = null;
  private landerThrusterGain: GainNode | null = null;
  private isLanderThrusterPlaying: boolean = false;

  private carrierDroneOsc1: OscillatorNode | null = null;
  private carrierDroneOsc2: OscillatorNode | null = null;
  private carrierDroneGain: GainNode | null = null;
  private carrierDroneFilter: BiquadFilterNode | null = null;
  private isCarrierDronePlaying: boolean = false;

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

  /**
   * Harmonious three-stage chime when securing floating cargo containers
   */
  public playLootPickupSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const pitches = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6
    pitches.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.01, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.28);
    });
  }

  /**
   * Catastrophic vessel explosion sound effect
   */
  public playShipExplosionSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Sub-bass rumble
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.9);

    subGain.gain.setValueAtTime(0.45, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 1.2);

    // Crackle noise burst
    const bufferSize = this.ctx.sampleRate * 0.6;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.6);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    whiteNoise.start(now);
  }

  /**
   * Emergency Escape Pod Life-Support Low Oxygen Klaxon
   */
  public playKlaxonSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(440, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.setValueAtTime(0.2, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.28);
  }

  /**
   * Shipyard frigate reissue docking chimes
   */
  public playFrigateReissueSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880]; // A major
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0.01, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.1 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.45);
    });
  }

  /**
   * Day 15: Laser scrap mining beam sound effect
   */
  public playMiningLaserSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.linearRampToValueAtTime(380, now + 0.15);

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(640, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 0.22);
    subOsc.stop(now + 0.22);
  }

  /**
   * Day 15: Magnetic Tow Cable Tether Attach
   */
  public playTowCableAttachSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.18);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Day 15: Magnetic Tow Cable Tether Release
   */
  public playTowCableReleaseSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Day 15: Station Salvage Bay Industrial Dismantling Crush
   */
  public playSalvageDismantleSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.6);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.65);
  }

  /**
   * Day 15: Station Salvage Bay Hull Refurbishing Chime
   */
  public playHullRefurbishSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [329.63, 440, 554.37, 659.25, 880]; // E major
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.01, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.5);
    });
  }

  /**
   * Day 16: Star Control II Subspace Hailing Chime
   */
  public playCommsHailingChime(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.35);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  /**
   * Day 16: Comms Carrier Squelch Cutout
   */
  public playCommsCloseSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Day 16: Procedural Alien Speech Phoneme Synthesizer
   * Generates unique vocal formants and phoneme chatter per alien species.
   */
  public playAlienPhoneme(species: string, char: string = 'a'): void {
    this.initContext();
    if (!this.ctx) return;

    // Skip spaces and punctuation to create natural speech cadences
    if (char === ' ' || char === '\n' || char === '\t') return;

    const now = this.ctx.currentTime;
    const charCode = char.charCodeAt(0);
    const variance = ((charCode % 7) - 3) * 8; // subtle deterministic pitch jitter

    switch (species.toUpperCase()) {
      case 'VAELIC': {
        // Deep guttural, aggressive, sawtooth imperial harshness
        const baseFreq = 85 + (charCode % 5) * 12 + variance;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, baseFreq * 0.8), now + 0.07);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(380, now);
        filter.Q.setValueAtTime(3.5, now);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }

      case 'PHORID': {
        // Eerie, whispering, harmonic multi-tonal spore chords
        const baseFreq = 340 + (charCode % 9) * 25 + variance;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(baseFreq, now);
        osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, now + 0.12);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(baseFreq * 1.5, now); // Fifth harmonic

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.12);
        osc2.stop(now + 0.12);
        break;
      }

      case 'KRYLL': {
        // High-pitched, rapid rodentoid chattering, FM chirps and clicks
        const baseFreq = 950 + (charCode % 11) * 60 + variance * 4;
        const carrier = this.ctx.createOscillator();
        const mod = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const gain = this.ctx.createGain();

        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(baseFreq, now);

        mod.type = 'square';
        mod.frequency.setValueAtTime(120, now);
        modGain.gain.setValueAtTime(300, now);

        mod.connect(carrier.frequency);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.14, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        carrier.connect(gain);
        gain.connect(this.ctx.destination);

        carrier.start(now);
        mod.start(now);
        carrier.stop(now + 0.06);
        mod.stop(now + 0.06);
        break;
      }

      default: {
        // Sol Alliance / Radio Military Transceiver
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(620 + (charCode % 4) * 40, now);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
    }
  }

  private planetAmbienceNodes: { osc?: OscillatorNode; filter?: BiquadFilterNode; gain?: GainNode; noise?: AudioBufferSourceNode } | null = null;

  /**
   * Plays a resonant orbital capture lock chime when entering synchronous orbit
   */
  public playOrbitalCaptureSound(): void {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(330, now);
    osc1.frequency.exponentialRampToValueAtTime(660, now + 0.3);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(165, now);
    osc2.frequency.exponentialRampToValueAtTime(440, now + 0.35);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  }

  /**
   * Plays authentic Star Control II sensor sweep sonar pings tailored to the scan band
   */
  public playScannerSonarPing(band: 'MINERALS' | 'BIO' | 'ANOMALIES'): void {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (band === 'MINERALS') {
      // Metallic resonant pulse
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(960, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.35);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    } else if (band === 'BIO') {
      // Organic undulating FM chirp
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(1080, now + 0.15);
      osc.frequency.linearRampToValueAtTime(720, now + 0.3);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    } else {
      // Precursor harmonic shimmer
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.2);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    }

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
  }

  /**
   * Plays atmospheric probe re-entry burn sound effect
   */
  public playProbeAtmosphericBurn(heatStress: boolean = false): void {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 1.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(heatStress ? 1400 : 800, now + 0.4);
    filter.frequency.exponentialRampToValueAtTime(250, now + 1.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(heatStress ? 0.35 : 0.22, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 1.2);
  }

  /**
   * Starts ambient planetary background soundscape
   */
  public startPlanetaryAmbience(archetype: string): void {
    this.stopPlanetaryAmbience();
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    if (archetype === 'VOLCANIC') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(65, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, now);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.5);
    } else if (archetype === 'GAS_GIANT') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(90, now);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.5);
    } else if (archetype === 'PRECURSOR_RUIN') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      filter.type = 'peaking';
      filter.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.5);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, now);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.5);
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    this.planetAmbienceNodes = { osc, filter, gain };
  }

  /**
   * Stops ambient planetary background soundscape
   */
  public stopPlanetaryAmbience(): void {
    if (this.planetAmbienceNodes && this.ctx) {
      const { osc, gain } = this.planetAmbienceNodes;
      if (gain && osc) {
        const now = this.ctx.currentTime;
        gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
        setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {}
        }, 350);
      }
      this.planetAmbienceNodes = null;
    }
  }

  /**
   * Day 19: Colony Outpost founding fanfare (multi-harmonic celebratory chord)
   */
  public playColonyFoundingFanfare(): void {
    this.initContext();
    if (!this.ctx) return;

    const freqs = [330, 415.3, 493.88, 659.25]; // E major chord
    const now = this.ctx.currentTime;

    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq * 0.8, now + idx * 0.08);
      osc.frequency.exponentialRampToValueAtTime(freq, now + idx * 0.08 + 0.12);

      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.9);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.0);
    });
  }

  /**
   * Day 19: Facility upgrade glissando (upward tier ascension sound)
   */
  public playFacilityUpgradeSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.35);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  /**
   * Day 19: Cargo harvest clunk and pneumatic seal chime
   */
  public playCargoHarvestSound(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Low mechanical clunk
    const oscLow = this.ctx.createOscillator();
    const gainLow = this.ctx.createGain();

    oscLow.type = 'triangle';
    oscLow.frequency.setValueAtTime(140, now);
    oscLow.frequency.exponentialRampToValueAtTime(45, now + 0.2);

    gainLow.gain.setValueAtTime(0.25, now);
    gainLow.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    oscLow.connect(gainLow);
    gainLow.connect(this.ctx.destination);

    oscLow.start(now);
    oscLow.stop(now + 0.3);

    // High transfer chime
    const oscHigh = this.ctx.createOscillator();
    const gainHigh = this.ctx.createGain();

    oscHigh.type = 'sine';
    oscHigh.frequency.setValueAtTime(587.33, now + 0.1); // D5
    oscHigh.frequency.setValueAtTime(880, now + 0.18); // A5

    gainHigh.gain.setValueAtTime(0.001, now + 0.1);
    gainHigh.gain.linearRampToValueAtTime(0.12, now + 0.14);
    gainHigh.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    oscHigh.connect(gainHigh);
    gainHigh.connect(this.ctx.destination);

    oscHigh.start(now + 0.1);
    oscHigh.stop(now + 0.65);
  }

  /**
   * Day 19: Colony Silo capacity warning / full stockpile alert chime
   */
  public playSiloAlertChime(): void {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.setValueAtTime(523.25, now + 0.12); // C5

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  /**
   * Day 20: Star Control II Planetary Lander Thrusters (continuous low-rumble thruster roar)
   */
  public startLanderThrusterSound(throttle: number = 1.0): void {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (!this.isLanderThrusterPlaying) {
      this.landerThrusterOsc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      this.landerThrusterGain = this.ctx.createGain();

      this.landerThrusterOsc.type = 'sawtooth';
      this.landerThrusterOsc.frequency.setValueAtTime(45, now);
      this.landerThrusterOsc.frequency.linearRampToValueAtTime(75 * throttle, now + 0.2);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, now);

      this.landerThrusterGain.gain.setValueAtTime(0.001, now);
      this.landerThrusterGain.gain.linearRampToValueAtTime(0.12 * throttle, now + 0.08);

      this.landerThrusterOsc.connect(filter);
      filter.connect(this.landerThrusterGain);
      this.landerThrusterGain.connect(this.ctx.destination);

      this.landerThrusterOsc.start(now);
      this.isLanderThrusterPlaying = true;
    } else if (this.landerThrusterGain && this.landerThrusterOsc) {
      this.landerThrusterGain.gain.linearRampToValueAtTime(0.12 * throttle, now + 0.05);
      this.landerThrusterOsc.frequency.linearRampToValueAtTime(50 + 30 * throttle, now + 0.05);
    }
  }

  public stopLanderThrusterSound(): void {
    if (!this.ctx || !this.isLanderThrusterPlaying) return;
    const now = this.ctx.currentTime;
    if (this.landerThrusterGain) {
      this.landerThrusterGain.gain.linearRampToValueAtTime(0.001, now + 0.15);
    }
    setTimeout(() => {
      try {
        if (this.landerThrusterOsc) {
          this.landerThrusterOsc.stop();
          this.landerThrusterOsc.disconnect();
          this.landerThrusterOsc = null;
        }
      } catch {
        // ignore if already stopped
      }
      this.isLanderThrusterPlaying = false;
    }, 160);
  }

  /**
   * Day 20: Seismic Radar Sonar Ping (deep echoing multi-frequency pulse)
   */
  public playSeismicRadarPing(): void {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(220, now + 0.45);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1760, now);
    osc2.frequency.exponentialRampToValueAtTime(440, now + 0.35);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.Q.setValueAtTime(3.0, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.75);
    osc2.stop(now + 0.75);
  }

  /**
   * Day 20: Precursor Resonance Carrier Drone (continuous interactive audio for waveform tuning)
   */
  public startResonanceCarrierDrone(freq: number = 440, phaseDegrees: number = 180, damping: number = 50): void {
    this.initContext();
    if (!this.ctx) return;

    if (!this.isCarrierDronePlaying) {
      const now = this.ctx.currentTime;
      this.carrierDroneOsc1 = this.ctx.createOscillator();
      this.carrierDroneOsc2 = this.ctx.createOscillator();
      this.carrierDroneFilter = this.ctx.createBiquadFilter();
      this.carrierDroneGain = this.ctx.createGain();

      this.carrierDroneOsc1.type = 'sine';
      this.carrierDroneOsc1.frequency.setValueAtTime(freq, now);

      this.carrierDroneOsc2.type = 'triangle';
      // Harmonic detune / phase simulation via subtle sub-harmonic offset
      this.carrierDroneOsc2.frequency.setValueAtTime(freq * 0.5 + (phaseDegrees / 360) * 4, now);

      this.carrierDroneFilter.type = 'lowpass';
      this.carrierDroneFilter.frequency.setValueAtTime(400 + (100 - damping) * 20, now);
      this.carrierDroneFilter.Q.setValueAtTime(5.0, now);

      this.carrierDroneGain.gain.setValueAtTime(0.001, now);
      this.carrierDroneGain.gain.linearRampToValueAtTime(0.09, now + 0.2);

      this.carrierDroneOsc1.connect(this.carrierDroneFilter);
      this.carrierDroneOsc2.connect(this.carrierDroneFilter);
      this.carrierDroneFilter.connect(this.carrierDroneGain);
      this.carrierDroneGain.connect(this.ctx.destination);

      this.carrierDroneOsc1.start(now);
      this.carrierDroneOsc2.start(now);
      this.isCarrierDronePlaying = true;
    } else {
      this.updateResonanceCarrierDrone(freq, phaseDegrees, damping);
    }
  }

  public updateResonanceCarrierDrone(freq: number, phaseDegrees: number, damping: number): void {
    if (!this.ctx || !this.isCarrierDronePlaying) return;
    const now = this.ctx.currentTime;
    if (this.carrierDroneOsc1) {
      this.carrierDroneOsc1.frequency.linearRampToValueAtTime(Math.max(50, freq), now + 0.05);
    }
    if (this.carrierDroneOsc2) {
      this.carrierDroneOsc2.frequency.linearRampToValueAtTime(Math.max(25, freq * 0.5 + (phaseDegrees / 360) * 4), now + 0.05);
    }
    if (this.carrierDroneFilter) {
      this.carrierDroneFilter.frequency.linearRampToValueAtTime(300 + (100 - damping) * 25, now + 0.05);
    }
  }

  public stopResonanceCarrierDrone(): void {
    if (!this.ctx || !this.isCarrierDronePlaying) return;
    const now = this.ctx.currentTime;
    if (this.carrierDroneGain) {
      this.carrierDroneGain.gain.linearRampToValueAtTime(0.001, now + 0.2);
    }
    setTimeout(() => {
      try {
        if (this.carrierDroneOsc1) {
          this.carrierDroneOsc1.stop();
          this.carrierDroneOsc1.disconnect();
          this.carrierDroneOsc1 = null;
        }
        if (this.carrierDroneOsc2) {
          this.carrierDroneOsc2.stop();
          this.carrierDroneOsc2.disconnect();
          this.carrierDroneOsc2 = null;
        }
      } catch {
        // ignore
      }
      this.isCarrierDronePlaying = false;
    }, 220);
  }

  /**
   * Day 20: Precursor Decipher Fanfare (eerie ancient harmonic chord)
   */
  public playPrecursorDecipherFanfare(): void {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Harmonic overtone chord: 432, 540, 648, 864 Hz
    const tones = [432, 540, 648, 864, 1296];
    tones.forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.09);

      gain.gain.setValueAtTime(0.001, now + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.09 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 1.3);
    });
  }

  /**
   * Day 20: Precursor Phase Lance Discharge (sharp crystalline energy pulse)
   */
  public playPhaseLanceFireSound(): void {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.35);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  /**
   * Day 20: Mineral Deposit Harvest Pickup (crisp crystal clink)
   */
  public playMineralPickupSound(): void {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, now); // C6
    osc.frequency.setValueAtTime(1318.5, now + 0.06); // E6
    osc.frequency.setValueAtTime(1567.98, now + 0.12); // G6

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.38);
  }

  /**
   * Day 20: Lander Touchdown Clamp Lock (hydraulic clunk and magnetic lock)
   */
  public playLanderTouchdownSound(): void {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(110, now);
    osc1.frequency.exponentialRampToValueAtTime(40, now + 0.25);

    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.35);
  }

  /**
   * Day 30: Titan Enrage Roar / Screech (deep guttural subterranean rumble)
   */
  public playTitanRoarSound(): void {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.linearRampToValueAtTime(160, now + 0.2);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.7);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.7);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.75);
  }

  /**
   * Day 30: Rendezvous Beacon Mid-Mission Cargo Stash & Refuel Chime
   */
  public playBeaconStashSound(): void {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Harmonic sweep upwards
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554.37, now + 0.08); // C#5
    osc.frequency.setValueAtTime(659.25, now + 0.16); // E5
    osc.frequency.setValueAtTime(880, now + 0.24);    // A5

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
  }
}




