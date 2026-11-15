import { AudioEngine } from '../audio/AudioEngine';
import { apiClient } from '../network/ApiClient';

export interface PrecursorSiteData {
  id: string;
  name: string;
  surfaceLat: number;
  surfaceLng: number;
  requiredFreq: number;
  requiredPhase: number;
  requiredDamping: number;
  isDeciphered: boolean;
  codexTitle?: string;
  codexText?: string;
  relicReward?: number;
}

export interface PrecursorTerminalCallbacks {
  audio: AudioEngine;
  showApNotification: (msg: string, isError: boolean) => void;
  onSiteDeciphered: (site: PrecursorSiteData) => Promise<void>;
  getDockedSite?: () => PrecursorSiteData | null;
  getPlanetPrecursorSites?: () => PrecursorSiteData[];
}

export class PrecursorTerminalController {
  private audio: AudioEngine;
  private callbacks: PrecursorTerminalCallbacks;

  private modalPrecursorTerminal: HTMLElement | null = null;
  private waveformCanvas: HTMLCanvasElement | null = null;
  private waveformCtx: CanvasRenderingContext2D | null = null;
  private waveformAnimId: number | null = null;
  private waveformTime: number = 0;

  public activePrecursorSite: PrecursorSiteData | null = null;
  public precursorTuning = { freq: 440, phase: 0, damping: 10 };

  constructor(callbacks: PrecursorTerminalCallbacks) {
    this.callbacks = callbacks;
    this.audio = callbacks.audio;
    this.initUI();
  }

