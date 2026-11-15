import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ProceduralHullGenerator, type HullGenerationResult } from './procgen/ProceduralHullGenerator';
import { type FactionStyle, FACTION_STYLES } from './procgen/FactionStyles';
import { getFactionEntry } from '../shared/FactionRegistry';
import { ShipFlightController, type FlightTelemetry } from './physics/ShipFlightController';
import { ThrusterParticleSystem } from './vfx/ThrusterParticleSystem';
import { SpaceStation } from './entities/SpaceStation';
import { AsteroidField } from './entities/AsteroidField';
import { type DockingStatus } from './entities/DockingZone';
import { AudioEngine } from './audio/AudioEngine';
import { ShieldBubble, CombatVfxSystem } from './vfx/CombatVfxSystem';
import { ProceduralPlanet } from './entities/ProceduralPlanet';
import { PrecursorTerminalController, type PrecursorSiteData } from './controllers/PrecursorTerminalController';
import { LanderController } from './controllers/LanderController';
import { CommsController } from './controllers/CommsController';
import { ColonyController } from './controllers/ColonyController';
import { SurveyController } from './controllers/SurveyController';
import { CombatClient } from './controllers/CombatClient';
import { XenobiologyController } from './controllers/XenobiologyController';
import { FleetController } from './controllers/FleetController';
import { TacticalCommandWheel } from './controllers/TacticalCommandWheel';
import { StarmapController } from './controllers/StarmapController';
import { HyperspaceFlightController } from './controllers/HyperspaceFlightController';
import { MissionBoardController } from './controllers/MissionBoardController';
import { CrewController } from './controllers/CrewController';
import { MultiplayerController } from './controllers/MultiplayerController';
import { OutfittingController } from './controllers/OutfittingController';
import { StationMarketController } from './controllers/StationMarketController';
import { WarpNavController } from './controllers/WarpNavController';
import { apiClient } from './network/ApiClient';

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

  // Modular Sub-System Controllers
  public commsController!: CommsController;
  public precursorTerminalController!: PrecursorTerminalController;
  public landerController!: LanderController;
  public colonyController!: ColonyController;
  public surveyController!: SurveyController;
  public combatClient!: CombatClient;
  public xenobiologyController!: XenobiologyController;
  public fleetController!: FleetController;
  public tacticalCommandWheel!: TacticalCommandWheel;
  public starmapController!: StarmapController;
  public hyperspaceFlightController!: HyperspaceFlightController;
  public missionBoardController!: MissionBoardController;
  public crewController!: CrewController;
  public multiplayerController!: MultiplayerController;
  public outfittingController!: OutfittingController;
  public marketController!: StationMarketController;
  public warpNavController!: WarpNavController;

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
  private baseFov: number = 52;

  // Nav DOM Elements
  private btnOpenNav: HTMLElement | null = null;
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
  private elBackendBadge: HTMLElement | null = null;
  private btnUndock: HTMLElement | null = null;
  private btnQuickService: HTMLElement | null = null;

  // Economy & Cargo Hold (Day 9)
  private playerCredits: number = 2500;

  private modalOfficerAvatar: HTMLElement | null = null;
  private modalOfficerName: HTMLElement | null = null;
  private modalDockBadge: HTMLElement | null = null;
  private modalDockSubtext: HTMLElement | null = null;
  private hasInitialSceneLoaded: boolean = false;

  // Milestone 0.3 Authoritative 20Hz Combat Inputs
  public get combatInputs() {
    return this.combatClient.combatInputs;
  }

  // Day 12 Weapon Profiles & Combat VFX
  private activeWeaponIndex: number = 0;
  private readonly weaponProfiles: Array<{ id: 'PULSE' | 'PLASMA' | 'FLAK' | 'RAIL' | 'TORPEDO'; name: string; color: string }> = [
    { id: 'PULSE', name: 'LIGHT PULSE CANNON', color: '#00f0ff' },
    { id: 'PLASMA', name: 'HEAVY PLASMA ACCELERATOR', color: '#10b981' },
    { id: 'FLAK', name: 'SCATTER FLAK BLASTER', color: '#fbbf24' },
    { id: 'RAIL', name: 'HEAVY RAIL-LANCE (H3)', color: '#c084fc' },
    { id: 'TORPEDO', name: 'SIEGE TORPEDO BAY', color: '#f97316' },
  ];
  private combatVfx!: CombatVfxSystem;
  private playerShieldBubble!: ShieldBubble;

  private elActiveWeapon: HTMLElement | null = null;
  private elTacticalModule: HTMLElement | null = null;

  // MMORPG Ability Hotbar Cooldown Elements
  private elSlotHigh1: HTMLElement | null = null;
  private elSlotHigh2: HTMLElement | null = null;
  private elSlotHigh3: HTMLElement | null = null;
  private elSlotMid1: HTMLElement | null = null;
  private elSlotMid2: HTMLElement | null = null;
  private elSlotMid3: HTMLElement | null = null;
  private elCdHigh1: HTMLElement | null = null;
  private elCdHigh2: HTMLElement | null = null;
  private elCdMid1: HTMLElement | null = null;
  private elCdMid2: HTMLElement | null = null;

  private lastFireTimes = {
    PULSE: 0,
    PLASMA: 0,
    FLAK: 0,
    RAIL: 0,
    TORPEDO: 0,
    BOOST: 0,
  };

  private currentGeometryProfile = {
    lengthMult: 1.0,
    widthMult: 1.0,
    heightMult: 1.0,
    wingSpread: 1.0,
    weaponHardpoints: 2,
  };
  // Action Point (AP) System (Day 7)
  private playerAP = {
    playerId: '',
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

  // Day 13: Station Service Tabs DOM
  private tabBtnExchange: HTMLElement | null = null;
  private tabBtnOutfitting: HTMLElement | null = null;
  private tabBtnArmory: HTMLElement | null = null;
  private viewTabExchange: HTMLElement | null = null;
  private viewTabOutfitting: HTMLElement | null = null;
  private viewTabArmory: HTMLElement | null = null;
  private activeStationTab: 'exchange' | 'outfitting' | 'armory' | 'contracts' | 'missions' | 'salvage' | 'diplomacy' | 'fleet' | 'crew' = 'exchange';

  // Station Tabs
  private tabBtnContracts: HTMLElement | null = null;
  private viewTabContracts: HTMLElement | null = null;
  private tabBtnMissions: HTMLElement | null = null;
  private viewTabMissions: HTMLElement | null = null;
  private elContractsActiveList: HTMLElement | null = null;
  private elContractsActiveCount: HTMLElement | null = null;
  private elKillmailsArchiveList: HTMLElement | null = null;
  private elKillmailsCount: HTMLElement | null = null;

  private tabBtnSalvage: HTMLElement | null = null;
  private viewTabSalvage: HTMLElement | null = null;

  private tabBtnDiplomacy: HTMLElement | null = null;
  private viewTabDiplomacy: HTMLElement | null = null;
  private tabBtnFleet: HTMLElement | null = null;
  private viewTabFleet: HTMLElement | null = null;
  private tabBtnCrew: HTMLElement | null = null;
  private viewTabCrew: HTMLElement | null = null;
  private btnHudHailTarget: HTMLElement | null = null;

  public get activeTruceExpiresAt(): number | null {
    return this.commsController?.activeTruceExpiresAt ?? null;
  }
  public set activeTruceExpiresAt(time: number | null) {
    if (this.commsController) this.commsController.activeTruceExpiresAt = time;
  }
  public get truceTimerInterval(): any {
    return this.commsController?.truceTimerInterval;
  }
  public set truceTimerInterval(interval: any) {
    if (this.commsController) this.commsController.truceTimerInterval = interval;
  }

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

    // 14. Initialize Modular Sub-System Controllers before listeners or async auth
    this.initControllers();

    // 15. Setup Event Listeners
    this.setupEventListeners();

    // 16. Post-controller startup routines (auth gate, health badge, deep links)
    this.runStartupLifecycle();

    // 17. Start Animation & Physics Loop
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

    const p = this.currentGeometryProfile;
    const result: HullGenerationResult = ProceduralHullGenerator.generate({
      seed: this.currentSeed,
      faction: this.currentFaction,
      length: Math.round(8000 * p.lengthMult),
      width: Math.round(2800 * p.widthMult),
      height: Math.round(1600 * p.heightMult),
      wingSpread: Math.round(1400 * p.wingSpread),
      weaponHardpoints: p.weaponHardpoints > 0,
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
      if (this.combatClient.modalClinicRescue) {
        this.combatClient.modalClinicRescue.classList.remove('hidden');
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
    } else if (this.activeStationTab === 'missions') {
      this.missionBoardController?.loadBoard();
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
    this.elBackendBadge = document.getElementById('backend-status-badge');
    this.btnUndock = document.getElementById('btn-undock');
    this.btnQuickService = document.getElementById('btn-quick-service');

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

    // Nav Console Trigger
    this.btnOpenNav = document.getElementById('btn-open-nav');
    this.navFuelDisplay = document.getElementById('nav-fuel-display');
    this.hudSector = document.getElementById('hud-sector');

    this.elActiveWeapon = document.getElementById('val-active-weapon');
    this.elTacticalModule = document.getElementById('val-tactical-module');

    // Ability Hotbar Slots
    this.elSlotHigh1 = document.getElementById('slot-high-1');
    this.elSlotHigh2 = document.getElementById('slot-high-2');
    this.elSlotMid1 = document.getElementById('slot-mid-1');
    this.elSlotMid2 = document.getElementById('slot-mid-2');
    this.elCdHigh1 = document.getElementById('cd-high-1');
    this.elCdHigh2 = document.getElementById('cd-high-2');
    this.elCdMid1 = document.getElementById('cd-mid-1');
    this.elCdMid2 = document.getElementById('cd-mid-2');

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
    this.elSlotHigh3 = document.getElementById('slot-high-3');
    this.elSlotMid3 = document.getElementById('slot-mid-3');
    this.elSlotHigh3?.addEventListener('click', () => {
      this.selectWeaponPreset(3);
      this.fireWeaponDirectly('RAIL');
    });
    this.elSlotMid3?.addEventListener('click', () => {
      this.combatInputs.fireTactical = true;
      this.sendCombatInputs();
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

    if (this.hudSector) {
      this.hudSector.classList.add('clickable');
      this.hudSector.title = 'Click to open Hyperspace Nav Computer (J)';
    }

    this.tabBtnContracts = document.getElementById('tab-btn-contracts');
    this.viewTabContracts = document.getElementById('view-tab-contracts');
    this.elContractsActiveList = document.getElementById('contracts-active-list');
    this.elContractsActiveCount = document.getElementById('contracts-active-count');
    this.elKillmailsArchiveList = document.getElementById('killmails-archive-list');
    this.elKillmailsCount = document.getElementById('killmails-count');
    this.tabBtnContracts?.addEventListener('click', () => this.switchStationTab('contracts'));

    this.tabBtnMissions = document.getElementById('tab-btn-missions');
    this.viewTabMissions = document.getElementById('view-tab-missions');
    this.tabBtnMissions?.addEventListener('click', () => this.switchStationTab('missions'));

    // Day 15 & 16: Station Salvage Bay & Diplomacy Station Tabs
    this.tabBtnSalvage = document.getElementById('tab-btn-salvage');
    this.viewTabSalvage = document.getElementById('view-tab-salvage');
    this.tabBtnSalvage?.addEventListener('click', () => this.switchStationTab('salvage'));

    this.tabBtnDiplomacy = document.getElementById('tab-btn-diplomacy');
    this.viewTabDiplomacy = document.getElementById('view-tab-diplomacy');
    this.tabBtnDiplomacy?.addEventListener('click', () => this.switchStationTab('diplomacy'));

    // Day 32: Fleet Hangar Bay Tab
    this.tabBtnFleet = document.getElementById('tab-btn-fleet');
    this.viewTabFleet = document.getElementById('view-tab-fleet');
    this.tabBtnFleet?.addEventListener('click', () => this.switchStationTab('fleet'));

    // Milestone 1.5: Procedural Crew & Station Bays Tab
    this.tabBtnCrew = document.getElementById('tab-btn-crew');
    this.viewTabCrew = document.getElementById('view-tab-crew');
    this.tabBtnCrew?.addEventListener('click', () => this.switchStationTab('crew'));

    // Day 29: Xenobiology & Genomics Lab Tab & Direct Trigger
    document.getElementById('tab-btn-xenobiology')?.addEventListener('click', () => this.openXenobiologyLab());
    document.getElementById('btn-dock-xenobiology')?.addEventListener('click', () => this.openXenobiologyLab());

    this.btnHudHailTarget = document.getElementById('btn-hud-hail-target');
    this.btnHudHailTarget?.addEventListener('click', () => this.hailCurrentTargetOrEnvoy());
  }

  private runStartupLifecycle(): void {
    // Hash routing for direct modal access / deep linking (#survey, #lander, #precursor, #terminal, #lab)
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#survey') {
        this.enterOrbit();
      } else if (hash === '#lander') {
        this.enterOrbit();
        this.openSurfaceLander();
      } else if (hash === '#precursor') {
        this.enterOrbit();
        this.switchSurveyTab('PRECURSOR');
      } else if (hash === '#terminal' || hash === '#precursor-terminal') {
        this.enterOrbit();
        this.openPrecursorTerminal();
      } else if (hash === '#xenobiology' || hash === '#lab') {
        this.openXenobiologyLab();
      }
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    setTimeout(handleHash, 300);

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

    // Check backend health & enforce mandatory Captain Bearer Session before loading galaxy state
    this.checkBackendHealth();
    void this.bootstrapAuthenticatedSession();
  }

  private async bootstrapAuthenticatedSession(): Promise<void> {
    const profile = await this.multiplayerController.ensureAuthenticated();
    await this.hydrateAuthenticatedSession(profile?.account?.id);
  }

  private hydratedForToken: string | null = null;

  private async hydrateAuthenticatedSession(accountId?: string): Promise<void> {
    const tok = apiClient.getToken();
    if (!tok || this.hydratedForToken === tok) return;
    this.hydratedForToken = tok;
    if (accountId) {
      this.playerAP.playerId = accountId;
    }
    this.multiplayerController.connectSocialSocket();
    await this.refreshFactionStandings();
    await this.fetchPlayerAP();
    await this.loadShipAndSector();
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
    const accountId = apiClient.getAccountId();
    if (!accountId) return;
    try {
      const res = await fetch(`/api/player/ap?playerId=${encodeURIComponent(accountId)}`);
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
          playerId: apiClient.getAccountId(),
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
        body: JSON.stringify({ playerId: apiClient.getAccountId(), amount: target }),
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
    await this.marketController.refreshPlayerHold();
  }

  public showMarketToast(message: string, isError: boolean = false): void {
    this.marketController.showMarketToast(message, isError);
  }

  private async loadPortInventory(portId?: string): Promise<void> {
    await this.marketController.loadPortInventory(portId);
  }

  public async executeTrade(portId: string, commodityId: string, quantity: number, type: 'BUY' | 'SELL'): Promise<void> {
    await this.marketController.executeTrade(portId, commodityId, quantity, type);
  }

  public get cargoHold(): Array<{ commodity_id: string; name: string; quantity: number }> {
    return this.marketController?.playerCargoHold || [];
  }

  public get activePortId(): string | null {
    return this.marketController?.currentMarketPortId || null;
  }

  public get isWarping(): boolean {
    return this.warpNavController?.isWarping ?? false;
  }

  public async loadShipAndSector(): Promise<void> {
    const accountId = apiClient.getAccountId();
    if (!accountId) return;
    try {
      const res = await fetch(`/api/player/ship?playerId=${encodeURIComponent(accountId)}`);
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

        if (data.ship.geometryProfile) {
          this.currentGeometryProfile = data.ship.geometryProfile;
        }
        const shipSeed = Number(data.ship.hull_seed || this.currentSeed);
        const resolvedEntry = getFactionEntry(data.ship.faction_id);
        const resolvedStyle = FACTION_STYLES[resolvedEntry.id] || FACTION_STYLES.FACTION_SOL;
        if (shipSeed !== this.currentSeed || resolvedStyle.id !== this.currentFaction.id || !this.shipMesh) {
          this.generateShip(shipSeed, resolvedStyle);
        } else if (data.ship.geometryProfile) {
          this.generateShip(shipSeed, resolvedStyle);
        }

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
        await this.loadOutfittingData();
        this.missionBoardController?.loadBoard();
        this.commsController?.loadSectorCaptainsPill();
      }
    } catch (err) {
      console.warn('[NAV] Failed to load ship and sector:', err);
    }
  }

  public openNavModal(): void {
    this.warpNavController.openNavModal();
  }

  public closeNavModal(): void {
    this.warpNavController.closeNavModal();
  }

  public async executeWarpJump(targetSectorId: number): Promise<void> {
    await this.warpNavController.executeWarpJump(targetSectorId);
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
    } else if (sectorId === 201) {
      // Day 25: Charybdis Contested Skirmish Warzone
      this.scene.background = new THREE.Color(0x180505);
      this.scene.fog = new THREE.FogExp2(0x180505, 0.0022);
      this.starLight.color.setHex(0xff5555);
      this.ambientLight.color.setHex(0x351010);

      this.station = null;
      this.asteroidField = new AsteroidField(seed || 99201, 35);
      this.scene.add(this.asteroidField.group);

      if (this.modalStationName) {
        this.modalStationName.textContent = 'CHARYBDIS WARZONE // SECTOR 201';
      }
    } else {
      // Frontier / Deep Star Systems: spawn asteroid mining belt synced with server
      this.scene.background = new THREE.Color(0x050812);
      this.scene.fog = new THREE.FogExp2(0x050812, 0.0024);
      this.asteroidField = new AsteroidField(seed || sectorId * 919, 32);
      this.scene.add(this.asteroidField.group);
    }

    // Reset ship position slightly forward in the sector
    this.flightController.reset(new THREE.Vector3(0, 0, 18));

    // Connect Authoritative 20Hz Combat WebSocket for new sector (Milestone 0.3)
    this.initCombatWebSocket(sectorId);

    // Day 18: Load Sector Celestial Planet
    this.loadSectorPlanet(sectorId);
  }

  private initControllers(): void {
    this.commsController = new CommsController({
      audio: this.audio,
      showApNotification: (msg: string, isErr?: boolean) => this.showApNotification(msg, !!isErr),
      getCurrentSectorId: () => this.currentSectorId,
      refreshPlayerHold: () => this.refreshPlayerHold(),
      getTarget: () => this.combatClient?.primaryDroneTarget || null,
      getPlayerPosition: () => this.flightController?.position || null,
      onMissionAccepted: () => {
        this.missionBoardController?.loadBoard();
      },
    });

    this.precursorTerminalController = new PrecursorTerminalController({
      audio: this.audio,
      showApNotification: (msg: string, isErr?: boolean) => this.showApNotification(msg, !!isErr),
      onSiteDeciphered: async (_site: PrecursorSiteData) => {
        if (this.colonyController && this.activePlanet) {
          await this.colonyController.fetchPlanetPrecursorSites(this.activePlanet.data.id);
          await this.colonyController.fetchPrecursorResearch();
        }
      },
      getDockedSite: () => this.landerController?.landerState.dockedSite || null,
      getPlanetPrecursorSites: () => this.colonyController?.planetPrecursorSites || [],
    });

    this.landerController = new LanderController({
      audio: this.audio,
      showApNotification: (msg, isErr) => this.showApNotification(msg, !!isErr),
      openPrecursorTerminal: (site) => this.precursorTerminalController.openPrecursorTerminal(site),
      getActivePlanet: () => this.activePlanet,
      getPlanetPrecursorSites: () => this.colonyController?.planetPrecursorSites || [],
      isInOrbit: () => this.isInOrbit,
    });

    this.colonyController = new ColonyController({
      audio: this.audio,
      showApNotification: (msg, isErr) => this.showApNotification(msg, !!isErr),
      fetchPlayerAP: () => this.fetchPlayerAP(),
      refreshPlayerHold: () => this.refreshPlayerHold(),
      refreshFactionStandings: () => this.refreshFactionStandings(),
      getActivePlanet: () => this.activePlanet,
      getActivePlanetDetail: () => this.activePlanetDetail,
      getPlayerAP: () => this.playerAP,
    });

    this.crewController = new CrewController({
      audio: this.audio,
      getAccountId: () => apiClient.getAccountId(),
      getActivePortId: () => this.activePortId,
      getCurrentSectorId: () => this.currentSectorId,
      showApNotification: (msg, isErr) => this.showApNotification(msg, !!isErr),
      refreshPlayerHold: () => this.refreshPlayerHold(),
    });

    this.surveyController = new SurveyController({
      audio: this.audio,
      showApNotification: (msg, isErr) => this.showApNotification(msg, !!isErr),
      fetchPlayerAP: () => this.fetchPlayerAP(),
      refreshFactionStandings: () => this.refreshFactionStandings(),
      getPlayerAP: () => this.playerAP,
      getCurrentSectorId: () => this.currentSectorId,
      getScene: () => this.scene,
      getFlightController: () => this.flightController,
      getColonyController: () => this.colonyController,
      getCommsController: () => this.commsController,
      getLanderController: () => this.landerController,
      getPrecursorTerminalController: () => this.precursorTerminalController,
    });

    this.combatClient = new CombatClient({
      audio: this.audio,
      combatVfx: this.combatVfx,
      playerShieldBubble: this.playerShieldBubble,
      showApNotification: (msg, isErr) => this.showApNotification(msg, !!isErr),
      getFlightController: () => this.flightController,
      getScene: () => this.scene,
      getCamera: () => this.camera,
      getCurrentSectorId: () => this.currentSectorId,
      setCurrentSectorId: (id) => { this.currentSectorId = id; },
      getShipMesh: () => this.shipMesh,
      getAsteroidField: () => this.asteroidField,
      refreshCargoHold: () => this.refreshPlayerHold(),
      dockShip: () => this.dockShip(),
      refreshFactionStandings: () => this.refreshFactionStandings(),
      startTruceCountdown: (sec) => this.startTruceCountdown(sec),
      getTruceTimerInterval: () => this.truceTimerInterval,
      setTruceTimerInterval: (interval) => { this.truceTimerInterval = interval; },
      setActiveTruceExpiresAt: (time) => { this.activeTruceExpiresAt = time; },
      getPlayerCredits: () => this.playerCredits,
      setPlayerCredits: (cr) => {
        this.playerCredits = cr;
        this.marketController?.syncCreditDisplays(cr);
      },
      closeComms: () => this.commsController.closeAlienComms(),
      loadSectorScene: (id, seed) => this.loadSectorScene(id, seed ?? 99201),
      onCombatSnapshot: (snapshot) => {
        this.tacticalCommandWheel?.updateSquadronTelemetry(snapshot.entities);
      },
    });

    this.xenobiologyController = new XenobiologyController({
      getAccountId: () => apiClient.getAccountId(),
      onCargoUpdated: () => this.refreshPlayerHold(),
    });

    this.fleetController = new FleetController({
      getAccountId: () => apiClient.getAccountId(),
      showNotification: (msg, isErr) => this.showApNotification(msg, isErr ?? false),
      playUiBlip: () => this.audio.playUiBlip(),
      onFleetUpdated: async () => {
        await this.loadShipAndSector();
      },
    });

    this.tacticalCommandWheel = new TacticalCommandWheel(this.combatClient, this.audio);

    this.missionBoardController = new MissionBoardController({
      showNotification: (msg: string, isErr?: boolean) => this.showApNotification(msg, !!isErr),
      playUiBlip: () => this.audio.playUiBlip(),
      getCurrentSectorId: () => this.currentSectorId,
      getPlayerCredits: () => this.playerCredits,
      setPlayerCredits: (credits: number) => {
        this.playerCredits = credits;
        this.marketController?.syncCreditDisplays(credits);
      },
      onPlotCourse: async (sectorId: number) => {
        await this.starmapController.lockCourse(sectorId);
      },
      onBoardMutated: () => {
        this.refreshFactionStandings();
        this.commsController?.loadSectorCaptainsPill();
      },
    });

    this.marketController = new StationMarketController({
      audio: this.audio,
      showApNotification: (msg, isErr) => this.showApNotification(msg, !!isErr),
      getCurrentSectorId: () => this.currentSectorId,
      getPlayerCredits: () => this.playerCredits,
      setPlayerCredits: (cr) => {
        this.playerCredits = cr;
      },
      onCargoUpdated: (usedCargo, capacity) => {
        this.combatClient?.setCargoHudFill(usedCargo, capacity);
      },
    });

    this.outfittingController = new OutfittingController({
      audio: this.audio,
      showApNotification: (msg, isErr) => this.showApNotification(msg, !!isErr),
      getCurrentSectorId: () => this.currentSectorId,
      getPlayerCredits: () => this.playerCredits,
      setPlayerCredits: (cr) => {
        this.playerCredits = cr;
        this.marketController?.syncCreditDisplays(cr);
      },
      refreshPlayerHold: () => this.refreshPlayerHold(),
    });

    this.warpNavController = new WarpNavController({
      audio: this.audio,
      showApNotification: (msg, isErr) => this.showApNotification(msg, !!isErr),
      getCurrentSectorId: () => this.currentSectorId,
      getCurrentSectorName: () => this.currentSectorName,
      getAdjacentSectors: () => this.adjacentSectors,
      getShipFuel: () => this.shipFuel,
      getMaxShipFuel: () => this.maxShipFuel,
      getCurrentAP: () => this.playerAP.currentAP,
      setSectorAndFuel: (sectorId, sectorName, fuel, ap) => {
        this.currentSectorId = sectorId;
        this.currentSectorName = sectorName;
        this.shipFuel = fuel;
        this.playerAP.currentAP = ap;
        this.updateApUI();
      },
      getCamera: () => this.camera,
      getBaseFov: () => this.baseFov,
      loadSectorScene: (sectorId, seed) => this.loadSectorScene(sectorId, seed),
      loadShipAndSector: () => this.loadShipAndSector(),
      updateHudSectorAllegiance: () => this.updateHudSectorAllegiance(),
    });

    this.starmapController = new StarmapController({
      getAccountId: () => apiClient.getAccountId(),
      showNotification: (msg, isErr) => this.showApNotification(msg, isErr ?? false),
      playUiBlip: () => this.audio.playUiBlip(),
      playNavPlotTone: () => this.audio.playNavPlotTone(),
      playStarmapOpen: () => this.audio.playStarmapOpen(),
      getMissionTargetSectorIds: () => this.missionBoardController?.getActiveMissionSectorIds() || [],
    });

    this.multiplayerController = new MultiplayerController({
      audio: this.audio,
      showApNotification: (msg, isErr) => this.showApNotification(msg, !!isErr),
      onAuthenticated: async (profile) => {
        await this.hydrateAuthenticatedSession(profile?.account?.id);
      },
      onLoggedOut: () => {
        this.hydratedForToken = null;
        if (this.combatClient?.combatSocket) {
          try {
            this.combatClient.combatSocket.close();
          } catch {}
          this.combatClient.combatSocket = null;
        }
      },
      onRemoteHyperspacePos: (pos) => {
        if (pos.isInHyperspace) {
          this.hyperspaceFlightController.syncRemoteHyperspacePlayer({
            accountId: pos.accountId,
            callsign: pos.callsign,
            factionId: pos.factionId,
            x: pos.hyperspaceX,
            y: pos.hyperspaceY,
          });
        } else {
          this.hyperspaceFlightController.removeRemoteHyperspacePlayer(pos.accountId);
        }
      },
      onRefreshShipState: async () => {
        await this.loadShipAndSector();
        await this.refreshPlayerHold();
      },
    });

    this.hyperspaceFlightController = new HyperspaceFlightController(
      {
        getAccountId: () => apiClient.getAccountId(),
        showNotification: (msg, isErr) => this.showApNotification(msg, isErr ?? false),
        playUiBlip: () => this.audio.playUiBlip(),
        audio: this.audio,
        onHyperspaceSync: () => {
          this.multiplayerController?.notifyHyperspaceMoved();
        },
        onExitHyperspace: (newSectorId) => {
          this.currentSectorId = newSectorId;
          this.loadSectorScene(newSectorId, 101 * newSectorId);
          this.loadShipAndSector();
        },
        onInterception: (handshake) => {
          this.commsController.openHyperspaceInterception(handshake, (res) => {
            if (res.combatDropRequired) {
              this.hyperspaceFlightController.dropOutOfHyperspaceToCombat(res.combatSetup);
            } else {
              this.hyperspaceFlightController.resumeFlightAfterComms(res);
            }
          });
        },
        onCombatDrop: (_combatSetup) => {
          this.showApNotification('TACTICAL EMERGENCY: Dropping out of warp into combat arena!', true);
          this.loadSectorScene(this.currentSectorId, 101 * this.currentSectorId);
          this.loadShipAndSector();
          this.combatClient.initCombatWebSocket(this.currentSectorId);
        },
      },
      this.scene,
      this.camera
    );
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

    // Navigation & Hyperspace Flight Triggers (Day 8, 37 & 38)
    document.getElementById('btn-enter-hyperspace')?.addEventListener('click', () => {
      if (this.hyperspaceFlightController.isInHyperspace) {
        this.showApNotification('Already cruising in Hyperspace.', false);
      } else {
        this.hyperspaceFlightController.enterHyperspace(this.shipMesh || undefined);
      }
    });

    document.getElementById('btn-open-starmap')?.addEventListener('click', () => {
      this.starmapController.toggleStarmap();
    });

    this.btnOpenNav?.addEventListener('click', () => {
      this.openNavModal();
    });

    this.hudSector?.addEventListener('click', () => {
      this.openNavModal();
    });

    // Cockpit Minimal Drawer Toggles (Telemetry [T], Controls [F1], Hull Lab [B], Missions)
    const togglePanel = (panelId: string, btnId?: string) => {
      const panel = document.getElementById(panelId);
      if (!panel) return;
      const nowHidden = panel.classList.toggle('hidden');
      if (btnId) document.getElementById(btnId)?.classList.toggle('active', !nowHidden);
      this.audio.playUiBlip();
    };
    document.getElementById('btn-toggle-telemetry')?.addEventListener('click', () =>
      togglePanel('telemetry-panel', 'btn-toggle-telemetry')
    );
    document.getElementById('btn-toggle-controls')?.addEventListener('click', () =>
      togglePanel('instructions-panel', 'btn-toggle-controls')
    );
    document.getElementById('btn-toggle-hull-lab')?.addEventListener('click', () =>
      togglePanel('hull-generator-panel', 'btn-toggle-hull-lab')
    );
    document.getElementById('btn-close-telemetry')?.addEventListener('click', () => {
      document.getElementById('telemetry-panel')?.classList.add('hidden');
      document.getElementById('btn-toggle-telemetry')?.classList.remove('active');
    });
    document.getElementById('btn-close-controls')?.addEventListener('click', () => {
      document.getElementById('instructions-panel')?.classList.add('hidden');
      document.getElementById('btn-toggle-controls')?.classList.remove('active');
    });
    document.getElementById('btn-close-hull-lab')?.addEventListener('click', () => {
      document.getElementById('hull-generator-panel')?.classList.add('hidden');
      document.getElementById('btn-toggle-hull-lab')?.classList.remove('active');
    });
    document.getElementById('btn-toggle-missions')?.addEventListener('click', () => {
      document.getElementById('hud-mission-tracker')?.classList.toggle('collapsed');
    });

    // Keydown Controls
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.multiplayerController?.isAuthModalOpen()) {
        return;
      }
      if (this.multiplayerController?.isSocialModalOpen()) {
        if (e.code === 'Escape') {
          this.multiplayerController.closeSocialModal();
        }
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Day 16: Star Control II Alien Comms Modal Key Handling
      const commsModal = document.getElementById('alien-comms-modal');
      if (commsModal && !commsModal.classList.contains('hidden')) {
        if (e.code === 'Escape') {
          this.closeAlienComms();
          return;
        }
        if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5'].includes(e.code)) {
          const num = parseInt(e.key, 10);
          if (!isNaN(num) && num >= 1 && num <= (this.commsController.alienCurrentOptions?.length || 0)) {
            this.commsController.selectAlienDialogOption(num - 1);
          }
          return;
        }
        return; // Suppress other flight/game keys while in alien comms
      }

      // Day 25: Skirmish Arena Allegiance Modal Key Handling
      const allegianceModal = document.getElementById('skirmish-allegiance-modal');
      if (allegianceModal && !allegianceModal.classList.contains('hidden')) {
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          this.combatClient.declareAllegiance('FACTION_HEGEMONY');
          return;
        }
        if (e.code === 'Digit2' || e.code === 'Numpad2') {
          this.combatClient.declareAllegiance('FACTION_KRYLL');
          return;
        }
        if (e.code === 'Escape') {
          this.combatClient.closeAllegianceModal();
          return;
        }
        return;
      }

      // Milestone 1.7: Outpost Isometric Colony Command Key Handling
      if (this.colonyController?.outpostController?.isOpen) {
        return; // OutpostColonyController handles Escape & 1..4 layer hotkeys
      }

      // Day 20: Star Control II Precursor Archaeological Terminal Key Handling
      const precursorModal = document.getElementById('precursor-terminal-modal');
      if (precursorModal && !precursorModal.classList.contains('hidden')) {
        if (e.code === 'Escape') {
          this.closePrecursorTerminal();
          return;
        }
        return;
      }

      // Day 20: Star Control II Planetary Surface Lander Key Handling
      if (this.isLanderActive) {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') {
          this.landerKeys.up = true;
          return;
        }
        if (e.code === 'KeyS' || e.code === 'ArrowDown') {
          this.landerKeys.down = true;
          return;
        }
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
          this.landerKeys.left = true;
          return;
        }
        if (e.code === 'KeyD' || e.code === 'ArrowRight') {
          this.landerKeys.right = true;
          return;
        }
        if (e.code === 'Space') {
          e.preventDefault();
          this.landerController.fireSeismicRadarPing();
          return;
        }
        if (e.code === 'KeyE') {
          if (this.landerState?.isDocked && this.landerState?.dockedSite) {
            this.openPrecursorTerminal(this.landerState.dockedSite);
            return;
          }
        }
        if (e.code === 'KeyX' || e.code === 'Escape') {
          this.closeSurfaceLander();
          return;
        }
        return; // Suppress flight keys while piloting surface lander
      }

      // Day 18 & 20: Star Control II Planetary Orbital Survey Key Handling
      const surveyModal = document.getElementById('planetary-survey-modal');
      if (surveyModal && !surveyModal.classList.contains('hidden')) {
        if (e.code === 'Escape' || e.code === 'KeyO') {
          this.exitOrbit();
          return;
        }
        if (e.code === 'KeyL') {
          this.openSurfaceLander();
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
        if (this.activePlanet) {
          this.enterOrbit();
          return;
        }
      }

      if (e.code === 'KeyH') {
        if (this.hyperspaceFlightController?.isInHyperspace) {
          this.showApNotification('Already cruising in Hyperspace.', false);
        } else {
          this.hyperspaceFlightController?.enterHyperspace(this.shipMesh || undefined);
        }
        return;
      }

      if (e.code === 'KeyM') {
        this.starmapController.toggleStarmap();
        return;
      }

      if (e.code === 'F1') {
        e.preventDefault();
        const ctrl = document.getElementById('instructions-panel');
        if (ctrl) {
          const h = ctrl.classList.toggle('hidden');
          document.getElementById('btn-toggle-controls')?.classList.toggle('active', !h);
        }
        return;
      }

      if (e.code === 'KeyT') {
        const tel = document.getElementById('telemetry-panel');
        if (tel) {
          const h = tel.classList.toggle('hidden');
          document.getElementById('btn-toggle-telemetry')?.classList.toggle('active', !h);
        }
        return;
      }

      if (e.code === 'KeyB') {
        const lab = document.getElementById('hull-generator-panel');
        if (lab) {
          const h = lab.classList.toggle('hidden');
          document.getElementById('btn-toggle-hull-lab')?.classList.toggle('active', !h);
        }
        return;
      }

      if (e.code === 'KeyJ') {
        if (this.warpNavController.isOpen()) {
          this.closeNavModal();
        } else {
          this.openNavModal();
        }
        return;
      }

      if (e.code === 'Escape') {
        if (this.starmapController?.isOpen) {
          this.starmapController.closeStarmap();
          return;
        }
        if (this.tacticalCommandWheel?.isOpen) {
          this.tacticalCommandWheel.close();
          return;
        }
        if (this.surveyController.modalPlanetarySurvey && !this.surveyController.modalPlanetarySurvey.classList.contains('hidden')) {
          this.exitOrbit();
          return;
        }
        if (this.combatClient.modalContainerLoot && !this.combatClient.modalContainerLoot.classList.contains('hidden')) {
          this.combatClient.closeContainerLootModal();
          return;
        }
        if (this.warpNavController.isOpen()) {
          this.closeNavModal();
          return;
        }
        if (this.isDocked) {
          this.undockShip();
          return;
        }
        const openDrawerIds = ['instructions-panel', 'telemetry-panel', 'hull-generator-panel'];
        let closedAny = false;
        for (const id of openDrawerIds) {
          const el = document.getElementById(id);
          if (el && !el.classList.contains('hidden')) {
            el.classList.add('hidden');
            closedAny = true;
          }
        }
        if (closedAny) {
          document.getElementById('btn-toggle-controls')?.classList.remove('active');
          document.getElementById('btn-toggle-telemetry')?.classList.remove('active');
          document.getElementById('btn-toggle-hull-lab')?.classList.remove('active');
          return;
        }
      }

      // If docked, warping, or in Hyperspace, suppress local flight movement keys
      if (this.isDocked || this.isWarping || this.hyperspaceFlightController?.isInHyperspace) {
        return;
      }

      switch (e.code) {
        case 'KeyF': {
          e.preventDefault();
          if (this.combatClient.modalContainerLoot && !this.combatClient.modalContainerLoot.classList.contains('hidden')) {
            this.combatClient.lootAllCurrentContainer();
          } else if (this.combatClient.targetedContainerId) {
            this.combatClient.openContainerLootModal(this.combatClient.targetedContainerId);
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
          if (e.altKey || e.ctrlKey) {
            toggleCameraMode();
          } else if (!this.tacticalCommandWheel.isOpen) {
            this.tacticalCommandWheel.open();
          }
          break;
        case 'F1':
          e.preventDefault();
          this.tacticalCommandWheel.executeOrder('FOCUS_TARGET');
          break;
        case 'F2':
          e.preventDefault();
          this.tacticalCommandWheel.executeOrder('ESCORT_FLAGSHIP');
          break;
        case 'F3':
          e.preventDefault();
          this.tacticalCommandWheel.executeOrder('FLANK_HARASS');
          break;
        case 'F4':
          e.preventDefault();
          this.tacticalCommandWheel.executeOrder('REGROUP_HOLD');
          break;
        case 'KeyG':
          e.preventDefault();
          if (e.shiftKey) {
            this.sectorGrid.visible = !this.sectorGrid.visible;
          } else {
            this.combatClient.toggleAsteroidMiningBeam();
          }
          break;
        case 'KeyR':
          e.preventDefault();
          this.combatClient.cycleNearestAsteroid();
          break;
        case 'KeyH':
          e.preventDefault();
          this.hailCurrentTargetOrEnvoy();
          break;
        case 'KeyE': {
          e.preventDefault();
          if (this.combatClient.canEngageSkirmish()) {
            this.combatClient.engageSkirmish();
            break;
          }
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
          if (e.shiftKey) {
            e.preventDefault();
            this.combatClient.sendTriggerAbility(1);
            break;
          }
          if (this.tacticalCommandWheel.isOpen) {
            this.tacticalCommandWheel.executeOrder('FOCUS_TARGET');
            this.tacticalCommandWheel.close();
          } else {
            this.selectWeaponPreset(0);
            this.fireWeaponDirectly('PULSE');
          }
          break;
        case 'Digit2':
          if (e.shiftKey) {
            e.preventDefault();
            this.combatClient.sendTriggerAbility(2);
            break;
          }
          if (this.tacticalCommandWheel.isOpen) {
            this.tacticalCommandWheel.executeOrder('ESCORT_FLAGSHIP');
            this.tacticalCommandWheel.close();
          } else {
            this.selectWeaponPreset(1);
            this.fireWeaponDirectly('PLASMA');
          }
          break;
        case 'Digit3':
          if (e.shiftKey) {
            e.preventDefault();
            this.combatClient.sendTriggerAbility(3);
            break;
          }
          if (this.tacticalCommandWheel.isOpen) {
            this.tacticalCommandWheel.executeOrder('FLANK_HARASS');
            this.tacticalCommandWheel.close();
          } else {
            this.combatInputs.fireTactical = true;
            this.sendCombatInputs();
          }
          break;
        case 'Digit4':
          if (e.shiftKey) {
            e.preventDefault();
            this.combatClient.sendTriggerAbility(4);
            break;
          }
          if (this.tacticalCommandWheel.isOpen) {
            this.tacticalCommandWheel.executeOrder('REGROUP_HOLD');
            this.tacticalCommandWheel.close();
          } else {
            this.selectWeaponPreset(2);
            this.fireWeaponDirectly('FLAK');
          }
          break;
        case 'Digit5':
          if (!this.elSlotHigh3?.classList.contains('hidden')) {
            this.selectWeaponPreset(3);
            this.fireWeaponDirectly('RAIL');
          }
          break;
        case 'Digit6':
          if (!this.elSlotMid3?.classList.contains('hidden')) {
            this.combatInputs.fireTactical = true;
            this.sendCombatInputs();
          }
          break;
        case 'Tab':
          e.preventDefault();
          if (!this.tacticalCommandWheel.isOpen) {
            this.tacticalCommandWheel.open();
          }
          break;
      }
    });

    // Keyup Controls
    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (this.isLanderActive) {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') {
          this.landerKeys.up = false;
          this.audio.stopLanderThrusterSound();
        }
        if (e.code === 'KeyS' || e.code === 'ArrowDown') {
          this.landerKeys.down = false;
        }
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
          this.landerKeys.left = false;
        }
        if (e.code === 'KeyD' || e.code === 'ArrowRight') {
          this.landerKeys.right = false;
        }
        return;
      }

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
        case 'Digit5':
          this.combatInputs.firePrimary = false;
          this.sendCombatInputs();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'Digit3':
        case 'Digit6':
          this.combatInputs.fireTactical = false;
          this.sendCombatInputs();
          break;
        case 'Tab':
          if (this.tacticalCommandWheel?.isOpen) {
            if (!this.tacticalCommandWheel.selectedOrder) {
              this.cycleTargetLock();
            }
            this.tacticalCommandWheel.close();
          }
          break;
        case 'KeyC':
          if (this.tacticalCommandWheel?.isOpen) {
            this.tacticalCommandWheel.close();
          }
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
        // Click raycast to select Asteroid Vein if clicked directly
        if (this.asteroidField) {
          const rect = this.renderer.domElement.getBoundingClientRect();
          const ndc = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(ndc, this.camera);
          const astHits = raycaster.intersectObjects(this.asteroidField.getInteractableMeshes(), false);
          if (astHits.length > 0 && astHits[0].object.userData?.asteroidId) {
            this.combatClient.targetAsteroid(astHits[0].object.userData.asteroidId);
            return;
          }
        }
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
    const slotEls = [this.elSlotHigh1, this.elSlotHigh2, this.elSlotMid2, this.elSlotHigh3];
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

  private fireWeaponDirectly(weaponId: 'PULSE' | 'PLASMA' | 'FLAK' | 'RAIL' | 'TORPEDO'): void {
    this.combatInputs.activeWeaponId = weaponId;
    this.combatInputs.firePrimary = true;
    this.sendCombatInputs();
    this.lastFireTimes[weaponId] = Date.now();

    if (weaponId === 'PLASMA' || weaponId === 'RAIL' || weaponId === 'TORPEDO') {
      this.audio.playPlasmaFire();
    } else if (weaponId === 'FLAK') {
      this.audio.playFlakFire();
    } else {
      this.audio.playLaserFire(false);
    }
  }

  private cycleTargetLock(): void {
    this.combatClient.cycleTargetLock();
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

    // 0. Update Hyperspace Flight Simulation if active (Day 38)
    if (this.hyperspaceFlightController?.isInHyperspace) {
      this.hyperspaceFlightController.update(deltaSec);
      this.renderer.render(this.scene, this.camera);
      return;
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
      this.combatClient.lastPlayerShields,
      this.combatClient.lastPlayerMaxShields
    );

    // 5. Update Orbital Space Station or Asteroid Field
    if (this.station) {
      this.station.update(deltaSec);
    }
    if (this.asteroidField) {
      this.asteroidField.update(
        deltaSec,
        this.combatClient?.targetedAsteroidId || null,
        this.combatClient?.activeMiningAsteroidId || null
      );
    }

    const dockStatus = this.station
      ? this.station.checkDocking(this.flightController.position, telemetry.speed)
      : { inRange: false, canDock: false, distance: 999, message: 'NO STATION IN ORBIT // UNCLAIMED VOID SECTOR' };

    // 6. Hyperspace Warp Camera Distortion FX
    if (this.warpNavController?.isWarping) {
      this.warpNavController.warpAnimationTime += deltaSec;
      const progress = Math.min(1.0, this.warpNavController.warpAnimationTime / 1.1);
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
    this.combatClient.updateTacticalReticle();
    this.combatClient.updateLootCanisters(deltaSec);

    // 9b. Day 15: Update Sector Derelict Wrecks, Proximity Targeting & Tow Tether
    this.combatClient.updateWrecksAndTether(deltaSec);

    // 9c. Day 18: Update Celestial Planet & In-Flight Orbital Guidance Banner
    this.surveyController.updatePlanetaryGuidance(deltaSec);

    // 9d. Day 29: Update Xenobiology Tactical Buffs & Flight HUD
    this.xenobiologyController.updateHudBuffs(deltaSec);

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
    this.combatClient.initCombatWebSocket(sectorId);
  }

  public sendCombatInputs(): void {
    this.combatClient.sendCombatInputs();
  }

  public openContainerLootModal(containerId: string): void {
    this.combatClient.openContainerLootModal(containerId);
  }

  public closeContainerLootModal(): void {
    this.combatClient.closeContainerLootModal();
  }

  public lootAllCurrentContainer(): void {
    this.combatClient.lootAllCurrentContainer();
  }

  /**
   * Day 13, 14, 15, 16 & 32: Station Dock Tab Switcher (Exchange / Outfitting / Armory / Contracts / Salvage / Diplomacy / Fleet)
   */
  public switchStationTab(tab: 'exchange' | 'outfitting' | 'armory' | 'contracts' | 'missions' | 'salvage' | 'diplomacy' | 'fleet' | 'crew'): void {
    this.activeStationTab = tab as any;
    this.audio.playUiBlip();

    this.tabBtnExchange?.classList.toggle('active', tab === 'exchange');
    this.tabBtnOutfitting?.classList.toggle('active', tab === 'outfitting');
    this.tabBtnArmory?.classList.toggle('active', tab === 'armory');
    this.tabBtnContracts?.classList.toggle('active', tab === 'contracts');
    this.tabBtnMissions?.classList.toggle('active', tab === 'missions');
    this.tabBtnSalvage?.classList.toggle('active', tab === 'salvage');
    this.tabBtnDiplomacy?.classList.toggle('active', tab === 'diplomacy');
    this.tabBtnFleet?.classList.toggle('active', tab === 'fleet');
    this.tabBtnCrew?.classList.toggle('active', tab === 'crew');

    this.viewTabExchange?.classList.toggle('hidden', tab !== 'exchange');
    this.viewTabOutfitting?.classList.toggle('hidden', tab !== 'outfitting');
    this.viewTabArmory?.classList.toggle('hidden', tab !== 'armory');
    this.viewTabContracts?.classList.toggle('hidden', tab !== 'contracts');
    this.viewTabMissions?.classList.toggle('hidden', tab !== 'missions');
    this.viewTabSalvage?.classList.toggle('hidden', tab !== 'salvage');
    this.viewTabDiplomacy?.classList.toggle('hidden', tab !== 'diplomacy');
    this.viewTabFleet?.classList.toggle('hidden', tab !== 'fleet');
    this.viewTabCrew?.classList.toggle('hidden', tab !== 'crew');

    if (tab === 'outfitting') {
      this.loadOutfittingData();
    } else if (tab === 'armory') {
      this.loadArmoryData();
    } else if (tab === 'contracts') {
      this.loadContractsData();
    } else if (tab === 'missions') {
      this.missionBoardController?.loadBoard();
    } else if (tab === 'salvage') {
      this.loadSalvageData();
    } else if (tab === 'diplomacy') {
      this.loadDiplomacyData();
      this.refreshAstrometryBureau();
    } else if (tab === 'fleet') {
      this.fleetController.loadFleetData();
    } else if (tab === 'crew') {
      this.crewController.loadCrewTab();
    } else if (tab === 'exchange') {
      this.loadPortInventory();
    }
  }

  public async loadOutfittingData(): Promise<void> {
    await this.outfittingController.loadOutfittingData();
  }

  public async fitModule(inventoryId: string, slot: string): Promise<void> {
    await this.outfittingController.fitModule(inventoryId, slot);
  }

  public async unfitModule(slot: string): Promise<void> {
    await this.outfittingController.unfitModule(slot);
  }

  public async loadArmoryData(): Promise<void> {
    await this.outfittingController.loadArmoryData();
  }

  public async buyModule(blueprintId: string): Promise<void> {
    await this.outfittingController.buyModule(blueprintId);
  }

  public async buyProceduralShopModule(slotIndex: number): Promise<void> {
    await this.outfittingController.buyProceduralShopModule(slotIndex);
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
      this.marketController?.syncCreditDisplays(this.playerCredits);

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
      const accountId = apiClient.getAccountId();
      const kmRes = await fetch(`/api/combat/killmails?accountId=${encodeURIComponent(accountId)}`);
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

  // ============================================================================
  // DAY 14 & 15: KILLMAIL, SALVAGE MINING & TOW CABLE
  // ============================================================================

  public openKillmailModal(km: any): void {
    this.combatClient.openKillmailModal(km);
  }

  public async postRevengeBounty(): Promise<void> {
    await this.combatClient.postRevengeBounty();
  }

  public async claimReplacementFrigate(): Promise<void> {
    await this.combatClient.claimReplacementFrigate();
  }

  public async handleEmergencyRecall(): Promise<void> {
    await this.combatClient.handleEmergencyRecall();
  }

  public toggleTowTether(): void {
    this.combatClient.toggleTowTether();
  }

  public toggleSalvageMining(): void {
    this.combatClient.toggleSalvageMining();
  }

  public startSalvageMining(): void {
    this.combatClient.startSalvageMining();
  }

  public stopSalvageMining(): void {
    this.combatClient.stopSalvageMining();
  }

  public async loadSalvageData(): Promise<void> {
    await this.combatClient.loadSalvageData();
  }

  public async dismantleTetheredWreck(): Promise<void> {
    await this.combatClient.dismantleTetheredWreck();
  }

  public async refurbishTetheredWreck(): Promise<void> {
    await this.combatClient.refurbishTetheredWreck();
  }

  // ========================================================================
  // Day 16 & 17: Star Control II Alien Comms, Branching Dialog & Diplomacy
  // ========================================================================

  public async loadDiplomacyData(): Promise<void> {
    await this.commsController.loadDiplomacyData();
  }

  public renderFactionDossier(): void {
    this.commsController.renderFactionDossier();
  }

  public async openAlienComms(npcId: string): Promise<void> {
    await this.commsController.openAlienComms(npcId);
  }

  public closeAlienComms(): void {
    this.commsController.closeAlienComms();
  }

  public openDiplomacyStandingsModal(): void {
    this.commsController.openFactionStandingsModal();
  }

  public updateHudSectorAllegiance(): void {
    this.commsController.updateHudSectorAllegiance();
  }

  public get playerStandings(): any[] {
    return this.commsController?.playerStandings || [];
  }

  public get isEscapePod(): boolean {
    return this.combatClient?.isEscapePod || false;
  }

  public set isEscapePod(val: boolean) {
    if (this.combatClient) this.combatClient.isEscapePod = val;
  }

  public startTruceCountdown(durationSeconds: number = 300): void {
    this.commsController.startTruceCountdown(durationSeconds);
  }

  public async refreshFactionStandings(): Promise<void> {
    await this.commsController.refreshFactionStandings();
  }

  public hailCurrentTargetOrEnvoy(): void {
    this.commsController.hailCurrentTargetOrEnvoy();
  }

  // ============================================================================
  // DAY 18, 19, 20 & 21: PLANETARY SURVEY, COLONY, LANDER & PRECURSOR DELEGATES
  // ============================================================================

  // --- Survey Controller Delegates ---
  public async loadSectorPlanet(sectorId: number): Promise<void> {
    await this.surveyController.loadSectorPlanet(sectorId);
  }

  public updatePlanetaryGuidance(deltaSec: number): void {
    this.surveyController.updatePlanetaryGuidance(deltaSec);
  }

  public async enterOrbit(): Promise<void> {
    await this.surveyController.enterOrbit();
  }

  public exitOrbit(): void {
    this.surveyController.exitOrbit();
  }

  public async performScannerSweep(band: 'MINERALS' | 'BIO' | 'ANOMALIES'): Promise<void> {
    await this.surveyController.performScannerSweep(band);
  }

  public async launchAtmosphericProbe(): Promise<void> {
    await this.surveyController.launchAtmosphericProbe();
  }

  public async refreshAstrometryBureau(): Promise<void> {
    await this.surveyController.refreshAstrometryBureau();
  }

  public async fetchPlanetAirspace(planetId: string): Promise<void> {
    await this.surveyController.fetchPlanetAirspace(planetId);
  }

  // --- Colony Controller Delegates ---
  public switchSurveyTab(tab: 'SENSORS' | 'COLONY' | 'PRECURSOR'): void {
    this.colonyController.switchSurveyTab(tab);
  }

  public async fetchPlanetColonies(planetId: string): Promise<void> {
    await this.colonyController.fetchPlanetColonies(planetId);
  }

  public async foundColony(): Promise<void> {
    await this.colonyController.foundColony();
  }

  public async upgradeColonyFacility(facilityType: 'DERRICK' | 'HABITATION' | 'TERRAFORMER' | 'SILO'): Promise<void> {
    await this.colonyController.upgradeColonyFacility(facilityType);
  }

  public async harvestColonyCargo(): Promise<void> {
    await this.colonyController.harvestColonyCargo();
  }

  public async fetchPlanetPrecursorSites(planetId: string): Promise<void> {
    await this.colonyController.fetchPlanetPrecursorSites(planetId);
  }

  public async fetchPrecursorResearch(): Promise<void> {
    await this.colonyController.fetchPrecursorResearch();
  }

  public renderPrecursorTechGrid(): void {
    this.colonyController.renderPrecursorTechGrid();
  }

  public async synthesizePrototypeTech(techId: string): Promise<void> {
    await this.colonyController.synthesizePrototypeTech(techId);
  }

  public async remitPrecursorRelic(): Promise<void> {
    await this.colonyController.remitPrecursorRelic();
  }

  // --- Lander Controller Delegates ---
  public openSurfaceLander(): void {
    const crewIds = this.surveyController ? this.surveyController.getSelectedLanderCrewIds() : [];
    this.landerController.openSurfaceLander(crewIds);
  }

  public deploySurfaceLander(): void {
    const crewIds = this.surveyController ? this.surveyController.getSelectedLanderCrewIds() : [];
    this.landerController.openSurfaceLander(crewIds);
  }

  public closeSurfaceLander(): void {
    this.landerController.closeSurfaceLander();
  }

  public get isLanderActive(): boolean {
    return this.landerController?.isLanderActive ?? false;
  }

  public get landerKeys(): { up: boolean; down: boolean; left: boolean; right: boolean } {
    return this.landerController?.landerKeys ?? { up: false, down: false, left: false, right: false };
  }

  public get landerState(): any {
    return this.landerController?.landerState;
  }

  // --- Precursor Terminal Controller Delegates ---
  public openPrecursorTerminal(site?: any): void {
    this.precursorTerminalController.openPrecursorTerminal(site);
  }

  public closePrecursorTerminal(): void {
    this.precursorTerminalController.closePrecursorTerminal();
  }

  public async decipherActivePrecursorSite(): Promise<void> {
    await this.precursorTerminalController.decipherActivePrecursorSite();
  }

  public checkPrecursorAlignment(): boolean {
    return this.precursorTerminalController.checkPrecursorAlignment();
  }

  public get precursorTuning() {
    return this.precursorTerminalController.precursorTuning;
  }

  // --- State Getters & Setters ---
  public get activeSurveyTab(): 'SENSORS' | 'COLONY' | 'PRECURSOR' {
    return this.colonyController?.activeSurveyTab ?? 'SENSORS';
  }

  public get activeColony(): any {
    return this.colonyController?.activeColony || null;
  }

  public get activeColoniesList(): any[] {
    return this.colonyController?.activeColoniesList || [];
  }

  public get planetPrecursorSites(): any[] {
    return this.colonyController?.planetPrecursorSites || [];
  }

  public get unresolvedPrecursorSignals(): number {
    return this.colonyController?.unresolvedPrecursorSignals ?? 0;
  }

  public get precursorRequiredSurvey(): number {
    return this.colonyController?.precursorRequiredSurvey ?? 33;
  }

  public get playerRelicCount(): number {
    return this.colonyController?.playerRelicCount ?? 0;
  }

  public get activePlanet(): ProceduralPlanet | null {
    return this.surveyController?.activePlanet || null;
  }

  public set activePlanet(p: ProceduralPlanet | null) {
    if (this.surveyController) this.surveyController.activePlanet = p;
  }

  public get activePlanetDetail(): any {
    return this.surveyController?.activePlanetDetail || null;
  }

  public set activePlanetDetail(d: any) {
    if (this.surveyController) this.surveyController.activePlanetDetail = d;
  }

  public get isInOrbit(): boolean {
    return this.surveyController?.isInOrbit ?? false;
  }

  public set isInOrbit(v: boolean) {
    if (this.surveyController) this.surveyController.isInOrbit = v;
  }

    public getActiveSurveyTab(): 'SENSORS' | 'COLONY' | 'PRECURSOR' {
    return this.activeSurveyTab;
  }

  public getPlayerLoadout(): any {
    return this.outfittingController?.playerLoadout || null;
  }

  public getEquipmentCatalog(): any[] {
    return this.outfittingController?.equipmentCatalog || [];
  }

  public get isLoadoutOverBudget(): boolean {
    return this.outfittingController?.isLoadoutOverBudget ?? false;
  }

  // --- Day 29: Xenobiology Controller Delegates ---
  public openXenobiologyLab(): void {
    this.xenobiologyController?.openLab();
  }

  public closeXenobiologyLab(): void {
    this.xenobiologyController?.closeLab();
  }
}

// Instantiate engine when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  apiClient.installGlobalFetchInterceptor();
  (window as any).gameEngine = new GameEngine();
});
