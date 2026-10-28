import type { WebSocket } from 'ws';

export interface CombatInputs {
  forward: boolean;
  reverse: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  brake: boolean;
  firePrimary: boolean;
  fireTactical: boolean;
}

export interface SectorEntity {
  id: string;
  type: 'PLAYER' | 'DRONE' | 'WRECK' | 'CARGO_CRATE';
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
  // AI specific
  aiPatrolCenter?: { x: number; z: number };
  aiPatrolAngle?: number;
  lootedCargo?: any[];
  transponderActive?: boolean;
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
}

export interface CombatEvent {
  type: 'HIT' | 'DESTROYED' | 'LOOT_SPAWNED' | 'LOOT_COLLECTED' | 'POD_EJECTED';
  sourceId?: string;
  targetId?: string;
  damage?: number;
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
  }>;
  events: CombatEvent[];
}

export class SectorRoom {
  public readonly sectorId: number;
  public readonly clients: Map<string, WebSocket> = new Map();
  public readonly entities: Map<string, SectorEntity> = new Map();
  public projectiles: Projectile[] = [];
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

    // 1. Process Drone AI
    this.processDroneAI(dt);

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
    const isEscapePod = entity.hullClass === 'ESCAPE_POD';
    const accel = isEscapePod ? 9.0 : entity.type === 'DRONE' ? 18.0 : 22.0;
    const turnAccel = isEscapePod ? 2.2 : 3.6;
    const maxSpeed = isEscapePod ? 12.0 : entity.type === 'DRONE' ? 24.0 : 28.0;

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

      if (targetPlayer && minDistance < 130.0) {
        // ENGAGE MODE: Intercept and dogfight
        drone.state = 'ENGAGE';
        const dx = targetPlayer.x - drone.x;
        const dz = targetPlayer.z - drone.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const desiredYaw = Math.atan2(dx, dz);

        // Turn towards player
        let yawDiff = desiredYaw - drone.yaw;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

        drone.inputs.turnLeft = yawDiff > 0.08;
        drone.inputs.turnRight = yawDiff < -0.08;

        // Thrust if farther than 45 units, brake if too close (< 25 units)
        drone.inputs.forward = dist > 45.0;
        drone.inputs.brake = dist < 25.0;
        drone.inputs.reverse = dist < 18.0;

        // Fire if facing target within cone (< 0.35 rad) and in range (< 85 units)
        drone.inputs.firePrimary = Math.abs(yawDiff) < 0.35 && dist < 85.0;
      } else {
        // PATROL MODE: Orbit sector patrol center
        drone.state = 'PATROL';
        drone.inputs.firePrimary = false;
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

  private dischargePrimaryWeapon(entity: SectorEntity): void {
    entity.energy -= 12.0;
    entity.fireCooldown = entity.type === 'DRONE' ? 0.38 : 0.22; // Seconds between rounds

    const forwardX = Math.sin(entity.yaw);
    const forwardZ = Math.cos(entity.yaw);
    const muzzleSpeed = 68.0; // Units/second

    const projId = `proj_${++this.projectileSeq}_${Date.now()}`;
    const projectile: Projectile = {
      id: projId,
      ownerId: entity.id,
      x: entity.x + forwardX * 3.8,
      z: entity.z + forwardZ * 3.8,
      vx: entity.vx * 0.4 + forwardX * muzzleSpeed,
      vz: entity.vz * 0.4 + forwardZ * muzzleSpeed,
      damage: entity.type === 'DRONE' ? 14 : 20,
      ttl: 1.6, // Lifespan in seconds
      color: entity.factionId === 'FACTION_VAELIC' ? '#ff2a5f' : '#00f0ff',
    };

    this.projectiles.push(projectile);
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

    // Shields absorb damage first
    if (target.shields > 0) {
      if (target.shields >= damageRemaining) {
        target.shields -= damageRemaining;
        damageRemaining = 0;
      } else {
        damageRemaining -= target.shields;
        target.shields = 0;
      }
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
      x: target.x,
      z: target.z,
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
      // Hardcore death: Player ejects into Indestructible Escape Pod!
      this.pendingEvents.push({
        type: 'POD_EJECTED',
        targetId: target.id,
        x: target.x,
        z: target.z,
      });

      // Transform entity into Escape Pod
      target.hullClass = 'ESCAPE_POD';
      target.hullSeed = 777;
      target.hp = 50;
      target.maxHp = 50;
      target.shields = 0;
      target.maxShields = 0;
      target.state = 'IDLE';
      target.powerGridMax = 0;
      target.powerGridUsed = 0;
      target.cpuMax = 0;
      target.cpuUsed = 0;
      target.vx *= 0.2;
      target.vz *= 0.2;
    }
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
        transponderActive: e.transponderActive,
      })),
      projectiles: this.projectiles.map((p) => ({
        id: p.id,
        ownerId: p.ownerId,
        x: Math.round(p.x * 10) / 10,
        z: Math.round(p.z * 10) / 10,
        vx: Math.round(p.vx * 10) / 10,
        vz: Math.round(p.vz * 10) / 10,
        color: p.color,
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

  public handleConnection(socket: WebSocket, sectorId: number, playerId: string, shipData?: any): void {
    const room = this.getOrCreateRoom(sectorId);
    room.addPlayer(playerId, socket, shipData);

    socket.on('message', (data: string | Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'INPUT') {
          room.setPlayerInput(playerId, msg.inputs);
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
