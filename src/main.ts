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

    // Customize station comms & dialog per active sector
    if (this.currentSectorId === 3) {
      if (this.modalStationName) this.modalStationName.textContent = 'OBSIDIAN FOUNDRY 3 // SECTOR 03';
      if (this.modalDockBadge) this.modalDockBadge.textContent = 'CLASS 2 INDUSTRIAL SMELTER';
      if (this.modalDockSubtext) this.modalDockSubtext.textContent = 'THE LITHOS AXIOM JURISDICTION // POPULATION 18,500';
      if (this.modalOfficerAvatar) this.modalOfficerAvatar.textContent = '🦾';
      if (this.modalOfficerName) this.modalOfficerName.textContent = 'FOUNDRY MASTER IGNIS // COMM FREQ 142.4 MHz';
      if (this.modalOfficerQuote) {
        this.modalOfficerQuote.textContent =
          '"Industrial clamps engaged. Core temperatures holding at 1,850 Kelvin. Welcome to Obsidian Foundry 3. We have surplus Silicate Ore and Plasteel Alloy ready for export, but our fuel reserves are dangerously low. Sell us Deuterium or buy our refined ore!"';
      }
    } else {
      if (this.modalStationName && this.station) this.modalStationName.textContent = `${this.station.config.name} // SECTOR 0${this.currentSectorId}`;
      if (this.modalDockBadge) this.modalDockBadge.textContent = 'CLASS 1 FREE-TRADE HUB';
      if (this.modalDockSubtext) this.modalDockSubtext.textContent = 'SOL-PERIMETER LEAGUE JURISDICTION // POPULATION 42,000';
      if (this.modalOfficerAvatar) this.modalOfficerAvatar.textContent = '👨‍🚀';
      if (this.modalOfficerName) this.modalOfficerName.textContent = 'HARBORMASTER VANCE // COMM FREQ 114.8 MHz';
      if (this.modalOfficerQuote) {
        switch (this.currentFaction.id) {
          case 'FACTION_PHORID':
            this.modalOfficerQuote.textContent =
              '"Szzzzzt! Organic trader hull locked! Welcome to Aegis Exchange Spire! Docking fee is 8 Credits per oxygen liter, payable upon departure. What surplus moisture do you have to barter?"';
            break;
          case 'FACTION_LITHOS':
            this.modalOfficerQuote.textContent =
              '"Axiom Harmonic Resonance confirmed. The geometric lattice of Aegis Terminal welcomes your low-entropy vessel. Our prism storage arrays are ready for harmonic transfer."';
            break;
          case 'FACTION_VAELIC':
            this.modalOfficerQuote.textContent =
              '"Vessel registered under Hegemony Direct Calculus index. Docking priority granted. Ensure all kinetic discharge manifolds remain offline during refueling tithes."';
            break;
          default:
            this.modalOfficerQuote.textContent =
              '"Docking clamps secured, Captain. Atmospheric seals holding at 1.0 ATM. Power couplers attached. Welcome to Aegis Terminal. We\'ve got fresh Deuterium in the fuel depot and our industrial smelters are buying raw ore at high margins today. What\'s your business?"';
            break;
        }
      }
    }

    // Load live market inventory from backend database
    this.loadPortInventory();

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

    if (this.hudSector) {
      this.hudSector.classList.add('clickable');
      this.hudSector.title = 'Click to open Hyperspace Nav Computer (J)';
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

      if (e.code === 'KeyJ') {
        if (this.modalNav && !this.modalNav.classList.contains('hidden')) {
          this.closeNavModal();
        } else {
          this.openNavModal();
        }
        return;
      }

      if (e.code === 'Escape') {
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
        case 'KeyE': {
          e.preventDefault();
          if (this.station) {
            const dockCheck = this.station.checkDocking(
              this.flightController.position,
              this.flightController.velocity.length()
            );
            if (dockCheck.canDock) {
              this.dockShip();
            }
          }
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

    // 9. Update Tactical Target Reticle (Milestone 0.3)
    this.updateTacticalReticle();

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
          const snapshot = JSON.parse(event.data);
          if (snapshot.type === 'TICK_SNAPSHOT') {
            this.handleCombatSnapshot(snapshot);
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
      this.combatSocket.send(
        JSON.stringify({
          type: 'INPUT',
          inputs: this.combatInputs,
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
        this.elTargetFaction.textContent = this.primaryDroneTarget.faction || 'HEGEMONY';
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
      this.elReticleName.textContent = this.primaryDroneTarget.name.toUpperCase();
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
}

// Instantiate engine when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new GameEngine();
});
