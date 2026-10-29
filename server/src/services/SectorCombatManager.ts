import type { WebSocket } from 'ws';
import { LootGenerator } from './LootGenerator';
import { outfittingService } from './OutfittingService';
import { ContractService } from './ContractService';

export const contractService = new ContractService();

export interface CombatInputs {
  forward: boolean;
  reverse: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  brake: boolean;
  firePrimary: boolean;
  fireTactical: boolean;
  activeWeaponId?: 'PULSE' | 'PLASMA' | 'FLAK';
}

export interface SectorLootContainer {
  id: string;
  x: number;
  z: number;
  title: string;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  items: any[];
  createdAt: number;
}

export interface SectorEntity {
  id: string;
  type: 'PLAYER' | 'DRONE' | 'WRECK' | 'CARGO_CRATE' | 'SCAVENGER';
  factionId: string;
  name: string;
  hullClass: string;
  hullSeed: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;             // Facing angle in radians
  angularVelocity: number;
  hp: number;
  maxHp: number;
  shields: number;
  maxShields: number;
  energy: number;
  maxEnergy: number;
  powerGridMax: number;    // MW
  powerGridUsed: number;
  cpuMax: number;          // tf
  cpuUsed: number;
  state: 'IDLE' | 'PATROL' | 'ENGAGE' | 'SCAVENGE' | 'FLEE' | 'DESTROYED';
  inputs: CombatInputs;
  lastHitTime: number;
  fireCooldown: number;
  afterburnerActive?: boolean;
  loadout?: any;
  energyRegenRate?: number;
  // Day 14 Death & Escape Pod
  isEscapePod?: boolean;
  lifeSupportSeconds?: number;
  weaponsDisabled?: boolean;
  // AI Scavenger specific
  aiPatrolCenter?: { x: number; z: number };
  aiPatrolAngle?: number;
  lootedCargo?: any[];
  transponderActive?: boolean;
  targetCanisterId?: string | null;
  scoopCooldown?: number;
}

export interface Projectile {
  id: string;
  ownerId: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  damage: number;
  ttl: number; // Seconds remaining
  color: string;
  projType?: 'PULSE' | 'PLASMA' | 'FLAK';
}

export interface CombatEvent {
  type: 'HIT' | 'SHIELD_BREAK' | 'DESTROYED' | 'LOOT_SPAWNED' | 'LOOT_COLLECTED' | 'POD_EJECTED';
  sourceId?: string;
  targetId?: string;
  damage?: number;
  hitShield?: boolean;
  x?: number;
  z?: number;
  data?: any;
}

export interface SnapshotPayload {
  type: 'TICK_SNAPSHOT';
  sectorId: number;
  serverTime: number;
  tick: number;
  entities: Array<{
    id: string;
    type: string;
    factionId: string;
    name: string;
    hullClass: string;
    hullSeed: number;
    x: number;
    z: number;
    vx: number;
    vz: number;
    yaw: number;
    hp: number;
    maxHp: number;
    shields: number;
    maxShields: number;
    energy: number;
    maxEnergy: number;
    powerGridMax: number;
    powerGridUsed: number;
    cpuMax: number;
    cpuUsed: number;
    state: string;
    transponderActive?: boolean;
  }>;
  projectiles: Array<{
    id: string;
    ownerId: string;
    x: number;
    z: number;
    vx: number;
    vz: number;
    color: string;
    projType?: 'PULSE' | 'PLASMA' | 'FLAK';
    damage?: number;
  }>;
  containers: Array<{
    id: string;
    x: number;
    z: number;
    title: string;
    rarity: string;
    items: any[];
  }>;
  events: CombatEvent[];
}

export class SectorRoom {
  public readonly sectorId: number;
  public readonly clients: Map<string, WebSocket> = new Map();
  public readonly entities: Map<string, SectorEntity> = new Map();
  public projectiles: Projectile[] = [];
  public containers: SectorLootContainer[] = [];
  public pendingEvents: CombatEvent[] = [];

  private tickInterval: NodeJS.Timeout | null = null;
  private lastTickTimestamp: number = Date.now();
  private tickCount: number = 0;
  private projectileSeq: number = 0;

  constructor(sectorId: number) {
    this.sectorId = sectorId;
    this.seedSectorEntities();
  }

