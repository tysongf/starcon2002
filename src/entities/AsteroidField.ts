import * as THREE from 'three';
import { PRNG } from '../procgen/PRNG';

/**
 * Procedural low-poly asteroid mineral field for Deep Void / Hazard Sectors
 */
export class AsteroidField {
  public group: THREE.Group;
  private asteroids: Array<{ mesh: THREE.Mesh; rotSpeed: THREE.Vector3 }> = [];

  constructor(seed: number = 202, count: number = 42) {
    this.group = new THREE.Group();
    this.group.name = 'SectorAsteroidField';

    const prng = new PRNG(seed);

    // Shared rock material with flat-shading for retro StarCon low-poly aesthetic
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a6375,
      roughness: 0.88,
      metalness: 0.15,
      flatShading: true,
    });

    const oreGlintMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.8,
      flatShading: true,
    });

    for (let i = 0; i < count; i++) {
      // Procedural radius from 1.5m to 8.5m
      const radius = prng.range(1.5, 8.5);
      const detail = prng.chance(0.5) ? 1 : 0;
      const geom = new THREE.DodecahedronGeometry(radius, detail);

      // Perturb vertices to create rugged asteroid craters and jagged ridges
      const posAttr = geom.getAttribute('position');
      const v = new THREE.Vector3();
      for (let j = 0; j < posAttr.count; j++) {
        v.fromBufferAttribute(posAttr, j);
        const noise = prng.range(0.78, 1.22);
        v.multiplyScalar(noise);
        posAttr.setXYZ(j, v.x, v.y, v.z);
      }
      geom.computeVertexNormals();

      // Some asteroids contain high-value crystalline ore veins
      const isOreVein = prng.chance(0.2);
      const mesh = new THREE.Mesh(geom, isOreVein ? oreGlintMaterial : rockMaterial);

      // Scatter in a donut / belt ring around origin (radius 28m to 110m)
      const angle = prng.nextFloat() * Math.PI * 2;
      const dist = prng.range(28, 110);
      const height = prng.range(-12, 12);

      mesh.position.set(
        Math.cos(angle) * dist,
        height,
        Math.sin(angle) * dist
      );

      mesh.rotation.set(
        prng.nextFloat() * Math.PI,
        prng.nextFloat() * Math.PI,
        prng.nextFloat() * Math.PI
      );

      const rotSpeed = new THREE.Vector3(
        prng.range(-0.0006, 0.0006),
        prng.range(-0.0008, 0.0008),
        prng.range(-0.0006, 0.0006)
      );

      this.asteroids.push({ mesh, rotSpeed });
      this.group.add(mesh);
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

  public update(deltaSec: number): void {
    for (const item of this.asteroids) {
      item.mesh.rotation.x += item.rotSpeed.x * (deltaSec * 60);
      item.mesh.rotation.y += item.rotSpeed.y * (deltaSec * 60);
      item.mesh.rotation.z += item.rotSpeed.z * (deltaSec * 60);
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
