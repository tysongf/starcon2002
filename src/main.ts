import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

  // Diagnostics & Telemetry
  private lastTime: number = performance.now();
  private frameCount: number = 0;
  private fpsTimer: number = 0;
  private currentFps: number = 60;
  private currentFrameTime: number = 16.6;

  // Telemetry DOM elements
  private elFps: HTMLElement | null = null;
  private elFrameTime: HTMLElement | null = null;
  private elDrawCalls: HTMLElement | null = null;
  private elTriangles: HTMLElement | null = null;
  private elCamPos: HTMLElement | null = null;
  private elCamTarget: HTMLElement | null = null;

  // Default camera configuration
  private readonly defaultCamPos = new THREE.Vector3(0, 18, 28);
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
    this.renderer.toneMappingExposure = 1.1;

    // 2. Initialize Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06080d);
    this.scene.fog = new THREE.FogExp2(0x06080d, 0.0035);

    // 3. Initialize Perspective Camera
    this.camera = new THREE.PerspectiveCamera(
      55,
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
    this.controls.minDistance = 5;
    this.controls.maxDistance = 150;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.1; // Allow slight sub-plane view
    this.controls.target.copy(this.defaultCamTarget);

    // 5. Lighting Setup
    // Soft deep-space ambient light
    this.ambientLight = new THREE.AmbientLight(0x28334a, 1.2);
    this.scene.add(this.ambientLight);

    // Primary sector star (warm directional sunlight)
    this.starLight = new THREE.DirectionalLight(0xfff4e6, 2.0);
    this.starLight.position.set(40, 60, 30);
    this.scene.add(this.starLight);

    // Secondary rim backlight
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(-40, -20, -30);
    this.scene.add(rimLight);

    // 6. Tactical Sector Grid (X/Z navigation plane)
    this.sectorGrid = new THREE.GridHelper(100, 50, 0x38bdf8, 0x1a2638);
    this.sectorGrid.position.y = -0.05;
    this.scene.add(this.sectorGrid);

    // 7. Background Starfield
    this.starfield = this.createStarfield(1200);
    this.scene.add(this.starfield);

    // 8. Cache Telemetry DOM references
    this.cacheTelemetryElements();

    // 9. Setup Event Listeners
    this.setupEventListeners();

    // 10. Start Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  /**
   * Generates a deterministic procedural starfield
   */
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
      // Distribute stars on a large sphere radius around origin
      const radius = 250 + Math.random() * 200;
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

    // Reset Camera Button & 'R' Key
    const resetCam = () => {
      this.camera.position.copy(this.defaultCamPos);
      this.controls.target.copy(this.defaultCamTarget);
      this.controls.update();
    };

    document.getElementById('btn-reset-cam')?.addEventListener('click', resetCam);

    // Toggle Grid Button & 'G' Key
    const toggleGrid = () => {
      this.sectorGrid.visible = !this.sectorGrid.visible;
    };

    document.getElementById('btn-toggle-grid')?.addEventListener('click', toggleGrid);

    // Toggle Stars Button
    document.getElementById('btn-toggle-stars')?.addEventListener('click', () => {
      this.starfield.visible = !this.starfield.visible;
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        resetCam();
      } else if (e.key === 'g' || e.key === 'G') {
        toggleGrid();
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

    // Slowly rotate background starfield for gentle ambient depth
    this.starfield.rotation.y += 0.00015;

    // Update Damped Orbit Controls
    this.controls.update();

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Updates HUD telemetry readings
   */
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
