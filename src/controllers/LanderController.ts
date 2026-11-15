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
  stashed?: boolean;
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
  isApex?: boolean;
  stunHitsRequired?: number;
  currentStunHits?: number;
  isEnraged?: boolean;
  lairX?: number;
  lairY?: number;
  lairName?: string;
  roarTimer?: number;
  scientificName?: string;
  kingdom?: string;
  bodyPlan?: string;
  covering?: string;
  sizeMeters?: number;
  trophicRole?: string;
  adaptationTrait?: string;
  glowColor?: string;
}

export interface BioSampleEntry {
  speciesId: string;
  name: string;
  quantity: number;
  bioUnits: number;
  speciesClass: string;
}

export interface LanderHazardProfile {
  thermalLevel: number;
  ionLevel: number;
  causticLevel: number;
}

export interface LanderIonStorm {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radiusX: number;
  radiusY: number;
  lightningTimer: number;
  isStriking: boolean;
  strikeFlashTime: number;
}

export interface LanderCausticMist {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radiusX: number;
  radiusY: number;
}

export interface LanderLavaGeyser {
  id: string;
  x: number;
  y: number;
  radius: number;
  isErupting: boolean;
  cycleTimer: number;
}

export interface LanderAcidPool {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface EmbarkedLanderCrew {
  id: string;
  name: string;
  callsign: string;
  primarySpecialty: string;
  specialties: string[];
  aptitude: number;
  grit: number;
  efficiency: number;
  morale: number;
}

export interface LanderActiveAbilityHUD {
  slotIndex: number;
  abilityId: 'ARC_SHOCKWAVE' | 'SEISMIC_VEIN_CRACKER' | 'NANO_GEL_PATCH' | 'OVERLOAD_CAPACITOR' | 'AFTERBURNER_SURGE';
  name: string;
  icon: string;
  cooldownSec: number;
  description: string;
  grantedByName: string;
  grantedBySpecialty: string;
}

export interface LanderCrewEffectsClient {
  mineralYieldMult: number;
  bonusMineralChance: number;
  bioYieldMult: number;
  speedMult: number;
  fuelBurnMult: number;
  radarRadiusMult: number;
  discoveryRadiusMult: number;
  stunCooldownMult: number;
  stunDurationMult: number;
  extraTitanStunChance: number;
  biteDamageMult: number;
  thermalResistBonus: number;
  ionResistBonus: number;
  causticResistBonus: number;
  passiveHullRegenPerSec: number;
  cargoCapBonusPct: number;
  beaconRangeMult: number;
  beaconFuelBonus: number;
  extraMaxHullPct: number;
  hazardPayDiscount: number;
  precursorBonusEnabled: boolean;
  activeAbilities: LanderActiveAbilityHUD[];
}

const DEFAULT_CREW_EFFECTS: LanderCrewEffectsClient = {
  mineralYieldMult: 1.0,
  bonusMineralChance: 0,
  bioYieldMult: 1.0,
  speedMult: 1.0,
  fuelBurnMult: 1.0,
  radarRadiusMult: 1.0,
  discoveryRadiusMult: 1.0,
  stunCooldownMult: 1.0,
  stunDurationMult: 1.0,
  extraTitanStunChance: 0,
  biteDamageMult: 1.0,
  thermalResistBonus: 0,
  ionResistBonus: 0,
  causticResistBonus: 0,
  passiveHullRegenPerSec: 0,
  cargoCapBonusPct: 0,
  beaconRangeMult: 1.0,
  beaconFuelBonus: 0,
  extraMaxHullPct: 0,
  hazardPayDiscount: 0,
  precursorBonusEnabled: false,
  activeAbilities: [],
};

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

  public landerHazardProfile: LanderHazardProfile = { thermalLevel: 0, ionLevel: 0, causticLevel: 0 };
  public landerTemp: number = 0;
  public isLanderFlamedOut: boolean = false;
  public landerFlameoutTimer: number = 0;
  public landerFittedModules: Record<string, string> = {};
  public landerIonStorms: LanderIonStorm[] = [];
  public landerCausticMists: LanderCausticMist[] = [];
  public landerLavaGeysers: LanderLavaGeyser[] = [];
  public landerAcidPools: LanderAcidPool[] = [];
  public isLanderDestroyed: boolean = false;

  // Day 30: Continuous Surface Expeditions & Apex Titans
  public stashedMineralsTotal: number = 0;
  public stashedBioUnitsTotal: number = 0;
  public currentZoom: number = 1.0;
  public isNearBeacon: boolean = false;

  // Milestone 1.6: Embarked Crew, Passive Modifiers & [1]-[4] Surface Abilities
  public embarkedCrew: EmbarkedLanderCrew[] = [];
  public landerCrewEffects: LanderCrewEffectsClient = { ...DEFAULT_CREW_EFFECTS };
  public abilityCooldownsUntil: Record<number, number> = {};
  public afterburnerTimer: number = 0;
  public causticSealTimer: number = 0;
  public veinCrackerActive: boolean = false;

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
    document.getElementById('btn-lander-stash-cargo')?.addEventListener('click', () => this.stashCargoToMothership());
    document.getElementById('btn-dock-terminal')?.addEventListener('click', () => {
      if (this.landerState.isDocked && this.landerState.dockedSite) {
        this.callbacks.openPrecursorTerminal(this.landerState.dockedSite);
      }
    });
    document.getElementById('btn-open-precursor-terminal')?.addEventListener('click', () => {
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
      if (e.code === 'Digit1' || e.code === 'Numpad1') {
        e.preventDefault();
        this.triggerCrewAbility(1);
      }
      if (e.code === 'Digit2' || e.code === 'Numpad2') {
        e.preventDefault();
        this.triggerCrewAbility(2);
      }
      if (e.code === 'Digit3' || e.code === 'Numpad3') {
        e.preventDefault();
        this.triggerCrewAbility(3);
      }
      if (e.code === 'Digit4' || e.code === 'Numpad4') {
        e.preventDefault();
        this.triggerCrewAbility(4);
      }
      if (e.key === 'e' || e.key === 'E') {
        if (this.isNearBeacon && (this.landerState.cargo > 0 || this.landerBioSamples.length > 0)) {
          this.stashCargoToMothership();
        } else if (this.landerState.isDocked && this.landerState.dockedSite) {
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
  public openSurfaceLander(crewIds: string[] = []): void {
    const activePlanet = this.callbacks.getActivePlanet();
    this.isLanderActive = true;
    this.embarkedCrew = [];
    this.landerCrewEffects = { ...DEFAULT_CREW_EFFECTS, activeAbilities: [] };
    this.abilityCooldownsUntil = {};
    this.afterburnerTimer = 0;
    this.causticSealTimer = 0;
    this.veinCrackerActive = false;

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
    this.stashedMineralsTotal = 0;
    this.stashedBioUnitsTotal = 0;
    this.currentZoom = 1.0;
    this.isNearBeacon = false;

    // Reset Atmospheric Hazards & Environmental Telemetry
    this.landerTemp = 0;
    this.isLanderFlamedOut = false;
    this.landerFlameoutTimer = 0;
    this.isLanderDestroyed = false;
    this.landerIonStorms = [];
    this.landerCausticMists = [];
    this.landerLavaGeysers = [];
    this.landerAcidPools = [];

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

    // Populate alien fauna & atmospheric hazards, plus lock in crewed drop session
    const planetId = activePlanet?.data?.id || 'planet_sec1_aegis';
    this.loadPlanetaryFauna(planetId);
    this.loadPlanetaryHazards(planetId);
    this.syncDeploySessionWithCrew(planetId, crewIds);

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
        isApex: false,
        stunHitsRequired: 1,
        currentStunHits: 0,
        isEnraged: false,
        scientificName: spec.scientificName,
        kingdom: spec.kingdom,
        bodyPlan: spec.bodyPlan,
        covering: spec.covering,
        sizeMeters: spec.sizeMeters,
        trophicRole: spec.trophicRole,
        adaptationTrait: spec.adaptationTrait,
        glowColor: spec.glowColor,
      });
    });

    // Day 30: Load Procedural Apex Titans & Anchored Planetary Lairs
    let titanList: any[] = [];
    try {
      const titanRes = await fetch(`/api/planets/${planetId}/fauna/titans`);
      if (titanRes.ok) {
        const tData = await titanRes.json();
        if (Array.isArray(tData.titans) && tData.titans.length > 0) {
          titanList = tData.titans;
        }
      }
    } catch {
      // offline fallback
    }

    if (titanList.length === 0) {
      titanList = [
        {
          id: `titan_${planetId}`,
          species_name: 'Ancient Chitin Colossus',
          species_class: 'CARNIVORE',
          color: '#f59e0b',
          base_hp: 280,
          movement_speed: 42,
          attack_damage: 28,
          bio_unit_value: 75,
          stun_duration_seconds: 16,
          is_apex: true,
          stun_hits_required: 3,
          current_stun_hits: 0,
          is_enraged: false,
          lair_x: 310,
          lair_y: -240,
          lair_name: 'Obsidian Basalt Rift',
        },
      ];
    }

    titanList.forEach((titan, tIdx) => {
      const canvasLairX = Math.max(80, Math.min(680, 380 + (titan.lair_x || 180) * 0.7));
      const canvasLairY = Math.max(80, Math.min(400, 240 + (titan.lair_y || -120) * 0.7));

      this.landerFauna.push({
        id: `fauna_titan_${Date.now()}_${tIdx}`,
        speciesId: titan.id,
        name: titan.species_name,
        speciesClass: 'CARNIVORE',
        x: canvasLairX,
        y: canvasLairY,
        vx: 0,
        vy: 0,
        heading: Math.random() * Math.PI * 2,
        speed: titan.movement_speed || 42,
        color: titan.color || '#f59e0b',
        hp: titan.base_hp || 280,
        maxHp: titan.base_hp || 280,
        attackDamage: titan.attack_damage || 28,
        state: 'WANDER',
        stunTimer: 0,
        stunDuration: titan.stun_duration_seconds || 16,
        bioYield: 10,
        unitValue: titan.bio_unit_value || 75,
        collected: false,
        discovered: false,
        changeDirTimer: 3.0,
        legPhase: 0,
        isApex: true,
        stunHitsRequired: titan.stun_hits_required || 3,
        currentStunHits: 0,
        isEnraged: false,
        lairX: canvasLairX,
        lairY: canvasLairY,
        lairName: titan.lair_name || 'Subterranean Caldera Lair',
      });
    });

    this.refreshLanderRadarList();
  }

