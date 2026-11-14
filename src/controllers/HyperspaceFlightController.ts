import * as THREE from 'three';
import { type StarSystem, type FactionSphere, type CoursePlotResult } from './StarmapController';
import { AudioEngine } from '../audio/AudioEngine';

export interface HyperspaceContext {
  getAccountId: () => string;
  showNotification?: (msg: string, isError?: boolean) => void;
  playUiBlip?: () => void;
  audio: AudioEngine;
  onExitHyperspace: (newSectorId: number) => void;
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

      // Toggle Autopilot Assist
      if (e.code === 'KeyX') {
        this.toggleAutopilot();
      }

      // Toggle Camera Mode
      if (e.code === 'KeyC') {
        this.cameraMode = this.cameraMode === 'TOP_DOWN' ? 'CHASE' : 'TOP_DOWN';
        this.ctx.playUiBlip?.();
      }

      // Orbital Gravity Well Drop-Out
      if ((e.code === 'Enter' || e.code === 'KeyJ') && this.nearestSystem && this.nearestDistance <= 8.0) {
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

    // 1. Process Steering (Angular)
    if (this.isAutopilotActive && this.activeCourse) {
      const tx = this.activeCourse.targetCoords[0];
      const ty = this.activeCourse.targetCoords[1];
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
    } else {
      if (this.keys.left) this.heading -= this.turnRate * delta;
      if (this.keys.right) this.heading += this.turnRate * delta;
    }

    // Keep heading in [0, 2PI]
    while (this.heading < 0) this.heading += Math.PI * 2;
    while (this.heading >= Math.PI * 2) this.heading -= Math.PI * 2;

    // 2. Process Thrusters & Acceleration
    const targetMaxSpeed = this.keys.afterburner ? this.afterburnerSpeed : this.maxCruisingSpeed;

    if (this.keys.forward && this.currentFuel > 0) {
      this.speed = Math.min(targetMaxSpeed, this.speed + this.accelerationRate * delta);
    } else if (this.keys.backward) {
      this.speed = Math.max(0, this.speed - this.accelerationRate * delta * 1.5);
    } else {
      // Inertial dampening
      this.speed *= Math.pow(this.damping, delta * 60);
      if (this.speed < 0.1) this.speed = 0;
    }

    // 3. Integrate Kinematic Position (X, Y in Light-Years)
    const vx = Math.cos(this.heading) * this.speed;
    const vy = Math.sin(this.heading) * this.speed;
    this.velocity = [vx, vy];

    const deltaDist = this.speed * delta;
    this.coordinates[0] += vx * delta;
    this.coordinates[1] += vy * delta;

    // Clamp coordinates within galactic bounds [0, 1000]
    this.coordinates[0] = Math.max(0, Math.min(1000, this.coordinates[0]));
    this.coordinates[1] = Math.max(0, Math.min(1000, this.coordinates[1]));

    // 4. Distance-Based Fuel Burn Calculation
    // Effective Rate = 0.20 * (1 + 0.25 * escorts) (+50% in afterburner)
    const escortMult = 1.0 + 0.25 * this.activeEscortsCount;
    const afterburnerMult = this.keys.afterburner ? 1.5 : 1.0;
    const currentBurnRate = this.baseBurnRate * escortMult * afterburnerMult;

    if (deltaDist > 0) {
      const fuelCostDelta = deltaDist * currentBurnRate;
      this.accumulatedFuelBurn += fuelCostDelta;

      if (this.accumulatedFuelBurn >= 1.0) {
        const wholeFuelDeducted = Math.floor(this.accumulatedFuelBurn);
        this.currentFuel = Math.max(0, this.currentFuel - wholeFuelDeducted);
        this.accumulatedFuelBurn -= wholeFuelDeducted;
      }
    }

    // Periodic Server Sync (every 3 seconds)
    const now = performance.now();
    if (now - this.lastSyncTime > 3000) {
      this.syncWithServer();
      this.lastSyncTime = now;
    }

    // 5. Detect Nearest Star Gravity Well
    this.detectNearestStar();

    // Automatic drop-out if within 3.0 LY
    if (this.nearestSystem && this.nearestDistance <= 3.0) {
      this.dropOutOfHyperspace(this.nearestSystem.id);
      return;
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
      if (this.nearestSystem && this.nearestDistance <= 8.0) {
        this.hudGravityWellAlert.classList.remove('hidden');
        this.hudGravityWellAlert.textContent = `GRAVITY WELL DETECTED: ${this.nearestSystem.name.toUpperCase()} (${this.nearestDistance} LY) // PRESS [ENTER / J] TO DROP OUT`;
      } else {
        this.hudGravityWellAlert.classList.add('hidden');
      }
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

