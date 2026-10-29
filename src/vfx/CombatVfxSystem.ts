import * as THREE from 'three';

interface CombatSpark {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  g: number;
  b: number;
  life: number;
  maxLife: number;
  active: boolean;
}

/**
 * 3D Forcefield Shield Bubble with Hexagonal Impact Flare
 */
export class ShieldBubble {
  public mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private flareOpacity: number = 0;
  private rotationSpeed: number = 0.8;

  constructor(radius: number = 4.2, isEnemy: boolean = false) {
    const geometry = new THREE.IcosahedronGeometry(radius, 2);
    const color = isEnemy ? 0xff2a5f : 0x38bdf8;

    this.material = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
  }

  public triggerImpact(isEnemy: boolean = false): void {
    this.flareOpacity = 0.85;
    this.material.color.setHex(isEnemy ? 0xff2a5f : 0x00f0ff);
  }

  public triggerShieldBreak(): void {
    this.flareOpacity = 1.0;
    this.material.color.setHex(0xffffff); // White blinding flash on shatter
  }

  public update(dt: number, position: THREE.Vector3, shields: number, maxShields: number): void {
    this.mesh.position.copy(position);
    this.mesh.rotation.y += this.rotationSpeed * dt;
    this.mesh.rotation.x += this.rotationSpeed * 0.5 * dt;

    if (this.flareOpacity > 0) {
      this.flareOpacity = Math.max(0, this.flareOpacity - dt * 3.8); // Fades in ~250ms
    }

    const shieldPct = maxShields > 0 ? (shields / maxShields) * 100 : 0;

    // Critical shield flicker if low (< 22%)
    let baseOpacity = 0.0;
    if (shieldPct > 0 && shieldPct < 22) {
      baseOpacity = Math.random() < 0.35 ? 0.2 : 0.02;
    }

    this.material.opacity = Math.max(baseOpacity, this.flareOpacity);
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * High-performance GPU particle system for electromagnetic shield deflections & molten hull breaches
 */
export class CombatVfxSystem {
  public mesh: THREE.Points;
  private readonly maxParticles = 600;
  private particles: CombatSpark[] = [];
  private positions: Float32Array;
  private colors: Float32Array;

  constructor() {
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
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
        r: 1,
        g: 1,
        b: 1,
        life: 0,
        maxLife: 0.3,
        active: false,
      });
    }
  }

  /**
   * Emits energetic cyan/blue sparks when shields deflect incoming ordnance
   */
  public emitShieldSparks(pos: THREE.Vector3, count: number = 14): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.x = pos.x + (Math.random() - 0.5) * 0.8;
        p.y = pos.y + (Math.random() - 0.5) * 0.8;
        p.z = pos.z + (Math.random() - 0.5) * 0.8;

        const speed = 12.0 + Math.random() * 18.0;
        const angle = Math.random() * Math.PI * 2;
        p.vx = Math.cos(angle) * speed;
        p.vy = (Math.random() - 0.5) * speed * 0.5;
        p.vz = Math.sin(angle) * speed;

        p.r = 0.2;
        p.g = 0.8 + Math.random() * 0.2;
        p.b = 1.0;
        p.life = 0;
        p.maxLife = 0.18 + Math.random() * 0.12;

        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  /**
   * Emits fiery orange/yellow molten debris when hull armor is breached
   */
  public emitHullBreachSparks(pos: THREE.Vector3, count: number = 22): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.x = pos.x + (Math.random() - 0.5) * 1.2;
        p.y = pos.y + (Math.random() - 0.5) * 1.2;
        p.z = pos.z + (Math.random() - 0.5) * 1.2;

        const speed = 16.0 + Math.random() * 26.0;
        const angle = Math.random() * Math.PI * 2;
        p.vx = Math.cos(angle) * speed;
        p.vy = (Math.random() - 0.3) * speed * 0.8;
        p.vz = Math.sin(angle) * speed;

        p.r = 1.0;
        p.g = 0.35 + Math.random() * 0.45;
        p.b = 0.05;
        p.life = 0;
        p.maxLife = 0.3 + Math.random() * 0.25;

        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  /**
   * Emits an expanding circular ring of electrical dissipation particles when shields break
   */
  public emitShieldBreakBurst(pos: THREE.Vector3, count: number = 36): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.x = pos.x;
        p.y = pos.y;
        p.z = pos.z;

        const speed = 25.0 + Math.random() * 15.0;
        const angle = (spawned / count) * Math.PI * 2;
        p.vx = Math.cos(angle) * speed;
        p.vy = (Math.random() - 0.5) * 4.0;
        p.vz = Math.sin(angle) * speed;

        p.r = 0.8;
        p.g = 0.95;
        p.b = 1.0;
        p.life = 0;
        p.maxLife = 0.4;

        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  /**
   * Emits high-energy explosion debris when a ship or drone is obliterated
   */
  public emitExplosionDebris(pos: THREE.Vector3, count: number = 55): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.x = pos.x + (Math.random() - 0.5) * 2.0;
        p.y = pos.y + (Math.random() - 0.5) * 2.0;
        p.z = pos.z + (Math.random() - 0.5) * 2.0;

        const speed = 20.0 + Math.random() * 32.0;
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() - 0.5) * Math.PI;

        p.vx = Math.cos(theta) * Math.cos(phi) * speed;
        p.vy = Math.sin(phi) * speed * 0.6;
        p.vz = Math.sin(theta) * Math.cos(phi) * speed;

        p.r = 1.0;
        p.g = 0.5 + Math.random() * 0.5;
        p.b = 0.1;
        p.life = 0;
        p.maxLife = 0.45 + Math.random() * 0.35;

        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  public update(dt: number): void {
    const posAttr = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = this.mesh.geometry.attributes.color as THREE.BufferAttribute;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        this.positions[i * 3 + 1] = -1000;
        continue;
      }

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.positions[i * 3 + 1] = -1000;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vx *= 0.92;
      p.vz *= 0.92;

      const progress = p.life / p.maxLife;
      const alpha = 1.0 - progress;

      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;

      this.colors[i * 3] = p.r * alpha;
      this.colors[i * 3 + 1] = p.g * alpha;
      this.colors[i * 3 + 2] = p.b * alpha;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }
}