  private initUI(): void {
    this.modalPrecursorTerminal = document.getElementById('precursor-terminal-modal');
    this.waveformCanvas = document.getElementById('precursor-waveform-canvas') as HTMLCanvasElement | null;
    if (this.waveformCanvas) {
      this.waveformCtx = this.waveformCanvas.getContext('2d');
    }

    document.getElementById('btn-close-precursor-terminal')?.addEventListener('click', () => this.closePrecursorTerminal());
    document.getElementById('btn-precursor-decipher')?.addEventListener('click', () => this.decipherActivePrecursorSite());

    // Tuning Sliders
    const sliderFreq = document.getElementById('slider-carrier-freq') as HTMLInputElement | null;
    const sliderPhase = document.getElementById('slider-harmonic-phase') as HTMLInputElement | null;
    const sliderDamping = document.getElementById('slider-damping') as HTMLInputElement | null;

    sliderFreq?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      this.precursorTuning.freq = val;
      const el = document.getElementById('val-carrier-freq');
      if (el) el.textContent = `${val} Hz`;
      this.audio.updateResonanceCarrierDrone(this.precursorTuning.freq, this.precursorTuning.phase, this.precursorTuning.damping);
      this.checkPrecursorAlignment();
    });

    sliderPhase?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      this.precursorTuning.phase = val;
      const el = document.getElementById('val-harmonic-phase');
      if (el) el.textContent = `${val}°`;
      this.audio.updateResonanceCarrierDrone(this.precursorTuning.freq, this.precursorTuning.phase, this.precursorTuning.damping);
      this.checkPrecursorAlignment();
    });

    sliderDamping?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      this.precursorTuning.damping = val;
      const el = document.getElementById('val-damping');
      if (el) el.textContent = `${val}%`;
      this.audio.updateResonanceCarrierDrone(this.precursorTuning.freq, this.precursorTuning.phase, this.precursorTuning.damping);
      this.checkPrecursorAlignment();
    });
  }

  /**
   * Opens the ancient Precursor Archaeological Decryption Terminal when landing clamps engage.
   */
  public openPrecursorTerminal(site?: PrecursorSiteData | null): void {
    if (!site) {
      const docked = this.callbacks.getDockedSite?.();
      const list = this.callbacks.getPlanetPrecursorSites?.() || [];
      site = docked || (list.length > 0 ? list[0] : null);
    }
    if (!site) {
      site = {
        id: 'site_aegis_monolith',
        name: 'Aegis Resonance Monolith',
        surfaceLat: 22.0,
        surfaceLng: -40.0,
        requiredFreq: 440,
        requiredPhase: 180,
        requiredDamping: 50,
        isDeciphered: false,
        codexTitle: 'Chronicles of the First Builders: The Hyper-Spatial Fold',
        codexText: 'We who folded the void before the light of Sol took form left this frequency key for those who walk after us...',
      };
    }
    this.activePrecursorSite = site;

    if (!this.modalPrecursorTerminal) {
      this.modalPrecursorTerminal = document.getElementById('precursor-terminal-modal');
    }
    if (this.modalPrecursorTerminal) {
      this.modalPrecursorTerminal.classList.remove('hidden');
    }

    const titleEl = document.getElementById('precursor-terminal-title');
    const coordsEl = document.getElementById('precursor-terminal-coords');
    const btnDecipher = document.getElementById('btn-precursor-decipher') as HTMLButtonElement | null;
    const codexCard = document.getElementById('precursor-codex-card');
    const sliderFreq = document.getElementById('slider-carrier-freq') as HTMLInputElement | null;
    const sliderPhase = document.getElementById('slider-harmonic-phase') as HTMLInputElement | null;
    const sliderDamping = document.getElementById('slider-damping') as HTMLInputElement | null;

    if (titleEl) titleEl.textContent = site.name.toUpperCase();
    if (coordsEl) {
      coordsEl.textContent = `LAT: ${Number(site.surfaceLat).toFixed(1)}° // LNG: ${Number(site.surfaceLng).toFixed(1)}° // ${site.isDeciphered ? 'ARCHIVE DECIPHERED' : 'CARRIER ACTIVE'}`;
    }

    if (!this.waveformCanvas) {
      this.waveformCanvas = document.getElementById('precursor-waveform-canvas') as HTMLCanvasElement;
      if (this.waveformCanvas) {
        this.waveformCtx = this.waveformCanvas.getContext('2d');
      }
    }

    if (site.isDeciphered) {
      // Already deciphered: lock tuning dials and show unlocked codex
      this.precursorTuning = {
        freq: site.requiredFreq,
        phase: site.requiredPhase,
        damping: site.requiredDamping,
      };
      if (sliderFreq) { sliderFreq.value = String(site.requiredFreq); sliderFreq.disabled = true; }
      if (sliderPhase) { sliderPhase.value = String(site.requiredPhase); sliderPhase.disabled = true; }
      if (sliderDamping) { sliderDamping.value = String(site.requiredDamping); sliderDamping.disabled = true; }

      const valF = document.getElementById('val-carrier-freq');
      const valP = document.getElementById('val-harmonic-phase');
      const valD = document.getElementById('val-damping');
      if (valF) valF.textContent = `${site.requiredFreq} Hz`;
      if (valP) valP.textContent = `${site.requiredPhase}°`;
      if (valD) valD.textContent = `${site.requiredDamping}%`;

      if (btnDecipher) {
        btnDecipher.disabled = true;
        btnDecipher.textContent = 'CODEX ARCHIVE SECURED 🔒';
      }

      if (codexCard) {
        codexCard.classList.remove('hidden');
        const cTitle = document.getElementById('precursor-codex-title');
        const cText = document.getElementById('precursor-codex-text');
        if (cTitle) cTitle.textContent = site.codexTitle || 'Chronicles of the First Builders';
        if (cText) cText.textContent = site.codexText || 'Decrypted archaeological archive secured.';
      }

      this.checkPrecursorAlignment();
    } else {
      // Interactive Decryption Puzzle: Initialize tuner dials
      this.precursorTuning = { freq: 220, phase: 0, damping: 10 };
      if (sliderFreq) { sliderFreq.value = '220'; sliderFreq.disabled = false; }
      if (sliderPhase) { sliderPhase.value = '0'; sliderPhase.disabled = false; }
      if (sliderDamping) { sliderDamping.value = '10'; sliderDamping.disabled = false; }

      const valF = document.getElementById('val-carrier-freq');
      const valP = document.getElementById('val-harmonic-phase');
      const valD = document.getElementById('val-damping');
      if (valF) valF.textContent = '220 Hz';
      if (valP) valP.textContent = '0°';
      if (valD) valD.textContent = '10%';

      if (btnDecipher) {
        btnDecipher.disabled = false;
        btnDecipher.textContent = 'TRANSMIT HARMONIC FREQUENCY KEY 🔓 (REWARD: CODEX + RELIC CORE)';
      }

      if (codexCard) codexCard.classList.add('hidden');

      this.audio.startResonanceCarrierDrone(220, 0, 10);
      this.checkPrecursorAlignment();
    }

    this.startWaveformAnimation();
  }

  /**
   * Closes the archaeological terminal and halts Web Audio carrier drone.
   */
  public closePrecursorTerminal(): void {
    if (this.waveformAnimId !== null) {
      cancelAnimationFrame(this.waveformAnimId);
      this.waveformAnimId = null;
    }
    this.audio.stopResonanceCarrierDrone();

    if (this.modalPrecursorTerminal) {
      this.modalPrecursorTerminal.classList.add('hidden');
    }
    this.activePrecursorSite = null;
  }

  /**
   * Validates multi-frequency resonance alignment against Precursor Megastructure tolerances.
   */
  public checkPrecursorAlignment(): boolean {
    const statusEl = document.getElementById('precursor-alignment-status');
    if (!this.activePrecursorSite) return false;

    if (this.activePrecursorSite.isDeciphered) {
      if (statusEl) {
        statusEl.textContent = 'ARCHAEOLOGICAL DATA EXTRACTED (LOCKED)';
        statusEl.className = 'alignment-pill locked';
      }
      return true;
    }

    const dFreq = Math.abs(this.precursorTuning.freq - this.activePrecursorSite.requiredFreq);
    const dPhase = Math.abs(this.precursorTuning.phase - this.activePrecursorSite.requiredPhase);
    const dDamp = Math.abs(this.precursorTuning.damping - this.activePrecursorSite.requiredDamping);

    const isAligned = dFreq <= 35 && dPhase <= 35 && dDamp <= 25;

    if (statusEl) {
      if (isAligned) {
        statusEl.textContent = 'HARMONIC LOCK ENGAGED ⚡';
        statusEl.className = 'alignment-pill locked';
      } else {
        statusEl.textContent = `DESYNCHRONIZED (ΔF: ${dFreq}Hz, ΔP: ${dPhase}°, ΔD: ${dDamp}%)`;
        statusEl.className = 'alignment-pill desync';
      }
    }

    return isAligned;
  }

  /**
   * Starts the CRT oscilloscope waveform animation loop.
   */
  private startWaveformAnimation(): void {
    if (this.waveformAnimId !== null) {
      cancelAnimationFrame(this.waveformAnimId);
    }

    const loop = () => {
      if (!this.activePrecursorSite || !this.modalPrecursorTerminal || this.modalPrecursorTerminal.classList.contains('hidden')) {
        return;
      }
      this.waveformTime += 0.05;
      this.renderWaveformCanvas();
      this.waveformAnimId = requestAnimationFrame(loop);
    };

    this.waveformAnimId = requestAnimationFrame(loop);
  }

  /**
   * Renders the alien carrier wave vs player tuner wave on the CRT oscilloscope.
   */
  private renderWaveformCanvas(): void {
    if (!this.waveformCtx || !this.waveformCanvas) return;
    const ctx = this.waveformCtx;
    const w = this.waveformCanvas.width;
    const h = this.waveformCanvas.height;
    const cy = h / 2;

    // Dark phosphor CRT background
    ctx.fillStyle = '#021208';
    ctx.fillRect(0, 0, w, h);

    // Phosphor Grid Lines
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Center Crosshairs
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    const site = this.activePrecursorSite;
    const targetFreq = site ? site.requiredFreq : 440;
    const targetPhase = site ? (site.requiredPhase * Math.PI) / 180 : Math.PI;
    const targetDamp = site ? site.requiredDamping : 50;

    const pilotFreq = this.precursorTuning.freq;
    const pilotPhase = (this.precursorTuning.phase * Math.PI) / 180;
    const pilotDamp = this.precursorTuning.damping;

    const t = this.waveformTime;
    const isAligned = this.checkPrecursorAlignment();

    // 1. Alien Carrier Wave (Magenta / Purple)
    ctx.save();
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const amp = 36 * (1 - targetDamp / 160);
      const y = cy + Math.sin(t * (targetFreq / 60) + targetPhase + x * 0.04) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // 2. Pilot Harmonic Wave (Luminous Cyan)
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const amp = 36 * (1 - pilotDamp / 160);
      const y = cy + Math.sin(t * (pilotFreq / 60) + pilotPhase + x * 0.04) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // 3. Superposition Harmonic Wave (Radiant Gold when aligned)
    if (isAligned) {
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const amp = 40 * (1 - pilotDamp / 160);
        const y = cy + Math.sin(t * (pilotFreq / 60) + pilotPhase + x * 0.04) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Transmits harmonic resonance key to backend, decrypts the codex, and awards a Precursor Relic Core.
   */
  public async decipherActivePrecursorSite(): Promise<void> {
    if (!this.activePrecursorSite) return;
    const site = this.activePrecursorSite;

    try {
      const res = await fetch(`/api/precursor/${site.id}/decipher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: apiClient.getAccountId(),
          solution: this.precursorTuning,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Harmonic desynchronization'}`, true);
        return;
      }

      this.audio.playPrecursorDecipherFanfare();
      site.isDeciphered = true;

      // Update terminal UI
      const codexCard = document.getElementById('precursor-codex-card');
      const cTitle = document.getElementById('precursor-codex-title');
      const cText = document.getElementById('precursor-codex-text');
      const btnDecipher = document.getElementById('btn-precursor-decipher') as HTMLButtonElement | null;

      if (cTitle) cTitle.textContent = data.codexTitle;
      if (cText) cText.textContent = data.codexText;
      if (codexCard) codexCard.classList.remove('hidden');
      if (btnDecipher) {
        btnDecipher.disabled = true;
        btnDecipher.textContent = 'CODEX ARCHIVE SECURED 🔒';
      }

      this.checkPrecursorAlignment();
      this.callbacks.showApNotification(`🏛️ Decrypted "${data.codexTitle}"! Extracted +${data.relicReward}x Precursor Relic Core! (+5 AP)`, false);

      await this.callbacks.onSiteDeciphered(site);
    } catch (err) {
      console.error('[DAY 20] Failed to decipher precursor site:', err);
    }
  }
}
