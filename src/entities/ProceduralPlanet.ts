import * as THREE from 'three';

export interface PlanetPaletteData {
  base: string;
  band1: string;
  band2: string;
  accent: string;
  glow: string;
  atmosphere: string;
  patternStyle:
    | 'ARCHIPELAGO'
    | 'BANDED'
    | 'CRATERED'
    | 'MAGMA_FISSURE'
    | 'CRYSTAL_FACETS'
    | 'MYCELIAL_WEB'
    | 'CYBER_GRID'
    | 'PRECURSOR_GLYPH';
  hasRings: boolean;
  hasClouds: boolean;
  emissiveStrength: number;
}

export interface PlanetData {
  id: string;
  sectorId: number;
  name: string;
  mainClass: string;
  mainClassLabel?: string;
  subtype?: string;
  abundanceRating?: number;
  tectonicsRating?: number;
  atmosphereRating?: number;
  densityRating?: number;
  orbitIndex?: number;
  primaryResource?: string;
  exoticResource?: string;
  planetPalette?: PlanetPaletteData;
  lifeformsCount?: number;
  radius: number;
  posX: number;
  posY: number;
  posZ: number;
  textureSeed: number;
  atmosphereColor: string;
  atmosphereDensity: number;
  surfaceTempK: number;
  hazardClass: string;
  habitabilityRating: number;
  controllingFaction: string;
  description?: string;
}

export class ProceduralPlanet {
  public readonly data: PlanetData;
  public readonly group: THREE.Group;
  public readonly position: THREE.Vector3;
  public readonly orbitalRadius: number = 35.0; // Distance threshold for [O] Synchronous Orbit

  private surfaceMesh: THREE.Mesh;
  private atmosphereMesh?: THREE.Mesh;
  private cloudsMesh?: THREE.Mesh;
  private ringsMesh?: THREE.Mesh;
  private orbitalBeaconRing: THREE.LineLoop;

