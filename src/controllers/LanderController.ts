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

export interface LanderStunBolt {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export interface LanderFaunaEntity {
  id: string;
  speciesId: string;
  name: string;
  speciesClass: 'GRAZER' | 'CARNIVORE';
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  speed: number;
  color: string;
  hp: number;
  maxHp: number;
  attackDamage: number;
  state: 'WANDER' | 'FLEE' | 'STALK' | 'CHARGE' | 'STUNNED';
  stunTimer: number;
  stunDuration: number;
  bioYield: number;
  unitValue: number;
  collected: boolean;
  discovered: boolean;
  changeDirTimer: number;
  legPhase: number;
}

export interface BioSampleEntry {
  speciesId: string;
  name: string;
  quantity: number;
  bioUnits: number;
  speciesClass: string;
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
  public landerStunBolts: LanderStunBolt[] = [];
  public landerFauna: LanderFaunaEntity[] = [];
  public landerBioSamples: BioSampleEntry[] = [];
  public landerParticles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }> = [];
  public landerSonarWaves: Array<{ x: number; y: number; radius: number; maxRadius: number; alpha: number }> = [];

  private lastStunFireTime: number = 0;
  private screenShakeTime: number = 0;

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
    document.getElementById('btn-lander-ascend')?.addEventListener('click', () => this.closeSurfaceLander());
    document.getElementById('btn-lander-radar')?.addEventListener('click', () => this.fireSeismicRadarPing());
    document.getElementById('btn-dock-terminal')?.addEventListener('click', () => {
      if (this.landerState.isDocked && this.landerState.dockedSite) {
        this.callbacks.openPrecursorTerminal(this.landerState.dockedSite);
      }
    });

    this.landerCanvas?.addEventListener('mousedown', (e: MouseEvent) => {
      if (!this.isLanderActive) return;
      if (e.button === 0) { // Left click
        this.fireStunBlaster();
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
        this.fireStunBlaster();
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        this.fireSeismicRadarPing();
      }
      if (e.key === 'e' || e.key === 'E') {
        if (this.landerState.isDocked && this.landerState.dockedSite) {
          this.callbacks.openPrecursorTerminal(this.landerState.dockedSite);
        }
      }
      if (e.key === 'Escape' || e.key === 'l' || e.key === 'L' || e.key === 'x' || e.key === 'X') {
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
    this.landerStunBolts = [];
    this.landerBioSamples = [];
    this.screenShakeTime = 0;

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

    // Populate indigenous alien fauna from planet catalog
    this.loadPlanetaryFauna(activePlanet?.data?.id || 'planet_sec1_aegis');

    const dockBanner = document.getElementById('megastructure-dock-banner');
    if (dockBanner) dockBanner.classList.add('hidden');

    const targetsList = document.getElementById('lander-targets-list');
    if (targetsList) {
      targetsList.innerHTML = `<div class="target-card-item">Press [R] to broadcast seismic pulse and detect surface deposits & fauna.</div>`;
    }

    this.updateLanderTelemetryUI();
    this.startLanderLoop();
  }

  /**
   * Loads planetary fauna catalog from server or initializes procedural wildlife
   */
  public async loadPlanetaryFauna(planetId: string): Promise<void> {
    this.landerFauna = [];
    let speciesList: any[] = [];

    try {
      const res = await fetch(`/api/planets/${planetId}/fauna`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.fauna) && data.fauna.length > 0) {
          speciesList = data.fauna;
        }
      }
    } catch {
      // offline fallback
    }

    if (speciesList.length === 0) {
      speciesList = [
        {
          id: 'fauna_fallback_grazer',
          species_name: 'Aegis Bio-Spore Strider',
          species_class: 'GRAZER',
          color: '#4ade80',
          base_hp: 40,
          movement_speed: 30,
          aggro_range: 0,
          attack_damage: 0,
          bio_unit_value: 12,
          stun_duration_seconds: 12,
        },
        {
          id: 'fauna_fallback_carnivore',
          species_name: 'Silicon Mantis',
          species_class: 'CARNIVORE',
          color: '#f87171',
          base_hp: 60,
          movement_speed: 45,
          aggro_range: 140,
          attack_damage: 15,
          bio_unit_value: 25,
          stun_duration_seconds: 12,
        },
      ];
    }

    // Spawn 4 creatures distributed on surface
    const spawnPoints = [
      { x: 140, y: 160 },
      { x: 620, y: 210 },
      { x: 280, y: 390 },
      { x: 580, y: 380 },
    ];

    spawnPoints.forEach((pt, idx) => {
      const spec = speciesList[idx % speciesList.length];
      this.landerFauna.push({
        id: `fauna_entity_${Date.now()}_${idx}`,
        speciesId: spec.id,
        name: spec.species_name,
        speciesClass: spec.species_class,
        x: pt.x,
        y: pt.y,
        vx: 0,
        vy: 0,
        heading: Math.random() * Math.PI * 2,
        speed: spec.movement_speed || 35,
        color: spec.color || (spec.species_class === 'CARNIVORE' ? '#ef4444' : '#4ade80'),
        hp: spec.base_hp || 50,
        maxHp: spec.base_hp || 50,
        attackDamage: spec.attack_damage || 15,
        state: 'WANDER',
        stunTimer: 0,
        stunDuration: spec.stun_duration_seconds || 12,
        bioYield: spec.species_class === 'CARNIVORE' ? 4 : 2,
        unitValue: spec.bio_unit_value || 15,
        collected: false,
        discovered: false,
        changeDirTimer: 2.0 + Math.random() * 2.0,
        legPhase: Math.random() * Math.PI * 2,
      });
    });

    this.refreshLanderRadarList();
  }

