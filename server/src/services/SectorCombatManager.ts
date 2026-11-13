import type { WebSocket } from 'ws';
import { LootGenerator } from './LootGenerator';
import { outfittingService } from './OutfittingService';
import { ContractService } from './ContractService';
import { wreckService, SectorWreck } from './WreckService';
import { reputationService } from './ReputationService';

export const contractService = new ContractService();


export interface SectorWreckEntity {
  id: string;
  sectorId: number;
  shipName: string;
  shipClass: string;
  faction: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  rotation: number;
  scrapRemaining: number;
  maxScrap: number;
  hullIntactness: number;
  isTowed: boolean;
  towedByAccountId: string | null;
}

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
  type: 'PLAYER' | 'DRONE' | 'WRECK' | 'CARGO_CRATE' | 'SCAVENGER' | 'HAULER';
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
  state: 'IDLE' | 'PATROL' | 'ENGAGE' | 'TRUCE' | 'SCAVENGE' | 'FLEE' | 'DESTROYED';
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
  // Day 15 Towing & Salvage Mining
  towedWreckId?: string | null;
  miningWreckId?: string | null;
  miningTimer?: number;
  // Day 23 Faction Convoys, Formation AI & Warp Spooling
  isConvoyHauler?: boolean;
  convoyId?: string;
  escortIds?: string[];
  leaderId?: string;
  formationOffset?: { x: number; z: number };
  warpChargeRemaining?: number;
  isWarpSpooling?: boolean;
  isWarpInterrupted?: boolean;
  cargoManifest?: any[];
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
  type: 'HIT' | 'SHIELD_BREAK' | 'DESTROYED' | 'LOOT_SPAWNED' | 'LOOT_COLLECTED' | 'POD_EJECTED' | 'CONTAINER_SCOOPED' | 'WRECK_SPAWNED' | 'TOW_ATTACHED' | 'TOW_RELEASED' | 'SALVAGE_BEAM_TICK' | 'WRECK_DISINTEGRATED' | 'TRUCE_DECLARED' | 'TRUCE_BROKEN' | 'LIFE_SUPPORT_EXHAUSTED' | 'WARP_SPOOL_STARTED' | 'WARP_SPOOL_INTERRUPTED' | 'WARP_JUMP_SUCCESS';

  sourceId?: string;
  targetId?: string;
  damage?: number;
  hitShield?: boolean;
  x?: number;
  z?: number;
  data?: any;
  canisterId?: string;
  title?: string;
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
    afterburnerActive?: boolean;
    isEscapePod?: boolean;
    lifeSupportSeconds?: number;
    targetCanisterId?: string | null;
    towedWreckId?: string | null;
    isMiningWreckId?: string | null;
    // Day 23 Convoy & Formation
    isConvoyHauler?: boolean;
    convoyId?: string;
    leaderId?: string;
    warpChargeRemaining?: number;
    isWarpSpooling?: boolean;
    isWarpInterrupted?: boolean;
    cargoManifest?: any[];
  }>;
  convoys?: Array<{
    convoyId: string;
    name: string;
    factionId: string;
    haulerId: string;
    escortIds: string[];
    warpChargeRemaining: number;
    isWarpSpooling: boolean;
    isWarpInterrupted: boolean;
    cargoManifest: any[];
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
  wrecks: Array<{
    id: string;
    shipName: string;
    shipClass: string;
    faction: string;
    x: number;
    y: number;
    z: number;
    rotation: number;
    scrapRemaining: number;
    maxScrap: number;
    hullIntactness: number;
    isTowed: boolean;
    towedByAccountId: string | null;
  }>;
  events: CombatEvent[];
}

export class SectorRoom {
  public readonly sectorId: number;
  public readonly clients: Map<string, WebSocket> = new Map();
  public readonly entities: Map<string, SectorEntity> = new Map();
  public readonly wrecks: Map<string, SectorWreckEntity> = new Map();
  public projectiles: Projectile[] = [];
  public containers: SectorLootContainer[] = [];
  public pendingEvents: CombatEvent[] = [];

