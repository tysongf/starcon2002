import * as THREE from 'three';

export interface PlanetData {
  id: string;
  sectorId: number;
  name: string;
  archetype: 'TERRESTRIAL' | 'VOLCANIC' | 'BARREN' | 'GAS_GIANT' | 'PRECURSOR_RUIN';
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

    // 1. Surface Texture & Material
    const surfaceTexture = this.generateProceduralTexture(data);
    const surfaceMat = new THREE.MeshStandardMaterial({
      map: surfaceTexture,
      roughness: data.archetype === 'GAS_GIANT' ? 0.3 : 0.8,
      metalness: data.archetype === 'BARREN' ? 0.4 : 0.1,
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

    // 3. Clouds Layer for Terrestrial Biomes
    if (data.archetype === 'TERRESTRIAL') {
      const cloudGeo = new THREE.SphereGeometry(radius * 1.02, 36, 28);
      const cloudMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        roughness: 1.0,
        wireframe: false,
      });
      this.cloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
      this.group.add(this.cloudsMesh);
    }

    // 4. Cryo-Rings for Gas Giants
    if (data.archetype === 'GAS_GIANT') {
      const ringGeo = new THREE.RingGeometry(radius * 1.4, radius * 2.4, 64);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
        roughness: 0.7,
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
    const archetype = data.archetype;

    // Palette base
    let baseColor = '#334155';
    let bandColor1 = '#1e293b';
    let bandColor2 = '#475569';
    let accentColor = '#94a3b8';

    if (archetype === 'VOLCANIC') {
      baseColor = '#450a0a';
      bandColor1 = '#7f1d1d';
      bandColor2 = '#991b1b';
      accentColor = '#f97316';
    } else if (archetype === 'TERRESTRIAL') {
      baseColor = '#065f46';
      bandColor1 = '#047857';
      bandColor2 = '#15803d';
      accentColor = '#3b82f6';
    } else if (archetype === 'GAS_GIANT') {
      baseColor = '#1e3a8a';
      bandColor1 = '#0284c7';
      bandColor2 = '#38bdf8';
      accentColor = '#bae6fd';
    } else if (archetype === 'PRECURSOR_RUIN') {
      baseColor = '#3b0764';
      bandColor1 = '#581c87';
      bandColor2 = '#701a75';
      accentColor = '#f472b6';
    }

    // Fill base
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Horizontal latitude bands (especially for Gas Giants and Barren strata)
    const bands = archetype === 'GAS_GIANT' ? 18 : 10;
    for (let i = 0; i < bands; i++) {
      const y = (canvas.height / bands) * i;
      const h = canvas.height / bands;
      ctx.fillStyle = (i + seed) % 2 === 0 ? bandColor1 : bandColor2;
      ctx.globalAlpha = 0.65;
      ctx.fillRect(0, y, canvas.width, h);
    }

    // Procedural noise patches
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 40; i++) {
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

    // Reset alpha
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