  /**
   * Spawns initial sector environment: Sector 2 gets Hegemony Interceptor drones
   */
  private seedSectorEntities(): void {
    if (this.sectorId === 2) {
      // Spawn autonomous Hegemony Patrol Drone in Void Expanse Hazard Zone
      const droneId = 'drone_vaelic_patrol_01';
      this.entities.set(droneId, {
        id: droneId,
        type: 'DRONE',
        factionId: 'FACTION_VAELIC',
        name: 'Vaelic Interdictor Omega',
        hullClass: 'HEGEMONY_INTERCEPTOR',
        hullSeed: 98765,
        x: 35.0,
        z: -25.0,
        vx: 0,
        vz: 0,
        yaw: Math.PI / 4,
        angularVelocity: 0,
        hp: 120,
        maxHp: 120,
        shields: 80,
        maxShields: 80,
        energy: 100,
        maxEnergy: 100,
        powerGridMax: 95,
        powerGridUsed: 65,
        cpuMax: 140,
        cpuUsed: 90,
        state: 'PATROL',
        inputs: {
          forward: false,
          reverse: false,
          turnLeft: false,
          turnRight: false,
          brake: false,
          firePrimary: false,
          fireTactical: false,
        },
        lastHitTime: 0,
        fireCooldown: 0,
        aiPatrolCenter: { x: 20.0, z: -20.0 },
        aiPatrolAngle: 0,
        lootedCargo: [],
        transponderActive: false,
      });

      // Spawn persistent AI Scavenger in Sector 2 Void Expanse
      this.entities.set('scavenger_salvage_01', {
        id: 'scavenger_salvage_01',
        type: 'SCAVENGER',
        factionId: 'Scavenger Guild',
        name: 'Vulture-01 [Scavenger Guild]',
        hullClass: 'SCAVENGER_VULTURE',
        hullSeed: 4421,
        x: -25.0,
        z: 20.0,
        vx: 0,
        vz: 0,
        yaw: 0,
        angularVelocity: 0,
        hp: 95,
        maxHp: 95,
        shields: 40,
        maxShields: 40,
        energy: 100,
        maxEnergy: 100,
        powerGridMax: 80,
        powerGridUsed: 50,
        cpuMax: 100,
        cpuUsed: 60,
        state: 'SCAVENGE',
        inputs: {
          forward: false,
          reverse: false,
          turnLeft: false,
          turnRight: false,
          brake: false,
          firePrimary: false,
          fireTactical: false,
        },
        lastHitTime: 0,
        fireCooldown: 0,
        aiPatrolCenter: { x: -10.0, z: 10.0 },
        aiPatrolAngle: 0,
        lootedCargo: [
          { name: 'Titanium Scrap', quantity: 12, category: 'COMMODITY', unitValue: 90 },
          { name: 'Micro-Thruster Components', quantity: 6, category: 'COMMODITY', unitValue: 140 },
        ],
        transponderActive: true,
        scoopCooldown: 0,
      });

      // Spawn initial orbital salvage canister in Sector 2 Void Expanse
      this.containers.push({
        id: 'canister_sec2_orbital_cache',
        x: 18.0,
        z: -12.0,
        title: 'Derelict Cargo Canister [SECTOR 2]',
        rarity: 'RARE',
        items: [
          {
            blueprintId: 'MOD_PLASMA_01',
            customName: 'Prototype Heavy Plasma Accelerator',
            name: 'Vaelic Heavy Plasma Accelerator',
            rarity: 'RARE',
            category: 'WEAPON',
            slotType: 'HIGH',
            manufacturer: 'Vaelic Ironworks',
            energyCost: 35,
            cpuCost: 55,
            affixes: [
              { stat: 'damage', multiplier: 1.18, description: '+18% Plasma Thermal Yield' }
            ]
          },
          { name: 'Composite Alloy Scrap', quantity: 24, category: 'COMMODITY', unitValue: 120 }
        ],
        createdAt: Date.now()
      });
    }
  }