  private tickInterval: NodeJS.Timeout | null = null;
  private lastTickTimestamp: number = Date.now();
  private tickCount: number = 0;
  private projectileSeq: number = 0;
  private activeTruces: Map<string, number> = new Map(); // `${playerId}:${factionId}` -> expiryTimestamp

  public setTruce(playerId: string, factionId: string, durationMs: number = 300000): void {
    const normalized = factionId === 'FACTION_VAELIC' ? 'FACTION_HEGEMONY' : factionId;
    this.activeTruces.set(`${playerId}:${normalized}`, Date.now() + durationMs);
    this.pendingEvents.push({
      type: 'TRUCE_DECLARED',
      sourceId: playerId,
      targetId: normalized,
      data: { factionId: normalized, durationMs, expiresAt: Date.now() + durationMs },
    });
  }

  public clearTruce(playerId: string, factionId: string): void {
    const normalized = factionId === 'FACTION_VAELIC' ? 'FACTION_HEGEMONY' : factionId;
    this.activeTruces.delete(`${playerId}:${normalized}`);
  }

  public isTruceActive(playerId: string, factionId: string): boolean {
    const normalized = factionId === 'FACTION_VAELIC' ? 'FACTION_HEGEMONY' : factionId;
    const expiry = this.activeTruces.get(`${playerId}:${normalized}`);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.activeTruces.delete(`${playerId}:${normalized}`);
      return false;
    }
    return true;
  }

  constructor(sectorId: number) {
    this.sectorId = sectorId;
    this.seedSectorEntities();
  }

  public reseedEntities(): void {
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

      // Day 15: Seed initial persistent sector wrecks
      this.wrecks.set('wreck_ancient_cruiser_01', {
        id: 'wreck_ancient_cruiser_01',
        sectorId: 2,
        shipName: 'Derelict Hegemony Cruiser',
        shipClass: 'Hegemony Vanguard',
        faction: 'Hegemony Drone Fleet',
        x: 35.0,
        y: 0.0,
        z: -45.0,
        vx: 0.0,
        vz: 0.0,
        rotation: 0.78,
        scrapRemaining: 250,
        maxScrap: 250,
        hullIntactness: 0.85,
        isTowed: false,
        towedByAccountId: null,
      });

      this.wrecks.set('wreck_freighter_derelict_02', {
        id: 'wreck_freighter_derelict_02',
        sectorId: 2,
        shipName: 'Shattered Bulk Hauler Wreck',
        shipClass: 'Mammoth Industrial',
        faction: 'Independent Traders',
        x: -50.0,
        y: 0.0,
        z: 25.0,
        vx: 0.0,
        vz: 0.0,
        rotation: 2.35,
        scrapRemaining: 180,
        maxScrap: 180,
        hullIntactness: 0.60,
        isTowed: false,
        towedByAccountId: null,
      });

      // Day 23: Spawn persistent Vaelic Imperial Tithe Convoy with 2 Escort Wingmen
      this.entities.set('hauler_hegemony_tithe_01', {
        id: 'hauler_hegemony_tithe_01',
        type: 'HAULER',
        factionId: 'FACTION_VAELIC',
        name: 'Vaelic Imperial Tithe Carrier IX',
        hullClass: 'HEGEMONY_TITHE_CARRIER',
        hullSeed: 77123,
        x: 15.0,
        z: -35.0,
        vx: 0,
        vz: 3.0,
        yaw: 0,
        angularVelocity: 0,
        hp: 300,
        maxHp: 300,
        shields: 200,
        maxShields: 200,
        energy: 200,
        maxEnergy: 200,
        powerGridMax: 220,
        powerGridUsed: 140,
        cpuMax: 300,
        cpuUsed: 180,
        state: 'PATROL',
        inputs: {
          forward: true,
          reverse: false,
          turnLeft: false,
          turnRight: false,
          brake: false,
          firePrimary: false,
          fireTactical: false,
        },
        lastHitTime: 0,
        fireCooldown: 0,
        isConvoyHauler: true,
        convoyId: 'convoy_hegemony_tithe_01',
        escortIds: ['escort_hegemony_01', 'escort_hegemony_02'],
        warpChargeRemaining: 30.0,
        isWarpSpooling: false,
        isWarpInterrupted: false,
        cargoManifest: [
          { commodityId: 'COMM_ORE', name: 'Silicate Ore', quantity: 40, unitValue: 70 },
          { commodityId: 'COMM_ALLOY', name: 'Plasteel Alloy', quantity: 25, unitValue: 150 },
        ],
      });

      this.entities.set('escort_hegemony_01', {
        id: 'escort_hegemony_01',
        type: 'DRONE',
        factionId: 'FACTION_VAELIC',
        name: 'Vaelic Escort Alpha',
        hullClass: 'HEGEMONY_INTERCEPTOR',
        hullSeed: 88201,
        x: 3.0,
        z: -45.0,
        vx: 0,
        vz: 3.0,
        yaw: 0,
        angularVelocity: 0,
        hp: 100,
        maxHp: 100,
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
        leaderId: 'hauler_hegemony_tithe_01',
        formationOffset: { x: -12.0, z: -10.0 },
      });

      this.entities.set('escort_hegemony_02', {
        id: 'escort_hegemony_02',
        type: 'DRONE',
        factionId: 'FACTION_VAELIC',
        name: 'Vaelic Escort Beta',
        hullClass: 'HEGEMONY_INTERCEPTOR',
        hullSeed: 88202,
        x: 27.0,
        z: -45.0,
        vx: 0,
        vz: 3.0,
        yaw: 0,
        angularVelocity: 0,
        hp: 100,
        maxHp: 100,
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
        leaderId: 'hauler_hegemony_tithe_01',
        formationOffset: { x: 12.0, z: -10.0 },
      });
    } else if (this.sectorId === 1) {
      // Day 23: Spawn Sol-Perimeter Bulk Freighter Atlas with 2 Escorts
      this.entities.set('hauler_sol_freight_01', {
        id: 'hauler_sol_freight_01',
        type: 'HAULER',
        factionId: 'FACTION_SOL',
        name: 'Sol-Perimeter Bulk Freighter Atlas',
        hullClass: 'SOL_HEAVY_FREIGHTER',
        hullSeed: 66101,
        x: -20.0,
        z: 30.0,
        vx: 0,
        vz: 2.5,
        yaw: 0,
        angularVelocity: 0,
        hp: 280,
        maxHp: 280,
        shields: 180,
        maxShields: 180,
        energy: 200,
        maxEnergy: 200,
        powerGridMax: 200,
        powerGridUsed: 130,
        cpuMax: 280,
        cpuUsed: 160,
        state: 'PATROL',
        inputs: {
          forward: true,
          reverse: false,
          turnLeft: false,
          turnRight: false,
          brake: false,
          firePrimary: false,
          fireTactical: false,
        },
        lastHitTime: 0,
        fireCooldown: 0,
        isConvoyHauler: true,
        convoyId: 'convoy_sol_freight_01',
        escortIds: ['escort_sol_01', 'escort_sol_02'],
        warpChargeRemaining: 30.0,
        isWarpSpooling: false,
        isWarpInterrupted: false,
        cargoManifest: [
          { commodityId: 'COMM_RATIONS', name: 'Bio-Protein Rations', quantity: 50, unitValue: 35 },
          { commodityId: 'COMM_FUEL', name: 'Deuterium Fuel', quantity: 30, unitValue: 20 },
        ],
      });

      this.entities.set('escort_sol_01', {
        id: 'escort_sol_01',
        type: 'DRONE',
        factionId: 'FACTION_SOL',
        name: 'Sol Escort Shield-1',
        hullClass: 'SOL_INTERCEPTOR',
        hullSeed: 55101,
        x: -30.0,
        z: 20.0,
        vx: 0,
        vz: 2.5,
        yaw: 0,
        angularVelocity: 0,
        hp: 110,
        maxHp: 110,
        shields: 90,
        maxShields: 90,
        energy: 100,
        maxEnergy: 100,
        powerGridMax: 100,
        powerGridUsed: 70,
        cpuMax: 150,
        cpuUsed: 100,
        state: 'PATROL',
        inputs: { forward: false, reverse: false, turnLeft: false, turnRight: false, brake: false, firePrimary: false, fireTactical: false },
        lastHitTime: 0,
        fireCooldown: 0,
        leaderId: 'hauler_sol_freight_01',
        formationOffset: { x: -10.0, z: -10.0 },
      });

      this.entities.set('escort_sol_02', {
        id: 'escort_sol_02',
        type: 'DRONE',
        factionId: 'FACTION_SOL',
        name: 'Sol Escort Shield-2',
        hullClass: 'SOL_INTERCEPTOR',
        hullSeed: 55102,
        x: -10.0,
        z: 20.0,
        vx: 0,
        vz: 2.5,
        yaw: 0,
        angularVelocity: 0,
        hp: 110,
        maxHp: 110,
        shields: 90,
        maxShields: 90,
        energy: 100,
        maxEnergy: 100,
        powerGridMax: 100,
        powerGridUsed: 70,
        cpuMax: 150,
        cpuUsed: 100,
        state: 'PATROL',
        inputs: { forward: false, reverse: false, turnLeft: false, turnRight: false, brake: false, firePrimary: false, fireTactical: false },
        lastHitTime: 0,
        fireCooldown: 0,
        leaderId: 'hauler_sol_freight_01',
        formationOffset: { x: 10.0, z: -10.0 },
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
  public tick(customDt?: number): void {
    const now = Date.now();
    const dt = typeof customDt === 'number' ? customDt : Math.min((now - this.lastTickTimestamp) / 1000, 0.1); // Clamp max dt to 100ms
    this.lastTickTimestamp = now;
    this.tickCount++;

    // 1. Process Drone, Hauler & Scavenger AI
    this.processDroneAI(dt);
    this.processHaulerAI(dt);
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

    // 5. Day 15: Elastic Tow Cable Physics & Laser Salvage Mining
    this.processTowPhysics(dt);
    this.processSalvageMining(dt);

    // 6. Broadcast 50ms Snapshot to Connected Clients
    this.broadcastSnapshot(now);
  }

  public attachTow(playerId: string, wreckId: string): boolean {
    const pEntity = this.entities.get(`player_${playerId}`);
    const wreck = this.wrecks.get(wreckId);
    if (!pEntity || !wreck) return false;

    const dist = Math.hypot(pEntity.x - wreck.x, pEntity.z - wreck.z);
    if (dist > 35.0) return false;

    // Release any previously towed wreck
    if (pEntity.towedWreckId && pEntity.towedWreckId !== wreckId) {
      const prevWreck = this.wrecks.get(pEntity.towedWreckId);
      if (prevWreck) {
        prevWreck.isTowed = false;
        prevWreck.towedByAccountId = null;
      }
    }

    pEntity.towedWreckId = wreckId;
    wreck.isTowed = true;
    wreck.towedByAccountId = playerId;

    this.pendingEvents.push({
      type: 'TOW_ATTACHED',
      sourceId: pEntity.id,
      targetId: wreck.id,
      x: wreck.x,
      z: wreck.z,
      data: { wreckName: wreck.shipName, wreckId: wreck.id },
    });

    wreckService.setTowed(wreckId, playerId).catch(console.error);
    return true;
  }

  public releaseTow(playerId: string): void {
    const pEntity = this.entities.get(`player_${playerId}`);
    if (!pEntity || !pEntity.towedWreckId) return;

    const wreckId = pEntity.towedWreckId;
    pEntity.towedWreckId = null;

    const wreck = this.wrecks.get(wreckId);
    if (wreck) {
      wreck.isTowed = false;
      wreck.towedByAccountId = null;
      this.pendingEvents.push({
        type: 'TOW_RELEASED',
        sourceId: pEntity.id,
        targetId: wreck.id,
        x: wreck.x,
        z: wreck.z,
      });
    }

    wreckService.setTowed(wreckId, null).catch(console.error);
  }

  public startSalvageBeam(playerId: string, wreckId: string): boolean {
    const pEntity = this.entities.get(`player_${playerId}`);
    const wreck = this.wrecks.get(wreckId);
    if (!pEntity || !wreck) return false;

    const dist = Math.hypot(pEntity.x - wreck.x, pEntity.z - wreck.z);
    if (dist > 30.0) return false;

    pEntity.miningWreckId = wreckId;
    pEntity.miningTimer = 0;
    return true;
  }

  public stopSalvageBeam(playerId: string): void {
    const pEntity = this.entities.get(`player_${playerId}`);
    if (pEntity) {
      pEntity.miningWreckId = null;
      pEntity.miningTimer = 0;
    }
  }

  private processTowPhysics(dt: number): void {
    for (const entity of this.entities.values()) {
      if (!entity.towedWreckId) continue;
      const wreck = this.wrecks.get(entity.towedWreckId);
      if (!wreck) {
        entity.towedWreckId = null;
        continue;
      }

      const dx = wreck.x - entity.x;
      const dz = wreck.z - entity.z;
      const dist = Math.hypot(dx, dz);
      const restLength = 12.0;

      if (dist > restLength) {
        const delta = dist - restLength;
        const nx = dx / dist;
        const nz = dz / dist;

        // Hooke's Law Spring Force
        const k = 4.0;
        const springF = k * delta;

        // Damping along tether axis
        const damping = 1.2;
        const relVx = wreck.vx - entity.vx;
        const relVz = wreck.vz - entity.vz;
        const dampF = (relVx * nx + relVz * nz) * damping;

        const netF = springF + dampF;
        wreck.vx -= netF * nx * dt;
        wreck.vz -= netF * nz * dt;
      }

      // Wreck friction & positional integration
      wreck.vx *= 0.94;
      wreck.vz *= 0.94;
      wreck.x += wreck.vx * dt;
      wreck.z += wreck.vz * dt;

      // Rotate wreck toward towing ship
      wreck.rotation = Math.atan2(entity.x - wreck.x, entity.z - wreck.z);

      // Inertial drag on towing player
      entity.vx *= 0.85;
      entity.vz *= 0.85;
    }

    // Also integrate untowed wrecks with residual drift and drag
    for (const wreck of this.wrecks.values()) {
      if (wreck.isTowed) continue;
      wreck.vx *= 0.92;
      wreck.vz *= 0.92;
      wreck.x += wreck.vx * dt;
      wreck.z += wreck.vz * dt;
    }
  }

  private processSalvageMining(dt: number): void {
    for (const entity of this.entities.values()) {
      if (!entity.miningWreckId) continue;
      const wreck = this.wrecks.get(entity.miningWreckId);
      if (!wreck) {
        entity.miningWreckId = null;
        continue;
      }

      const dist = Math.hypot(wreck.x - entity.x, wreck.z - entity.z);
      if (dist > 30.0) {
        // Break beam if out of range
        entity.miningWreckId = null;
        continue;
      }

      entity.miningTimer = (entity.miningTimer || 0) + dt;
      if (entity.miningTimer >= 1.0) {
        entity.miningTimer = 0;
        const extract = Math.min(wreck.scrapRemaining, 10);
        wreck.scrapRemaining -= extract;
        wreck.hullIntactness = Math.max(0.0, wreck.scrapRemaining / wreck.maxScrap);
        entity.energy = Math.max(0, entity.energy - 6);

        this.pendingEvents.push({
          type: 'SALVAGE_BEAM_TICK',
          sourceId: entity.id,
          targetId: wreck.id,
          x: wreck.x,
          z: wreck.z,
          data: {
            scrapRemaining: wreck.scrapRemaining,
            extracted: extract,
          },
        });

        const playerId = entity.id.replace('player_', '');
        wreckService.mineScrap(wreck.id, playerId, extract).catch(console.error);

        if (wreck.scrapRemaining <= 0) {
          this.wrecks.delete(wreck.id);
          if (entity.towedWreckId === wreck.id) entity.towedWreckId = null;
          entity.miningWreckId = null;
          this.pendingEvents.push({
            type: 'WRECK_DISINTEGRATED',
            targetId: wreck.id,
            x: wreck.x,
            z: wreck.z,
          });
        }
      }
    }
  }

  private integrateEntityPhysics(entity: SectorEntity, dt: number, now: number): void {
    const isEscapePod = entity.isEscapePod || entity.hullClass === 'ESCAPE_POD';
    let accel = isEscapePod ? 8.0 : entity.type === 'HAULER' ? 6.0 : entity.type === 'DRONE' ? 18.0 : entity.type === 'SCAVENGER' ? 14.0 : 22.0;
    const turnAccel = isEscapePod ? 2.0 : entity.type === 'HAULER' ? 1.4 : entity.type === 'SCAVENGER' ? 2.8 : 3.6;
    let maxSpeed = isEscapePod ? 13.0 : entity.type === 'HAULER' ? 10.0 : entity.type === 'DRONE' ? 24.0 : entity.type === 'SCAVENGER' ? 18.0 : 28.0;

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

    const hasTruce = targetPlayer ? this.isTruceActive(targetPlayer.id, 'FACTION_HEGEMONY') : false;

    for (const drone of this.entities.values()) {
      if (drone.type !== 'DRONE' || drone.state === 'DESTROYED') continue;

      // Day 23: Escort Wingman Formation AI
      if (drone.leaderId) {
        const leader = this.entities.get(drone.leaderId);
        if (leader && leader.state !== 'DESTROYED') {
          // If in TRUCE or PATROL (and not actively provoked), fly in formation alongside leader!
          if (hasTruce || (drone.state !== 'ENGAGE' && (!targetPlayer || minDistance >= 50.0))) {
            drone.state = hasTruce ? 'TRUCE' : 'PATROL';
            drone.inputs.firePrimary = false;
            drone.inputs.fireTactical = false;

            const offset = drone.formationOffset || { x: 0, z: -10 };
            const cosY = Math.cos(leader.yaw);
            const sinY = Math.sin(leader.yaw);
            const targetX = leader.x + (offset.x * cosY + offset.z * sinY);
            const targetZ = leader.z + (-offset.x * sinY + offset.z * cosY);

            const dx = targetX - drone.x;
            const dz = targetZ - drone.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const desiredYaw = Math.atan2(dx, dz);

            let yawDiff = desiredYaw - drone.yaw;
            while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
            while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

            drone.inputs.turnLeft = yawDiff > 0.12;
            drone.inputs.turnRight = yawDiff < -0.12;
            drone.inputs.forward = dist > 1.8;
            drone.inputs.brake = dist <= 1.2;

            if (dist < 3.5) {
              drone.vx = leader.vx;
              drone.vz = leader.vz;
            }
            continue;
          }
        }
      }

      if (hasTruce) {
        // TRUCE MODE: Stand down weapons, display non-aggression transponder & passive patrol
        drone.state = 'TRUCE';
        drone.inputs.firePrimary = false;
        drone.inputs.fireTactical = false;
        drone.aiPatrolAngle = (drone.aiPatrolAngle || 0) + 0.2 * dt;
        const radius = 32.0;
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
        continue;
      }

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

  private processHaulerAI(dt: number): void {
    for (const hauler of this.entities.values()) {
      if (!hauler.isConvoyHauler || hauler.state === 'DESTROYED') continue;

      // Warp spooling logic
      if (hauler.isWarpSpooling) {
        // Disruption check: if shields drop below 15%
        if (hauler.shields <= hauler.maxShields * 0.15) {
          if (!hauler.isWarpInterrupted) {
            hauler.isWarpInterrupted = true;
            this.pendingEvents.push({
              type: 'WARP_SPOOL_INTERRUPTED',
              targetId: hauler.id,
              x: hauler.x,
              z: hauler.z,
            });
          }
        }

        if (!hauler.isWarpInterrupted && typeof hauler.warpChargeRemaining === 'number') {
          hauler.warpChargeRemaining = Math.max(0, hauler.warpChargeRemaining - dt);
          if (hauler.warpChargeRemaining <= 0) {
            // Warp jump successful! Despawn via warp escape
            hauler.state = 'DESTROYED';
            this.pendingEvents.push({
              type: 'WARP_JUMP_SUCCESS',
              targetId: hauler.id,
              x: hauler.x,
              z: hauler.z,
            });
          }
        }
      }

      // Gentle forward cruise along flight corridor
      hauler.inputs.forward = true;
      hauler.inputs.brake = false;
      hauler.inputs.turnLeft = false;
      hauler.inputs.turnRight = false;
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
        const hitRadius = entity.hullClass === 'ESCAPE_POD' ? 2.0 : entity.type === 'HAULER' ? 6.5 : 3.8;

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

    // Check if player attacked a drone during an active ceasefire truce
    if (proj.ownerId && target.type === 'DRONE' && this.isTruceActive(proj.ownerId, 'FACTION_HEGEMONY')) {
      this.clearTruce(proj.ownerId, 'FACTION_HEGEMONY');
      reputationService.breakTruce(proj.ownerId, this.sectorId, 'FACTION_HEGEMONY').catch(() => {});
      reputationService.modifyStanding(proj.ownerId, 'FACTION_HEGEMONY', -25, 'Truce broken: fired upon Hegemony patrol').catch(() => {});
      this.pendingEvents.push({
        type: 'TRUCE_BROKEN',
        sourceId: proj.ownerId,
        targetId: target.id,
        x: target.x,
        z: target.z,
      });
    }

    // Day 23: Convoy Hauler & Escort reactive combat behavior
    if (target.isConvoyHauler) {
      if (!target.isWarpSpooling) {
        target.isWarpSpooling = true;
        this.pendingEvents.push({
          type: 'WARP_SPOOL_STARTED',
          targetId: target.id,
          x: target.x,
          z: target.z,
          data: { warpChargeRemaining: target.warpChargeRemaining },
        });
      }
      // Check if shields dropped below 15% threshold -> disrupts warp drive
      if (target.shields <= target.maxShields * 0.15 && !target.isWarpInterrupted) {
        target.isWarpInterrupted = true;
        this.pendingEvents.push({
          type: 'WARP_SPOOL_INTERRUPTED',
          targetId: target.id,
          x: target.x,
          z: target.z,
        });
      }
      // Alert escorts to engage attacker
      if (target.escortIds) {
        for (const escId of target.escortIds) {
          const escort = this.entities.get(escId);
          if (escort && escort.state !== 'DESTROYED') {
            escort.state = 'ENGAGE';
          }
        }
      }
    } else if (target.leaderId) {
      // An escort was attacked -> alert hauler leader to start warp spooling
      const leader = this.entities.get(target.leaderId);
      if (leader && leader.isConvoyHauler && !leader.isWarpSpooling) {
        leader.isWarpSpooling = true;
        this.pendingEvents.push({
          type: 'WARP_SPOOL_STARTED',
          targetId: leader.id,
          x: leader.x,
          z: leader.z,
          data: { warpChargeRemaining: leader.warpChargeRemaining },
        });
      }
      target.state = 'ENGAGE';
    }

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

    // Day 17: Faction standing penalty for destroying Hegemony patrol drone
    if (killerId && (target.factionId === 'FACTION_VAELIC' || target.factionId === 'FACTION_HEGEMONY')) {
      reputationService.modifyStanding(killerId, 'FACTION_HEGEMONY', -15, `Destroyed ${target.name}`).catch(() => {});
    }

    // Day 15: Spawn Persistent 3D Ship Wreck for Laser Scrap Mining & Towing

    const wreckId = `wreck_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const wreckEntity: SectorWreckEntity = {
      id: wreckId,
      sectorId: this.sectorId,
      shipName: `${target.name} Derelict Wreck`,
      shipClass: target.hullClass || 'Frigate Wreck',
      faction: target.factionId || 'Unknown',
      x: Math.round(target.x * 10) / 10,
      y: 0.0,
      z: Math.round(target.z * 10) / 10,
      vx: (Math.random() - 0.5) * 1.5,
      vz: (Math.random() - 0.5) * 1.5,
      rotation: target.yaw,
      scrapRemaining: 120,
      maxScrap: 120,
      hullIntactness: 0.75,
      isTowed: false,
      towedByAccountId: null,
    };
    this.wrecks.set(wreckId, wreckEntity);
    this.pendingEvents.push({
      type: 'WRECK_SPAWNED',
      targetId: wreckId,
      x: wreckEntity.x,
      z: wreckEntity.z,
      data: wreckEntity,
    });
    wreckService.createWreck(
      this.sectorId,
      wreckEntity.shipName,
      wreckEntity.shipClass,
      wreckEntity.faction,
      wreckEntity.x,
      0,
      wreckEntity.z,
      wreckEntity.rotation,
      wreckEntity.maxScrap,
      wreckEntity.hullIntactness
    ).catch((err) => console.error('[WreckService] Error persisting wreck:', err));

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
        // Day 15 Towing & Salvage Mining
        towedWreckId: e.towedWreckId || null,
        isMiningWreckId: e.miningWreckId || null,
        // Day 23 Convoy & Formation
        isConvoyHauler: e.isConvoyHauler,
        convoyId: e.convoyId,
        leaderId: e.leaderId,
        warpChargeRemaining: typeof e.warpChargeRemaining === 'number' ? Math.round(e.warpChargeRemaining * 10) / 10 : undefined,
        isWarpSpooling: e.isWarpSpooling,
        isWarpInterrupted: e.isWarpInterrupted,
        cargoManifest: e.cargoManifest,
      })),
      convoys: Array.from(this.entities.values())
        .filter((e) => e.isConvoyHauler && e.state !== 'DESTROYED')
        .map((h) => ({
          convoyId: h.convoyId || h.id,
          name: h.name,
          factionId: h.factionId,
          haulerId: h.id,
          escortIds: h.escortIds || [],
          warpChargeRemaining: typeof h.warpChargeRemaining === 'number' ? Math.round(h.warpChargeRemaining * 10) / 10 : 30,
          isWarpSpooling: !!h.isWarpSpooling,
          isWarpInterrupted: !!h.isWarpInterrupted,
          cargoManifest: h.cargoManifest || [],
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
      wrecks: Array.from(this.wrecks.values()).map((w) => ({
        id: w.id,
        shipName: w.shipName,
        shipClass: w.shipClass,
        faction: w.faction,
        x: Math.round(w.x * 100) / 100,
        y: Math.round(w.y * 100) / 100,
        z: Math.round(w.z * 100) / 100,
        rotation: Math.round(w.rotation * 1000) / 1000,
        scrapRemaining: Math.round(w.scrapRemaining),
        maxScrap: w.maxScrap,
        hullIntactness: Math.round(w.hullIntactness * 100) / 100,
        isTowed: w.isTowed,
        towedByAccountId: w.towedByAccountId,
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

  public notifyTruce(sectorId: number, playerId: string, factionId: string, durationMs: number = 300000): void {
    const room = this.rooms.get(sectorId);
    if (room) {
      room.setTruce(playerId, factionId, durationMs);
    }
  }

  public reseedSector(sectorId: number): void {
    const room = this.rooms.get(sectorId);
    if (room) {
      room.reseedEntities();
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
        } else if (msg.type === 'ATTACH_TOW') {
          room.attachTow(playerId, msg.wreckId);
        } else if (msg.type === 'RELEASE_TOW') {
          room.releaseTow(playerId);
        } else if (msg.type === 'START_SALVAGE_BEAM') {
          room.startSalvageBeam(playerId, msg.wreckId);
        } else if (msg.type === 'STOP_SALVAGE_BEAM') {
          room.stopSalvageBeam(playerId);
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
