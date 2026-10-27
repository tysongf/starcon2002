import * as THREE from 'three';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export class ThrusterParticleSystem {
  public mesh: THREE.Points;
  private readonly maxParticles = 400;
  private particles: Particle[] = [];
  private positions: Float32Array;
  private colors: Float32Array;
  private baseColor: THREE.Color = new THREE.Color(0x38bdf8);

  constructor() {
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.mesh = new THREE.Points(geometry, material);

    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: 0,
        y: -1000,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
        active: false,
      });
    }
  }

  public setGlowColor(hexColor: number): void {
    this.baseColor.setHex(hexColor);
  }

  /**
   * Spawns exhaust particles behind twin engine nozzles
   */
  public emitThrusterPlume(
    shipPos: THREE.Vector3,
    shipYaw: number,
    shipVelocity: THREE.Vector3,
    intensity: number = 1.0
  ): void {
    const forwardX = Math.sin(shipYaw);
    const forwardZ = Math.cos(shipYaw);
    const rightX = Math.cos(shipYaw);
    const rightZ = -Math.sin(shipYaw);

    // Twin engine exhaust nozzles (local offsets: x=±0.9, z=-4.2)
    const engineOffsets = [-0.9, 0.9];
    const spawnCountPerNozzle = Math.ceil(3 * intensity);

    for (const latOff of engineOffsets) {
      const nozzleX = shipPos.x + rightX * latOff - forwardX * 4.2;
      const nozzleY = shipPos.y;
      const nozzleZ = shipPos.z + rightZ * latOff - forwardZ * 4.2;

      for (let s = 0; s < spawnCountPerNozzle; s++) {
        const p = this.getFreeParticle();
        if (!p) break;

        // Spray velocity backwards opposite to forward vector with cone spread
        const spreadX = (Math.random() - 0.5) * 1.5;
        const spreadY = (Math.random() - 0.5) * 0.8;
        const spreadZ = (Math.random() - 0.5) * 1.5;

        const exhaustSpeed = 14.0 + Math.random() * 8.0;

        p.x = nozzleX + (Math.random() - 0.5) * 0.3;
        p.y = nozzleY + (Math.random() - 0.5) * 0.3;
        p.z = nozzleZ + (Math.random() - 0.5) * 0.3;

        p.vx = -forwardX * exhaustSpeed + shipVelocity.x * 0.3 + spreadX;
        p.vy = spreadY;
        p.vz = -forwardZ * exhaustSpeed + shipVelocity.z * 0.3 + spreadZ;

        p.life = 0;
        p.maxLife = 0.25 + Math.random() * 0.25;
        p.active = true;
      }
    }
  }

  /**
   * Spawns smaller RCS puffs when turning
   */
  public emitRcsPuff(
    shipPos: THREE.Vector3,
    shipYaw: number,
    direction: 'left' | 'right'
  ): void {
    const forwardX = Math.sin(shipYaw);
    const forwardZ = Math.cos(shipYaw);
    const rightX = Math.cos(shipYaw);
    const rightZ = -Math.sin(shipYaw);

    const sign = direction === 'left' ? 1 : -1;
    const rcsX = shipPos.x + rightX * (sign * 2.2) + forwardX * 2.0;
    const rcsZ = shipPos.z + rightZ * (sign * 2.2) + forwardZ * 2.0;

    for (let i = 0; i < 2; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.x = rcsX;
      p.y = shipPos.y;
      p.z = rcsZ;

      p.vx = -rightX * sign * 6.0 + (Math.random() - 0.5) * 1.0;
      p.vy = (Math.random() - 0.5) * 0.5;
      p.vz = -rightZ * sign * 6.0 + (Math.random() - 0.5) * 1.0;

      p.life = 0;
      p.maxLife = 0.15;
      p.active = true;
    }
  }

  private getFreeParticle(): Particle | null {
    for (let i = 0; i < this.maxParticles; i++) {
      if (!this.particles[i].active) {
        return this.particles[i];
      }
    }
    return null;
  }

  /**
   * Updates particle positions and buffer attributes
   */
  public update(deltaSec: number): void {
    const dt = Math.min(deltaSec, 0.1);
    let pIdx = 0;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.y = -1000; // Move offscreen
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
        }

        const progress = p.life / p.maxLife;
        const fade = Math.max(0, 1.0 - progress);

        this.positions[pIdx] = p.x;
        this.positions[pIdx + 1] = p.y;
        this.positions[pIdx + 2] = p.z;

        this.colors[pIdx] = this.baseColor.r * fade;
        this.colors[pIdx + 1] = this.baseColor.g * fade;
        this.colors[pIdx + 2] = this.baseColor.b * fade;
      } else {
        this.positions[pIdx] = 0;
        this.positions[pIdx + 1] = -1000;
        this.positions[pIdx + 2] = 0;

        this.colors[pIdx] = 0;
        this.colors[pIdx + 1] = 0;
        this.colors[pIdx + 2] = 0;
      }
      pIdx += 3;
    }

    const posAttr = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }
}