  public addPlayer(playerId: string, socket: WebSocket, shipData?: any): void {
    this.clients.set(playerId, socket);

    const entityId = `player_${playerId}`;
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, {
        id: entityId,
        type: 'PLAYER',
        factionId: 'FACTION_SOL',
        name: 'Cmdr. Vance',
        hullClass: shipData?.hull_class || 'CORVETTE',
        hullSeed: shipData?.hull_seed || 12345,
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        yaw: 0,
        angularVelocity: 0,
        hp: shipData?.armor || 100,
        maxHp: shipData?.max_armor || 100,
        shields: shipData?.shield || 100,
        maxShields: shipData?.max_shield || 100,
        energy: 100,
        maxEnergy: 100,
        powerGridMax: 120,
        powerGridUsed: 75,
        cpuMax: 180,
        cpuUsed: 110,
        state: 'IDLE',
        inputs: {
          forward: false,
          reverse: false,
          turnLeft: false,
          turnRight: false,
          brake: false,
          firePrimary: false,
          fireTactical: false,
        },
        lastHitTime: 0,
        fireCooldown: 0,
      });
    }

    if (!this.tickInterval) {
      this.startTickLoop();
    }
  }

  public removePlayer(playerId: string): void {
    this.clients.delete(playerId);
    this.entities.delete(`player_${playerId}`);

    // If no players remain in this sector, put the sector room to sleep
    const hasPlayers = Array.from(this.entities.values()).some((e) => e.type === 'PLAYER');
    if (!hasPlayers && this.tickInterval) {
      this.stopTickLoop();
    }
  }

  public setPlayerInput(playerId: string, inputs: CombatInputs): void {
    const entity = this.entities.get(`player_${playerId}`);
    if (entity && entity.state !== 'DESTROYED') {
      entity.inputs = { ...inputs };
    }
  }

  private startTickLoop(): void {
    this.lastTickTimestamp = Date.now();
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 50); // 20 Hz = 50ms
  }

  private stopTickLoop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * 20Hz Kinematic, AI & Combat Tick
   */
  public tick(): void {
    const now = Date.now();
    const dt = Math.min((now - this.lastTickTimestamp) / 1000, 0.1); // Clamp max dt to 100ms
    this.lastTickTimestamp = now;
    this.tickCount++;

    // 1. Process Drone & Scavenger AI
    this.processDroneAI(dt);
    this.processScavengerAI(dt);

    // 2. Integrate Kinematics for all living vessels
    for (const entity of this.entities.values()) {
      if (entity.state === 'DESTROYED') continue;
      this.integrateEntityPhysics(entity, dt, now);
    }

    // 3. Process Weapon Discharges
    for (const entity of this.entities.values()) {
      if (entity.state === 'DESTROYED') continue;
      if (entity.fireCooldown > 0) {
        entity.fireCooldown = Math.max(0, entity.fireCooldown - dt);
      }

      // Escape pods and vessels with weapons disabled cannot fire
      if (entity.weaponsDisabled || entity.isEscapePod || entity.hullClass === 'ESCAPE_POD') {
        continue;
      }

      if (entity.inputs.firePrimary && entity.fireCooldown <= 0 && entity.energy >= 10) {
        this.dischargePrimaryWeapon(entity);
      }
    }

    // 4. Advance Projectiles and Check Hit Collisions
    this.advanceProjectiles(dt);

    // 5. Broadcast 50ms Snapshot to Connected Clients
    this.broadcastSnapshot(now);
  }

  private integrateEntityPhysics(entity: SectorEntity, dt: number, now: number): void {
    const isEscapePod = entity.isEscapePod || entity.hullClass === 'ESCAPE_POD';
    let accel = isEscapePod ? 8.0 : entity.type === 'DRONE' ? 18.0 : entity.type === 'SCAVENGER' ? 14.0 : 22.0;
    const turnAccel = isEscapePod ? 2.0 : entity.type === 'SCAVENGER' ? 2.8 : 3.6;
    let maxSpeed = isEscapePod ? 13.0 : entity.type === 'DRONE' ? 24.0 : entity.type === 'SCAVENGER' ? 18.0 : 28.0;

    // Day 14: Emergency Life Support countdown for Escape Pods
    if (isEscapePod && typeof entity.lifeSupportSeconds === 'number') {
      entity.lifeSupportSeconds = Math.max(0, entity.lifeSupportSeconds - dt);
      if (entity.lifeSupportSeconds <= 0 && entity.state !== 'DESTROYED') {
        entity.state = 'DESTROYED';
        this.pendingEvents.push({
          type: 'LIFE_SUPPORT_EXHAUSTED',
          targetId: entity.id,
          x: entity.x,
          z: entity.z,
        });
      }
    }

    // Tactical Afterburner Overdrive (Shift key)
    const wantsAfterburner = entity.inputs.fireTactical && !isEscapePod && entity.energy >= 3.0;
    if (wantsAfterburner) {
      accel *= 2.2;
      maxSpeed = entity.type === 'DRONE' ? 42.0 : 48.0;
      entity.energy = Math.max(0, entity.energy - 38.0 * dt);
      entity.afterburnerActive = true;
    } else {
      entity.afterburnerActive = false;
    }

    // Angular Steering
    if (entity.inputs.turnLeft) {
      entity.angularVelocity += turnAccel * dt;
    }
    if (entity.inputs.turnRight) {
      entity.angularVelocity -= turnAccel * dt;
    }
    entity.angularVelocity *= 0.88; // Angular drag
    entity.yaw += entity.angularVelocity * dt;

    // Normalizing facing direction vector (0 radians is +Z direction in Three.js)
    const forwardX = Math.sin(entity.yaw);
    const forwardZ = Math.cos(entity.yaw);

    // Linear Thrust
    if (entity.inputs.forward) {
      entity.vx += forwardX * accel * dt;
      entity.vz += forwardZ * accel * dt;
    }
    if (entity.inputs.reverse) {
      entity.vx -= forwardX * (accel * 0.55) * dt;
      entity.vz -= forwardZ * (accel * 0.55) * dt;
    }

    // Dampening / Friction
    if (entity.inputs.brake) {
      entity.vx *= 0.94;
      entity.vz *= 0.94;
    } else {
      entity.vx *= 0.992;
      entity.vz *= 0.992;
    }

    // Speed Clamp
    const currentSpeed = Math.sqrt(entity.vx * entity.vx + entity.vz * entity.vz);
    if (currentSpeed > maxSpeed) {
      const scale = maxSpeed / currentSpeed;
      entity.vx *= scale;
      entity.vz *= scale;
    }

    // Positional Integration
    entity.x += entity.vx * dt;
    entity.z += entity.vz * dt;

    // Passive Energy Capacitor Regeneration (+22/sec)
    if (entity.energy < entity.maxEnergy) {
      entity.energy = Math.min(entity.maxEnergy, entity.energy + 22.0 * dt);
    }

    // Passive Shield Regeneration (+6/sec if unhit for 3.5s)
    if (now - entity.lastHitTime > 3500 && entity.shields < entity.maxShields) {
      entity.shields = Math.min(entity.maxShields, entity.shields + 6.0 * dt);
    }
  }

  private processDroneAI(dt: number): void {
    // Locate nearest active player ship in sector
    let targetPlayer: SectorEntity | null = null;
    let minDistance = Infinity;

    for (const entity of this.entities.values()) {
      if (entity.type === 'PLAYER' && entity.state !== 'DESTROYED') {
        const dist = Math.sqrt(entity.x * entity.x + entity.z * entity.z);
        if (dist < minDistance) {
          minDistance = dist;
          targetPlayer = entity;
        }
      }
    }

    for (const drone of this.entities.values()) {
      if (drone.type !== 'DRONE' || drone.state === 'DESTROYED') continue;

      if (targetPlayer && minDistance < 140.0) {
        // ENGAGE MODE: Orbital strafing & predictive dogfight
        drone.state = 'ENGAGE';
        const dx = targetPlayer.x - drone.x;
        const dz = targetPlayer.z - drone.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Predictive Lead Aiming Calculation
        const projSpeed = 55.0; // Drone projectile speed
        const timeToHit = Math.min(dist / projSpeed, 1.8);
        const leadX = targetPlayer.x + targetPlayer.vx * timeToHit;
        const leadZ = targetPlayer.z + targetPlayer.vz * timeToHit;
        const aimDx = leadX - drone.x;
        const aimDz = leadZ - drone.z;
        const desiredYaw = Math.atan2(aimDx, aimDz);

        // Turn towards predictive lead point
        let yawDiff = desiredYaw - drone.yaw;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

        drone.inputs.turnLeft = yawDiff > 0.06;
        drone.inputs.turnRight = yawDiff < -0.06;

        // Tactical Afterburner Counter-Burst if player gets behind drone (< 28u)
        const isPlayerBehind = dist < 28.0 && Math.abs(yawDiff) > Math.PI * 0.6;
        drone.inputs.fireTactical = isPlayerBehind && drone.energy > 35;

        // Orbital strafing navigation: Maintain optimal combat distance (~32-46u)
        if (dist > 46.0) {
          drone.inputs.forward = true;
          drone.inputs.reverse = false;
          drone.inputs.brake = false;
        } else if (dist < 28.0) {
          drone.inputs.forward = false;
          drone.inputs.reverse = true;
          drone.inputs.brake = false;
        } else {
          // In sweet spot (28-46u): tangential thrust to circle around target
          drone.inputs.forward = true;
          drone.inputs.reverse = false;
          drone.inputs.brake = false;
        }

        // Fire when facing target lead cone (< 0.28 rad) and in range (< 85 units)
        drone.inputs.firePrimary = Math.abs(yawDiff) < 0.28 && dist < 85.0;
      } else {
        // PATROL MODE: Orbit sector patrol center
        drone.state = 'PATROL';
        drone.inputs.firePrimary = false;
        drone.inputs.fireTactical = false;
        drone.aiPatrolAngle = (drone.aiPatrolAngle || 0) + 0.3 * dt;
        const radius = 28.0;
        const center = drone.aiPatrolCenter || { x: 20, z: -20 };
        const targetX = center.x + Math.sin(drone.aiPatrolAngle) * radius;
        const targetZ = center.z + Math.cos(drone.aiPatrolAngle) * radius;

        const dx = targetX - drone.x;
        const dz = targetZ - drone.z;
        const desiredYaw = Math.atan2(dx, dz);

        let yawDiff = desiredYaw - drone.yaw;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

        drone.inputs.turnLeft = yawDiff > 0.1;
        drone.inputs.turnRight = yawDiff < -0.1;
        drone.inputs.forward = true;
        drone.inputs.brake = false;
      }
    }
  }

  private processScavengerAI(dt: number): void {
    for (const scavenger of this.entities.values()) {
      if (scavenger.type !== 'SCAVENGER' || scavenger.state === 'DESTROYED') continue;

      scavenger.scoopCooldown = Math.max(0, (scavenger.scoopCooldown || 0) - dt);

      // Search for nearest container within 85u
      let nearestContainer: SectorLootContainer | null = null;
      let minContainerDist = Infinity;

      for (const container of this.containers) {
        const dx = container.x - scavenger.x;
        const dz = container.z - scavenger.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < minContainerDist && dist < 85.0) {
          minContainerDist = dist;
          nearestContainer = container;
        }
      }

      if (nearestContainer) {
        scavenger.state = 'SCAVENGE';
        scavenger.targetCanisterId = nearestContainer.id;

        const dx = nearestContainer.x - scavenger.x;
        const dz = nearestContainer.z - scavenger.z;
        const desiredYaw = Math.atan2(dx, dz);

        let yawDiff = desiredYaw - scavenger.yaw;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

        scavenger.inputs.turnLeft = yawDiff > 0.08;
        scavenger.inputs.turnRight = yawDiff < -0.08;
        scavenger.inputs.forward = true;
        scavenger.inputs.brake = false;

        // Scooping proximity check (< 8.0 units)
        if (minContainerDist <= 8.0 && scavenger.scoopCooldown <= 0) {
          scavenger.scoopCooldown = 2.5;
          const targetId = nearestContainer.id;
          const idx = this.containers.findIndex((c) => c.id === targetId);
          if (idx !== -1) {
            const scooped = this.containers.splice(idx, 1)[0];
            scavenger.lootedCargo = scavenger.lootedCargo || [];
            scavenger.lootedCargo.push(...scooped.items);

            this.pendingEvents.push({
              type: 'CONTAINER_SCOOPED',
              sourceId: scavenger.id,
              canisterId: scooped.id,
              title: scooped.title,
              x: scavenger.x,
              z: scavenger.z,
              data: {
                scavengerName: scavenger.name,
                canisterId: scooped.id,
                title: scooped.title,
              },
            });
          }
        }
      } else {
        // Patrol orbit around center
        scavenger.state = 'PATROL';
        scavenger.targetCanisterId = null;
        scavenger.aiPatrolAngle = (scavenger.aiPatrolAngle || 0) + 0.25 * dt;
        const radius = 35.0;
        const center = scavenger.aiPatrolCenter || { x: -10, z: 10 };
        const targetX = center.x + Math.sin(scavenger.aiPatrolAngle) * radius;
        const targetZ = center.z + Math.cos(scavenger.aiPatrolAngle) * radius;

        const dx = targetX - scavenger.x;
        const dz = targetZ - scavenger.z;
        const desiredYaw = Math.atan2(dx, dz);

        let yawDiff = desiredYaw - scavenger.yaw;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

        scavenger.inputs.turnLeft = yawDiff > 0.1;
        scavenger.inputs.turnRight = yawDiff < -0.1;
        scavenger.inputs.forward = true;
        scavenger.inputs.brake = false;
      }
    }
  }

  private dischargePrimaryWeapon(entity: SectorEntity): void {
    if (entity.type === 'DRONE' || entity.type === 'SCAVENGER') {
      entity.energy -= 12.0;
      entity.fireCooldown = 0.35;
      const forwardX = Math.sin(entity.yaw);
      const forwardZ = Math.cos(entity.yaw);
      const muzzleSpeed = 55.0;

      this.projectiles.push({
        id: `proj_${++this.projectileSeq}_${Date.now()}`,
        ownerId: entity.id,
        x: entity.x + forwardX * 3.8,
        z: entity.z + forwardZ * 3.8,
        vx: entity.vx * 0.3 + forwardX * muzzleSpeed,
        vz: entity.vz * 0.3 + forwardZ * muzzleSpeed,
        damage: 16,
        ttl: 1.6,
        color: '#ff2a5f',
        projType: 'PULSE',
      });
      return;
    }

    const weaponId = (entity.inputs.activeWeaponId as 'PULSE' | 'PLASMA' | 'FLAK') || 'PULSE';
    const forwardX = Math.sin(entity.yaw);
    const forwardZ = Math.cos(entity.yaw);

    if (weaponId === 'PLASMA') {
      if (entity.energy < 22) return;
      entity.energy -= 22;
      entity.fireCooldown = 0.45;
      const muzzleSpeed = 48.0;

      this.projectiles.push({
        id: `proj_${++this.projectileSeq}_${Date.now()}`,
        ownerId: entity.id,
        x: entity.x + forwardX * 4.2,
        z: entity.z + forwardZ * 4.2,
        vx: entity.vx * 0.3 + forwardX * muzzleSpeed,
        vz: entity.vz * 0.3 + forwardZ * muzzleSpeed,
        damage: 44,
        ttl: 2.2,
        color: '#10b981',
        projType: 'PLASMA',
      });
    } else if (weaponId === 'FLAK') {
      if (entity.energy < 18) return;
      entity.energy -= 18;
      entity.fireCooldown = 0.35;
      const muzzleSpeed = 66.0;
      const spreadAngles = [-0.12, 0.0, 0.12];

      for (const offset of spreadAngles) {
        const spreadYaw = entity.yaw + offset;
        const fx = Math.sin(spreadYaw);
        const fz = Math.cos(spreadYaw);
        this.projectiles.push({
          id: `proj_${++this.projectileSeq}_${Date.now()}`,
          ownerId: entity.id,
          x: entity.x + fx * 3.8,
          z: entity.z + fz * 3.8,
          vx: entity.vx * 0.3 + fx * muzzleSpeed,
          vz: entity.vz * 0.3 + fz * muzzleSpeed,
          damage: 13,
          ttl: 1.2,
          color: '#fbbf24',
          projType: 'FLAK',
        });
      }
    } else {
      // PULSE (default)
      if (entity.energy < 8) return;
      entity.energy -= 8;
      entity.fireCooldown = 0.16;
      const muzzleSpeed = 78.0;

      this.projectiles.push({
        id: `proj_${++this.projectileSeq}_${Date.now()}`,
        ownerId: entity.id,
        x: entity.x + forwardX * 3.8,
        z: entity.z + forwardZ * 3.8,
        vx: entity.vx * 0.3 + forwardX * muzzleSpeed,
        vz: entity.vz * 0.3 + forwardZ * muzzleSpeed,
        damage: 14,
        ttl: 1.6,
        color: '#00f0ff',
        projType: 'PULSE',
      });
    }
  }

  private advanceProjectiles(dt: number): void {
    const livingProjectiles: Projectile[] = [];

    for (const proj of this.projectiles) {
      proj.x += proj.vx * dt;
      proj.z += proj.vz * dt;
      proj.ttl -= dt;

      if (proj.ttl <= 0) continue;

      let hit = false;
      // Check collision with living entities
      for (const entity of this.entities.values()) {
        if (entity.id === proj.ownerId || entity.state === 'DESTROYED') continue;

        const dx = entity.x - proj.x;
        const dz = entity.z - proj.z;
        const distSq = dx * dx + dz * dz;
        const hitRadius = entity.hullClass === 'ESCAPE_POD' ? 2.0 : 3.8;

        if (distSq < hitRadius * hitRadius) {
          hit = true;
          this.applyDamage(entity, proj);
          break;
        }
      }

      if (!hit) {
        livingProjectiles.push(proj);
      }
    }

    this.projectiles = livingProjectiles;
  }

  private applyDamage(target: SectorEntity, proj: Projectile): void {
    target.lastHitTime = Date.now();
    let damageRemaining = proj.damage;
    const hadShields = target.shields > 0;
    let hitShield = false;

    // Shields absorb damage first
    if (target.shields > 0) {
      hitShield = true;
      if (target.shields >= damageRemaining) {
        target.shields -= damageRemaining;
        damageRemaining = 0;
      } else {
        damageRemaining -= target.shields;
        target.shields = 0;
      }
    }

    // Did shields break on this hit?
    if (hadShields && target.shields === 0) {
      this.pendingEvents.push({
        type: 'SHIELD_BREAK',
        targetId: target.id,
        x: target.x,
        z: target.z,
      });
    }

    // Hull integrity absorbs remainder
    if (damageRemaining > 0 && target.hullClass !== 'ESCAPE_POD') {
      target.hp = Math.max(0, target.hp - damageRemaining);
    }

    this.pendingEvents.push({
      type: 'HIT',
      sourceId: proj.ownerId,
      targetId: target.id,
      damage: proj.damage,
      hitShield,
      x: proj.x,
      z: proj.z,
    });

    // Check Destruction
    if (target.hp <= 0 && target.state !== 'DESTROYED') {
      this.handleEntityDestruction(target, proj.ownerId);
    }
  }

  private handleEntityDestruction(target: SectorEntity, killerId: string): void {
    target.state = 'DESTROYED';

    this.pendingEvents.push({
      type: 'DESTROYED',
      targetId: target.id,
      sourceId: killerId,
      x: target.x,
      z: target.z,
    });

    if (target.type === 'PLAYER') {
      const killer = this.entities.get(killerId);
      const killerName = killer ? killer.name : 'Hegemony Hunter Drone [ELITE]';
      const playerId = target.id.replace('player_', '');

      // Hardcore death: Player ejects into Emergency Escape Pod!
      this.pendingEvents.push({
        type: 'POD_EJECTED',
        targetId: target.id,
        x: target.x,
        z: target.z,
      });

      // Record permanent Killmail in DB and notify socket
      contractService.createKillmail(
        playerId,
        killerId,
        killerName,
        this.sectorId,
        18500,
        [
          { name: 'Composite Alloy Scrap', quantity: 24, unitValue: 120 },
          { name: 'Compacted Hydrocarbon Slag', quantity: 15, unitValue: 75 }
        ],
        [
          { name: 'Sol-Standard Pulse Cannon', slot: 'H1' },
          { name: 'Overdrive Afterburner Core', slot: 'M1' }
        ]
      ).then((km) => {
        const clientSocket = this.clients.get(playerId);
        if (clientSocket && clientSocket.readyState === 1) {
          clientSocket.send(JSON.stringify({
            type: 'KILLMAIL_NOTIFICATION',
            killmail: km,
          }));
        }
      }).catch((err) => {
        console.error('[Combat] Error logging killmail:', err);
      });

      // Spawn Player Wreck Debris Canister in Sector
      const wreckContainerId = `loot_player_wreck_${Date.now()}`;
      this.containers.push({
        id: wreckContainerId,
        x: Math.round(target.x * 10) / 10,
        z: Math.round(target.z * 10) / 10,
        title: `${target.name} Debris Canister`,
        rarity: 'RARE',
        items: [
          { name: 'Vessel Wreckage Scrap', quantity: 30, category: 'COMMODITY', unitValue: 110 },
          { name: 'Compacted Hydrocarbon Slag', quantity: 15, category: 'COMMODITY', unitValue: 75 }
        ],
        createdAt: Date.now(),
      });

      // Transform entity into Escape Pod
      target.hullClass = 'ESCAPE_POD';
      target.hullSeed = 777;
      target.hp = 25;
      target.maxHp = 25;
      target.shields = 0;
      target.maxShields = 0;
      target.state = 'IDLE';
      target.powerGridMax = 0;
      target.powerGridUsed = 0;
      target.cpuMax = 0;
      target.cpuUsed = 0;
      target.vx *= 0.15;
      target.vz *= 0.15;
      target.isEscapePod = true;
      target.lifeSupportSeconds = 300; // 5 minute countdown
      target.weaponsDisabled = true;
    } else if (target.type === 'SCAVENGER') {
      // Scavenger vessel destroyed: Drop all accumulated looted cargo plus bonus core in an EPIC cache
      const containerId = `loot_scavenger_${Date.now()}`;
      const droppedItems = (target.lootedCargo && target.lootedCargo.length > 0)
        ? [...target.lootedCargo]
        : [{ name: 'Titanium Scrap', quantity: 18, category: 'COMMODITY', unitValue: 90 }];

      droppedItems.push({
        name: 'Vulture Salvage Core',
        category: 'VALUABLE',
        quantity: 1,
        unitValue: 850
      });

      const container: SectorLootContainer = {
        id: containerId,
        x: Math.round(target.x * 10) / 10,
        z: Math.round(target.z * 10) / 10,
        title: `${target.name} Salvage Manifest`,
        rarity: 'EPIC',
        items: droppedItems,
        createdAt: Date.now(),
      };

      this.containers.push(container);
      this.pendingEvents.push({
        type: 'LOOT_SPAWNED',
        targetId: containerId,
        x: target.x,
        z: target.z,
        data: {
          containerId,
          title: container.title,
          rarity: container.rarity,
          items: container.items,
        },
      });
    } else if (target.type === 'DRONE') {
      // Spawn persistent 3D Loot Container in Sector
      outfittingService.getCatalog().then((catalog) => {
        const drop = LootGenerator.generateDrop(catalog);
        const containerId = `loot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        const container: SectorLootContainer = {
          id: containerId,
          x: Math.round(target.x * 10) / 10,
          z: Math.round(target.z * 10) / 10,
          title: `${target.name.split(' ')[0]} Salvage Canister`,
          rarity: drop.rarity,
          items: [
            drop,
            { name: 'Composite Alloy Scrap', quantity: 18, category: 'COMMODITY', unitValue: 120 },
          ],
          createdAt: Date.now(),
        };

        this.containers.push(container);
        this.pendingEvents.push({
          type: 'LOOT_SPAWNED',
          targetId: containerId,
          x: target.x,
          z: target.z,
          data: {
            containerId,
            title: container.title,
            rarity: container.rarity,
            items: container.items,
          },
        });
      }).catch((err) => {
        console.error('[COMBAT] Error generating loot drop:', err);
      });
    }
  }

  public async lootContainer(playerId: string, containerId: string): Promise<any> {
    const cIdx = this.containers.findIndex((c) => c.id === containerId);
    if (cIdx < 0) return null;

    const container = this.containers[cIdx];
    const pEntity = this.entities.get(`player_${playerId}`);
    if (!pEntity) return null;

    const dist = Math.hypot(pEntity.x - container.x, pEntity.z - container.z);
    if (dist > 35) return null;

    for (const item of container.items) {
      if (item.blueprintId) {
        await outfittingService.addLootToPlayer(playerId, item);
      }
    }

    this.containers.splice(cIdx, 1);
    this.pendingEvents.push({
      type: 'LOOT_COLLECTED',
      targetId: pEntity.id,
      x: container.x,
      z: container.z,
      data: {
        containerId,
        title: container.title,
        items: container.items,
      },
    });

    return container.items;
  }

  private broadcastSnapshot(now: number): void {
    if (this.clients.size === 0) return;

    const payload: SnapshotPayload = {
      type: 'TICK_SNAPSHOT',
      sectorId: this.sectorId,
      serverTime: now,
      tick: this.tickCount,
      entities: Array.from(this.entities.values()).map((e) => ({
        id: e.id,
        type: e.type,
        factionId: e.factionId,
        name: e.name,
        hullClass: e.hullClass,
        hullSeed: e.hullSeed,
        x: Math.round(e.x * 100) / 100,
        z: Math.round(e.z * 100) / 100,
        vx: Math.round(e.vx * 100) / 100,
        vz: Math.round(e.vz * 100) / 100,
        yaw: Math.round(e.yaw * 1000) / 1000,
        hp: Math.round(e.hp),
        maxHp: e.maxHp,
        shields: Math.round(e.shields),
        maxShields: e.maxShields,
        energy: Math.round(e.energy),
        maxEnergy: e.maxEnergy,
        powerGridMax: e.powerGridMax,
        powerGridUsed: e.powerGridUsed,
        cpuMax: e.cpuMax,
        cpuUsed: e.cpuUsed,
        state: e.state,
        afterburnerActive: e.afterburnerActive,
        transponderActive: e.transponderActive,
        // Day 14 Death & Scavenger Telemetry
        isEscapePod: e.isEscapePod || e.hullClass === 'ESCAPE_POD',
        lifeSupportSeconds: typeof e.lifeSupportSeconds === 'number' ? Math.round(e.lifeSupportSeconds) : undefined,
        targetCanisterId: e.targetCanisterId,
      })),
      projectiles: this.projectiles.map((p) => ({
        id: p.id,
        ownerId: p.ownerId,
        x: Math.round(p.x * 10) / 10,
        z: Math.round(p.z * 10) / 10,
        vx: Math.round(p.vx * 10) / 10,
        vz: Math.round(p.vz * 10) / 10,
        color: p.color,
        projType: p.projType || 'PULSE',
        damage: p.damage,
      })),
      containers: this.containers.map((c) => ({
        id: c.id,
        x: c.x,
        z: c.z,
        title: c.title,
        rarity: c.rarity,
        items: c.items,
      })),
      events: [...this.pendingEvents],
    };

    this.pendingEvents = [];
    const json = JSON.stringify(payload);

    for (const client of this.clients.values()) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(json);
      }
    }
  }

  public resetPlayerFrigate(playerId: string, shipData?: any): void {
    const entity = this.entities.get(`player_${playerId}`);
    if (entity) {
      entity.hullClass = shipData?.hull_class || 'CORVETTE';
      entity.hp = shipData?.armor || 100;
      entity.maxHp = shipData?.max_armor || 100;
      entity.shields = shipData?.shield || 100;
      entity.maxShields = shipData?.max_shield || 100;
      entity.energy = 100;
      entity.maxEnergy = 100;
      entity.powerGridMax = 120;
      entity.powerGridUsed = 75;
      entity.cpuMax = 180;
      entity.cpuUsed = 110;
      entity.state = 'IDLE';
      entity.isEscapePod = false;
      entity.weaponsDisabled = false;
      entity.lifeSupportSeconds = undefined;
    }
  }
}

/**
 * Singleton Sector Combat Manager managing rooms across all sectors
 */
export class SectorCombatManager {
  private rooms: Map<number, SectorRoom> = new Map();

  public getOrCreateRoom(sectorId: number): SectorRoom {
    let room = this.rooms.get(sectorId);
    if (!room) {
      room = new SectorRoom(sectorId);
      this.rooms.set(sectorId, room);
    }
    return room;
  }

  public resetPlayerFrigate(sectorId: number, playerId: string, shipData?: any): void {
    const room = this.rooms.get(sectorId);
    if (room) {
      room.resetPlayerFrigate(playerId, shipData);
    }
  }

  public handleConnection(socket: WebSocket, sectorId: number, playerId: string, shipData?: any): void {
    const room = this.getOrCreateRoom(sectorId);
    room.addPlayer(playerId, socket, shipData);

    socket.on('message', (data: string | Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'INPUT') {
          room.setPlayerInput(playerId, msg.inputs);
        } else if (msg.type === 'LOOT_CONTAINER') {
          room.lootContainer(playerId, msg.containerId);
        }
      } catch (err) {
        // Ignore malformed client frames
      }
    });

    socket.on('close', () => {
      room.removePlayer(playerId);
    });
  }
}

export const combatManager = new SectorCombatManager();