  /**
   * Loads planetary environmental hazards and fitted lander modules from server
   */
  public async loadPlanetaryHazards(planetId: string): Promise<void> {
    this.landerIonStorms = [];
    this.landerCausticMists = [];
    this.landerLavaGeysers = [];
    this.landerAcidPools = [];

    // 1. Verify player lander status & fitted modules
    try {
      const statusRes = await fetch('/api/shipyard/lander/status?accountId=acc_sol_captain');
      if (statusRes.ok) {
        const sData = await statusRes.json();
        if (!sData.hasActiveLander || sData.lander.hull <= 0 || !sData.lander.is_active) {
          this.closeSurfaceLander();
          this.callbacks.showApNotification(
            '⚠️ NO ACTIVE LANDER: Chassis breached or missing. Purchase a replacement or claim an Emergency Loaner Drone at a spaceport shipyard.',
            true
          );
          return;
        }

        this.landerFittedModules = sData.lander.fitted_modules || {};
        this.landerState.maxCargo = sData.lander.cargo_capacity || 25;
        this.landerState.hull = sData.lander.hull || 100;
        this.landerState.maxHull = sData.lander.max_hull || 100;
      }
    } catch {
      // offline fallback
    }

    // 2. Fetch planet hazard classifications
    try {
      const hazardRes = await fetch(`/api/planets/${planetId}/hazards`);
      if (hazardRes.ok) {
        const hData = await hazardRes.json();
        this.landerHazardProfile = {
          thermalLevel: hData.thermalLevel || 0,
          ionLevel: hData.ionLevel || 0,
          causticLevel: hData.causticLevel || 0,
        };
      }
    } catch {
      if (planetId.includes('ignis')) {
        this.landerHazardProfile = { thermalLevel: 3, ionLevel: 0, causticLevel: 0 };
      } else if (planetId.includes('charybdis')) {
        this.landerHazardProfile = { thermalLevel: 0, ionLevel: 2, causticLevel: 1 };
      } else if (planetId.includes('mycelia')) {
        this.landerHazardProfile = { thermalLevel: 0, ionLevel: 0, causticLevel: 2 };
      }
    }

    // 3. Initialize Geological & Atmospheric Hazard Entities
    // Ion Storms
    if (this.landerHazardProfile.ionLevel >= 1) {
      this.landerIonStorms.push({
        id: 'storm_1',
        x: 210,
        y: 140,
        vx: 16,
        vy: 8,
        radiusX: 95,
        radiusY: 55,
        lightningTimer: 3.5,
        isStriking: false,
        strikeFlashTime: 0,
      });
      this.landerIonStorms.push({
        id: 'storm_2',
        x: 540,
        y: 330,
        vx: -14,
        vy: -9,
        radiusX: 110,
        radiusY: 65,
        lightningTimer: 5.0,
        isStriking: false,
        strikeFlashTime: 0,
      });
    }

    // Caustic Mist & Acid Pools
    if (this.landerHazardProfile.causticLevel >= 1) {
      this.landerCausticMists.push({
        id: 'mist_1',
        x: 190,
        y: 280,
        vx: 12,
        vy: -6,
        radiusX: 120,
        radiusY: 70,
      });
      this.landerCausticMists.push({
        id: 'mist_2',
        x: 520,
        y: 160,
        vx: -10,
        vy: 8,
        radiusX: 100,
        radiusY: 60,
      });

      this.landerAcidPools.push(
        { id: 'acid_1', x: 260, y: 380, radius: 26 },
        { id: 'acid_2', x: 490, y: 220, radius: 22 },
        { id: 'acid_3', x: 620, y: 390, radius: 28 }
      );
    }

    // Thermal Lava Geysers
    if (this.landerHazardProfile.thermalLevel >= 1) {
      this.landerLavaGeysers.push(
        { id: 'geyser_1', x: 220, y: 150, radius: 36, isErupting: false, cycleTimer: 3.0 },
        { id: 'geyser_2', x: 540, y: 290, radius: 40, isErupting: false, cycleTimer: 5.0 },
        { id: 'geyser_3', x: 380, y: 400, radius: 34, isErupting: false, cycleTimer: 1.5 }
      );
    }

    this.refreshLanderRadarList();
    this.updateLanderTelemetryUI();
  }