  /**
   * Fires the Star Control II Stun Blaster to tranquilize indigenous alien wildlife
   */
  public fireStunBlaster(): void {
    if (!this.isLanderActive) return;
    const now = Date.now();
    if (now - this.lastStunFireTime < 220) return; // 220ms firing cooldown
    this.lastStunFireTime = now;

    const s = this.landerState;
    const boltSpeed = 440;
    const noseX = s.x + Math.cos(s.heading) * 16;
    const noseY = s.y + Math.sin(s.heading) * 16;

    this.landerStunBolts.push({
      id: `bolt_${Date.now()}_${Math.random()}`,
      x: noseX,
      y: noseY,
      vx: Math.cos(s.heading) * boltSpeed,
      vy: Math.sin(s.heading) * boltSpeed,
      life: 0.75,
      maxLife: 0.75,
    });

    this.audio.playMineralPickupSound();
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

    const activePlanet = this.callbacks.getActivePlanet();
    const planetId = activePlanet?.data?.id || 'planet_sec1_aegis';
    const collectedMinerals = this.landerNodes
      .filter((n) => n.type === 'MINERAL' && n.collected)
      .map((n) => ({ name: n.name, quantity: n.amount || 5 }));

    if (collectedMinerals.length > 0 || this.landerBioSamples.length > 0) {
      this.audio.playCargoHarvestSound();

      fetch(`/api/planets/${planetId}/lander/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
          mineralsHarvested: collectedMinerals,
          bioSamplesHarvested: this.landerBioSamples,
          hullRemaining: Math.round(this.landerState.hull),
          fuelRemaining: Math.round(this.landerState.fuel),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            this.callbacks.showApNotification(
              `🚀 Lander docked with ship! Secured ${data.totalMinerals} minerals and ${data.totalBioUnits} biological units!`,
              false
            );
          }
        })
        .catch((err) => {
          console.warn('[LANDER] Recovery ledger call failed:', err);
          this.callbacks.showApNotification(
            `🚀 Lander docked! Transferred ${this.landerState.cargo} units to ship hold.`,
            false
          );
        });
    }
  }

  /**
   * Fires a Star Control-style seismic radar ping revealing surface deposits and fauna.
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
          statusBlip.textContent = 'READY [R]';
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

      // Check wave discovery intersection with fauna
      this.landerFauna.forEach((f) => {
        const d = Math.hypot(f.x - w.x, f.y - w.y);
        if (d <= w.radius) {
          f.discovered = true;
        }
      });

      if (w.radius >= w.maxRadius) {
        this.landerSonarWaves.splice(i, 1);
        this.refreshLanderRadarList();
      }
    }

    // Stun Blaster Projectile Physics & Tranquilizer Ballistics
    for (let i = this.landerStunBolts.length - 1; i >= 0; i--) {
      const b = this.landerStunBolts[i];
      b.x += b.vx * 0.016;
      b.y += b.vy * 0.016;
      b.life -= 0.016;

      let boltHit = false;
      for (const f of this.landerFauna) {
        if (!f.collected && f.state !== 'STUNNED') {
          const dist = Math.hypot(f.x - b.x, f.y - b.y);
          if (dist <= 22) {
            f.state = 'STUNNED';
            f.stunTimer = f.stunDuration;
            f.vx = 0;
            f.vy = 0;
            boltHit = true;

            // Spawn cyan electrical spark particles around tranquilized creature
            for (let p = 0; p < 8; p++) {
              const angle = Math.random() * Math.PI * 2;
              const spd = 30 + Math.random() * 50;
              this.landerParticles.push({
                x: f.x,
                y: f.y,
                vx: Math.cos(angle) * spd * 0.016,
                vy: Math.sin(angle) * spd * 0.016,
                life: 0.8,
                maxLife: 0.8,
                color: Math.random() > 0.4 ? '#38bdf8' : '#a855f7',
                size: 2.5 + Math.random() * 2,
              });
            }
            this.callbacks.showApNotification(`⚡ ${f.name} tranquilized for ${f.stunDuration}s!`, false);
            this.refreshLanderRadarList();
            break;
          }
        }
      }

      if (boltHit || b.life <= 0 || b.x < 10 || b.x > 750 || b.y < 10 || b.y > 470) {
        this.landerStunBolts.splice(i, 1);
      }
    }

    // Alien Fauna AI Ecosystem (Grazers flee, Carnivores hunt/ram, Stunned harvest)
    for (const f of this.landerFauna) {
      if (f.collected) continue;

      if (f.state === 'STUNNED') {
        f.stunTimer = Math.max(0, f.stunTimer - 0.016);
        if (f.stunTimer <= 0) {
          f.state = 'WANDER';
          f.changeDirTimer = 1.0 + Math.random() * 2.0;
          this.refreshLanderRadarList();
        }

        // Lander drives over stunned creature to harvest bio-specimen
        const distToLander = Math.hypot(f.x - s.x, f.y - s.y);
        if (distToLander <= 26 && s.cargo < s.maxCargo) {
          f.collected = true;
          const existingSample = this.landerBioSamples.find((bs) => bs.speciesId === f.speciesId);
          if (existingSample) {
            existingSample.quantity += 1;
            existingSample.bioUnits += f.unitValue;
          } else {
            this.landerBioSamples.push({
              speciesId: f.speciesId,
              name: f.name,
              quantity: 1,
              bioUnits: f.unitValue,
              speciesClass: f.speciesClass,
            });
          }
          s.cargo = Math.min(s.maxCargo, s.cargo + f.bioYield);
          this.audio.playMineralPickupSound();

          // Spawn harvest burst particles
          for (let p = 0; p < 10; p++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 40 + Math.random() * 60;
            this.landerParticles.push({
              x: f.x,
              y: f.y,
              vx: Math.cos(angle) * spd * 0.016,
              vy: Math.sin(angle) * spd * 0.016,
              life: 1.0,
              maxLife: 1.0,
              color: '#c084fc',
              size: 3 + Math.random() * 2,
            });
          }

          this.callbacks.showApNotification(
            `🧬 Captured ${f.name} specimen! (+${f.unitValue} Bio-Units, +${f.bioYield} Cargo)`,
            false
          );
          this.refreshLanderRadarList();
          this.updateLanderTelemetryUI();
        }
      } else {
        // Living & mobile
        f.legPhase += 0.15;
        const distToLander = Math.hypot(s.x - f.x, s.y - f.y);

        if (f.speciesClass === 'GRAZER') {
          if (distToLander < 110) {
            f.state = 'FLEE';
            f.heading = Math.atan2(f.y - s.y, f.x - s.x);
            f.vx = Math.cos(f.heading) * (f.speed * 1.4);
            f.vy = Math.sin(f.heading) * (f.speed * 1.4);
          } else {
            f.state = 'WANDER';
            f.changeDirTimer -= 0.016;
            if (f.changeDirTimer <= 0) {
              f.heading += (Math.random() - 0.5) * 1.5;
              f.changeDirTimer = 2.0 + Math.random() * 3.0;
            }
            f.vx = Math.cos(f.heading) * (f.speed * 0.6);
            f.vy = Math.sin(f.heading) * (f.speed * 0.6);
          }
        } else if (f.speciesClass === 'CARNIVORE') {
          if (distToLander < 160) {
            f.state = 'CHARGE';
            f.heading = Math.atan2(s.y - f.y, s.x - f.x);
            f.vx = Math.cos(f.heading) * (f.speed * 1.3);
            f.vy = Math.sin(f.heading) * (f.speed * 1.3);

            // Bite / Ram Attack
            if (distToLander <= 22) {
              s.hull = Math.max(0, s.hull - f.attackDamage);
              this.screenShakeTime = 0.35;
              this.audio.playShieldDeflection();
              this.callbacks.showApNotification(
                `⚠️ CARNIVORE ATTACK! ${f.name} breached lander hull (-${f.attackDamage} HP)!`,
                true
              );

              // Knockback bounce
              f.vx = -Math.cos(f.heading) * (f.speed * 1.5);
              f.vy = -Math.sin(f.heading) * (f.speed * 1.5);
              f.x += f.vx * 0.05;
              f.y += f.vy * 0.05;

              // Lander recoil
              s.vx += Math.cos(f.heading) * 3;
              s.vy += Math.sin(f.heading) * 3;

              // Red spark particles
              for (let p = 0; p < 8; p++) {
                const a = Math.random() * Math.PI * 2;
                this.landerParticles.push({
                  x: s.x,
                  y: s.y,
                  vx: Math.cos(a) * (30 + Math.random() * 40) * 0.016,
                  vy: Math.sin(a) * (30 + Math.random() * 40) * 0.016,
                  life: 0.6,
                  maxLife: 0.6,
                  color: '#ef4444',
                  size: 3,
                });
              }

              this.updateLanderTelemetryUI();
            }
          } else {
            f.state = 'WANDER';
            f.changeDirTimer -= 0.016;
            if (f.changeDirTimer <= 0) {
              f.heading += (Math.random() - 0.5) * 1.5;
              f.changeDirTimer = 2.0 + Math.random() * 3.0;
            }
            f.vx = Math.cos(f.heading) * (f.speed * 0.7);
            f.vy = Math.sin(f.heading) * (f.speed * 0.7);
          }
        }

        // Update position
        f.x += f.vx * 0.016;
        f.y += f.vy * 0.016;

        // Soft boundary bounce for fauna [30, 730] x [30, 450]
        if (f.x < 30) { f.x = 30; f.vx = Math.abs(f.vx); f.heading = Math.atan2(f.vy, f.vx); }
        if (f.x > 730) { f.x = 730; f.vx = -Math.abs(f.vx); f.heading = Math.atan2(f.vy, f.vx); }
        if (f.y < 30) { f.y = 30; f.vy = Math.abs(f.vy); f.heading = Math.atan2(f.vy, f.vx); }
        if (f.y > 450) { f.y = 450; f.vy = -Math.abs(f.vy); f.heading = Math.atan2(f.vy, f.vx); }
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
   * Updates radar list on the right panel with discovered nodes, megastructures, and alien fauna.
   */
  private refreshLanderRadarList(): void {
    const listEl = document.getElementById('lander-targets-list');
    if (!listEl) return;

    const discoveredNodes = this.landerNodes.filter((n) => n.discovered);
    const discoveredFauna = this.landerFauna.filter((f) => f.discovered);

    if (discoveredNodes.length === 0 && discoveredFauna.length === 0) {
      listEl.innerHTML = `<div class="target-card-item">Press [R] to broadcast seismic pulse and detect surface deposits & fauna.</div>`;
      return;
    }

    const nodeHtml = discoveredNodes.map((n) => {
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

    const faunaHtml = discoveredFauna.map((f) => {
      const dist = Math.round(Math.hypot(f.x - this.landerState.x, f.y - this.landerState.y));
      const icon = f.speciesClass === 'CARNIVORE' ? '🦂' : '🦕';
      let stateLabel = `[${f.state}]`;
      if (f.collected) stateLabel = '(CAPTURED)';
      else if (f.state === 'STUNNED') stateLabel = `(STUNNED ${Math.ceil(f.stunTimer)}s)`;

      const cssClass = `target-card-item fauna ${f.speciesClass.toLowerCase()} ${f.state === 'STUNNED' ? 'stunned' : ''} ${f.collected ? 'collected' : ''}`;
      return `
        <div class="${cssClass}">
          <div class="target-title">${icon} ${f.name} ${stateLabel}</div>
          <div class="target-meta">${f.speciesClass} // DIST: ${dist}m // VALUE: ${f.unitValue}u // YIELD: ${f.bioYield} cargo</div>
        </div>
      `;
    }).join('');

    listEl.innerHTML = nodeHtml + faunaHtml;
  }

  /**
   * Updates telemetry gauges on the lander CRT HUD.
   */
  private updateLanderTelemetryUI(): void {
    const s = this.landerState;
    const valHull = document.getElementById('val-lander-hull');
    const valFuel = document.getElementById('val-lander-fuel');
    const valCargo = document.getElementById('val-lander-cargo');
    const valBio = document.getElementById('val-lander-bio');
    const fillHull = document.getElementById('lander-hull-fill');
    const fillFuel = document.getElementById('lander-fuel-fill');
    const fillCargo = document.getElementById('lander-cargo-fill');
    const fillBio = document.getElementById('lander-bio-fill');

    if (valHull) valHull.textContent = `${Math.round(s.hull)}%`;
    if (valFuel) valFuel.textContent = `${Math.round(s.fuel)}%`;
    if (valCargo) valCargo.textContent = `${s.cargo} / ${s.maxCargo} Units`;

    const totalBioUnits = this.landerBioSamples.reduce((sum, b) => sum + b.bioUnits, 0);
    const totalSpecimens = this.landerBioSamples.reduce((sum, b) => sum + b.quantity, 0);
    if (valBio) valBio.textContent = `${totalSpecimens} Specimens (${totalBioUnits} Units)`;

    if (fillHull) fillHull.style.width = `${Math.max(0, s.hull)}%`;
    if (fillFuel) fillFuel.style.width = `${Math.max(0, s.fuel)}%`;
    if (fillCargo) fillCargo.style.width = `${Math.min(100, (s.cargo / s.maxCargo) * 100)}%`;
    if (fillBio) fillBio.style.width = `${Math.min(100, (totalBioUnits / 100) * 100)}%`;
  }

  /**
   * Renders the Star Control II planetary surface canvas with topographical contour lines,
   * glowing Precursor ruins, crystalline mineral deposits, moving alien fauna, headlight beam, and lander.
   */
  private renderLanderCanvas(): void {
    if (!this.landerCtx || !this.landerCanvas) return;
    const ctx = this.landerCtx;
    const w = this.landerCanvas.width;
    const h = this.landerCanvas.height;

    // Apply Screen Shake if Carnivore struck hull
    ctx.save();
    if (this.screenShakeTime > 0) {
      this.screenShakeTime = Math.max(0, this.screenShakeTime - 0.016);
      const shakeAmt = 6;
      ctx.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
    }

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

    // 5.1 Render Stun Blaster Bolts
    this.landerStunBolts.forEach((bolt) => {
      ctx.save();
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#e0f2fe';

      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Trailing ionized cyan glow
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bolt.x, bolt.y);
      ctx.lineTo(bolt.x - (bolt.vx * 0.04), bolt.y - (bolt.vy * 0.04));
      ctx.stroke();
      ctx.restore();
    });

    // 5.2 Render Alien Fauna
    this.landerFauna.forEach((f) => {
      if (f.collected) return;
      if (!f.discovered) {
        // Auto-discover if within lander headlight range (85px)
        const d = Math.hypot(f.x - this.landerState.x, f.y - this.landerState.y);
        if (d > 85) return;
        f.discovered = true;
      }

      ctx.save();
      ctx.translate(f.x, f.y);

      // Render Stun Effect Ring & Countdown
      if (f.state === 'STUNNED') {
        const pulse = Math.sin(Date.now() * 0.015) * 3;
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, 18 + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();

        // Stunned Countdown Label
        ctx.save();
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`⚡ STUNNED (${Math.ceil(f.stunTimer)}s)`, 0, -22);
        ctx.restore();
      }

      ctx.rotate(f.heading);

      if (f.speciesClass === 'GRAZER') {
        // Docile Grazer: Green bio-pod with undulating legs and spore sac
        const legOff1 = Math.sin(f.legPhase) * 4;
        const legOff2 = Math.cos(f.legPhase) * 4;
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        // Front legs
        ctx.beginPath();
        ctx.moveTo(4, -6);
        ctx.lineTo(8 + legOff1, -12);
        ctx.moveTo(4, 6);
        ctx.lineTo(8 + legOff2, 12);
        // Back legs
        ctx.moveTo(-6, -6);
        ctx.lineTo(-10 - legOff2, -12);
        ctx.moveTo(-6, 6);
        ctx.lineTo(-10 - legOff1, 12);
        ctx.stroke();

        // Pod Body
        ctx.save();
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#86efac';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Bio-spore cluster
        ctx.fillStyle = '#d9f99d';
        ctx.beginPath();
        ctx.arc(2, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Carnivore: Chitinous predator with snapping mandibles and amber eyes
        ctx.save();
        ctx.fillStyle = f.color;
        ctx.strokeStyle = '#fda4af';
        ctx.lineWidth = 1.5;

        // Abdomen / Carapace
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-4, -8);
        ctx.lineTo(-12, -4);
        ctx.lineTo(-14, 0);
        ctx.lineTo(-12, 4);
        ctx.lineTo(-4, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Snapping Mandibles
        const bitePulse = f.state === 'CHARGE' ? Math.sin(Date.now() * 0.02) * 3 : 0;
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, -4);
        ctx.lineTo(16, -6 + bitePulse);
        ctx.moveTo(8, 4);
        ctx.lineTo(16, 6 - bitePulse);
        ctx.stroke();

        // Glowing Amber Eyes
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(6, -3, 1.5, 0, Math.PI * 2);
        ctx.arc(6, 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();

      // Species Nameplate
      ctx.save();
      ctx.fillStyle = f.speciesClass === 'CARNIVORE' ? '#f87171' : '#4ade80';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(f.name.toUpperCase(), f.x, f.y + 18);
      ctx.restore();
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

    // Restore shake translation
    ctx.restore();
  }
}
