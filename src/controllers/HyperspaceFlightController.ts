import * as THREE from 'three';
import { type StarSystem, type FactionSphere, type CoursePlotResult } from './StarmapController';
import { AudioEngine } from '../audio/AudioEngine';

export interface HyperspaceContext {
  getAccountId: () => string;
  showNotification?: (msg: string, isError?: boolean) => void;
  playUiBlip?: () => void;
  audio: AudioEngine;
  onExitHyperspace: (newSectorId: number) => void;
  onInterception?: (handshake: any) => void;
  onCombatDrop?: (combatSetup: any) => void;
  onHyperspaceSync?: (coords: [number, number], heading: number) => void;
}

export interface HyperspaceRadarBlip {
  id: string;
  name: string;
  factionId: string;
  factionName: string;
  factionColor: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: 'PATROL' | 'ALERT' | 'PURSUING' | 'DISTRACTED';
  speed: number;
  detectionRadius: number;
  shipCount: number;
  shipClass: string;
  isHostile: boolean;
  distanceLY?: number;
}

export interface ActiveDecoy {
  id: string;
  x: number;
  y: number;
  expiresAt: number;
  durationSeconds: number;
}

export class HyperspaceFlightController {
  private ctx: HyperspaceContext;

  public isInHyperspace: boolean = false;
  public coordinates: [number, number] = [500.0, 500.0]; // Galactic coords [0, 1000]
  public velocity: [number, number] = [0.0, 0.0]; // LY / sec
  public heading: number = 0.0; // Radians (0 = East +X, PI/2 = South +Y)
  public speed: number = 0.0; // Current scalar speed (LY/s)
  public maxCruisingSpeed: number = 25.0; // LY / sec
  public afterburnerSpeed: number = 40.0; // LY / sec
  public accelerationRate: number = 18.0; // LY / s^2
  public turnRate: number = 3.2; // rad / sec
  public damping: number = 0.92;

  // Fuel & Logistics
  public currentFuel: number = 100;
  public activeEscortsCount: number = 0;
  public baseBurnRate: number = 0.20; // Fuel per Light-Year
  private accumulatedFuelBurn: number = 0.0;
  private lastSyncTime: number = 0;

  // Day 39: Radar Blips, Decoys & Tactical Interceptions
  public radarBlips: HyperspaceRadarBlip[] = [];
  public activeDecoys: ActiveDecoy[] = [];
  public decoysRemaining: number = 3;
  public immunityRemainingSeconds: number = 0.0;
  public threatLevel: 'CLEAR' | 'ALERT' | 'PURSUIT' = 'CLEAR';
  public territory: string = 'Deep Space';
  public isInterceptionActive: boolean = false;
  private lastRadarPollTime: number = 0;
  private lastAlertSoundTime: number = 0;
  private blipMeshes: Map<string, THREE.Group> = new Map();
  private decoyMeshes: Map<string, THREE.Group> = new Map();
  private stealthShieldMesh: THREE.Mesh | null = null;
  private remoteHyperspacePlayers: Map<string, { accountId: string; callsign: string; factionId: string; x: number; y: number; heading: number; updatedAt: number }> = new Map();
  private remoteHyperspaceMeshes: Map<string, THREE.Group> = new Map();

  // Day 40: Precursor Quasi-Space & Emergency SOS Transponder
  public isInQuasiSpace: boolean = false;
  public quasiPortals: any[] = [];
  public nearestPortal: any = null;
  public nearestPortalDistance: number = 9999.0;
  public isSosDistressActive: boolean = false;
  private portalMeshes: Map<string, THREE.Group> = new Map();

  // Navigation & Autopilot
  public activeCourse: CoursePlotResult | null = null;
  public isAutopilotActive: boolean = false;
  public systems: StarSystem[] = [];
  public spheres: FactionSphere[] = [];
  public nearestSystem: StarSystem | null = null;
  public nearestDistance: number = 9999.0;

  // Camera Mode
  public cameraMode: 'TOP_DOWN' | 'CHASE' = 'TOP_DOWN';