  /**
   * Fires the Star Control II Stun Blaster to tranquilize indigenous alien wildlife
   */
  public fireStunBlaster(): void {
    if (!this.isLanderActive) return;
    const now = Date.now();
    const cooldownMs = Math.max(85, Math.round(220 * (this.landerCrewEffects.stunCooldownMult || 1.0)));
    if (now - this.lastStunFireTime < cooldownMs) return;
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
   * Day 30: Stashes cargo at the Rendezvous Beacon, refuels lander (+25 Fuel), and continues surface expedition.
   */
  public async stashCargoToMothership(): Promise<void> {
    if (!this.isLanderActive) return;
    const activePlanet = this.callbacks.getActivePlanet();
    const planetId = activePlanet?.data?.id || 'planet_sec1_aegis';

    const uncommittedMinerals = this.landerNodes
      .filter((n) => n.type === 'MINERAL' && n.collected && !n.stashed)
      .map((n) => ({ name: n.name, quantity: n.amount || 5 }));

    if (uncommittedMinerals.length === 0 && this.landerBioSamples.length === 0) {
      this.callbacks.showApNotification('⚠️ CARGO EMPTY: Harvest minerals or tranquilize fauna to stash.', true);
      return;
    }

    try {
      const res = await fetch(`/api/planets/${planetId}/lander/stash-cargo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
          mineralsHarvested: uncommittedMinerals,
          bioSamplesHarvested: this.landerBioSamples,
          hullRemaining: Math.max(1, Math.round(this.landerState.hull)),
          fuelRemaining: Math.max(0, Math.round(this.landerState.fuel)),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const stashedMin = data.stashedMinerals || 0;
        const stashedBio = data.stashedBioUnits || 0;

        this.stashedMineralsTotal += stashedMin;
        this.stashedBioUnitsTotal += stashedBio;

        // Mark harvested mineral nodes as stashed
        this.landerNodes
          .filter((n) => n.type === 'MINERAL' && n.collected && !n.stashed)
          .forEach((n) => (n.stashed = true));

        // Clear carried bio-samples & reset carried cargo count
        this.landerBioSamples = [];
        this.landerState.cargo = 0;

        // Apply +25 fuel bonus
        this.landerState.fuel = Math.min(this.landerState.maxFuel, this.landerState.fuel + 25);

        this.audio.playBeaconStashSound();
        this.callbacks.showApNotification(
          `📡 EXPEDITION STASH: Transferred ${stashedMin} minerals & ${stashedBio} bio-units! Lander refueled (+25 Fuel)! Sortie continues!`,
          false
        );

        // Respawn fresh mineral deposits for continuous surface expedition
        this.respawnExpeditionMinerals();

        this.updateLanderTelemetryUI();
        this.refreshLanderRadarList();
      } else {
        const errData = await res.json().catch(() => ({}));
        this.callbacks.showApNotification(`⚠️ Stash failed: ${errData.error || 'Server error'}`, true);
      }
    } catch (err) {
      console.warn('[LANDER] Stash request error:', err);
    }
  }

  /**
   * Day 30: Respawns mineral deposits for deep continuous sorties across multiple cycles
   */
  public respawnExpeditionMinerals(): void {
    const activeMinerals = this.landerNodes.filter((n) => n.type === 'MINERAL' && !n.collected);
    if (activeMinerals.length <= 4) {
      const mineralPool = [
        { name: 'Plutonium Isotopes', color: '#fbbf24', amount: 8 },
        { name: 'Rare Crystalline Matrix', color: '#38bdf8', amount: 10 },
        { name: 'Superdense Titanium', color: '#e2e8f0', amount: 12 },
        { name: 'Xenobiological Spores', color: '#4ade80', amount: 10 },
      ];
      for (let i = 0; i < 3; i++) {
        const m = mineralPool[Math.floor(Math.random() * mineralPool.length)];
        const rx = 100 + Math.random() * 560;
        const ry = 80 + Math.random() * 320;
        this.landerNodes.push({
          id: `node_min_respawn_${Date.now()}_${i}`,
          x: Math.round(rx),
          y: Math.round(ry),
          type: 'MINERAL',
          name: m.name,
          mineralType: m.name,
          amount: m.amount,
          collected: false,
          stashed: false,
          discovered: false,
          color: m.color,
        });
      }
    }
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
      .filter((n) => n.type === 'MINERAL' && n.collected && !n.stashed)
      .map((n) => ({ name: n.name, quantity: n.amount || 5 }));

    const hullVal = Math.max(0, Math.round(this.landerState.hull));
    const fuelVal = Math.max(0, Math.round(this.landerState.fuel));

    // If lander suffered total hull failure on surface, notify backend to run Grit Survival Rolls & log casualties
    if (hullVal <= 0 || this.isLanderDestroyed) {
      fetch(`/api/planets/${planetId}/lander/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
          mineralsHarvested: [],
          bioSamplesHarvested: [],
          hullRemaining: 0,
          fuelRemaining: 0,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          const ejected = Array.isArray(data.ejectedCastaways) ? data.ejectedCastaways : [];
          const kia = Array.isArray(data.casualties) ? data.casualties : [];
          if (ejected.length > 0) {
            this.callbacks.showApNotification(
              `🛰️ EMERGENCY EJECTION! ${ejected.map((c: any) => c.name).join(', ')} survived in cryo-pod(s) in Sector ${data.sectorId || 1} — scoop them in spaceflight!`,
              true
            );
          }
          if (kia.length > 0) {
            this.callbacks.showApNotification(
              `🕯️ CREW LOST IN ACTION: ${kia.map((c: any) => `${c.name} (${c.primarySpecialty})`).join(', ')} logged in Ship Memorial.`,
              true
            );
          }
        })
        .catch(() => {});
      return;
    }

    if (collectedMinerals.length > 0 || this.landerBioSamples.length > 0 || this.embarkedCrew.length > 0) {
      if (collectedMinerals.length > 0 || this.landerBioSamples.length > 0) {
        this.audio.playCargoHarvestSound();
      }

      fetch(`/api/planets/${planetId}/lander/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
          mineralsHarvested: collectedMinerals,
          bioSamplesHarvested: this.landerBioSamples,
          hullRemaining: hullVal,
          fuelRemaining: fuelVal,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            const finalMin = (data.totalMinerals || 0) + this.stashedMineralsTotal;
            const finalBio = (data.totalBioUnits || 0) + this.stashedBioUnitsTotal;
            const vets = Array.isArray(data.veteransGained) && data.veteransGained.length > 0
              ? ` | ⭐ Veteran Growth: ${data.veteransGained.map((v: any) => `${v.name} (+1 ${v.statGained})`).join(', ')}`
              : '';
            const pay = data.hazardPayPaid > 0 ? ` | 💰 Hazard Pay: -${data.hazardPayPaid} Cr` : '';
            this.callbacks.showApNotification(
              `🚀 Lander docked! Secured ${data.totalMinerals} minerals (${finalMin} total), ${data.totalBioUnits} bio units (${finalBio} total)${vets}${pay}`,
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
    } else if (this.stashedMineralsTotal > 0 || this.stashedBioUnitsTotal > 0) {
      this.callbacks.showApNotification(
        `🚀 Lander docked with ship! Expedition sortie complete: ${this.stashedMineralsTotal} minerals & ${this.stashedBioUnitsTotal} biological units secured in ship hold!`,
        false
      );
    }
  }

  /**
   * Fires a Star Control-style seismic radar ping revealing surface deposits and fauna.
   */
  public fireSeismicRadarPing(): void {
    if (!this.isLanderActive) return;

    this.audio.playSeismicRadarPing();
    const maxRadius = Math.round(420 * (this.landerCrewEffects.radarRadiusMult || 1.0));
    this.landerSonarWaves.push({
      x: this.landerState.x,
      y: this.landerState.y,
      radius: 10,
      maxRadius,
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

    // Check for fatal hull failure / destruction
    if (s.hull <= 0 && !this.isLanderDestroyed) {
      this.isLanderDestroyed = true;
      s.hull = 0;
      s.cargo = 0;
      this.landerBioSamples = [];
      this.audio.playExplosion();
      this.callbacks.showApNotification(
        '💥 CRITICAL HULL BREACH! Surface lander destroyed in extreme atmospheric hazards. Uncommitted cargo lost. Purchase replacement at Spaceport Shipyard.',
        true
      );
      this.closeSurfaceLander();
      return;
    }

    // Milestone 1.6 active buff timers & passive Medic hull regeneration
    if (this.afterburnerTimer > 0) {
      this.afterburnerTimer = Math.max(0, this.afterburnerTimer - 0.016);
    }
    if (this.causticSealTimer > 0) {
      this.causticSealTimer = Math.max(0, this.causticSealTimer - 0.016);
    }
    if (this.landerCrewEffects.passiveHullRegenPerSec > 0 && s.hull > 0 && s.hull < s.maxHull) {
      s.hull = Math.min(s.maxHull, s.hull + this.landerCrewEffects.passiveHullRegenPerSec * 0.016);
    }

    // Passive sensor aura discovery around lander (Astronomer / Geologist discovery radius bonus)
    const passiveRad = (this.landerCrewEffects.discoveryRadiusMult || 1.0) > 1.0 ? Math.round(85 * this.landerCrewEffects.discoveryRadiusMult) : 0;
    if (passiveRad > 0) {
      let newlyDiscovered = false;
      this.landerNodes.forEach((n) => {
        if (!n.discovered && Math.hypot(n.x - s.x, n.y - s.y) <= passiveRad) {
          n.discovered = true;
          newlyDiscovered = true;
        }
      });
      this.landerFauna.forEach((f) => {
        if (!f.discovered && Math.hypot(f.x - s.x, f.y - s.y) <= passiveRad) {
          f.discovered = true;
          newlyDiscovered = true;
        }
      });
      if (newlyDiscovered) {
        this.refreshLanderRadarList();
      }
    }

    // Rotation
    const spdMult = (this.landerCrewEffects.speedMult || 1.0) * (this.afterburnerTimer > 0 ? 1.75 : 1.0);
    const turnRate = 0.055 * (1 + Math.max(0, spdMult - 1) * 0.4);
    if (k.left) s.heading -= turnRate;
    if (k.right) s.heading += turnRate;

    // Forward Thruster (inhibited during thermal flameout)
    const canThrust = k.up && (s.fuel > 0 || this.afterburnerTimer > 0) && !this.isLanderFlamedOut;
    if (canThrust) {
      const accel = 0.15 * spdMult;
      s.vx += Math.cos(s.heading) * accel;
      s.vy += Math.sin(s.heading) * accel;
      if (this.afterburnerTimer <= 0) {
        const burn = 0.04 * (this.landerCrewEffects.fuelBurnMult || 1.0);
        s.fuel = Math.max(0, s.fuel - burn);
      }
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

    // Atmospheric Weather & Geological Hazards Processing
    const hasThermalPlating = this.landerFittedModules?.thermal === 'MOD_THERMAL_PLATING';
    const hasIonDissipator = this.landerFittedModules?.electrical === 'MOD_ION_DISSIPATOR';
    const hasCausticSealant = this.landerFittedModules?.caustic === 'MOD_CAUSTIC_SEALANT' || this.causticSealTimer > 0;
    const thermalCrewFactor = Math.max(0.15, 1 - (this.landerCrewEffects.thermalResistBonus || 0));
    const ionCrewFactor = Math.max(0.15, 1 - (this.landerCrewEffects.ionResistBonus || 0));
    const causticCrewFactor = this.causticSealTimer > 0 ? 0 : Math.max(0.15, 1 - (this.landerCrewEffects.causticResistBonus || 0));

    // 1. Thermal Equilibrium
    const ambientHeatRate = (this.landerHazardProfile.thermalLevel * 4.5 * 0.016) * (hasThermalPlating ? 0.25 : 1.0) * thermalCrewFactor;
    const thrusterHeatRate = canThrust ? (6.0 * 0.016 * (hasThermalPlating ? 0.4 : 1.0) * thermalCrewFactor) : 0;
    const idleCoolingRate = !canThrust ? (8.0 * 0.016 * (hasThermalPlating ? 2.0 : 1.0)) : (2.0 * 0.016);

    let geyserHeatRate = 0;
    for (const g of this.landerLavaGeysers) {
      g.cycleTimer -= 0.016;
      if (g.cycleTimer <= 0) {
        g.isErupting = !g.isErupting;
        g.cycleTimer = g.isErupting ? 2.0 : 4.0;
      }

      if (g.isErupting) {
        for (let p = 0; p < 2; p++) {
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
          const spd = 30 + Math.random() * 50;
          this.landerParticles.push({
            x: g.x + (Math.random() - 0.5) * 14,
            y: g.y,
            vx: Math.cos(ang) * spd * 0.016,
            vy: Math.sin(ang) * spd * 0.016,
            life: 0.6,
            maxLife: 0.6,
            color: Math.random() > 0.4 ? '#f97316' : '#ef4444',
            size: 2 + Math.random() * 3,
          });
        }

        const d = Math.hypot(s.x - g.x, s.y - g.y);
        if (d <= g.radius) {
          geyserHeatRate += hasThermalPlating ? 0.08 : 0.5;
          if (!hasThermalPlating) {
            s.hull = Math.max(0, s.hull - (12.0 * 0.016));
          }
        }
      }
    }

    this.landerTemp = Math.max(0, Math.min(100, this.landerTemp + ambientHeatRate + thrusterHeatRate + geyserHeatRate - idleCoolingRate));

    if (this.landerTemp >= 100 && !this.isLanderFlamedOut) {
      this.isLanderFlamedOut = true;
      this.landerFlameoutTimer = 2.5;
      this.audio.playShieldBreakSound();
      this.callbacks.showApNotification('⚠️ THERMAL OVERHEAT! Engine flameout initiated for 2.5s! Hull scorching active!', true);
    }

    if (this.isLanderFlamedOut) {
      this.landerFlameoutTimer -= 0.016;
      s.hull = Math.max(0, s.hull - (10.0 * 0.016));
      if (this.landerFlameoutTimer <= 0 && this.landerTemp < 80) {
        this.isLanderFlamedOut = false;
        this.callbacks.showApNotification('✅ Core temperature stabilized. Thruster ignition restored.', false);
      }
    }

    // 2. Ion Storms Physics
    for (const storm of this.landerIonStorms) {
      storm.x += storm.vx * 0.016;
      storm.y += storm.vy * 0.016;
      if (storm.x < 80 || storm.x > 680) storm.vx = -storm.vx;
      if (storm.y < 60 || storm.y > 420) storm.vy = -storm.vy;

      storm.lightningTimer -= 0.016;
      if (storm.isStriking) {
        storm.strikeFlashTime -= 0.016;
        if (storm.strikeFlashTime <= 0) storm.isStriking = false;
      }

      if (storm.lightningTimer <= 0) {
        storm.isStriking = true;
        storm.strikeFlashTime = 0.25;
        storm.lightningTimer = 3.5 + Math.random() * 2.5;

        const normX = (s.x - storm.x) / storm.radiusX;
        const normY = (s.y - storm.y) / storm.radiusY;
        if (normX * normX + normY * normY <= 1.0) {
          if (hasIonDissipator) {
            this.callbacks.showApNotification('⚡ Ion Grounding Matrix deflected atmospheric lightning strike! (0 damage)', false);
          } else {
            const ionDmg = Math.max(4, Math.round(25 * ionCrewFactor));
            s.hull = Math.max(0, s.hull - ionDmg);
            this.audio.playShieldBreakSound();
            this.callbacks.showApNotification(`⚡ DIRECT LIGHTNING STRIKE! Chassis electrical damage (-${ionDmg} HP)!`, true);
          }
        }
      }
    }

    // 3. Caustic Mist & Acid Pools Physics
    for (const mist of this.landerCausticMists) {
      mist.x += mist.vx * 0.016;
      mist.y += mist.vy * 0.016;
      if (mist.x < 80 || mist.x > 680) mist.vx = -mist.vx;
      if (mist.y < 60 || mist.y > 420) mist.vy = -mist.vy;

      const normX = (s.x - mist.x) / mist.radiusX;
      const normY = (s.y - mist.y) / mist.radiusY;
      if (normX * normX + normY * normY <= 1.0) {
        const acidDmg = (hasCausticSealant ? (1.2 * 0.016) : (6.0 * 0.016)) * causticCrewFactor;
        s.hull = Math.max(0, s.hull - acidDmg);
      }
    }

    for (const pool of this.landerAcidPools) {
      const d = Math.hypot(s.x - pool.x, s.y - pool.y);
      if (d <= pool.radius) {
        if (!hasCausticSealant) {
          s.hull = Math.max(0, s.hull - (12.0 * 0.016));
          this.landerParticles.push({
            x: s.x + (Math.random() - 0.5) * 12,
            y: s.y + 8,
            vx: (Math.random() - 0.5) * 15 * 0.016,
            vy: -Math.random() * 20 * 0.016,
            life: 0.4,
            maxLife: 0.4,
            color: '#84cc16',
            size: 2,
          });
        }
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
          const hitRadius = f.isApex ? 32 : 22;
          const dist = Math.hypot(f.x - b.x, f.y - b.y);
          if (dist <= hitRadius) {
            boltHit = true;

            if (f.isApex) {
              // Day 30 Apex Titan: Multi-Hit Tranquilizer Buildup & Enrage Mechanics + Gunner bonus hit
              const bonusHit = Math.random() < (this.landerCrewEffects.extraTitanStunChance || 0) ? 1 : 0;
              f.currentStunHits = (f.currentStunHits || 0) + 1 + bonusHit;
              const reqHits = f.stunHitsRequired || 3;

              // Notify backend API
              const activePlanet = this.callbacks.getActivePlanet();
              const pId = activePlanet?.data?.id || 'planet_sec1_aegis';
              fetch(`/api/planets/${pId}/lander/titan-hit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountId: 'acc_sol_captain', speciesId: f.speciesId }),
              }).catch(() => {});

              if (f.currentStunHits >= reqHits) {
                // Fully subdued!
                f.state = 'STUNNED';
                f.stunTimer = Math.round((f.stunDuration || 16.0) * (this.landerCrewEffects.stunDurationMult || 1.0));
                f.isEnraged = false;
                f.currentStunHits = 0;
                f.vx = 0;
                f.vy = 0;
                this.screenShakeTime = 0.5;
                this.callbacks.showApNotification(
                  `👑 APEX TITAN SUBDUED! ${f.name} tranquilized for ${f.stunTimer}s!`,
                  false
                );
              } else {
                // Intermediate stun hit -> Trigger Enrage!
                f.isEnraged = true;
                f.state = 'CHARGE';
                this.screenShakeTime = 0.4;
                this.audio.playTitanRoarSound();
                this.callbacks.showApNotification(
                  `💥 TITAN STRUCK (${f.currentStunHits}/${reqHits} Hits)! ${f.name} ENRAGED! Speed & damage surged!`,
                  true
                );
              }

              // Titan impact spark particles
              for (let p = 0; p < 12; p++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = 40 + Math.random() * 60;
                this.landerParticles.push({
                  x: f.x,
                  y: f.y,
                  vx: Math.cos(angle) * spd * 0.016,
                  vy: Math.sin(angle) * spd * 0.016,
                  life: 0.9,
                  maxLife: 0.9,
                  color: f.isEnraged ? '#ef4444' : '#38bdf8',
                  size: 3 + Math.random() * 3,
                });
              }
            } else {
              // Standard fauna: 1-shot tranquilization
              f.state = 'STUNNED';
              f.stunTimer = Math.round((f.stunDuration || 10) * (this.landerCrewEffects.stunDurationMult || 1.0));
              f.vx = 0;
              f.vy = 0;

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
            }

            this.refreshLanderRadarList();
            break;
          }
        }
      }

      if (boltHit || b.life <= 0 || b.x < 10 || b.x > 750 || b.y < 10 || b.y > 470) {
        this.landerStunBolts.splice(i, 1);
      }
    }

    // Alien Fauna AI Ecosystem (Grazers flee, Carnivores hunt/ram, Titans defend Lairs, Stunned harvest)
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
        const harvestDist = f.isApex ? 34 : 26;
        if (distToLander <= harvestDist && s.cargo < s.maxCargo) {
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
          for (let p = 0; p < (f.isApex ? 18 : 10); p++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 40 + Math.random() * 70;
            this.landerParticles.push({
              x: f.x,
              y: f.y,
              vx: Math.cos(angle) * spd * 0.016,
              vy: Math.sin(angle) * spd * 0.016,
              life: 1.2,
              maxLife: 1.2,
              color: f.isApex ? '#ec4899' : '#c084fc',
              size: 3.5 + Math.random() * 2.5,
            });
          }

          const prefix = f.isApex ? '👑 Captured APEX TITAN' : '🧬 Captured';
          this.callbacks.showApNotification(
            `${prefix} ${f.name} specimen! (+${f.unitValue} Bio-Units, +${f.bioYield} Cargo)`,
            false
          );
          this.refreshLanderRadarList();
          this.updateLanderTelemetryUI();
        }
      } else {
        // Living & mobile
        f.legPhase += 0.15;
        const distToLander = Math.hypot(s.x - f.x, s.y - f.y);

        if (f.isApex) {
          // Day 30 Apex Titan AI: Lair patrol, territorial aggro, enrage frenzy
          const aggroThreshold = f.isEnraged ? 240 : 180;
          const speedMult = f.isEnraged ? 1.55 : 1.15;
          const currentSpeed = (f.speed || 42) * speedMult;

          if (distToLander < aggroThreshold) {
            f.state = 'CHARGE';
            f.heading = Math.atan2(s.y - f.y, s.x - f.x);
            f.vx = Math.cos(f.heading) * currentSpeed;
            f.vy = Math.sin(f.heading) * currentSpeed;

            // Titan Ram / Melee Strike
            if (distToLander <= 28) {
              const rawDmg = (f.attackDamage || 28) * (f.isEnraged ? 1.5 : 1.0);
              const effectiveDmg = Math.max(3, Math.round(rawDmg * (this.landerCrewEffects.biteDamageMult || 1.0)));
              s.hull = Math.max(0, s.hull - effectiveDmg);
              this.screenShakeTime = f.isEnraged ? 0.6 : 0.4;
              this.audio.playShieldDeflection();
              if (f.isEnraged) this.audio.playTitanRoarSound();

              this.callbacks.showApNotification(
                `⚠️ TITAN STRIKE! ${f.name} slammed lander chassis (-${effectiveDmg} HP)!`,
                true
              );

              // Heavy Knockback bounce
              f.vx = -Math.cos(f.heading) * (currentSpeed * 1.4);
              f.vy = -Math.sin(f.heading) * (currentSpeed * 1.4);
              f.x += f.vx * 0.06;
              f.y += f.vy * 0.06;

              s.vx += Math.cos(f.heading) * 4.5;
              s.vy += Math.sin(f.heading) * 4.5;

              // Heavy Red impact sparks
              for (let p = 0; p < 12; p++) {
                const a = Math.random() * Math.PI * 2;
                this.landerParticles.push({
                  x: s.x,
                  y: s.y,
                  vx: Math.cos(a) * (40 + Math.random() * 50) * 0.016,
                  vy: Math.sin(a) * (40 + Math.random() * 50) * 0.016,
                  life: 0.7,
                  maxLife: 0.7,
                  color: '#ef4444',
                  size: 3.5,
                });
              }

              this.updateLanderTelemetryUI();
            }
          } else {
            // Outside player aggro -> Patrol anchored Lair coordinates
            const lairX = f.lairX != null ? f.lairX : 380;
            const lairY = f.lairY != null ? f.lairY : 240;
            const distToLair = Math.hypot(f.x - lairX, f.y - lairY);

            if (distToLair > 130) {
              // Return towards anchored lair
              f.heading = Math.atan2(lairY - f.y, lairX - f.x);
              f.vx = Math.cos(f.heading) * (f.speed * 0.8);
              f.vy = Math.sin(f.heading) * (f.speed * 0.8);
            } else {
              f.state = 'WANDER';
              f.changeDirTimer -= 0.016;
              if (f.changeDirTimer <= 0) {
                f.heading += (Math.random() - 0.5) * 1.6;
                f.changeDirTimer = 2.5 + Math.random() * 2.5;
              }
              f.vx = Math.cos(f.heading) * (f.speed * 0.6);
              f.vy = Math.sin(f.heading) * (f.speed * 0.6);
            }
          }
        } else if (f.speciesClass === 'GRAZER') {
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
              const biteDmg = Math.max(2, Math.round(f.attackDamage * (this.landerCrewEffects.biteDamageMult || 1.0)));
              s.hull = Math.max(0, s.hull - biteDmg);
              this.screenShakeTime = 0.35;
              this.audio.playShieldDeflection();
              this.callbacks.showApNotification(
                `⚠️ CARNIVORE ATTACK! ${f.name} breached lander hull (-${biteDmg} HP)!`,
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

    // Day 30: Orbital Rendezvous Beacon Proximity & Stash Banner Handling
    const distToBeacon = Math.hypot(s.x - 380, s.y - 240);
    const stashRadius = 60 * (this.landerCrewEffects.beaconRangeMult || 1.0);
    this.isNearBeacon = distToBeacon <= stashRadius;
    const stashBanner = document.getElementById('rendezvous-stash-banner');
    if (this.isNearBeacon && (s.cargo > 0 || this.landerBioSamples.length > 0)) {
      if (stashBanner) stashBanner.classList.remove('hidden');
    } else {
      if (stashBanner) stashBanner.classList.add('hidden');
    }

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
      let icon = f.speciesClass === 'CARNIVORE' ? '🦂' : '🦕';
      if (f.isApex) icon = f.isEnraged ? '🔥' : '👑';

      let stateLabel = `[${f.state}]`;
      if (f.collected) stateLabel = '(CAPTURED)';
      else if (f.state === 'STUNNED') stateLabel = `(STUNNED ${Math.ceil(f.stunTimer)}s)`;
      else if (f.isEnraged) stateLabel = '(ENRAGED)';

      let apexMeta = '';
      if (f.isApex) {
        apexMeta = ` // LAIR: ${f.lairName || 'UNKNOWN'} // STUN: ${f.currentStunHits || 0}/${f.stunHitsRequired || 3}`;
      }

      const bioDetails = f.scientificName
        ? ` // <em>${f.scientificName}</em> (${f.covering || 'xeno-hide'}, ${f.sizeMeters || 2.0}m)`
        : '';
      const cssClass = `target-card-item fauna ${f.speciesClass.toLowerCase()} ${f.isApex ? 'titan' : ''} ${f.isEnraged ? 'enraged' : ''} ${f.state === 'STUNNED' ? 'stunned' : ''} ${f.collected ? 'collected' : ''}`;
      return `
        <div class="${cssClass}">
          <div class="target-title">${icon} ${f.name} ${stateLabel}</div>
          <div class="target-meta">${f.kingdom || f.speciesClass}${bioDetails} // DIST: ${dist}m // VALUE: ${f.unitValue}u // YIELD: ${f.bioYield} cargo${apexMeta}</div>
        </div>
      `;
    }).join('');

    const hazardCards: string[] = [];
    if (this.landerHazardProfile.thermalLevel > 0) {
      hazardCards.push(`
        <div class="target-card-item hazard geyser">
          <div class="target-title">🌋 VOLCANIC THERMAL FIELD</div>
          <div class="target-meta">THERMAL LEVEL: ${this.landerHazardProfile.thermalLevel} // ACTIVE GEYSERS</div>
        </div>
      `);
    }
    if (this.landerHazardProfile.ionLevel > 0) {
      hazardCards.push(`
        <div class="target-card-item hazard ion">
          <div class="target-title">⚡ ATMOSPHERIC ION STORM</div>
          <div class="target-meta">ELECTRICAL SQUALLS // LIGHTNING HAZARD</div>
        </div>
      `);
    }
    if (this.landerHazardProfile.causticLevel > 0) {
      hazardCards.push(`
        <div class="target-card-item hazard acid">
          <div class="target-title">🧪 CAUSTIC CHEMICAL BIOME</div>
          <div class="target-meta">ACID RAIN & POOLS // CORROSIVE HAZARD</div>
        </div>
      `);
    }

    listEl.innerHTML = nodeHtml + faunaHtml + hazardCards.join('');
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
    const valTemp = document.getElementById('val-lander-temp');
    const valStashed = document.getElementById('val-lander-stashed-total');
    const fillHull = document.getElementById('lander-hull-fill');
    const fillFuel = document.getElementById('lander-fuel-fill');
    const fillCargo = document.getElementById('lander-cargo-fill');
    const fillBio = document.getElementById('lander-bio-fill');
    const fillTemp = document.getElementById('lander-temp-fill');

    if (valHull) valHull.textContent = `${Math.round(s.hull)}%`;
    if (valFuel) valFuel.textContent = `${Math.round(s.fuel)}%`;
    if (valCargo) valCargo.textContent = `${s.cargo} / ${s.maxCargo} Units`;

    const totalBioUnits = this.landerBioSamples.reduce((sum, b) => sum + b.bioUnits, 0);
    const totalSpecimens = this.landerBioSamples.reduce((sum, b) => sum + b.quantity, 0);
    if (valBio) valBio.textContent = `${totalSpecimens} Specimens (${totalBioUnits} Units)`;

    if (valStashed) {
      valStashed.textContent = `${this.stashedMineralsTotal} Min / ${this.stashedBioUnitsTotal} Bio`;
    }

    if (valTemp) {
      const degC = Math.round(this.landerTemp * 3.2 + 24);
      let statusStr = 'NOMINAL';
      if (this.isLanderFlamedOut) statusStr = 'OVERHEAT // FLAMEOUT';
      else if (this.landerTemp > 75) statusStr = 'CRITICAL HEAT';
      else if (this.landerTemp > 45) statusStr = 'ELEVATED';

      valTemp.textContent = `${degC}°C (${statusStr})`;
    }

    if (fillHull) fillHull.style.width = `${Math.max(0, s.hull)}%`;
    if (fillFuel) fillFuel.style.width = `${Math.max(0, s.fuel)}%`;
    if (fillCargo) fillCargo.style.width = `${Math.min(100, (s.cargo / s.maxCargo) * 100)}%`;
    if (fillBio) fillBio.style.width = `${Math.min(100, (totalBioUnits / 100) * 100)}%`;

    if (fillTemp) {
      fillTemp.style.width = `${Math.min(100, Math.max(0, this.landerTemp))}%`;
      if (this.landerTemp > 75 || this.isLanderFlamedOut) {
        fillTemp.className = 'lander-bar-fill red';
      } else {
        fillTemp.className = 'lander-bar-fill orange';
      }
    }

    // Milestone 1.6: Keep [1]-[4] ability cooldown badges live
    const abilityBar = document.getElementById('lander-crew-abilities-bar');
    if (abilityBar && this.landerCrewEffects.activeAbilities.length > 0) {
      const now = Date.now();
      abilityBar.querySelectorAll('.lander-ability-btn').forEach((btn) => {
        const slot = Number((btn as HTMLElement).getAttribute('data-ability-slot') || 0);
        const until = this.abilityCooldownsUntil[slot] || 0;
        const cdEl = btn.querySelector('.lander-ability-cd');
        if (until > now) {
          btn.classList.add('on-cooldown');
          if (cdEl) cdEl.textContent = `(${Math.ceil((until - now) / 1000)}s)`;
        } else {
          btn.classList.remove('on-cooldown');
          if (cdEl) cdEl.textContent = 'READY';
        }
      });
    }
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

    // Apply Screen Shake if Carnivore or Titan struck hull
    ctx.save();
    if (this.screenShakeTime > 0) {
      this.screenShakeTime = Math.max(0, this.screenShakeTime - 0.016);
      const shakeAmt = 7;
      ctx.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
    }

    const s = this.landerState;

    // Day 30: Velocity-Scaled Dynamic Camera Zoom
    const spd = Math.hypot(s.vx, s.vy);
    const targetZoom = Math.max(0.78, Math.min(1.15, 1.15 - (spd / 8.0) * 0.37));
    this.currentZoom = this.currentZoom * 0.92 + targetZoom * 0.08;

    // Apply Camera Zoom centered on player lander
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(this.currentZoom, this.currentZoom);
    ctx.translate(-s.x, -s.y);

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

    // 3.1 Day 30: Orbital Rendezvous Beacon Landing Pad (380, 240)
    ctx.save();
    const beaconPulse = Math.sin(Date.now() * 0.004) * 4;
    ctx.beginPath();
    ctx.arc(380, 240, 34 + beaconPulse, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(380, 240, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(14, 165, 233, 0.18)';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Transporter glyph
    ctx.fillStyle = '#38bdf8';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('📡', 380, 245);

    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText('ORBITAL BEACON', 380, 268);

    // If lander is near beacon, draw active transporter energy beam
    if (this.isNearBeacon) {
      ctx.beginPath();
      ctx.moveTo(380, 240);
      ctx.lineTo(s.x, s.y);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
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

    // 4.1 Render Geological Hazards (Acid Pools & Lava Geysers)
    this.landerAcidPools.forEach((pool) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(132, 204, 22, 0.28)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(163, 230, 53, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Popping chemical bubbles
      const bTime = (Date.now() * 0.003) % (Math.PI * 2);
      ctx.fillStyle = '#bef264';
      ctx.beginPath();
      ctx.arc(pool.x + Math.sin(bTime) * (pool.radius * 0.4), pool.y + Math.cos(bTime) * (pool.radius * 0.4), 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    this.landerLavaGeysers.forEach((geyser) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(geyser.x, geyser.y, geyser.radius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = geyser.isErupting ? 'rgba(239, 68, 68, 0.65)' : 'rgba(180, 83, 9, 0.35)';
      ctx.fill();
      ctx.strokeStyle = geyser.isErupting ? '#f97316' : '#78350f';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Thermal Danger Perimeter
      ctx.beginPath();
      ctx.arc(geyser.x, geyser.y, geyser.radius, 0, Math.PI * 2);
      ctx.strokeStyle = geyser.isErupting ? 'rgba(249, 115, 22, 0.5)' : 'rgba(249, 115, 22, 0.15)';
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });

    // 4.2 Render Atmospheric Weather Fronts (Caustic Mist & Ion Storms)
    this.landerCausticMists.forEach((mist) => {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(mist.x, mist.y, mist.radiusX, mist.radiusY, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(132, 204, 22, 0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(163, 230, 53, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    });

    this.landerIonStorms.forEach((storm) => {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(storm.x, storm.y, storm.radiusX, storm.radiusY, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(147, 51, 234, 0.22)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Atmospheric lightning arc
      if (storm.isStriking) {
        ctx.strokeStyle = '#38bdf8';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        let currX = storm.x;
        let currY = storm.y;
        ctx.moveTo(currX, currY);
        const steps = 5;
        const targetY = storm.y + storm.radiusY + 45;
        const dy = (targetY - storm.y) / steps;
        for (let sIdx = 1; sIdx <= steps; sIdx++) {
          currX += (Math.random() - 0.5) * 26;
          currY += dy;
          ctx.lineTo(currX, currY);
        }
        ctx.stroke();
      }
      ctx.restore();
    });

    // 4.3 Day 30: Render Anchored Titan Planetary Lairs
    this.landerFauna.forEach((f) => {
      if (f.isApex && f.lairX != null && f.lairY != null) {
        ctx.save();
        const lx = f.lairX;
        const ly = f.lairY;

        // Dark subterranean caldera chasm
        const lairGrad = ctx.createRadialGradient(lx, ly, 6, lx, ly, 38);
        lairGrad.addColorStop(0, '#450a0a');
        lairGrad.addColorStop(0.7, '#1c1917');
        lairGrad.addColorStop(1, 'rgba(12, 10, 9, 0.0)');
        ctx.fillStyle = lairGrad;
        ctx.beginPath();
        ctx.arc(lx, ly, 38, 0, Math.PI * 2);
        ctx.fill();

        // Ominous pulsing perimeter ring
        const lPulse = Math.sin(Date.now() * 0.004) * 3;
        ctx.beginPath();
        ctx.arc(lx, ly, 28 + lPulse, 0, Math.PI * 2);
        ctx.strokeStyle = f.isEnraged ? 'rgba(239, 68, 68, 0.7)' : 'rgba(236, 72, 153, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Jagged rocky crust spikes
        ctx.strokeStyle = '#78716c';
        ctx.lineWidth = 2;
        for (let sAng = 0; sAng < Math.PI * 2; sAng += Math.PI / 4) {
          ctx.beginPath();
          ctx.moveTo(lx + Math.cos(sAng) * 22, ly + Math.sin(sAng) * 22);
          ctx.lineTo(lx + Math.cos(sAng + 0.15) * 30, ly + Math.sin(sAng + 0.15) * 30);
          ctx.stroke();
        }

        // Lair Title Label
        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`🌋 ${(f.lairName || 'TITAN LAIR').toUpperCase()}`, lx, ly + 44);
        ctx.restore();
      }
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

    // 5.2 Render Alien Fauna & Procedural Apex Titans
    this.landerFauna.forEach((f) => {
      if (f.collected) return;
      if (!f.discovered) {
        const d = Math.hypot(f.x - this.landerState.x, f.y - this.landerState.y);
        const discoverRadius = f.isApex ? 140 : 85;
        if (d > discoverRadius) return;
        f.discovered = true;
      }

      ctx.save();
      ctx.translate(f.x, f.y);

      // Render Stun Effect Ring & Countdown
      if (f.state === 'STUNNED') {
        const pulse = Math.sin(Date.now() * 0.015) * 3;
        const sRingR = f.isApex ? 28 : 18;
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, sRingR + pulse, 0, Math.PI * 2);
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
        ctx.fillText(`⚡ STUNNED (${Math.ceil(f.stunTimer)}s)`, 0, -(sRingR + 6));
        ctx.restore();
      }

      // Render Enraged Aura for Apex Titan
      if (f.isApex && f.isEnraged && f.state !== 'STUNNED') {
        ctx.save();
        const fPulse = Math.sin(Date.now() * 0.02) * 5;
        ctx.beginPath();
        ctx.arc(0, 0, 32 + fPulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      ctx.rotate(f.heading);

      if (f.isApex) {
        // Day 30 Apex Titan: Giant Behemoth with twin mandibles, heavy dorsal carapace, glowing spines
        const titanScale = 1.8;
        ctx.save();
        ctx.scale(titanScale, titanScale);

        // Chitin Carapace Segments
        ctx.fillStyle = f.color;
        ctx.strokeStyle = f.isEnraged ? '#ef4444' : '#fbbf24';
        ctx.lineWidth = 1.8;

        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-6, -11);
        ctx.lineTo(-16, -6);
        ctx.lineTo(-18, 0);
        ctx.lineTo(-16, 6);
        ctx.lineTo(-6, 11);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Heavy Snapping Mandibles
        const bitePulse = f.state === 'CHARGE' ? Math.sin(Date.now() * 0.025) * 4 : 0;
        ctx.strokeStyle = f.isEnraged ? '#f87171' : '#f59e0b';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(12, -5);
        ctx.lineTo(22, -8 + bitePulse);
        ctx.lineTo(19, 0);
        ctx.moveTo(12, 5);
        ctx.lineTo(22, 8 - bitePulse);
        ctx.lineTo(19, 0);
        ctx.stroke();

        // Glowing Bioluminescent Eyes
        ctx.fillStyle = f.isEnraged ? '#ff0000' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(8, -4, 2, 0, Math.PI * 2);
        ctx.arc(8, 4, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      } else if (f.bodyPlan === 'CRYSTAL_SHARD') {
        // Crystalline Litho-Morph Polygon
        ctx.save();
        ctx.fillStyle = f.color;
        ctx.strokeStyle = f.glowColor || '#67e8f9';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(13, 0);
        ctx.lineTo(3, -9);
        ctx.lineTo(-10, -5);
        ctx.lineTo(-13, 0);
        ctx.lineTo(-10, 5);
        ctx.lineTo(3, 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (f.bodyPlan === 'EXOTHERMIC_POD' || f.bodyPlan === 'SOLAR_FROND') {
        // Exothermic Flora Cluster / Frond
        const pulse = Math.sin(Date.now() * 0.005) * 1.5;
        ctx.save();
        ctx.strokeStyle = f.glowColor || '#4ade80';
        ctx.lineWidth = 2;
        for (let a = 0; a < 5; a++) {
          const ang = (a / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang) * (10 + pulse), Math.sin(ang) * (10 + pulse));
          ctx.stroke();
        }
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (f.bodyPlan === 'RADIAL_POLYPOID' || f.bodyPlan === 'PLASMA_FILAMENT') {
        // Floating Polypoid / Plasma Ribbon
        ctx.save();
        ctx.strokeStyle = f.glowColor || f.color;
        ctx.lineWidth = 1.8;
        for (let t = -1; t <= 1; t++) {
          const wave = Math.sin(f.legPhase + t) * 4;
          ctx.beginPath();
          ctx.moveTo(-4, t * 4);
          ctx.quadraticCurveTo(-11, t * 6 + wave, -17, t * 4 - wave);
          ctx.stroke();
        }
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(2, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (f.speciesClass === 'GRAZER') {
        // Docile Grazer
        const legOff1 = Math.sin(f.legPhase) * 4;
        const legOff2 = Math.cos(f.legPhase) * 4;
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, -6);
        ctx.lineTo(8 + legOff1, -12);
        ctx.moveTo(4, 6);
        ctx.lineTo(8 + legOff2, 12);
        ctx.moveTo(-6, -6);
        ctx.lineTo(-10 - legOff2, -12);
        ctx.moveTo(-6, 6);
        ctx.lineTo(-10 - legOff1, 12);
        ctx.stroke();

        ctx.save();
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#86efac';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = '#d9f99d';
        ctx.beginPath();
        ctx.arc(2, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Standard Carnivore
        ctx.save();
        ctx.fillStyle = f.color;
        ctx.strokeStyle = '#fda4af';
        ctx.lineWidth = 1.5;

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

        const bitePulse = f.state === 'CHARGE' ? Math.sin(Date.now() * 0.02) * 3 : 0;
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, -4);
        ctx.lineTo(16, -6 + bitePulse);
        ctx.moveTo(8, 4);
        ctx.lineTo(16, 6 - bitePulse);
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(6, -3, 1.5, 0, Math.PI * 2);
        ctx.arc(6, 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();

      // Species Nameplate & Multi-Hit Stun Resistance Meter
      ctx.save();
      const nameY = f.isApex ? f.y + 26 : f.y + 18;
      ctx.fillStyle = f.isApex ? '#ec4899' : (f.speciesClass === 'CARNIVORE' ? '#f87171' : '#4ade80');
      ctx.font = f.isApex ? 'bold 9px monospace' : '8px monospace';
      ctx.textAlign = 'center';
      const crown = f.isApex ? '👑 ' : '';
      ctx.fillText(`${crown}${f.name.toUpperCase()}`, f.x, nameY);

      if (f.isApex && f.state !== 'STUNNED') {
        const req = f.stunHitsRequired || 3;
        const cur = f.currentStunHits || 0;
        let pips = '';
        for (let i = 0; i < req; i++) {
          pips += i < cur ? '● ' : '○ ';
        }
        ctx.font = '8px monospace';
        ctx.fillStyle = f.isEnraged ? '#ef4444' : '#38bdf8';
        ctx.fillText(`STUN RESIST: [ ${pips}]`, f.x, nameY + 11);
      }
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

    // End Camera-Zoomed World Context
    ctx.restore();

    // 8. Screen-Space HUD: Topography Scanner Coordinates & Dynamic Zoom
    ctx.save();
    ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.font = '10px monospace';
    const hdgDeg = Math.round(((s.heading * 180) / Math.PI + 360) % 360);
    const zoomPct = Math.round(this.currentZoom * 100);
    ctx.fillText(`HDG: ${hdgDeg}° // VEL: ${spd.toFixed(1)} m/s // ZOOM: ${zoomPct}% // EXPEDITION MK-IV`, 16, 22);

    if (this.isLanderFlamedOut) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ ENGINE FLAMEOUT // CORE TEMPERATURE CRITICAL // RESTARTING...', w / 2, 22);
    }
    ctx.restore();

    // 9. Day 30: Screen-Space Surface Tactical Mini-Radar HUD (Top Right Corner)
    const radarCx = w - 62;
    const radarCy = 62;
    const radarR = 46;
    const radarWorldRange = 420;

    ctx.save();
    // Dark CRT Radar Screen
    ctx.beginPath();
    ctx.arc(radarCx, radarCy, radarR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(4, 13, 26, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner Range Ring
    ctx.beginPath();
    ctx.arc(radarCx, radarCy, radarR * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
    ctx.stroke();

    // Crosshairs
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.16)';
    ctx.beginPath();
    ctx.moveTo(radarCx - radarR, radarCy);
    ctx.lineTo(radarCx + radarR, radarCy);
    ctx.moveTo(radarCx, radarCy - radarR);
    ctx.lineTo(radarCx, radarCy + radarR);
    ctx.stroke();

    // Sweeping Radar Beam
    const sweepAngle = (Date.now() * 0.003) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(radarCx, radarCy);
    ctx.lineTo(radarCx + Math.cos(sweepAngle) * radarR, radarCy + Math.sin(sweepAngle) * radarR);
    ctx.stroke();

    // Blip Plotter
    const plotBlip = (wx: number, wy: number, color: string, radius: number = 2.5, isDiamond: boolean = false) => {
      const dx = wx - s.x;
      const dy = wy - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= radarWorldRange) {
        const factor = radarR / radarWorldRange;
        const bx = radarCx + dx * factor;
        const by = radarCy + dy * factor;
        ctx.fillStyle = color;
        ctx.beginPath();
        if (isDiamond) {
          ctx.moveTo(bx, by - 3.5);
          ctx.lineTo(bx + 3.5, by);
          ctx.lineTo(bx, by + 3.5);
          ctx.lineTo(bx - 3.5, by);
          ctx.closePath();
        } else {
          ctx.arc(bx, by, radius, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    };

    // Plot Rendezvous Stash Beacon (landing origin 380, 240)
    plotBlip(380, 240, '#38bdf8', 3.5, true);

    // Plot Minerals
    this.landerNodes.forEach((node) => {
      if (node.type === 'MINERAL' && !node.collected && node.discovered) {
        plotBlip(node.x, node.y, '#fbbf24', 2.0);
      }
    });

    // Plot Megastructures
    this.landerNodes.forEach((node) => {
      if (node.type === 'MEGASTRUCTURE') {
        plotBlip(node.x, node.y, '#00f0ff', 3.0, true);
      }
    });

    // Plot Geological Hazards
    this.landerLavaGeysers.forEach((g) => plotBlip(g.x, g.y, '#f97316', 2.5));
    this.landerAcidPools.forEach((a) => plotBlip(a.x, a.y, '#84cc16', 2.5));
    this.landerIonStorms.forEach((i) => plotBlip(i.x, i.y, '#c084fc', 3.0));

    // Plot Fauna & Titans
    this.landerFauna.forEach((f) => {
      if (f.collected) return;
      if (f.isApex) {
        plotBlip(f.x, f.y, f.isEnraged ? '#ef4444' : '#ec4899', 4.5, true);
        if (f.lairX != null && f.lairY != null) {
          plotBlip(f.lairX, f.lairY, '#f43f5e', 3.0, true);
        }
      } else if (f.speciesClass === 'CARNIVORE') {
        plotBlip(f.x, f.y, '#f87171', 2.5);
      } else {
        plotBlip(f.x, f.y, '#4ade80', 2.5);
      }
    });

    // Center player lander indicator (white arrow pointing heading)
    ctx.save();
    ctx.translate(radarCx, radarCy);
    ctx.rotate(s.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-3.5, -3);
    ctx.lineTo(-3.5, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Radar Header Label
    ctx.fillStyle = '#38bdf8';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MINI-RADAR', radarCx, radarCy - radarR - 4);
    ctx.restore();

    // Restore shake translation
    ctx.restore();
  }

  /**
   * Milestone 1.6: Locks embarked crew onto server expedition session, updates tier stats & [1]-[4] abilities.
   */
  private async syncDeploySessionWithCrew(planetId: string, crewIds: string[]): Promise<void> {
    try {
      const res = await fetch(`/api/planets/${planetId}/lander/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: 'acc_sol_captain', crewIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.session) {
        this.callbacks.showApNotification(`⚠️ Deploy blocked: ${data.error || 'Chassis unavailable'}`, true);
        this.closeSurfaceLander();
        return;
      }

      const sess = data.session;
      const lander = sess.lander || {};
      this.embarkedCrew = Array.isArray(sess.embarkedCrew) ? sess.embarkedCrew : [];
      this.landerCrewEffects = sess.crewEffects ? { ...DEFAULT_CREW_EFFECTS, ...sess.crewEffects } : { ...DEFAULT_CREW_EFFECTS };

      this.landerState.hull = Number(lander.hull ?? this.landerState.hull);
      this.landerState.maxHull = Number(lander.maxHull ?? this.landerState.maxHull);
      this.landerState.fuel = Number(lander.fuel ?? this.landerState.fuel);
      this.landerState.maxFuel = Number(lander.maxFuel ?? this.landerState.maxFuel);
      this.landerState.maxCargo = Number(lander.cargoCapacity ?? this.landerState.maxCargo);
      this.landerFittedModules = lander.fittedModules || {};

      // Auto-discover Precursor vaults if Historian / Linguist / Archaeologist / Navigator aboard
      if (this.landerCrewEffects.precursorBonusEnabled) {
        this.landerNodes.forEach((n) => {
          if (n.type === 'MEGASTRUCTURE') n.discovered = true;
        });
        this.refreshLanderRadarList();
      }

      this.renderCrewRosterHUD(lander.name, lander.tier);
      this.renderCrewAbilitiesHUD();
      this.updateLanderTelemetryUI();

      if (this.embarkedCrew.length > 0) {
        this.callbacks.showApNotification(
          `👥 Crew embarked (${this.embarkedCrew.length}): ${this.embarkedCrew.map((c) => `${c.callsign} [${c.primarySpecialty}]`).join(', ')}`,
          false
        );
      }
    } catch (err) {
      console.warn('[LANDER] Deploy crew sync failed:', err);
      this.renderCrewRosterHUD();
      this.renderCrewAbilitiesHUD();
    }
  }

  private renderCrewRosterHUD(landerName?: string, tier?: number): void {
    const elPills = document.getElementById('lander-crew-roster-pills');
    if (!elPills) return;
    const tierBadge = tier ? `<span class="lander-crew-pill">🚀 MK.${tier} ${landerName || ''}</span>` : '';
    const crewBadges = this.embarkedCrew
      .map((c) => `<span class="lander-crew-pill" title="APT ${c.aptitude} / GRIT ${c.grit}">${c.callsign} [${c.primarySpecialty}]</span>`)
      .join('');
    elPills.innerHTML = tierBadge + (crewBadges || `<span class="lander-crew-pill">SOLO PILOT</span>`);
  }

  private renderCrewAbilitiesHUD(): void {
    const bar = document.getElementById('lander-crew-abilities-bar');
    if (!bar) return;
    const abilities = this.landerCrewEffects.activeAbilities || [];
    if (abilities.length === 0) {
      bar.innerHTML = `<span class="lander-crew-pill">NO ACTIVE CREW ABILITIES (EMBARK SPECIALISTS BEFORE DROP)</span>`;
      return;
    }

    bar.innerHTML = abilities
      .map(
        (ab) => `
        <button class="lander-ability-btn" data-ability-slot="${ab.slotIndex}" title="${ab.description} (Crew: ${ab.grantedByName})">
          <span class="lander-ability-key">[${ab.slotIndex}]</span>
          <span>${ab.icon} ${ab.name}</span>
          <span class="lander-ability-cd">READY</span>
        </button>
      `
      )
      .join('');

    bar.querySelectorAll('.lander-ability-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = Number((btn as HTMLElement).getAttribute('data-ability-slot') || 0);
        if (slot >= 1 && slot <= 4) {
          this.triggerCrewAbility(slot);
        }
      });
    });
  }

  /**
   * Executes hotkeyed [1]–[4] crew active abilities during surface exploration.
   */
  public triggerCrewAbility(slotIndex: number): void {
    if (!this.isLanderActive || this.isLanderDestroyed) return;
    const ability = this.landerCrewEffects.activeAbilities.find((a) => a.slotIndex === slotIndex);
    if (!ability) return;

    const now = Date.now();
    const until = this.abilityCooldownsUntil[slotIndex] || 0;
    if (until > now) {
      const rem = Math.ceil((until - now) / 1000);
      this.callbacks.showApNotification(`⏳ ${ability.name} recharging (${rem}s remaining).`, true);
      return;
    }

    this.abilityCooldownsUntil[slotIndex] = now + ability.cooldownSec * 1000;
    const s = this.landerState;
    this.audio.playUiBlip();

    switch (ability.abilityId) {
      case 'ARC_SHOCKWAVE': {
        let stunnedCount = 0;
        this.landerFauna.forEach((f) => {
          if (!f.collected && Math.hypot(f.x - s.x, f.y - s.y) <= 175) {
            f.state = 'STUNNED';
            f.stunTimer = Math.round(8 * (this.landerCrewEffects.stunDurationMult || 1));
            f.vx = 0;
            f.vy = 0;
            stunnedCount++;
          }
        });
        this.landerSonarWaves.push({ x: s.x, y: s.y, radius: 12, maxRadius: 180, alpha: 1.0 });
        this.refreshLanderRadarList();
        this.callbacks.showApNotification(`⚡ ARC SHOCKWAVE (${ability.grantedByName}): ${stunnedCount} nearby fauna stunned for 8s!`, false);
        break;
      }
      case 'SEISMIC_VEIN_CRACKER': {
        this.landerSonarWaves.push({ x: s.x, y: s.y, radius: 15, maxRadius: 680, alpha: 1.0 });
        let bonusMinerals = 0;
        this.landerNodes.forEach((n) => {
          n.discovered = true;
          if (n.type === 'MINERAL' && !n.collected) {
            n.amount = Math.ceil((n.amount || 5) * 1.15);
            bonusMinerals++;
          }
        });
        this.landerFauna.forEach((f) => {
          f.discovered = true;
        });
        this.refreshLanderRadarList();
        this.callbacks.showApNotification(`⛏️ SEISMIC VEIN CRACKER (${ability.grantedByName}): Deep sonar mapped arena & enriched ${bonusMinerals} veins (+15%)!`, false);
        break;
      }
      case 'NANO_GEL_PATCH': {
        s.hull = Math.min(s.maxHull, s.hull + 32);
        this.landerTemp = Math.max(0, this.landerTemp - 45);
        this.causticSealTimer = 8.0;
        this.callbacks.showApNotification(`💉 NANO-GEL PATCH (${ability.grantedByName}): +32 Hull repaired, -45°C heat vented, 8s Caustic Seal!`, false);
        break;
      }
      case 'OVERLOAD_CAPACITOR': {
        this.isLanderFlamedOut = false;
        this.landerFlameoutTimer = 0;
        this.landerTemp = Math.max(0, this.landerTemp - 25);
        s.hull = Math.min(s.maxHull, s.hull + 18);
        this.landerNodes.forEach((n) => {
          if (n.type === 'MEGASTRUCTURE') n.discovered = true;
        });
        this.refreshLanderRadarList();
        this.callbacks.showApNotification(`🔧 OVERLOAD CAPACITOR (${ability.grantedByName}): Flameout cleared, +18 Hull & Precursor vaults pinged!`, false);
        break;
      }
      case 'AFTERBURNER_SURGE': {
        this.afterburnerTimer = 7.0;
        this.callbacks.showApNotification(`🚀 AFTERBURNER SURGE (${ability.grantedByName}): +75% thrust speed & zero fuel burn for 7s!`, false);
        break;
      }
    }

    this.updateLanderTelemetryUI();
  }
}
