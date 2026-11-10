import { AudioEngine } from '../audio/AudioEngine';

export interface LanderNode {
  id: string;
  x: number;
  y: number;
  type: 'MEGASTRUCTURE' | 'MINERAL';
  name: string;
  mineralType?: string;
  amount?: number;
  collected?: boolean;
  discovered: boolean;
  color: string;
  siteData?: any;
}

export interface LanderCallbacks {
  audio: AudioEngine;
  showApNotification: (msg: string, isError: boolean) => void;
  openPrecursorTerminal: (site?: any) => void;
  getActivePlanet: () => any;
  getPlanetPrecursorSites: () => any[];
  isInOrbit: () => boolean;
}

export class LanderController {
  private audio: AudioEngine;
  private callbacks: LanderCallbacks;

  private modalPlanetaryLander: HTMLElement | null = null;
  private modalPlanetarySurvey: HTMLElement | null = null;
  private landerCanvas: HTMLCanvasElement | null = null;
  private landerCtx: CanvasRenderingContext2D | null = null;
  private landerAnimId: number | null = null;

  public isLanderActive: boolean = false;
  public landerState = {
    x: 380,
    y: 240,
    vx: 0,
    vy: 0,
    heading: -Math.PI / 2,
    fuel: 100,
    maxFuel: 100,
    hull: 100,
    maxHull: 100,
    cargo: 0,
    maxCargo: 25,
    isDocked: false,
    dockedSite: null as any,
  };

