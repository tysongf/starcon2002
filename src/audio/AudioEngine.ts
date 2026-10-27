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
}