  // Input State
  private keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    afterburner: false,
  };

  // Three.js Subspace Environment Elements
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private hyperspaceGroup: THREE.Group;
  private warpParticles: THREE.LineSegments | null = null;
  private starPoints: THREE.Points | null = null;
  private flagshipMesh: THREE.Object3D | null = null;
  private wingmenMeshes: THREE.Object3D[] = [];

  // HUD DOM Elements
  private hudElement: HTMLElement | null = null;
  private hudCoords: HTMLElement | null = null;
  private hudFuelVal: HTMLElement | null = null;
  private hudFuelBar: HTMLElement | null = null;
  private hudBurnRate: HTMLElement | null = null;
  private hudSpeed: HTMLElement | null = null;
  private hudCompassNeedle: HTMLElement | null = null;
  private hudTargetText: HTMLElement | null = null;
  private hudAutopilotBadge: HTMLElement | null = null;
  private hudGravityWellAlert: HTMLElement | null = null;
  private hudRadarBadge: HTMLElement | null = null;
  private hudThreatBadge: HTMLElement | null = null;
  private hudDecoyBtn: HTMLButtonElement | null = null;
  private hudDecoyCount: HTMLElement | null = null;
  private hudStealthPill: HTMLElement | null = null;
  private hudStealthVal: HTMLElement | null = null;
  private hudPortalAlert: HTMLElement | null = null;
  private hudSosAlert: HTMLElement | null = null;
  private hudRealmBadge: HTMLElement | null = null;
  private modalEmergencySos: HTMLElement | null = null;
  private sosResponderName: HTMLElement | null = null;
  private sosDialogueText: HTMLElement | null = null;
  private sosActionsContainer: HTMLElement | null = null;

  constructor(ctx: HyperspaceContext, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.ctx = ctx;
    this.scene = scene;
    this.camera = camera;
    this.hyperspaceGroup = new THREE.Group();
    this.hyperspaceGroup.visible = false;
    this.scene.add(this.hyperspaceGroup);

    this.initHUD();
    this.initInputListeners();
    this.buildSubspaceEnvironment();
  }

  private initHUD(): void {
    this.hudElement = document.getElementById('hyperspace-hud');
    this.hudCoords = document.getElementById('hyper-hud-coords');
    this.hudFuelVal = document.getElementById('hyper-hud-fuel-val');
    this.hudFuelBar = document.getElementById('hyper-hud-fuel-bar');
    this.hudBurnRate = document.getElementById('hyper-hud-burn-rate');
    this.hudSpeed = document.getElementById('hyper-hud-speed');
    this.hudCompassNeedle = document.getElementById('hyper-hud-compass-needle');
    this.hudTargetText = document.getElementById('hyper-hud-target-text');
    this.hudAutopilotBadge = document.getElementById('hyper-hud-autopilot-badge');
    this.hudGravityWellAlert = document.getElementById('hyper-hud-gravity-alert');
    this.hudRadarBadge = document.getElementById('hyper-hud-radar-badge');
    this.hudThreatBadge = document.getElementById('hyper-hud-threat-badge');
    this.hudDecoyBtn = document.getElementById('btn-hyper-decoy') as HTMLButtonElement | null;
    this.hudDecoyCount = document.getElementById('hyper-hud-decoy-count');
    this.hudStealthPill = document.getElementById('hyper-hud-stealth-pill');
    this.hudStealthVal = document.getElementById('hyper-hud-stealth-val');
    this.hudPortalAlert = document.getElementById('hyper-hud-portal-alert');
    this.hudSosAlert = document.getElementById('hyper-hud-sos-alert');
    this.hudRealmBadge = document.getElementById('hyper-hud-realm-badge');
    this.modalEmergencySos = document.getElementById('modal-emergency-sos');
    this.sosResponderName = document.getElementById('sos-responder-name');
    this.sosDialogueText = document.getElementById('sos-dialogue-text');
    this.sosActionsContainer = document.getElementById('sos-actions-container');

    this.hudDecoyBtn?.addEventListener('click', () => {
      if (this.isInHyperspace) {
        this.deployDecoy();
      }
    });

    this.hudAutopilotBadge?.addEventListener('click', () => {
      if (this.isInHyperspace) {
        this.toggleAutopilot();
      }
    });
  }

  private initInputListeners(): void {
    window.addEventListener('keydown', (e) => {
      if (!this.isInHyperspace) return;

      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        this.keys.left = true;
        this.disengageAutopilot(); // Manual steering overrides autopilot
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        this.keys.right = true;
        this.disengageAutopilot();
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.afterburner = true;

      // Deploy Subspace Thermal Decoy (Hotkey: F)
      if (e.code === 'KeyF') {
        this.deployDecoy();
      }

      // Toggle Autopilot Assist
      if (e.code === 'KeyX' || (e.code === 'KeyA' && (e.ctrlKey || e.altKey))) {
        this.toggleAutopilot();
      }

      // Toggle Camera Mode
      if (e.code === 'KeyC') {
        this.cameraMode = this.cameraMode === 'TOP_DOWN' ? 'CHASE' : 'TOP_DOWN';
        this.ctx.playUiBlip?.();
      }

      // Precursor Portal Transit (Quasi-Space)
      if ((e.code === 'Enter' || e.code === 'KeyJ') && this.isInQuasiSpace && this.nearestPortal && this.nearestPortalDistance <= 8.0) {
        this.exitQuasiSpaceViaPortal(this.nearestPortal.id);
        return;
      }

      // Orbital Gravity Well Drop-Out (TrueSpace)
      if ((e.code === 'Enter' || e.code === 'KeyJ') && !this.isInQuasiSpace && this.nearestSystem && this.nearestDistance <= 8.0) {
        this.dropOutOfHyperspace(this.nearestSystem.id);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.isInHyperspace) return;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.afterburner = false;
    });
  }

  /**
   * Constructs the 3D relativistic red subspace particle stream and glowing stars
   */
  private buildSubspaceEnvironment(): void {
    // 1. Streaming Warp Line Particles (600 streaming red velocity vectors)
    const particleCount = 600;
    const linePositions = new Float32Array(particleCount * 6);
    const lineColors = new Float32Array(particleCount * 6);

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 6;
      const x = (Math.random() - 0.5) * 350;
      const y = (Math.random() - 0.5) * 120;
      const z = (Math.random() - 0.5) * 350;
      const length = 15 + Math.random() * 25;

      linePositions[idx] = x;
      linePositions[idx + 1] = y;
      linePositions[idx + 2] = z;

      linePositions[idx + 3] = x;
      linePositions[idx + 4] = y;
      linePositions[idx + 5] = z + length;

      // Crimson and orange gradient
      const isOrange = Math.random() > 0.6;
      lineColors[idx] = isOrange ? 1.0 : 0.9;
      lineColors[idx + 1] = isOrange ? 0.35 : 0.08;
      lineColors[idx + 2] = 0.12;

      lineColors[idx + 3] = 0.5;
      lineColors[idx + 4] = 0.02;
      lineColors[idx + 5] = 0.05;
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    this.warpParticles = new THREE.LineSegments(lineGeo, lineMat);
    this.hyperspaceGroup.add(this.warpParticles);
  }

  /**
   * Initializes 3D star beacons across the 1000x1000 galactic coordinate space
   */
  public populateStarBeacons(systems: StarSystem[]): void {
    this.systems = systems;
    if (this.starPoints) {
      this.hyperspaceGroup.remove(this.starPoints);
      this.starPoints.geometry.dispose();
    }

    const starCount = systems.length;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    systems.forEach((sys, i) => {
      const idx = i * 3;
      // Map galactic (X, Y) to Three.js (X, 0, Z)
      positions[idx] = sys.coordinatesX;
      positions[idx + 1] = 0;
      positions[idx + 2] = sys.coordinatesY;

      const rgb = this.getSpectralRGB(sys.spectralClass);
      colors[idx] = rgb[0];
      colors[idx + 1] = rgb[1];
      colors[idx + 2] = rgb[2];
    });

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 14.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });

    this.starPoints = new THREE.Points(starGeo, starMat);
    this.hyperspaceGroup.add(this.starPoints);
  }

  /**
   * Enters continuous Hyperspace flight
   */
  public async enterHyperspace(flagshipMesh?: THREE.Object3D, wingmenMeshes?: THREE.Object3D[]): Promise<void> {
    const accountId = this.ctx.getAccountId();
    try {
      const res = await fetch('/api/starmap/hyperspace/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.ctx.showNotification?.(data.error || 'Failed to enter Hyperspace.', true);
        return;
      }

      this.isInHyperspace = true;
      this.coordinates = [data.coordinates[0], data.coordinates[1]];
      this.velocity = [0, 0];
      this.speed = 0;
      this.heading = 0;
      this.currentFuel = Number(data.fuel);
      this.activeEscortsCount = Number(data.activeEscortsCount || 0);
      this.accumulatedFuelBurn = 0;
      this.lastSyncTime = performance.now();

      // Show Hyperspace Scene & HUD
      this.hyperspaceGroup.visible = true;
      if (this.hudElement) {
        this.hudElement.classList.remove('hidden');
        this.hudElement.style.display = 'flex';
      }

      // Audio
      this.ctx.audio.startHyperspaceDrone();
      this.ctx.showNotification?.('Warp field energized: Cruising in continuous Hyperspace.');

      // Attach meshes to local hyperspace group if available
      if (flagshipMesh) {
        this.flagshipMesh = flagshipMesh;
        this.flagshipMesh.position.set(0, 0, 0);
        this.hyperspaceGroup.add(this.flagshipMesh);
      }
      if (wingmenMeshes && wingmenMeshes.length > 0) {
        this.wingmenMeshes = wingmenMeshes;
        wingmenMeshes.forEach((m) => this.hyperspaceGroup.add(m));
      }

      // Load star beacons if not yet populated
      if (this.systems.length === 0) {
        const sysRes = await fetch('/api/starmap/systems');
        if (sysRes.ok) {
          const sData = await sysRes.json();
          this.populateStarBeacons(sData.systems || []);
        }
      }

      // Check if a course is already locked
      if (data.navTargetSectorId) {
        const targetSys = this.systems.find((s) => s.id === data.navTargetSectorId);
        if (targetSys) {
          this.activeCourse = {
            success: true,
            sourceSectorId: data.currentSectorId,
            sourceName: '',
            sourceCoords: this.coordinates,
            targetSectorId: targetSys.id,
            targetName: targetSys.name,
            targetCoords: [targetSys.coordinatesX, targetSys.coordinatesY],
            distanceLY: Math.hypot(targetSys.coordinatesX - this.coordinates[0], targetSys.coordinatesY - this.coordinates[1]),
            baseFuelCost: 0,
            escortFuelCost: 0,
            totalFuelCost: 0,
            etaSeconds: 0,
            hasSufficientFuel: true,
            currentFuel: this.currentFuel,
            activeEscortsCount: this.activeEscortsCount,
            locked: true,
          };
        }
      }
    } catch (err: any) {
      this.ctx.showNotification?.(`Warp Drive Error: ${err.message}`, true);
    }
  }

  /**
   * Drops the task force out of Hyperspace into the local star system (TrueSpace)
   */
  public async dropOutOfHyperspace(targetSectorId: number): Promise<void> {
    const accountId = this.ctx.getAccountId();
    try {
      const res = await fetch('/api/starmap/hyperspace/arrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          targetSectorId,
          finalCoords: this.coordinates,
          remainingFuel: this.currentFuel,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.ctx.showNotification?.(data.error || 'Failed to drop out of Hyperspace.', true);
        return;
      }

      this.isInHyperspace = false;
      this.hyperspaceGroup.visible = false;
      if (this.hudElement) {
        this.hudElement.classList.add('hidden');
        this.hudElement.style.display = 'none';
      }

      // Audio
      this.ctx.audio.stopHyperspaceDrone();
      this.ctx.audio.playWarpCollapse();

      this.ctx.showNotification?.(`Orbital Insertion Complete: Arrived in ${data.sectorName}.`);
      this.ctx.onExitHyperspace(data.arrivedSectorId);
    } catch (err: any) {
      this.ctx.showNotification?.(`Drop-out error: ${err.message}`, true);
    }
  }

  public toggleAutopilot(): void {
    if (!this.activeCourse) {
      this.ctx.showNotification?.('Autopilot Unavailable: No target star system locked on Starmap.', true);
      return;
    }
    this.isAutopilotActive = !this.isAutopilotActive;
    this.ctx.audio.playAutopilotChime(this.isAutopilotActive);
    this.ctx.showNotification?.(
      this.isAutopilotActive
        ? `Autopilot Engaged: Cruising to ${this.activeCourse.targetName}.`
        : 'Autopilot Disengaged: Manual flight restored.'
    );
  }

  public disengageAutopilot(): void {
    if (this.isAutopilotActive) {
      this.isAutopilotActive = false;
      this.ctx.audio.playAutopilotChime(false);
    }
  }

  /**
   * Authoritative 60 FPS update loop
   */
  public update(delta: number): void {
    if (!this.isInHyperspace) return;
    if (this.isSosDistressActive) return;

    // 1. Process Steering (Angular)
    if (this.isAutopilotActive && this.activeCourse) {
      const tx = this.activeCourse.targetCoords[0];
      const ty = this.activeCourse.targetCoords[1];
      const dist = Math.hypot(tx - this.coordinates[0], ty - this.coordinates[1]);

      if (dist <= 8.0) {
        this.disengageAutopilot();
        this.ctx.showNotification?.(`Autopilot Disengaged: Arrived at ${this.activeCourse.targetName} gravity well.`);
      } else {
        const targetAngle = Math.atan2(ty - this.coordinates[1], tx - this.coordinates[0]);

        // Smooth angular interpolation
        let angleDiff = targetAngle - this.heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const maxTurn = this.turnRate * delta;
        if (Math.abs(angleDiff) <= maxTurn) {
          this.heading = targetAngle;
        } else {
          this.heading += Math.sign(angleDiff) * maxTurn;
        }

        // Autopilot automatically applies forward cruising burn
        this.keys.forward = true;
      }
    } else {
      if (this.keys.left) this.heading -= this.turnRate * delta;
      if (this.keys.right) this.heading += this.turnRate * delta;
    }

    // Keep heading in [0, 2PI]
    while (this.heading < 0) this.heading += Math.PI * 2;
    while (this.heading >= Math.PI * 2) this.heading -= Math.PI * 2;

    // 2. Process Thrusters & Acceleration (Quasi-Space doubles speed: 50 LY/s cruise, 80 LY/s afterburner)
    const baseCruise = this.isInQuasiSpace ? 50.0 : this.maxCruisingSpeed;
    const baseBoost = this.isInQuasiSpace ? 80.0 : this.afterburnerSpeed;
    const targetMaxSpeed = this.keys.afterburner ? baseBoost : baseCruise;

    if (this.keys.forward && (this.currentFuel > 0 || this.isInQuasiSpace)) {
      this.speed = Math.min(targetMaxSpeed, this.speed + this.accelerationRate * delta);
    } else if (this.keys.backward) {
      this.speed = Math.max(0, this.speed - this.accelerationRate * delta * 1.5);
    } else {
      // Inertial dampening
      this.speed *= Math.pow(this.damping, delta * 60);
      if (this.speed < 0.1) this.speed = 0;
    }

    // 3. Integrate Kinematic Position
    const maxBound = this.isInQuasiSpace ? 300.0 : 1000.0;
    const vx = Math.cos(this.heading) * this.speed;
    const vy = Math.sin(this.heading) * this.speed;
    this.velocity = [vx, vy];

    const deltaDist = this.speed * delta;
    this.coordinates[0] += vx * delta;
    this.coordinates[1] += vy * delta;

    // Clamp coordinates within galactic/quasi bounds
    this.coordinates[0] = Math.max(0, Math.min(maxBound, this.coordinates[0]));
    this.coordinates[1] = Math.max(0, Math.min(maxBound, this.coordinates[1]));

    // 4. Distance-Based Fuel Burn Calculation (ZERO Fuel Burn in Quasi-Space!)
    let currentBurnRate = 0.0;
    if (!this.isInQuasiSpace) {
      const escortMult = 1.0 + 0.25 * this.activeEscortsCount;
      const afterburnerMult = this.keys.afterburner ? 1.5 : 1.0;
      currentBurnRate = this.baseBurnRate * escortMult * afterburnerMult;

      if (deltaDist > 0) {
        const fuelCostDelta = deltaDist * currentBurnRate;
        this.accumulatedFuelBurn += fuelCostDelta;

        if (this.accumulatedFuelBurn >= 1.0) {
          const wholeFuelDeducted = Math.floor(this.accumulatedFuelBurn);
          this.currentFuel = Math.max(0, this.currentFuel - wholeFuelDeducted);
          this.accumulatedFuelBurn -= wholeFuelDeducted;
        }
      }

      // Check Zero-Fuel Crisis in Hyperspace
      if (this.currentFuel <= 0 && !this.isSosDistressActive) {
        this.triggerEmergencySos();
        return;
      }
    }

    // Periodic Server Sync (every 3 seconds)
    const now = performance.now();
    if (now - this.lastSyncTime > 3000) {
      this.syncWithServer();
      this.lastSyncTime = now;
    }

    // Day 39: Update Warp Immunity Countdown
    if (this.immunityRemainingSeconds > 0) {
      this.immunityRemainingSeconds = Math.max(0, this.immunityRemainingSeconds - delta);
    }

    // Day 39: Periodic Subspace Radar Polling (Hyperspace only)
    if (!this.isInQuasiSpace && now - this.lastRadarPollTime > 1200) {
      this.pollRadarBlips();
      this.lastRadarPollTime = now;
    }

    // Day 39: Interception Collision Detection (R <= 1.8 LY in Hyperspace only)
    if (!this.isInQuasiSpace && this.immunityRemainingSeconds <= 0 && !this.isInterceptionActive) {
      for (const blip of this.radarBlips) {
        if (blip.distanceLY !== undefined && blip.distanceLY <= 1.8 && blip.isHostile) {
          this.triggerInterception(blip.id);
          break;
        }
      }
    }

    // Spatial Proximity Detection
    if (this.isInQuasiSpace) {
      this.detectNearestPortal();
      if (this.nearestPortal && this.nearestPortalDistance <= 3.0) {
        this.exitQuasiSpaceViaPortal(this.nearestPortal.id);
        return;
      }
    } else {
      // 5. Detect Nearest Star Gravity Well
      this.detectNearestStar();

      // Automatic drop-out if within 3.0 LY
      if (this.nearestSystem && this.nearestDistance <= 3.0) {
        this.dropOutOfHyperspace(this.nearestSystem.id);
        return;
      }
    }

    // 6. Update 3D Visual Positions & Warp Particles
    this.update3DScene(delta);

    // 7. Update HUD Telemetry
    this.updateHUD(currentBurnRate);
  }

  private detectNearestStar(): void {
    let closest: StarSystem | null = null;
    let minDist = 99999.0;

    for (const sys of this.systems) {
      const dist = Math.hypot(sys.coordinatesX - this.coordinates[0], sys.coordinatesY - this.coordinates[1]);
      if (dist < minDist) {
        minDist = dist;
        closest = sys;
      }
    }

    this.nearestSystem = closest;
    this.nearestDistance = Number(minDist.toFixed(2));
  }

  private async syncWithServer(): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('/api/starmap/hyperspace/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          currentCoords: this.coordinates,
          fuelBurned: 0, // Server tracks fuel from stored balance
        }),
      });
      if (res.ok) {
        const data = await res.json();
        this.currentFuel = Number(data.remainingFuel);
      }
      this.ctx.onHyperspaceSync?.(this.coordinates, this.heading);
    } catch {}
  }

  private update3DScene(delta: number): void {
    // Flagship orientation: heading 0 = +X in 2D, mapped to -Z forward in Three.js
    const threeHeading = -this.heading + Math.PI / 2;

    if (this.flagshipMesh) {
      this.flagshipMesh.rotation.y = threeHeading;
      // Slight banking tilt based on steering
      const rollTarget = this.keys.left ? 0.35 : this.keys.right ? -0.35 : 0;
      this.flagshipMesh.rotation.z += (rollTarget - this.flagshipMesh.rotation.z) * delta * 5;
    }

    // Escort formation flight (V-formation relative to flagship)
    const offsets = [
      [-16, -10], // Slot 1: Left Wing
      [16, -10],  // Slot 2: Right Wing
      [0, -24],   // Slot 3: Trailing Flank
    ];

    this.wingmenMeshes.forEach((mesh, idx) => {
      if (idx < offsets.length) {
        const ox = offsets[idx][0];
        const oz = offsets[idx][1];
        // Rotate offset by flagship heading
        const rx = ox * Math.cos(threeHeading) - oz * Math.sin(threeHeading);
        const rz = ox * Math.sin(threeHeading) + oz * Math.cos(threeHeading);

        mesh.position.set(rx, 0, rz);
        mesh.rotation.y = threeHeading;
      }
    });

    // Animate streaming relativistic warp particles
    if (this.warpParticles) {
      const positions = this.warpParticles.geometry.attributes.position.array as Float32Array;
      const streamVelocity = (this.speed / this.maxCruisingSpeed) * 350 * delta;

      for (let i = 0; i < positions.length; i += 6) {
        // Move backward along Z
        positions[i + 2] -= streamVelocity;
        positions[i + 5] -= streamVelocity;

        // Wrap around particle box
        if (positions[i + 2] < -180) {
          positions[i + 2] += 360;
          positions[i + 5] += 360;
        }
      }
      this.warpParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Camera Positioning
    if (this.cameraMode === 'TOP_DOWN') {
      // High-angle tactical top-down view centered on flagship with forward lead
      const leadDist = this.speed * 0.8;
      const lx = Math.cos(this.heading) * leadDist;
      const lz = Math.sin(this.heading) * leadDist;

      this.camera.position.set(lx, 140, lz + 20);
      this.camera.lookAt(lx, 0, lz);
    } else {
      // Chase Camera behind flagship
      const cx = -Math.cos(this.heading) * 38;
      const cz = -Math.sin(this.heading) * 38;
      this.camera.position.set(cx, 16, cz);
      this.camera.lookAt(Math.cos(this.heading) * 50, 0, Math.sin(this.heading) * 50);
    }

    // Day 40: Render Precursor Quasi-Space Portals vs Hyperspace Radar Blips
    if (this.isInQuasiSpace) {
      this.blipMeshes.forEach((grp) => (grp.visible = false));
      this.decoyMeshes.forEach((grp) => (grp.visible = false));
      this.remoteHyperspaceMeshes.forEach((grp) => (grp.visible = false));
      if (this.starPoints) this.starPoints.visible = false;

      // Render Quasi-Space Portals
      for (const portal of this.quasiPortals) {
        let grp = this.portalMeshes.get(portal.id);
        if (!grp) {
          grp = new THREE.Group();
          const obeliskGeo = new THREE.BoxGeometry(4.0, 16.0, 4.0);
          const obeliskMat = new THREE.MeshBasicMaterial({
            color: 0xa855f7,
            wireframe: true,
          });
          grp.add(new THREE.Mesh(obeliskGeo, obeliskMat));

          const haloGeo = new THREE.RingGeometry(6.0, 8.0, 16);
          const haloMat = new THREE.MeshBasicMaterial({
            color: 0x00ffaa,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
          });
          const halo = new THREE.Mesh(haloGeo, haloMat);
          halo.rotation.x = Math.PI / 2;
          grp.add(halo);

          this.hyperspaceGroup.add(grp);
          this.portalMeshes.set(portal.id, grp);
        }

        grp.visible = true;
        const relX = (portal.quasispaceX - this.coordinates[0]) * 4.0;
        const relZ = (portal.quasispaceY - this.coordinates[1]) * 4.0;
        grp.position.set(relX, 0, relZ);
        grp.rotation.y += delta * 0.8;
      }
    } else {
      this.portalMeshes.forEach((grp) => (grp.visible = false));
      if (this.starPoints) this.starPoints.visible = true;

      // Day 39: Render Subspace Radar Blips
      const currentBlipIds = new Set(this.radarBlips.map((b) => b.id));
      for (const [id, grp] of this.blipMeshes.entries()) {
        if (!currentBlipIds.has(id)) {
          this.hyperspaceGroup.remove(grp);
          this.blipMeshes.delete(id);
        }
      }

      for (const blip of this.radarBlips) {
        let grp = this.blipMeshes.get(blip.id);
        if (!grp) {
          grp = new THREE.Group();
          const coreGeo = new THREE.SphereGeometry(3.0, 10, 10);
          const coreMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(blip.factionColor),
            transparent: true,
            opacity: 0.9,
          });
          const core = new THREE.Mesh(coreGeo, coreMat);
          grp.add(core);

          const ringGeo = new THREE.RingGeometry(4.5, 6.0, 16);
          const ringMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(blip.factionColor),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = Math.PI / 2;
          grp.add(ring);

          this.hyperspaceGroup.add(grp);
          this.blipMeshes.set(blip.id, grp);
        }

        grp.visible = true;
        const relX = (blip.x - this.coordinates[0]) * 4.0;
        const relZ = (blip.y - this.coordinates[1]) * 4.0;
        grp.position.set(relX, 0, relZ);

        const scale = 1.0 + Math.sin(performance.now() * 0.006) * 0.2;
        grp.scale.set(scale, scale, scale);
      }

      // Day 39: Render Active Decoys
      const currentDecoyIds = new Set(this.activeDecoys.map((d) => d.id));
      for (const [id, grp] of this.decoyMeshes.entries()) {
        if (!currentDecoyIds.has(id)) {
          this.hyperspaceGroup.remove(grp);
          this.decoyMeshes.delete(id);
        }
      }

      for (const decoy of this.activeDecoys) {
        let grp = this.decoyMeshes.get(decoy.id);
        if (!grp) {
          grp = new THREE.Group();
          const geo = new THREE.SphereGeometry(4.0, 8, 8);
          const mat = new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            wireframe: true,
          });
          grp.add(new THREE.Mesh(geo, mat));
          this.hyperspaceGroup.add(grp);
          this.decoyMeshes.set(decoy.id, grp);
        }
        grp.visible = true;
        const relX = (decoy.x - this.coordinates[0]) * 4.0;
        const relZ = (decoy.y - this.coordinates[1]) * 4.0;
        grp.position.set(relX, 0, relZ);
      }

      // Milestone 1.8: Render Live Remote Captains in Hyperspace
      const nowMs = Date.now();
      for (const [accId, rp] of this.remoteHyperspacePlayers.entries()) {
        if (nowMs - rp.updatedAt > 15000) {
          this.remoteHyperspacePlayers.delete(accId);
          const oldGrp = this.remoteHyperspaceMeshes.get(accId);
          if (oldGrp) {
            this.hyperspaceGroup.remove(oldGrp);
            this.remoteHyperspaceMeshes.delete(accId);
          }
          continue;
        }
        let rpGrp = this.remoteHyperspaceMeshes.get(accId);
        if (!rpGrp) {
          rpGrp = new THREE.Group();
          const shipGeo = new THREE.ConeGeometry(2.6, 8.0, 6);
          shipGeo.rotateX(Math.PI / 2);
          const shipMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.95,
          });
          rpGrp.add(new THREE.Mesh(shipGeo, shipMat));

          const auraGeo = new THREE.RingGeometry(4.2, 5.4, 16);
          const auraMat = new THREE.MeshBasicMaterial({
            color: 0x10b981,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75,
          });
          const aura = new THREE.Mesh(auraGeo, auraMat);
          aura.rotation.x = Math.PI / 2;
          rpGrp.add(aura);

          this.hyperspaceGroup.add(rpGrp);
          this.remoteHyperspaceMeshes.set(accId, rpGrp);
        }
        rpGrp.visible = true;
        const relX = (rp.x - this.coordinates[0]) * 4.0;
        const relZ = (rp.y - this.coordinates[1]) * 4.0;
        rpGrp.position.set(relX, 0, relZ);
        rpGrp.rotation.y = -rp.heading + Math.PI / 2;
      }
    }

    // Day 39: Render Warp Stealth Shield
    if (this.immunityRemainingSeconds > 0) {
      if (!this.stealthShieldMesh) {
        const shieldGeo = new THREE.SphereGeometry(14, 16, 16);
        const shieldMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          wireframe: true,
          transparent: true,
          opacity: 0.5,
        });
        this.stealthShieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        this.hyperspaceGroup.add(this.stealthShieldMesh);
      }
      this.stealthShieldMesh.visible = true;
      this.stealthShieldMesh.rotation.y += delta * 1.5;
    } else if (this.stealthShieldMesh) {
      this.stealthShieldMesh.visible = false;
    }
  }

  public syncRemoteHyperspacePlayer(pos: {
    accountId: string;
    callsign?: string;
    factionId?: string;
    x: number;
    y: number;
    heading?: number;
  }): void {
    if (!pos.accountId) return;
    this.remoteHyperspacePlayers.set(pos.accountId, {
      accountId: pos.accountId,
      callsign: pos.callsign || pos.accountId,
      factionId: pos.factionId || 'FACTION_SOL',
      x: Number(pos.x) || 0,
      y: Number(pos.y) || 0,
      heading: Number(pos.heading) || 0,
      updatedAt: Date.now(),
    });
  }

  public removeRemoteHyperspacePlayer(accountId: string): void {
    this.remoteHyperspacePlayers.delete(accountId);
    const grp = this.remoteHyperspaceMeshes.get(accountId);
    if (grp) {
      this.hyperspaceGroup.remove(grp);
      this.remoteHyperspaceMeshes.delete(accountId);
    }
  }

  private updateHUD(currentBurnRate: number): void {
    if (this.hudCoords) {
      this.hudCoords.textContent = `[X: ${this.coordinates[0].toFixed(1)}, Y: ${this.coordinates[1].toFixed(1)}]`;
    }
    if (this.hudFuelVal) {
      this.hudFuelVal.textContent = `${this.currentFuel} / 100`;
    }
    if (this.hudFuelBar) {
      this.hudFuelBar.style.width = `${Math.min(100, Math.max(0, this.currentFuel))}%`;
      this.hudFuelBar.style.backgroundColor = this.currentFuel < 20 ? '#ef4444' : '#38bdf8';
    }
    if (this.hudBurnRate) {
      this.hudBurnRate.textContent = `${currentBurnRate.toFixed(2)} FUEL/LY (${this.activeEscortsCount} ESCORTS)`;
    }
    if (this.hudSpeed) {
      this.hudSpeed.textContent = `${this.speed.toFixed(1)} LY/s`;
    }

    // Day 39: Update Radar, Threat & Decoy Badges
    if (this.hudRadarBadge) {
      this.hudRadarBadge.textContent = `RADAR: ${this.radarBlips.length} CONTACTS`;
    }
    if (this.hudThreatBadge) {
      this.hudThreatBadge.textContent = `THREAT: ${this.threatLevel}`;
      this.hudThreatBadge.className = `hyper-threat-badge ${this.threatLevel.toLowerCase()}`;
    }
    if (this.hudDecoyCount) {
      this.hudDecoyCount.textContent = `${this.decoysRemaining}`;
    }
    if (this.hudDecoyBtn) {
      this.hudDecoyBtn.disabled = this.decoysRemaining <= 0;
    }
    if (this.hudStealthPill && this.hudStealthVal) {
      if (this.immunityRemainingSeconds > 0) {
        this.hudStealthPill.classList.remove('hidden');
        this.hudStealthVal.textContent = `${this.immunityRemainingSeconds.toFixed(1)}s`;
      } else {
        this.hudStealthPill.classList.add('hidden');
      }
    }

    // Compass needle rotation towards active waypoint
    if (this.activeCourse) {
      const tx = this.activeCourse.targetCoords[0];
      const ty = this.activeCourse.targetCoords[1];
      const dist = Math.hypot(tx - this.coordinates[0], ty - this.coordinates[1]);
      const targetAngle = Math.atan2(ty - this.coordinates[1], tx - this.coordinates[0]);
      const relativeAngle = targetAngle - this.heading;

      if (this.hudCompassNeedle) {
        this.hudCompassNeedle.style.transform = `rotate(${relativeAngle * (180 / Math.PI) + 90}deg)`;
      }
      if (this.hudTargetText) {
        const eta = this.speed > 0 ? (dist / this.speed).toFixed(1) : (dist / 25.0).toFixed(1);
        this.hudTargetText.textContent = `${this.activeCourse.targetName} // ${dist.toFixed(1)} LY (ETA: ${eta}s)`;
      }
    } else {
      if (this.hudTargetText) {
        this.hudTargetText.textContent = 'NO ACTIVE WAYPOINT (PLOT IN STARMAP [M])';
      }
    }

    if (this.hudAutopilotBadge) {
      this.hudAutopilotBadge.textContent = this.isAutopilotActive ? 'AUTOPILOT: ACTIVE [X]' : 'AUTOPILOT: STANDBY [X]';
      this.hudAutopilotBadge.className = `hyper-badge ${this.isAutopilotActive ? 'active' : 'standby'}`;
    }

    // Gravity Well Alert
    if (this.hudGravityWellAlert) {
      if (!this.isInQuasiSpace && this.nearestSystem && this.nearestDistance <= 8.0) {
        this.hudGravityWellAlert.classList.remove('hidden');
        this.hudGravityWellAlert.textContent = `GRAVITY WELL DETECTED: ${this.nearestSystem.name.toUpperCase()} (${this.nearestDistance} LY) // PRESS [ENTER / J] TO DROP OUT`;
      } else {
        this.hudGravityWellAlert.classList.add('hidden');
      }
    }

    // Day 40: Precursor Portal Proximity Alert
    if (this.hudPortalAlert) {
      if (this.isInQuasiSpace && this.nearestPortal && this.nearestPortalDistance <= 8.0) {
        this.hudPortalAlert.classList.remove('hidden');
        this.hudPortalAlert.textContent = `PRECURSOR PORTAL: ${this.nearestPortal.name.toUpperCase()} (${this.nearestPortalDistance} LY) // PRESS [ENTER / J] TO TRANSIT`;
      } else {
        this.hudPortalAlert.classList.add('hidden');
      }
    }

    // Day 40: Realm Badge & SOS Status
    if (this.hudRealmBadge) {
      if (this.isInQuasiSpace) {
        this.hudRealmBadge.classList.remove('hidden');
      } else {
        this.hudRealmBadge.classList.add('hidden');
      }
    }

    if (this.hudSosAlert) {
      if (this.isSosDistressActive) {
        this.hudSosAlert.classList.remove('hidden');
      } else {
        this.hudSosAlert.classList.add('hidden');
      }
    }
  }

  // =========================================================================
  // Day 39: Radar Blips, Decoys & Tactical Interceptions Handlers
  // =========================================================================

  /**
   * Polls authoritative radar blips from the backend Starmap service.
   */
  public async pollRadarBlips(): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('/api/starmap/hyperspace/blips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          currentCoords: this.coordinates,
          isBoosting: this.keys.afterburner,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const prevCount = this.radarBlips.length;
        this.radarBlips = data.blips || [];
        this.activeDecoys = data.activeDecoys || [];
        this.immunityRemainingSeconds = Number(data.immunityRemainingSeconds || 0);
        this.decoysRemaining = Number(data.decoysRemaining ?? this.decoysRemaining);
        this.threatLevel = data.threatLevel || 'CLEAR';
        this.territory = data.territory || 'Deep Space';

        // Sound cues
        const now = performance.now();
        if (this.threatLevel === 'PURSUIT' && now - this.lastAlertSoundTime > 2500) {
          this.ctx.audio.playProximityAlert();
          this.lastAlertSoundTime = now;
        } else if (this.radarBlips.length > prevCount) {
          const hasHostile = this.radarBlips.some((b) => b.isHostile);
          this.ctx.audio.playRadarPing(hasHostile);
        }
      }
    } catch {}
  }

  /**
   * Deploys a thermal subspace decoy to draw pursuing hostiles away.
   */
  public async deployDecoy(): Promise<void> {
    if (this.decoysRemaining <= 0) {
      this.ctx.showNotification?.('Decoy Countermeasure Failed: No decoys remaining in cargo hold.', true);
      return;
    }

    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('/api/starmap/hyperspace/decoy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          currentCoords: this.coordinates,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.ctx.showNotification?.(data.error || 'Failed to deploy decoy.', true);
        return;
      }

      this.decoysRemaining = data.decoysRemaining;
      this.ctx.audio.playDecoyLaunch();
      this.ctx.showNotification?.('🎯 Thermal Decoy deployed! Hostiles distracted for 6.0 seconds.');
      this.pollRadarBlips();
    } catch (err: any) {
      this.ctx.showNotification?.(`Decoy deployment error: ${err.message}`, true);
    }
  }

  /**
   * Triggers an alien interception collision event and launches Tier 1 Comms.
   */
  public async triggerInterception(blipId: string): Promise<void> {
    if (this.isInterceptionActive || this.immunityRemainingSeconds > 0) return;

    this.isInterceptionActive = true;
    this.speed = 0;
    this.velocity = [0, 0];
    this.keys.forward = false;

    this.ctx.audio.playWarpInterdiction();

    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('/api/starmap/hyperspace/intercept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          blipId,
          currentCoords: this.coordinates,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.isInterceptionActive = false;
        return;
      }

      if (this.ctx.onInterception && data.interception) {
        this.ctx.onInterception(data.interception);
      }
    } catch (err) {
      this.isInterceptionActive = false;
    }
  }

  /**
   * Resumes Hyperspace flight after peaceful Comms resolution (bribe, bluff, safe pass).
   */
  public resumeFlightAfterComms(result: any): void {
    this.isInterceptionActive = false;
    this.immunityRemainingSeconds = Number(result.immunityGrantedSeconds || 5.0);
    this.ctx.showNotification?.(result.message || 'Resuming continuous Hyperspace flight.');
    this.pollRadarBlips();
  }

  /**
   * Drops out of Hyperspace to engage in Tier 2 20Hz tactical combat.
   */
  public dropOutOfHyperspaceToCombat(combatSetup?: any): void {
    this.isInterceptionActive = false;
    this.isInHyperspace = false;
    this.hyperspaceGroup.visible = false;
    if (this.hudElement) {
      this.hudElement.classList.add('hidden');
      this.hudElement.style.display = 'none';
    }

    this.ctx.audio.stopHyperspaceDrone();
    this.ctx.audio.playWarpCollapse();

    if (this.ctx.onCombatDrop) {
      this.ctx.onCombatDrop(combatSetup);
    }
  }

  /**
   * Resumes Hyperspace in-situ following combat victory or FTL escape.
   */
  public async resumeHyperspaceAfterCombat(combatOutcome: 'VICTORY' | 'FLED' = 'VICTORY'): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('/api/starmap/hyperspace/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, combatOutcome }),
      });

      const data = await res.json();
      this.isInHyperspace = true;
      this.isInterceptionActive = false;
      this.immunityRemainingSeconds = 5.0;
      this.hyperspaceGroup.visible = true;

      if (this.hudElement) {
        this.hudElement.classList.remove('hidden');
        this.hudElement.style.display = 'flex';
      }

      this.ctx.audio.startHyperspaceDrone();
      this.ctx.showNotification?.(data.message || 'Hyperspace flight resumed with 5s warp-flare immunity.');
      this.pollRadarBlips();
    } catch (err: any) {
      this.ctx.showNotification?.(`Hyperspace resumption error: ${err.message}`, true);
    }
  }

  // =========================================================================
  // Day 40: Precursor Quasi-Space & Emergency SOS Transponder Methods
  // =========================================================================

  public detectNearestPortal(): void {
    let closest: any = null;
    let minDist = 9999.0;

    for (const portal of this.quasiPortals) {
      const dist = Math.hypot(portal.quasispaceX - this.coordinates[0], portal.quasispaceY - this.coordinates[1]);
      if (dist < minDist) {
        minDist = dist;
        closest = portal;
      }
    }

    this.nearestPortal = closest;
    this.nearestPortalDistance = Number(minDist.toFixed(1));
  }

  public populateQuasiPortals(portals: any[]): void {
    this.quasiPortals = portals;
  }

  /**
   * Transitions from real Hyperspace into Precursor Quasi-Space
   */
  public async enterQuasiSpace(): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('/api/starmap/quasispace/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.ctx.showNotification?.(data.error || 'Failed to enter Quasi-Space.', true);
        return;
      }

      this.isInHyperspace = true;
      this.isInQuasiSpace = true;
      this.coordinates = [data.coordinates[0], data.coordinates[1]];
      this.velocity = [0, 0];
      this.speed = 0;

      // Audio transition
      this.ctx.audio.stopHyperspaceDrone();
      this.ctx.audio.startQuasiSpaceDrone();
      this.ctx.audio.playPortalTransition();

      // Load portal beacons
      if (this.quasiPortals.length === 0) {
        const portalRes = await fetch('/api/starmap/quasispace/portals');
        if (portalRes.ok) {
          const pData = await portalRes.json();
          this.populateQuasiPortals(pData.portals || []);
        }
      }

      this.ctx.showNotification?.('🌀 Dimensional Phase Shift: Cruising in Precursor Quasi-Space.');
    } catch (err: any) {
      this.ctx.showNotification?.(`Quasi-Space Error: ${err.message}`, true);
    }
  }

  /**
   * Transits an ancient Precursor Portal, projecting back into real Hyperspace
   */
  public async exitQuasiSpaceViaPortal(portalId: string): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('/api/starmap/quasispace/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, portalId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.ctx.showNotification?.(data.error || 'Failed to transit portal.', true);
        return;
      }

      this.isInQuasiSpace = false;
      this.coordinates = [data.coordinates[0], data.coordinates[1]];
      this.immunityRemainingSeconds = 5.0;

      // Audio transition
      this.ctx.audio.stopQuasiSpaceDrone();
      this.ctx.audio.startHyperspaceDrone();
      this.ctx.audio.playPortalTransition();

      this.ctx.showNotification?.(`⚡ Portal Transit Complete: Emerged at ${data.portalName}.`);
    } catch (err: any) {
      this.ctx.showNotification?.(`Portal Error: ${err.message}`, true);
    }
  }

  /**
   * Broadcasts an automated emergency SOS distress beacon when fuel drops to 0
   */
  public async triggerEmergencySos(): Promise<void> {
    if (this.isSosDistressActive) return;

    this.isSosDistressActive = true;
    this.speed = 0;
    this.velocity = [0, 0];
    this.keys.forward = false;

    this.ctx.audio.playSosDistressBeacon();

    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('/api/starmap/hyperspace/sos-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.encounter) {
        this.isSosDistressActive = false;
        return;
      }

      this.renderEmergencySosModal(data.encounter);
    } catch (err) {
      this.isSosDistressActive = false;
    }
  }

  private renderEmergencySosModal(encounter: any): void {
    if (this.modalEmergencySos) {
      this.modalEmergencySos.classList.remove('hidden');
    }
    if (this.sosResponderName) {
      this.sosResponderName.textContent = encounter.responderName.toUpperCase();
    }
    if (this.sosDialogueText) {
      this.sosDialogueText.textContent = `"${encounter.dialogueText}"`;
    }

    if (this.sosActionsContainer) {
      this.sosActionsContainer.innerHTML = (encounter.options || []).map((opt: any) => {
        const isHostile = opt.action === 'FIGHT' || opt.action === 'SURRENDER';
        return `
          <button class="sos-action-btn ${isHostile ? 'hostile' : ''}" data-action="${opt.action}">
            <span class="sos-action-label">${opt.label}</span>
            <span class="sos-action-desc" style="color: #94a3b8; font-size: 0.7rem;">${opt.description}</span>
          </button>
        `;
      }).join('');

      this.sosActionsContainer.querySelectorAll('.sos-action-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const action = (e.currentTarget as HTMLElement).getAttribute('data-action');
          if (action) {
            this.resolveEmergencySos(action);
          }
        });
      });
    }
  }

  /**
   * Resolves the Emergency SOS transaction (fuel purchase, barter, or combat drop)
   */
  public async resolveEmergencySos(choice: string): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('/api/starmap/hyperspace/sos-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, choice }),
      });

      const data = await res.json();
      if (this.modalEmergencySos) {
        this.modalEmergencySos.classList.add('hidden');
      }

      if (data.combatDropRequired) {
        this.isSosDistressActive = false;
        this.dropOutOfHyperspaceToCombat(data.combatSetup);
        return;
      }

      if (data.success) {
        this.isSosDistressActive = false;
        this.currentFuel = Number(data.remainingFuel ?? 25);
        this.immunityRemainingSeconds = 5.0;
        this.ctx.showNotification?.(data.message || 'Emergency fuel transferred!');
      } else {
        this.ctx.showNotification?.(data.error || 'SOS transaction failed.', true);
        this.isSosDistressActive = false;
      }
    } catch (err: any) {
      this.isSosDistressActive = false;
      if (this.modalEmergencySos) {
        this.modalEmergencySos.classList.add('hidden');
      }
      this.ctx.showNotification?.(`SOS Error: ${err.message}`, true);
    }
  }

  private getSpectralRGB(spectral: string): [number, number, number] {
    switch (spectral) {
      case 'BLUE_O':
        return [0.22, 0.74, 0.97];
      case 'WHITE_A':
        return [0.97, 0.98, 0.99];
      case 'YELLOW_G':
        return [0.98, 0.75, 0.14];
      case 'ORANGE_K':
        return [0.98, 0.57, 0.24];
      case 'RED_M':
        return [0.97, 0.44, 0.44];
      case 'NEUTRON':
        return [0.75, 0.52, 0.99];
      default:
        return [0.88, 0.91, 0.94];
    }
  }
}

