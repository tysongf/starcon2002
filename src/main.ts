import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ProceduralHullGenerator, type HullGenerationResult } from './procgen/ProceduralHullGenerator';
import { type FactionStyle, FACTION_STYLES } from './procgen/FactionStyles';
import { ShipFlightController, type FlightTelemetry } from './physics/ShipFlightController';
import { ThrusterParticleSystem } from './vfx/ThrusterParticleSystem';
import { SpaceStation } from './entities/SpaceStation';
import { AsteroidField } from './entities/AsteroidField';
import { type DockingStatus } from './entities/DockingZone';
import { AudioEngine } from './audio/AudioEngine';
import { ShieldBubble, CombatVfxSystem } from './vfx/CombatVfxSystem';
import { ProceduralPlanet, type PlanetData } from './entities/ProceduralPlanet';

class GameEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  // Flight Physics & Systems
  private flightController: ShipFlightController;
  private thrusters: ThrusterParticleSystem;
  private station: SpaceStation | null = null;
  private asteroidField: AsteroidField | null = null;
  private audio: AudioEngine;
  private cameraMode: 'CHASE' | 'ORBIT' = 'CHASE';
  private isDocked: boolean = false;
  private isInOrbit: boolean = false;

  // Day 18: Planetary Orbital Survey & Probes
  private activePlanet: ProceduralPlanet | null = null;
  private activePlanetDetail: any = null;
  private modalPlanetarySurvey: HTMLElement | null = null;
  private elOrbitalBanner: HTMLElement | null = null;
  private elOrbitalMsg: HTMLElement | null = null;
  private globeCanvas: HTMLCanvasElement | null = null;
  private globeCtx: CanvasRenderingContext2D | null = null;
  private globeRotY: number = 0;
  private globeRotX: number = 0.2;
  private globeIsDragging: boolean = false;
  private globeDragLastX: number = 0;
  private globeDragLastY: number = 0;
  private globeAnimId: number | null = null;
  private targetedLat: number = 0;
  private targetedLng: number = 0;
  private hoveredHotspot: any = null;

  // Navigation & Sector Jump System (Day 8)
  private currentSectorId: number = 1;
  private currentSectorName: string = 'Sol-Perimeter Nexus';
  private adjacentSectors: Array<{
    id: number;
    name: string;
    system_seed: number;
    controlling_faction: string;
    connected_sectors: number[];
  }> = [];
  private shipFuel: number = 100;
  private maxShipFuel: number = 100;
  private isWarping: boolean = false;
  private warpAnimationTime: number = 0;
  private baseFov: number = 52;

  // Nav DOM Elements
  private modalNav: HTMLElement | null = null;
  private btnOpenNav: HTMLElement | null = null;
  private btnCloseNav: HTMLElement | null = null;
  private navLanesList: HTMLElement | null = null;
  private navCurrentSectorTitle: HTMLElement | null = null;
  private navCurrentSectorSubtext: HTMLElement | null = null;
  private navFuelDisplay: HTMLElement | null = null;
  private hudSector: HTMLElement | null = null;

  // Scene entities
  private ambientLight: THREE.AmbientLight;
  private starLight: THREE.DirectionalLight;
  private sectorGrid: THREE.GridHelper;
  private starfield: THREE.Points;

  // Active Ship Mesh & Material
  private shipMesh: THREE.Mesh | null = null;
  private shipMaterial: THREE.MeshStandardMaterial;
  private currentSeed: number = 12345;
  private currentFaction: FactionStyle = FACTION_STYLES.FACTION_SOL;

  // Diagnostics & Telemetry
  private lastTime: number = performance.now();
  private frameCount: number = 0;
  private fpsTimer: number = 0;
  private currentFps: number = 60;

  // DOM Elements
  private elFps: HTMLElement | null = null;
  private elDrawCalls: HTMLElement | null = null;
  private elSpeed: HTMLElement | null = null;
  private elHeading: HTMLElement | null = null;
  private elDampeners: HTMLElement | null = null;
  private elShipPos: HTMLElement | null = null;
  private elCamMode: HTMLElement | null = null;
  private elHullTris: HTMLElement | null = null;
  private elHullVerts: HTMLElement | null = null;
  private elGrammarStyle: HTMLElement | null = null;
  private elFactionDesc: HTMLElement | null = null;
  private elDockingBanner: HTMLElement | null = null;
  private elDockingMsg: HTMLElement | null = null;
  private selectFaction: HTMLSelectElement | null = null;
  private swatchPri: HTMLElement | null = null;
  private swatchSec: HTMLElement | null = null;
  private swatchGlow: HTMLElement | null = null;
  private inputSeed: HTMLInputElement | null = null;
  private btnToggleCam: HTMLElement | null = null;
  private btnToggleDamp: HTMLElement | null = null;

  // Modal DOM Elements
  private modalDock: HTMLElement | null = null;
  private modalStationName: HTMLElement | null = null;
  private modalOfficerQuote: HTMLElement | null = null;
  private modalMarketExchange: HTMLElement | null = null;
  private elBackendBadge: HTMLElement | null = null;
  private btnUndock: HTMLElement | null = null;
  private btnQuickService: HTMLElement | null = null;

  // Economy & Cargo Hold (Day 9)
  private playerCredits: number = 2500;
  private playerCargoCapacity: number = 40;
  private playerUsedCargo: number = 0;
  private playerCargoHold: Array<{ commodity_id: string; name: string; quantity: number }> = [];
  private currentMarketPortId: string | null = null;
  private currentMarketItems: any[] = [];

  // Market & Trade DOM Elements
  private elTelemetryCredits: HTMLElement | null = null;
  private elTelemetryCargo: HTMLElement | null = null;
  private modalMarketPlayerCredits: HTMLElement | null = null;
  private modalMarketPlayerCargo: HTMLElement | null = null;
  private modalCargoDisplay: HTMLElement | null = null;
  private marketToast: HTMLElement | null = null;
  private marketToastTimer: number | null = null;

  // Milestone 0.2 Economic Arbitrage & Sector Intel
  private initialSessionCredits: number = 2500;
  private hasInitialCreditsSet: boolean = false;
  private sessionArbitrageProfit: number = 0;
  private elTelemetryNetWorth: HTMLElement | null = null;
  private elTelemetryProfit: HTMLElement | null = null;
  private navRadarRoutes: HTMLElement | null = null;
  private modalOfficerAvatar: HTMLElement | null = null;
  private modalOfficerName: HTMLElement | null = null;
  private modalDockBadge: HTMLElement | null = null;
  private modalDockSubtext: HTMLElement | null = null;
  private hasInitialSceneLoaded: boolean = false;

  // Milestone 0.3 Authoritative 20Hz Combat & AI Entities
  private combatSocket: WebSocket | null = null;
  private combatInputs: {
    forward: boolean;
    reverse: boolean;
    turnLeft: boolean;
    turnRight: boolean;
    brake: boolean;
    firePrimary: boolean;
    fireTactical: boolean;
    activeWeaponId: 'PULSE' | 'PLASMA' | 'FLAK';
  } = {
    forward: false,
    reverse: false,
    turnLeft: false,
    turnRight: false,
    brake: false,
    firePrimary: false,
    fireTactical: false,
    activeWeaponId: 'PULSE',
  };

  // Day 12 Weapon Profiles & Combat VFX
  private activeWeaponIndex: number = 0;
  private readonly weaponProfiles: Array<{ id: 'PULSE' | 'PLASMA' | 'FLAK'; name: string; color: string }> = [
    { id: 'PULSE', name: 'LIGHT PULSE CANNON', color: '#00f0ff' },
    { id: 'PLASMA', name: 'HEAVY PLASMA ACCELERATOR', color: '#10b981' },
    { id: 'FLAK', name: 'SCATTER FLAK BLASTER', color: '#fbbf24' },
  ];
  private combatVfx!: CombatVfxSystem;
  private playerShieldBubble!: ShieldBubble;
  private droneShieldBubbles: Map<string, ShieldBubble> = new Map();
  private lastPlayerShields: number = 100;
  private lastPlayerMaxShields: number = 100;

  private droneMeshes: Map<string, THREE.Mesh> = new Map();
  private projectileMeshes: Map<string, THREE.Mesh> = new Map();
  private projectileGeom = new THREE.CylinderGeometry(0.16, 0.16, 2.0, 6);
  private projectileSphereGeom = new THREE.SphereGeometry(0.42, 8, 8);
  private projectileFlakGeom = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 5);
  private projectileMatCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  private projectileMatRed = new THREE.MeshBasicMaterial({ color: 0xff2a5f });
  private projectileMatEmerald = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  private projectileMatAmber = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

  private elTelemetryShields: HTMLElement | null = null;
  private elTelemetryHull: HTMLElement | null = null;
  private elTelemetryEnergy: HTMLElement | null = null;
  private elTelemetryCombat: HTMLElement | null = null;
  private elActiveWeapon: HTMLElement | null = null;
  private elTacticalModule: HTMLElement | null = null;
  private elTacticalReticle: HTMLElement | null = null;
  private elReticleName: HTMLElement | null = null;
  private elReticleShieldFill: HTMLElement | null = null;
  private elReticleHullFill: HTMLElement | null = null;
  private elReticleRange: HTMLElement | null = null;
  private primaryDroneTarget: { id: string; x: number; z: number; hp: number; maxHp: number; shields: number; maxShields: number; name: string; faction?: string } | null = null;

  // MMORPG Ability Hotbar & Stacked Vitals (Day 12 / Milestone 0.3)
  private elVitalShieldBar: HTMLElement | null = null;
  private elVitalShieldText: HTMLElement | null = null;
  private elVitalHullBar: HTMLElement | null = null;
  private elVitalHullText: HTMLElement | null = null;
  private elVitalEnergyBar: HTMLElement | null = null;
  private elVitalEnergyText: HTMLElement | null = null;
  private elSlotHigh1: HTMLElement | null = null;
  private elSlotHigh2: HTMLElement | null = null;
  private elSlotMid1: HTMLElement | null = null;
  private elSlotMid2: HTMLElement | null = null;
  private elCdHigh1: HTMLElement | null = null;
  private elCdHigh2: HTMLElement | null = null;
  private elCdMid1: HTMLElement | null = null;
  private elCdMid2: HTMLElement | null = null;
  private elTargetTelemetryHud: HTMLElement | null = null;
  private elTargetName: HTMLElement | null = null;
  private elTargetFaction: HTMLElement | null = null;
  private elTargetDistance: HTMLElement | null = null;
  private elTargetShieldBar: HTMLElement | null = null;
  private elTargetShieldVal: HTMLElement | null = null;
  private elTargetHullBar: HTMLElement | null = null;
  private elTargetHullVal: HTMLElement | null = null;

  private lastFireTimes = {
    PULSE: 0,
    PLASMA: 0,
    FLAK: 0,
    BOOST: 0,
  };
  private targetLockIndex: number = 0;
  private availableDrones: any[] = [];

  // Action Point (AP) System (Day 7)
  private playerAP = {
    playerId: 'acc_sol_captain',
    currentAP: 600,
    maxAP: 600,
    lastRegenAt: Date.now(),
    nextRegenSeconds: 0,
  };
  private apCountdownTimer: number = 0;
  private apSyncTimer: number = 0;
  private notificationTimeout: number | null = null;

  // AP DOM Elements
  private elApGauge: HTMLElement | null = null;
  private elApCounter: HTMLElement | null = null;
  private elApTimer: HTMLElement | null = null;
  private elApFill: HTMLElement | null = null;
  private elApTelemetry: HTMLElement | null = null;
  private elApRegenTelemetry: HTMLElement | null = null;
  private modalApDisplay: HTMLElement | null = null;
  private btnApWarp: HTMLElement | null = null;
  private btnApScan: HTMLElement | null = null;
  private btnApExtract: HTMLElement | null = null;
  private btnDockHaggle: HTMLElement | null = null;
  private elApNotification: HTMLElement | null = null;

  // Day 13: Station Service Tabs & Outfitting Bay DOM
  private tabBtnExchange: HTMLElement | null = null;
  private tabBtnOutfitting: HTMLElement | null = null;
  private tabBtnArmory: HTMLElement | null = null;
  private viewTabExchange: HTMLElement | null = null;
  private viewTabOutfitting: HTMLElement | null = null;
  private viewTabArmory: HTMLElement | null = null;
  private activeStationTab: 'exchange' | 'outfitting' | 'armory' | 'contracts' = 'exchange';

  private valFittingPg: HTMLElement | null = null;
  private valFittingCpu: HTMLElement | null = null;
  private barFittingPg: HTMLElement | null = null;
  private barFittingCpu: HTMLElement | null = null;
  private fittingOverbudgetAlert: HTMLElement | null = null;
  private paperdollSlotsList: HTMLElement | null = null;
  private lockerModulesList: HTMLElement | null = null;
  private lockerItemCount: HTMLElement | null = null;
  private isLoadoutOverBudget: boolean = false;
  private playerLoadout: any = null;

  private elArmoryCatalogGrid: HTMLElement | null = null;
  private elArmoryPlayerCredits: HTMLElement | null = null;
  private equipmentCatalog: any[] = [];

  // Day 13: Floating Cargo Canisters & Loot Modal DOM
  private elLootPromptHud: HTMLElement | null = null;
  private elLootPromptText: HTMLElement | null = null;
  private modalContainerLoot: HTMLElement | null = null;
  private modalLootRarity: HTMLElement | null = null;
  private modalLootTitle: HTMLElement | null = null;
  private elLootDistanceDisplay: HTMLElement | null = null;
  private elLootItemCount: HTMLElement | null = null;
  private elLootItemsList: HTMLElement | null = null;
  private btnCloseLoot: HTMLElement | null = null;
  private btnLootAll: HTMLElement | null = null;

  private containerMeshes: Map<string, THREE.Group> = new Map();
  private activeLootContainers: Map<string, any> = new Map();
  private targetedContainerId: string | null = null;
  private activeLootModalContainer: any = null;

  // Day 14: Hardcore Death Loop, Escape Pod & Revenge Contracts
  private elEscapePodHud: HTMLElement | null = null;
  private elPodTimerClock: HTMLElement | null = null;
  private modalKillmail: HTMLElement | null = null;
  private elKmTimestamp: HTMLElement | null = null;
  private elKmLossValuation: HTMLElement | null = null;
  private elKmKillerName: HTMLElement | null = null;
  private elKmSectorName: HTMLElement | null = null;
  private elKmTotalLoss: HTMLElement | null = null;
  private elKmDroppedSummary: HTMLElement | null = null;
  private btnPostBounty: HTMLElement | null = null;
  private elKmShareRow: HTMLElement | null = null;
  private elKmShareUrl: HTMLInputElement | null = null;
  private btnCopyKmUrl: HTMLElement | null = null;
  private elKmCopyToast: HTMLElement | null = null;
  private btnCloseKm: HTMLElement | null = null;
  private selectedBountyAmount: number = 1000;
  private activeKillmailData: any = null;

  private modalClinicRescue: HTMLElement | null = null;
  private btnClaimFrigate: HTMLElement | null = null;

  private tabBtnContracts: HTMLElement | null = null;
  private viewTabContracts: HTMLElement | null = null;
  private elContractsActiveList: HTMLElement | null = null;
  private elContractsActiveCount: HTMLElement | null = null;
  private elKillmailsArchiveList: HTMLElement | null = null;
  private elKillmailsCount: HTMLElement | null = null;
  private elContractsPlayerCredits: HTMLElement | null = null;

  // Day 15: Persistent Ship Wrecks, Laser Mining, Elastic Towing & Salvage Bay
  private tabBtnSalvage: HTMLElement | null = null;
  private viewTabSalvage: HTMLElement | null = null;
  private elSalvagePlayerCredits: HTMLElement | null = null;
  private elSalvageTetherStatus: HTMLElement | null = null;
  private elSalvageEmptyCard: HTMLElement | null = null;
  private elSalvageWreckCard: HTMLElement | null = null;
  private elSalvageWreckFaction: HTMLElement | null = null;
  private elSalvageWreckTitle: HTMLElement | null = null;
  private elSalvageWreckClass: HTMLElement | null = null;
  private elSalvageWreckScrap: HTMLElement | null = null;
  private elSalvageWreckIntactness: HTMLElement | null = null;
  private elSalvageWreckVal: HTMLElement | null = null;
  private btnDismantleWreck: HTMLElement | null = null;
  private btnRefurbishWreck: HTMLElement | null = null;
  private elSalvageDerelictsList: HTMLElement | null = null;
  private elSalvageSweepCount: HTMLElement | null = null;

  // Flight HUD & Tow Cable
  private elTargetQuickActions: HTMLElement | null = null;
  private btnHudSalvageBeam: HTMLElement | null = null;
  private btnHudTetherWreck: HTMLElement | null = null;
  private elTowCableHud: HTMLElement | null = null;
  private elTowTargetName: HTMLElement | null = null;
  private elTowDistMetric: HTMLElement | null = null;
  private elTowTensionBadge: HTMLElement | null = null;
  private btnHudReleaseTow: HTMLElement | null = null;

  private wreckMeshes: Map<string, THREE.Group> = new Map();
  private activeWrecks: Map<string, any> = new Map();
  private towCableMesh: THREE.Line | null = null;
  private salvageBeamMesh: THREE.Group | null = null;
  private isMiningLaserActive: boolean = false;
  private currentTowedWreckId: string | null = null;
  private targetedWreckId: string | null = null;
  private tetheredStationWreck: any = null;

  // Day 16: Star Control II Alien Comms & Diplomacy Properties
  private tabBtnDiplomacy: HTMLElement | null = null;
  private viewTabDiplomacy: HTMLElement | null = null;
  private elDiplomacyEnvoysList: HTMLElement | null = null;
  private elDiplomacyEnvoysCount: HTMLElement | null = null;
  private btnHudHailTarget: HTMLElement | null = null;

  private elAlienCommsModal: HTMLElement | null = null;
  private elAlienCommsSpeakerName: HTMLElement | null = null;
  private elAlienCommsSpeakerTitle: HTMLElement | null = null;
  private elAlienCommsMoodBadge: HTMLElement | null = null;
  private elAlienCommsSpeciesLabel: HTMLElement | null = null;
  private elAlienCommsCrestIcon: HTMLElement | null = null;
  private elAlienCommsCrestLabel: HTMLElement | null = null;
  private elAlienCommsDialogueSpeaker: HTMLElement | null = null;
  private elAlienCommsDialogueText: HTMLElement | null = null;
  private elAlienCommsOptionsList: HTMLElement | null = null;
  private elAlienPortraitCanvas: HTMLCanvasElement | null = null;
  private elCommsWaveformCanvas: HTMLCanvasElement | null = null;
  private elBtnCloseAlienComms: HTMLButtonElement | null = null;

  private currentAlienNpcId: string | null = null;
  private currentAlienSpecies: string = 'VAELIC';
  private currentAlienMood: string = 'AGGRESSIVE';
  private alienPortraitAnimId: number | null = null;
  private commsWaveformAnimId: number | null = null;
  private alienTypewriterTimer: any = null;
  private isAlienSpeaking: boolean = false;
  private alienCurrentOptions: any[] = [];
  private alienPortraitTime: number = 0;

  // Day 17: Faction Reputation Matrix & Diplomatic Ceasefire Truces
  private elFactionDossierList: HTMLElement | null = null;
  private elHudFactionBadge: HTMLElement | null = null;
  private elHudFactionCrest: HTMLElement | null = null;
  private elHudFactionName: HTMLElement | null = null;
  private elHudFactionStandingTier: HTMLElement | null = null;
  private elHudTruceTimerPill: HTMLElement | null = null;
  private activeTruceExpiresAt: number | null = null;
  private truceTimerInterval: any = null;
  private playerStandings: any[] = [];

  public isEscapePod: boolean = false;

  private lastKlaxonTime: number = 0;
  private escapePodMesh: THREE.Group | null = null;
  private scavengerMeshes: Map<string, THREE.Group> = new Map();

  // Camera tracking vectors
  private currentLookTarget = new THREE.Vector3(0, 0, 0);

  constructor() {
    this.canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Canvas element #webgl-canvas not found.');
    }

    // 1. Initialize Web Audio Synthesizer
    this.audio = new AudioEngine();

    // 2. Initialize WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // 3. Initialize Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06080d);
    this.scene.fog = new THREE.FogExp2(0x06080d, 0.0022);

    // 4. Initialize Perspective Camera
    this.camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      0.1,
      1200
    );
    this.camera.position.set(0, 16, -22);

    // 5. Initialize Orbit Controls (used in ORBIT mode)
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 250;
    this.controls.enabled = false; // Starts in CHASE mode

    // 6. Lighting Setup
    this.ambientLight = new THREE.AmbientLight(0x28334a, 1.4);
    this.scene.add(this.ambientLight);

    this.starLight = new THREE.DirectionalLight(0xfff5eb, 2.3);
    this.starLight.position.set(40, 60, 30);
    this.scene.add(this.starLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.95);
    fillLight.position.set(-40, -15, -25);
    this.scene.add(fillLight);

    const bounceLight = new THREE.DirectionalLight(0x1e293b, 0.8);
    bounceLight.position.set(0, -20, 0);
    this.scene.add(bounceLight);

    // 7. Tactical Sector Grid (X/Z plane)
    this.sectorGrid = new THREE.GridHelper(160, 80, 0x38bdf8, 0x141e2e);
    this.sectorGrid.position.y = -0.05;
    this.scene.add(this.sectorGrid);

    // 8. Background Starfield
    this.starfield = this.createStarfield(1600);
    this.scene.add(this.starfield);

    // 9. Procedural Orbital Space Station at Origin
    this.station = new SpaceStation({
      stationId: 'STATION_AEGIS_01',
      name: 'AEGIS TERMINAL',
      portClass: 1,
      factionId: 'FACTION_SOL',
      position: new THREE.Vector3(0, 0, 0),
    });
    this.scene.add(this.station.group);

    // 10. Flight Physics & Thruster VFX (Starts docked inside station landing deck)
    this.flightController = new ShipFlightController(new THREE.Vector3(0, 0, 0), 0);
    this.thrusters = new ThrusterParticleSystem();
    this.thrusters.setGlowColor(this.currentFaction.palette.engineGlow);
    this.scene.add(this.thrusters.mesh);

    // 10b. Combat VFX & 3D Forcefield Shield Bubble (Day 12)
    this.combatVfx = new CombatVfxSystem();
    this.scene.add(this.combatVfx.mesh);

    this.playerShieldBubble = new ShieldBubble(4.4, false);
    this.scene.add(this.playerShieldBubble.mesh);

    // 11. Shared Ship Material
    this.shipMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: this.currentFaction.materials.roughness,
      metalness: this.currentFaction.materials.metalness,
      flatShading: true,
    });

    // 12. Cache Telemetry & Modal DOM references
    this.cacheTelemetryElements();

    // 13. Generate Initial Ship Hull
    this.generateShip(this.currentSeed, this.currentFaction);

    // 14. Setup Event Listeners
    this.setupEventListeners();

    // 15. Start Animation & Physics Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  public generateShip(seed: number, faction?: FactionStyle): void {
    this.currentSeed = seed;
    if (faction) {
      this.currentFaction = faction;
    }

    this.shipMaterial.roughness = this.currentFaction.materials.roughness;
    this.shipMaterial.metalness = this.currentFaction.materials.metalness;
    this.shipMaterial.needsUpdate = true;
    this.thrusters.setGlowColor(this.currentFaction.palette.engineGlow);

    if (this.shipMesh) {
      this.scene.remove(this.shipMesh);
      this.shipMesh.geometry.dispose();
      this.shipMesh = null;
    }

    const result: HullGenerationResult = ProceduralHullGenerator.generate({
      seed: this.currentSeed,
      faction: this.currentFaction,
    });

    this.shipMesh = new THREE.Mesh(result.geometry, this.shipMaterial);
    this.shipMesh.position.copy(this.flightController.position);
    this.shipMesh.rotation.y = this.flightController.yaw;
    this.scene.add(this.shipMesh);

    // Update UI Readouts
    if (this.elHullTris) this.elHullTris.textContent = `${result.triangleCount}`;
    if (this.elHullVerts) this.elHullVerts.textContent = `${result.vertexCount}`;
    if (this.inputSeed) this.inputSeed.value = `${this.currentSeed}`;
    if (this.selectFaction) this.selectFaction.value = this.currentFaction.id;
    if (this.elFactionDesc) this.elFactionDesc.textContent = this.currentFaction.culturalSummary;
    if (this.elGrammarStyle) {
      const grammarName = this.currentFaction.shapeGrammar.replace('_', ' ');
      this.elGrammarStyle.textContent = `Strike Corvette // ${grammarName}`;
    }

    const toHexStr = (c: number) => '#' + c.toString(16).padStart(6, '0');
    if (this.swatchPri) this.swatchPri.style.backgroundColor = toHexStr(this.currentFaction.palette.primary);
    if (this.swatchSec) this.swatchSec.style.backgroundColor = toHexStr(this.currentFaction.palette.secondary);
    if (this.swatchGlow) {
      const glowHex = toHexStr(this.currentFaction.palette.engineGlow);
      this.swatchGlow.style.backgroundColor = glowHex;
      this.swatchGlow.style.boxShadow = `0 0 8px ${glowHex}`;
    }
  }

  /**
   * Engages station magnetic docking clamps
   */
  public dockShip(): void {
    if (this.isDocked) return;
    this.isDocked = true;

    // Halt vessel
    this.flightController.velocity.set(0, 0, 0);

    // Play procedural docking chime
    this.audio.playDockingChime();

    // Day 14: If docking while in an escape pod, open Clinic Rescue Modal!
    if (this.isEscapePod) {
      if (this.modalClinicRescue) {
        this.modalClinicRescue.classList.remove('hidden');
      }
      return;
    }

    // Day 17: Check Nemesis station docking lockdown
    const controllingFaction = this.currentSectorId === 2 || this.currentSectorId === 3 ? 'FACTION_HEGEMONY' : 'FACTION_SOL';
    const currentRep = this.playerStandings.find((s: any) => s.factionId === controllingFaction);
    if (currentRep && currentRep.tier === 'NEMESIS') {
      this.showApNotification('⛔ DOCKING REJECTED: Station shields active! Designated NEMESIS of controlling faction.', true);
      this.audio.playApWarningSound();
      return;
    }

    // Customize station comms & dialog per active sector & reputation standing
    if (this.currentSectorId === 3) {
      if (this.modalStationName) this.modalStationName.textContent = 'OBSIDIAN FOUNDRY 3 // SECTOR 03';
      if (this.modalDockBadge) this.modalDockBadge.textContent = 'CLASS 2 INDUSTRIAL SMELTER';
      if (this.modalDockSubtext) this.modalDockSubtext.textContent = 'THE LITHOS AXIOM JURISDICTION // POPULATION 18,500';
      if (this.modalOfficerAvatar) this.modalOfficerAvatar.textContent = '🦾';
      if (this.modalOfficerName) this.modalOfficerName.textContent = 'FOUNDRY MASTER IGNIS // COMM FREQ 142.4 MHz';
      if (this.modalOfficerQuote) {
        if (currentRep && currentRep.tier === 'HOSTILE') {
          this.modalOfficerQuote.textContent =
            '"⚠️ SECURITY WARNING: You enter Foundry 3 under military escort. A 25% Hegemony tariff surcharge has been levied against your account. Maintain low thruster output."';
        } else {
          this.modalOfficerQuote.textContent =
            '"Industrial clamps engaged. Core temperatures holding at 1,850 Kelvin. Welcome to Obsidian Foundry 3. We have surplus Silicate Ore and Plasteel Alloy ready for export, but our fuel reserves are dangerously low. Sell us Deuterium or buy our refined ore!"';
        }
      }
    } else {
      if (this.modalStationName && this.station) this.modalStationName.textContent = `${this.station.config.name} // SECTOR 0${this.currentSectorId}`;
      if (this.modalDockBadge) this.modalDockBadge.textContent = 'CLASS 1 FREE-TRADE HUB';
      if (this.modalDockSubtext) this.modalDockSubtext.textContent = 'SOL-PERIMETER LEAGUE JURISDICTION // POPULATION 42,000';
      if (this.modalOfficerAvatar) this.modalOfficerAvatar.textContent = '👨‍🚀';
      if (this.modalOfficerName) this.modalOfficerName.textContent = 'HARBORMASTER VANCE // COMM FREQ 114.8 MHz';
      if (this.modalOfficerQuote) {
        if (currentRep && currentRep.tier === 'HONORED') {
          this.modalOfficerQuote.textContent =
            '"Priority docking clamps engaged, Commander! It is an honor to receive such a decorated champion of the Sol Alliance. All tariffs are discounted 15% during your stay. What are your orders?"';
        } else if (currentRep && currentRep.tier === 'FRIENDLY') {
          this.modalOfficerQuote.textContent =
            '"Welcome back to Aegis Terminal, Captain Vance. Standard diplomatic courtesy applied — 5% merchant discount active across all terminal bays."';
        } else if (currentRep && currentRep.tier === 'HOSTILE') {
          this.modalOfficerQuote.textContent =
            '"⚠️ CAUTION: Automated rail defense batteries are tracking your signature. A +25% Hostile Tariff Surcharge is active on all commodities and outfitting."';
        } else {
          this.modalOfficerQuote.textContent =
            '"Docking clamps secured, Captain. Atmospheric seals holding at 1.0 ATM. Power couplers attached. Welcome to Aegis Terminal. We\'ve got fresh Deuterium in the fuel depot and our industrial smelters are buying raw ore at high margins today. What\'s your business?"';
        }
      }
    }


    // Load live station inventory from backend database based on active tab
    if (this.activeStationTab === 'outfitting') {
      this.loadOutfittingData();
    } else if (this.activeStationTab === 'armory') {
      this.loadArmoryData();
    } else if (this.activeStationTab === 'contracts') {
      this.loadContractsData();
    } else {
      this.loadPortInventory();
    }

    // Reveal Station Dock Modal
    if (this.modalDock) {
      this.modalDock.classList.remove('hidden');
    }
  }

  /**
   * Disengages docking clamps and releases vessel
   */
  public undockShip(): void {
    if (!this.isDocked) return;

    if (this.isLoadoutOverBudget) {
      this.showApNotification('⚠️ UNDOCK REJECTED: Power-Grid or CPU capacity exceeded! Fix fitting.', true);
      this.audio.playApWarningSound();
      return;
    }

    this.isDocked = false;

    // Play undocking release sound
    this.audio.playUndockSound();

    // Hide Modal
    if (this.modalDock) {
      this.modalDock.classList.add('hidden');
    }

    // Give vessel gentle forward clearance impulse
    const forwardX = Math.sin(this.flightController.yaw);
    const forwardZ = Math.cos(this.flightController.yaw);
    this.flightController.velocity.set(forwardX * 5.0, 0, forwardZ * 5.0);
  }

  private createStarfield(count: number): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colorPalette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xa5c9ff),
      new THREE.Color(0xffe5b4),
      new THREE.Color(0x38bdf8),
    ];

    for (let i = 0; i < count; i++) {
      const radius = 250 + Math.random() * 250;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    });

    return new THREE.Points(geometry, material);
  }

  private cacheTelemetryElements(): void {
    this.elFps = document.getElementById('val-fps');
    this.elDrawCalls = document.getElementById('val-drawcalls');
    this.elSpeed = document.getElementById('val-speed');
    this.elHeading = document.getElementById('val-heading');
    this.elDampeners = document.getElementById('val-dampeners');
    this.elShipPos = document.getElementById('val-ship-pos');
    this.elCamMode = document.getElementById('val-cam-mode');
    this.elHullTris = document.getElementById('val-hull-tris');
    this.elHullVerts = document.getElementById('val-hull-verts');
    this.elGrammarStyle = document.getElementById('val-grammar-style');
    this.elFactionDesc = document.getElementById('val-faction-desc');
    this.elDockingBanner = document.getElementById('hud-docking-banner');
    this.elDockingMsg = document.getElementById('docking-msg');
    this.selectFaction = document.getElementById('select-faction') as HTMLSelectElement;
    this.swatchPri = document.getElementById('swatch-pri');
    this.swatchSec = document.getElementById('swatch-sec');
    this.swatchGlow = document.getElementById('swatch-glow');
    this.inputSeed = document.getElementById('input-seed') as HTMLInputElement;
    this.btnToggleCam = document.getElementById('btn-toggle-cam');
    this.btnToggleDamp = document.getElementById('btn-toggle-damp');

    // Modal elements
    this.modalDock = document.getElementById('station-dock-modal');
    this.modalStationName = document.getElementById('modal-station-name');
    this.modalOfficerQuote = document.getElementById('modal-officer-quote');
    this.modalMarketExchange = document.getElementById('modal-market-exchange');
    this.elBackendBadge = document.getElementById('backend-status-badge');
    this.btnUndock = document.getElementById('btn-undock');
    this.btnQuickService = document.getElementById('btn-quick-service');

    // Market & Telemetry DOM Elements (Day 9 & 10)
    this.elTelemetryCredits = document.getElementById('val-telemetry-credits');
    this.elTelemetryCargo = document.getElementById('val-telemetry-cargo');
    this.elTelemetryNetWorth = document.getElementById('val-telemetry-networth');
    this.elTelemetryProfit = document.getElementById('val-telemetry-profit');
    this.modalMarketPlayerCredits = document.getElementById('market-player-credits');
    this.modalMarketPlayerCargo = document.getElementById('market-player-cargo');
    this.modalCargoDisplay = document.getElementById('modal-cargo-display');
    this.marketToast = document.getElementById('market-toast');
    this.navRadarRoutes = document.getElementById('nav-radar-routes');
    this.modalOfficerAvatar = document.getElementById('modal-officer-avatar');
    this.modalOfficerName = document.getElementById('modal-officer-name');
    this.modalDockBadge = document.getElementById('modal-dock-badge');
    this.modalDockSubtext = document.getElementById('modal-dock-subtext');

    // AP HUD Elements
    this.elApGauge = document.getElementById('hud-ap-gauge');
    this.elApCounter = document.getElementById('hud-ap-counter');
    this.elApTimer = document.getElementById('hud-ap-timer');
    this.elApFill = document.getElementById('hud-ap-fill');
    this.elApTelemetry = document.getElementById('val-ap-telemetry');
    this.elApRegenTelemetry = document.getElementById('val-ap-regen-telemetry');
    this.modalApDisplay = document.getElementById('modal-ap-display');
    this.btnApWarp = document.getElementById('btn-ap-warp');
    this.btnApScan = document.getElementById('btn-ap-scan');
    this.btnApExtract = document.getElementById('btn-ap-extract');
    this.btnDockHaggle = document.getElementById('btn-dock-haggle');
    this.elApNotification = document.getElementById('ap-notification');

    // Nav Console Elements (Day 8)
    this.modalNav = document.getElementById('nav-modal');
    this.btnOpenNav = document.getElementById('btn-open-nav');
    this.btnCloseNav = document.getElementById('btn-close-nav');
    this.navLanesList = document.getElementById('nav-lanes-list');
    this.navCurrentSectorTitle = document.getElementById('nav-current-sector-title');
    this.navCurrentSectorSubtext = document.getElementById('nav-current-sector-subtext');
    this.navFuelDisplay = document.getElementById('nav-fuel-display');
    this.hudSector = document.getElementById('hud-sector');

    // Milestone 0.3 Combat Elements
    this.elTelemetryShields = document.getElementById('val-telemetry-shields');
    this.elTelemetryHull = document.getElementById('val-telemetry-hull');
    this.elTelemetryEnergy = document.getElementById('val-telemetry-energy');
    this.elTelemetryCombat = document.getElementById('val-telemetry-combat');
    this.elTacticalReticle = document.getElementById('tactical-target-reticle');
    this.elReticleName = document.getElementById('reticle-name');
    this.elReticleShieldFill = document.getElementById('reticle-shield-fill');
    this.elReticleHullFill = document.getElementById('reticle-hull-fill');
    this.elReticleRange = document.getElementById('reticle-range');
    this.elActiveWeapon = document.getElementById('val-active-weapon');
    this.elTacticalModule = document.getElementById('val-tactical-module');

    // Stacked Vitals
    this.elVitalShieldBar = document.getElementById('vital-shield-bar');
    this.elVitalShieldText = document.getElementById('vital-shield-text');
    this.elVitalHullBar = document.getElementById('vital-hull-bar');
    this.elVitalHullText = document.getElementById('vital-hull-text');
    this.elVitalEnergyBar = document.getElementById('vital-energy-bar');
    this.elVitalEnergyText = document.getElementById('vital-energy-text');

    // Ability Hotbar Slots
    this.elSlotHigh1 = document.getElementById('slot-high-1');
    this.elSlotHigh2 = document.getElementById('slot-high-2');
    this.elSlotMid1 = document.getElementById('slot-mid-1');
    this.elSlotMid2 = document.getElementById('slot-mid-2');
    this.elCdHigh1 = document.getElementById('cd-high-1');
    this.elCdHigh2 = document.getElementById('cd-high-2');
    this.elCdMid1 = document.getElementById('cd-mid-1');
    this.elCdMid2 = document.getElementById('cd-mid-2');

    // Top-Center Target Telemetry Box
    this.elTargetTelemetryHud = document.getElementById('target-telemetry-hud');
    this.elTargetName = document.getElementById('target-name');
    this.elTargetFaction = document.getElementById('target-faction');
    this.elTargetDistance = document.getElementById('target-distance');
    this.elTargetShieldBar = document.getElementById('target-shield-bar');
    this.elTargetShieldVal = document.getElementById('target-shield-val');
    this.elTargetHullBar = document.getElementById('target-hull-bar');
    this.elTargetHullVal = document.getElementById('target-hull-val');

    // Slot click bindings
    this.elSlotHigh1?.addEventListener('click', () => {
      this.selectWeaponPreset(0);
      this.fireWeaponDirectly('PULSE');
    });
    this.elSlotHigh2?.addEventListener('click', () => {
      this.selectWeaponPreset(1);
      this.fireWeaponDirectly('PLASMA');
    });
    this.elSlotMid1?.addEventListener('mousedown', () => {
      this.combatInputs.fireTactical = true;
      this.sendCombatInputs();
    });
    this.elSlotMid1?.addEventListener('mouseup', () => {
      this.combatInputs.fireTactical = false;
      this.sendCombatInputs();
    });
    this.elSlotMid2?.addEventListener('click', () => {
      this.selectWeaponPreset(2);
      this.fireWeaponDirectly('FLAK');
    });

    // Day 13 Station Service Tabs & Outfitting Bay DOM Lookups
    this.tabBtnExchange = document.getElementById('tab-btn-exchange');
    this.tabBtnOutfitting = document.getElementById('tab-btn-outfitting');
    this.tabBtnArmory = document.getElementById('tab-btn-armory');
    this.viewTabExchange = document.getElementById('view-tab-exchange');
    this.viewTabOutfitting = document.getElementById('view-tab-outfitting');
    this.viewTabArmory = document.getElementById('view-tab-armory');

    this.tabBtnExchange?.addEventListener('click', () => this.switchStationTab('exchange'));
    this.tabBtnOutfitting?.addEventListener('click', () => this.switchStationTab('outfitting'));
    this.tabBtnArmory?.addEventListener('click', () => this.switchStationTab('armory'));

    this.valFittingPg = document.getElementById('val-fitting-pg');
    this.valFittingCpu = document.getElementById('val-fitting-cpu');
    this.barFittingPg = document.getElementById('bar-fitting-pg');
    this.barFittingCpu = document.getElementById('bar-fitting-cpu');
    this.fittingOverbudgetAlert = document.getElementById('fitting-overbudget-alert');
    this.paperdollSlotsList = document.getElementById('paperdoll-slots-list');
    this.lockerModulesList = document.getElementById('locker-modules-list');
    this.lockerItemCount = document.getElementById('locker-item-count');

    this.elArmoryCatalogGrid = document.getElementById('armory-catalog-grid');
    this.elArmoryPlayerCredits = document.getElementById('armory-player-credits');

    // Day 13 Targeted Canister & Loot Modal DOM Lookups
    this.elLootPromptHud = document.getElementById('loot-prompt-hud');
    this.elLootPromptText = document.getElementById('loot-prompt-text');
    this.modalContainerLoot = document.getElementById('container-loot-modal');
    this.modalLootRarity = document.getElementById('loot-modal-rarity');
    this.modalLootTitle = document.getElementById('loot-modal-title');
    this.elLootDistanceDisplay = document.getElementById('loot-distance-display');
    this.elLootItemCount = document.getElementById('loot-item-count');
    this.elLootItemsList = document.getElementById('loot-items-list');
    this.btnCloseLoot = document.getElementById('btn-close-loot');
    this.btnLootAll = document.getElementById('btn-loot-all');

    this.btnCloseLoot?.addEventListener('click', () => this.closeContainerLootModal());
    this.btnLootAll?.addEventListener('click', () => this.lootAllCurrentContainer());

    if (this.hudSector) {
      this.hudSector.classList.add('clickable');
      this.hudSector.title = 'Click to open Hyperspace Nav Computer (J)';
    }

    // Day 14: Escape Pod, Killmail, Clinic & Contracts DOM Lookups
    this.elEscapePodHud = document.getElementById('escape-pod-hud');
    this.elPodTimerClock = document.getElementById('pod-timer-clock');

    this.modalKillmail = document.getElementById('killmail-modal');
    this.elKmTimestamp = document.getElementById('km-timestamp');
    this.elKmLossValuation = document.getElementById('km-loss-valuation');
    this.elKmKillerName = document.getElementById('km-killer-name');
    this.elKmSectorName = document.getElementById('km-sector-name');
    this.elKmTotalLoss = document.getElementById('km-total-loss');
    this.elKmDroppedSummary = document.getElementById('km-dropped-summary');
    this.btnPostBounty = document.getElementById('btn-post-bounty');
    this.elKmShareRow = document.getElementById('km-share-link-row');
    this.elKmShareUrl = document.getElementById('km-share-url') as HTMLInputElement;
    this.btnCopyKmUrl = document.getElementById('btn-copy-km-url');
    this.elKmCopyToast = document.getElementById('km-copy-toast');
    this.btnCloseKm = document.getElementById('btn-close-km');

    this.modalClinicRescue = document.getElementById('clinic-rescue-modal');
    this.btnClaimFrigate = document.getElementById('btn-claim-frigate');

    this.tabBtnContracts = document.getElementById('tab-btn-contracts');
    this.viewTabContracts = document.getElementById('view-tab-contracts');
    this.elContractsActiveList = document.getElementById('contracts-active-list');
    this.elContractsActiveCount = document.getElementById('contracts-active-count');
    this.elKillmailsArchiveList = document.getElementById('killmails-archive-list');
    this.elKillmailsCount = document.getElementById('killmails-count');
    this.elContractsPlayerCredits = document.getElementById('contracts-player-credits');

    this.tabBtnContracts?.addEventListener('click', () => this.switchStationTab('contracts'));

    // Day 15: Station Salvage Bay & Flight Tow Cable DOM Bindings
    this.tabBtnSalvage = document.getElementById('tab-btn-salvage');
    this.viewTabSalvage = document.getElementById('view-tab-salvage');
    this.elSalvagePlayerCredits = document.getElementById('salvage-player-credits');
    this.elSalvageTetherStatus = document.getElementById('salvage-tether-status');
    this.elSalvageEmptyCard = document.getElementById('salvage-empty-card');
    this.elSalvageWreckCard = document.getElementById('salvage-wreck-card');
    this.elSalvageWreckFaction = document.getElementById('salvage-wreck-faction');
    this.elSalvageWreckTitle = document.getElementById('salvage-wreck-title');
    this.elSalvageWreckClass = document.getElementById('salvage-wreck-class');
    this.elSalvageWreckScrap = document.getElementById('salvage-wreck-scrap');
    this.elSalvageWreckIntactness = document.getElementById('salvage-wreck-intactness');
    this.elSalvageWreckVal = document.getElementById('salvage-wreck-val');
    this.btnDismantleWreck = document.getElementById('btn-dismantle-wreck');
    this.btnRefurbishWreck = document.getElementById('btn-refurbish-wreck');
    this.elSalvageDerelictsList = document.getElementById('salvage-derelicts-list');
    this.elSalvageSweepCount = document.getElementById('salvage-sweep-count');

    this.elTargetQuickActions = document.getElementById('target-quick-actions');
    this.btnHudSalvageBeam = document.getElementById('btn-hud-salvage-beam');
    this.btnHudTetherWreck = document.getElementById('btn-hud-tether-wreck');
    this.elTowCableHud = document.getElementById('tow-cable-hud');
    this.elTowTargetName = document.getElementById('tow-target-name');
    this.elTowDistMetric = document.getElementById('tow-dist-metric');
    this.elTowTensionBadge = document.getElementById('tow-tension-badge');
    this.btnHudReleaseTow = document.getElementById('btn-hud-release-tow');

    this.tabBtnSalvage?.addEventListener('click', () => this.switchStationTab('salvage'));
    this.btnDismantleWreck?.addEventListener('click', () => this.dismantleTetheredWreck());
    this.btnRefurbishWreck?.addEventListener('click', () => this.refurbishTetheredWreck());
    this.btnHudSalvageBeam?.addEventListener('click', () => this.toggleSalvageMining());
    this.btnHudTetherWreck?.addEventListener('click', () => this.toggleTowTether());
    this.btnHudReleaseTow?.addEventListener('click', () => this.toggleTowTether());

    // Day 16: Star Control II Alien Comms & Diplomacy DOM Bindings
    this.tabBtnDiplomacy = document.getElementById('tab-btn-diplomacy');
    this.viewTabDiplomacy = document.getElementById('view-tab-diplomacy');
    this.elDiplomacyEnvoysList = document.getElementById('diplomacy-envoys-list');
    this.elDiplomacyEnvoysCount = document.getElementById('diplomacy-envoys-count');
    this.btnHudHailTarget = document.getElementById('btn-hud-hail-target');

    this.elAlienCommsModal = document.getElementById('alien-comms-modal');
    this.elAlienCommsSpeakerName = document.getElementById('comms-speaker-name');
    this.elAlienCommsSpeakerTitle = document.getElementById('comms-speaker-title');
    this.elAlienCommsMoodBadge = document.getElementById('comms-mood-badge');
    this.elAlienCommsSpeciesLabel = document.getElementById('comms-species-label');
    this.elAlienCommsCrestIcon = document.getElementById('comms-crest-icon');
    this.elAlienCommsCrestLabel = document.getElementById('comms-crest-label');
    this.elAlienCommsDialogueSpeaker = document.getElementById('comms-dialogue-speaker');
    this.elAlienCommsDialogueText = document.getElementById('comms-dialogue-text');
    this.elAlienCommsOptionsList = document.getElementById('comms-options-list');
    this.elAlienPortraitCanvas = document.getElementById('alien-portrait-canvas') as HTMLCanvasElement;
    this.elCommsWaveformCanvas = document.getElementById('comms-waveform-canvas') as HTMLCanvasElement;
    this.elBtnCloseAlienComms = document.getElementById('btn-close-alien-comms') as HTMLButtonElement;

    this.tabBtnDiplomacy?.addEventListener('click', () => this.switchStationTab('diplomacy'));
    this.btnHudHailTarget?.addEventListener('click', () => this.hailCurrentTargetOrEnvoy());
    this.elBtnCloseAlienComms?.addEventListener('click', () => this.closeAlienComms());

    // Day 17: Faction Reputation & Allegiance DOM Lookups
    this.elFactionDossierList = document.getElementById('faction-dossier-list');
    this.elHudFactionBadge = document.getElementById('hud-faction-badge');
    this.elHudFactionCrest = document.getElementById('hud-faction-crest');
    this.elHudFactionName = document.getElementById('hud-faction-name');
    this.elHudFactionStandingTier = document.getElementById('hud-faction-standing-tier');
    this.elHudTruceTimerPill = document.getElementById('hud-truce-timer-pill');
    this.refreshFactionStandings();

    // Day 18: Star Control II Planetary Orbital Survey & CRT Console DOM Lookups
    this.modalPlanetarySurvey = document.getElementById('planetary-survey-modal');
    this.elOrbitalBanner = document.getElementById('hud-orbital-banner');
    this.elOrbitalMsg = document.getElementById('orbital-msg');
    this.globeCanvas = document.getElementById('orbital-globe-canvas') as HTMLCanvasElement;
    if (this.globeCanvas) {
      this.globeCtx = this.globeCanvas.getContext('2d');
    }

    document.getElementById('btn-exit-orbit')?.addEventListener('click', () => this.exitOrbit());
    document.getElementById('btn-scan-minerals')?.addEventListener('click', () => this.performScannerSweep('MINERALS'));
    document.getElementById('btn-scan-bio')?.addEventListener('click', () => this.performScannerSweep('BIO'));
    document.getElementById('btn-scan-anomalies')?.addEventListener('click', () => this.performScannerSweep('ANOMALIES'));
    document.getElementById('btn-launch-probe')?.addEventListener('click', () => this.launchAtmosphericProbe());

    this.initGlobeCanvasControls();


    this.btnPostBounty?.addEventListener('click', () => this.postRevengeBounty());
    this.btnCopyKmUrl?.addEventListener('click', () => {
      if (this.elKmShareUrl) {
        navigator.clipboard.writeText(this.elKmShareUrl.value);
        if (this.elKmCopyToast) {
          this.elKmCopyToast.classList.remove('hidden');
          setTimeout(() => this.elKmCopyToast?.classList.add('hidden'), 2500);
        }
      }
    });
    this.btnCloseKm?.addEventListener('click', () => {
      if (this.modalKillmail) this.modalKillmail.classList.add('hidden');
    });
    this.btnClaimFrigate?.addEventListener('click', () => this.claimReplacementFrigate());

    // Bounty Chips selection
    document.querySelectorAll('.bounty-chip').forEach(chip => {
      chip.addEventListener('click', (ev) => {
        document.querySelectorAll('.bounty-chip').forEach(c => c.classList.remove('active'));
        const target = ev.currentTarget as HTMLElement;
        target.classList.add('active');
        this.selectedBountyAmount = parseInt(target.dataset.bounty || '1000', 10);
      });
    });

    // Shareable Contract URL detection on startup
    const urlParams = new URLSearchParams(window.location.search);
    const contractParam = urlParams.get('contract');
    if (contractParam) {
      fetch(`/api/combat/contracts/${contractParam}`)
        .then(r => r.json())
        .then(data => {
          if (data.contract) {
            this.showApNotification(`📜 CONTRACT LOADED: Bounty of ${data.contract.rewardCredits.toLocaleString()} CR on ${data.contract.targetName}!`, false);
          }
        }).catch(err => console.error('[Contract URL] Error:', err));
    }

    // Check backend health & initial AP / Sector balances
    this.checkBackendHealth();
    this.fetchPlayerAP();
    this.loadShipAndSector();
  }

  private async checkBackendHealth(): Promise<void> {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        const data = await res.json();
        if (this.elBackendBadge) {
          const eng = data.database.engine === 'postgresql-remote' ? 'POSTGRES' : 'PGLITE';
          this.elBackendBadge.textContent = `API: ONLINE (${eng})`;
          this.elBackendBadge.style.color = '#34d399';
          this.elBackendBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        }
      }
    } catch {
      if (this.elBackendBadge) {
        this.elBackendBadge.textContent = 'API: STANDALONE';
      }
    }
  }

  public async fetchPlayerAP(): Promise<void> {
    try {
      const res = await fetch('/api/player/ap?playerId=acc_sol_captain');
      if (res.ok) {
        const data = await res.json();
        this.playerAP = data;
        this.updateApUI();
      }
    } catch (err) {
      console.warn('[AP] Failed to fetch player AP:', err);
    }
  }

  public async spendAP(action: string, customCost?: number): Promise<boolean> {
    try {
      const res = await fetch('/api/player/ap/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'acc_sol_captain',
          action,
          cost: customCost,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        this.audio.playApWarningSound();
        this.triggerApAlertShake();
        this.showApNotification(`⚠️ ${data.error || 'INSUFFICIENT ACTION POINTS'}`, true);
        return false;
      }

      this.playerAP.currentAP = data.currentAP;
      this.playerAP.maxAP = data.maxAP;
      this.playerAP.nextRegenSeconds = data.nextRegenSeconds;
      this.updateApUI();
      this.audio.playApSpendSound();
      this.showApNotification(`⚡ SPENT ${data.cost} AP [${action}] // BALANCE: ${data.currentAP} AP`, false);
      return true;
    } catch (err) {
      console.error('[AP] Network spend error:', err);
      this.audio.playApWarningSound();
      this.showApNotification('⚠️ BACKEND CONNECTION OFFLINE', true);
      return false;
    }
  }

  public async debugAddAP(amount: number): Promise<void> {
    try {
      const target = Math.min(600, this.playerAP.currentAP + amount);
      const res = await fetch('/api/player/ap/debug-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'acc_sol_captain', amount: target }),
      });
      if (res.ok) {
        const data = await res.json();
        this.playerAP = data;
        this.updateApUI();
        this.audio.playDockingChime();
        this.showApNotification(`🔋 POWER GRID RECHARGED: +${amount} AP // BALANCE: ${data.currentAP} AP`, false);
      }
    } catch (err) {
      console.error('[AP] Debug recharge error:', err);
    }
  }

  private triggerApAlertShake(): void {
    if (this.elApGauge) {
      this.elApGauge.classList.remove('warning-pulse');
      void this.elApGauge.offsetWidth; // Force CSS reflow
      this.elApGauge.classList.add('warning-pulse');
      setTimeout(() => {
        this.elApGauge?.classList.remove('warning-pulse');
      }, 500);
    }
  }

  private showApNotification(message: string, isError: boolean): void {
    if (!this.elApNotification) return;
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    this.elApNotification.textContent = message;
    this.elApNotification.className = `ap-notification ${isError ? 'error' : 'success'}`;
    this.notificationTimeout = window.setTimeout(() => {
      if (this.elApNotification) {
        this.elApNotification.className = 'ap-notification hidden';
      }
    }, 2800);
  }

  private updateApUI(): void {
    const { currentAP, maxAP, nextRegenSeconds } = this.playerAP;
    const pct = Math.max(0, Math.min(100, (currentAP / maxAP) * 100));

    if (this.elApCounter) {
      this.elApCounter.textContent = `${currentAP} / ${maxAP}`;
    }
    if (this.elApFill) {
      this.elApFill.style.width = `${pct}%`;
      if (currentAP < 15) {
        this.elApFill.classList.add('low-ap');
      } else {
        this.elApFill.classList.remove('low-ap');
      }
    }
    if (this.elApTimer) {
      this.elApTimer.textContent = currentAP >= maxAP ? 'MAX CHARGE' : `+1 in ${nextRegenSeconds}s`;
    }
    if (this.elApTelemetry) {
      this.elApTelemetry.textContent = `${currentAP} / ${maxAP}`;
      this.elApTelemetry.style.color = currentAP < 15 ? '#f59e0b' : '#38bdf8';
    }
    if (this.elApRegenTelemetry) {
      this.elApRegenTelemetry.textContent = currentAP >= maxAP ? 'MAX' : `+1 in ${nextRegenSeconds}s`;
    }
    if (this.modalApDisplay) {
      this.modalApDisplay.textContent = `${currentAP} / ${maxAP} AP`;
    }
  }

  public async refreshPlayerHold(): Promise<void> {
    try {
      const res = await fetch('/api/player/hold?playerId=acc_sol_captain');
      if (res.ok) {
        const hold = await res.json();
        if (!this.hasInitialCreditsSet) {
          this.initialSessionCredits = hold.credits;
          this.hasInitialCreditsSet = true;
        }
        this.playerCredits = hold.credits;
        this.playerCargoCapacity = hold.cargoCapacity;
        this.playerUsedCargo = hold.usedCargo;
        this.playerCargoHold = hold.cargo || [];
        this.sessionArbitrageProfit = this.playerCredits - this.initialSessionCredits;
        this.updateHoldUI();
      }
    } catch (err) {
      console.warn('[HOLD] Failed to load hold:', err);
    }
  }

  private updateHoldUI(): void {
    const formattedCredits = this.playerCredits.toLocaleString('en-US');
    const cargoRatio = `${this.playerUsedCargo} / ${this.playerCargoCapacity} m³`;

    // Calculate Net Worth = Credits + Cargo liquidation value
    const estimatedCargoVal = this.playerCargoHold.reduce((sum, item) => {
      const match = this.currentMarketItems.find((i) => i.commodity_id === item.commodity_id);
      const unitVal = match ? match.sell_price : 35;
      return sum + item.quantity * unitVal;
    }, 0);
    const netWorth = Math.round(this.playerCredits + estimatedCargoVal);

    if (this.elTelemetryCredits) {
      this.elTelemetryCredits.textContent = `${formattedCredits} Cr`;
    }
    if (this.elTelemetryCargo) {
      this.elTelemetryCargo.textContent = cargoRatio;
    }
    if (this.elTelemetryNetWorth) {
      this.elTelemetryNetWorth.textContent = `${netWorth.toLocaleString('en-US')} Cr`;
    }
    if (this.elTelemetryProfit) {
      const sign = this.sessionArbitrageProfit >= 0 ? '+' : '';
      this.elTelemetryProfit.textContent = `${sign}${this.sessionArbitrageProfit.toLocaleString('en-US')} Cr`;
      this.elTelemetryProfit.style.color = this.sessionArbitrageProfit > 0 ? '#34d399' : '#94a3b8';
    }
    if (this.modalMarketPlayerCredits) {
      this.modalMarketPlayerCredits.textContent = `${formattedCredits} Cr`;
    }
    if (this.modalMarketPlayerCargo) {
      this.modalMarketPlayerCargo.textContent = cargoRatio;
    }
    if (this.modalCargoDisplay) {
      this.modalCargoDisplay.textContent = cargoRatio;
    }
  }

  public showMarketToast(message: string, isError: boolean = false): void {
    if (!this.marketToast) return;
    if (this.marketToastTimer) {
      clearTimeout(this.marketToastTimer);
      this.marketToastTimer = null;
    }

    this.marketToast.textContent = message;
    this.marketToast.className = `market-toast ${isError ? 'error' : 'success'}`;
    this.marketToastTimer = window.setTimeout(() => {
      if (this.marketToast) {
        this.marketToast.className = 'market-toast hidden';
      }
    }, 4500);
  }

  private async loadPortInventory(portId?: string): Promise<void> {
    const targetPort = portId || (this.currentSectorId === 1 ? 'PORT_AEGIS_01' : this.currentSectorId === 3 ? 'PORT_SMELTER_01' : null);
    this.currentMarketPortId = targetPort;

    if (!targetPort) {
      if (this.modalMarketExchange) {
        this.modalMarketExchange.innerHTML = `
          <div class="market-loading-hint">⚠️ NO COMMERCIAL EXCHANGE IN THIS SECTOR</div>
        `;
      }
      return;
    }

    try {
      const res = await fetch(`/api/ports/${targetPort}/market?playerId=acc_sol_captain`);
      if (res.ok) {
        const data = await res.json();
        this.currentMarketItems = data.items || [];
        if (data.hold) {
          this.playerCredits = data.hold.credits;
          this.playerCargoCapacity = data.hold.cargoCapacity;
          this.playerUsedCargo = data.hold.usedCargo;
          this.playerCargoHold = data.hold.cargo || [];
          this.updateHoldUI();
        }
        this.renderMarketExchange(targetPort, this.currentMarketItems);
      } else {
        if (this.modalMarketExchange) {
          this.modalMarketExchange.innerHTML = `
            <div class="market-loading-hint">Failed to load market telemetry.</div>
          `;
        }
      }
    } catch (err) {
      console.warn('[MARKET] Failed to load market:', err);
    }
  }

  private renderMarketExchange(portId: string, items: any[]): void {
    if (!this.modalMarketExchange) return;

    if (items.length === 0) {
      this.modalMarketExchange.innerHTML = `
        <div class="market-loading-hint">No commodities registered at this terminal.</div>
      `;
      return;
    }

    const freeSpace = Math.max(0, this.playerCargoCapacity - this.playerUsedCargo);

    this.modalMarketExchange.innerHTML = items
      .map((item) => {
        const canAfford = this.playerCredits >= item.buy_price;
        const canBuy = freeSpace > 0 && canAfford && item.stock > 0;
        const canSell = item.player_cargo > 0;

        return `
          <div class="comm-item-card" data-commodity="${item.commodity_id}">
            <div class="comm-header-row">
              <div class="comm-name-group">
                <span class="comm-name">${item.name}</span>
                <span class="comm-category-badge ${item.category}">${item.category.replace('_', ' ')}</span>
              </div>
              <div class="comm-player-hold">
                HOLD: <strong>${item.player_cargo}</strong>
              </div>
            </div>

            <div class="comm-details-row">
              <div class="comm-prices">
                <div class="price-tag buy">
                  <span class="p-label">BUY</span>
                  <span class="p-val">${item.buy_price.toFixed(1)} Cr</span>
                  ${item.rep_modifier_label ? `<span class="rep-tariff-badge ${item.rep_multiplier < 1.0 ? 'discount' : 'tariff'}">${item.rep_modifier_label}</span>` : ''}
                </div>
                <div class="price-tag sell">
                  <span class="p-label">SELL</span>
                  <span class="p-val">${item.sell_price.toFixed(1)} Cr</span>
                </div>
              </div>

              <div class="comm-stock-info">
                STOCK: <span class="stock-val">${item.stock} / ${item.capacity}</span>
              </div>
            </div>

            <div class="comm-actions-row">
              <div class="comm-stepper">
                <button class="stepper-btn btn-step-down" data-action="dec" title="Decrease quantity">-</button>
                <input type="number" class="stepper-input" value="1" min="1" max="40" />
                <button class="stepper-btn btn-step-up" data-action="inc" title="Increase quantity">+</button>
                <button class="stepper-max-btn" data-action="max" title="Max buyable / sellable units">MAX</button>
              </div>
              <div class="comm-trade-buttons">
                <button class="btn-trade buy" data-action="buy" ${!canBuy ? 'disabled' : ''} title="Purchase from Port">
                  BUY
                </button>
                <button class="btn-trade sell" data-action="sell" ${!canSell ? 'disabled' : ''} title="Sell to Port">
                  SELL
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    // Attach interaction handlers to each item
    const cards = this.modalMarketExchange.querySelectorAll('.comm-item-card');
    cards.forEach((card) => {
      const commId = card.getAttribute('data-commodity');
      if (!commId) return;

      const input = card.querySelector('.stepper-input') as HTMLInputElement;
      const btnDec = card.querySelector('.btn-step-down') as HTMLButtonElement;
      const btnInc = card.querySelector('.btn-step-up') as HTMLButtonElement;
      const btnMax = card.querySelector('.stepper-max-btn') as HTMLButtonElement;
      const btnBuy = card.querySelector('.btn-trade.buy') as HTMLButtonElement;
      const btnSell = card.querySelector('.btn-trade.sell') as HTMLButtonElement;

      const item = items.find((i) => i.commodity_id === commId);
      if (!item) return;

      const getQty = () => {
        const val = parseInt(input.value, 10);
        return isNaN(val) || val < 1 ? 1 : val;
      };

      btnDec?.addEventListener('click', () => {
        const q = Math.max(1, getQty() - 1);
        input.value = String(q);
        this.audio.playUiBlip();
      });

      btnInc?.addEventListener('click', () => {
        const q = getQty() + 1;
        input.value = String(q);
        this.audio.playUiBlip();
      });

      btnMax?.addEventListener('click', () => {
        const currentFree = Math.max(0, this.playerCargoCapacity - this.playerUsedCargo);
        const maxAffordable = Math.floor(this.playerCredits / item.buy_price);
        const buyLimit = Math.min(item.stock, currentFree, maxAffordable);
        const maxVal = Math.max(1, Math.max(buyLimit, item.player_cargo));
        input.value = String(maxVal);
        this.audio.playUiBlip();
      });

      input?.addEventListener('change', () => {
        input.value = String(getQty());
      });

      btnBuy?.addEventListener('click', async () => {
        const qty = getQty();
        await this.executeTrade(portId, commId, qty, 'BUY');
      });

      btnSell?.addEventListener('click', async () => {
        const qty = getQty();
        await this.executeTrade(portId, commId, qty, 'SELL');
      });
    });
  }

  public async executeTrade(
    portId: string,
    commodityId: string,
    quantity: number,
    type: 'BUY' | 'SELL'
  ): Promise<void> {
    if (quantity <= 0) return;

    try {
      const res = await fetch(`/api/ports/${portId}/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'acc_sol_captain',
          commodityId,
          quantity,
          type,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (type === 'BUY') {
          this.audio.playTradeBuySound();
        } else {
          this.audio.playTradeSellSound();
        }

        const actionText = type === 'BUY' ? 'Purchased' : 'Sold';
        const costText = type === 'BUY' ? `-${data.totalCredits} Cr` : `+${data.totalCredits} Cr`;
        this.showMarketToast(`✓ ${actionText} ${data.quantity}x ${data.commodityName} (${costText})`, false);

        if (data.hold) {
          this.playerCredits = data.hold.credits;
          this.playerCargoCapacity = data.hold.cargoCapacity;
          this.playerUsedCargo = data.hold.usedCargo;
          this.playerCargoHold = data.hold.cargo || [];
          this.updateHoldUI();
        }

        if (Array.isArray(data.updatedInventory)) {
          this.currentMarketItems = data.updatedInventory;
          this.renderMarketExchange(portId, this.currentMarketItems);
        } else {
          await this.loadPortInventory(portId);
        }
      } else {
        this.audio.playApWarningSound();
        let errMsg = 'Trade order rejected by station exchange.';
        switch (data.error) {
          case 'INSUFFICIENT_CREDITS':
            errMsg = `⚠️ Insufficient Credits! Requires ${data.requiredCredits || ''} Cr.`;
            break;
          case 'HOLD_CAPACITY_EXCEEDED':
          case 'CARGO_BAY_FULL':
            errMsg = `⚠️ Cargo Bay Full! Only ${data.freeCargo || 0} m³ available.`;
            break;
          case 'INSUFFICIENT_STOCK':
            errMsg = `⚠️ Station has insufficient stock (${data.availableStock || 0} available).`;
            break;
          case 'INSUFFICIENT_CARGO':
            errMsg = `⚠️ Insufficient Cargo in hold to sell (${data.availableCargo || 0} in hold).`;
            break;
          case 'OUT_OF_RANGE':
            errMsg = `⚠️ Trade Out of Range! Vessel must be docked in same sector.`;
            break;
          default:
            errMsg = `⚠️ Trade Error: ${data.error || 'Server rejected order'}`;
            break;
        }
        this.showMarketToast(errMsg, true);
      }
    } catch (err) {
      console.error('[TRADE] Trade execution failed:', err);
      this.audio.playApWarningSound();
      this.showMarketToast('⚠️ Network failure during transaction', true);
    }
  }

  public get cargoHold(): Array<{ commodity_id: string; name: string; quantity: number }> {
    return this.playerCargoHold;
  }

  public get activePortId(): string | null {
    return this.currentMarketPortId;
  }

  public async loadShipAndSector(): Promise<void> {
    try {
      const res = await fetch('/api/player/ship?playerId=acc_sol_captain');
      if (res.ok) {
        const data = await res.json();
        const loadedSectorId = data.ship.current_sector_id;
        const initialLoad = !this.hasInitialSceneLoaded;
        this.hasInitialSceneLoaded = true;

        this.currentSectorId = loadedSectorId;
        this.shipFuel = data.ship.fuel;
        this.maxShipFuel = data.ship.max_fuel;
        this.currentSectorName = data.currentSector.name;
        this.adjacentSectors = data.adjacentSectors;

        if (this.hudSector) {
          this.hudSector.textContent = `SEC-0${this.currentSectorId} // ${this.currentSectorName.toUpperCase()}`;
        }
        if (this.navFuelDisplay) {
          this.navFuelDisplay.textContent = `FUEL: ${this.shipFuel} / ${this.maxShipFuel}`;
        }

        // Connect Authoritative 20Hz Combat WebSocket (Milestone 0.3)
        this.initCombatWebSocket(this.currentSectorId);

        // On initial page load, if ship is persisted in Sector 2 or 3, render that environment!
        if (initialLoad && loadedSectorId !== 1) {
          this.loadSectorScene(loadedSectorId, data.currentSector.system_seed);
        }

        await this.refreshPlayerHold();
      }
    } catch (err) {
      console.warn('[NAV] Failed to load ship and sector:', err);
    }
  }

  public openNavModal(): void {
    if (this.isWarping) return;
    if (this.modalNav) {
      this.audio.playUiBlip();
      this.modalNav.classList.remove('hidden');

      if (this.navCurrentSectorTitle) {
        this.navCurrentSectorTitle.textContent = `SECTOR 0${this.currentSectorId} // ${this.currentSectorName.toUpperCase()}`;
      }
      if (this.navCurrentSectorSubtext) {
        const faction = this.currentSectorId === 1 ? 'SOL-PERIMETER LEAGUE' : this.currentSectorId === 2 ? 'UNCLAIMED VOID / HAZARD' : 'THE LITHOS AXIOM';
        this.navCurrentSectorSubtext = document.getElementById('nav-current-sector-subtext');
        if (this.navCurrentSectorSubtext) {
          this.navCurrentSectorSubtext.textContent = `SYSTEM SEED: ${this.currentSectorId * 101} // JURISDICTION: ${faction}`;
        }
      }
      if (this.navFuelDisplay) {
        this.navFuelDisplay.textContent = `FUEL: ${this.shipFuel} / ${this.maxShipFuel}`;
      }

      // Update Topology visual nodes
      [1, 2, 3].forEach((id) => {
        const node = document.getElementById(`node-sec-${id}`);
        if (node) {
          if (id === this.currentSectorId) {
            node.classList.add('active');
          } else {
            node.classList.remove('active');
          }
        }
      });

      // Render Jump Lanes dynamically
      if (this.navLanesList) {
        if (this.adjacentSectors.length === 0) {
          this.navLanesList.innerHTML = `<div class="nav-lane-card"><span class="nav-lane-target">NO ADJACENT WARP LANES DETECTED</span></div>`;
          return;
        }

        this.navLanesList.innerHTML = this.adjacentSectors
          .map((sec) => `
            <div class="nav-lane-card">
              <div class="nav-lane-info">
                <span class="nav-lane-target">SEC-0${sec.id} // ${sec.name.toUpperCase()}</span>
                <span class="nav-lane-details">FACTION: ${sec.controlling_faction.replace('FACTION_', '')} // SYSTEM SEED: ${sec.system_seed}</span>
                <span class="nav-lane-cost">⚡ Warp Cost: 5 AP + 1 Fuel</span>
              </div>
              <button class="hud-btn jump-btn" data-target-id="${sec.id}">
                ENGAGE JUMP 🚀
              </button>
            </div>
          `)
          .join('');

        // Attach jump click handlers to dynamically rendered buttons
        const jumpBtns = this.navLanesList.querySelectorAll('.jump-btn');
        jumpBtns.forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const targetId = parseInt((e.currentTarget as HTMLElement).getAttribute('data-target-id') || '0', 10);
            if (targetId > 0) {
              this.executeWarpJump(targetId);
            }
          });
        });
      }

      // Fetch and render Sub-Space Commerce Radar
      this.loadMarketRadar();
    }
  }

  private async loadMarketRadar(): Promise<void> {
    if (!this.navRadarRoutes) return;
    try {
      const res = await fetch('/api/market/intel');
      if (res.ok) {
        const intel = await res.json();
        if (intel.arbitrage && intel.arbitrage.length > 0) {
          this.navRadarRoutes.innerHTML = intel.arbitrage.slice(0, 4).map((arb: any) => `
            <div class="radar-arbitrage-card">
              <div class="radar-route-info">
                <span class="radar-route-title">${arb.commodityName}</span>
                <span class="radar-route-path">SEC-0${arb.fromSectorId} (${arb.fromPortName}) ➔ SEC-0${arb.toSectorId} (${arb.toPortName})</span>
              </div>
              <div class="radar-route-profit">
                <span class="profit-badge">+${arb.profitPerUnit.toFixed(1)} Cr</span>
                <span class="profit-label">SPREAD / UNIT</span>
              </div>
            </div>
          `).join('');
        } else {
          this.navRadarRoutes.innerHTML = `<div class="radar-loading">No active market disparities detected.</div>`;
        }
      }
    } catch {
      this.navRadarRoutes.innerHTML = `<div class="radar-loading">Subspace commerce relay offline.</div>`;
    }
  }

  public closeNavModal(): void {
    if (this.modalNav) {
      this.modalNav.classList.add('hidden');
    }
  }

  public async executeWarpJump(targetSectorId: number): Promise<void> {
    if (this.isWarping) return;
    this.closeNavModal();

    // Check pre-conditions locally
    if (this.playerAP.currentAP < 5) {
      this.audio.playApWarningSound();
      this.showApNotification('⚠️ INSUFFICIENT ACTION POINTS (Requires 5 AP to jump)', true);
      return;
    }
    if (this.shipFuel < 1) {
      this.audio.playApWarningSound();
      this.showApNotification('⚠️ INSUFFICIENT FUEL (Requires 1 unit Deuterium)', true);
      return;
    }

    // Begin Hyperspace Warp Transition
    this.isWarping = true;
    this.warpAnimationTime = 0;
    this.audio.playWarpDriveEngage();
    this.showApNotification(`🌌 ENGAGING HYPERSPACE JUMP -> SEC-0${targetSectorId}...`, false);

    // Call server jump API in parallel
    try {
      const res = await fetch('/api/navigate/jump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'acc_sol_captain', targetSectorId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        this.isWarping = false;
        this.camera.fov = this.baseFov;
        this.camera.updateProjectionMatrix();
        this.audio.playApWarningSound();
        this.showApNotification(`⚠️ ${data.error || 'WARP JUMP REJECTED'}`, true);
        return;
      }

      // Smooth delay for warp animation climax (~1.1s)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Update state from server response
      this.currentSectorId = data.toSector.id;
      this.currentSectorName = data.toSector.name;
      this.shipFuel = data.remainingFuel;
      this.playerAP.currentAP = data.currentAP;
      this.updateApUI();

      // Switch Sector Entities in Three.js Scene
      this.loadSectorScene(this.currentSectorId, data.toSector.system_seed);

      // Refresh ship and adjacent sectors
      await this.loadShipAndSector();
      this.updateHudSectorAllegiance();


      // Breakout audio & finish warp animation
      this.audio.playWarpExitChime();
      this.showApNotification(`🚀 WARP COMPLETE // ENTERED SEC-0${this.currentSectorId} (${this.currentSectorName})`, false);

      setTimeout(() => {
        this.isWarping = false;
        this.camera.fov = this.baseFov;
        this.camera.updateProjectionMatrix();
      }, 500);

    } catch (err) {
      this.isWarping = false;
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
      console.error('[WARP] Jump failed:', err);
      this.showApNotification('⚠️ SUB-SPACE TRANSIT COLLAPSE', true);
    }
  }

  public loadSectorScene(sectorId: number, seed: number): void {
    // 1. Remove & clean up old entities
    if (this.station) {
      this.scene.remove(this.station.group);
      this.station = null;
    }
    if (this.asteroidField) {
      this.scene.remove(this.asteroidField.group);
      this.asteroidField.dispose();
      this.asteroidField = null;
    }
    if (this.activePlanet) {
      this.scene.remove(this.activePlanet.group);
      this.activePlanet = null;
    }

    // 2. Adjust lighting & fog per sector atmosphere
    if (sectorId === 1) {
      // Sol-Perimeter: Crisp blue/cyan starlight, clean industrial fog
      this.scene.background = new THREE.Color(0x06080d);
      this.scene.fog = new THREE.FogExp2(0x06080d, 0.0022);
      this.starLight.color.setHex(0xfff5eb);
      this.ambientLight.color.setHex(0x28334a);

      // Aegis Terminal Space Station
      this.station = new SpaceStation({
        stationId: 'STATION_AEGIS_01',
        name: 'AEGIS TERMINAL',
        portClass: 1,
        factionId: 'FACTION_SOL',
        position: new THREE.Vector3(0, 0, 0),
      });
      this.scene.add(this.station.group);

      if (this.modalStationName) {
        this.modalStationName.textContent = 'AEGIS TERMINAL // SECTOR 01';
      }
      this.loadPortInventory('PORT_AEGIS_01');
    } else if (sectorId === 2) {
      // Void Expanse Hazard Zone: Violet/amber asteroid belt, eerie deep nebula
      this.scene.background = new THREE.Color(0x06050b);
      this.scene.fog = new THREE.FogExp2(0x06050b, 0.0035);
      this.starLight.color.setHex(0xd8b4fe);
      this.ambientLight.color.setHex(0x1e152d);

      // Procedural Asteroid Field
      this.asteroidField = new AsteroidField(seed, 45);
      this.scene.add(this.asteroidField.group);

      if (this.modalStationName) {
        this.modalStationName.textContent = 'NO STATION IN ORBIT // DEEP VOID';
      }
      this.loadPortInventory();
    } else if (sectorId === 3) {
      // Obsidian Smelter Station: High-temperature fiery volcanic glow
      this.scene.background = new THREE.Color(0x0d0707);
      this.scene.fog = new THREE.FogExp2(0x0d0707, 0.0028);
      this.starLight.color.setHex(0xff7b54);
      this.ambientLight.color.setHex(0x351919);

      // Smelter Space Station
      this.station = new SpaceStation({
        stationId: 'PORT_SMELTER_01',
        name: 'OBSIDIAN FOUNDRY 3',
        portClass: 2,
        factionId: 'FACTION_LITHOS',
        position: new THREE.Vector3(0, 0, 0),
      });
      this.scene.add(this.station.group);

      if (this.modalStationName) {
        this.modalStationName.textContent = 'OBSIDIAN FOUNDRY 3 // SECTOR 03';
      }
      this.loadPortInventory('PORT_SMELTER_01');
    }

    // Reset ship position slightly forward in the sector
    this.flightController.reset(new THREE.Vector3(0, 0, 18));

    // Connect Authoritative 20Hz Combat WebSocket for new sector (Milestone 0.3)
    this.initCombatWebSocket(sectorId);

    // Day 18: Load Sector Celestial Planet
    this.loadSectorPlanet(sectorId);
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });

    // Toggle Camera Mode
    const toggleCameraMode = () => {
      if (this.cameraMode === 'CHASE') {
        this.cameraMode = 'ORBIT';
        this.controls.enabled = true;
        this.controls.target.copy(this.flightController.position);
      } else {
        this.cameraMode = 'CHASE';
        this.controls.enabled = false;
      }
      if (this.btnToggleCam) {
        this.btnToggleCam.textContent = `Camera: ${this.cameraMode === 'CHASE' ? 'Chase' : 'Orbit'}`;
      }
      if (this.elCamMode) {
        this.elCamMode.textContent = this.cameraMode === 'CHASE' ? 'TACTICAL CHASE' : 'FREE ORBIT';
      }
    };
    this.btnToggleCam?.addEventListener('click', toggleCameraMode);

    // Toggle Dampeners
    const toggleDampeners = () => {
      const active = this.flightController.toggleDampeners();
      if (this.btnToggleDamp) {
        this.btnToggleDamp.textContent = `Dampeners: ${active ? 'ON' : 'OFF'}`;
      }
      if (this.elDampeners) {
        this.elDampeners.textContent = active ? 'ACTIVE' : 'OFFLINE';
        this.elDampeners.className = `telemetry-val ${active ? 'success' : 'warn'}`;
      }
    };
    this.btnToggleDamp?.addEventListener('click', toggleDampeners);

    // Reset Position to Docking Bay
    document.getElementById('btn-reset-pos')?.addEventListener('click', () => {
      this.flightController.reset(new THREE.Vector3(0, 0, 0));
    });

    // Toggle Grid
    document.getElementById('btn-toggle-grid')?.addEventListener('click', () => {
      this.sectorGrid.visible = !this.sectorGrid.visible;
    });

    // Faction Selector
    this.selectFaction?.addEventListener('change', () => {
      const selectedId = this.selectFaction?.value;
      if (selectedId && FACTION_STYLES[selectedId]) {
        this.generateShip(this.currentSeed, FACTION_STYLES[selectedId]);
      }
    });

    // Seed Regenerate & Randomize
    document.getElementById('btn-generate-seed')?.addEventListener('click', () => {
      if (this.inputSeed) {
        const val = parseInt(this.inputSeed.value, 10);
        if (!isNaN(val) && val > 0) this.generateShip(val);
      }
    });

    document.getElementById('btn-random-seed')?.addEventListener('click', () => {
      const randomSeed = Math.floor(Math.random() * 900000) + 10000;
      this.generateShip(randomSeed);
    });

    // Undock button click
    this.btnUndock?.addEventListener('click', () => {
      this.undockShip();
    });

    // Quick service button click (Recharge AP)
    this.btnQuickService?.addEventListener('click', () => {
      this.debugAddAP(50);
      if (this.btnQuickService) {
        this.btnQuickService.textContent = '⚡ RECHARGING POWER CORE...';
        setTimeout(() => {
          if (this.btnQuickService) {
            this.btnQuickService.textContent = '⚡ Recharge Core (+50 AP)';
          }
        }, 1200);
      }
    });

    // Dock Haggle action (Costs 1 AP)
    this.btnDockHaggle?.addEventListener('click', async () => {
      const ok = await this.spendAP('HAGGLE', 1);
      if (ok && this.modalOfficerQuote) {
        const intelQuotes = [
          `"Alright, Captain. Off the record: Smelter Station in Sec-03 has a massive silicate deficit right now. Buy cheap here, sell high there."`,
          `"Between us, a Lithos trade caravan was spotted heading coreward with refined crystals. Watch the jump lanes."`,
          `"Hegemony picket patrols have been probing the outer perimeter. Keep your jump capacitor charged at all times."`,
        ];
        const quote = intelQuotes[Math.floor(Math.random() * intelQuotes.length)];
        this.modalOfficerQuote.textContent = quote;
      }
    });

    // HUD AP Quick Spend Buttons
    this.btnApWarp?.addEventListener('click', () => {
      this.openNavModal();
    });

    this.btnApScan?.addEventListener('click', () => {
      this.spendAP('ORBITAL_SCAN', 3);
    });

    this.btnApExtract?.addEventListener('click', () => {
      this.spendAP('EXTRACTION', 8);
    });

    // Navigation & Hyperspace Modal Triggers (Day 8)
    this.btnOpenNav?.addEventListener('click', () => {
      this.openNavModal();
    });

    this.hudSector?.addEventListener('click', () => {
      this.openNavModal();
    });

    this.btnCloseNav?.addEventListener('click', () => {
      this.closeNavModal();
    });

    // Keydown Controls
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Day 16: Star Control II Alien Comms Modal Key Handling
      if (this.elAlienCommsModal && !this.elAlienCommsModal.classList.contains('hidden')) {
        if (e.code === 'Escape') {
          this.closeAlienComms();
          return;
        }
        if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5'].includes(e.code)) {
          const num = parseInt(e.key, 10);
          if (!isNaN(num) && num >= 1 && num <= this.alienCurrentOptions.length) {
            this.selectAlienDialogOption(num - 1);
          }
          return;
        }
        return; // Suppress other flight/game keys while in alien comms
      }

      // Day 18: Star Control II Planetary Orbital Survey Key Handling
      if (this.modalPlanetarySurvey && !this.modalPlanetarySurvey.classList.contains('hidden')) {
        if (e.code === 'Escape' || e.code === 'KeyO') {
          this.exitOrbit();
          return;
        }
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          this.performScannerSweep('MINERALS');
          return;
        }
        if (e.code === 'Digit2' || e.code === 'Numpad2') {
          this.performScannerSweep('BIO');
          return;
        }
        if (e.code === 'Digit3' || e.code === 'Numpad3') {
          this.performScannerSweep('ANOMALIES');
          return;
        }
        if (e.code === 'KeyP') {
          this.launchAtmosphericProbe();
          return;
        }
        return; // Suppress flight keys while in orbital survey console
      }

      if (e.code === 'KeyO') {
        if (this.activePlanet && this.activePlanet.isOrbitalProximity(this.flightController.position)) {
          this.enterOrbit();
          return;
        }
      }

      if (e.code === 'KeyJ') {
        if (this.modalNav && !this.modalNav.classList.contains('hidden')) {
          this.closeNavModal();
        } else {
          this.openNavModal();
        }
        return;
      }

      if (e.code === 'Escape') {
        if (this.modalPlanetarySurvey && !this.modalPlanetarySurvey.classList.contains('hidden')) {
          this.exitOrbit();
          return;
        }
        if (this.modalContainerLoot && !this.modalContainerLoot.classList.contains('hidden')) {
          this.closeContainerLootModal();
          return;
        }
        if (this.modalNav && !this.modalNav.classList.contains('hidden')) {
          this.closeNavModal();
          return;
        }
        if (this.isDocked) {
          this.undockShip();
          return;
        }
      }

      // If docked or currently warping, suppress flight movement keys
      if (this.isDocked || this.isWarping) {
        return;
      }

      switch (e.code) {
        case 'KeyF': {
          e.preventDefault();
          if (this.modalContainerLoot && !this.modalContainerLoot.classList.contains('hidden')) {
            this.lootAllCurrentContainer();
          } else if (this.targetedContainerId) {
            this.openContainerLootModal(this.targetedContainerId);
          }
          break;
        }
        case 'KeyW':
        case 'ArrowUp':
          this.flightController.setInput('forward', true);
          this.combatInputs.forward = true;
          this.sendCombatInputs();
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.flightController.setInput('reverse', true);
          this.combatInputs.reverse = true;
          this.sendCombatInputs();
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.flightController.setInput('turnLeft', true);
          this.combatInputs.turnLeft = true;
          this.sendCombatInputs();
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.flightController.setInput('turnRight', true);
          this.combatInputs.turnRight = true;
          this.sendCombatInputs();
          break;
        case 'KeyX':
          this.flightController.setInput('brake', true);
          this.combatInputs.brake = true;
          this.sendCombatInputs();
          break;
        case 'KeyQ':
          this.cycleWeapon();
          break;
        case 'Space': {
          e.preventDefault();
          this.combatInputs.firePrimary = true;
          this.sendCombatInputs();
          const activeW = this.weaponProfiles[this.activeWeaponIndex].id;
          if (activeW === 'PLASMA') {
            this.audio.playPlasmaFire();
          } else if (activeW === 'FLAK') {
            this.audio.playFlakFire();
          } else {
            this.audio.playLaserFire(false);
          }
          break;
        }
        case 'ShiftLeft':
        case 'ShiftRight':
          this.combatInputs.fireTactical = true;
          this.sendCombatInputs();
          break;
        case 'KeyZ':
          toggleDampeners();
          break;
        case 'KeyC':
          toggleCameraMode();
          break;
        case 'KeyG':
          this.sectorGrid.visible = !this.sectorGrid.visible;
          break;
        case 'KeyH':
          e.preventDefault();
          this.hailCurrentTargetOrEnvoy();
          break;
        case 'KeyE': {
          e.preventDefault();
          if (this.station) {
            const dockCheck = this.station.checkDocking(
              this.flightController.position,
              this.flightController.velocity.length()
            );
            if (dockCheck.canDock) {
              this.dockShip();
              break;
            }
          }
          // If not docking, toggle laser salvage mining beam
          this.toggleSalvageMining();
          break;
        }
        case 'KeyT': {
          e.preventDefault();
          this.toggleTowTether();
          break;
        }
        case 'Digit1':
          this.selectWeaponPreset(0);
          this.fireWeaponDirectly('PULSE');
          break;
        case 'Digit2':
          this.selectWeaponPreset(1);
          this.fireWeaponDirectly('PLASMA');
          break;
        case 'Digit3':
          this.combatInputs.fireTactical = true;
          this.sendCombatInputs();
          break;
        case 'Digit4':
          this.selectWeaponPreset(2);
          this.fireWeaponDirectly('FLAK');
          break;
        case 'Tab':
          e.preventDefault();
          this.cycleTargetLock();
          break;
      }
    });

    // Keyup Controls
    window.addEventListener('keyup', (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.flightController.setInput('forward', false);
          this.combatInputs.forward = false;
          this.sendCombatInputs();
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.flightController.setInput('reverse', false);
          this.combatInputs.reverse = false;
          this.sendCombatInputs();
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.flightController.setInput('turnLeft', false);
          this.combatInputs.turnLeft = false;
          this.sendCombatInputs();
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.flightController.setInput('turnRight', false);
          this.combatInputs.turnRight = false;
          this.sendCombatInputs();
          break;
        case 'KeyX':
          this.flightController.setInput('brake', false);
          this.combatInputs.brake = false;
          this.sendCombatInputs();
          break;
        case 'Space':
        case 'Digit1':
        case 'Digit2':
        case 'Digit4':
          this.combatInputs.firePrimary = false;
          this.sendCombatInputs();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'Digit3':
          this.combatInputs.fireTactical = false;
          this.sendCombatInputs();
          break;
      }
    });

    // Mouse Controls (M1 = Pulse Cannon, M2 = Plasma Accelerator)
    window.addEventListener('mousedown', (e: MouseEvent) => {
      if (this.isDocked || this.isWarping) return;
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement || (e.target as HTMLElement).closest('.hud-panel, .dock-modal-card, .nav-modal-card')) {
        return;
      }

      if (e.button === 0) {
        // Left Click -> High Slot 1 (Pulse)
        this.selectWeaponPreset(0);
        this.fireWeaponDirectly('PULSE');
      } else if (e.button === 2) {
        // Right Click -> High Slot 2 (Plasma)
        e.preventDefault();
        this.selectWeaponPreset(1);
        this.fireWeaponDirectly('PLASMA');
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        this.combatInputs.firePrimary = false;
        this.sendCombatInputs();
      }
    });

    window.addEventListener('contextmenu', (e: MouseEvent) => {
      // Prevent browser context menu during flight canvas interaction
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
      }
    });
  }

  public selectWeaponPreset(index: number): void {
    this.activeWeaponIndex = index;
    const profile = this.weaponProfiles[this.activeWeaponIndex];
    this.combatInputs.activeWeaponId = profile.id;
    this.sendCombatInputs();

    if (this.elActiveWeapon) {
      this.elActiveWeapon.textContent = profile.name;
      this.elActiveWeapon.style.color = profile.color;
    }

    // Update active preset visual on hotbar
    const slotEls = [this.elSlotHigh1, this.elSlotHigh2, this.elSlotMid2];
    slotEls.forEach((slot, i) => {
      if (slot) {
        if (i === index) slot.classList.add('active-preset');
        else slot.classList.remove('active-preset');
      }
    });

    this.audio.playUiBlip();
  }

  public cycleWeapon(): void {
    const nextIdx = (this.activeWeaponIndex + 1) % this.weaponProfiles.length;
    this.selectWeaponPreset(nextIdx);
    this.showApNotification(`WEAPON CYCLED: ${this.weaponProfiles[nextIdx].name}`, false);
  }

  private fireWeaponDirectly(weaponId: 'PULSE' | 'PLASMA' | 'FLAK'): void {
    this.combatInputs.activeWeaponId = weaponId;
    this.combatInputs.firePrimary = true;
    this.sendCombatInputs();
    this.lastFireTimes[weaponId] = Date.now();

    if (weaponId === 'PLASMA') {
      this.audio.playPlasmaFire();
    } else if (weaponId === 'FLAK') {
      this.audio.playFlakFire();
    } else {
      this.audio.playLaserFire(false);
    }
  }

  private cycleTargetLock(): void {
    if (this.availableDrones.length === 0) {
      this.primaryDroneTarget = null;
      return;
    }
    this.targetLockIndex = (this.targetLockIndex + 1) % this.availableDrones.length;
    this.primaryDroneTarget = this.availableDrones[this.targetLockIndex];
    this.audio.playUiBlip();
    if (this.primaryDroneTarget) {
      this.showApNotification(`🎯 TARGET LOCKED: ${this.primaryDroneTarget.name}`, false);
    }
  }

  /**
   * Main Render and Physics Update Loop
   */
  private animate(currentTime: number): void {
    requestAnimationFrame(this.animate);

    const deltaMs = currentTime - this.lastTime;
    this.lastTime = currentTime;
    const deltaSec = deltaMs / 1000;

    this.frameCount++;
    this.fpsTimer += deltaMs;
    if (this.fpsTimer >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
      if (this.elFps) this.elFps.textContent = `${this.currentFps} FPS`;
      if (this.elDrawCalls) this.elDrawCalls.textContent = `${this.renderer.info.render.calls}`;
    }

    // AP Dynamic Regeneration countdown & Periodic Sync (Day 7)
    this.apCountdownTimer += deltaSec;
    if (this.apCountdownTimer >= 1.0) {
      this.apCountdownTimer -= 1.0;
      if (this.playerAP.currentAP < this.playerAP.maxAP) {
        if (this.playerAP.nextRegenSeconds > 1) {
          this.playerAP.nextRegenSeconds -= 1;
          this.updateApUI();
        } else {
          // Time boundary reached, refresh canonical regenerated state
          this.fetchPlayerAP();
        }
      }
    }

    this.apSyncTimer += deltaSec;
    if (this.apSyncTimer >= 15.0) {
      this.apSyncTimer = 0;
      this.fetchPlayerAP();
    }

    // 1. Update Physics Integration (only if undocked)
    if (!this.isDocked) {
      this.flightController.update(deltaSec);
    }
    const telemetry = this.flightController.getTelemetry();

    // 2. Sync Ship Mesh Transform
    if (this.shipMesh) {
      this.shipMesh.position.copy(this.flightController.position);
      this.shipMesh.rotation.y = this.flightController.yaw;
    }

    // 3. Audio Engine Thruster State
    this.audio.setThrusterActive(
      !this.isDocked && (telemetry.isThrusting || telemetry.isReversing),
      Math.abs(telemetry.throttle)
    );

    // 4. Emit Thruster Particles
    if (!this.isDocked) {
      const isAfterburning = this.combatInputs.fireTactical && (telemetry.isThrusting || this.combatInputs.forward);
      if (isAfterburning) {
        this.thrusters.emitThrusterPlume(
          this.flightController.position,
          this.flightController.yaw,
          this.flightController.velocity,
          3.2
        );
      } else if (telemetry.isThrusting) {
        this.thrusters.emitThrusterPlume(
          this.flightController.position,
          this.flightController.yaw,
          this.flightController.velocity,
          1.2
        );
      } else if (telemetry.isReversing) {
        this.thrusters.emitThrusterPlume(
          this.flightController.position,
          this.flightController.yaw + Math.PI,
          this.flightController.velocity,
          0.6
        );
      }

      if (telemetry.isTurningLeft) {
        this.thrusters.emitRcsPuff(this.flightController.position, this.flightController.yaw, 'left');
      }
      if (telemetry.isTurningRight) {
        this.thrusters.emitRcsPuff(this.flightController.position, this.flightController.yaw, 'right');
      }
    }

    this.thrusters.update(deltaSec);

    // 4b. Update Combat VFX & Player Shield Forcefield (Day 12)
    this.combatVfx.update(deltaSec);
    this.playerShieldBubble.update(
      deltaSec,
      this.flightController.position,
      this.lastPlayerShields,
      this.lastPlayerMaxShields
    );

    // 5. Update Orbital Space Station or Asteroid Field
    if (this.station) {
      this.station.update(deltaSec);
    }
    if (this.asteroidField) {
      this.asteroidField.update(deltaSec);
    }

    const dockStatus = this.station
      ? this.station.checkDocking(this.flightController.position, telemetry.speed)
      : { inRange: false, canDock: false, distance: 999, message: 'NO STATION IN ORBIT // UNCLAIMED VOID SECTOR' };

    // 6. Hyperspace Warp Camera Distortion FX
    if (this.isWarping) {
      this.warpAnimationTime += deltaSec;
      const progress = Math.min(1.0, this.warpAnimationTime / 1.1);
      const targetFov = this.baseFov + Math.sin(progress * Math.PI) * 44;
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();

      // Relativistic camera vibration
      this.camera.position.x += (Math.random() - 0.5) * 0.4;
      this.camera.position.y += (Math.random() - 0.5) * 0.4;
    }

    // 7. Update Camera Tracking
    if (this.cameraMode === 'CHASE') {
      const forwardX = Math.sin(this.flightController.yaw);
      const forwardZ = Math.cos(this.flightController.yaw);

      const targetCamX = this.flightController.position.x - forwardX * 18;
      const targetCamY = 14 + (telemetry.speed / telemetry.maxSpeed) * 4;
      const targetCamZ = this.flightController.position.z - forwardZ * 18;

      const targetCamPos = new THREE.Vector3(targetCamX, targetCamY, targetCamZ);
      this.camera.position.lerp(targetCamPos, Math.min(deltaSec * 5.0, 1.0));

      const lookAhead = 4.0;
      const desiredLook = new THREE.Vector3(
        this.flightController.position.x + forwardX * lookAhead,
        0,
        this.flightController.position.z + forwardZ * lookAhead
      );
      this.currentLookTarget.lerp(desiredLook, Math.min(deltaSec * 8.0, 1.0));
      this.camera.lookAt(this.currentLookTarget);
    } else {
      this.controls.target.copy(this.flightController.position);
      this.controls.update();
    }

    // 7. Ambient Starfield Rotation
    this.starfield.rotation.y += 0.0001;

    // 8. Update Telemetry HUD
    this.updateFlightHUD(telemetry, dockStatus);

    // 8b. Update MMORPG Hotbar cooldown animations
    const now = Date.now();
    if (this.elCdHigh1) {
      const pulseCd = 0.16 * 1000;
      const elapsed = now - this.lastFireTimes.PULSE;
      const pct = Math.max(0, Math.min(100, (1 - elapsed / pulseCd) * 100));
      this.elCdHigh1.style.height = `${pct}%`;
    }
    if (this.elCdHigh2) {
      const plasmaCd = 0.45 * 1000;
      const elapsed = now - this.lastFireTimes.PLASMA;
      const pct = Math.max(0, Math.min(100, (1 - elapsed / plasmaCd) * 100));
      this.elCdHigh2.style.height = `${pct}%`;
    }
    if (this.elCdMid1) {
      this.elCdMid1.style.height = this.combatInputs.fireTactical ? '100%' : '0%';
      if (this.elSlotMid1) {
        if (this.combatInputs.fireTactical) this.elSlotMid1.classList.add('active-firing');
        else this.elSlotMid1.classList.remove('active-firing');
      }
    }
    if (this.elCdMid2) {
      const flakCd = 0.35 * 1000;
      const elapsed = now - this.lastFireTimes.FLAK;
      const pct = Math.max(0, Math.min(100, (1 - elapsed / flakCd) * 100));
      this.elCdMid2.style.height = `${pct}%`;
    }

    // 9. Update Tactical Target Reticle & Floating Loot Canisters (Milestone 0.3 / Day 13)
    this.updateTacticalReticle();
    this.updateLootCanisters(deltaSec);

    // 9b. Day 15: Update Sector Derelict Wrecks, Proximity Targeting & Tow Tether
    this.updateWrecksAndTether(deltaSec);

    // 9c. Day 18: Update Celestial Planet & In-Flight Orbital Guidance Banner
    this.updatePlanetaryGuidance(deltaSec);

    // 10. Render
    this.renderer.render(this.scene, this.camera);
  }

  private updateFlightHUD(telemetry: FlightTelemetry, dockStatus: DockingStatus): void {
    if (this.elSpeed) {
      this.elSpeed.textContent = `${telemetry.speed.toFixed(1)} m/s`;
    }
    if (this.elHeading) {
      this.elHeading.textContent = `${telemetry.headingDeg.toString().padStart(3, '0')}°`;
    }
    if (this.elShipPos) {
      const p = this.flightController.position;
      this.elShipPos.textContent = `X: ${p.x.toFixed(1)}  Z: ${p.z.toFixed(1)}`;
    }

    if (this.elTacticalModule) {
      this.elTacticalModule.textContent = this.combatInputs.fireTactical ? 'AFTERBURNER [BOOST]' : 'AFTERBURNER';
      this.elTacticalModule.style.color = this.combatInputs.fireTactical ? '#00f0ff' : '#f59e0b';
    }

    if (this.elDockingBanner && this.elDockingMsg) {
      if (this.isDocked) {
        this.elDockingMsg.textContent = 'STATION DOCK SECURED // MAGNETIC CLAMPS ACTIVE';
        this.elDockingBanner.className = 'hud-docking-banner ready';
      } else {
        this.elDockingMsg.textContent = dockStatus.message;
        if (dockStatus.canDock) {
          this.elDockingBanner.className = 'hud-docking-banner ready';
        } else if (dockStatus.inRange) {
          this.elDockingBanner.className = 'hud-docking-banner warning';
        } else {
          this.elDockingBanner.className = 'hud-docking-banner';
        }
      }
    }
  }

  // ============================================================================
  // MILESTONE 0.3: REAL-TIME COMBAT WEBSOCKET & TACTICAL RETICLE ENGINE
  // ============================================================================

  public initCombatWebSocket(sectorId: number): void {
    if (this.combatSocket) {
      try {
        this.combatSocket.close();
      } catch (e) {}
      this.combatSocket = null;
    }

    // Clean up old drone meshes and projectiles
    for (const mesh of this.droneMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.droneMeshes.clear();

    for (const pMesh of this.projectileMeshes.values()) {
      this.scene.remove(pMesh);
    }
    this.projectileMeshes.clear();

    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:3000/ws/combat?playerId=acc_sol_captain&sectorId=${sectorId}`;

    try {
      this.combatSocket = new WebSocket(wsUrl);

      this.combatSocket.onopen = () => {
        console.log(`[COMBAT-WS] Connected to Sector ${sectorId} 20Hz combat room.`);
        if (this.elTelemetryCombat) {
          this.elTelemetryCombat.textContent = 'ONLINE // 20Hz';
          this.elTelemetryCombat.style.color = '#38bdf8';
        }
      };

      this.combatSocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'TICK_SNAPSHOT') {
            this.handleCombatSnapshot(msg);
          } else if (msg.type === 'KILLMAIL_NOTIFICATION') {
            this.audio.playShipExplosionSound();
            this.openKillmailModal(msg.killmail);
          }
        } catch (err) {
          console.error('[COMBAT-WS] Parse error:', err);
        }
      };

      this.combatSocket.onclose = () => {
        console.warn(`[COMBAT-WS] Disconnected from Sector ${sectorId}`);
      };

      this.combatSocket.onerror = (err) => {
        console.warn('[COMBAT-WS] Socket error:', err);
      };
    } catch (err) {
      console.error('[COMBAT-WS] Failed to connect:', err);
    }
  }

  public sendCombatInputs(): void {
    if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
      const inputs = { ...this.combatInputs };
      if (this.isEscapePod) {
        inputs.firePrimary = false;
        inputs.fireTactical = false;
      }
      this.combatSocket.send(
        JSON.stringify({
          type: 'INPUT',
          inputs,
        })
      );
    }
  }

  private handleCombatSnapshot(snapshot: any): void {
    // 1. Player Telemetry & Stacked Vitals Update
    const playerEntity = snapshot.entities.find((e: any) => e.type === 'PLAYER');
    if (playerEntity) {
      this.lastPlayerShields = playerEntity.shields;
      this.lastPlayerMaxShields = playerEntity.maxShields;

      if (this.elTelemetryShields) {
        this.elTelemetryShields.textContent = `${playerEntity.shields} / ${playerEntity.maxShields}`;
      }
      if (this.elTelemetryHull) {
        this.elTelemetryHull.textContent = `${playerEntity.hp} / ${playerEntity.maxHp}`;
        this.elTelemetryHull.style.color = playerEntity.hp < 30 ? '#ef4444' : '#10b981';
      }
      if (this.elTelemetryEnergy) {
        this.elTelemetryEnergy.textContent = `${Math.round(playerEntity.energy)} / ${playerEntity.maxEnergy}`;
      }

      // Update MMORPG Stacked Vitals
      if (this.elVitalShieldBar) {
        const sPct = Math.max(0, Math.min(100, (playerEntity.shields / playerEntity.maxShields) * 100));
        this.elVitalShieldBar.style.width = `${sPct}%`;
      }
      if (this.elVitalShieldText) {
        this.elVitalShieldText.textContent = `${playerEntity.shields} / ${playerEntity.maxShields}`;
      }
      if (this.elVitalHullBar) {
        const hPct = Math.max(0, Math.min(100, (playerEntity.hp / playerEntity.maxHp) * 100));
        this.elVitalHullBar.style.width = `${hPct}%`;
        this.elVitalHullBar.style.background = playerEntity.hp < 30 ? '#ef4444' : 'linear-gradient(90deg, #059669, #10b981)';
      }
      if (this.elVitalHullText) {
        this.elVitalHullText.textContent = `${playerEntity.hp} / ${playerEntity.maxHp}`;
      }
      if (this.elVitalEnergyBar) {
        const ePct = Math.max(0, Math.min(100, (playerEntity.energy / playerEntity.maxEnergy) * 100));
        this.elVitalEnergyBar.style.width = `${ePct}%`;
      }
      if (this.elVitalEnergyText) {
        this.elVitalEnergyText.textContent = `${Math.round(playerEntity.energy)} / ${playerEntity.maxEnergy}`;
      }

      // Hotbar energy cost states
      if (this.elSlotHigh1) {
        if (playerEntity.energy < 8) this.elSlotHigh1.classList.add('insufficient-energy');
        else this.elSlotHigh1.classList.remove('insufficient-energy');
      }
      if (this.elSlotHigh2) {
        if (playerEntity.energy < 22) this.elSlotHigh2.classList.add('insufficient-energy');
        else this.elSlotHigh2.classList.remove('insufficient-energy');
      }
      if (this.elSlotMid1) {
        if (playerEntity.energy < 10) this.elSlotMid1.classList.add('insufficient-energy');
        else this.elSlotMid1.classList.remove('insufficient-energy');
      }
      if (this.elSlotMid2) {
        if (playerEntity.energy < 18) this.elSlotMid2.classList.add('insufficient-energy');
        else this.elSlotMid2.classList.remove('insufficient-energy');
      }

      // Day 14: Check Escape Pod state
      const wasEscapePod = this.isEscapePod;
      this.isEscapePod = !!playerEntity.isEscapePod || playerEntity.hullClass === 'ESCAPE_POD';

      if (this.isEscapePod) {
        if (!wasEscapePod) {
          this.audio.playShipExplosionSound();
          if (this.shipMesh) this.shipMesh.visible = false;
          if (!this.escapePodMesh) {
            this.escapePodMesh = this.createEscapePodMesh();
            this.scene.add(this.escapePodMesh);
          }
          this.escapePodMesh.visible = true;
        }

        // Keep escape pod mesh positioned at ship position
        if (this.escapePodMesh) {
          this.escapePodMesh.position.copy(this.flightController.position);
          this.escapePodMesh.rotation.y = this.flightController.yaw;
        }

        // Show Escape Pod HUD & timer
        if (this.elEscapePodHud) {
          this.elEscapePodHud.classList.remove('hidden');
          const sec = typeof playerEntity.lifeSupportSeconds === 'number' ? playerEntity.lifeSupportSeconds : 300;
          const mins = Math.floor(sec / 60);
          const remSec = Math.floor(sec % 60);
          if (this.elPodTimerClock) {
            this.elPodTimerClock.textContent = `${mins.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`;
          }

          if (sec <= 60) {
            this.elEscapePodHud.classList.add('critical');
            const now = Date.now();
            if (now - this.lastKlaxonTime > 3000) {
              this.lastKlaxonTime = now;
              this.audio.playKlaxonSound();
            }
          } else {
            this.elEscapePodHud.classList.remove('critical');
          }
        }
      } else {
        if (wasEscapePod) {
          if (this.escapePodMesh) this.escapePodMesh.visible = false;
          if (this.shipMesh) this.shipMesh.visible = true;
          if (this.elEscapePodHud) this.elEscapePodHud.classList.add('hidden');
        }
      }
    }

    // 2. Drone Mesh & Forcefield Shield Bubble Synchronization
    const drones = snapshot.entities.filter((e: any) => e.type === 'DRONE' && e.state !== 'DESTROYED');
    const droneIds = new Set(drones.map((d: any) => d.id));
    this.availableDrones = drones;

    // Remove defunct meshes & shield bubbles
    for (const [id, mesh] of this.droneMeshes.entries()) {
      if (!droneIds.has(id)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.droneMeshes.delete(id);
      }
    }
    for (const [id, sb] of this.droneShieldBubbles.entries()) {
      if (!droneIds.has(id)) {
        this.scene.remove(sb.mesh);
        sb.dispose();
        this.droneShieldBubbles.delete(id);
      }
    }

    // Update or spawn drones
    let nearestDrone: any = null;
    let minDroneDist = Infinity;

    for (const drone of drones) {
      let mesh = this.droneMeshes.get(drone.id);
      if (!mesh) {
        const droneStyle = FACTION_STYLES.FACTION_VAELIC;
        const res = ProceduralHullGenerator.generate({
          seed: drone.hullSeed || 98765,
          faction: droneStyle,
        });

        const mat = new THREE.MeshStandardMaterial({
          color: droneStyle.palette.primary,
          roughness: 0.35,
          metalness: 0.85,
          flatShading: true,
          emissive: droneStyle.palette.engineGlow,
          emissiveIntensity: 0.4,
        });

        mesh = new THREE.Mesh(res.geometry, mat);
        mesh.scale.set(0.9, 0.9, 0.9);
        this.scene.add(mesh);
        this.droneMeshes.set(drone.id, mesh);
      }

      // Smooth position lerp
      mesh.position.x = mesh.position.x + (drone.x - mesh.position.x) * 0.45;
      mesh.position.z = mesh.position.z + (drone.z - mesh.position.z) * 0.45;
      mesh.rotation.y = drone.yaw;

      // Update 3D Forcefield Shield Bubble for this drone
      let sb = this.droneShieldBubbles.get(drone.id);
      if (!sb) {
        sb = new ShieldBubble(4.2, true);
        this.scene.add(sb.mesh);
        this.droneShieldBubbles.set(drone.id, sb);
      }
      sb.update(0.05, mesh.position, drone.shields, drone.maxShields);

      const pPos = this.flightController.position;
      const dist = Math.sqrt((drone.x - pPos.x) ** 2 + (drone.z - pPos.z) ** 2);
      if (dist < minDroneDist) {
        minDroneDist = dist;
        nearestDrone = drone;
      }
    }

    // Set targeted drone
    if (drones.length > 0) {
      if (this.targetLockIndex >= drones.length) this.targetLockIndex = 0;
      this.primaryDroneTarget = drones[this.targetLockIndex] || nearestDrone;
    } else {
      this.primaryDroneTarget = null;
    }

    // 2b. Scavenger Vessel Synchronization (Day 14)
    const scavengers = snapshot.entities.filter((e: any) => e.type === 'SCAVENGER' && e.state !== 'DESTROYED');
    const scavengerIds = new Set(scavengers.map((s: any) => s.id));

    for (const [id, mesh] of this.scavengerMeshes.entries()) {
      if (!scavengerIds.has(id)) {
        this.scene.remove(mesh);
        mesh.traverse((c) => {
          if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
        });
        this.scavengerMeshes.delete(id);
      }
    }

    for (const scav of scavengers) {
      let mesh = this.scavengerMeshes.get(scav.id);
      if (!mesh) {
        mesh = this.createScavengerMesh();
        this.scene.add(mesh);
        this.scavengerMeshes.set(scav.id, mesh);
      }

      mesh.position.x = mesh.position.x + (scav.x - mesh.position.x) * 0.45;
      mesh.position.z = mesh.position.z + (scav.z - mesh.position.z) * 0.45;
      mesh.rotation.y = scav.yaw;
    }

    if (this.elTelemetryCombat) {
      if (drones.length > 0) {
        this.elTelemetryCombat.textContent = `ALERT: ${drones.length} HOSTILE`;
        this.elTelemetryCombat.style.color = '#ef4444';
      } else {
        this.elTelemetryCombat.textContent = 'CLEAR // 20Hz';
        this.elTelemetryCombat.style.color = '#38bdf8';
      }
    }

    // 3. Projectile Mesh Synchronization with Ballistic Profiles
    const activeProjIds = new Set(snapshot.projectiles.map((p: any) => p.id));
    for (const [id, pMesh] of this.projectileMeshes.entries()) {
      if (!activeProjIds.has(id)) {
        this.scene.remove(pMesh);
        this.projectileMeshes.delete(id);
      }
    }

    for (const proj of snapshot.projectiles) {
      let pMesh = this.projectileMeshes.get(proj.id);
      if (!pMesh) {
        if (proj.projType === 'PLASMA') {
          pMesh = new THREE.Mesh(this.projectileSphereGeom, this.projectileMatEmerald);
        } else if (proj.projType === 'FLAK') {
          pMesh = new THREE.Mesh(this.projectileFlakGeom, this.projectileMatAmber);
        } else {
          // PULSE
          pMesh = new THREE.Mesh(
            this.projectileGeom,
            proj.color === '#ff2a5f' ? this.projectileMatRed : this.projectileMatCyan
          );
        }
        this.scene.add(pMesh);
        this.projectileMeshes.set(proj.id, pMesh);
      }

      pMesh.position.set(proj.x, 0.4, proj.z);

      // Orient cylinder along velocity vector
      const angle = Math.atan2(proj.vx, proj.vz);
      pMesh.rotation.y = angle;
      pMesh.rotation.x = Math.PI / 2;
    }

    // 3b. Floating Loot Container Canister Synchronization (Day 13)
    const containers = snapshot.containers || [];
    const activeContainerIds = new Set(containers.map((c: any) => c.id));
    this.activeLootContainers.clear();
    for (const c of containers) {
      this.activeLootContainers.set(c.id, c);
    }

    for (const [id, cGroup] of this.containerMeshes.entries()) {
      if (!activeContainerIds.has(id)) {
        this.scene.remove(cGroup);
        cGroup.traverse((child) => {
          if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
        });
        this.containerMeshes.delete(id);
      }
    }

    for (const c of containers) {
      let cGroup = this.containerMeshes.get(c.id);
      if (!cGroup) {
        cGroup = this.createCanisterMesh(c.rarity);
        cGroup.position.set(c.x, 0.5, c.z);
        this.scene.add(cGroup);
        this.containerMeshes.set(c.id, cGroup);
      }
      cGroup.position.x = c.x;
      cGroup.position.z = c.z;
    }

    // 3.5 Day 15: Sync Persistent 3D Sector Wrecks
    const wrecks = snapshot.wrecks || [];
    const activeWreckIds = new Set<string>();
    this.activeWrecks.clear();

    for (const w of wrecks) {
      activeWreckIds.add(w.id);
      this.activeWrecks.set(w.id, w);
    }

    for (const [id, wGroup] of this.wreckMeshes.entries()) {
      if (!activeWreckIds.has(id)) {
        this.scene.remove(wGroup);
        wGroup.traverse((child) => {
          if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
        });
        this.wreckMeshes.delete(id);
      }
    }

    for (const w of wrecks) {
      let wGroup = this.wreckMeshes.get(w.id);
      if (!wGroup) {
        wGroup = this.createWreckMesh(w);
        wGroup.position.set(w.x, 0.0, w.z);
        wGroup.rotation.y = w.rotation || 0;
        this.scene.add(wGroup);
        this.wreckMeshes.set(w.id, wGroup);
      }
      wGroup.position.x = w.x;
      wGroup.position.z = w.z;
      wGroup.rotation.y = w.rotation || 0;
    }

    // Tow Cable Check
    if (playerEntity && playerEntity.towedWreckId) {
      this.currentTowedWreckId = playerEntity.towedWreckId;
      const towedWreck = this.activeWrecks.get(playerEntity.towedWreckId);
      if (towedWreck) {
        const pPos = new THREE.Vector3(playerEntity.x, 0, playerEntity.z);
        const wPos = new THREE.Vector3(towedWreck.x, 0, towedWreck.z);
        const dist = pPos.distanceTo(wPos);
        this.updateTowCable(pPos, wPos, dist);

        if (this.elTowCableHud) {
          this.elTowCableHud.classList.remove('hidden');
          if (this.elTowTargetName) this.elTowTargetName.textContent = towedWreck.shipName;
          if (this.elTowDistMetric) this.elTowDistMetric.textContent = `${dist.toFixed(1)} u`;
          if (this.elTowTensionBadge) {
            const isStrain = dist > 18.0;
            this.elTowTensionBadge.className = `tow-status-badge ${isStrain ? 'tension-strain' : 'tension-nominal'}`;
            this.elTowTensionBadge.textContent = isStrain ? 'TENSION: HIGH STRAIN' : 'TENSION: NOMINAL';
          }
        }
      }
    } else {
      this.currentTowedWreckId = null;
      if (this.towCableMesh) this.towCableMesh.visible = false;
      if (this.elTowCableHud) this.elTowCableHud.classList.add('hidden');
    }

    // Laser Salvage Beam Check
    if (playerEntity && playerEntity.isMiningWreckId) {
      const miningWreck = this.activeWrecks.get(playerEntity.isMiningWreckId);
      if (miningWreck) {
        const pPos = new THREE.Vector3(playerEntity.x, 0.4, playerEntity.z);
        const wPos = new THREE.Vector3(miningWreck.x, 0.4, miningWreck.z);
        this.updateSalvageBeam(pPos, wPos);
        this.audio.playMiningLaserSound();
      }
    } else {
      this.hideSalvageBeam();
    }

    // 4. Process Combat Events (VFX, Audio & Alerts)
    if (snapshot.events && snapshot.events.length > 0) {
      for (const ev of snapshot.events) {
        if (ev.type === 'HIT') {
          const impactPos = new THREE.Vector3(ev.x, 0, ev.z);
          if (ev.hitShield) {
            this.combatVfx.emitShieldSparks(impactPos);
            if (playerEntity && ev.targetId === playerEntity.id) {
              this.playerShieldBubble.triggerImpact(false);
            } else if (this.droneShieldBubbles.has(ev.targetId)) {
              this.droneShieldBubbles.get(ev.targetId)!.triggerImpact(true);
            }
            this.audio.playShieldDeflection();
          } else {
            this.combatVfx.emitHullBreachSparks(impactPos);
            this.audio.playShieldDeflection();
          }
        } else if (ev.type === 'SHIELD_BREAK') {
          const breakPos = new THREE.Vector3(ev.x, 0, ev.z);
          this.combatVfx.emitShieldBreakBurst(breakPos);
          this.audio.playShieldBreakSound();
          if (playerEntity && ev.targetId === playerEntity.id) {
            this.showApNotification('⚡ SHIELD COLLAPSE // VULNERABLE TO HULL DAMAGE', true);
          }
        } else if (ev.type === 'DESTROYED') {
          const expPos = new THREE.Vector3(ev.x, 0, ev.z);
          this.combatVfx.emitExplosionDebris(expPos);
          this.audio.playExplosion();
          this.showApNotification('💥 HOSTILE TARGET DESTROYED!', false);
        } else if (ev.type === 'POD_EJECTED') {
          const podPos = new THREE.Vector3(ev.x, 0, ev.z);
          this.combatVfx.emitExplosionDebris(podPos);
          this.audio.playExplosion();
          this.showApNotification('🚨 CRITICAL HULL BREACH // EJECTED IN ESCAPE POD', true);
        } else if (ev.type === 'LOOT_SPAWNED') {
          this.showApNotification(`📦 SALVAGE CANISTER DETECTED // ${ev.data?.title || 'CARGO'}`, false);
        } else if (ev.type === 'LOOT_COLLECTED') {
          if (ev.data?.playerId === 'commander-1') {
            this.showApNotification(`📦 CARGO SECURED // TRANSFERRED TO SHIP LOCKER`, false);
          }
        } else if (ev.type === 'CONTAINER_SCOOPED') {
          this.showApNotification(`📦 ${ev.data?.scavengerName || 'Scavenger'} scooped ${ev.data?.title || 'Canister'}!`, false);
        } else if (ev.type === 'LIFE_SUPPORT_EXHAUSTED') {
          this.showApNotification('⚠️ LIFE SUPPORT EXHAUSTED: Initiating emergency clone recall!', true);
          this.handleEmergencyRecall();
        } else if (ev.type === 'WRECK_SPAWNED') {
          this.showApNotification(`🛰️ DERELICT WRECK FORMED // ${ev.data?.shipName || 'WRECK'}`, false);
        } else if (ev.type === 'TOW_ATTACHED') {
          this.audio.playTowCableAttachSound();
          this.showApNotification(`🪝 MAGNETIC TOW TETHER ATTACHED // ${ev.data?.wreckName || 'DERELICT'}`, false);
        } else if (ev.type === 'TOW_RELEASED') {
          this.audio.playTowCableReleaseSound();
          this.showApNotification('🪝 MAGNETIC TOW TETHER RELEASED', false);
        } else if (ev.type === 'SALVAGE_BEAM_TICK') {
          this.showApNotification(`⚡ EXTRACTED ${ev.data?.extracted || 10}x SCRAP ALLOY`, false);
        } else if (ev.type === 'WRECK_DISINTEGRATED') {
          this.showApNotification('💨 DERELICT DISINTEGRATED // REPOSITORIES EXHAUSTED', false);
        } else if (ev.type === 'TRUCE_DECLARED') {
          this.startTruceCountdown(Math.floor((ev.data?.durationMs || 300000) / 1000));
          this.showApNotification('🕊️ CEASEFIRE TRUCE CONFIRMED // PATROLS DISARMED', false);
          this.refreshFactionStandings();
        } else if (ev.type === 'TRUCE_BROKEN') {
          if (this.truceTimerInterval) clearInterval(this.truceTimerInterval);
          this.activeTruceExpiresAt = null;
          if (this.elHudTruceTimerPill) this.elHudTruceTimerPill.classList.add('hidden');
          this.showApNotification('⚠️ CEASEFIRE VIOLATED! Hostile patrols engaging!', true);
          this.audio.playApWarningSound();
          this.refreshFactionStandings();
        } else if (ev.type === 'DESTROYED') {
          this.refreshFactionStandings();
        }
      }
    }
  }


  private updateTacticalReticle(): void {
    if (!this.primaryDroneTarget) {
      if (this.elTacticalReticle) this.elTacticalReticle.classList.add('hidden');
      if (this.elTargetTelemetryHud) this.elTargetTelemetryHud.classList.add('hidden');
      return;
    }

    const targetPos = new THREE.Vector3(this.primaryDroneTarget.x, 0, this.primaryDroneTarget.z);
    const pPos = this.flightController.position;
    const dist = pPos.distanceTo(targetPos);

    if (dist > 180) {
      if (this.elTacticalReticle) this.elTacticalReticle.classList.add('hidden');
      if (this.elTargetTelemetryHud) this.elTargetTelemetryHud.classList.add('hidden');
      return;
    }

    // 1. Update Top-Center Target Telemetry Box (MMO Style)
    if (this.elTargetTelemetryHud) {
      this.elTargetTelemetryHud.classList.remove('hidden');
      if (this.elTargetName) {
        this.elTargetName.textContent = this.primaryDroneTarget.name.toUpperCase();
      }
      if (this.elTargetFaction) {
        const truceSuffix = (this.primaryDroneTarget as any).state === 'TRUCE' ? ' [🕊️ TRUCE]' : '';
        this.elTargetFaction.textContent = (this.primaryDroneTarget.faction || 'HEGEMONY') + truceSuffix;
      }

      if (this.elTargetDistance) {
        this.elTargetDistance.textContent = `${dist.toFixed(1)} u`;
      }
      const shieldPct = Math.max(0, Math.min(100, (this.primaryDroneTarget.shields / this.primaryDroneTarget.maxShields) * 100));
      const hullPct = Math.max(0, Math.min(100, (this.primaryDroneTarget.hp / this.primaryDroneTarget.maxHp) * 100));

      if (this.elTargetShieldBar) {
        this.elTargetShieldBar.style.width = `${shieldPct}%`;
      }
      if (this.elTargetShieldVal) {
        this.elTargetShieldVal.textContent = `${this.primaryDroneTarget.shields}/${this.primaryDroneTarget.maxShields}`;
      }
      if (this.elTargetHullBar) {
        this.elTargetHullBar.style.width = `${hullPct}%`;
      }
      if (this.elTargetHullVal) {
        this.elTargetHullVal.textContent = `${this.primaryDroneTarget.hp}/${this.primaryDroneTarget.maxHp}`;
      }
    }

    // 2. Project 3D target coordinates to 2D screen coordinates for 3D Reticle
    if (!this.elTacticalReticle) return;

    const screenCoord = targetPos.clone().project(this.camera);

    // Behind camera check
    if (screenCoord.z > 1.0) {
      this.elTacticalReticle.classList.add('hidden');
      return;
    }

    const x = (screenCoord.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(screenCoord.y * 0.5) + 0.5) * window.innerHeight;

    this.elTacticalReticle.style.left = `${Math.round(x)}px`;
    this.elTacticalReticle.style.top = `${Math.round(y)}px`;
    this.elTacticalReticle.classList.remove('hidden');

    if (this.elReticleName) {
      const isTruce = (this.primaryDroneTarget as any).state === 'TRUCE';
      this.elReticleName.textContent = this.primaryDroneTarget.name.toUpperCase() + (isTruce ? ' [🕊️ TRUCE]' : '');
    }

    if (this.elReticleRange) {
      this.elReticleRange.textContent = `RANGE: ${dist.toFixed(1)}u`;
    }
    const shieldPct = Math.max(0, Math.min(100, (this.primaryDroneTarget.shields / this.primaryDroneTarget.maxShields) * 100));
    const hullPct = Math.max(0, Math.min(100, (this.primaryDroneTarget.hp / this.primaryDroneTarget.maxHp) * 100));

    if (this.elReticleShieldFill) {
      this.elReticleShieldFill.style.width = `${shieldPct}%`;
    }
    if (this.elReticleHullFill) {
      this.elReticleHullFill.style.width = `${hullPct}%`;
    }
  }

  /**
   * Day 13: Procedural 3D Hexagonal Floating Canister Mesh
   */
  private createCanisterMesh(rarity: string): THREE.Group {
    const group = new THREE.Group();
    const rarityColors: Record<string, number> = {
      COMMON: 0x94a3b8,
      UNCOMMON: 0x22c55e,
      RARE: 0x38bdf8,
      EPIC: 0xa855f7,
      LEGENDARY: 0xf59e0b,
    };
    const glowColor = rarityColors[rarity] || 0x38bdf8;

    // Outer hexagonal body
    const bodyGeom = new THREE.CylinderGeometry(1.1, 1.1, 2.4, 6);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.35,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    group.add(body);

    // Glowing energy bands (top, center, bottom)
    const ringGeom = new THREE.TorusGeometry(1.15, 0.08, 8, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: glowColor });
    [-0.7, 0, 0.7].forEach((y) => {
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      group.add(ring);
    });

    // Pulsing point light
    const light = new THREE.PointLight(glowColor, 1.2, 12);
    group.add(light);
    return group;
  }

  /**
   * Day 13: Updates rotating canister animations and nearest loot canister detection
   */
  private updateLootCanisters(deltaSec: number): void {
    // 1. Rotate meshes
    for (const cGroup of this.containerMeshes.values()) {
      cGroup.rotation.y += deltaSec * 1.2;
    }

    // 2. Find closest canister within 25u
    const pPos = this.flightController.position;
    let nearestContainer: any = null;
    let minContainerDist = Infinity;

    for (const c of this.activeLootContainers.values()) {
      const dist = Math.hypot(c.x - pPos.x, c.z - pPos.z);
      if (dist < minContainerDist) {
        minContainerDist = dist;
        nearestContainer = c;
      }
    }

    if (nearestContainer && minContainerDist <= 25.0) {
      this.targetedContainerId = nearestContainer.id;
      if (this.elLootPromptHud && this.elLootPromptText) {
        this.elLootPromptHud.classList.remove('hidden');
        this.elLootPromptText.textContent = `PRESS [F] TO SECURE ${nearestContainer.rarity} CARGO (${minContainerDist.toFixed(1)}u)`;
      }
      if (this.elLootDistanceDisplay && this.activeLootModalContainer?.id === nearestContainer.id) {
        this.elLootDistanceDisplay.textContent = `RANGE: ${minContainerDist.toFixed(1)}u`;
      }
    } else {
      this.targetedContainerId = null;
      if (this.elLootPromptHud) {
        this.elLootPromptHud.classList.add('hidden');
      }
      if (this.modalContainerLoot && !this.modalContainerLoot.classList.contains('hidden') && minContainerDist > 30.0) {
        this.closeContainerLootModal();
      }
    }
  }

  /**
   * Day 13: Opens EVE-style container loot manifest modal
   */
  public openContainerLootModal(containerId: string): void {
    const container = this.activeLootContainers.get(containerId);
    if (!container) return;
    this.activeLootModalContainer = container;

    if (this.modalLootRarity) {
      this.modalLootRarity.textContent = `${container.rarity} RECOVERY`;
      this.modalLootRarity.className = `dock-badge loot-rarity-badge rarity-${container.rarity.toLowerCase()}`;
    }
    if (this.modalLootTitle) {
      this.modalLootTitle.textContent = container.title;
    }
    if (this.elLootDistanceDisplay) {
      const pPos = this.flightController.position;
      const dist = Math.hypot(container.x - pPos.x, container.z - pPos.z);
      this.elLootDistanceDisplay.textContent = `RANGE: ${dist.toFixed(1)}u`;
    }
    if (this.elLootItemCount) {
      this.elLootItemCount.textContent = `${container.items.length} ITEMS SECURED`;
    }

    if (this.elLootItemsList) {
      this.elLootItemsList.innerHTML = '';
      container.items.forEach((item: any) => {
        const itemCard = document.createElement('div');
        const rarity = item.rarity ? item.rarity.toLowerCase() : 'common';
        itemCard.className = `loot-item-card rarity-${rarity}`;

        const mfgHtml = item.manufacturer ? `<span class="mfg-badge">${item.manufacturer}</span>` : '';
        const specsHtml = item.category === 'COMMODITY'
          ? `Qty: ${item.quantity || 1} • Unit Value: ${item.unitValue || 0} Cr`
          : `⚡ ${item.energyCost || 0} MW • 🧠 ${item.cpuCost || 0} tf`;

        let affixesHtml = '';
        if (item.affixes && item.affixes.length > 0) {
          affixesHtml = `<div class="loot-item-stat-row">${item.affixes.map((a: any) => a.description).join(' • ')}</div>`;
        }

        itemCard.innerHTML = `
          <div class="loot-item-info">
            <div class="loot-item-title-row">
              <span class="rarity-pill rarity-${rarity}">${item.rarity || 'COMMODITY'}</span>
              <span>${item.customName || item.name}</span>
              ${mfgHtml}
            </div>
            <span class="slot-item-sub">${specsHtml}</span>
            ${affixesHtml}
          </div>
        `;
        this.elLootItemsList!.appendChild(itemCard);
      });
    }

    if (this.modalContainerLoot) {
      this.modalContainerLoot.classList.remove('hidden');
    }
    this.audio.playUiBlip();
  }

  /**
   * Day 13: Closes container loot modal
   */
  public closeContainerLootModal(): void {
    if (this.modalContainerLoot) {
      this.modalContainerLoot.classList.add('hidden');
    }
    this.activeLootModalContainer = null;
  }

  /**
   * Day 13: Sends LOOT_CONTAINER request to authoritative server
   */
  public lootAllCurrentContainer(): void {
    if (!this.activeLootModalContainer) return;
    const cid = this.activeLootModalContainer.id;

    if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
      this.combatSocket.send(JSON.stringify({
        type: 'LOOT_CONTAINER',
        containerId: cid,
      }));
    }

    this.audio.playLootPickupSound();
    this.showApNotification('📦 CARGO SECURED // TRANSFERRED TO SHIP LOCKER', false);
    this.closeContainerLootModal();
  }

  /**
   * Day 13, 14, 15 & 16: Station Dock Tab Switcher (Exchange / Outfitting / Armory / Contracts / Salvage / Diplomacy)
   */
  public switchStationTab(tab: 'exchange' | 'outfitting' | 'armory' | 'contracts' | 'salvage' | 'diplomacy'): void {
    this.activeStationTab = tab as any;
    this.audio.playUiBlip();

    this.tabBtnExchange?.classList.toggle('active', tab === 'exchange');
    this.tabBtnOutfitting?.classList.toggle('active', tab === 'outfitting');
    this.tabBtnArmory?.classList.toggle('active', tab === 'armory');
    this.tabBtnContracts?.classList.toggle('active', tab === 'contracts');
    this.tabBtnSalvage?.classList.toggle('active', tab === 'salvage');
    this.tabBtnDiplomacy?.classList.toggle('active', tab === 'diplomacy');

    this.viewTabExchange?.classList.toggle('hidden', tab !== 'exchange');
    this.viewTabOutfitting?.classList.toggle('hidden', tab !== 'outfitting');
    this.viewTabArmory?.classList.toggle('hidden', tab !== 'armory');
    this.viewTabContracts?.classList.toggle('hidden', tab !== 'contracts');
    this.viewTabSalvage?.classList.toggle('hidden', tab !== 'salvage');
    this.viewTabDiplomacy?.classList.toggle('hidden', tab !== 'diplomacy');

    if (tab === 'outfitting') {
      this.loadOutfittingData();
    } else if (tab === 'armory') {
      this.loadArmoryData();
    } else if (tab === 'contracts') {
      this.loadContractsData();
    } else if (tab === 'salvage') {
      this.loadSalvageData();
    } else if (tab === 'diplomacy') {
      this.loadDiplomacyData();
      this.refreshAstrometryBureau();
    } else if (tab === 'exchange') {
      this.loadPortInventory();
    }
  }

  /**
   * Day 13: Fetches player loadout, locker storage, and validates engineering budgets
   */
  public async loadOutfittingData(): Promise<void> {
    try {
      const res = await fetch('/api/outfitting/player?playerId=acc_sol_captain');
      if (!res.ok) return;
      const data = await res.json();
      this.playerLoadout = data;

      const { fitted, locker, powerGridMax, powerGridUsed, cpuMax, cpuUsed } = data;
      const loadout = fitted || {};
      const lockerList = locker || [];

      const pgMax = powerGridMax || 120;
      const cpuMaxVal = cpuMax || 180;
      const totalPg = Number(powerGridUsed) || 0;
      const totalCpu = Number(cpuUsed) || 0;
      const pgPct = Math.min(100, (totalPg / pgMax) * 100);
      const cpuPct = Math.min(100, (totalCpu / cpuMaxVal) * 100);

      this.isLoadoutOverBudget = totalPg > pgMax || totalCpu > cpuMaxVal;

      if (this.valFittingPg) {
        this.valFittingPg.textContent = `${totalPg.toFixed(1)} / ${pgMax.toFixed(1)} MW (${pgPct.toFixed(1)}%)`;
        this.valFittingPg.style.color = totalPg > pgMax ? '#ef4444' : '#f8fafc';
      }
      if (this.barFittingPg) {
        this.barFittingPg.style.width = `${Math.min(100, pgPct)}%`;
        if (totalPg > pgMax) this.barFittingPg.classList.add('over-budget');
        else this.barFittingPg.classList.remove('over-budget');
      }

      if (this.valFittingCpu) {
        this.valFittingCpu.textContent = `${totalCpu.toFixed(1)} / ${cpuMaxVal.toFixed(1)} tf (${cpuPct.toFixed(1)}%)`;
        this.valFittingCpu.style.color = totalCpu > cpuMaxVal ? '#ef4444' : '#f8fafc';
      }
      if (this.barFittingCpu) {
        this.barFittingCpu.style.width = `${Math.min(100, cpuPct)}%`;
        if (totalCpu > cpuMaxVal) this.barFittingCpu.classList.add('over-budget');
        else this.barFittingCpu.classList.remove('over-budget');
      }

      if (this.fittingOverbudgetAlert) {
        if (this.isLoadoutOverBudget) this.fittingOverbudgetAlert.classList.remove('hidden');
        else this.fittingOverbudgetAlert.classList.add('hidden');
      }

      // Render Paperdoll Hardpoints
      if (this.paperdollSlotsList) {
        this.paperdollSlotsList.innerHTML = '';
        const slots: Array<{ slot: string; cat: 'HIGH' | 'MID' | 'LOW'; title: string }> = [
          { slot: 'H1', cat: 'HIGH', title: 'HIGH SLOT 1 (PRIMARY WEAPON)' },
          { slot: 'H2', cat: 'HIGH', title: 'HIGH SLOT 2 (SECONDARY WEAPON)' },
          { slot: 'M1', cat: 'MID', title: 'MID SLOT 1 (PROPULSION / AFTERBURNER)' },
          { slot: 'M2', cat: 'MID', title: 'MID SLOT 2 (TACTICAL / POINT DEFENSE)' },
          { slot: 'L1', cat: 'LOW', title: 'LOW SLOT 1 (REACTOR CORE PASSIVE)' },
          { slot: 'L2', cat: 'LOW', title: 'LOW SLOT 2 (ARMOR / NANITE PASSIVE)' },
        ];

        for (const s of slots) {
          const item = loadout[s.slot];
          const card = document.createElement('div');
          const catClass = s.cat.toLowerCase();

          if (item) {
            const rarity = item.rarity ? item.rarity.toLowerCase() : 'common';
            card.className = `paperdoll-slot-card rarity-${rarity}`;
            const mfg = item.manufacturer ? `<span class="mfg-badge">${item.manufacturer}</span>` : '';
            let affixesText = '';
            if (item.affixes && item.affixes.length > 0) {
              affixesText = item.affixes.map((a: any) => a.description || `${a.stat}: x${a.multiplier}`).join(' • ');
            }

            const pgCost = item.powerGridCost ?? item.power_grid_cost ?? 0;
            const cpuCost = item.cpuCost ?? item.cpu_cost ?? 0;

            card.innerHTML = `
              <div class="slot-tag-badge ${catClass}">[${s.slot}]</div>
              <div class="slot-info-block">
                <div class="slot-item-name">${item.customName || item.name} ${mfg}</div>
                <div class="slot-item-sub">
                  <span>⚡ ${pgCost} MW</span>
                  <span>🧠 ${cpuCost} tf</span>
                </div>
                ${affixesText ? `<div class="slot-item-stats">${affixesText}</div>` : ''}
              </div>
              <button class="unfit-btn-small" data-slot="${s.slot}">UNFIT</button>
            `;
            const unfitBtn = card.querySelector('.unfit-btn-small');
            unfitBtn?.addEventListener('click', () => this.unfitModule(s.slot));
          } else {
            card.className = 'paperdoll-slot-card empty-slot';
            card.innerHTML = `
              <div class="slot-tag-badge ${catClass}">[${s.slot}]</div>
              <div class="slot-info-block">
                <span class="slot-empty-notice">EMPTY ${s.cat} SOCKET // READY FOR INSTALLATION</span>
              </div>
            `;
          }
          this.paperdollSlotsList.appendChild(card);
        }
      }

      // Render Locker Storage
      if (this.lockerModulesList) {
        this.lockerModulesList.innerHTML = '';
        if (this.lockerItemCount) {
          this.lockerItemCount.textContent = `${lockerList.length} UNFITTED MODULES`;
        }

        if (lockerList.length === 0) {
          this.lockerModulesList.innerHTML = '<div class="slot-empty-notice" style="padding: 1.5rem; text-align: center;">Station locker empty. Acquire blueprints from Armory or recover orbital loot containers.</div>';
        } else {
          for (const mod of lockerList) {
            const card = document.createElement('div');
            const rarity = mod.rarity ? mod.rarity.toLowerCase() : 'common';
            card.className = `locker-module-card rarity-${rarity}`;

            const mfg = mod.manufacturer ? `<span class="mfg-badge">${mod.manufacturer}</span>` : '';
            const cat = mod.slotType || mod.slot_type || mod.category || 'HIGH';
            let affixesText = '';
            if (mod.affixes && mod.affixes.length > 0) {
              affixesText = mod.affixes.map((a: any) => a.description || `${a.stat}: x${a.multiplier}`).join(' • ');
            }

            const pgCost = mod.powerGridCost ?? mod.power_grid_cost ?? 0;
            const cpuCost = mod.cpuCost ?? mod.cpu_cost ?? 0;

            let fitButtonsHtml = '';
            if (cat === 'HIGH') {
              fitButtonsHtml = `
                <button class="fit-btn-small" data-id="${mod.id}" data-slot="H1">FIT [H1]</button>
                <button class="fit-btn-small" data-id="${mod.id}" data-slot="H2">FIT [H2]</button>
              `;
            } else if (cat === 'MID') {
              fitButtonsHtml = `
                <button class="fit-btn-small" data-id="${mod.id}" data-slot="M1">FIT [M1]</button>
                <button class="fit-btn-small" data-id="${mod.id}" data-slot="M2">FIT [M2]</button>
              `;
            } else {
              fitButtonsHtml = `
                <button class="fit-btn-small" data-id="${mod.id}" data-slot="L1">FIT [L1]</button>
                <button class="fit-btn-small" data-id="${mod.id}" data-slot="L2">FIT [L2]</button>
              `;
            }

            card.innerHTML = `
              <div class="locker-card-header">
                <span class="locker-item-title">
                  <span class="rarity-pill rarity-${rarity}">${mod.rarity || 'COMMON'}</span>
                  <span>${mod.customName || mod.name}</span>
                  ${mfg}
                </span>
                <span class="slot-tag-badge ${cat.toLowerCase()}">${cat}</span>
              </div>
              <div class="locker-card-specs">
                <span>⚡ ${pgCost} MW</span>
                <span>🧠 ${cpuCost} tf</span>
              </div>
              ${affixesText ? `<div class="locker-card-affixes">${affixesText}</div>` : ''}
              <div class="locker-card-actions">
                ${fitButtonsHtml}
              </div>
            `;

            card.querySelectorAll('.fit-btn-small').forEach((btn) => {
              btn.addEventListener('click', (ev) => {
                const target = ev.currentTarget as HTMLElement;
                const slot = target.dataset.slot!;
                const invId = target.dataset.id!;
                this.fitModule(invId, slot);
              });
            });

            this.lockerModulesList.appendChild(card);
          }
        }
      }
    } catch (err) {
      console.error('[OUTFITTING] Failed to load loadout:', err);
    }
  }

  /**
   * Day 13: Fits module to slot with server-authoritative validation
   */
  public async fitModule(inventoryId: string, slot: string): Promise<void> {
    try {
      const res = await fetch('/api/outfitting/fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'acc_sol_captain',
          inventoryId,
          slot,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        this.audio.playApWarningSound();
        this.showApNotification(`⚠️ FIT REJECTED: ${data.message || data.error || 'Capacity exceeded'}`, true);
        return;
      }
      this.audio.playUiBlip();
      this.showApNotification(`✅ MODULE INSTALLED TO SLOT [${slot}]`, false);
      await this.loadOutfittingData();
    } catch (err) {
      console.error('[OUTFITTING] Fit error:', err);
    }
  }

  /**
   * Day 13: Unfits module from slot back to locker
   */
  public async unfitModule(slot: string): Promise<void> {
    try {
      const res = await fetch('/api/outfitting/unfit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'acc_sol_captain',
          slot,
        }),
      });
      if (res.ok) {
        this.audio.playUiBlip();
        this.showApNotification(`MODULE UNMOUNTED TO STATION LOCKER`, false);
        await this.loadOutfittingData();
      }
    } catch (err) {
      console.error('[OUTFITTING] Unfit error:', err);
    }
  }

  /**
   * Day 13: Loads naval armory blueprint catalog
   */
  public async loadArmoryData(): Promise<void> {
    try {
      const res = await fetch('/api/outfitting/catalog');
      if (!res.ok) return;
      const json = await res.json();
      const blueprints = Array.isArray(json) ? json : json.catalog || [];
      this.equipmentCatalog = blueprints;

      if (this.elArmoryPlayerCredits) {
        this.elArmoryPlayerCredits.textContent = `${this.playerCredits.toLocaleString()} Cr`;
      }

      if (this.elArmoryCatalogGrid) {
        this.elArmoryCatalogGrid.innerHTML = '';
        for (const bp of blueprints) {
          const card = document.createElement('div');
          const cat = bp.slot_type || bp.slotType || bp.category || 'HIGH';
          card.className = 'armory-card';

          const mfg = bp.manufacturer ? `<span class="mfg-badge">${bp.manufacturer}</span>` : '';
          const pgCost = bp.power_grid_cost ?? bp.powerGridCost ?? 0;
          const cpuCost = bp.cpu_cost ?? bp.cpuCost ?? 0;
          const price = bp.base_price ?? bp.basePrice ?? 500;
          const stats = bp.base_stats || bp.baseStats;
          const statsText = stats ? Object.entries(stats).map(([k, v]) => `${k}: ${v}`).join(' | ') : '';

          card.innerHTML = `
            <div class="armory-card-header">
              <span class="slot-tag-badge ${cat.toLowerCase()}">${cat}</span>
              <span class="armory-price-pill">${price.toLocaleString()} Cr</span>
            </div>
            <div class="armory-item-title">${bp.name} ${mfg}</div>
            <div class="locker-card-specs">
              <span>⚡ ${pgCost} MW</span>
              <span>🧠 ${cpuCost} tf</span>
            </div>
            ${statsText ? `<div class="locker-card-affixes">${statsText}</div>` : ''}
            <button class="hud-btn primary fit-btn-small" style="margin-top: 0.4rem;" data-id="${bp.id}">
              PURCHASE MODULE 🛒
            </button>
          `;

          card.querySelector('button')?.addEventListener('click', () => {
            this.buyModule(bp.id);
          });

          this.elArmoryCatalogGrid.appendChild(card);
        }
      }
    } catch (err) {
      console.error('[ARMORY] Catalog load error:', err);
    }
  }

  /**
   * Day 13: Purchases blueprint module from Armory and delivers to locker
   */
  public async buyModule(blueprintId: string): Promise<void> {
    try {
      const res = await fetch('/api/outfitting/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: 'acc_sol_captain',
          blueprintId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        this.audio.playApWarningSound();
        this.showApNotification(`REQUISITION FAILED: ${data.error || 'Check funds'}`, true);
        return;
      }
      this.audio.playTradeBuySound();
      this.playerCredits = data.credits;
      if (this.modalMarketPlayerCredits) this.modalMarketPlayerCredits.textContent = `${this.playerCredits.toLocaleString()} Cr`;
      if (this.elTelemetryCredits) this.elTelemetryCredits.textContent = `${this.playerCredits.toLocaleString()} Cr`;
      if (this.elArmoryPlayerCredits) this.elArmoryPlayerCredits.textContent = `${this.playerCredits.toLocaleString()} Cr`;
      this.showApNotification(`🛒 MODULE PURCHASED & TRANSFERRED TO LOCKER`, false);
      await this.loadArmoryData();
    } catch (err) {
      console.error('[ARMORY] Buy error:', err);
    }
  }

  /**
   * Day 14: Creates 3D Escape Pod mesh
   */
  public createEscapePodMesh(): THREE.Group {
    const group = new THREE.Group();

    // Streamlined aerodynamic pod capsule
    const capsuleGeom = new THREE.CapsuleGeometry(1.2, 2.8, 8, 16);
    const capsuleMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.3,
      flatShading: true,
    });
    const capsule = new THREE.Mesh(capsuleGeom, capsuleMat);
    capsule.rotation.x = Math.PI / 2;
    group.add(capsule);

    // Hazard orange cockpit canopy
    const canopyGeom = new THREE.SphereGeometry(0.8, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.5,
      metalness: 0.2,
      roughness: 0.1,
    });
    const canopy = new THREE.Mesh(canopyGeom, canopyMat);
    canopy.position.set(0, 0.6, 0.4);
    canopy.rotation.x = -Math.PI / 6;
    group.add(canopy);

    // Flashing emergency beacon strobe on top
    const beaconGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const beacon = new THREE.Mesh(beaconGeom, beaconMat);
    beacon.position.set(0, 1.35, -0.4);
    group.add(beacon);

    const beaconLight = new THREE.PointLight(0xef4444, 2.0, 18);
    beaconLight.position.set(0, 1.5, -0.4);
    group.add(beaconLight);

    return group;
  }

  /**
   * Day 14: Creates 3D Persistent AI Scavenger Vessel mesh
   */
  public createScavengerMesh(): THREE.Group {
    const group = new THREE.Group();

    // Heavy industrial salvager hull body (Charcoal + Hazard Amber)
    const bodyGeom = new THREE.BoxGeometry(3.6, 1.8, 5.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.4,
      flatShading: true,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    group.add(body);

    // Angled outrigger salvage arms / claws
    const armGeom = new THREE.BoxGeometry(0.6, 0.8, 3.2);
    const armMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.6,
      roughness: 0.5,
    });

    const leftArm = new THREE.Mesh(armGeom, armMat);
    leftArm.position.set(-2.2, -0.2, 2.0);
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeom, armMat);
    rightArm.position.set(2.2, -0.2, 2.0);
    group.add(rightArm);

    // Magnetic tractor scoop emitter
    const scoopGeom = new THREE.CylinderGeometry(0.8, 1.2, 1.0, 8);
    const scoopMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const scoop = new THREE.Mesh(scoopGeom, scoopMat);
    scoop.rotation.x = Math.PI / 2;
    scoop.position.set(0, -0.4, 3.0);
    group.add(scoop);

    // Amber warning hazard beacon
    const amberLight = new THREE.PointLight(0xf59e0b, 1.5, 20);
    amberLight.position.set(0, 1.5, 0);
    group.add(amberLight);

    return group;
  }

  /**
   * Day 14: Loads active revenge contracts & player killmail archive
   */
  public async loadContractsData(): Promise<void> {
    try {
      if (this.elContractsPlayerCredits) {
        this.elContractsPlayerCredits.textContent = `${this.playerCredits.toLocaleString()} Cr`;
      }

      // Fetch active contracts
      const cRes = await fetch('/api/combat/contracts');
      if (cRes.ok) {
        const cData = await cRes.json();
        const contracts = cData.contracts || [];
        if (this.elContractsActiveCount) {
          this.elContractsActiveCount.textContent = `${contracts.length} CONTRACT${contracts.length === 1 ? '' : 'S'} OPEN`;
        }
        if (this.elContractsActiveList) {
          this.elContractsActiveList.innerHTML = contracts.map((c: any) => `
            <div class="contract-card">
              <div class="contract-info">
                <span class="contract-target-name">🎯 ${c.targetName}</span>
                <span class="contract-meta">${c.isPublic ? '🌐 PUBLIC BOUNTY' : '🔒 PRIVATE SQUADRON'} // ESCROW VERIFIED</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span class="contract-reward-badge">${c.rewardCredits.toLocaleString()} CR</span>
                <button class="hud-btn-mini btn-copy-contract-link" data-id="${c.id}" title="Copy Shareable Link">🔗</button>
              </div>
            </div>
          `).join('');

          // Hook copy link buttons
          this.elContractsActiveList.querySelectorAll('.btn-copy-contract-link').forEach(btn => {
            btn.addEventListener('click', (ev) => {
              const contractId = (ev.currentTarget as HTMLElement).dataset.id;
              const shareUrl = `${window.location.origin}/?contract=${contractId}`;
              navigator.clipboard.writeText(shareUrl);
              this.showApNotification('📋 Shareable Revenge Contract URL copied to clipboard!', false);
              this.audio.playUiBlip();
            });
          });
        }
      }

      // Fetch killmails
      const kmRes = await fetch('/api/combat/killmails?accountId=acc_sol_captain');
      if (kmRes.ok) {
        const kmData = await kmRes.json();
        const killmails = kmData.killmails || [];
        if (this.elKillmailsCount) {
          this.elKillmailsCount.textContent = `${killmails.length} LOSS RECORD${killmails.length === 1 ? '' : 'S'}`;
        }
        if (this.elKillmailsArchiveList) {
          if (killmails.length === 0) {
            this.elKillmailsArchiveList.innerHTML = `<div class="meta-subtext" style="padding: 1rem; text-align: center;">No vessel losses on record. Ship hull is intact.</div>`;
          } else {
            this.elKillmailsArchiveList.innerHTML = killmails.map((km: any) => `
              <div class="killmail-card-item">
                <div class="km-card-info">
                  <span class="km-card-killer">💀 Lost to ${km.killerName}</span>
                  <span class="km-card-loss">Loss: ${km.lossValuation.toLocaleString()} CR // Sector 0${km.sectorId}</span>
                </div>
                <button class="hud-btn-mini btn-view-km" data-id="${km.id}">INSPECT</button>
              </div>
            `).join('');

            this.elKillmailsArchiveList.querySelectorAll('.btn-view-km').forEach(btn => {
              btn.addEventListener('click', (ev) => {
                const id = (ev.currentTarget as HTMLElement).dataset.id;
                const km = killmails.find((k: any) => k.id === id);
                if (km) this.openKillmailModal(km);
              });
            });
          }
        }
      }
    } catch (err) {
      console.error('[Contracts] Error loading contracts data:', err);
    }
  }

  /**
   * Day 14: Opens EVE-style loss report / killmail modal
   */
  public openKillmailModal(km: any): void {
    this.activeKillmailData = km;
    if (this.elKmTimestamp) this.elKmTimestamp.textContent = `TIMESTAMP: ${new Date(km.createdAt).toLocaleTimeString()} // SECTOR 0${km.sectorId}`;
    if (this.elKmLossValuation) this.elKmLossValuation.textContent = `LOSS: ${km.lossValuation.toLocaleString()} CR`;
    if (this.elKmKillerName) this.elKmKillerName.textContent = km.killerName;
    if (this.elKmSectorName) this.elKmSectorName.textContent = `Sector 0${km.sectorId} // Deep Hazard Void`;
    if (this.elKmTotalLoss) this.elKmTotalLoss.textContent = `${km.lossValuation.toLocaleString()} Credits`;
    if (this.elKmDroppedSummary) {
      const dropped = km.droppedItems || [];
      this.elKmDroppedSummary.textContent = dropped.map((d: any) => `${d.quantity || 1}x ${d.name}`).join(', ') || 'No salvage recovered';
    }

    if (this.elKmShareRow) this.elKmShareRow.classList.add('hidden');
    if (this.modalKillmail) this.modalKillmail.classList.remove('hidden');
  }

  /**
   * Day 14: Posts a revenge bounty on the killer
   */
  public async postRevengeBounty(): Promise<void> {
    if (!this.activeKillmailData) return;
    try {
      const res = await fetch('/api/combat/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorAccountId: 'acc_sol_captain',
          targetName: this.activeKillmailData.killerName,
          targetEntityId: this.activeKillmailData.killerId,
          rewardCredits: this.selectedBountyAmount,
          isPublic: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        this.showApNotification(`⚠️ Bounty failed: ${err.error}`, true);
        this.audio.playApWarningSound();
        return;
      }

      const data = await res.json();
      const contract = data.contract;
      const shareUrl = `${window.location.origin}/?contract=${contract.id}`;

      if (this.elKmShareUrl) this.elKmShareUrl.value = shareUrl;
      if (this.elKmShareRow) this.elKmShareRow.classList.remove('hidden');
      this.showApNotification(`💀 Revenge bounty posted for ${this.selectedBountyAmount.toLocaleString()} CR!`, false);
      this.audio.playUiBlip();

      // Refresh credits
      this.playerCredits = Math.max(0, this.playerCredits - this.selectedBountyAmount);
      if (this.modalMarketPlayerCredits) this.modalMarketPlayerCredits.textContent = `${this.playerCredits.toLocaleString()} Cr`;
      if (this.elTelemetryCredits) this.elTelemetryCredits.textContent = `${this.playerCredits.toLocaleString()} Cr`;
      if (this.elContractsPlayerCredits) this.elContractsPlayerCredits.textContent = `${this.playerCredits.toLocaleString()} Cr`;
    } catch (err: any) {
      this.showApNotification(`⚠️ Bounty error: ${err.message}`, true);
    }
  }

  /**
   * Day 14: Reissues standard Sol Cutter frigate upon docking escape pod at station clinic
   */
  public async claimReplacementFrigate(): Promise<void> {
    try {
      const res = await fetch('/api/combat/claim-frigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'acc_sol_captain', sectorId: this.currentSectorId }),
      });

      if (res.ok) {
        this.audio.playFrigateReissueSound();
        this.showApNotification('🚀 Sol Cutter Frigate reissued by Aegis Naval Command!', false);

        // Reset escape pod state
        this.isEscapePod = false;
        if (this.elEscapePodHud) this.elEscapePodHud.classList.add('hidden');
        if (this.modalClinicRescue) this.modalClinicRescue.classList.add('hidden');

        // Swap 3D mesh back to frigate
        if (this.escapePodMesh) {
          this.scene.remove(this.escapePodMesh);
          this.escapePodMesh = null;
        }
        if (this.shipMesh) {
          this.shipMesh.visible = true;
        }

        // Reset vitals
        this.lastPlayerShields = 100;
        this.lastPlayerMaxShields = 100;

        // Open regular station dock modal
        this.isDocked = false;
        this.dockShip();
      }
    } catch (err) {
      console.error('[Clinic] Error claiming replacement frigate:', err);
    }
  }

  /**
   * Day 14: Handles emergency clone recall when life support expires
   */
  public async handleEmergencyRecall(): Promise<void> {
    try {
      const res = await fetch('/api/combat/emergency-recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'acc_sol_captain' }),
      });

      if (res.ok) {
        this.showApNotification('🏥 Clone emergency recall complete! 500 CR deductible deducted.', true);
        this.isEscapePod = false;
        if (this.elEscapePodHud) this.elEscapePodHud.classList.add('hidden');

        if (this.escapePodMesh) {
          this.scene.remove(this.escapePodMesh);
          this.escapePodMesh = null;
        }
        if (this.shipMesh) {
          this.shipMesh.visible = true;
        }

        this.currentSectorId = 1;
        this.initCombatWebSocket(1);
        this.dockShip();
      }
    } catch (err) {
      console.error('[Recall] Error handling emergency recall:', err);
    }
  }

  // ============================================================================
  // DAY 15: PERSISTENT SHIP WRECKS, LASER SCRAP MINING & ELASTIC TOWING
  // ============================================================================

  /**
   * Creates 3D Charred Ship Wreckage mesh
   */
  public createWreckMesh(wreck: any): THREE.Group {
    const group = new THREE.Group();

    // Fractured main hull section (charred metallic)
    const hullGeom = new THREE.DodecahedronGeometry(2.8, 1);
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917, // Stone/Charcoal
      metalness: 0.85,
      roughness: 0.6,
      flatShading: true,
    });
    const hull = new THREE.Mesh(hullGeom, hullMat);
    hull.scale.set(1.4, 0.7, 2.2);
    group.add(hull);

    // Twisted exposed structural bulkheads / ribbing
    const ribsGeom = new THREE.TorusGeometry(2.0, 0.22, 6, 8, Math.PI * 1.3);
    const ribsMat = new THREE.MeshStandardMaterial({
      color: 0x44403c,
      metalness: 0.9,
      roughness: 0.4,
    });
    const ribs1 = new THREE.Mesh(ribsGeom, ribsMat);
    ribs1.rotation.y = Math.PI / 3;
    ribs1.position.set(-0.8, 0.4, -0.6);
    group.add(ribs1);

    const ribs2 = new THREE.Mesh(ribsGeom, ribsMat);
    ribs2.rotation.y = -Math.PI / 4;
    ribs2.position.set(0.6, -0.3, 0.8);
    group.add(ribs2);

    // Glowing molten magma breach seam
    const breachGeom = new THREE.CylinderGeometry(0.3, 0.6, 2.4, 6);
    const breachMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      emissive: 0xf97316,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    const breach = new THREE.Mesh(breachGeom, breachMat);
    breach.rotation.z = Math.PI / 3;
    breach.position.set(0.2, 0.6, 0.2);
    group.add(breach);

    // Ember spark point light
    const sparkLight = new THREE.PointLight(0xf97316, 1.5, 20);
    sparkLight.position.set(0.2, 1.0, 0.2);
    group.add(sparkLight);

    // Drifting debris shard
    const shardGeom = new THREE.BoxGeometry(0.8, 0.3, 1.4);
    const shard = new THREE.Mesh(shardGeom, hullMat);
    shard.position.set(2.4, -0.8, 1.2);
    shard.rotation.set(0.4, 0.8, 0.2);
    group.add(shard);

    group.userData = { wreckId: wreck.id, scrapRemaining: wreck.scrapRemaining, maxScrap: wreck.maxScrap };
    return group;
  }

  /**
   * Updates the dynamic 3D Elastic Tow Cable tether
   */
  private updateTowCable(shipPos: THREE.Vector3, wreckPos: THREE.Vector3, dist: number): void {
    const points: THREE.Vector3[] = [];
    const segments = 12;

    const sag = Math.max(0.2, (dist / 12.0) * 0.8);
    const midPoint = new THREE.Vector3()
      .addVectors(shipPos, wreckPos)
      .multiplyScalar(0.5);
    midPoint.y -= sag;

    const curve = new THREE.QuadraticBezierCurve3(shipPos, midPoint, wreckPos);
    for (let i = 0; i <= segments; i++) {
      points.push(curve.getPoint(i / segments));
    }

    if (!this.towCableMesh) {
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: 0x06b6d4, // Cyan magnetic glow
        linewidth: 3,
      });
      this.towCableMesh = new THREE.Line(geom, mat);
      this.scene.add(this.towCableMesh);
    } else {
      this.towCableMesh.geometry.setFromPoints(points);
      const isStrain = dist > 18.0;
      (this.towCableMesh.material as THREE.LineBasicMaterial).color.setHex(isStrain ? 0xf59e0b : 0x06b6d4);
    }

    this.towCableMesh.visible = true;
  }

  /**
   * Updates the laser salvage beam VFX between player and target wreck
   */
  private updateSalvageBeam(shipPos: THREE.Vector3, wreckPos: THREE.Vector3): void {
    if (!this.salvageBeamMesh) {
      this.salvageBeamMesh = new THREE.Group();

      const beamGeom = new THREE.CylinderGeometry(0.12, 0.12, 1, 8);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.85,
      });
      const beam = new THREE.Mesh(beamGeom, beamMat);
      beam.name = 'core';
      this.salvageBeamMesh.add(beam);

      const sparkGeom = new THREE.SphereGeometry(0.4, 8, 8);
      const sparkMat = new THREE.MeshBasicMaterial({
        color: 0xffedd5,
        wireframe: true,
      });
      const spark = new THREE.Mesh(sparkGeom, sparkMat);
      spark.name = 'spark';
      this.salvageBeamMesh.add(spark);

      this.scene.add(this.salvageBeamMesh);
    }

    this.salvageBeamMesh.visible = true;

    const dir = new THREE.Vector3().subVectors(wreckPos, shipPos);
    const length = dir.length();
    const midPoint = new THREE.Vector3().addVectors(shipPos, wreckPos).multiplyScalar(0.5);

    const beam = this.salvageBeamMesh.getObjectByName('core') as THREE.Mesh;
    if (beam) {
      beam.scale.set(1, length, 1);
      beam.position.copy(midPoint);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    }

    const spark = this.salvageBeamMesh.getObjectByName('spark') as THREE.Mesh;
    if (spark) {
      spark.position.copy(wreckPos);
      spark.rotation.y += 0.2;
    }
  }

  private hideSalvageBeam(): void {
    if (this.salvageBeamMesh) {
      this.salvageBeamMesh.visible = false;
    }
  }

  /**
   * Evaluates proximity to nearby persistent wrecks and manages HUD tether / mining prompts
   */
  private updateWrecksAndTether(_deltaSec: number): void {
    const pPos = this.flightController.position;
    let nearestWreck: any = null;
    let minWreckDist = Infinity;

    for (const wreck of this.activeWrecks.values()) {
      const wPos = new THREE.Vector3(wreck.x, 0, wreck.z);
      const dist = pPos.distanceTo(wPos);
      if (dist < minWreckDist) {
        minWreckDist = dist;
        nearestWreck = wreck;
      }
    }

    if (nearestWreck && minWreckDist <= 35.0) {
      this.targetedWreckId = nearestWreck.id;

      // If no hostile drone is targeted, or wreck is very close, display wreck telemetry box
      if (!this.primaryDroneTarget || minWreckDist <= 25.0) {
        if (this.elTargetTelemetryHud) {
          this.elTargetTelemetryHud.classList.remove('hidden');
          if (this.elTargetName) this.elTargetName.textContent = nearestWreck.shipName.toUpperCase();
          if (this.elTargetFaction) this.elTargetFaction.textContent = 'DERELICT // WRECKAGE';
          if (this.elTargetDistance) this.elTargetDistance.textContent = `${minWreckDist.toFixed(1)} u`;

          if (this.elTargetShieldBar) this.elTargetShieldBar.style.width = '0%';
          if (this.elTargetShieldVal) this.elTargetShieldVal.textContent = '0/0';

          const intactPct = Math.round(nearestWreck.hullIntactness * 100);
          if (this.elTargetHullBar) this.elTargetHullBar.style.width = `${intactPct}%`;
          if (this.elTargetHullVal) {
            this.elTargetHullVal.textContent = `${nearestWreck.scrapRemaining}/${nearestWreck.maxScrap} ALLOY`;
          }
        }

        // Show target quick actions (Salvage Beam & Tow Tether)
        if (this.elTargetQuickActions) {
          this.elTargetQuickActions.classList.remove('hidden');

          if (this.btnHudTetherWreck) {
            const isTowed = this.currentTowedWreckId === nearestWreck.id;
            this.btnHudTetherWreck.textContent = isTowed ? '🪝 RELEASE TETHER [T]' : '🪝 TETHER WRECK [T]';
          }

          if (this.btnHudSalvageBeam) {
            this.btnHudSalvageBeam.textContent = this.isMiningLaserActive ? '⚡ STOP BEAM [E]' : '⚡ SALVAGE BEAM [E]';
          }
        }
      }
    } else {
      this.targetedWreckId = null;
      if (!this.primaryDroneTarget && this.elTargetTelemetryHud) {
        this.elTargetTelemetryHud.classList.add('hidden');
      }
      if (this.elTargetQuickActions) {
        this.elTargetQuickActions.classList.add('hidden');
      }
    }
  }

  public toggleTowTether(): void {
    if (this.currentTowedWreckId) {
      if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
        this.combatSocket.send(JSON.stringify({ type: 'RELEASE_TOW' }));
      }
      this.currentTowedWreckId = null;
      if (this.towCableMesh) this.towCableMesh.visible = false;
      if (this.elTowCableHud) this.elTowCableHud.classList.add('hidden');
      this.audio.playTowCableReleaseSound();
      this.showApNotification('🪝 MAGNETIC TOW TETHER RELEASED', false);
    } else if (this.targetedWreckId) {
      if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
        this.combatSocket.send(JSON.stringify({ type: 'ATTACH_TOW', wreckId: this.targetedWreckId }));
      }
      this.currentTowedWreckId = this.targetedWreckId;
      this.audio.playTowCableAttachSound();
      this.showApNotification('🪝 ATTACHING MAGNETIC TOW TETHER...', false);
    } else {
      this.showApNotification('⚠️ NO WRECK TARGETED TO TETHER', true);
    }
  }

  public toggleSalvageMining(): void {
    if (this.isMiningLaserActive) {
      this.stopSalvageMining();
    } else if (this.targetedWreckId) {
      this.startSalvageMining();
    } else {
      this.showApNotification('⚠️ NO WRECK TARGETED FOR SALVAGE BEAM', true);
    }
  }

  public startSalvageMining(): void {
    if (!this.targetedWreckId) return;
    this.isMiningLaserActive = true;
    if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
      this.combatSocket.send(JSON.stringify({ type: 'START_SALVAGE_BEAM', wreckId: this.targetedWreckId }));
    }
    this.audio.playMiningLaserSound();
    this.showApNotification('⚡ SALVAGE MINING BEAM ENGAGED', false);
  }

  public stopSalvageMining(): void {
    this.isMiningLaserActive = false;
    this.hideSalvageBeam();
    if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
      this.combatSocket.send(JSON.stringify({ type: 'STOP_SALVAGE_BEAM' }));
    }
  }

  public async loadSalvageData(): Promise<void> {
    try {
      const holdRes = await fetch('/api/player/hold?playerId=acc_sol_captain');
      if (holdRes.ok) {
        const holdData = await holdRes.json();
        if (this.elSalvagePlayerCredits) {
          this.elSalvagePlayerCredits.textContent = `${(holdData.credits || 0).toLocaleString()} Cr`;
        }
      }

      const wreckRes = await fetch('/api/combat/wrecks?sectorId=2');
      if (wreckRes.ok) {
        const data = await wreckRes.json();
        const wrecks = data.wrecks || [];
        if (this.elSalvageSweepCount) {
          this.elSalvageSweepCount.textContent = `${wrecks.length} DERELICTS DETECTED`;
        }

        if (this.elSalvageDerelictsList) {
          this.elSalvageDerelictsList.innerHTML = '';
          wrecks.forEach((w: any) => {
            const item = document.createElement('div');
            item.className = 'derelict-card-item';
            item.innerHTML = `
              <div class="derelict-card-info">
                <span class="derelict-card-title">${w.shipName}</span>
                <span class="derelict-card-sub">${w.shipClass} // ${w.faction} [Sector ${w.sectorId}]</span>
              </div>
              <div class="derelict-card-scrap">
                ${w.scrapRemaining} / ${w.maxScrap} ALLOY (${Math.round(w.hullIntactness * 100)}%)
              </div>
            `;
            this.elSalvageDerelictsList?.appendChild(item);
          });
        }

        const towed = wrecks.find((w: any) => w.isTowed && w.towedByAccountId === 'acc_sol_captain') || 
                      (this.currentTowedWreckId ? wrecks.find((w: any) => w.id === this.currentTowedWreckId) : null);

        if (towed) {
          if (this.elSalvageEmptyCard) this.elSalvageEmptyCard.classList.add('hidden');
          if (this.elSalvageWreckCard) this.elSalvageWreckCard.classList.remove('hidden');
          if (this.elSalvageTetherStatus) {
            this.elSalvageTetherStatus.textContent = 'DERELICT SECURED IN DOCK';
            this.elSalvageTetherStatus.style.color = '#34d399';
          }
          if (this.elSalvageWreckFaction) this.elSalvageWreckFaction.textContent = towed.faction.toUpperCase();
          if (this.elSalvageWreckTitle) this.elSalvageWreckTitle.textContent = towed.shipName;
          if (this.elSalvageWreckClass) this.elSalvageWreckClass.textContent = towed.shipClass;
          if (this.elSalvageWreckScrap) this.elSalvageWreckScrap.textContent = `${towed.scrapRemaining} / ${towed.maxScrap} Units`;
          if (this.elSalvageWreckIntactness) this.elSalvageWreckIntactness.textContent = `${Math.round(towed.hullIntactness * 100)}%`;
          const estValue = Math.round(2000 + towed.scrapRemaining * 12 + towed.hullIntactness * 1500);
          if (this.elSalvageWreckVal) this.elSalvageWreckVal.textContent = `${estValue.toLocaleString()} Cr`;

          this.tetheredStationWreck = towed;
        } else {
          if (this.elSalvageEmptyCard) this.elSalvageEmptyCard.classList.remove('hidden');
          if (this.elSalvageWreckCard) this.elSalvageWreckCard.classList.add('hidden');
          if (this.elSalvageTetherStatus) {
            this.elSalvageTetherStatus.textContent = 'NO TOW ATTACHED';
            this.elSalvageTetherStatus.style.color = '#94a3b8';
          }
          this.tetheredStationWreck = null;
        }
      }
    } catch (err) {
      console.error('Failed to load salvage data:', err);
    }
  }

  public async dismantleTetheredWreck(): Promise<void> {
    if (!this.tetheredStationWreck) return;
    const wreckId = this.tetheredStationWreck.id;

    try {
      const res = await fetch('/api/combat/wrecks/dismantle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wreckId, accountId: 'acc_sol_captain' }),
      });
      const data = await res.json();
      if (data.success) {
        this.audio.playSalvageDismantleSound();
        this.showApNotification(`🔨 ${data.message}`, false);
        this.currentTowedWreckId = null;
        this.loadSalvageData();
      } else {
        this.showApNotification(`⚠️ ${data.error || 'Dismantle failed'}`, true);
      }
    } catch (err: any) {
      this.showApNotification(`⚠️ Dismantle error: ${err.message}`, true);
    }
  }

  public async refurbishTetheredWreck(): Promise<void> {
    if (!this.tetheredStationWreck) return;
    const wreckId = this.tetheredStationWreck.id;

    try {
      const res = await fetch('/api/combat/wrecks/refurbish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wreckId, accountId: 'acc_sol_captain' }),
      });
      const data = await res.json();
      if (data.success) {
        this.audio.playHullRefurbishSound();
        this.showApNotification(`🛡️ ${data.message}`, false);
        this.currentTowedWreckId = null;
        this.loadSalvageData();
      } else {
        this.showApNotification(`⚠️ ${data.error || 'Refurbish failed'}`, true);
      }
    } catch (err: any) {
      this.showApNotification(`⚠️ Refurbish error: ${err.message}`, true);
    }
  }

  // ========================================================================
  // Day 16: Star Control II Alien Comms, Branching Dialog & Speech Synthesis
  // ========================================================================

  public async loadDiplomacyData(): Promise<void> {
    this.renderFactionDossier();
    if (!this.elDiplomacyEnvoysList) return;
    try {
      const res = await fetch('/api/dialog/npcs');
      if (!res.ok) return;
      const data = await res.json();
      const npcs = data.npcs || [];


      if (this.elDiplomacyEnvoysCount) {
        this.elDiplomacyEnvoysCount.textContent = `${npcs.length} CHANNELS ONLINE`;
      }

      this.elDiplomacyEnvoysList.innerHTML = npcs.map((npc: any) => {
        let icon = '🦅';
        let faction = 'Vaelic Hegemony';
        let desc = 'Sovereign decree enforcement, sector tithes, and military ultimatum negotiations.';
        if (npc.species === 'PHORID') {
          icon = '🍄';
          faction = 'Phorid Sporeborn';
          desc = 'Harmonic spore consciousness, ancient planetary lore, and organic biocatalysts.';
        } else if (npc.species === 'KRYLL') {
          icon = '🐀';
          faction = 'Kryll Free Cartel';
          desc = 'Black-market scavenged surplus, raw alloy trading, and underworld convoy rumors.';
        }

        return `
          <div class="envoy-card">
            <div class="envoy-card-left">
              <div class="envoy-avatar-circle">${icon}</div>
              <div class="envoy-info">
                <span class="envoy-name">${npc.speakerName}</span>
                <span class="envoy-title">${npc.title} // ${faction.toUpperCase()}</span>
                <span style="font-size: 0.7rem; color: #94a3b8; margin-top: 2px;">${desc}</span>
              </div>
            </div>
            <button class="envoy-open-btn" data-npc="${npc.npcId}">OPEN SUB-SPACE LINK 📡</button>
          </div>
        `;
      }).join('');

      this.elDiplomacyEnvoysList.querySelectorAll('.envoy-open-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const npcId = (e.currentTarget as HTMLElement).getAttribute('data-npc');
          if (npcId) this.openAlienComms(npcId);
        });
      });
    } catch (err) {
      console.error('[Diplomacy] Failed to load envoys:', err);
    }
  }

  public hailCurrentTargetOrEnvoy(): void {
    const targetName = document.getElementById('reticle-name')?.textContent || '';
    if (targetName.includes('INTERDICTOR') || targetName.includes('HEGEMONY') || targetName.includes('DRONE')) {
      this.openAlienComms('npc_vorash');
    } else if (targetName.includes('SCAVENGER') || targetName.includes('VULTURE') || targetName.includes('KRYLL')) {
      this.openAlienComms('npc_skrit');
    } else if (this.currentSectorId === 2) {
      this.openAlienComms('npc_vorash');
    } else {
      this.openAlienComms('npc_skrit');
    }
  }

  public async openAlienComms(npcId: string): Promise<void> {
    this.currentAlienNpcId = npcId;
    if (this.elAlienCommsModal) {
      this.elAlienCommsModal.classList.remove('hidden');
    }
    this.audio.playCommsHailingChime();

    try {
      const res = await fetch(`/api/dialog/${npcId}?accountId=acc_sol_captain`);
      if (!res.ok) return;
      const data = await res.json();
      const dialog = data.dialog;
      if (!dialog) return;

      this.renderAlienDialogNode(dialog);
    } catch (err) {
      console.error('[Alien Comms] Error fetching dialog node:', err);
    }
  }

  public renderAlienDialogNode(dialog: any): void {
    this.currentAlienSpecies = dialog.species || 'VAELIC';
    this.currentAlienMood = dialog.mood || 'NEUTRAL';
    this.alienCurrentOptions = dialog.options || [];

    if (this.elAlienCommsSpeakerName) this.elAlienCommsSpeakerName.textContent = dialog.speakerName;
    if (this.elAlienCommsSpeakerTitle) this.elAlienCommsSpeakerTitle.textContent = dialog.title;
    if (this.elAlienCommsSpeciesLabel) this.elAlienCommsSpeciesLabel.textContent = dialog.species;
    if (this.elAlienCommsDialogueSpeaker) this.elAlienCommsDialogueSpeaker.textContent = `${dialog.speakerName.toUpperCase()} SPEAKS:`;

    if (this.elAlienCommsMoodBadge) {
      this.elAlienCommsMoodBadge.textContent = `MOOD: ${dialog.mood}`;
      this.elAlienCommsMoodBadge.className = `comms-mood-badge mood-${dialog.mood.toLowerCase()}`;
    }

    if (this.elAlienCommsCrestIcon && this.elAlienCommsCrestLabel) {
      if (dialog.species === 'VAELIC') {
        this.elAlienCommsCrestIcon.textContent = '🦅';
        this.elAlienCommsCrestLabel.textContent = 'VAELIC HEGEMONY';
      } else if (dialog.species === 'PHORID') {
        this.elAlienCommsCrestIcon.textContent = '🍄';
        this.elAlienCommsCrestLabel.textContent = 'PHORID SPOREBORN';
      } else if (dialog.species === 'KRYLL') {
        this.elAlienCommsCrestIcon.textContent = '🐀';
        this.elAlienCommsCrestLabel.textContent = 'KRYLL FREE CARTEL';
      } else {
        this.elAlienCommsCrestIcon.textContent = '🚀';
        this.elAlienCommsCrestLabel.textContent = 'SOL ALLIANCE';
      }
    }

    // Start portrait animation loop if not running
    if (!this.alienPortraitAnimId) {
      this.startAlienPortraitLoop();
    }
    // Start waveform animation loop if not running
    if (!this.commsWaveformAnimId) {
      this.startCommsWaveformLoop();
    }

    // Render dialogue text with typewriter effect
    this.startDialogueTypewriter(dialog.dialogueText, dialog.species);

    // Populate response options
    if (this.elAlienCommsOptionsList) {
      this.elAlienCommsOptionsList.innerHTML = dialog.options.map((opt: any, idx: number) => {
        return `
          <button class="comms-option-btn" data-index="${idx}">
            <span class="option-num-badge">[${idx + 1}]</span>
            <span class="option-text">${opt.text}</span>
          </button>
        `;
      }).join('');

      this.elAlienCommsOptionsList.querySelectorAll('.comms-option-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-index') || '0', 10);
          this.selectAlienDialogOption(idx);
        });
      });
    }
  }

  public startDialogueTypewriter(text: string, species: string): void {
    if (this.alienTypewriterTimer) {
      clearInterval(this.alienTypewriterTimer);
      this.alienTypewriterTimer = null;
    }

    if (!this.elAlienCommsDialogueText) return;
    this.elAlienCommsDialogueText.textContent = '';
    this.isAlienSpeaking = true;

    let charIdx = 0;
    const speed = 25; // ms per char

    this.alienTypewriterTimer = setInterval(() => {
      if (charIdx < text.length) {
        const char = text[charIdx];
        this.elAlienCommsDialogueText!.textContent += char;
        this.audio.playAlienPhoneme(species, char);
        charIdx++;
      } else {
        clearInterval(this.alienTypewriterTimer);
        this.alienTypewriterTimer = null;
        this.isAlienSpeaking = false;
      }
    }, speed);
  }

  public async selectAlienDialogOption(optionIndex: number): Promise<void> {
    if (!this.currentAlienNpcId) return;

    this.audio.playUiBlip();
    try {
      const res = await fetch('/api/dialog/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
          npcId: this.currentAlienNpcId,
          optionIndex,
        }),
      });

      if (!res.ok) return;
      const data = await res.json();

      if (data.actionMessage) {
        this.showApNotification(data.actionMessage, false);
        this.refreshPlayerHold();
        if (data.actionMessage.includes('ceasefire') || data.actionMessage.includes('disarmed') || data.actionMessage.includes('Seal')) {
          this.startTruceCountdown(300);
        }
        this.refreshFactionStandings();
      }

      if (data.nextNode) {
        this.renderAlienDialogNode(data.nextNode);
      }
    } catch (err) {
      console.error('[Alien Comms] Error selecting option:', err);
    }
  }

  // ========================================================================
  // Day 17: Faction Reputation Matrix & Truce Helpers
  // ========================================================================

  public async refreshFactionStandings(): Promise<void> {
    try {
      const res = await fetch('/api/reputation/standings?accountId=acc_sol_captain');
      if (!res.ok) return;
      const data = await res.json();
      this.playerStandings = data.standings || [];
      this.renderFactionDossier();
      this.updateHudSectorAllegiance();
    } catch (err) {
      console.warn('[REPUTATION] Failed to fetch standings:', err);
    }
  }

  public renderFactionDossier(): void {
    if (!this.elFactionDossierList) return;
    if (!this.playerStandings || this.playerStandings.length === 0) {
      this.elFactionDossierList.innerHTML = `
        <div class="market-loading-hint">Loading Cluster Diplomatic Standings...</div>
      `;
      return;
    }

    this.elFactionDossierList.innerHTML = this.playerStandings.map((f: any) => {
      const score = Math.max(-100, Math.min(100, f.standing || 0));
      const isPos = score >= 0;
      const widthPct = Math.round(Math.abs(score) / 2); // 0 to 50%
      const leftPos = isPos ? 50 : 50 - widthPct;

      const tierClass = `tier-${(f.tier || 'neutral').toLowerCase()}`;
      const sign = score > 0 ? `+${score}` : `${score}`;

      let tariffText = '';
      if (f.discountPercent > 0) {
        tariffText = `<span style="color: #10b981;">-${f.discountPercent}% Market & Outfitting Discount</span>`;
      } else if (f.surchargePercent > 0) {
        tariffText = `<span style="color: #ef4444;">+${f.surchargePercent}% Hostile Tariff Surcharge</span>`;
      } else {
        tariffText = `<span style="color: #94a3b8;">Standard Cluster Rates</span>`;
      }

      const dockingPill = f.isDockingPermitted
        ? `<span class="faction-docking-status permitted">✓ DOCKING PERMITTED</span>`
        : `<span class="faction-docking-status lockdown">⚠️ SHIELDS ACTIVE (LOCKDOWN)</span>`;

      return `
        <div class="faction-card" data-faction="${f.factionId}">
          <div class="faction-card-header">
            <div class="faction-card-left">
              <span class="faction-card-crest">${f.crestIcon}</span>
              <div class="faction-card-title-group">
                <span class="faction-card-name">${f.name}</span>
                <span class="faction-card-score">STANDING: <strong style="color: ${f.primaryColor}">${sign} / 100</strong></span>
              </div>
            </div>
            <span class="standing-tier-pill ${tierClass}">${f.tier} (${sign})</span>
          </div>

          <div class="faction-meter-wrapper">
            <div class="faction-meter-track">
              <div class="faction-meter-center-line"></div>
              <div class="faction-meter-fill ${isPos ? 'positive' : 'negative'}" style="left: ${leftPos}%; width: ${widthPct}%;"></div>
            </div>
          </div>

          <div class="faction-perks-row">
            <span class="faction-perk-text">${tariffText}</span>
            ${dockingPill}
          </div>
          <div style="font-size: 0.65rem; color: #64748b; line-height: 1.3;">${f.perkDesc}</div>
        </div>
      `;
    }).join('');
  }

  public updateHudSectorAllegiance(): void {
    if (!this.elHudFactionBadge || !this.elHudFactionName || !this.elHudFactionCrest || !this.elHudFactionStandingTier) return;

    let factionId = 'FACTION_SOL';
    let factionName = 'SOL-PERIMETER ALLIANCE';
    let crest = '🚀';

    if (this.currentSectorId === 2) {
      factionId = 'FACTION_HEGEMONY';
      factionName = 'VAELIC HEGEMONY (OCCUPIED)';
      crest = '🦅';
    } else if (this.currentSectorId === 3) {
      factionId = 'FACTION_HEGEMONY';
      factionName = 'LITHOS FORGE CLUSTER';
      crest = '🦾';
    } else if (this.currentSectorId === 4) {
      factionId = 'FACTION_PHORID';
      factionName = 'PHORID SPORE BIOSPHERE';
      crest = '🍄';
    } else if (this.currentSectorId === 5) {
      factionId = 'FACTION_KRYLL';
      factionName = 'KRYLL SCRAP EXCHANGE';
      crest = '🐀';
    }

    const standingObj = this.playerStandings.find((s: any) => s.factionId === factionId);
    const score = standingObj ? standingObj.standing : 0;
    const tier = standingObj ? standingObj.tier : 'NEUTRAL';
    const sign = score > 0 ? `+${score}` : `${score}`;

    this.elHudFactionCrest.textContent = crest;
    this.elHudFactionName.textContent = factionName;
    this.elHudFactionStandingTier.textContent = `${tier} (${sign})`;
    this.elHudFactionStandingTier.className = `standing-tier-pill tier-${tier.toLowerCase()}`;
  }

  public startTruceCountdown(durationSeconds: number = 300): void {
    this.activeTruceExpiresAt = Date.now() + durationSeconds * 1000;
    if (this.truceTimerInterval) clearInterval(this.truceTimerInterval);

    if (this.elHudTruceTimerPill) {
      this.elHudTruceTimerPill.classList.remove('hidden');
    }

    this.truceTimerInterval = setInterval(() => {
      if (!this.activeTruceExpiresAt || !this.elHudTruceTimerPill) return;
      const remainingMs = this.activeTruceExpiresAt - Date.now();
      if (remainingMs <= 0) {
        clearInterval(this.truceTimerInterval);
        this.truceTimerInterval = null;
        this.activeTruceExpiresAt = null;
        this.elHudTruceTimerPill.classList.add('hidden');
        this.showApNotification('⚠️ DIPLOMATIC CEASEFIRE EXPIRED: Patrol drones resumed alert status.', true);
        this.audio.playApWarningSound();
        return;
      }
      const totalSec = Math.ceil(remainingMs / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      this.elHudTruceTimerPill.textContent = `🕊️ TRUCE: ${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }, 500);
  }


  public closeAlienComms(): void {
    if (this.elAlienCommsModal) {
      this.elAlienCommsModal.classList.add('hidden');
    }
    if (this.alienTypewriterTimer) {
      clearInterval(this.alienTypewriterTimer);
      this.alienTypewriterTimer = null;
    }
    if (this.alienPortraitAnimId) {
      cancelAnimationFrame(this.alienPortraitAnimId);
      this.alienPortraitAnimId = null;
    }
    if (this.commsWaveformAnimId) {
      cancelAnimationFrame(this.commsWaveformAnimId);
      this.commsWaveformAnimId = null;
    }
    this.isAlienSpeaking = false;
    this.currentAlienNpcId = null;
    this.audio.playCommsCloseSound();
  }

  public startAlienPortraitLoop(): void {
    const render = () => {
      if (!this.elAlienCommsModal || this.elAlienCommsModal.classList.contains('hidden')) {
        this.alienPortraitAnimId = null;
        return;
      }

      this.alienPortraitTime += 0.035;
      if (this.elAlienPortraitCanvas) {
        const ctx = this.elAlienPortraitCanvas.getContext('2d');
        if (ctx) {
          this.drawProceduralAlienPortrait(
            ctx,
            this.elAlienPortraitCanvas.width,
            this.elAlienPortraitCanvas.height,
            this.currentAlienSpecies,
            this.currentAlienMood,
            this.alienPortraitTime
          );
        }
      }

      this.alienPortraitAnimId = requestAnimationFrame(render);
    };

    this.alienPortraitAnimId = requestAnimationFrame(render);
  }

  public drawProceduralAlienPortrait(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    species: string,
    mood: string,
    t: number
  ): void {
    // 1. Clear with deep space canvas background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    // Starfield noise in portrait background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 20; i++) {
      const sx = ((i * 37 + 13) % (w - 20)) + 10;
      const sy = ((i * 59 + 29) % (h - 20)) + 10;
      const flicker = 0.3 + 0.7 * Math.sin(t * 2 + i);
      ctx.globalAlpha = flicker * 0.5;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1.0;

    const cx = w / 2;
    const cy = h / 2;

    switch (species.toUpperCase()) {
      case 'VAELIC': {
        // Vaelic Hegemony: Imperial crested conqueror
        const breathing = Math.sin(t * 2) * 3;
        const speakingMouth = this.isAlienSpeaking ? Math.sin(t * 18) * 5 : 0;
        const blink = Math.sin(t * 0.8) > 0.94 ? 0.1 : 1.0;

        // Flared Imperial Collar
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - 95, cy + 90);
        ctx.lineTo(cx - 110, cy - 30);
        ctx.lineTo(cx - 40, cy - 70);
        ctx.lineTo(cx + 40, cy - 70);
        ctx.lineTo(cx + 110, cy - 30);
        ctx.lineTo(cx + 95, cy + 90);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Armored Shoulders
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 120, cy + 130 + breathing);
        ctx.lineTo(cx - 60, cy + 60 + breathing);
        ctx.lineTo(cx + 60, cy + 60 + breathing);
        ctx.lineTo(cx + 120, cy + 130 + breathing);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Reptilian Skull Head
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 45, cy + 30 + breathing);
        ctx.lineTo(cx - 55, cy - 35 + breathing);
        ctx.lineTo(cx - 20, cy - 65 + breathing);
        ctx.lineTo(cx + 20, cy - 65 + breathing);
        ctx.lineTo(cx + 55, cy - 35 + breathing);
        ctx.lineTo(cx + 45, cy + 30 + breathing);
        ctx.lineTo(cx, cy + 50 + speakingMouth + breathing);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crest spines
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.moveTo(cx - 15, cy - 65 + breathing);
        ctx.lineTo(cx, cy - 95 + breathing + Math.sin(t * 3) * 2);
        ctx.lineTo(cx + 15, cy - 65 + breathing);
        ctx.fill();

        // Glowing Crimson Visor / Optics
        ctx.fillStyle = mood === 'TERRIFIED' ? '#38bdf8' : '#ef4444';
        ctx.shadowColor = mood === 'TERRIFIED' ? '#38bdf8' : '#ef4444';
        ctx.shadowBlur = 12;

        ctx.fillRect(cx - 36, cy - 18 + breathing, 24, 7 * blink);
        ctx.fillRect(cx + 12, cy - 18 + breathing, 24, 7 * blink);
        ctx.shadowBlur = 0;

        // Snout & Mandibles
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 15, cy + 25 + breathing);
        ctx.lineTo(cx, cy + 35 + speakingMouth + breathing);
        ctx.lineTo(cx + 15, cy + 25 + breathing);
        ctx.stroke();
        break;
      }

      case 'PHORID': {
        // Phorid Sporeborn: Bioluminescent fungal entity
        const pulse = 1.0 + Math.sin(t * 3) * 0.06;
        const gillGlow = Math.abs(Math.sin(t * 2));
        const blink = Math.sin(t * 1.2) > 0.92 ? 0.2 : 1.0;

        // Floating Spore Particles
        ctx.fillStyle = 'rgba(6, 182, 212, 0.7)';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 8;
        for (let i = 0; i < 14; i++) {
          const px = ((i * 43 + 20) % (w - 40)) + 20 + Math.sin(t + i) * 6;
          const py = (h - ((t * 22 + i * 35) % h));
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Stem Body
        ctx.fillStyle = '#1e1b4b';
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 35, cy + 130);
        ctx.lineTo(cx - 20, cy + 30);
        ctx.lineTo(cx + 20, cy + 30);
        ctx.lineTo(cx + 35, cy + 130);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Broad Fungal Mushroom Cap
        ctx.save();
        ctx.translate(cx, cy - 10);
        ctx.scale(pulse, pulse);

        ctx.fillStyle = '#311042';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 95, 55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pulsing bioluminescent gills underneath cap
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.4 + gillGlow * 0.5})`;
        ctx.lineWidth = 1.8;
        for (let x = -80; x <= 80; x += 12) {
          ctx.beginPath();
          ctx.moveTo(x, 15);
          ctx.lineTo(x * 0.6, 42);
          ctx.stroke();
        }

        // Concentric cap rings
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, -10, 65, 30, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Optical Nodes (Row of gentle glowing eyes)
        const eyeColors = ['#fbbf24', '#34d399', '#38bdf8', '#c084fc'];
        [-45, -15, 15, 45].forEach((ex, i) => {
          ctx.fillStyle = eyeColors[i];
          ctx.shadowColor = eyeColors[i];
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.ellipse(ex, -5, 5, 4 * blink, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.shadowBlur = 0;
        ctx.restore();
        break;
      }

      case 'KRYLL': {
        // Kryll Cartel: Rodentoid scavenger with cybernetic monocle
        const twitchEar = Math.sin(t * 6) > 0.85 ? 4 : 0;
        const twitchWhisker = Math.sin(t * 12) * 3;
        const speakJaw = this.isAlienSpeaking ? Math.sin(t * 22) * 4 : 0;
        const blink = Math.sin(t * 1.5) > 0.93 ? 0.1 : 1.0;

        // Large Pointed Ears
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        // Left Ear
        ctx.beginPath();
        ctx.moveTo(cx - 50, cy - 20);
        ctx.lineTo(cx - 95, cy - 85 + twitchEar);
        ctx.lineTo(cx - 30, cy - 60);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Right Ear (Cybernetic Antennas)
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(cx + 30, cy - 60);
        ctx.lineTo(cx + 90, cy - 85 - twitchEar);
        ctx.lineTo(cx + 50, cy - 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Furry Muzzle & Skull
        ctx.fillStyle = '#92400e';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 45, cy + 40);
        ctx.lineTo(cx - 55, cy - 25);
        ctx.lineTo(cx, cy - 50);
        ctx.lineTo(cx + 55, cy - 25);
        ctx.lineTo(cx + 45, cy + 40);
        ctx.lineTo(cx, cy + 55 + speakJaw);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Left Eye: Brass Steampunk / Cybernetic Monocle
        ctx.save();
        ctx.translate(cx - 24, cy - 10);
        ctx.fillStyle = '#b45309';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Monocle rotating green reticle
        ctx.rotate(t * 2.5);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
        ctx.moveTo(0, -10); ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.restore();

        // Right Eye: Beady Rat Eye
        ctx.fillStyle = '#020617';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx + 24, cy - 10, 8, 8 * blink, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Eye glint
        if (blink > 0.5) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx + 22, cy - 12, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Snout, Twitching Whiskers & Incisors
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 30, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Incisors
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(cx - 4, cy + 38 + speakJaw, 3.5, 7);
        ctx.fillRect(cx + 0.5, cy + 38 + speakJaw, 3.5, 7);

        // Whiskers
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.2;
        // Left Whiskers
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy + 28);
        ctx.lineTo(cx - 65, cy + 20 + twitchWhisker);
        ctx.moveTo(cx - 10, cy + 32);
        ctx.lineTo(cx - 68, cy + 35 - twitchWhisker);
        // Right Whiskers
        ctx.moveTo(cx + 10, cy + 28);
        ctx.lineTo(cx + 65, cy + 20 - twitchWhisker);
        ctx.moveTo(cx + 10, cy + 32);
        ctx.lineTo(cx + 68, cy + 35 + twitchWhisker);
        ctx.stroke();
        break;
      }

      default: {
        // Sol Alliance Diplomatic Avatar
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(cx, cy - 15, 45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(cx - 25, cy - 18, 50, 10);
        break;
      }
    }

    // CRT Scanline Sweeper
    const scanlineY = (t * 50) % h;
    ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
    ctx.fillRect(0, scanlineY, w, 3);
  }

  public startCommsWaveformLoop(): void {
    const render = () => {
      if (!this.elAlienCommsModal || this.elAlienCommsModal.classList.contains('hidden')) {
        this.commsWaveformAnimId = null;
        return;
      }

      if (this.elCommsWaveformCanvas) {
        const ctx = this.elCommsWaveformCanvas.getContext('2d');
        if (ctx) {
          this.drawCommsWaveform(
            ctx,
            this.elCommsWaveformCanvas.width,
            this.elCommsWaveformCanvas.height,
            this.alienPortraitTime
          );
        }
      }

      this.commsWaveformAnimId = requestAnimationFrame(render);
    };

    this.commsWaveformAnimId = requestAnimationFrame(render);
  }

  public drawCommsWaveform(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number
  ): void {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    const cy = h / 2;
    const isSpeaking = this.isAlienSpeaking;
    const amp = isSpeaking ? 9.0 : 2.0;

    ctx.strokeStyle = isSpeaking ? '#22d3ee' : 'rgba(34, 211, 238, 0.4)';
    ctx.lineWidth = isSpeaking ? 1.8 : 1.0;
    ctx.beginPath();

    for (let x = 0; x < w; x++) {
      const freq1 = isSpeaking ? 0.12 : 0.05;
      const freq2 = isSpeaking ? 0.28 : 0.08;
      const speed1 = isSpeaking ? 14 : 3;
      const speed2 = isSpeaking ? 22 : 5;

      const y = cy + Math.sin(x * freq1 + t * speed1) * amp * 0.7 +
                     Math.cos(x * freq2 - t * speed2) * amp * 0.3;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  // ============================================================================
  // DAY 18: PLANETARY ORBITAL SURVEY, SURFACE SCANNERS & ATMOSPHERIC PROBES
  // ============================================================================

  /**
   * Fetches sector planets from backend and spawns 3D ProceduralPlanet in the sector.
   */
  public async loadSectorPlanet(sectorId: number): Promise<void> {
    try {
      const res = await fetch(`http://localhost:3000/api/planets/sector/${sectorId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.planets) && data.planets.length > 0) {
        const pData: PlanetData = data.planets[0];
        if (this.activePlanet) {
          this.scene.remove(this.activePlanet.group);
          this.activePlanet = null;
        }
        this.activePlanet = new ProceduralPlanet(pData);
        this.scene.add(this.activePlanet.group);
        this.activePlanetDetail = pData;
        console.log(`[DAY 18] Spawned 3D Planet: ${pData.name} at (${pData.posX}, ${pData.posZ})`);
      }
    } catch (err) {
      console.warn('[DAY 18] Failed to load sector planets:', err);
    }
  }

  /**
   * Updates distance to sector planet and toggles HUD orbital guidance banner.
   */
  public updatePlanetaryGuidance(deltaSec: number): void {
    if (!this.activePlanet) {
      if (this.elOrbitalBanner) this.elOrbitalBanner.classList.add('hidden');
      return;
    }

    this.activePlanet.update(deltaSec);
    const dist = this.activePlanet.getDistanceTo(this.flightController.position);

    if (this.elOrbitalBanner && this.elOrbitalMsg) {
      if (dist <= 65.0) {
        this.elOrbitalBanner.classList.remove('hidden');
        if (dist <= this.activePlanet.orbitalRadius) {
          this.elOrbitalMsg.textContent = `SYNCHRONOUS ORBIT READY // DIST: ${dist.toFixed(1)}u [O]`;
          this.elOrbitalBanner.style.borderColor = '#10b981';
          this.elOrbitalBanner.style.color = '#10b981';
        } else {
          this.elOrbitalMsg.textContent = `APPROACHING ${this.activePlanet.data.name} // DIST: ${dist.toFixed(1)}u`;
          this.elOrbitalBanner.style.borderColor = '#38bdf8';
          this.elOrbitalBanner.style.color = '#38bdf8';
        }
      } else {
        this.elOrbitalBanner.classList.add('hidden');
      }
    }
  }

  /**
   * Locks ship thrusters into synchronous orbit and launches the CRT Survey Console.
   */
  public async enterOrbit(): Promise<void> {
    if (!this.activePlanet) return;
    this.isInOrbit = true;

    // Smooth thruster dampening
    this.flightController.reset(this.flightController.position.clone());

    // Sensory Immersion
    this.audio.playOrbitalCaptureSound();
    this.audio.startPlanetaryAmbience(this.activePlanet.data.archetype);

    // Populate modal telemetry
    const p = this.activePlanet.data;
    const elName = document.getElementById('survey-planet-name');
    const elArch = document.getElementById('survey-planet-archetype');
    const elHab = document.getElementById('survey-hab-val');
    const elTemp = document.getElementById('val-telemetry-temp');
    const elDensity = document.getElementById('val-telemetry-density');
    const elHazard = document.getElementById('val-telemetry-hazard');
    const elFaction = document.getElementById('val-telemetry-faction');
    const elAp = document.getElementById('survey-player-ap');

    if (elName) elName.textContent = p.name.toUpperCase();
    if (elArch) elArch.textContent = `${p.archetype} CELESTIAL WORLD // SECTOR 0${p.sectorId}`;
    if (elHab) elHab.textContent = `${p.habitabilityRating}%`;
    if (elTemp) elTemp.textContent = `${p.surfaceTempK} K`;
    if (elDensity) elDensity.textContent = `${p.atmosphereDensity.toFixed(2)} Bar`;
    if (elHazard) elHazard.textContent = p.hazardClass.replace(/_/g, ' ');
    if (elFaction) elFaction.textContent = p.controllingFaction.replace(/_/g, ' ');
    if (elAp) elAp.textContent = `${this.playerAP.currentAP} / ${this.playerAP.maxAP}`;

    // Fetch authoritative survey state
    try {
      const res = await fetch(`http://localhost:3000/api/planets/${p.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.planet) {
          this.activePlanetDetail = data.planet;
        }
      }
    } catch (err) {
      console.warn('[DAY 18] Failed to fetch planet survey detail:', err);
    }

    this.updateSurveyConsoleUI();
    this.startGlobeRender();

    if (this.modalPlanetarySurvey) {
      this.modalPlanetarySurvey.classList.remove('hidden');
    }
  }

  /**
   * Disengages orbital capture and returns to flight view.
   */
  public exitOrbit(): void {
    this.isInOrbit = false;
    this.audio.stopPlanetaryAmbience();
    this.audio.playUiBlip();
    this.stopGlobeRender();

    if (this.modalPlanetarySurvey) {
      this.modalPlanetarySurvey.classList.add('hidden');
    }

    // Nudge ship slightly away from planet center
    if (this.activePlanet) {
      const awayDir = this.flightController.position.clone().sub(this.activePlanet.position).normalize();
      this.flightController.position.addScaledVector(awayDir, 3.5);
    }
  }

  /**
   * Initializes mouse drag and hover listeners for the 3D canvas globe.
   */
  private initGlobeCanvasControls(): void {
    if (!this.globeCanvas) return;

    this.globeCanvas.addEventListener('mousedown', (e: MouseEvent) => {
      this.globeIsDragging = true;
      this.globeDragLastX = e.clientX;
      this.globeDragLastY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.globeIsDragging = false;
    });

    this.globeCanvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = this.globeCanvas!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.globeIsDragging) {
        const dx = e.clientX - this.globeDragLastX;
        const dy = e.clientY - this.globeDragLastY;
        this.globeRotY += dx * 0.012;
        this.globeRotX = Math.max(-1.3, Math.min(1.3, this.globeRotX + dy * 0.012));
        this.globeDragLastX = e.clientX;
        this.globeDragLastY = e.clientY;
      }

      // Calculate spherical coordinates under cursor
      const cx = 170;
      const cy = 170;
      const R = 125;
      const dx = mouseX - cx;
      const dy = mouseY - cy;
      const d = Math.sqrt(dx * dx + dy * dy);

      const elLat = document.getElementById('val-cursor-lat');
      const elLng = document.getElementById('val-cursor-lng');

      if (d <= R) {
        const z = Math.sqrt(R * R - d * d);
        // Inverse sphere rotation
        const cosX = Math.cos(-this.globeRotX);
        const sinX = Math.sin(-this.globeRotX);
        const cosY = Math.cos(-this.globeRotY);
        const sinY = Math.sin(-this.globeRotY);

        const y1 = dy * cosX - z * sinX;
        const z1 = dy * sinX + z * cosX;
        const x2 = dx * cosY + z1 * sinY;
        const z2 = -dx * sinY + z1 * cosY;

        const latDeg = Math.round((-y1 / R) * 90);
        const lngDeg = Math.round(Math.atan2(x2, z2) * (180 / Math.PI));

        if (elLat) elLat.textContent = `${latDeg >= 0 ? '+' : ''}${latDeg}°`;
        if (elLng) elLng.textContent = `${lngDeg >= 0 ? '+' : ''}${lngDeg}°`;

        // Check if hovering near a hotspot
        this.hoveredHotspot = null;
        if (this.activePlanetDetail?.survey?.discoveredHotspots) {
          for (const h of this.activePlanetDetail.survey.discoveredHotspots) {
            const hPos = this.getHotspotScreenPos(h.lat, h.lng, R, cx, cy);
            if (hPos && Math.hypot(mouseX - hPos.x, mouseY - hPos.y) < 14) {
              this.hoveredHotspot = h;
              break;
            }
          }
        }
      } else {
        this.hoveredHotspot = null;
      }
    });

    this.globeCanvas.addEventListener('click', (e: MouseEvent) => {
      const rect = this.globeCanvas!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const cx = 170;
      const cy = 170;
      const R = 125;
      const dx = mouseX - cx;
      const dy = mouseY - cy;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d <= R) {
        const z = Math.sqrt(R * R - d * d);
        const cosX = Math.cos(-this.globeRotX);
        const sinX = Math.sin(-this.globeRotX);
        const cosY = Math.cos(-this.globeRotY);
        const sinY = Math.sin(-this.globeRotY);

        const y1 = dy * cosX - z * sinX;
        const z1 = dy * sinX + z * cosX;
        const x2 = dx * cosY + z1 * sinY;
        const z2 = -dx * sinY + z1 * cosY;

        this.targetedLat = Math.round((-y1 / R) * 90);
        this.targetedLng = Math.round(Math.atan2(x2, z2) * (180 / Math.PI));
        this.audio.playUiBlip();
        this.showApNotification(`🎯 PROBE TARGET LOCKED: Lat ${this.targetedLat}°, Lng ${this.targetedLng}°`, false);
      }
    });
  }

  /**
   * Helper to project (lat, lng) to 2D canvas coordinates on the rotating sphere.
   */
  private getHotspotScreenPos(lat: number, lng: number, R: number, cx: number, cy: number): { x: number; y: number } | null {
    const phi = (lat * Math.PI) / 180;
    const lambda = (lng * Math.PI) / 180;

    // Local sphere coordinates
    const x = R * Math.cos(phi) * Math.sin(lambda);
    const y = -R * Math.sin(phi);
    const z = R * Math.cos(phi) * Math.cos(lambda);

    // Apply Y-axis rotation (spin)
    const cosY = Math.cos(this.globeRotY);
    const sinY = Math.sin(this.globeRotY);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;

    // Apply X-axis rotation (tilt)
    const cosX = Math.cos(this.globeRotX);
    const sinX = Math.sin(this.globeRotX);
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    // Visible on front hemisphere only
    if (z2 <= 0) return null;

    return {
      x: cx + x1,
      y: cy + y2,
    };
  }

  /**
   * Starts the 60fps render loop for the 3D rotating canvas globe.
   */
  private startGlobeRender(): void {
    this.stopGlobeRender();
    const render = () => {
      if (!this.isInOrbit) return;
      this.drawGlobeCanvas();
      this.globeAnimId = requestAnimationFrame(render);
    };
    this.globeAnimId = requestAnimationFrame(render);
  }

  /**
   * Stops the canvas globe animation loop.
   */
  private stopGlobeRender(): void {
    if (this.globeAnimId !== null) {
      cancelAnimationFrame(this.globeAnimId);
      this.globeAnimId = null;
    }
  }

  /**
   * Draws the Star Control II style shaded 3D globe with latitude/longitude grid and phosphor hotspots.
   */
  private drawGlobeCanvas(): void {
    if (!this.globeCtx || !this.globeCanvas) return;
    const ctx = this.globeCtx;
    const w = this.globeCanvas.width;
    const h = this.globeCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const R = 125;

    // Continuous auto-rotation when not dragging
    if (!this.globeIsDragging) {
      this.globeRotY += 0.003;
    }

    // Clear background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    // 1. Shaded Sphere Base with Archetype Gradient
    const archetype = this.activePlanetDetail?.archetype || 'BARREN';
    let lightColor = '#64748b';
    let darkColor = '#0f172a';
    let rimColor = 'rgba(56, 189, 248, 0.4)';

    if (archetype === 'VOLCANIC') {
      lightColor = '#b91c1c';
      darkColor = '#450a0a';
      rimColor = 'rgba(249, 115, 22, 0.5)';
    } else if (archetype === 'TERRESTRIAL') {
      lightColor = '#059669';
      darkColor = '#022c22';
      rimColor = 'rgba(16, 185, 129, 0.5)';
    } else if (archetype === 'GAS_GIANT') {
      lightColor = '#0284c7';
      darkColor = '#082f49';
      rimColor = 'rgba(56, 189, 248, 0.6)';
    } else if (archetype === 'PRECURSOR_RUIN') {
      lightColor = '#7e22ce';
      darkColor = '#3b0764';
      rimColor = 'rgba(236, 72, 153, 0.5)';
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    // Radial gradient simulating sun lighting from top-left
    const grad = ctx.createRadialGradient(cx - 40, cy - 40, 10, cx, cy, R);
    grad.addColorStop(0, lightColor);
    grad.addColorStop(0.7, darkColor);
    grad.addColorStop(1.0, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. Latitude Circles
    const latBands = [-60, -30, 0, 30, 60];
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 1.0;

    for (const lat of latBands) {
      ctx.beginPath();
      let started = false;
      for (let lng = -180; lng <= 180; lng += 10) {
        const pt = this.getHotspotScreenPos(lat, lng, R, cx, cy);
        if (pt) {
          if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    // 3. Longitude Meridians
    for (let lng = -180; lng < 180; lng += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -80; lat <= 80; lat += 5) {
        const pt = this.getHotspotScreenPos(lat, lng, R, cx, cy);
        if (pt) {
          if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    // 4. Discovered Hotspots (Phosphor Blips)
    if (this.activePlanetDetail?.survey?.discoveredHotspots) {
      const now = performance.now();
      const pulse = 0.7 + 0.3 * Math.sin(now * 0.006);

      for (const h of this.activePlanetDetail.survey.discoveredHotspots) {
        const pt = this.getHotspotScreenPos(h.lat, h.lng, R, cx, cy);
        if (!pt) continue;

        ctx.save();
        ctx.fillStyle = h.color || '#38bdf8';
        ctx.shadowColor = h.color || '#38bdf8';
        ctx.shadowBlur = 8 * pulse;

        // Diamond blip
        const size = (this.hoveredHotspot?.id === h.id ? 7 : 4.5) * pulse;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - size);
        ctx.lineTo(pt.x + size, pt.y);
        ctx.lineTo(pt.x, pt.y + size);
        ctx.lineTo(pt.x - size, pt.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 5. Active Sensor Beacons (Pulsating Rings)
    if (this.activePlanetDetail?.beacons) {
      const now = performance.now();
      for (const b of this.activePlanetDetail.beacons) {
        const pt = this.getHotspotScreenPos(b.surfaceLat, b.surfaceLng, R, cx, cy);
        if (!pt) continue;

        const ringR = 3 + ((now * 0.005) % 8);
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore(); // End sphere clip

    // 6. Atmospheric Rim Glow
    ctx.save();
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = rimColor;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 7. Hovered Hotspot Tooltip
    if (this.hoveredHotspot) {
      const pt = this.getHotspotScreenPos(this.hoveredHotspot.lat, this.hoveredHotspot.lng, R, cx, cy);
      if (pt) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = this.hoveredHotspot.color || '#38bdf8';
        ctx.lineWidth = 1;
        const text = `${this.hoveredHotspot.name} [${this.hoveredHotspot.yieldEstimate}]`;
        ctx.font = 'bold 9px monospace';
        const tw = ctx.measureText(text).width;
        ctx.fillRect(pt.x + 8, pt.y - 18, tw + 10, 16);
        ctx.strokeRect(pt.x + 8, pt.y - 18, tw + 10, 16);

        ctx.fillStyle = '#f8fafc';
        ctx.fillText(text, pt.x + 13, pt.y - 6);
        ctx.restore();
      }
    }
  }

  /**
   * Updates all survey modal widgets, buttons, and progress counters.
   */
  private updateSurveyConsoleUI(): void {
    if (!this.activePlanetDetail) return;
    const survey = this.activePlanetDetail.survey;

    const elCompVal = document.getElementById('survey-comp-val');
    if (elCompVal) elCompVal.textContent = `${survey.surveyCompletion}%`;

    const elStatMin = document.getElementById('status-scan-minerals');
    const elStatBio = document.getElementById('status-scan-bio');
    const elStatAno = document.getElementById('status-scan-anomalies');

    if (elStatMin) {
      if (survey.scannedMinerals) {
        elStatMin.textContent = 'ACTIVE // SCAN COMPLETE';
        elStatMin.classList.add('active');
      } else {
        elStatMin.textContent = 'UNSCANNED // 2 AP';
        elStatMin.classList.remove('active');
      }
    }

    if (elStatBio) {
      if (survey.scannedBio) {
        elStatBio.textContent = 'ACTIVE // SCAN COMPLETE';
        elStatBio.classList.add('active');
      } else {
        elStatBio.textContent = 'UNSCANNED // 2 AP';
        elStatBio.classList.remove('active');
      }
    }

    if (elStatAno) {
      if (survey.scannedAnomalies) {
        elStatAno.textContent = 'ACTIVE // SCAN COMPLETE';
        elStatAno.classList.add('active');
      } else {
        elStatAno.textContent = 'UNSCANNED // 2 AP';
        elStatAno.classList.remove('active');
      }
    }

    const elBeaconsCount = document.getElementById('survey-beacons-count');
    if (elBeaconsCount) {
      elBeaconsCount.textContent = `${this.activePlanetDetail.beacons?.length || 0}`;
    }

    const elAp = document.getElementById('survey-player-ap');
    if (elAp) elAp.textContent = `${this.playerAP.currentAP} / ${this.playerAP.maxAP}`;

    this.refreshHotspotsLedger();
  }

  /**
   * Refreshes the scrollable list of discovered hotspots and active beacons.
   */
  private refreshHotspotsLedger(): void {
    const list = document.getElementById('survey-hotspots-list');
    if (!list) return;

    const hotspots = this.activePlanetDetail?.survey?.discoveredHotspots || [];
    const beacons = this.activePlanetDetail?.beacons || [];

    if (hotspots.length === 0 && beacons.length === 0) {
      list.innerHTML = `<div class="ledger-empty">NO HOTSPOTS DETECTED. INITIATE SENSOR SWEEPS [1-3] TO IDENTIFY SURFACE DEPOSITS.</div>`;
      return;
    }

    let html = '';
    for (const h of hotspots) {
      html += `
        <div class="hotspot-card" data-lat="${h.lat}" data-lng="${h.lng}">
          <div class="hotspot-card-left">
            <span class="hotspot-dot" style="color: ${h.color};"></span>
            <div class="hotspot-card-info">
              <span class="hotspot-name">${h.name}</span>
              <span class="hotspot-coords">LAT: ${h.lat.toFixed(1)}° // LNG: ${h.lng.toFixed(1)}°</span>
            </div>
          </div>
          <span class="hotspot-yield">${h.yieldEstimate}</span>
        </div>
      `;
    }

    for (const b of beacons) {
      html += `
        <div class="hotspot-card" style="border-color: rgba(255, 255, 255, 0.4);">
          <div class="hotspot-card-left">
            <span class="hotspot-dot" style="color: #ffffff; box-shadow: 0 0 10px #ffffff;"></span>
            <div class="hotspot-card-info">
              <span class="hotspot-name">SURFACE SENSOR BEACON</span>
              <span class="hotspot-coords">LAT: ${b.surfaceLat.toFixed(1)}° // LNG: ${b.surfaceLng.toFixed(1)}°</span>
            </div>
          </div>
          <span class="hotspot-yield" style="color: #10b981;">${b.yieldSummary}</span>
        </div>
      `;
    }

    list.innerHTML = html;
  }

  /**
   * Executes a specialized sensor sweep across the chosen sensor band.
   */
  public async performScannerSweep(band: 'MINERALS' | 'BIO' | 'ANOMALIES'): Promise<void> {
    if (!this.activePlanet || !this.activePlanetDetail) return;

    if (this.playerAP.currentAP < 2) {
      this.showApNotification('⚠️ INSUFFICIENT ACTION POINTS: Sweep requires 2 AP.', true);
      return;
    }

    // Play band sonar ping
    this.audio.playScannerSonarPing(band);

    try {
      const res = await fetch(`http://localhost:3000/api/planets/${this.activePlanet.data.id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
          scanBand: band,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.showApNotification(`⚠️ ${data.error || 'Scan sweep failed'}`, true);
        return;
      }

      this.activePlanetDetail.survey = data.survey;
      this.fetchPlayerAP();
      this.updateSurveyConsoleUI();
      this.showApNotification(`📡 ${data.message}`, false);
    } catch (err) {
      console.error('[DAY 18] Scanner sweep failed:', err);
    }
  }

  /**
   * Launches an Atmospheric / Surface Probe to sample materials and establish a permanent beacon.
   */
  public async launchAtmosphericProbe(): Promise<void> {
    if (!this.activePlanet || !this.activePlanetDetail) return;

    const checkShield = document.getElementById('check-probe-shield') as HTMLInputElement | null;
    const shieldBoost = checkShield ? checkShield.checked : false;

    if (shieldBoost && this.playerAP.currentAP < 1) {
      this.showApNotification('⚠️ INSUFFICIENT AP: Shield reinforcement requires 1 AP.', true);
      return;
    }

    const btn = document.getElementById('btn-launch-probe') as HTMLButtonElement | null;
    if (btn) btn.disabled = true;

    // Show descent telemetry display
    const descentBox = document.getElementById('probe-descent-display');
    const altMarker = document.getElementById('probe-altitude-marker');
    const altVal = document.getElementById('probe-alt-val');
    const velVal = document.getElementById('probe-vel-val');
    const shieldVal = document.getElementById('probe-shield-val');
    const statusMsg = document.getElementById('probe-status-msg');

    if (descentBox) descentBox.classList.remove('hidden');

    this.audio.playProbeAtmosphericBurn(shieldBoost);

    // Animate descent
    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.08;
      const pct = Math.min(100, Math.round(progress * 100));
      const altKm = Math.max(0, Math.round(120 * (1 - progress)));
      const velKms = Math.max(0.5, Number((4.2 * (1 - progress * 0.7)).toFixed(1)));

      if (altMarker) altMarker.style.width = `${pct}%`;
      if (altVal) altVal.textContent = `${altKm} km`;
      if (velVal) velVal.textContent = `${velKms} km/s`;
      if (shieldVal) shieldVal.textContent = shieldBoost ? '94%' : '68%';

      if (progress >= 1.0) {
        clearInterval(interval);
      }
    }, 80);

    try {
      const res = await fetch(`http://localhost:3000/api/planets/${this.activePlanet.data.id}/probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
          targetLat: this.targetedLat,
          targetLng: this.targetedLng,
          shieldBoost,
        }),
      });

      const data = await res.json();
      if (btn) btn.disabled = false;

      if (!res.ok || !data.success) {
        this.showApNotification(`⚠️ ${data.error || 'Probe deployment failed'}`, true);
        if (statusMsg) statusMsg.textContent = 'PROBE TELEMETRY LOST';
        return;
      }

      if (statusMsg) statusMsg.textContent = `TOUCHDOWN CONFIRMED // BEACON ONLINE`;

      // Update local state
      this.activePlanetDetail.beacons.unshift({
        id: data.beaconId,
        surfaceLat: this.targetedLat,
        surfaceLng: this.targetedLng,
        yieldSummary: data.yieldSummary,
        createdAt: new Date().toISOString(),
      });

      this.fetchPlayerAP();
      this.updateSurveyConsoleUI();
      this.showApNotification(`🚀 ${data.message}`, false);

      setTimeout(() => {
        if (descentBox) descentBox.classList.add('hidden');
      }, 4000);
    } catch (err) {
      if (btn) btn.disabled = false;
      console.error('[DAY 18] Probe launch failed:', err);
    }
  }

  /**
   * Refreshes the Station Astrometry Cartography Bureau in the diplomacy lounge.
   */
  public async refreshAstrometryBureau(): Promise<void> {
    const list = document.getElementById('astrometry-planets-list');
    if (!list) return;

    try {
      const res = await fetch(`http://localhost:3000/api/planets/sector/${this.currentSectorId}`);
      if (!res.ok) return;
      const data = await res.json();
      const planets = data.planets || [];

      let html = '';
      let qualifyingCount = 0;

      for (const p of planets) {
        const comp = p.survey?.surveyCompletion || 0;
        if (comp >= 33) {
          qualifyingCount++;
          const isSold = p.survey.isDataSold;
          const factionMultiplier = p.controllingFaction === 'FACTION_SOL' ? 1.4 : 1.0;
          const creditReward = Math.round((comp / 100) * 1000 * factionMultiplier);

          html += `
            <div class="astrometry-card">
              <div class="astrometry-card-left">
                <div class="astrometry-planet-title">
                  <span>${p.name}</span>
                  <span class="astrometry-comp-badge">${comp}% SURVEYED</span>
                </div>
                <div class="astrometry-planet-details">
                  ${p.archetype} WORLD // HABITABILITY: ${p.habitabilityRating}% // BEACONS: ${p.beacons?.length || 0}
                </div>
              </div>
              <button class="astrometry-bounty-btn" data-planet-id="${p.id}" ${isSold ? 'disabled' : ''}>
                ${isSold ? 'REMITTED // PAID' : `REMIT DATA (+${creditReward} CR, +5 AP, +15 Goodwill)`}
              </button>
            </div>
          `;
        }
      }

      if (qualifyingCount === 0) {
        html = `
          <div class="ledger-empty" style="color: #94a3b8; text-align: left; padding: 0.8rem 0;">
            No authenticated survey logs in archive. Scan celestial planets in the sector to >=33% completion to sell astrometry logs here.
          </div>
        `;
      }

      list.innerHTML = html;

      // Bind remit buttons
      const btns = list.querySelectorAll('.astrometry-bounty-btn:not([disabled])');
      btns.forEach((b) => {
        b.addEventListener('click', async (e) => {
          const planetId = (e.currentTarget as HTMLElement).getAttribute('data-planet-id');
          if (!planetId) return;
          try {
            const sellRes = await fetch(`http://localhost:3000/api/planets/${planetId}/sell-data`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accountId: 'acc_sol_captain',
                portId: 'PORT_AEGIS_01',
              }),
            });
            const sellData = await sellRes.json();
            if (sellRes.ok && sellData.success) {
              this.audio.playUiBlip();
              this.showApNotification(`💰 ${sellData.message}`, false);
              this.fetchPlayerAP();
              this.refreshFactionStandings();
              this.refreshAstrometryBureau();
            } else {
              this.showApNotification(`⚠️ ${sellData.error || 'Sale failed'}`, true);
            }
          } catch (err) {
            console.error('[DAY 18] Failed to sell survey data:', err);
          }
        });
      });
    } catch (err) {
      console.warn('[DAY 18] Astrometry bureau fetch failed:', err);
    }
  }

  public getPlayerLoadout(): any {
    return this.playerLoadout;
  }

  public getEquipmentCatalog(): any[] {
    return this.equipmentCatalog;
  }
}

// Instantiate engine when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  (window as any).gameEngine = new GameEngine();
});