  constructor(data: PlanetData) {
    this.data = data;
    this.position = new THREE.Vector3(data.posX, data.posY || 0, data.posZ);
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const radius = data.radius || 22.0;

    const palette = data.planetPalette;
    const emissiveStr = palette?.emissiveStrength ?? (data.mainClass === 'PYRO_TECTONIC' ? 0.35 : 0);

    // 1. Surface Texture & Material
    const surfaceTexture = this.generateProceduralTexture(data);
    const surfaceMat = new THREE.MeshStandardMaterial({
      map: surfaceTexture,
      roughness: data.mainClass === 'GAS_ICE_GIANT' ? 0.3 : palette?.patternStyle === 'CRYSTAL_FACETS' ? 0.25 : 0.78,
      metalness: data.mainClass === 'METALLIC_ORE' ? 0.42 : palette?.patternStyle === 'CYBER_GRID' ? 0.55 : 0.12,
      emissive: emissiveStr > 0.2 ? new THREE.Color(palette?.glow || data.atmosphereColor) : new THREE.Color(0x000000),
      emissiveIntensity: emissiveStr * 0.28,
      flatShading: false,
    });

    const sphereGeo = new THREE.SphereGeometry(radius, 48, 36);
    this.surfaceMesh = new THREE.Mesh(sphereGeo, surfaceMat);
    this.group.add(this.surfaceMesh);

    // 2. Atmospheric Fresnel Glow Sphere
    if (data.atmosphereDensity > 0.05) {
      const atmoGeo = new THREE.SphereGeometry(radius * 1.06, 36, 24);
      const atmoMat = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;
          uniform vec3 uColor;
          uniform float uDensity;
          void main() {
            vec3 viewDir = normalize(-vPosition);
            float rim = 1.0 - max(0.0, dot(vNormal, viewDir));
            float intensity = pow(rim, 2.5) * uDensity * 1.4;
            gl_FragColor = vec4(uColor, intensity);
          }
        `,
        uniforms: {
          uColor: { value: new THREE.Color(data.atmosphereColor) },
          uDensity: { value: Math.min(1.2, data.atmosphereDensity * 1.5) },
        },
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      this.atmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
      this.group.add(this.atmosphereMesh);
    }

    // 3. Clouds Layer
    if (palette?.hasClouds || data.mainClass === 'LIVING_BIOSPHERE' || data.mainClass === 'HYDROSPHERE') {
      const cloudGeo = new THREE.SphereGeometry(radius * 1.02, 36, 28);
      const cloudMat = new THREE.MeshStandardMaterial({
        color: palette ? new THREE.Color(palette.accent) : 0xffffff,
        transparent: true,
        opacity: 0.28,
        roughness: 1.0,
        wireframe: false,
      });
      this.cloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
      this.group.add(this.cloudsMesh);
    }

    // 4. Planetary Rings
    if (palette?.hasRings || data.mainClass === 'GAS_ICE_GIANT') {
      const ringGeo = new THREE.RingGeometry(radius * 1.4, radius * 2.35, 64);
      const ringMat = new THREE.MeshStandardMaterial({
        color: palette ? new THREE.Color(palette.glow) : 0x93c5fd,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.52,
        roughness: 0.65,
      });
      this.ringsMesh = new THREE.Mesh(ringGeo, ringMat);
      this.ringsMesh.rotation.x = Math.PI / 2.3;
      this.ringsMesh.rotation.y = 0.2;
      this.group.add(this.ringsMesh);
    }

    // 5. Orbital Synchronous Horizon Ring
    const orbitRingGeo = new THREE.BufferGeometry();
    const orbitPoints: THREE.Vector3[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      orbitPoints.push(new THREE.Vector3(Math.cos(theta) * this.orbitalRadius, 0, Math.sin(theta) * this.orbitalRadius));
    }
    orbitRingGeo.setFromPoints(orbitPoints);
    const orbitRingMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 1.5,
      gapSize: 1.0,
      transparent: true,
      opacity: 0.45,
    });
    this.orbitalBeaconRing = new THREE.LineLoop(orbitRingGeo, orbitRingMat);
    this.orbitalBeaconRing.computeLineDistances();
    this.group.add(this.orbitalBeaconRing);
  }

  /**
   * Generates a procedural 512x256 planet surface texture on a canvas.
   */
  private generateProceduralTexture(data: PlanetData): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const seed = data.textureSeed || 101;
    const mc = data.mainClass;
    const pal = data.planetPalette;

    const baseColor = pal?.base || '#334155';
    const bandColor1 = pal?.band1 || '#1e293b';
    const bandColor2 = pal?.band2 || '#475569';
    const accentColor = pal?.accent || '#94a3b8';
    const glowColor = pal?.glow || accentColor;
    const patternStyle = pal?.patternStyle || (
      mc === 'PYRO_TECTONIC' ? 'MAGMA_FISSURE' :
      mc === 'GAS_ICE_GIANT' ? 'BANDED' :
      mc === 'LIVING_BIOSPHERE' || mc === 'HYDROSPHERE' ? 'ARCHIPELAGO' :
      mc === 'PRECURSOR_ANOMALOUS' ? 'PRECURSOR_GLYPH' :
      mc === 'FUNGAL_MYCELIAL' ? 'MYCELIAL_WEB' :
      mc === 'SYNTHETIC_CYBERNETIC' ? 'CYBER_GRID' :
      mc === 'CRYSTALLINE_GEM' ? 'CRYSTAL_FACETS' : 'CRATERED'
    );

    // Fill base
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle latitude bands
    const bands = patternStyle === 'BANDED' ? 20 : 8;
    for (let i = 0; i < bands; i++) {
      const y = (canvas.height / bands) * i;
      const h = canvas.height / bands;
      ctx.fillStyle = (i + seed) % 2 === 0 ? bandColor1 : bandColor2;
      ctx.globalAlpha = patternStyle === 'BANDED' ? 0.72 : 0.35;
      ctx.fillRect(0, y, canvas.width, h);
    }

    // Specialized procedural terrain/pattern synthesis
    if (patternStyle === 'MAGMA_FISSURE') {
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 24; i++) {
        let cx = ((seed * (i + 3) * 41) % canvas.width);
        let cy = ((seed * (i + 5) * 29) % canvas.height);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        for (let s = 0; s < 5; s++) {
          cx += (((seed + i * 7 + s * 13) % 36) - 18);
          cy += (((seed + i * 11 + s * 19) % 28) - 14);
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
    } else if (patternStyle === 'CRYSTAL_FACETS') {
      for (let i = 0; i < 42; i++) {
        const cx = (seed * (i + 1) * 53) % canvas.width;
        const cy = (seed * (i + 1) * 31) % canvas.height;
        const r = 10 + ((seed + i * 17) % 24);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = i % 2 === 0 ? accentColor : glowColor;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.8, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r * 0.8, cy);
        ctx.closePath();
        ctx.fill();
      }
    } else if (patternStyle === 'MYCELIAL_WEB') {
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 30; i++) {
        const cx = (seed * (i + 2) * 47) % canvas.width;
        const cy = (seed * (i + 3) * 61) % canvas.height;
        ctx.beginPath();
        ctx.arc(cx, cy, 4 + (i % 7), 0, Math.PI * 2);
        ctx.fillStyle = accentColor;
        ctx.fill();
        const nx = (seed * (i + 5) * 47) % canvas.width;
        const ny = (seed * (i + 6) * 61) % canvas.height;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
    } else if (patternStyle === 'CYBER_GRID' || patternStyle === 'PRECURSOR_GLYPH') {
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 22; i++) {
        const x = ((seed * (i + 1) * 59) % (canvas.width - 36)) + 8;
        const y = ((seed * (i + 2) * 43) % (canvas.height - 36)) + 8;
        const w = 14 + ((seed + i * 9) % 28);
        const h = 10 + ((seed + i * 13) % 22);
        ctx.strokeRect(x, y, w, h);
        if (patternStyle === 'PRECURSOR_GLYPH') {
          ctx.beginPath();
          ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (patternStyle === 'CRATERED') {
      for (let i = 0; i < 34; i++) {
        const px = (seed * (i + 1) * 37) % canvas.width;
        const py = (seed * (i + 1) * 73) % canvas.height;
        const pr = 6 + ((seed * (i + 1)) % 20);
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = bandColor1;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
    }

    // Procedural atmosphere / biome noise patches
    ctx.globalAlpha = 0.32;
    for (let i = 0; i < 36; i++) {
      const px = ((seed * (i + 1) * 37) % canvas.width);
      const py = ((seed * (i + 1) * 73) % canvas.height);
      const pr = 15 + ((seed * (i + 1)) % 35);
      const grad = ctx.createRadialGradient(px, py, 2, px, py, pr);
      grad.addColorStop(0, accentColor);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  public update(delta: number): void {
    // Surface axial rotation
    this.surfaceMesh.rotation.y += delta * 0.08;

    // Cloud drift
    if (this.cloudsMesh) {
      this.cloudsMesh.rotation.y += delta * 0.12;
      this.cloudsMesh.rotation.x = Math.sin(Date.now() * 0.0005) * 0.05;
    }

    // Ring slow wobble
    if (this.ringsMesh) {
      this.ringsMesh.rotation.z += delta * 0.02;
    }

    // Pulse beacon ring opacity
    const pulse = 0.3 + 0.2 * Math.sin(Date.now() * 0.003);
    (this.orbitalBeaconRing.material as THREE.LineDashedMaterial).opacity = pulse;
  }

  public getDistanceTo(playerPos: THREE.Vector3): number {
    return this.position.distanceTo(playerPos);
  }

  public isOrbitalProximity(playerPos: THREE.Vector3): boolean {
    return this.getDistanceTo(playerPos) <= this.orbitalRadius;
  }
}