  public landerKeys = { up: false, down: false, left: false, right: false };
  public landerNodes: LanderNode[] = [];
  public landerParticles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }> = [];
  public landerSonarWaves: Array<{ x: number; y: number; radius: number; maxRadius: number; alpha: number }> = [];

  constructor(callbacks: LanderCallbacks) {
    this.callbacks = callbacks;
    this.audio = callbacks.audio;
    this.initUI();
  }

  private initUI(): void {
    this.modalPlanetaryLander = document.getElementById('planetary-lander-modal');
    this.modalPlanetarySurvey = document.getElementById('planetary-survey-modal');
    this.landerCanvas = document.getElementById('surface-lander-canvas') as HTMLCanvasElement | null;
    if (this.landerCanvas) {
      this.landerCtx = this.landerCanvas.getContext('2d');
    }

    document.getElementById('btn-close-lander')?.addEventListener('click', () => this.closeSurfaceLander());
    document.getElementById('btn-lander-radar')?.addEventListener('click', () => this.fireSeismicRadarPing());
    document.getElementById('btn-dock-terminal')?.addEventListener('click', () => {
      if (this.landerState.isDocked && this.landerState.dockedSite) {
        this.callbacks.openPrecursorTerminal(this.landerState.dockedSite);
      }
    });

    // Keyboard handlers
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.isLanderActive) return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.landerKeys.up = true;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.landerKeys.down = true;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.landerKeys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.landerKeys.right = true;
      if (e.code === 'Space') {
        e.preventDefault();
        this.fireSeismicRadarPing();
      }
      if (e.key === 'e' || e.key === 'E') {
        if (this.landerState.isDocked && this.landerState.dockedSite) {
          this.callbacks.openPrecursorTerminal(this.landerState.dockedSite);
        }
      }
      if (e.key === 'Escape' || e.key === 'l' || e.key === 'L') {
        this.closeSurfaceLander();
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (!this.isLanderActive) return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.landerKeys.up = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.landerKeys.down = false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.landerKeys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.landerKeys.right = false;
    });
  }

  /**
   * Deploys the nimble planetary lander from synchronous orbit into the 2D topography flight view.
   */
  public openSurfaceLander(): void {
    const activePlanet = this.callbacks.getActivePlanet();
    this.isLanderActive = true;

    if (!this.modalPlanetarySurvey) {
      this.modalPlanetarySurvey = document.getElementById('planetary-survey-modal');
    }
    if (this.modalPlanetarySurvey) {
      this.modalPlanetarySurvey.classList.add('hidden');
    }

    if (!this.modalPlanetaryLander) {
      this.modalPlanetaryLander = document.getElementById('planetary-lander-modal');
    }
    if (this.modalPlanetaryLander) {
      this.modalPlanetaryLander.classList.remove('hidden');
    }

    const titleEl = document.getElementById('lander-planet-title');
    if (titleEl && activePlanet) {
      titleEl.textContent = `${activePlanet.data.name.toUpperCase()} // SURFACE TOPOGRAPHY`;
    }

    if (!this.landerCanvas) {
      this.landerCanvas = document.getElementById('surface-lander-canvas') as HTMLCanvasElement;
      if (this.landerCanvas) {
        this.landerCtx = this.landerCanvas.getContext('2d');
      }
    }

    // Reset lander telemetry & kinematics
    this.landerState = {
      x: 380,
      y: 240,
      vx: 0,
      vy: 0,
      heading: -Math.PI / 2,
      fuel: 100,
      maxFuel: 100,
      hull: 100,
      maxHull: 100,
      cargo: 0,
      maxCargo: 25,
      isDocked: false,
      dockedSite: null,
    };
    this.landerKeys = { up: false, down: false, left: false, right: false };
    this.landerParticles = [];
    this.landerSonarWaves = [];

    // Initialize surface nodes: Megastructures from planet precursor sites + mineral deposits
    this.landerNodes = [];
    const precursorSites = this.callbacks.getPlanetPrecursorSites();

    // Place Precursor Megastructures on surface canvas
    if (precursorSites.length > 0) {
      precursorSites.forEach((site, idx) => {
        const posX = idx === 0 ? 530 : 230 + (idx * 160);
        const posY = idx === 0 ? 170 : 330;
        this.landerNodes.push({
          id: site.id,
          x: posX,
          y: posY,
          type: 'MEGASTRUCTURE',
          name: site.name,
          siteData: site,
          discovered: false,
          color: '#00f0ff',
        });
      });
    } else {
      // Fallback canonical megastructure
      this.landerNodes.push({
        id: 'site_fallback_monolith',
        x: 520,
        y: 170,
        type: 'MEGASTRUCTURE',
        name: 'Aegis Resonance Monolith',
        siteData: {
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
        },
        discovered: false,
        color: '#00f0ff',
      });
    }

    // Populate 8 mineral resource deposits on topographical contours
    const mineralDefs = [
      { name: 'Plutonium Isotopes', x: 180, y: 120, amount: 8, color: '#fbbf24' },
      { name: 'Rare Crystalline Matrix', x: 610, y: 130, amount: 10, color: '#38bdf8' },
      { name: 'Superdense Titanium', x: 150, y: 380, amount: 15, color: '#e2e8f0' },
      { name: 'Xenobiological Spores', x: 430, y: 380, amount: 12, color: '#4ade80' },
      { name: 'Precursor Power Cells', x: 660, y: 340, amount: 6, color: '#c084fc' },
      { name: 'Rare Crystalline Matrix', x: 330, y: 190, amount: 10, color: '#38bdf8' },
      { name: 'Superdense Titanium', x: 230, y: 260, amount: 12, color: '#e2e8f0' },
      { name: 'Plutonium Isotopes', x: 480, y: 290, amount: 8, color: '#fbbf24' },
    ];

    mineralDefs.forEach((m, idx) => {
      this.landerNodes.push({
        id: `node_min_${idx}`,
        x: m.x,
        y: m.y,
        type: 'MINERAL',
        name: m.name,
        mineralType: m.name,
        amount: m.amount,
        collected: false,
        discovered: false,
        color: m.color,
      });
    });

    const dockBanner = document.getElementById('megastructure-dock-banner');
    if (dockBanner) dockBanner.classList.add('hidden');

    const targetsList = document.getElementById('lander-targets-list');
    if (targetsList) {
      targetsList.innerHTML = `<div class="target-card-item">Press [SPACE] to broadcast seismic pulse and detect surface deposits.</div>`;
    }

    this.updateLanderTelemetryUI();
    this.startLanderLoop();
  }

  /**
   * Ascends back into synchronous orbit and transfers collected surface minerals into ship hold.
   */
  public closeSurfaceLander(): void {
    this.isLanderActive = false;
    this.audio.stopLanderThrusterSound();

    if (this.landerAnimId !== null) {
      cancelAnimationFrame(this.landerAnimId);
      this.landerAnimId = null;
    }

    if (this.modalPlanetaryLander) {
      this.modalPlanetaryLander.classList.add('hidden');
    }

    if (this.callbacks.isInOrbit()) {
      if (!this.modalPlanetarySurvey) {
        this.modalPlanetarySurvey = document.getElementById('planetary-survey-modal');
      }
      if (this.modalPlanetarySurvey) {
        this.modalPlanetarySurvey.classList.remove('hidden');
      }
    }

    if (this.landerState.cargo > 0) {
      this.audio.playCargoHarvestSound();
      this.callbacks.showApNotification(`🚀 Lander docked with ship! Transferred ${this.landerState.cargo} units of surface minerals into hold!`, false);
    }
  }

  /**
   * Fires a Star Control-style seismic radar ping revealing surface deposits.
   */
  public fireSeismicRadarPing(): void {
    if (!this.isLanderActive) return;

    this.audio.playSeismicRadarPing();
    this.landerSonarWaves.push({
      x: this.landerState.x,
      y: this.landerState.y,
      radius: 10,
      maxRadius: 420,
      alpha: 1.0,
    });

    const statusBlip = document.getElementById('lander-radar-status');
    if (statusBlip) {
      statusBlip.textContent = 'SCANNING...';
      statusBlip.style.color = '#38bdf8';
      setTimeout(() => {
        if (statusBlip) {
          statusBlip.textContent = 'READY [SPACE]';
          statusBlip.style.color = '#10b981';
        }
      }, 700);
    }
  }

  /**
   * Animation & physics loop for the 2D surface lander simulation.
   */
  private startLanderLoop(): void {
    if (this.landerAnimId !== null) {
      cancelAnimationFrame(this.landerAnimId);
    }

    const loop = () => {
      if (!this.isLanderActive) return;
      this.updateLanderPhysics();
      this.renderLanderCanvas();
      this.landerAnimId = requestAnimationFrame(loop);
    };

    this.landerAnimId = requestAnimationFrame(loop);
  }

  /**
   * Updates lander flight dynamics, particle emission, boundary damping, and node proximity.
   */
  private updateLanderPhysics(): void {
    const s = this.landerState;
    const k = this.landerKeys;

    // Rotation
    if (k.left) s.heading -= 0.055;
    if (k.right) s.heading += 0.055;

    // Forward Thruster
    if (k.up && s.fuel > 0) {
      const accel = 0.15;
      s.vx += Math.cos(s.heading) * accel;
      s.vy += Math.sin(s.heading) * accel;
      s.fuel = Math.max(0, s.fuel - 0.04);
      this.audio.startLanderThrusterSound(1.0);

      // Spawn thruster exhaust particles
      const tailX = s.x - Math.cos(s.heading) * 14;
      const tailY = s.y - Math.sin(s.heading) * 14;
      for (let i = 0; i < 2; i++) {
        const spread = (Math.random() - 0.5) * 0.4;
        this.landerParticles.push({
          x: tailX,
          y: tailY,
          vx: -Math.cos(s.heading + spread) * (2 + Math.random() * 2),
          vy: -Math.sin(s.heading + spread) * (2 + Math.random() * 2),
          life: 1.0,
          maxLife: 1.0,
          color: Math.random() > 0.5 ? '#f59e0b' : '#00f0ff',
          size: 2 + Math.random() * 3,
        });
      }
    } else {
      this.audio.stopLanderThrusterSound();
    }

    // Retro-thrusters
    if (k.down) {
      s.vx *= 0.94;
      s.vy *= 0.94;
    }

    // Natural drag & inertia
    s.vx *= 0.985;
    s.vy *= 0.985;
    s.x += s.vx;
    s.y += s.vy;

    // Soft boundary bounce [25, 735] x [25, 455]
    if (s.x < 25) { s.x = 25; s.vx = -s.vx * 0.5; }
    if (s.x > 735) { s.x = 735; s.vx = -s.vx * 0.5; }
    if (s.y < 25) { s.y = 25; s.vy = -s.vy * 0.5; }
    if (s.y > 455) { s.y = 455; s.vy = -s.vy * 0.5; }

    // Update exhaust particles
    for (let i = this.landerParticles.length - 1; i >= 0; i--) {
      const p = this.landerParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
      if (p.life <= 0) {
        this.landerParticles.splice(i, 1);
      }
    }

    // Update Sonar Radar Waves
    for (let i = this.landerSonarWaves.length - 1; i >= 0; i--) {
      const w = this.landerSonarWaves[i];
      w.radius += 5.5;
      w.alpha = Math.max(0, 1 - w.radius / w.maxRadius);

      // Check wave discovery intersection with surface nodes
      this.landerNodes.forEach((node) => {
        const d = Math.hypot(node.x - w.x, node.y - w.y);
        if (d <= w.radius) {
          node.discovered = true;
        }
      });

      if (w.radius >= w.maxRadius) {
        this.landerSonarWaves.splice(i, 1);
        this.refreshLanderRadarList();
      }
    }

    // Mineral Collection Check
    this.landerNodes.forEach((node) => {
      if (node.type === 'MINERAL' && node.discovered && !node.collected) {
        const d = Math.hypot(node.x - s.x, node.y - s.y);
        if (d <= 26 && s.cargo < s.maxCargo) {
          node.collected = true;
          const amt = node.amount || 5;
          s.cargo = Math.min(s.maxCargo, s.cargo + amt);
          this.audio.playMineralPickupSound();
          this.refreshLanderRadarList();
          this.updateLanderTelemetryUI();
        }
      }
    });

    // Precursor Megastructure Proximity Check
    const megastructures = this.landerNodes.filter((n) => n.type === 'MEGASTRUCTURE');
    let nearSite: any = null;

    megastructures.forEach((m) => {
      const d = Math.hypot(m.x - s.x, m.y - s.y);
      if (d <= 48) {
        nearSite = m;
      }
    });

    const dockBanner = document.getElementById('megastructure-dock-banner');
    const dockDesc = document.getElementById('megastructure-dock-desc');

    if (nearSite) {
      if (!s.isDocked) {
        s.isDocked = true;
        s.dockedSite = nearSite.siteData;
        this.audio.playLanderTouchdownSound();
        if (dockBanner) dockBanner.classList.remove('hidden');
        if (dockDesc) {
          dockDesc.textContent = `Ancient harmonic resonance detected at ${nearSite.name}. Landing clamps locked [E].`;
        }
      }
    } else if (s.isDocked) {
      // Disengage docking clamps when flying away
      s.isDocked = false;
      s.dockedSite = null;
      if (dockBanner) dockBanner.classList.add('hidden');
    }

    this.updateLanderTelemetryUI();
  }

  /**
   * Updates radar list on the right panel with discovered nodes and megastructures.
   */
  private refreshLanderRadarList(): void {
    const listEl = document.getElementById('lander-targets-list');
    if (!listEl) return;

    const discovered = this.landerNodes.filter((n) => n.discovered);
    if (discovered.length === 0) {
      listEl.innerHTML = `<div class="target-card-item">Press [SPACE] to broadcast seismic pulse and detect surface deposits.</div>`;
      return;
    }

    listEl.innerHTML = discovered.map((n) => {
      const dist = Math.round(Math.hypot(n.x - this.landerState.x, n.y - this.landerState.y));
      if (n.type === 'MEGASTRUCTURE') {
        return `
          <div class="target-card-item megastructure ${this.landerState.isDocked && this.landerState.dockedSite?.id === n.siteData?.id ? 'docked' : ''}">
            <div class="target-title">🏛️ ${n.name}</div>
            <div class="target-meta">PRECURSOR VAULT // DIST: ${dist}m // [E] INTERFACE</div>
          </div>
        `;
      } else {
        return `
          <div class="target-card-item mineral ${n.collected ? 'collected' : ''}">
            <div class="target-title">💎 ${n.name} ${n.collected ? '(SECURED)' : `(+${n.amount})`}</div>
            <div class="target-meta">SURFACE YIELD // DIST: ${dist}m</div>
          </div>
        `;
      }
    }).join('');
  }

  /**
   * Updates telemetry gauges on the lander CRT HUD.
   */
  private updateLanderTelemetryUI(): void {
    const s = this.landerState;
    const valHull = document.getElementById('val-lander-hull');
    const valFuel = document.getElementById('val-lander-fuel');
    const valCargo = document.getElementById('val-lander-cargo');
    const fillHull = document.getElementById('lander-hull-fill');
    const fillFuel = document.getElementById('lander-fuel-fill');
    const fillCargo = document.getElementById('lander-cargo-fill');

    if (valHull) valHull.textContent = `${Math.round(s.hull)}%`;
    if (valFuel) valFuel.textContent = `${Math.round(s.fuel)}%`;
    if (valCargo) valCargo.textContent = `${s.cargo} / ${s.maxCargo} Units`;

    if (fillHull) fillHull.style.width = `${Math.max(0, s.hull)}%`;
    if (fillFuel) fillFuel.style.width = `${Math.max(0, s.fuel)}%`;
    if (fillCargo) fillCargo.style.width = `${Math.min(100, (s.cargo / s.maxCargo) * 100)}%`;
  }

  /**
   * Renders the Star Control II planetary surface canvas with topographical contour lines,
   * glowing Precursor ruins, crystalline mineral deposits, headlight beam, and lander.
   */
  private renderLanderCanvas(): void {
    if (!this.landerCtx || !this.landerCanvas) return;
    const ctx = this.landerCtx;
    const w = this.landerCanvas.width;
    const h = this.landerCanvas.height;

    // 1. Dark CRT topographical background
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w / 2);
    bgGrad.addColorStop(0, '#040d1a');
    bgGrad.addColorStop(1, '#02060e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Coordinate Grid Lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 40; x < w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 40; y < h; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 3. Topographical Elevation Contour Lines (Star Control II aesthetic)
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);

    // Ridge 1
    ctx.beginPath();
    ctx.ellipse(220, 150, 160, 90, 0.2, 0, Math.PI * 2);
    ctx.stroke();

    // Ridge 2 (Crater Basin)
    ctx.beginPath();
    ctx.ellipse(560, 320, 140, 80, -0.15, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.1)';
    ctx.beginPath();
    ctx.ellipse(380, 240, 260, 150, 0.05, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();

    // 4. Render Sonar Radar Waves
    this.landerSonarWaves.forEach((wave) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 240, 255, ${wave.alpha * 0.8})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius * 0.6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${wave.alpha * 0.3})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    });

    // 5. Render Surface Nodes (Megastructures and Minerals)
    this.landerNodes.forEach((node) => {
      if (node.type === 'MEGASTRUCTURE') {
        if (node.discovered) {
          // Precursor Megastructure: Glowing obelisk & pulsing glyph
          ctx.save();
          const pulse = Math.sin(Date.now() * 0.005) * 4;

          // Outer beacon ring
          ctx.beginPath();
          ctx.arc(node.x, node.y, 22 + pulse, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Obelisk pyramid icon
          ctx.fillStyle = '#00f0ff';
          ctx.beginPath();
          ctx.moveTo(node.x, node.y - 14);
          ctx.lineTo(node.x - 10, node.y + 10);
          ctx.lineTo(node.x + 10, node.y + 10);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('🏛️ PRECURSOR RUINS', node.x, node.y - 20);
          ctx.fillText(node.name.toUpperCase(), node.x, node.y + 24);
          ctx.restore();
        } else {
          // Faint radar shadow blip before scan
          ctx.save();
          ctx.beginPath();
          ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
          ctx.fill();
          ctx.restore();
        }
      } else if (node.type === 'MINERAL' && !node.collected) {
        if (node.discovered) {
          // Sparkling Diamond / Crystal Node
          ctx.save();
          ctx.fillStyle = node.color;
          ctx.shadowColor = node.color;
          ctx.shadowBlur = 8;

          ctx.beginPath();
          ctx.moveTo(node.x, node.y - 6);
          ctx.lineTo(node.x + 6, node.y);
          ctx.lineTo(node.x, node.y + 6);
          ctx.lineTo(node.x - 6, node.y);
          ctx.closePath();
          ctx.fill();

          ctx.shadowBlur = 0;
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`💎 +${node.amount}`, node.x, node.y + 16);
          ctx.restore();
        }
      }
    });

    // 6. Render Exhaust Particles
    this.landerParticles.forEach((p) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fill();
      ctx.restore();
    });

    // 7. Render Star Control II Surface Lander Craft
    const s = this.landerState;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.heading);

    // Active Headlight Cone
    const lightGrad = ctx.createRadialGradient(0, 0, 5, 60, 0, 95);
    lightGrad.addColorStop(0, 'rgba(0, 240, 255, 0.35)');
    lightGrad.addColorStop(1, 'rgba(0, 240, 255, 0.0)');
    ctx.fillStyle = lightGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(85, -34);
    ctx.lineTo(85, 34);
    ctx.closePath();
    ctx.fill();

    // Lander Chassis (Triangular Star Control survey ship)
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Outrigger Landing Skids
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-8, -13, 4, 2);
    ctx.strokeRect(-8, 11, 4, 2);

    // Cockpit Canopy
    ctx.beginPath();
    ctx.arc(2, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    // Thruster Flare
    if (this.landerKeys.up && s.fuel > 0) {
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(-18 - Math.random() * 8, -4);
      ctx.lineTo(-14, 0);
      ctx.lineTo(-18 - Math.random() * 8, 4);
      ctx.closePath();
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
    }
    ctx.restore();

    // 8. Topography Scanner HUD Coordinates
    ctx.save();
    ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.font = '10px monospace';
    const hdgDeg = Math.round(((s.heading * 180) / Math.PI + 360) % 360);
    ctx.fillText(`HDG: ${hdgDeg}° // VEL: ${Math.hypot(s.vx, s.vy).toFixed(1)} m/s // TOPOGRAPHY MK-IV`, 16, 22);
    ctx.restore();
  }
}
