import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ProceduralHullGenerator, type HullGenerationResult } from './procgen/ProceduralHullGenerator';
import { type FactionStyle, FACTION_STYLES } from './procgen/FactionStyles';

class GameEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

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
  private autoRotateShip: boolean = true;

  // Diagnostics & Telemetry
  private lastTime: number = performance.now();
  private frameCount: number = 0;
  private fpsTimer: number = 0;
  private currentFps: number = 60;
  private currentFrameTime: number = 16.6;

  // Telemetry & UI DOM elements
  private elFps: HTMLElement | null = null;
  private elFrameTime: HTMLElement | null = null;
  private elDrawCalls: HTMLElement | null = null;
  private elTriangles: HTMLElement | null = null;
  private elCamPos: HTMLElement | null = null;
  private elCamTarget: HTMLElement | null = null;
  private elHullTris: HTMLElement | null = null;
  private elHullVerts: HTMLElement | null = null;
  private elGrammarStyle: HTMLElement | null = null;
  private elFactionDesc: HTMLElement | null = null;
  private selectFaction: HTMLSelectElement | null = null;
  private swatchPri: HTMLElement | null = null;
  private swatchSec: HTMLElement | null = null;
  private swatchGlow: HTMLElement | null = null;
  private inputSeed: HTMLInputElement | null = null;
  private btnToggleRotate: HTMLElement | null = null;

  // Default camera configuration
  private readonly defaultCamPos = new THREE.Vector3(0, 7, 14);
  private readonly defaultCamTarget = new THREE.Vector3(0, 0, 0);

  constructor() {
    this.canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Canvas element #webgl-canvas not found.');
    }

    // 1. Initialize WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // 2. Initialize Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06080d);
    this.scene.fog = new THREE.FogExp2(0x06080d, 0.0035);

    // 3. Initialize Perspective Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.copy(this.defaultCamPos);

    // 4. Initialize Orbit Controls
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 150;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.15;
    this.controls.target.copy(this.defaultCamTarget);

    // 5. Lighting Setup
    this.ambientLight = new THREE.AmbientLight(0x28334a, 1.3);
    this.scene.add(this.ambientLight);

    // Key light (primary sector star)
    this.starLight = new THREE.DirectionalLight(0xfff5eb, 2.2);
    this.starLight.position.set(30, 45, 25);
    this.scene.add(this.starLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    fillLight.position.set(-30, -15, -20);
    this.scene.add(fillLight);

    // Bounce light for ship underbelly
    const bounceLight = new THREE.DirectionalLight(0x1e293b, 0.8);
    bounceLight.position.set(0, -20, 0);
    this.scene.add(bounceLight);

    // 6. Tactical Sector Grid (X/Z plane)
    this.sectorGrid = new THREE.GridHelper(50, 50, 0x38bdf8, 0x141e2e);
    this.sectorGrid.position.y = -2.0;
    this.scene.add(this.sectorGrid);

    // 7. Background Starfield
    this.starfield = this.createStarfield(1400);
    this.scene.add(this.starfield);

    // 8. Shared Material for Flat-Shaded Low-Poly Hulls
    this.shipMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: this.currentFaction.materials.roughness,
      metalness: this.currentFaction.materials.metalness,
      flatShading: true,
    });

    // 9. Cache Telemetry DOM references
    this.cacheTelemetryElements();

    // 10. Generate Initial Ship with Default Seed and Faction
    this.generateShip(this.currentSeed, this.currentFaction);

    // 11. Setup Event Listeners
    this.setupEventListeners();

    // 12. Start Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  /**
   * Generates or regenerates procedural spacecraft hull with race palette
   */
  public generateShip(seed: number, faction?: FactionStyle): void {
    this.currentSeed = seed;
    if (faction) {
      this.currentFaction = faction;
    }

    // Update material properties dynamically according to faction aesthetic
    this.shipMaterial.roughness = this.currentFaction.materials.roughness;
    this.shipMaterial.metalness = this.currentFaction.materials.metalness;
    this.shipMaterial.needsUpdate = true;

    // Remove existing ship mesh if present
    if (this.shipMesh) {
      this.scene.remove(this.shipMesh);
      this.shipMesh.geometry.dispose();
      this.shipMesh = null;
    }

    // Generate new geometry driven by faction grammar and palette
    const result: HullGenerationResult = ProceduralHullGenerator.generate({
      seed: this.currentSeed,
      faction: this.currentFaction,
    });

    this.shipMesh = new THREE.Mesh(result.geometry, this.shipMaterial);
    this.shipMesh.position.set(0, 0, 0);
    this.scene.add(this.shipMesh);

    // Update Telemetry & UI Readouts
    if (this.elHullTris) {
      this.elHullTris.textContent = `${result.triangleCount}`;
    }
    if (this.elHullVerts) {
      this.elHullVerts.textContent = `${result.vertexCount}`;
    }
    if (this.inputSeed) {
      this.inputSeed.value = `${this.currentSeed}`;
    }
    if (this.selectFaction) {
      this.selectFaction.value = this.currentFaction.id;
    }
    if (this.elFactionDesc) {
      this.elFactionDesc.textContent = this.currentFaction.culturalSummary;
    }
    if (this.elGrammarStyle) {
      const grammarName = this.currentFaction.shapeGrammar.replace('_', ' ');
      this.elGrammarStyle.textContent = `Strike Corvette // ${grammarName}`;
    }

    // Update Color Swatches
    const toHexStr = (c: number) => '#' + c.toString(16).padStart(6, '0');
    if (this.swatchPri) {
      this.swatchPri.style.backgroundColor = toHexStr(this.currentFaction.palette.primary);
    }
    if (this.swatchSec) {
      this.swatchSec.style.backgroundColor = toHexStr(this.currentFaction.palette.secondary);
    }
    if (this.swatchGlow) {
      const glowHex = toHexStr(this.currentFaction.palette.engineGlow);
      this.swatchGlow.style.backgroundColor = glowHex;
      this.swatchGlow.style.boxShadow = `0 0 8px ${glowHex}`;
    }
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
      const radius = 220 + Math.random() * 220;
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
    this.elFrameTime = document.getElementById('val-frametime');
    this.elDrawCalls = document.getElementById('val-drawcalls');
    this.elTriangles = document.getElementById('val-triangles');
    this.elCamPos = document.getElementById('val-cam-pos');
    this.elCamTarget = document.getElementById('val-cam-target');
    this.elHullTris = document.getElementById('val-hull-tris');
    this.elHullVerts = document.getElementById('val-hull-verts');
    this.elGrammarStyle = document.getElementById('val-grammar-style');
    this.elFactionDesc = document.getElementById('val-faction-desc');
    this.selectFaction = document.getElementById('select-faction') as HTMLSelectElement;
    this.swatchPri = document.getElementById('swatch-pri');
    this.swatchSec = document.getElementById('swatch-sec');
    this.swatchGlow = document.getElementById('swatch-glow');
    this.inputSeed = document.getElementById('input-seed') as HTMLInputElement;
    this.btnToggleRotate = document.getElementById('btn-toggle-rotate');
  }

  private setupEventListeners(): void {
    // Window Resize
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });

    // Reset Camera
    const resetCam = () => {
      this.camera.position.copy(this.defaultCamPos);
      this.controls.target.copy(this.defaultCamTarget);
      this.controls.update();
    };
    document.getElementById('btn-reset-cam')?.addEventListener('click', resetCam);

    // Toggle Grid
    const toggleGrid = () => {
      this.sectorGrid.visible = !this.sectorGrid.visible;
    };
    document.getElementById('btn-toggle-grid')?.addEventListener('click', toggleGrid);

    // Toggle Auto-Rotate
    const toggleRotate = () => {
      this.autoRotateShip = !this.autoRotateShip;
      if (this.btnToggleRotate) {
        this.btnToggleRotate.textContent = `Auto-Rotate: ${this.autoRotateShip ? 'ON' : 'OFF'}`;
      }
    };
    this.btnToggleRotate?.addEventListener('click', toggleRotate);

    // Faction Selector Dropdown Change
    this.selectFaction?.addEventListener('change', () => {
      const selectedId = this.selectFaction?.value;
      if (selectedId && FACTION_STYLES[selectedId]) {
        this.generateShip(this.currentSeed, FACTION_STYLES[selectedId]);
      }
    });

    // Regenerate Seed from input
    document.getElementById('btn-generate-seed')?.addEventListener('click', () => {
      if (this.inputSeed) {
        const val = parseInt(this.inputSeed.value, 10);
        if (!isNaN(val) && val > 0) {
          this.generateShip(val);
        }
      }
    });

    // Randomize Seed
    document.getElementById('btn-random-seed')?.addEventListener('click', () => {
      const randomSeed = Math.floor(Math.random() * 900000) + 10000;
      this.generateShip(randomSeed);
    });

    // Enter key inside seed input
    this.inputSeed?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const val = parseInt(this.inputSeed!.value, 10);
        if (!isNaN(val) && val > 0) {
          this.generateShip(val);
        }
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        resetCam();
      } else if (e.key === 'g' || e.key === 'G') {
        toggleGrid();
      } else if (e.key === ' ') {
        e.preventDefault();
        toggleRotate();
      } else if (e.key === '1') {
        this.generateShip(this.currentSeed, FACTION_STYLES.FACTION_SOL);
      } else if (e.key === '2') {
        this.generateShip(this.currentSeed, FACTION_STYLES.FACTION_PHORID);
      } else if (e.key === '3') {
        this.generateShip(this.currentSeed, FACTION_STYLES.FACTION_LITHOS);
      } else if (e.key === '4') {
        this.generateShip(this.currentSeed, FACTION_STYLES.FACTION_VAELIC);
      }
    });
  }

  /**
   * Main Render and Update Loop
   */
  private animate(currentTime: number): void {
    requestAnimationFrame(this.animate);

    // Calculate Delta & FPS
    const deltaMs = currentTime - this.lastTime;
    this.lastTime = currentTime;
    this.currentFrameTime = deltaMs;

    this.frameCount++;
    this.fpsTimer += deltaMs;
    if (this.fpsTimer >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
      this.updateTelemetryDOM();
    }

    // Slowly rotate ship if enabled
    if (this.shipMesh && this.autoRotateShip) {
      this.shipMesh.rotation.y += 0.006;
    }

    // Ambient starfield rotation
    this.starfield.rotation.y += 0.00015;

    // Update Damped Orbit Controls
    this.controls.update();

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }

  private updateTelemetryDOM(): void {
    if (this.elFps) this.elFps.textContent = `${this.currentFps} FPS`;
    if (this.elFrameTime) this.elFrameTime.textContent = `${this.currentFrameTime.toFixed(1)} ms`;
    if (this.elDrawCalls) this.elDrawCalls.textContent = `${this.renderer.info.render.calls}`;
    if (this.elTriangles) this.elTriangles.textContent = `${this.renderer.info.render.triangles}`;

    if (this.elCamPos) {
      const p = this.camera.position;
      this.elCamPos.textContent = `X: ${p.x.toFixed(1)} Y: ${p.y.toFixed(1)} Z: ${p.z.toFixed(1)}`;
    }
    if (this.elCamTarget) {
      const t = this.controls.target;
      this.elCamTarget.textContent = `X: ${t.x.toFixed(1)} Y: ${t.y.toFixed(1)} Z: ${t.z.toFixed(1)}`;
    }
  }
}

// Instantiate engine when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new GameEngine();
});
