import * as THREE from 'three';
import { PRNG } from '../procgen/PRNG';

export interface ServerAsteroidState {
  id: string;
  x: number;
  z: number;
  radius: number;
  seed: number;
  oreCommodityId: string;
  oreName: string;
  emissiveHex: string;
  tier: string;
  hp: number;
  maxHp: number;
  remainingYield: number;
  maxYield: number;
  depleted: boolean;
  heatState: 'NORMAL' | 'VENT_CHARGING' | 'COOLED';
}

interface AsteroidVisualItem {
  id: string;
  mesh: THREE.Mesh;
  ring: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  ringMat: THREE.MeshBasicMaterial;
  rotSpeed: THREE.Vector3;
  baseEmissiveHex: number;
  state: ServerAsteroidState | null;
}

/**
 * Asteroid belt renderer synchronized 1:1 with authoritative server SectorRoom nodes,
 * supporting spectral vein coloring, fracture dimming, depletion hide/respawn,
 * thermal vent charging pulses, and click-target raycasting.
 */
export class AsteroidField {
  public group: THREE.Group;
  private asteroids: AsteroidVisualItem[] = [];
  private byId: Map<string, AsteroidVisualItem> = new Map();
  private pulseClock: number = 0;

  constructor(seed: number = 202, count: number = 42) {
    this.group = new THREE.Group();
    this.group.name = 'SectorAsteroidField';

    const prng = new PRNG(seed);

    for (let i = 0; i < count; i++) {
      const radius = prng.range(1.8, 7.2);
      const isOreVein = prng.chance(0.28);
      const angle = prng.nextFloat() * Math.PI * 2;
      const dist = prng.range(30, 115);

      this.spawnVisualAsteroid(
        `local_ast_${i}`,
        Math.cos(angle) * dist,
        Math.sin(angle) * dist,
        radius,
        seed + i * 31,
        isOreVein ? 0x38bdf8 : 0x5a6375,
        isOreVein ? 0.35 : 0.05,
        null
      );
    }

    // Add central navigation beacon / ore extraction buoy
    const buoyGeom = new THREE.OctahedronGeometry(2.5, 0);
    const buoyMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.8,
      wireframe: true,
    });
    const buoy = new THREE.Mesh(buoyGeom, buoyMat);
    buoy.position.set(0, 0, 0);
    this.group.add(buoy);
  }

  private createAsteroidGeometry(radius: number, seed: number): THREE.DodecahedronGeometry {
    const prng = new PRNG(seed || 101);
    const detail = prng.chance(0.5) ? 1 : 0;
    const geom = new THREE.DodecahedronGeometry(radius, detail);
    const posAttr = geom.getAttribute('position');
    const v = new THREE.Vector3();
    for (let j = 0; j < posAttr.count; j++) {
      v.fromBufferAttribute(posAttr, j);
      v.multiplyScalar(prng.range(0.78, 1.22));
      posAttr.setXYZ(j, v.x, v.y, v.z);
    }
    geom.computeVertexNormals();
    return geom;
  }

  private spawnVisualAsteroid(
    id: string,
    x: number,
    z: number,
    radius: number,
    seed: number,
    emissiveHex: number,
    emissiveIntensity: number,
    state: ServerAsteroidState | null
  ): AsteroidVisualItem {
    const geom = this.createAsteroidGeometry(radius, seed);
    const mat = new THREE.MeshStandardMaterial({
      color: state && state.tier !== 'COMMON' ? 0x475569 : 0x5a6375,
      emissive: emissiveHex,
      emissiveIntensity,
      roughness: 0.72,
      metalness: state && state.tier !== 'COMMON' ? 0.55 : 0.25,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, 0, z);
    mesh.userData = { asteroidId: id };

    const prng = new PRNG(seed + 7);
    mesh.rotation.set(prng.nextFloat() * Math.PI, prng.nextFloat() * Math.PI, prng.nextFloat() * Math.PI);

    const ringGeom = new THREE.RingGeometry(radius + 0.9, radius + 1.5, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: emissiveHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, -0.4, z);

    const rotSpeed = new THREE.Vector3(
      prng.range(-0.0006, 0.0006),
      prng.range(-0.0008, 0.0008),
      prng.range(-0.0006, 0.0006)
    );

    const item: AsteroidVisualItem = {
      id,
      mesh,
      ring,
      material: mat,
      ringMat,
      rotSpeed,
      baseEmissiveHex: emissiveHex,
      state,
    };

    this.asteroids.push(item);
    this.byId.set(id, item);
    this.group.add(mesh);
    this.group.add(ring);
    return item;
  }

  private clearProceduralPlaceholders(): void {
    const toRemove = this.asteroids.filter((a) => a.id.startsWith('local_ast_'));
    if (toRemove.length === 0) return;
    for (const item of toRemove) {
      this.group.remove(item.mesh);
      this.group.remove(item.ring);
      item.mesh.geometry.dispose();
      item.material.dispose();
      item.ring.geometry.dispose();
      item.ringMat.dispose();
      this.byId.delete(item.id);
    }
    this.asteroids = this.asteroids.filter((a) => !a.id.startsWith('local_ast_'));
  }

  public syncFromServer(serverAsteroids: ServerAsteroidState[]): void {
    if (!Array.isArray(serverAsteroids) || serverAsteroids.length === 0) return;
    this.clearProceduralPlaceholders();

    for (const ast of serverAsteroids) {
      const emissiveColor = parseInt((ast.emissiveHex || '#38bdf8').replace('#', ''), 16) || 0x38bdf8;
      let visual = this.byId.get(ast.id);

      if (!visual) {
        visual = this.spawnVisualAsteroid(
          ast.id,
          ast.x,
          ast.z,
          ast.radius,
          ast.seed,
          emissiveColor,
          ast.tier === 'COMMON' ? 0.18 : 0.48,
          ast
        );
      } else {
        visual.state = ast;
        visual.mesh.position.set(ast.x, 0, ast.z);
        visual.ring.position.set(ast.x, -0.4, ast.z);
        visual.baseEmissiveHex = emissiveColor;
      }

      visual.mesh.visible = !ast.depleted;
      visual.ring.visible = !ast.depleted;

      if (!ast.depleted) {
        const hpRatio = ast.maxHp > 0 ? Math.max(0.2, ast.hp / ast.maxHp) : 1;
        const yieldRatio = ast.maxYield > 0 ? Math.max(0.55, 0.55 + 0.45 * (ast.remainingYield / ast.maxYield)) : 1;
        visual.mesh.scale.setScalar(yieldRatio);

        if (ast.heatState === 'VENT_CHARGING') {
          visual.material.emissive.setHex(0xf97316);
          visual.ringMat.color.setHex(0xef4444);
          visual.ringMat.opacity = 0.8;
        } else {
          visual.material.emissive.setHex(emissiveColor);
          const tierBoost = ast.tier === 'EXOTIC' ? 0.72 : ast.tier === 'EPIC' ? 0.55 : ast.tier === 'RARE' ? 0.42 : 0.2;
          visual.material.emissiveIntensity = tierBoost * hpRatio;
        }
      }
    }
  }

  public getInteractableMeshes(): THREE.Object3D[] {
    return this.asteroids.filter((a) => a.mesh.visible && a.state !== null).map((a) => a.mesh);
  }

  public getAsteroids(): ServerAsteroidState[] {
    return this.asteroids.map((a) => a.state).filter((s): s is ServerAsteroidState => s !== null);
  }

  public getAsteroidById(id: string | null): ServerAsteroidState | null {
    if (!id) return null;
    return this.byId.get(id)?.state || null;
  }

  public update(deltaSec: number, targetedAsteroidId: string | null = null, miningAsteroidId: string | null = null): void {
    this.pulseClock += deltaSec;
    for (const item of this.asteroids) {
      item.mesh.rotation.x += item.rotSpeed.x * (deltaSec * 60);
      item.mesh.rotation.y += item.rotSpeed.y * (deltaSec * 60);
      item.mesh.rotation.z += item.rotSpeed.z * (deltaSec * 60);

      if (!item.mesh.visible) continue;
      const isVent = item.state?.heatState === 'VENT_CHARGING';
      const isTargeted = item.id === targetedAsteroidId;
      const isMining = item.id === miningAsteroidId;

      if (isVent) {
        const pulse = 0.45 + 0.45 * Math.sin(this.pulseClock * 16);
        item.material.emissiveIntensity = 0.7 + pulse * 0.8;
        item.ringMat.color.setHex(0xef4444);
        item.ringMat.opacity = 0.35 + pulse * 0.6;
        item.ring.scale.setScalar(1 + pulse * 0.25);
      } else if (isMining) {
        item.ringMat.color.setHex(0x22d3ee);
        item.ringMat.opacity = 0.65 + 0.25 * Math.sin(this.pulseClock * 10);
        item.ring.scale.setScalar(1.08);
      } else if (isTargeted) {
        item.ringMat.color.setHex(item.baseEmissiveHex);
        item.ringMat.opacity = 0.75;
        item.ring.scale.setScalar(1.0);
      } else {
        item.ringMat.opacity = 0;
      }
    }
  }

  public dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
