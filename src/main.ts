import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ProceduralHullGenerator, type HullGenerationResult } from './procgen/ProceduralHullGenerator';
import { type FactionStyle, FACTION_STYLES } from './procgen/FactionStyles';
import { ShipFlightController, type FlightTelemetry } from './physics/ShipFlightController';
import { ThrusterParticleSystem } from './vfx/ThrusterParticleSystem';
import { SpaceStation } from './entities/SpaceStation';
import { type DockingStatus } from './entities/DockingZone';
import { AudioEngine } from './audio/AudioEngine';

class GameEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  // Flight Physics & Systems
  private flightController: ShipFlightController;
  private thrusters: ThrusterParticleSystem;
  private station: SpaceStation;
  private audio: AudioEngine;
  private cameraMode: 'CHASE' | 'ORBIT' = 'CHASE';
  private isDocked: boolean = false;

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
  private modalMarketTicker: HTMLElement | null = null;
  private elBackendBadge: HTMLElement | null = null;
  private btnUndock: HTMLElement | null = null;
  private btnQuickService: HTMLElement | null = null;

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

    // Customize dialog transmission based on faction affiliation
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

    if (this.modalStationName) {
      this.modalStationName.textContent = `${this.station.config.name} // SECTOR 01`;
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
    this.modalMarketTicker = document.getElementById('modal-market-ticker');
    this.elBackendBadge = document.getElementById('backend-status-badge');
    this.btnUndock = document.getElementById('btn-undock');
    this.btnQuickService = document.getElementById('btn-quick-service');

    // Check backend health
    this.checkBackendHealth();
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

  private async loadPortInventory(): Promise<void> {
    try {
      const res = await fetch('/api/ports/PORT_AEGIS_01');
      if (res.ok) {
        const data = await res.json();
        if (this.modalMarketTicker && Array.isArray(data.inventory)) {
          this.modalMarketTicker.innerHTML = data.inventory
            .map((item: { commodity_id: string; buy_price: number; stock: number; capacity: number; demand: number }) => `
              <div class="ticker-row">
                <span>${item.commodity_id.replace('COMM_', '')}</span>
                <span class="price">${item.buy_price.toFixed(1)} Cr</span>
                <span class="stock">STOCK: ${item.stock} / ${item.capacity}</span>
              </div>
            `)
            .join('');
        }
      }
    } catch {
      // Keep initial static preview
    }
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

    // Quick service button click
    this.btnQuickService?.addEventListener('click', () => {
      this.audio.playUiBlip();
      if (this.btnQuickService) {
        this.btnQuickService.textContent = '✅ COUPLERS REFRESHED & SERVICED';
        setTimeout(() => {
          if (this.btnQuickService) {
            this.btnQuickService.textContent = '⚡ Cycle Power & Refresh Couplers';
          }
        }, 1500);
      }
    });

    // Keydown Controls
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if (e.code === 'Escape') {
        if (this.isDocked) {
          this.undockShip();
          return;
        }
      }

      // If docked, suppress flight movement keys
      if (this.isDocked) {
        return;
      }

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.flightController.setInput('forward', true);
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.flightController.setInput('reverse', true);
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.flightController.setInput('turnLeft', true);
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.flightController.setInput('turnRight', true);
          break;
        case 'KeyX':
          this.flightController.setInput('brake', true);
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
        case 'KeyE':
        case 'Space': {
          e.preventDefault();
          const dockCheck = this.station.checkDocking(
            this.flightController.position,
            this.flightController.velocity.length()
          );
          if (dockCheck.canDock) {
            this.dockShip();
          }
          break;
        }
        case 'Digit1':
          this.generateShip(this.currentSeed, FACTION_STYLES.FACTION_SOL);
          break;
        case 'Digit2':
          this.generateShip(this.currentSeed, FACTION_STYLES.FACTION_PHORID);
          break;
        case 'Digit3':
          this.generateShip(this.currentSeed, FACTION_STYLES.FACTION_LITHOS);
          break;
        case 'Digit4':
          this.generateShip(this.currentSeed, FACTION_STYLES.FACTION_VAELIC);
          break;
      }
    });

    // Keyup Controls
    window.addEventListener('keyup', (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.flightController.setInput('forward', false);
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.flightController.setInput('reverse', false);
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.flightController.setInput('turnLeft', false);
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.flightController.setInput('turnRight', false);
          break;
        case 'KeyX':
          this.flightController.setInput('brake', false);
          break;
      }
    });
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
      if (telemetry.isThrusting) {
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

    // 5. Update Orbital Space Station
    this.station.update(deltaSec);
    const dockStatus = this.station.checkDocking(
      this.flightController.position,
      telemetry.speed
    );

    // 6. Update Camera
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

    // 9. Render
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
}

// Instantiate engine when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new GameEngine();
});
