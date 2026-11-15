import type { WebSocket } from 'ws';
import { LootGenerator } from './LootGenerator';
import { outfittingService } from './OutfittingService';
import { ContractService } from './ContractService';
import { wreckService, SectorWreck } from './WreckService';
import { reputationService } from './ReputationService';
import { convoyService } from './ConvoyService';
import { tradeService } from './TradeService';
import {
  AsteroidNode,
  MiningCapabilities,
  SPACE_ORES,
  computeMiningCapabilities,
  generateSectorAsteroids,
} from '../procgen/MiningOreCatalog';
import { db } from '../db/Database';

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
  activeWeaponId?: 'PULSE' | 'PLASMA' | 'FLAK' | 'RAIL' | 'TORPEDO';
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

export interface EscortAARStats {
  shipId: string;
  name: string;
  hullClass: string;
  slot: number;
  damageDealt: number;
  damageAbsorbed: number;
  abilitiesTriggered: number;
  kills: number;
  status: 'OPERATIONAL' | 'CRITICAL' | 'DESTROYED';
}

export interface CombatAAR {
  sessionId: string;
  sectorId: number;
  timestamp: string;
  flagship: {
    accountId: string;
    damageDealt: number;
    damageAbsorbed: number;
    kills: number;
  };
  escorts: EscortAARStats[];
  salvageCollected: number;
  totalDamageDealt: number;
  totalDamageAbsorbed: number;
  medal: 'S' | 'A' | 'B' | 'C';
}

export interface SectorEntity {
  id: string;
  type: 'PLAYER' | 'DRONE' | 'WRECK' | 'CARGO_CRATE' | 'SCAVENGER' | 'HAULER' | 'WINGMAN';
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
  // Milestone 1.4: Space Mining & Thermal Signature
  miningAsteroidId?: string | null;
  asteroidMiningTimer?: number;
  miningHeat?: number;
  miningProfile?: MiningCapabilities;
  miningBusy?: boolean;
  rarePrecisionCompletions?: number;
  lastAmbushAt?: number;
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
  // Day 25 Ambush & Skirmish Arena
  isAmbushRaider?: boolean;
  targetHaulerId?: string;
  isSkirmishVessel?: boolean;
  allegiance?: string;
  targetEntityId?: string | null;
  // Day 34 Player Wingman Formation Flight & Tactical Directives
  ownerPlayerId?: string;
  wingmanSlot?: number;
  tacticalOrder?: 'FORMATION_FOLLOW' | 'FOCUS_TARGET' | 'ESCORT_FLAGSHIP' | 'FLANK_HARASS' | 'REGROUP_HOLD';
  shipId?: string;
  // Day 35 Alien Hull Asymmetry & Signature Abilities
  specialAbility?: string; // 'POINT_DEFENSE' | 'PLASMA_LANCE' | 'DECOY_HOLO' | 'BIO_SPORE_CLOUD' | 'HARMONIC_SHIELD'
  abilityCooldown?: number;
  abilityMaxCooldown?: number;
  abilityActiveTimer?: number;
  harmonicShieldActive?: boolean;
  isDecoy?: boolean;
  decoyOwnerId?: string;
  decoyTtl?: number;
}

export interface SporeCloud {
  id: string;
  x: number;
  z: number;
  radius: number;
  ttl: number;
  maxTtl: number;
  ownerId: string;
  dps: number;
}

export const WINGMAN_FORMATION_OFFSETS: Record<number, { x: number; z: number }> = {
  1: { x: -35.0, z: -25.0 }, // Port Wingman (left shoulder)
  2: { x: 35.0, z: -25.0 },  // Starboard Wingman (right shoulder)
  3: { x: 0.0, z: -55.0 },   // Tail Guard (high rear astern)
  4: { x: 50.0, z: 15.0 },   // Forward Screen (vanguard screen)
};

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
  type: 'HIT' | 'SHIELD_BREAK' | 'DESTROYED' | 'LOOT_SPAWNED' | 'LOOT_COLLECTED' | 'POD_EJECTED' | 'CONTAINER_SCOOPED' | 'WRECK_SPAWNED' | 'TOW_ATTACHED' | 'TOW_RELEASED' | 'SALVAGE_BEAM_TICK' | 'WRECK_DISINTEGRATED' | 'TRUCE_DECLARED' | 'TRUCE_BROKEN' | 'LIFE_SUPPORT_EXHAUSTED' | 'WARP_SPOOL_STARTED' | 'WARP_SPOOL_INTERRUPTED' | 'WARP_JUMP_SUCCESS' | 'CONVOY_SURRENDERED' | 'COMMS_ABORTED' | 'AMBUSH_TRIGGERED' | 'AMBUSH_CLEARED' | 'ESCORT_FAILED' | 'ALLEGIANCE_DECLARED' | 'COMBAT_BOND_AWARDED' | 'SKIRMISH_VICTORY' | 'TACTICAL_ORDER_ISSUED' | 'WINGMAN_DESTROYED' | 'ABILITY_TRIGGERED' | 'MINING_BEAM_TICK' | 'MINING_YIELD' | 'CARGO_HOLD_FULL' | 'THERMAL_VENT_WARNING' | 'THERMAL_VENT_ERUPTION' | 'MINING_AMBUSH' | 'ASTEROID_FRACTURED' | 'ASTEROID_DEPLETED';

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
    // Day 25 Ambush & Skirmish
    isAmbushRaider?: boolean;
    targetHaulerId?: string;
    isSkirmishVessel?: boolean;
    allegiance?: string;
    // Day 34 Wingman Telemetry
    ownerPlayerId?: string;
    wingmanSlot?: number;
    tacticalOrder?: string;
    shipId?: string;
    // Day 35 Ability Telemetry
    specialAbility?: string;
    abilityCooldown?: number;
    abilityMaxCooldown?: number;
    harmonicShieldActive?: boolean;
    isDecoy?: boolean;
    // Milestone 1.4 Mining Telemetry
    miningAsteroidId?: string | null;
    miningHeat?: number;
    scoopRadius?: number;
    beamRange?: number;
  }>;
  asteroids?: Array<{
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
  }>;
  sporeClouds?: SporeCloud[];
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
  isSkirmishArena?: boolean;
  skirmishScores?: { FACTION_HEGEMONY: number; FACTION_KRYLL: number };
  skirmishBeacon?: { id: string; name: string; x: number; z: number; radius: number; skirmishSectorId: number };
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
  public asteroids: Map<string, AsteroidNode> = new Map();
  public projectiles: Projectile[] = [];
  public containers: SectorLootContainer[] = [];
  public sporeClouds: SporeCloud[] = [];
  public pendingEvents: CombatEvent[] = [];
  public sessionAAR: Map<string, CombatAAR> = new Map();

  private tickInterval: NodeJS.Timeout | null = null;
  private lastTickTimestamp: number = Date.now();
  private tickCount: number = 0;
  private projectileSeq: number = 0;
  private activeTruces: Map<string, number> = new Map(); // `${playerId}:${factionId}` -> expiryTimestamp
  public isCommsStandDown: boolean = false;

  // Day 25: Skirmish Arena & Ambush fields
  public isSkirmishArena: boolean = false;
  public skirmishScores: { FACTION_HEGEMONY: number; FACTION_KRYLL: number } = {
    FACTION_HEGEMONY: 100,
    FACTION_KRYLL: 100,
  };
  public playerAllegiances: Map<string, string> = new Map();
  public playerCombatBonds: Map<string, number> = new Map();

  public declareAllegiance(playerId: string, factionId: string): void {
    this.playerAllegiances.set(playerId, factionId);
    const pEntity = this.entities.get(`player_${playerId}`);
    if (pEntity) {
      pEntity.allegiance = factionId;
    }
    this.pendingEvents.push({
      type: 'ALLEGIANCE_DECLARED',
      sourceId: playerId,
      targetId: factionId,
      data: {
        playerId,
        factionId,
        message: `Allegiance declared for ${factionId}. Inter-faction combat IFF online.`,
      },
    });
  }

  public spawnBountyTarget(
    missionId: string,
    callsign: string,
    factionId: string,
    hullClass: string = 'HEGEMONY_INTERCEPTOR'
  ): string {
    const bountyId = `bounty_${missionId}`;
    if (this.entities.has(bountyId)) {
      return bountyId;
    }

    this.entities.set(bountyId, {
      id: bountyId,
      type: 'DRONE',
      factionId,
      name: callsign,
      hullClass,
      hullSeed: 44100 + Math.floor(Math.random() * 5000),
      x: 55.0,
      z: -45.0,
      vx: 0,
      vz: 0,
      yaw: -Math.PI / 3,
      angularVelocity: 0,
      hp: 165,
      maxHp: 165,
      shields: 110,
      maxShields: 110,
      energy: 100,
      maxEnergy: 100,
      powerGridMax: 110,
      powerGridUsed: 75,
      cpuMax: 150,
      cpuUsed: 95,
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
    });

    return bountyId;
  }

  public spawnAmbushWing(convoyId: string, riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME' = 'MODERATE'): string[] {
    let hauler: SectorEntity | undefined;
    for (const e of this.entities.values()) {
      if ((e.convoyId === convoyId || e.id === convoyId) && e.isConvoyHauler) {
        hauler = e;
        break;
      }
    }
    if (!hauler || hauler.state === 'DESTROYED') return [];

    const raiderCount = riskLevel === 'EXTREME' ? 4 : riskLevel === 'HIGH' ? 3 : 2;
    const raiderIds: string[] = [];

    for (let i = 0; i < raiderCount; i++) {
      const raiderId = `raider_ambush_${convoyId}_${i + 1}`;
      raiderIds.push(raiderId);

      const offsetDist = 45.0 + i * 15.0;
      const angle = (i * Math.PI) / 3;
      const rx = hauler.x + Math.sin(angle) * offsetDist;
      const rz = hauler.z + Math.cos(angle) * offsetDist;

      this.entities.set(raiderId, {
        id: raiderId,
        type: 'DRONE',
        factionId: 'FACTION_KRYLL',
        name: `Cartel Raider Strike ${i + 1}`,
        hullClass: riskLevel === 'EXTREME' ? 'HEGEMONY_INTERCEPTOR' : 'KRYLL_BLOCKADE_RUNNER',
        hullSeed: 77100 + i,
        x: rx,
        z: rz,
        vx: 0,
        vz: 0,
        yaw: Math.atan2(hauler.x - rx, hauler.z - rz),
        angularVelocity: 0,
        hp: riskLevel === 'EXTREME' ? 140 : riskLevel === 'HIGH' ? 120 : 100,
        maxHp: riskLevel === 'EXTREME' ? 140 : riskLevel === 'HIGH' ? 120 : 100,
        shields: riskLevel === 'EXTREME' ? 100 : riskLevel === 'HIGH' ? 80 : 60,
        maxShields: riskLevel === 'EXTREME' ? 100 : riskLevel === 'HIGH' ? 80 : 60,
        energy: 100,
        maxEnergy: 100,
        powerGridMax: 100,
        powerGridUsed: 60,
        cpuMax: 140,
        cpuUsed: 90,
        state: 'ENGAGE',
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
        isAmbushRaider: true,
        targetHaulerId: hauler.id,
      });
    }

    this.pendingEvents.push({
      type: 'AMBUSH_TRIGGERED',
      sourceId: hauler.id,
      data: {
        convoyId,
        haulerId: hauler.id,
        riskLevel,
        raiderIds,
        message: '⚠️ HOSTILE RAIDING WING INBOUND // PROTECT BULK HAULER',
      },
    });

    return raiderIds;
  }

  public setCommsStandDown(isStandDown: boolean): void {
    this.isCommsStandDown = isStandDown;
  }

  public notifyTruce(playerId: string, factionId: string, durationMs: number = 300000): void {
    this.setTruce(playerId, factionId, durationMs);
  }

  public surrenderConvoy(convoyId: string, accountId: string): { droppedContainers: number; totalUnits: number } {
    let hauler: SectorEntity | undefined;
    for (const e of this.entities.values()) {
      if ((e.convoyId === convoyId || e.id === convoyId) && e.isConvoyHauler) {
        hauler = e;
        break;
      }
    }
    if (!hauler || hauler.state === 'DESTROYED') {
      return { droppedContainers: 0, totalUnits: 0 };
    }

    hauler.state = 'FLEE';
    hauler.isWarpSpooling = false;
    hauler.inputs.forward = true;
    hauler.inputs.turnLeft = false;
    hauler.inputs.turnRight = false;

    // Escorts also flee
    if (hauler.escortIds) {
      for (const escId of hauler.escortIds) {
        const esc = this.entities.get(escId);
        if (esc && esc.state !== 'DESTROYED') {
          esc.state = 'FLEE';
          esc.inputs.firePrimary = false;
          esc.inputs.fireTactical = false;
        }
      }
    }

    // Jettison 50-75% of cargo manifest into 20Hz sector space as SectorLootContainer
    const manifest = hauler.cargoManifest || [];
    let droppedContainers = 0;
    let totalUnits = 0;

    for (let i = 0; i < manifest.length; i++) {
      const item = manifest[i];
      const dropQuantity = Math.max(1, Math.round((item.quantity || 10) * 0.65));
      totalUnits += dropQuantity;
      item.quantity = Math.max(0, (item.quantity || dropQuantity) - dropQuantity);

      const angle = (i / Math.max(1, manifest.length)) * Math.PI * 2;
      const dist = 5.0 + (i % 2) * 3.0;
      const cId = `container_convoy_${Date.now()}_${i}`;

      const container: SectorLootContainer = {
        id: cId,
        x: hauler.x + Math.sin(angle) * dist,
        z: hauler.z + Math.cos(angle) * dist,
        title: `Jettisoned ${item.name || item.commodityId}`,
        rarity: 'UNCOMMON',
        items: [{
          id: `loot_${item.commodityId}_${Date.now()}_${i}`,
          name: item.name || item.commodityId,
          category: 'COMMODITY',
          commodityId: item.commodityId,
          quantity: dropQuantity,
          unitValue: item.unitValue || 50,
          rarity: 'UNCOMMON',
        }],
        createdAt: Date.now(),
      };

      this.containers.push(container);
      droppedContainers++;

      this.pendingEvents.push({
        type: 'LOOT_SPAWNED',
        sourceId: hauler.id,
        targetId: container.id,
        x: container.x,
        z: container.z,
        data: {
          containerId: container.id,
          title: container.title,
          rarity: container.rarity,
          items: container.items,
        },
      });
    }

    this.pendingEvents.push({
      type: 'CONVOY_SURRENDERED',
      sourceId: accountId,
      targetId: hauler.id,
      x: hauler.x,
      z: hauler.z,
      data: {
        convoyId,
        droppedContainers,
        totalUnits,
      },
    });

    if (hauler.convoyId) {
      convoyService.recordConvoyRaid(hauler.convoyId, 'SURRENDERED').catch(() => {});
    }

    return { droppedContainers, totalUnits };
  }

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
    this.asteroids = generateSectorAsteroids(sectorId);
    this.seedSectorEntities();
    this.hydrateSectorAsteroidsFromDb().catch(() => {});
  }

  private async hydrateSectorAsteroidsFromDb(): Promise<void> {
    try {
      const res = await db.query(
        'SELECT spectral_class, controlling_faction, hazard_level FROM sectors WHERE id = $1',
        [this.sectorId]
      );
      if (res.rows.length === 0) return;
      const row = res.rows[0] as any;
      // Only reseed if no asteroid has taken damage yet
      for (const ast of this.asteroids.values()) {
        if (ast.hp < ast.maxHp || ast.remainingYield < ast.maxYield || ast.depletedUntil !== null) {
          return;
        }
      }
      this.asteroids = generateSectorAsteroids(
        this.sectorId,
        row.spectral_class,
        row.controlling_faction,
        Number(row.hazard_level || 1)
      );
      if (this.clients.size > 0) {
        const msg = JSON.stringify({
          type: 'SECTOR_ASTEROIDS',
          sectorId: this.sectorId,
          asteroids: this.serializeAsteroids(),
        });
        for (const client of this.clients.values()) {
          if (client.readyState === 1) client.send(msg);
        }
      }
    } catch {
      // Keep deterministic defaults if DB unavailable
    }
  }

  public serializeAsteroids(): Array<{
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
  }> {
    return Array.from(this.asteroids.values()).map((a) => ({
      id: a.id,
      x: a.x,
      z: a.z,
      radius: a.radius,
      seed: a.seed,
      oreCommodityId: a.oreCommodityId,
      oreName: a.oreName,
      emissiveHex: a.emissiveHex,
      tier: a.tier,
      hp: Math.max(0, Math.round(a.hp)),
      maxHp: a.maxHp,
      remainingYield: Math.max(0, Math.round(a.remainingYield)),
      maxYield: a.maxYield,
      depleted: a.depletedUntil !== null,
      heatState: a.heatState,
    }));
  }

  public reseedEntities(): void {
    this.asteroids = generateSectorAsteroids(this.sectorId);
    this.projectiles = [];
    this.containers = [];
    for (const ent of this.entities.values()) {
      ent.lastAmbushAt = undefined;
      ent.miningAsteroidId = null;
      ent.miningHeat = 0;
      ent.miningBusy = false;
    }
    this.seedSectorEntities();
  }

  /**
   * Spawns initial sector environment: Sector 2 gets Hegemony Interceptor drones
   */
  private seedSectorEntities(): void {
    if (this.sectorId === 201) {
      this.seedSkirmishEntities();
      return;
    }
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
            mainCategory: 'OFFENSE',
            subtype: 'Railgun',
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

  private seedSkirmishEntities(): void {
    this.isSkirmishArena = true;
    this.skirmishScores = { FACTION_HEGEMONY: 100, FACTION_KRYLL: 100 };

    const hegConfigs = [
      { id: 'hegemony_skirmish_lead', name: 'Vaelic Sovereign Commander', hull: 'HEGEMONY_INTERCEPTOR', hp: 180, shields: 120, x: -50, z: -40 },
      { id: 'hegemony_skirmish_wing_1', name: 'Vaelic Interceptor Alpha', hull: 'HEGEMONY_INTERCEPTOR', hp: 120, shields: 80, x: -70, z: -30 },
      { id: 'hegemony_skirmish_wing_2', name: 'Vaelic Interceptor Beta', hull: 'HEGEMONY_INTERCEPTOR', hp: 120, shields: 80, x: -35, z: -60 },
      { id: 'hegemony_skirmish_wing_3', name: 'Vaelic Interceptor Gamma', hull: 'HEGEMONY_INTERCEPTOR', hp: 120, shields: 80, x: -75, z: -55 },
    ];

    for (const h of hegConfigs) {
      this.entities.set(h.id, {
        id: h.id,
        type: 'DRONE',
        factionId: 'FACTION_HEGEMONY',
        name: h.name,
        hullClass: h.hull,
        hullSeed: 11001,
        x: h.x,
        z: h.z,
        vx: 0,
        vz: 0,
        yaw: Math.PI / 4,
        angularVelocity: 0,
        hp: h.hp,
        maxHp: h.hp,
        shields: h.shields,
        maxShields: h.shields,
        energy: 100,
        maxEnergy: 100,
        powerGridMax: 100,
        powerGridUsed: 65,
        cpuMax: 140,
        cpuUsed: 90,
        state: 'ENGAGE',
        inputs: { forward: true, reverse: false, turnLeft: false, turnRight: false, brake: false, firePrimary: false, fireTactical: false },
        lastHitTime: 0,
        fireCooldown: 0,
        isSkirmishVessel: true,
        allegiance: 'FACTION_HEGEMONY',
      });
    }

    const kryllConfigs = [
      { id: 'kryll_skirmish_lead', name: 'Cartel Warlord Skrit-Bane', hull: 'KRYLL_BLOCKADE_RUNNER', hp: 180, shields: 120, x: 50, z: 40 },
      { id: 'kryll_skirmish_wing_1', name: 'Cartel Raider Alpha', hull: 'KRYLL_BLOCKADE_RUNNER', hp: 110, shields: 70, x: 70, z: 30 },
      { id: 'kryll_skirmish_wing_2', name: 'Cartel Raider Beta', hull: 'KRYLL_BLOCKADE_RUNNER', hp: 110, shields: 70, x: 35, z: 60 },
      { id: 'kryll_skirmish_wing_3', name: 'Cartel Raider Gamma', hull: 'KRYLL_BLOCKADE_RUNNER', hp: 110, shields: 70, x: 75, z: 55 },
    ];

    for (const k of kryllConfigs) {
      this.entities.set(k.id, {
        id: k.id,
        type: 'DRONE',
        factionId: 'FACTION_KRYLL',
        name: k.name,
        hullClass: k.hull,
        hullSeed: 22002,
        x: k.x,
        z: k.z,
        vx: 0,
        vz: 0,
        yaw: -Math.PI * 0.75,
        angularVelocity: 0,
        hp: k.hp,
        maxHp: k.hp,
        shields: k.shields,
        maxShields: k.shields,
        energy: 100,
        maxEnergy: 100,
        powerGridMax: 100,
        powerGridUsed: 65,
        cpuMax: 140,
        cpuUsed: 90,
        state: 'ENGAGE',
        inputs: { forward: true, reverse: false, turnLeft: false, turnRight: false, brake: false, firePrimary: false, fireTactical: false },
        lastHitTime: 0,
        fireCooldown: 0,
        isSkirmishVessel: true,
        allegiance: 'FACTION_KRYLL',
      });
    }
  }

  public addPlayer(playerId: string, socket: WebSocket, shipData?: any): void {
    this.clients.set(playerId, socket);

    const entityId = `player_${playerId}`;
    const loadout = shipData?.loadout;
    const fittedMods = loadout?.fitted ? Object.values(loadout.fitted).filter(Boolean) as any[] : [];
    const bonusHp = fittedMods.reduce((sum, m) => sum + Number(m?.baseStats?.maxHpBonus || 0), 0);
    const bonusShield = fittedMods.reduce((sum, m) => sum + Number(m?.baseStats?.maxShieldBonus || 0), 0);
    const bonusEnergy = fittedMods.reduce((sum, m) => sum + Number(m?.baseStats?.maxEnergyBonus || 0), 0);

    const baseMaxHp = Number(shipData?.max_armor ?? 100) + bonusHp;
    const baseHp = Math.min(baseMaxHp, Number(shipData?.armor ?? 100) + bonusHp);
    const baseMaxShield = Number(shipData?.max_shield ?? 100) + bonusShield;
    const baseShield = Math.min(baseMaxShield, Number(shipData?.shield ?? 100) + bonusShield);
    const baseMaxEnergy = 100 + bonusEnergy;
    const miningProfile = computeMiningCapabilities(
      shipData?.main_hull_class || shipData?.hull_class,
      fittedMods
    );

    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, {
        id: entityId,
        type: 'PLAYER',
        factionId: shipData?.faction_id || 'FACTION_SOL',
        name: shipData?.flagship_name || 'Cmdr. Vance',
        hullClass: shipData?.main_hull_class || shipData?.hull_class || 'CORVETTE',
        hullSeed: Number(shipData?.hull_seed || 12345),
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        yaw: 0,
        angularVelocity: 0,
        hp: baseHp,
        maxHp: baseMaxHp,
        shields: baseShield,
        maxShields: baseMaxShield,
        energy: baseMaxEnergy,
        maxEnergy: baseMaxEnergy,
        powerGridMax: Number(loadout?.powerGridMax ?? shipData?.power_grid_max ?? 120),
        powerGridUsed: Number(loadout?.powerGridUsed ?? 75),
        cpuMax: Number(loadout?.cpuMax ?? shipData?.cpu_max ?? 180),
        cpuUsed: Number(loadout?.cpuUsed ?? 110),
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
        miningHeat: 0,
        miningProfile,
      });
    } else {
      const existing = this.entities.get(entityId)!;
      existing.hullClass = shipData?.main_hull_class || shipData?.hull_class || existing.hullClass;
      existing.miningProfile = miningProfile;
    }

    try {
      if (socket.readyState === 1) {
        socket.send(
          JSON.stringify({
            type: 'SECTOR_ASTEROIDS',
            sectorId: this.sectorId,
            asteroids: this.serializeAsteroids(),
            miningProfile,
          })
        );
      }
    } catch {
      // Ignore closed socket
    }

    // Day 36: Initialize Session AAR Tracker for this player
    if (!this.sessionAAR.has(playerId)) {
      this.sessionAAR.set(playerId, {
        sessionId: `aar_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sectorId: this.sectorId,
        timestamp: new Date().toISOString(),
        flagship: {
          accountId: playerId,
          damageDealt: 0,
          damageAbsorbed: 0,
          kills: 0,
        },
        escorts: [],
        salvageCollected: 0,
        totalDamageDealt: 0,
        totalDamageAbsorbed: 0,
        medal: 'S',
      });
    }

    // Day 34: Auto-spawn active wingmen for this player
    this.spawnWingmenForPlayer(playerId, shipData?.activeWingmen).catch((err) => {
      console.warn(`[SectorRoom ${this.sectorId}] Failed to spawn wingmen for player ${playerId}:`, err);
    });

    if (!this.tickInterval) {
      this.startTickLoop();
    }
  }

  public async spawnWingmenForPlayer(playerId: string, overrideWingmen?: any[]): Promise<SectorEntity[]> {
    const pEntity = this.entities.get(`player_${playerId}`);
    const flagshipX = pEntity ? pEntity.x : 0;
    const flagshipZ = pEntity ? pEntity.z : 0;
    const flagshipYaw = pEntity ? pEntity.yaw : 0;
    const flagshipVx = pEntity ? pEntity.vx : 0;
    const flagshipVz = pEntity ? pEntity.vz : 0;

    let wingmenRows: any[] = [];
    if (Array.isArray(overrideWingmen) && overrideWingmen.length > 0) {
      wingmenRows = overrideWingmen;
    } else if (db.isInitialized) {
      try {
        const query = `
          SELECT * FROM player_fleet
          WHERE account_id = $1 AND deployment_slot IS NOT NULL AND status != 'DESTROYED'
          ORDER BY deployment_slot ASC
        `;
        const { rows } = await db.query<any>(query, [playerId]);
        wingmenRows = rows;
      } catch (err) {
        console.warn(`[SectorRoom ${this.sectorId}] DB query for wingmen failed:`, err);
      }
    }

    const spawned: SectorEntity[] = [];

    // Clear any previous wingmen for this player before spawning fresh roster
    for (const [id, entity] of this.entities.entries()) {
      if (entity.type === 'WINGMAN' && entity.ownerPlayerId === playerId) {
        this.entities.delete(id);
      }
    }

    for (const row of wingmenRows) {
      const slot = Number(row.deployment_slot ?? row.deploymentSlot ?? 1);
      const wingmanId = `wingman_${playerId}_slot_${slot}`;

      const offset = WINGMAN_FORMATION_OFFSETS[slot] || { x: -35.0, z: -25.0 };
      const cosY = Math.cos(flagshipYaw);
      const sinY = Math.sin(flagshipYaw);
      const wx = flagshipX + (offset.x * cosY + offset.z * sinY);
      const wz = flagshipZ + (-offset.x * sinY + offset.z * cosY);

      const hullClass = row.hull_class || row.hullClass || 'SOL_CRUISER';
      const factionId = row.faction_id || row.factionId || 'FACTION_SOL';
      const shipName = row.name || `Wingman Slot ${slot}`;
      const hp = Number(row.hull ?? 150);
      const maxHp = Number(row.max_hull ?? row.maxHull ?? 150);
      const shields = Number(row.shield ?? 100);
      const maxShields = Number(row.max_shield ?? row.maxShield ?? 100);

      let ability = row.special_ability || row.specialAbility;
      if (!ability) {
        if (hullClass === 'KRYLL_RUNNER' || factionId === 'FACTION_KRYLL') ability = 'DECOY_HOLO';
        else if (hullClass === 'VAELIC_INTERDICTOR' || factionId === 'FACTION_VAELIC') ability = 'PLASMA_LANCE';
        else if (hullClass === 'PHORID_FRIGATE' || factionId === 'FACTION_PHORID') ability = 'BIO_SPORE_CLOUD';
        else if (hullClass === 'LITHOS_MONITOR' || factionId === 'FACTION_LITHOS') ability = 'HARMONIC_SHIELD';
        else ability = 'POINT_DEFENSE';
      }
      if (ability === 'PLASMA_BARRAGE') ability = 'PLASMA_LANCE';
      if (ability === 'SHOCKWAVE') ability = 'HARMONIC_SHIELD';
      const maxCd = ability === 'BIO_SPORE_CLOUD' ? 35 : (ability === 'POINT_DEFENSE' ? 25 : 30);

      const entity: SectorEntity = {
        id: wingmanId,
        type: 'WINGMAN',
        ownerPlayerId: playerId,
        wingmanSlot: slot,
        tacticalOrder: 'FORMATION_FOLLOW',
        shipId: row.id,
        specialAbility: ability,
        abilityCooldown: 0,
        abilityMaxCooldown: maxCd,
        abilityActiveTimer: 0,
        harmonicShieldActive: false,
        factionId,
        name: shipName,
        hullClass,
        hullSeed: 1000 + slot,
        x: wx,
        z: wz,
        vx: flagshipVx,
        vz: flagshipVz,
        yaw: flagshipYaw,
        angularVelocity: 0,
        hp,
        maxHp,
        shields,
        maxShields,
        energy: 100,
        maxEnergy: 100,
        powerGridMax: 100,
        powerGridUsed: 60,
        cpuMax: 140,
        cpuUsed: 80,
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
      };

      this.entities.set(wingmanId, entity);
      spawned.push(entity);

      // Day 36: Register Escort in Session AAR
      const aar = this.sessionAAR.get(playerId);
      if (aar && !aar.escorts.some((e) => e.slot === slot)) {
        aar.escorts.push({
          shipId: row.id || wingmanId,
          name: shipName,
          hullClass,
          slot,
          damageDealt: 0,
          damageAbsorbed: 0,
          abilitiesTriggered: 0,
          kills: 0,
          status: 'OPERATIONAL',
        });
      }
    }

    return spawned;
  }

  public setTacticalOrder(
    playerId: string,
    order: 'FORMATION_FOLLOW' | 'FOCUS_TARGET' | 'ESCORT_FLAGSHIP' | 'FLANK_HARASS' | 'REGROUP_HOLD',
    targetEntityId?: string
  ): { success: boolean; affectedWingmenCount: number; message: string } {
    let affectedWingmenCount = 0;
    for (const entity of this.entities.values()) {
      if (entity.type === 'WINGMAN' && entity.ownerPlayerId === playerId && entity.state !== 'DESTROYED') {
        entity.tacticalOrder = order;
        if (targetEntityId) {
          entity.targetEntityId = targetEntityId;
        } else if (order === 'FORMATION_FOLLOW' || order === 'REGROUP_HOLD') {
          entity.targetEntityId = null;
        }
        affectedWingmenCount++;
      }
    }

    this.pendingEvents.push({
      type: 'TACTICAL_ORDER_ISSUED',
      sourceId: `player_${playerId}`,
      targetId: targetEntityId,
      data: {
        order,
        targetEntityId,
        affectedWingmenCount,
        message: `Squadron directive set to ${order} (${affectedWingmenCount} wingmen assigned)`,
      },
    });

    return {
      success: true,
      affectedWingmenCount,
      message: `Squadron directive set to ${order} (${affectedWingmenCount} wingmen assigned)`,
    };
  }

  public getTacticalState(playerId: string): {
    success: boolean;
    wingmen: Array<{
      id: string;
      shipId?: string;
      slot?: number;
      name: string;
      hullClass: string;
      tacticalOrder?: string;
      targetEntityId?: string | null;
      hp: number;
      maxHp: number;
      shields: number;
      maxShields: number;
      x: number;
      z: number;
      yaw: number;
    }>;
  } {
    const wingmen = Array.from(this.entities.values())
      .filter((e) => e.type === 'WINGMAN' && e.ownerPlayerId === playerId && e.state !== 'DESTROYED')
      .map((w) => ({
        id: w.id,
        shipId: w.shipId,
        slot: w.wingmanSlot,
        name: w.name,
        hullClass: w.hullClass,
        tacticalOrder: w.tacticalOrder,
        targetEntityId: w.targetEntityId,
        hp: w.hp,
        maxHp: w.maxHp,
        shields: w.shields,
        maxShields: w.maxShields,
        x: Math.round(w.x * 100) / 100,
        z: Math.round(w.z * 100) / 100,
        yaw: Math.round(w.yaw * 1000) / 1000,
      }));

    return {
      success: true,
      wingmen,
    };
  }

  public triggerPlayerWingmanAbility(
    playerId: string,
    slot: number,
    targetEntityId?: string
  ): { success: boolean; ability?: string; cooldownRemaining?: number; message?: string; error?: string } {
    const wingman = Array.from(this.entities.values()).find(
      (e) => e.type === 'WINGMAN' && e.ownerPlayerId === playerId && e.wingmanSlot === slot && e.state !== 'DESTROYED'
    );

    if (!wingman) {
      return {
        success: false,
        error: 'WINGMAN_NOT_FOUND',
        message: `No active wingman assigned to Deployment Slot ${slot}.`,
      };
    }

    return this.triggerWingmanAbility(wingman, targetEntityId);
  }

  public triggerWingmanAbility(
    wingman: SectorEntity,
    targetEntityId?: string
  ): { success: boolean; ability?: string; cooldownRemaining?: number; message?: string; error?: string } {
    if ((wingman.abilityCooldown || 0) > 0) {
      return {
        success: false,
        ability: wingman.specialAbility,
        cooldownRemaining: Math.round((wingman.abilityCooldown || 0) * 10) / 10,
        error: 'ABILITY_ON_COOLDOWN',
        message: `${wingman.name}'s ${wingman.specialAbility} is recharging (${Math.ceil(wingman.abilityCooldown || 0)}s remaining).`,
      };
    }

    let ability = wingman.specialAbility || 'POINT_DEFENSE';
    if (ability === 'PLASMA_BARRAGE') ability = 'PLASMA_LANCE';
    if (ability === 'SHOCKWAVE') ability = 'HARMONIC_SHIELD';

    // Record ability activation for session AAR
    this.recordAbility(wingman);

    switch (ability) {
      case 'POINT_DEFENSE': {
        const radius = 35.0;
        let destroyedCount = 0;
        this.projectiles = this.projectiles.filter((p) => {
          const isFriendly = p.ownerId === wingman.id || (wingman.ownerPlayerId && p.ownerId === `player_${wingman.ownerPlayerId}`) || p.ownerId.startsWith('wingman_');
          if (!isFriendly) {
            const dist = Math.hypot(p.x - wingman.x, p.z - wingman.z);
            if (dist <= radius) {
              destroyedCount++;
              return false; // neutralized by flak grid
            }
          }
          return true;
        });

        wingman.abilityCooldown = 25.0;
        wingman.abilityMaxCooldown = 25.0;

        this.pendingEvents.push({
          type: 'ABILITY_TRIGGERED',
          sourceId: wingman.id,
          x: wingman.x,
          z: wingman.z,
          data: {
            ability: 'POINT_DEFENSE',
            radius,
            destroyedProjectilesCount: destroyedCount,
            message: `🛡️ Point-Defense flak grid neutralized ${destroyedCount} hostile projectiles.`,
          },
        });

        return {
          success: true,
          ability: 'POINT_DEFENSE',
          cooldownRemaining: 25.0,
          message: `Point-Defense flak grid deployed around ${wingman.name} (${destroyedCount} projectiles destroyed).`,
        };
      }

      case 'PLASMA_LANCE': {
        let target: SectorEntity | null = null;
        if (targetEntityId) {
          target = this.entities.get(targetEntityId) || null;
        }
        if (!target || target.state === 'DESTROYED') {
          // Find nearest hostile entity within 100m
          let minD = 100.0;
          for (const other of this.entities.values()) {
            if (other.state === 'DESTROYED' || other.type === 'PLAYER' || other.type === 'WINGMAN' || other.isEscapePod) continue;
            const d = Math.hypot(other.x - wingman.x, other.z - wingman.z);
            if (d <= minD) {
              minD = d;
              target = other;
            }
          }
        }

        if (!target) {
          // Beam fires forward into space along wingman's yaw
          const beamDist = 100.0;
          const targetX = wingman.x + Math.sin(wingman.yaw) * beamDist;
          const targetZ = wingman.z + Math.cos(wingman.yaw) * beamDist;
          wingman.abilityCooldown = 30.0;
          wingman.abilityMaxCooldown = 30.0;

          this.pendingEvents.push({
            type: 'ABILITY_TRIGGERED',
            sourceId: wingman.id,
            damage: 0,
            x: wingman.x,
            z: wingman.z,
            data: {
              ability: 'PLASMA_LANCE',
              totalDamage: 0,
              targetX,
              targetZ,
              message: `⚡ Plasma Lance discharged forward into the void.`,
            },
          });

          return {
            success: true,
            ability: 'PLASMA_LANCE',
            cooldownRemaining: 30.0,
            message: `Plasma Lance discharged forward!`,
          };
        }

        const totalDamage = 70;
        const directHullDmg = 42; // 60% direct hull penetration
        const shieldDmg = 28;     // 40% absorbed by shield first

        target.lastHitTime = Date.now();
        let spillHull = 0;
        if (target.shields > 0) {
          if (target.shields >= shieldDmg) {
            target.shields -= shieldDmg;
          } else {
            spillHull = shieldDmg - target.shields;
            target.shields = 0;
          }
        } else {
          spillHull = shieldDmg;
        }

        target.hp = Math.max(0, target.hp - directHullDmg - spillHull);
        wingman.abilityCooldown = 30.0;
        wingman.abilityMaxCooldown = 30.0;

        this.pendingEvents.push({
          type: 'ABILITY_TRIGGERED',
          sourceId: wingman.id,
          targetId: target.id,
          damage: totalDamage,
          x: wingman.x,
          z: wingman.z,
          data: {
            ability: 'PLASMA_LANCE',
            totalDamage,
            directHullDmg,
            targetHp: target.hp,
            targetShields: target.shields,
            targetX: target.x,
            targetZ: target.z,
            message: `⚡ Plasma Lance fired at ${target.name} for 70 DMG (60% shield piercing).`,
          },
        });

        if (target.hp <= 0 && target.state !== 'DESTROYED') {
          this.handleEntityDestruction(target, wingman.id);
        }

        return {
          success: true,
          ability: 'PLASMA_LANCE',
          cooldownRemaining: 30.0,
          message: `Plasma Lance particle lance discharged at ${target.name}!`,
        };
      }

      case 'DECOY_HOLO': {
        const decoyId = `decoy_${wingman.id}_${Date.now()}`;
        const offsetAngle = Math.random() * Math.PI * 2;
        const offsetDist = 12.0;
        const dx = wingman.x + Math.sin(offsetAngle) * offsetDist;
        const dz = wingman.z + Math.cos(offsetAngle) * offsetDist;

        const decoyEntity: SectorEntity = {
          id: decoyId,
          type: 'DRONE',
          factionId: wingman.factionId,
          name: `${wingman.name} Sensor Ghost`,
          hullClass: 'DECOY',
          hullSeed: 9999,
          x: dx,
          z: dz,
          vx: wingman.vx,
          vz: wingman.vz,
          yaw: wingman.yaw,
          angularVelocity: 0,
          hp: 1,
          maxHp: 1,
          shields: 0,
          maxShields: 0,
          energy: 50,
          maxEnergy: 50,
          powerGridMax: 0,
          powerGridUsed: 0,
          cpuMax: 0,
          cpuUsed: 0,
          state: 'ENGAGE',
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
          fireCooldown: 999,
          isDecoy: true,
          decoyOwnerId: wingman.id,
          decoyTtl: 6.0,
        };

        this.entities.set(decoyId, decoyEntity);
        wingman.abilityCooldown = 30.0;
        wingman.abilityMaxCooldown = 30.0;

        this.pendingEvents.push({
          type: 'ABILITY_TRIGGERED',
          sourceId: wingman.id,
          x: dx,
          z: dz,
          data: {
            ability: 'DECOY_HOLO',
            decoyId,
            ttl: 6.0,
            x: dx,
            z: dz,
            message: `👻 Holographic decoy deployed by ${wingman.name} (TTL 6.0s).`,
          },
        });

        return {
          success: true,
          ability: 'DECOY_HOLO',
          cooldownRemaining: 30.0,
          message: `Holographic sensor ghost emitted! Enemy lock broke.`,
        };
      }

      case 'BIO_SPORE_CLOUD': {
        const cloudId = `cloud_${wingman.id}_${Date.now()}`;
        this.sporeClouds.push({
          id: cloudId,
          x: wingman.x,
          z: wingman.z,
          radius: 40.0,
          ttl: 5.0,
          maxTtl: 5.0,
          ownerId: wingman.id,
          dps: 14.0,
        });

        wingman.abilityCooldown = 35.0;
        wingman.abilityMaxCooldown = 35.0;

        this.pendingEvents.push({
          type: 'ABILITY_TRIGGERED',
          sourceId: wingman.id,
          x: wingman.x,
          z: wingman.z,
          data: {
            ability: 'BIO_SPORE_CLOUD',
            cloudId,
            radius: 40.0,
            ttl: 5.0,
            x: wingman.x,
            z: wingman.z,
            message: `☣️ Corrosive bio-spore cloud vented by ${wingman.name} (40m radius, 14 armor DoT/s).`,
          },
        });

        return {
          success: true,
          ability: 'BIO_SPORE_CLOUD',
          cooldownRemaining: 35.0,
          message: `Bio-Spore cloud vented! Caustic spore field active for 5s.`,
        };
      }

      case 'HARMONIC_SHIELD': {
        wingman.harmonicShieldActive = true;
        wingman.abilityActiveTimer = 6.0;
        wingman.abilityCooldown = 30.0;
        wingman.abilityMaxCooldown = 30.0;

        this.pendingEvents.push({
          type: 'ABILITY_TRIGGERED',
          sourceId: wingman.id,
          x: wingman.x,
          z: wingman.z,
          data: {
            ability: 'HARMONIC_SHIELD',
            duration: 6.0,
            x: wingman.x,
            z: wingman.z,
            message: `💎 Crystalline harmonic shield activated by ${wingman.name} (50% absorption, 25% reflection for 6s).`,
          },
        });

        return {
          success: true,
          ability: 'HARMONIC_SHIELD',
          cooldownRemaining: 30.0,
          message: `Harmonic crystalline barrier online for 6s!`,
        };
      }

      default:
        return {
          success: false,
          error: 'UNKNOWN_ABILITY',
          message: `Unknown ability: ${ability}`,
        };
    }
  }

  // Day 36: AAR Telemetry Helpers
  public recordDamage(attackerId: string | undefined, target: SectorEntity, damage: number): void {
    const dmg = Math.round(damage);
    if (dmg <= 0) return;

    // 1. Attacker dealt damage
    if (attackerId) {
      if (attackerId.startsWith('player_')) {
        const pid = attackerId.replace('player_', '');
        const aar = this.sessionAAR.get(pid);
        if (aar) {
          aar.flagship.damageDealt += dmg;
          aar.totalDamageDealt += dmg;
        }
      } else if (attackerId.startsWith('wingman_')) {
        const wm = this.entities.get(attackerId);
        if (wm && wm.ownerPlayerId) {
          const aar = this.sessionAAR.get(wm.ownerPlayerId);
          if (aar) {
            const esc = aar.escorts.find((e) => e.slot === wm.wingmanSlot);
            if (esc) esc.damageDealt += dmg;
            aar.totalDamageDealt += dmg;
          }
        }
      }
    }

    // 2. Target absorbed damage
    if (target.type === 'PLAYER') {
      const pid = target.id.replace('player_', '');
      const aar = this.sessionAAR.get(pid);
      if (aar) {
        aar.flagship.damageAbsorbed += dmg;
        aar.totalDamageAbsorbed += dmg;
      }
    } else if (target.type === 'WINGMAN' && target.ownerPlayerId) {
      const aar = this.sessionAAR.get(target.ownerPlayerId);
      if (aar) {
        const esc = aar.escorts.find((e) => e.slot === target.wingmanSlot);
        if (esc) {
          esc.damageAbsorbed += dmg;
          if (target.hp <= target.maxHp * 0.25) esc.status = 'CRITICAL';
        }
        aar.totalDamageAbsorbed += dmg;
      }
    }
  }

  public recordKill(killerId: string | undefined, target: SectorEntity): void {
    if (!killerId) return;
    if (killerId.startsWith('player_')) {
      const pid = killerId.replace('player_', '');
      const aar = this.sessionAAR.get(pid);
      if (aar) aar.flagship.kills += 1;
    } else if (killerId.startsWith('wingman_')) {
      const wm = this.entities.get(killerId);
      if (wm && wm.ownerPlayerId) {
        const aar = this.sessionAAR.get(wm.ownerPlayerId);
        if (aar) {
          const esc = aar.escorts.find((e) => e.slot === wm.wingmanSlot);
          if (esc) esc.kills += 1;
        }
      }
    }
  }

  public recordAbility(wingman: SectorEntity): void {
    if (wingman.ownerPlayerId) {
      const aar = this.sessionAAR.get(wingman.ownerPlayerId);
      if (aar) {
        const esc = aar.escorts.find((e) => e.slot === wingman.wingmanSlot);
        if (esc) esc.abilitiesTriggered += 1;
      }
    }
  }

  public finalizeAAR(playerId: string): CombatAAR {
    let aar = this.sessionAAR.get(playerId);
    if (!aar) {
      aar = {
        sessionId: `aar_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sectorId: this.sectorId,
        timestamp: new Date().toISOString(),
        flagship: { accountId: playerId, damageDealt: 0, damageAbsorbed: 0, kills: 0 },
        escorts: [],
        salvageCollected: 0,
        totalDamageDealt: 0,
        totalDamageAbsorbed: 0,
        medal: 'A',
      };
    }

    // Refresh escort statuses from live entities if still present
    for (const esc of aar.escorts) {
      const entity = Array.from(this.entities.values()).find(
        (e) => e.type === 'WINGMAN' && e.ownerPlayerId === playerId && e.wingmanSlot === esc.slot
      );
      if (entity) {
        if (entity.state === 'DESTROYED' || entity.hp <= 0) {
          esc.status = 'DESTROYED';
        } else if (entity.hp <= entity.maxHp * 0.25) {
          esc.status = 'CRITICAL';
        } else {
          esc.status = 'OPERATIONAL';
        }
      }
    }

    // Calculate medal rating
    const lostCount = aar.escorts.filter((e) => e.status === 'DESTROYED').length;
    if (lostCount === 0 && aar.totalDamageDealt >= 300) {
      aar.medal = 'S';
    } else if (lostCount === 0) {
      aar.medal = 'A';
    } else if (lostCount === 1) {
      aar.medal = 'B';
    } else {
      aar.medal = 'C';
    }

    SectorCombatManager.setLatestAAR(playerId, aar);
    return aar;
  }

  public removePlayer(playerId: string): void {
    // Day 36: Finalize AAR telemetry before despawning entities
    this.finalizeAAR(playerId);

    this.clients.delete(playerId);
    this.entities.delete(`player_${playerId}`);

    // Day 34: Despawn wingmen belonging to this player
    for (const [id, entity] of this.entities.entries()) {
      if (entity.type === 'WINGMAN' && entity.ownerPlayerId === playerId) {
        this.entities.delete(id);
      }
    }

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

    // 1. Process Drone, Hauler, Scavenger & Wingman AI
    this.processDroneAI(dt);
    this.processHaulerAI(dt);
    this.processScavengerAI(dt);
    this.processWingmanAI(dt, now);

    // 1b. Process Bio-Spore Clouds (Corrosive Armor DoT)
    if (this.sporeClouds.length > 0) {
      const livingClouds: SporeCloud[] = [];
      for (const cloud of this.sporeClouds) {
        cloud.ttl -= dt;
        if (cloud.ttl <= 0) continue;
        livingClouds.push(cloud);

        const dpsTick = cloud.dps * dt;
        for (const entity of this.entities.values()) {
          if (entity.state === 'DESTROYED' || entity.type === 'PLAYER' || entity.type === 'WINGMAN' || entity.isEscapePod) continue;
          const dist = Math.hypot(entity.x - cloud.x, entity.z - cloud.z);
          if (dist <= cloud.radius) {
            entity.hp = Math.max(0, entity.hp - dpsTick);
            entity.lastHitTime = now;
            if (entity.hp <= 0) {
              this.handleEntityDestruction(entity, cloud.ownerId);
            }
          }
        }
      }
      this.sporeClouds = livingClouds;
    }

    // 1c. Process Holographic Decoy Lifespans
    for (const entity of this.entities.values()) {
      if (entity.isDecoy && entity.state !== 'DESTROYED') {
        entity.decoyTtl = (entity.decoyTtl || 0) - dt;
        if (entity.decoyTtl <= 0) {
          entity.state = 'DESTROYED';
          this.entities.delete(entity.id);
        }
      }
    }

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

      // If player activates fire while comms stand-down is active, abort comms and resume battle
      if ((entity.inputs.firePrimary || entity.inputs.fireTactical) && entity.type === 'PLAYER' && this.isCommsStandDown) {
        this.isCommsStandDown = false;
        this.pendingEvents.push({
          type: 'COMMS_ABORTED',
          sourceId: entity.id,
          data: { reason: 'PLAYER_FIRED' },
        });
      }

      if (entity.inputs.firePrimary && entity.fireCooldown <= 0 && entity.energy >= 10) {
        this.dischargePrimaryWeapon(entity);
      }
    }

    // 4. Advance Projectiles and Check Hit Collisions
    this.advanceProjectiles(dt);

    // 5. Day 15 & Milestone 1.4: Elastic Tow Cable Physics, Laser Salvage & Space Ore Mining
    this.processTowPhysics(dt);
    this.processSalvageMining(dt);
    this.processAsteroidMining(dt, now);

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

  public startMiningBeam(playerId: string, asteroidId: string): { success: boolean; error?: string; asteroidId?: string } {
    const entity = this.entities.get(`player_${playerId}`);
    if (!entity || entity.state === 'DESTROYED' || entity.isEscapePod) {
      return { success: false, error: 'Ship cannot operate mining lasers in current state' };
    }
    const asteroid = this.asteroids.get(asteroidId);
    if (!asteroid || asteroid.depletedUntil !== null || asteroid.remainingYield <= 0) {
      return { success: false, error: 'Asteroid vein is depleted or unavailable' };
    }
    const profile = entity.miningProfile || computeMiningCapabilities(entity.hullClass, []);
    const dist = Math.hypot(asteroid.x - entity.x, asteroid.z - entity.z);
    if (dist > profile.beamRange + asteroid.radius) {
      return { success: false, error: `Asteroid out of mining range (${dist.toFixed(1)}m > ${profile.beamRange}m)` };
    }
    if (entity.energy < 4) {
      return { success: false, error: 'Insufficient capacitor energy to engage mining beam' };
    }

    entity.miningWreckId = null;
    entity.miningAsteroidId = asteroidId;
    entity.asteroidMiningTimer = 0.45; // Quick initial tick
    this.pendingEvents.push({
      type: 'MINING_BEAM_TICK',
      sourceId: entity.id,
      targetId: asteroid.id,
      x: asteroid.x,
      z: asteroid.z,
      data: {
        engaged: true,
        oreCommodityId: asteroid.oreCommodityId,
        oreName: asteroid.oreName,
        remainingYield: asteroid.remainingYield,
        heat: Math.round(entity.miningHeat || 0),
      },
    });
    return { success: true, asteroidId };
  }

  public stopMiningBeam(playerId: string): void {
    const entity = this.entities.get(`player_${playerId}`);
    if (entity) {
      entity.miningAsteroidId = null;
    }
  }

  private processAsteroidMining(dt: number, now: number): void {
    // 1. Respawn depleted asteroids & process thermal vent charging countdowns
    for (const ast of this.asteroids.values()) {
      if (ast.depletedUntil !== null && now >= ast.depletedUntil) {
        ast.depletedUntil = null;
        ast.hp = ast.maxHp;
        ast.fractured50 = false;
        ast.remainingYield = ast.maxYield;
        ast.heatState = 'NORMAL';
        ast.ventChargeUntil = null;
        ast.ventCooldownUntil = null;
      }

      if (ast.heatState === 'VENT_CHARGING' && ast.ventChargeUntil && now >= ast.ventChargeUntil) {
        this.triggerThermalVent(ast, now);
      } else if (ast.heatState === 'COOLED' && ast.ventCooldownUntil && now >= ast.ventCooldownUntil) {
        ast.heatState = 'NORMAL';
      }
    }

    // 2. Process active player mining beams & passive cooling
    for (const entity of this.entities.values()) {
      if (entity.type !== 'PLAYER' || entity.state === 'DESTROYED') continue;
      const profile = entity.miningProfile || computeMiningCapabilities(entity.hullClass, []);

      if (!entity.miningAsteroidId) {
        if ((entity.miningHeat || 0) > 0) {
          entity.miningHeat = Math.max(0, (entity.miningHeat || 0) - 4.0 * dt);
        }
        continue;
      }

      const ast = this.asteroids.get(entity.miningAsteroidId);
      if (!ast || ast.depletedUntil !== null || ast.remainingYield <= 0) {
        entity.miningAsteroidId = null;
        continue;
      }

      const dist = Math.hypot(ast.x - entity.x, ast.z - entity.z);
      if (dist > (profile.beamRange + ast.radius) * 1.15 || entity.energy < 2) {
        entity.miningAsteroidId = null;
        continue;
      }

      // Drain capacitor & build thermal signature
      entity.energy = Math.max(0, entity.energy - profile.energyCostPerSec * dt);
      const ore = SPACE_ORES[ast.oreCommodityId] || SPACE_ORES.COMM_ORE;
      const heatRate = ore.heatPerTick * 0.9 * profile.heatGenMultiplier;
      entity.miningHeat = Math.min(100, (entity.miningHeat || 0) + heatRate * dt);

      // Volatile thermal pocket trigger at >= 75% heat on Uncommon+ veins
      if (
        (entity.miningHeat || 0) >= 75 &&
        ast.tier !== 'COMMON' &&
        ast.heatState === 'NORMAL' &&
        (!ast.ventCooldownUntil || now >= ast.ventCooldownUntil)
      ) {
        ast.heatState = 'VENT_CHARGING';
        ast.ventChargeUntil = now + 2000;
        this.pendingEvents.push({
          type: 'THERMAL_VENT_WARNING',
          sourceId: entity.id,
          targetId: ast.id,
          x: ast.x,
          z: ast.z,
          data: {
            oreName: ast.oreName,
            blastRadius: 28,
            detonateInMs: 2000,
          },
        });
      }

      // Frontier / Hazard claim-jumper patrol ambush at >= 85% heat
      if (
        (entity.miningHeat || 0) >= 85 &&
        this.sectorId !== 1 &&
        (!entity.lastAmbushAt || now - entity.lastAmbushAt > 45000)
      ) {
        entity.lastAmbushAt = now;
        this.spawnMiningAmbush(entity);
      }

      entity.asteroidMiningTimer = (entity.asteroidMiningTimer || 0) + dt;
      if (entity.asteroidMiningTimer >= 0.5 && !entity.miningBusy) {
        entity.asteroidMiningTimer = 0;
        const rawUnits = Math.min(ast.remainingYield, profile.unitsPerTick);
        if (rawUnits <= 0) continue;

        const deliveredQty = Math.max(1, Math.round(rawUnits * profile.yieldMultiplier));
        const playerId = entity.id.replace('player_', '');
        entity.miningBusy = true;

        tradeService
          .addMinedOreToCargo(playerId, ast.oreCommodityId, deliveredQty)
          .then(async (res) => {
            entity.miningBusy = false;
            if (res.added <= 0) {
              entity.miningAsteroidId = null;
              this.pendingEvents.push({
                type: 'CARGO_HOLD_FULL',
                targetId: entity.id,
                data: {
                  usedCargo: res.usedCargo,
                  cargoCapacity: res.cargoCapacity,
                  commodityName: res.commodityName,
                },
              });
              return;
            }

            ast.remainingYield = Math.max(0, ast.remainingYield - rawUnits);
            ast.hp =
              ast.remainingYield > 0
                ? Math.max(1, Math.round(ast.maxHp * (ast.remainingYield / ast.maxYield)))
                : 0;

            this.pendingEvents.push({
              type: 'MINING_BEAM_TICK',
              sourceId: entity.id,
              targetId: ast.id,
              x: ast.x,
              z: ast.z,
              data: {
                extracted: res.added,
                oreCommodityId: ast.oreCommodityId,
                oreName: ast.oreName,
                remainingYield: ast.remainingYield,
                heat: Math.round(entity.miningHeat || 0),
                fuelRefined: res.fuelRefined,
              },
            });
            this.pendingEvents.push({
              type: 'MINING_YIELD',
              targetId: entity.id,
              x: ast.x,
              z: ast.z,
              data: {
                commodityId: ast.oreCommodityId,
                commodityName: ast.oreName,
                quantity: res.added,
                usedCargo: res.usedCargo,
                cargoCapacity: res.cargoCapacity,
                fuelRefined: res.fuelRefined,
              },
            });

            if (ast.remainingYield <= 0) {
              ast.depletedUntil = Date.now() + 90000;
              ast.heatState = 'COOLED';
              entity.miningAsteroidId = null;
              await this.awardPrecisionCompletion(entity, playerId, ast);
              this.pendingEvents.push({
                type: 'ASTEROID_DEPLETED',
                sourceId: entity.id,
                targetId: ast.id,
                x: ast.x,
                z: ast.z,
                data: {
                  oreName: ast.oreName,
                  precision: true,
                },
              });
            }
          })
          .catch((err) => {
            entity.miningBusy = false;
            console.error('[MINING] Cargo deposit error:', err);
          });
      }
    }
  }

  private async awardPrecisionCompletion(
    entity: SectorEntity,
    playerId: string,
    ast: AsteroidNode
  ): Promise<void> {
    const ore = SPACE_ORES[ast.oreCommodityId];
    if (!ore) return;

    let techAwarded = 0;
    if (ast.oreCommodityId === 'COMM_AETHER_CORE') {
      techAwarded = 2;
    } else if (ast.oreCommodityId === 'COMM_OBSIDIAN_MATRIX') {
      techAwarded = 1;
    } else if (ast.oreCommodityId === 'COMM_LITHIUM_QUARTZ') {
      entity.rarePrecisionCompletions = (entity.rarePrecisionCompletions || 0) + 1;
      if (entity.rarePrecisionCompletions % 3 === 0 || entity.miningProfile?.mainHullClass === 'INDUSTRIAL_EXTRACTOR') {
        techAwarded = 1;
      }
    }

    if (techAwarded > 0) {
      await db.query(
        'UPDATE accounts SET tech_components = tech_components + $1 WHERE id = $2',
        [techAwarded, playerId]
      );
      this.pendingEvents.push({
        type: 'LOOT_COLLECTED',
        targetId: entity.id,
        x: ast.x,
        z: ast.z,
        data: {
          title: `Precision Crystal Extraction (+${techAwarded} Tech Components)`,
          techComponents: techAwarded,
        },
      });
    }

    if (ore.minersGuildStanding > 0) {
      reputationService
        .modifyStanding(playerId, 'FACTION_MINERS_GUILD', ore.minersGuildStanding, 'PRECISION_MINING')
        .catch(() => {});
    }
  }

  private triggerThermalVent(ast: AsteroidNode, now: number, blastRadius: number = 28): void {
    ast.heatState = 'COOLED';
    ast.ventChargeUntil = null;
    ast.ventCooldownUntil = now + 20000;

    const hitTargets: string[] = [];
    for (const ent of this.entities.values()) {
      if (ent.state === 'DESTROYED' || ent.isEscapePod) continue;
      const d = Math.hypot(ent.x - ast.x, ent.z - ast.z);
      if (d <= blastRadius) {
        hitTargets.push(ent.id);
        let dmg = 22;
        if (ent.shields > 0) {
          const absorbed = Math.min(ent.shields, dmg);
          ent.shields -= absorbed;
          dmg -= absorbed;
        }
        if (dmg > 0) {
          ent.hp = Math.max(1, ent.hp - dmg);
        }
        ent.lastHitTime = now;
      }
    }

    this.pendingEvents.push({
      type: 'THERMAL_VENT_ERUPTION',
      sourceId: ast.id,
      x: ast.x,
      z: ast.z,
      data: {
        oreName: ast.oreName,
        blastRadius,
        hitTargets,
      },
    });
  }

  public spawnMiningAmbush(targetEntity: SectorEntity): string[] {
    const isKryllSector = this.sectorId === 7 || this.sectorId === 201;
    const factionId = isKryllSector ? 'FACTION_KRYLL' : 'FACTION_FREEBOOTERS';
    const count = targetEntity.miningProfile?.mainHullClass === 'INDUSTRIAL_EXTRACTOR' ? 2 : 1;
    const spawnedIds: string[] = [];

    for (let i = 0; i < count; i++) {
      const raiderId = `claimjumper_${this.sectorId}_${Date.now()}_${i}`;
      const angle = Math.PI * (0.4 + i * 0.9);
      const dist = 54;
      this.entities.set(raiderId, {
        id: raiderId,
        type: 'DRONE',
        factionId,
        name: factionId === 'FACTION_KRYLL' ? `Kryll Vein-Stalker 0${i + 1}` : `Freebooter Claim-Jumper 0${i + 1}`,
        hullClass: 'INTERCEPTOR',
        hullSeed: 64100 + Math.floor(Math.random() * 800),
        x: targetEntity.x + Math.cos(angle) * dist,
        z: targetEntity.z + Math.sin(angle) * dist,
        vx: 0,
        vz: 0,
        yaw: angle + Math.PI,
        angularVelocity: 0,
        hp: 85,
        maxHp: 85,
        shields: 55,
        maxShields: 55,
        energy: 100,
        maxEnergy: 100,
        powerGridMax: 100,
        powerGridUsed: 65,
        cpuMax: 140,
        cpuUsed: 80,
        state: 'ENGAGE',
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
        isAmbushRaider: true,
      });
      spawnedIds.push(raiderId);
    }

    this.pendingEvents.push({
      type: 'MINING_AMBUSH',
      targetId: targetEntity.id,
      x: targetEntity.x,
      z: targetEntity.z,
      data: {
        factionId,
        raiderIds: spawnedIds,
        message: `⚠️ ACOUSTIC SIGNATURE DETECTED! ${factionId === 'FACTION_KRYLL' ? 'Kryll' : 'Freebooter'} Claim-Jumpers warping in!`,
      },
    });
    return spawnedIds;
  }

  private integrateEntityPhysics(entity: SectorEntity, dt: number, now: number): void {
    const isEscapePod = entity.isEscapePod || entity.hullClass === 'ESCAPE_POD';
    let accel = isEscapePod ? 8.0 : entity.type === 'HAULER' ? 6.0 : entity.type === 'DRONE' ? 18.0 : entity.type === 'SCAVENGER' ? 14.0 : entity.type === 'WINGMAN' ? 24.0 : 22.0;
    const turnAccel = isEscapePod ? 2.0 : entity.type === 'HAULER' ? 1.4 : entity.type === 'SCAVENGER' ? 2.8 : entity.type === 'WINGMAN' ? 3.4 : 3.6;
    let maxSpeed = isEscapePod ? 13.0 : entity.type === 'HAULER' ? 10.0 : entity.type === 'DRONE' ? 24.0 : entity.type === 'SCAVENGER' ? 18.0 : entity.type === 'WINGMAN' ? 30.0 : 28.0;

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
      maxSpeed = entity.type === 'DRONE' ? 42.0 : entity.type === 'WINGMAN' ? 44.0 : 48.0;
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
    // Locate nearest active player ship (or active holo-decoy!) in sector
    let targetPlayer: SectorEntity | null = null;
    let minDistance = Infinity;

    // Day 35: Decoy Attraction Priority
    let activeDecoy: SectorEntity | null = null;
    let minDecoyDist = Infinity;
    for (const entity of this.entities.values()) {
      if (entity.isDecoy && entity.state !== 'DESTROYED') {
        const dist = Math.hypot(entity.x, entity.z);
        if (dist < minDecoyDist) {
          minDecoyDist = dist;
          activeDecoy = entity;
        }
      }
    }

    if (activeDecoy) {
      targetPlayer = activeDecoy;
      minDistance = minDecoyDist;
    } else {
      for (const entity of this.entities.values()) {
        if (entity.type === 'PLAYER' && entity.state !== 'DESTROYED') {
          const dist = Math.sqrt(entity.x * entity.x + entity.z * entity.z);
          if (dist < minDistance) {
            minDistance = dist;
            targetPlayer = entity;
          }
        }
      }
    }

    const hasTruce = targetPlayer ? this.isTruceActive(targetPlayer.id, 'FACTION_HEGEMONY') : false;

    for (const drone of this.entities.values()) {
      if (drone.type !== 'DRONE' || drone.state === 'DESTROYED') continue;

      // Day 24: Comms Stand-Down Protocol (escorts hold fire while comms transmission is open)
      if (this.isCommsStandDown) {
        drone.state = 'TRUCE';
        drone.inputs.firePrimary = false;
        drone.inputs.fireTactical = false;
        continue;
      }

      // Day 25: Ambush Raiders targeting Bulk Hauler
      if (drone.isAmbushRaider && drone.targetHaulerId) {
        const hauler = this.entities.get(drone.targetHaulerId);
        if (hauler && hauler.state !== 'DESTROYED') {
          drone.state = 'ENGAGE';
          const dx = hauler.x - drone.x;
          const dz = hauler.z - drone.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const desiredYaw = Math.atan2(dx, dz);
          let yawDiff = desiredYaw - drone.yaw;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

          drone.inputs.turnLeft = yawDiff > 0.08;
          drone.inputs.turnRight = yawDiff < -0.08;
          drone.inputs.forward = dist > 20.0;
          drone.inputs.brake = dist <= 15.0;
          drone.inputs.firePrimary = Math.abs(yawDiff) < 0.35 && dist < 65.0;
          continue;
        }
      }

      // Day 25: Skirmish Arena Autonomous Inter-Faction Dogfighting
      if (this.isSkirmishArena && drone.isSkirmishVessel) {
        let nearestEnemy: SectorEntity | null = null;
        let nearestEnemyDist = Infinity;

        for (const other of this.entities.values()) {
          if (other.id === drone.id || other.state === 'DESTROYED') continue;
          const isEnemyDrone = other.type === 'DRONE' && other.isSkirmishVessel && other.allegiance !== drone.allegiance;
          const isEnemyPlayer = other.type === 'PLAYER' && other.allegiance && other.allegiance !== drone.allegiance;

          if (isEnemyDrone || isEnemyPlayer) {
            const dist = Math.hypot(other.x - drone.x, other.z - drone.z);
            if (dist < nearestEnemyDist) {
              nearestEnemyDist = dist;
              nearestEnemy = other;
            }
          }
        }

        if (nearestEnemy) {
          drone.state = 'ENGAGE';
          const dx = nearestEnemy.x - drone.x;
          const dz = nearestEnemy.z - drone.z;
          const desiredYaw = Math.atan2(dx, dz);
          let yawDiff = desiredYaw - drone.yaw;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

          drone.inputs.turnLeft = yawDiff > 0.08;
          drone.inputs.turnRight = yawDiff < -0.08;
          drone.inputs.forward = nearestEnemyDist > 25.0;
          drone.inputs.brake = nearestEnemyDist <= 18.0;
          drone.inputs.firePrimary = Math.abs(yawDiff) < 0.35 && nearestEnemyDist < 75.0;
          continue;
        }
      }

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

  /**
   * Day 34: 20Hz Wingman Formation Flight AI & Tactical Directive Processing
   */
  private processWingmanAI(dt: number, now: number): void {
    // 1. Group living wingmen by owner player ID
    const wingmenByPlayer = new Map<string, SectorEntity[]>();
    for (const entity of this.entities.values()) {
      if (entity.type === 'WINGMAN' && entity.state !== 'DESTROYED' && entity.ownerPlayerId) {
        const list = wingmenByPlayer.get(entity.ownerPlayerId) || [];
        list.push(entity);
        wingmenByPlayer.set(entity.ownerPlayerId, list);
      }
    }

    for (const [playerId, wingmen] of wingmenByPlayer.entries()) {
      const flagship = this.entities.get(`player_${playerId}`);
      if (!flagship || flagship.state === 'DESTROYED') {
        for (const w of wingmen) {
          w.inputs.forward = false;
          w.inputs.brake = true;
          w.inputs.firePrimary = false;
          w.inputs.fireTactical = false;
        }
        continue;
      }

      // Friendly squadron fleet group (flagship + active wingmen) for soft proximity repulsion
      const friendlySquadron: SectorEntity[] = [flagship, ...wingmen];

      for (const wingman of wingmen) {
        // Cooldown & Active Timer Tick Down
        if (wingman.abilityCooldown && wingman.abilityCooldown > 0) {
          wingman.abilityCooldown = Math.max(0, wingman.abilityCooldown - dt);
        }
        if (wingman.abilityActiveTimer && wingman.abilityActiveTimer > 0) {
          wingman.abilityActiveTimer = Math.max(0, wingman.abilityActiveTimer - dt);
          if (wingman.abilityActiveTimer <= 0) {
            wingman.harmonicShieldActive = false;
          }
        }

        // Autonomous Signature Fleet Ability Trigger Under Tactical Distress
        if ((wingman.abilityCooldown || 0) <= 0) {
          let ab = wingman.specialAbility || 'POINT_DEFENSE';
          if (ab === 'PLASMA_BARRAGE') ab = 'PLASMA_LANCE';
          if (ab === 'SHOCKWAVE') ab = 'HARMONIC_SHIELD';

          if (ab === 'POINT_DEFENSE') {
            const hostileProjNear = this.projectiles.some((p) => {
              const isFriendly = p.ownerId === wingman.id || (wingman.ownerPlayerId && p.ownerId === `player_${wingman.ownerPlayerId}`) || p.ownerId.startsWith('wingman_');
              if (isFriendly) return false;
              const dToWingman = Math.hypot(p.x - wingman.x, p.z - wingman.z);
              const dToFlagship = Math.hypot(p.x - flagship.x, p.z - flagship.z);
              return dToWingman <= 32.0 || dToFlagship <= 32.0;
            });
            if (hostileProjNear) {
              this.triggerWingmanAbility(wingman);
            }
          } else if (ab === 'PLASMA_LANCE') {
            let targetCandidate: SectorEntity | null = null;
            let minCandDist = 95.0;
            for (const other of this.entities.values()) {
              if (other.state === 'DESTROYED' || other.type === 'PLAYER' || other.type === 'WINGMAN' || other.isEscapePod) continue;
              const dx = other.x - wingman.x;
              const dz = other.z - wingman.z;
              const dist = Math.hypot(dx, dz);
              if (dist <= minCandDist) {
                const aimYaw = Math.atan2(dx, dz);
                let diff = aimYaw - wingman.yaw;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                if (Math.abs(diff) < 0.6) {
                  minCandDist = dist;
                  targetCandidate = other;
                }
              }
            }
            if (targetCandidate) {
              this.triggerWingmanAbility(wingman, targetCandidate.id);
            }
          } else if (ab === 'DECOY_HOLO') {
            const wingmanDistress = wingman.shields <= 0;
            const flagshipDistress = flagship.shields < (flagship.maxShields * 0.25);
            if (wingmanDistress || flagshipDistress) {
              this.triggerWingmanAbility(wingman);
            }
          } else if (ab === 'BIO_SPORE_CLOUD') {
            let hostileCount = 0;
            for (const other of this.entities.values()) {
              if (other.state === 'DESTROYED' || other.type === 'PLAYER' || other.type === 'WINGMAN' || other.isEscapePod) continue;
              const dist = Math.hypot(other.x - wingman.x, other.z - wingman.z);
              if (dist <= 45.0) hostileCount++;
            }
            if (hostileCount >= 2) {
              this.triggerWingmanAbility(wingman);
            }
          } else if (ab === 'HARMONIC_SHIELD') {
            const tookRecentDamage = (now - wingman.lastHitTime) < 1500;
            const shieldsLow = wingman.shields < (wingman.maxShields * 0.50);
            if (tookRecentDamage && shieldsLow) {
              this.triggerWingmanAbility(wingman);
            }
          }
        }

        // A. Soft Proximity Repulsion (r < 25m) to avoid friendly overlap & rigid collision jitter
        let repulseVx = 0;
        let repulseVz = 0;
        const minSafeDist = 25.0;

        for (const other of friendlySquadron) {
          if (other.id === wingman.id || other.state === 'DESTROYED') continue;
          const rdx = wingman.x - other.x;
          const rdz = wingman.z - other.z;
          const dist = Math.hypot(rdx, rdz);
          if (dist < minSafeDist && dist > 0.01) {
            const factor = (minSafeDist - dist) / minSafeDist; // 0..1
            const pushAcc = factor * factor * 16.0; // smooth quadratic push
            repulseVx += (rdx / dist) * pushAcc;
            repulseVz += (rdz / dist) * pushAcc;
          }
        }
        wingman.vx += repulseVx * dt;
        wingman.vz += repulseVz * dt;

        // B. Handle Tactical Order
        const order = wingman.tacticalOrder || 'FORMATION_FOLLOW';

        switch (order) {
          case 'FOCUS_TARGET': {
            const targetId = wingman.targetEntityId || flagship.targetEntityId;
            const target = targetId ? this.entities.get(targetId) : null;

            if (!target || target.state === 'DESTROYED') {
              wingman.tacticalOrder = 'FORMATION_FOLLOW';
              wingman.targetEntityId = null;
              break;
            }

            const dx = target.x - wingman.x;
            const dz = target.z - wingman.z;
            const dist = Math.hypot(dx, dz);
            const desiredYaw = Math.atan2(dx, dz);

            let yawDiff = desiredYaw - wingman.yaw;
            while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
            while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

            wingman.inputs.turnLeft = yawDiff > 0.12;
            wingman.inputs.turnRight = yawDiff < -0.12;

            if (dist > 80.0) {
              wingman.inputs.forward = true;
              wingman.inputs.brake = false;
              wingman.inputs.fireTactical = dist > 140.0;
            } else if (dist < 40.0) {
              wingman.inputs.forward = false;
              wingman.inputs.brake = true;
              wingman.inputs.fireTactical = false;
            } else {
              wingman.inputs.forward = true;
              wingman.inputs.brake = false;
              wingman.inputs.fireTactical = false;
            }

            const facingTarget = Math.abs(yawDiff) < 0.44;
            wingman.inputs.firePrimary = facingTarget && dist <= 110.0;
            break;
          }

          case 'ESCORT_FLAGSHIP': {
            let threat: SectorEntity | null = null;
            let minThreatDist = Infinity;

            for (const other of this.entities.values()) {
              if (
                other.state === 'DESTROYED' ||
                other.type === 'PLAYER' ||
                other.type === 'WINGMAN' ||
                other.type === 'WRECK' ||
                other.type === 'CARGO_CRATE'
              ) {
                continue;
              }
              const distToFlagship = Math.hypot(other.x - flagship.x, other.z - flagship.z);
              if (distToFlagship < 90.0 && distToFlagship < minThreatDist) {
                minThreatDist = distToFlagship;
                threat = other;
              }
            }

            const distToFlagship = Math.hypot(wingman.x - flagship.x, wingman.z - flagship.z);

            if (threat && distToFlagship < 60.0) {
              const dx = threat.x - wingman.x;
              const dz = threat.z - wingman.z;
              const dist = Math.hypot(dx, dz);
              const desiredYaw = Math.atan2(dx, dz);

              let yawDiff = desiredYaw - wingman.yaw;
              while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
              while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

              wingman.inputs.turnLeft = yawDiff > 0.12;
              wingman.inputs.turnRight = yawDiff < -0.12;
              wingman.inputs.forward = dist > 35.0;
              wingman.inputs.brake = dist <= 25.0;
              wingman.inputs.firePrimary = Math.abs(yawDiff) < 0.44 && dist <= 95.0;
            } else {
              const slot = wingman.wingmanSlot || 1;
              const orbitAngle = flagship.yaw + (slot * Math.PI) / 2.5;
              const targetX = flagship.x + Math.sin(orbitAngle) * 38.0;
              const targetZ = flagship.z + Math.cos(orbitAngle) * 38.0;

              const dx = targetX - wingman.x;
              const dz = targetZ - wingman.z;
              const dist = Math.hypot(dx, dz);
              const desiredYaw = Math.atan2(dx, dz);

              let yawDiff = desiredYaw - wingman.yaw;
              while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
              while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

              wingman.inputs.turnLeft = yawDiff > 0.12;
              wingman.inputs.turnRight = yawDiff < -0.12;
              wingman.inputs.forward = dist > 3.0;
              wingman.inputs.brake = dist <= 2.0;
              wingman.inputs.firePrimary = false;
            }
            break;
          }

          case 'FLANK_HARASS': {
            let hostileCenterX = 0;
            let hostileCenterZ = 0;
            let hostileCount = 0;

            for (const other of this.entities.values()) {
              if (
                other.state === 'DESTROYED' ||
                other.type === 'PLAYER' ||
                other.type === 'WINGMAN' ||
                other.type === 'WRECK' ||
                other.type === 'CARGO_CRATE'
              ) {
                continue;
              }
              hostileCenterX += other.x;
              hostileCenterZ += other.z;
              hostileCount++;
            }

            if (hostileCount > 0) {
              hostileCenterX /= hostileCount;
              hostileCenterZ /= hostileCount;

              const orbitRadius = 120.0;
              const angle = Math.atan2(wingman.x - hostileCenterX, wingman.z - hostileCenterZ) + 0.35;
              const targetX = hostileCenterX + Math.sin(angle) * orbitRadius;
              const targetZ = hostileCenterZ + Math.cos(angle) * orbitRadius;

              const dx = targetX - wingman.x;
              const dz = targetZ - wingman.z;
              const desiredYaw = Math.atan2(dx, dz);

              let yawDiff = desiredYaw - wingman.yaw;
              while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
              while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

              wingman.inputs.turnLeft = yawDiff > 0.1;
              wingman.inputs.turnRight = yawDiff < -0.1;
              wingman.inputs.forward = true;
              wingman.inputs.brake = false;
              wingman.inputs.fireTactical = true;

              const toCenterX = hostileCenterX - wingman.x;
              const toCenterZ = hostileCenterZ - wingman.z;
              const centerDist = Math.hypot(toCenterX, toCenterZ);
              const aimYaw = Math.atan2(toCenterX, toCenterZ);
              let aimDiff = aimYaw - wingman.yaw;
              while (aimDiff < -Math.PI) aimDiff += Math.PI * 2;
              while (aimDiff > Math.PI) aimDiff -= Math.PI * 2;

              wingman.inputs.firePrimary = Math.abs(aimDiff) < 0.6 && centerDist <= 135.0;
            } else {
              wingman.tacticalOrder = 'FORMATION_FOLLOW';
            }
            break;
          }

          case 'REGROUP_HOLD': {
            // Strict ceasefire!
            wingman.inputs.firePrimary = false;

            const slot = wingman.wingmanSlot || 1;
            const offset = WINGMAN_FORMATION_OFFSETS[slot] || { x: -35.0, z: -25.0 };
            const cosY = Math.cos(flagship.yaw);
            const sinY = Math.sin(flagship.yaw);
            const targetX = flagship.x + (offset.x * cosY + offset.z * sinY);
            const targetZ = flagship.z + (-offset.x * sinY + offset.z * cosY);

            const dx = targetX - wingman.x;
            const dz = targetZ - wingman.z;
            const dist = Math.hypot(dx, dz);

            if (dist < 8.0) {
              wingman.tacticalOrder = 'FORMATION_FOLLOW';
              wingman.inputs.forward = false;
              wingman.inputs.brake = true;
              wingman.inputs.fireTactical = false;
              wingman.vx = flagship.vx;
              wingman.vz = flagship.vz;
              wingman.yaw = flagship.yaw;
            } else {
              const desiredYaw = Math.atan2(dx, dz);
              let yawDiff = desiredYaw - wingman.yaw;
              while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
              while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

              wingman.inputs.turnLeft = yawDiff > 0.12;
              wingman.inputs.turnRight = yawDiff < -0.12;
              wingman.inputs.forward = true;
              wingman.inputs.brake = false;
              wingman.inputs.fireTactical = dist > 25.0;
            }
            break;
          }

          case 'FORMATION_FOLLOW':
          default: {
            const slot = wingman.wingmanSlot || 1;
            const offset = WINGMAN_FORMATION_OFFSETS[slot] || { x: -35.0, z: -25.0 };
            const cosY = Math.cos(flagship.yaw);
            const sinY = Math.sin(flagship.yaw);
            const targetX = flagship.x + (offset.x * cosY + offset.z * sinY);
            const targetZ = flagship.z + (-offset.x * sinY + offset.z * cosY);

            const dx = targetX - wingman.x;
            const dz = targetZ - wingman.z;
            const dist = Math.hypot(dx, dz);

            if (dist < 2.5) {
              wingman.inputs.turnLeft = false;
              wingman.inputs.turnRight = false;
              wingman.inputs.forward = false;
              wingman.inputs.brake = true;
              wingman.inputs.fireTactical = false;
              wingman.vx = flagship.vx;
              wingman.vz = flagship.vz;
              wingman.yaw = flagship.yaw;
            } else {
              const desiredYaw = Math.atan2(dx, dz);
              let yawDiff = desiredYaw - wingman.yaw;
              while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
              while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

              wingman.inputs.turnLeft = yawDiff > 0.1;
              wingman.inputs.turnRight = yawDiff < -0.1;
              wingman.inputs.forward = dist > 2.0;
              wingman.inputs.brake = dist <= 1.5;
              wingman.inputs.fireTactical = dist > 60.0;
            }

            let targetHostile: SectorEntity | null = null;
            let minHdist = Infinity;

            for (const other of this.entities.values()) {
              if (
                other.state === 'DESTROYED' ||
                other.type === 'PLAYER' ||
                other.type === 'WINGMAN' ||
                other.type === 'WRECK' ||
                other.type === 'CARGO_CRATE'
              ) {
                continue;
              }
              const hdx = other.x - wingman.x;
              const hdz = other.z - wingman.z;
              const hdist = Math.hypot(hdx, hdz);
              if (hdist <= 75.0 && hdist < minHdist) {
                const hYaw = Math.atan2(hdx, hdz);
                let hDiff = hYaw - wingman.yaw;
                while (hDiff < -Math.PI) hDiff += Math.PI * 2;
                while (hDiff > Math.PI) hDiff -= Math.PI * 2;
                if (Math.abs(hDiff) <= Math.PI / 6) {
                  minHdist = hdist;
                  targetHostile = other;
                }
              }
            }

            wingman.inputs.firePrimary = !!targetHostile;
            break;
          }
        }
      }
    }
  }

  private dischargePrimaryWeapon(entity: SectorEntity): void {
    if (entity.type === 'WINGMAN') {
      if (entity.energy < 8) return;
      entity.energy -= 8;
      entity.fireCooldown = 0.22;
      const forwardX = Math.sin(entity.yaw);
      const forwardZ = Math.cos(entity.yaw);
      const muzzleSpeed = 70.0;
      let color = '#38bdf8'; // Sol cyan default
      if (entity.factionId === 'FACTION_VAELIC') color = '#a855f7';
      else if (entity.factionId === 'FACTION_KRYLL') color = '#22c55e';
      else if (entity.factionId === 'FACTION_LITHOS') color = '#eab308';

      this.projectiles.push({
        id: `proj_${++this.projectileSeq}_${Date.now()}`,
        ownerId: entity.id,
        x: entity.x + forwardX * 3.8,
        z: entity.z + forwardZ * 3.8,
        vx: entity.vx * 0.3 + forwardX * muzzleSpeed,
        vz: entity.vz * 0.3 + forwardZ * muzzleSpeed,
        damage: 20,
        ttl: 1.8,
        color,
        projType: 'PULSE',
      });
      return;
    }

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

    const weaponId = (entity.inputs.activeWeaponId as 'PULSE' | 'PLASMA' | 'FLAK' | 'RAIL' | 'TORPEDO') || 'PULSE';
    const forwardX = Math.sin(entity.yaw);
    const forwardZ = Math.cos(entity.yaw);

    if (weaponId === 'RAIL') {
      if (entity.energy < 20) return;
      entity.energy -= 20;
      entity.fireCooldown = 0.55;
      const muzzleSpeed = 120.0;
      this.projectiles.push({
        id: `proj_${++this.projectileSeq}_${Date.now()}`,
        ownerId: entity.id,
        x: entity.x + forwardX * 4.2,
        z: entity.z + forwardZ * 4.2,
        vx: entity.vx * 0.25 + forwardX * muzzleSpeed,
        vz: entity.vz * 0.25 + forwardZ * muzzleSpeed,
        damage: 56,
        ttl: 2.0,
        color: '#c084fc',
        projType: 'PLASMA',
      });
    } else if (weaponId === 'TORPEDO') {
      if (entity.energy < 30) return;
      entity.energy -= 30;
      entity.fireCooldown = 0.75;
      const muzzleSpeed = 42.0;
      this.projectiles.push({
        id: `proj_${++this.projectileSeq}_${Date.now()}`,
        ownerId: entity.id,
        x: entity.x + forwardX * 4.4,
        z: entity.z + forwardZ * 4.4,
        vx: entity.vx * 0.2 + forwardX * muzzleSpeed,
        vz: entity.vz * 0.2 + forwardZ * muzzleSpeed,
        damage: 78,
        ttl: 3.0,
        color: '#f97316',
        projType: 'PLASMA',
      });
    } else if (weaponId === 'PLASMA') {
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

        // Friendly fire protection between player flagship and their wingmen, and between co-wingmen
        const projOwner = this.entities.get(proj.ownerId);
        const isFriendlySquadron =
          (entity.type === 'WINGMAN' && entity.ownerPlayerId === proj.ownerId.replace('player_', '')) ||
          (projOwner?.type === 'WINGMAN' && entity.id === `player_${projOwner.ownerPlayerId}`) ||
          (projOwner?.type === 'WINGMAN' && entity.type === 'WINGMAN' && projOwner.ownerPlayerId === entity.ownerPlayerId);

        if (isFriendlySquadron) continue;

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

      // Milestone 1.4: Mode A Weapon Fracturing against Asteroids
      if (!hit) {
        for (const ast of this.asteroids.values()) {
          if (ast.depletedUntil !== null || ast.hp <= 0) continue;
          const dx = ast.x - proj.x;
          const dz = ast.z - proj.z;
          const hitRad = ast.radius + 1.2;
          if (dx * dx + dz * dz <= hitRad * hitRad) {
            hit = true;
            ast.hp -= proj.damage;

            const dropOrePod = (qty: number, suffix: string) => {
              const offsetAngle = Math.random() * Math.PI * 2;
              const containerId = `ore_${ast.id}_${suffix}_${Date.now()}`;
              this.containers.push({
                id: containerId,
                x: Math.round((ast.x + Math.cos(offsetAngle) * (ast.radius + 3.5)) * 10) / 10,
                z: Math.round((ast.z + Math.sin(offsetAngle) * (ast.radius + 3.5)) * 10) / 10,
                title: `${ast.oreName} (${qty}x)`,
                rarity: ast.tier === 'EXOTIC' ? 'LEGENDARY' : ast.tier,
                items: [
                  {
                    type: 'ORE',
                    name: ast.oreName,
                    commodityId: ast.oreCommodityId,
                    quantity: qty,
                  },
                ],
                createdAt: Date.now(),
              });
            };

            if (!ast.fractured50 && ast.hp <= ast.maxHp * 0.5 && ast.hp > 0) {
              ast.fractured50 = true;
              const podQty = Math.max(1, Math.round(ast.maxYield * 0.25));
              ast.remainingYield = Math.max(0, ast.remainingYield - podQty);
              dropOrePod(podQty, '50');
              this.pendingEvents.push({
                type: 'ASTEROID_FRACTURED',
                sourceId: proj.ownerId,
                targetId: ast.id,
                x: ast.x,
                z: ast.z,
                data: { oreName: ast.oreName, quantity: podQty },
              });
            }

            if (ast.hp <= 0) {
              const podQty = Math.max(1, Math.round(ast.maxYield * 0.3));
              ast.hp = 0;
              ast.remainingYield = 0;
              ast.depletedUntil = Date.now() + 90000;
              dropOrePod(podQty, '0');
              if (ast.tier === 'RARE' || ast.tier === 'EPIC' || ast.tier === 'EXOTIC') {
                this.triggerThermalVent(ast, Date.now(), 14);
              } else {
                ast.heatState = 'COOLED';
              }
              this.pendingEvents.push({
                type: 'ASTEROID_DEPLETED',
                sourceId: proj.ownerId,
                targetId: ast.id,
                x: ast.x,
                z: ast.z,
                data: { oreName: ast.oreName, precision: false, quantity: podQty },
              });
            }
            break;
          }
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

    // Day 36: Record combat damage in session AAR
    this.recordDamage(proj.ownerId, target, proj.damage);

    // Day 35: Lithos Harmonic Resonant Shield (50% absorption, 25% reflection)
    if (target.harmonicShieldActive) {
      const absorbed = damageRemaining * 0.50;
      const reflected = damageRemaining * 0.25;
      damageRemaining = absorbed;

      if (proj.ownerId) {
        const attacker = this.entities.get(proj.ownerId);
        if (attacker && attacker.id !== target.id && attacker.state !== 'DESTROYED') {
          if (attacker.shields > 0) {
            if (attacker.shields >= reflected) {
              attacker.shields -= reflected;
            } else {
              const rem = reflected - attacker.shields;
              attacker.shields = 0;
              attacker.hp = Math.max(0, attacker.hp - rem);
            }
          } else {
            attacker.hp = Math.max(0, attacker.hp - reflected);
          }

          this.pendingEvents.push({
            type: 'HIT',
            sourceId: target.id,
            targetId: attacker.id,
            damage: Math.round(reflected * 10) / 10,
            hitShield: attacker.shields > 0,
            x: attacker.x,
            z: attacker.z,
          });

          if (attacker.hp <= 0) {
            this.handleEntityDestruction(attacker, target.id);
          }
        }
      }
    }

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
    const wreckId = `wreck_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Day 36: Record kill in session AAR
    this.recordKill(killerId, target);

    this.pendingEvents.push({
      type: 'DESTROYED',
      targetId: target.id,
      sourceId: killerId,
      x: target.x,
      z: target.z,
    });

    // Day 34 & Day 35: Wingman Destruction & High-Value Salvage
    if (target.type === 'WINGMAN') {
      if (target.ownerPlayerId) {
        const aar = this.sessionAAR.get(target.ownerPlayerId);
        if (aar) {
          const esc = aar.escorts.find((e) => e.slot === target.wingmanSlot);
          if (esc) esc.status = 'DESTROYED';
        }
      }

      this.pendingEvents.push({
        type: 'WINGMAN_DESTROYED',
        sourceId: killerId,
        targetId: target.id,
        data: {
          shipId: target.shipId,
          wingmanSlot: target.wingmanSlot,
          ownerPlayerId: target.ownerPlayerId,
          name: target.name,
          wreckId,
          message: `🚨 WINGMAN LOST: ${target.name} destroyed!`,
        },
      });
      if (target.shipId) {
        db.query(`UPDATE player_fleet SET status = 'DESTROYED', deployment_slot = NULL WHERE id = $1`, [target.shipId]).catch(console.error);
      }

      // Spawn rare escort salvage cargo container
      const escortCanisterId = `loot_escort_wreck_${Date.now()}`;
      this.containers.push({
        id: escortCanisterId,
        x: Math.round(target.x * 10) / 10,
        z: Math.round(target.z * 10) / 10,
        title: `${target.name} Salvage Pod`,
        rarity: 'RARE',
        items: [
          { commodityId: 'COMM_ALLOY', name: 'Plasteel Salvage Alloy', quantity: 12, category: 'COMMODITY', unitValue: 120 },
          { commodityId: 'COMM_FUEL', name: 'Recovered Deuterium Core', quantity: 6, category: 'COMMODITY', unitValue: 90 },
        ],
        createdAt: Date.now(),
      });
    }

    // Day 17: Faction standing penalty for destroying Hegemony patrol drone
    if (killerId && (target.factionId === 'FACTION_VAELIC' || target.factionId === 'FACTION_HEGEMONY')) {
      reputationService.modifyStanding(killerId, 'FACTION_HEGEMONY', -15, `Destroyed ${target.name}`).catch(() => {});
    }

    // Milestone 1.1: Notify Galactic Mission Board on hostile bounty elimination
    if (target.type !== 'PLAYER') {
      const killerAccountId = killerId
        ? killerId.startsWith('player_')
          ? killerId.replace('player_', '')
          : killerId
        : 'acc_sol_captain';
      import('./GalacticMissionService')
        .then(({ galacticMissionService }) =>
          galacticMissionService.recordBountyKill(killerAccountId, this.sectorId, target.name, target.id)
        )
        .catch(() => {});
    }

    // Day 25: Convoy Hauler Destruction (Escort contract failure & economic shortage)
    if (target.isConvoyHauler) {
      this.pendingEvents.push({
        type: 'ESCORT_FAILED',
        sourceId: target.id,
        data: {
          convoyId: target.convoyId,
          message: '🚨 CONVOY DESTROYED // ESCORT CONTRACT FAILED',
        },
      });

      if (target.convoyId) {
        convoyService.recordConvoyRaid(target.convoyId, 'DESTROYED').catch(() => {});
        db.query(`UPDATE escort_contracts SET status = 'FAILED' WHERE convoy_id = $1 AND status = 'ACCEPTED'`, [target.convoyId]).catch(() => {});
      }
    }

    // Day 25: Ambush Raider Destruction Check
    if (target.isAmbushRaider && target.targetHaulerId) {
      let remainingRaiders = 0;
      for (const e of this.entities.values()) {
        if (e.id !== target.id && e.isAmbushRaider && e.targetHaulerId === target.targetHaulerId && e.state !== 'DESTROYED') {
          remainingRaiders++;
        }
      }
      if (remainingRaiders === 0) {
        const hauler = this.entities.get(target.targetHaulerId);
        this.pendingEvents.push({
          type: 'AMBUSH_CLEARED',
          sourceId: target.targetHaulerId,
          data: {
            convoyId: hauler?.convoyId,
            message: '🛡️ AMBUSH REPELLED // ESCORT ROUTE SECURED',
          },
        });
      }
    }

    // Day 25: Skirmish Arena Vessel Destruction & Combat Bonds
    if (this.isSkirmishArena && target.isSkirmishVessel && target.allegiance) {
      const opposingFaction = target.allegiance as 'FACTION_HEGEMONY' | 'FACTION_KRYLL';
      if (this.skirmishScores[opposingFaction] !== undefined) {
        this.skirmishScores[opposingFaction] = Math.max(0, this.skirmishScores[opposingFaction] - 25);
      }

      // Check if player scored the kill and had opposing allegiance
      if (killerId && killerId.startsWith('player_')) {
        const playerId = killerId.replace('player_', '');
        const pAllegiance = this.playerAllegiances.get(playerId);
        if (pAllegiance && pAllegiance !== target.allegiance) {
          const currentBonds = this.playerCombatBonds.get(playerId) || 0;
          this.playerCombatBonds.set(playerId, currentBonds + 750);

          db.query('UPDATE accounts SET credits = credits + 750 WHERE id = $1', [playerId]).catch(() => {});

          this.pendingEvents.push({
            type: 'COMBAT_BOND_AWARDED',
            sourceId: playerId,
            targetId: target.id,
            data: {
              rewardCredits: 750,
              totalBonds: currentBonds + 750,
              destroyedFaction: target.allegiance,
              message: '🎖️ COMBAT BOND VOUCHER: +750 CR (Confirmed Skirmish Kill)',
            },
          });
        }
      }

      // Check for Skirmish Victory (one side depleted to 0)
      if (this.skirmishScores[opposingFaction] <= 0) {
        const winningFaction = opposingFaction === 'FACTION_HEGEMONY' ? 'FACTION_KRYLL' : 'FACTION_HEGEMONY';
        this.pendingEvents.push({
          type: 'SKIRMISH_VICTORY',
          sourceId: winningFaction,
          data: {
            winningFaction,
            influenceShift: 15,
            message: `🏆 SKIRMISH VICTORY: ${winningFaction} claims sector front! (+15 Influence)`,
          },
        });

        for (const e of this.entities.values()) {
          if (e.isSkirmishVessel && e.allegiance === opposingFaction && e.state !== 'DESTROYED') {
            e.state = 'FLEE';
            e.inputs.forward = true;
          }
        }
      }
    }

    // Day 15 & Day 35: Spawn Persistent 3D Ship Wreck for Laser Scrap Mining, Towing & Refurbishment
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
      hullIntactness: target.type === 'WINGMAN' ? 0.45 : 0.75,
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
      wreckEntity.hullIntactness,
      wreckId,
      target.hullClass,
      target.shipId
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
    const maxScoop = Math.max(35, pEntity.miningProfile?.scoopRadius || 35);
    if (dist > maxScoop) return null;

    let anyRemaining = false;
    for (const item of container.items) {
      if (item.type === 'ORE' && item.commodityId) {
        const res = await tradeService.addMinedOreToCargo(playerId, item.commodityId, Number(item.quantity || 1));
        if (res.overflow > 0) {
          item.quantity = res.overflow;
          anyRemaining = true;
          this.pendingEvents.push({
            type: 'CARGO_HOLD_FULL',
            targetId: pEntity.id,
            data: {
              usedCargo: res.usedCargo,
              cargoCapacity: res.cargoCapacity,
              commodityName: res.commodityName,
            },
          });
        }
      } else if (item.blueprintId) {
        await outfittingService.addLootToPlayer(playerId, item);
      }
    }

    if (!anyRemaining) {
      this.containers.splice(cIdx, 1);
    }

    // Day 36: Record salvage collection in session AAR
    const aar = this.sessionAAR.get(playerId);
    if (aar) aar.salvageCollected += 1;

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
        // Day 25 Ambush & Skirmish
        isAmbushRaider: e.isAmbushRaider,
        targetHaulerId: e.targetHaulerId,
        isSkirmishVessel: e.isSkirmishVessel,
        allegiance: e.allegiance,
        // Day 34 Wingman Telemetry
        ownerPlayerId: e.ownerPlayerId,
        wingmanSlot: e.wingmanSlot,
        tacticalOrder: e.tacticalOrder,
        shipId: e.shipId,
        // Day 35 Ability Telemetry
        specialAbility: e.specialAbility,
        abilityCooldown: typeof e.abilityCooldown === 'number' ? Math.round(e.abilityCooldown * 10) / 10 : undefined,
        abilityMaxCooldown: e.abilityMaxCooldown,
        harmonicShieldActive: e.harmonicShieldActive,
        isDecoy: e.isDecoy,
        // Milestone 1.4 Mining Telemetry
        miningAsteroidId: e.miningAsteroidId || null,
        miningHeat: typeof e.miningHeat === 'number' ? Math.round(e.miningHeat) : 0,
        scoopRadius: e.miningProfile?.scoopRadius,
        beamRange: e.miningProfile?.beamRange,
      })),
      asteroids: this.serializeAsteroids(),
      sporeClouds: this.sporeClouds.map((sc) => ({
        id: sc.id,
        x: Math.round(sc.x * 10) / 10,
        z: Math.round(sc.z * 10) / 10,
        radius: sc.radius,
        ttl: Math.round(sc.ttl * 10) / 10,
        maxTtl: sc.maxTtl,
        ownerId: sc.ownerId,
        dps: sc.dps,
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
      isSkirmishArena: this.isSkirmishArena,
      skirmishScores: this.isSkirmishArena ? this.skirmishScores : undefined,
      skirmishBeacon: this.sectorId === 2 ? {
        id: 'beacon_charybdis',
        name: 'Charybdis Conflict Front',
        x: 80,
        z: -120,
        radius: 35,
        skirmishSectorId: 201,
      } : undefined,
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
      entity.factionId = shipData?.faction_id || entity.factionId;
      entity.hullSeed = Number(shipData?.hull_seed ?? entity.hullSeed);
      entity.hp = Number(shipData?.armor ?? 100);
      entity.maxHp = Number(shipData?.max_armor ?? 100);
      entity.shields = Number(shipData?.shield ?? 100);
      entity.maxShields = Number(shipData?.max_shield ?? 100);
      entity.energy = 100;
      entity.maxEnergy = 100;
      entity.powerGridMax = Number(shipData?.power_grid_max ?? 120);
      entity.powerGridUsed = Number(shipData?.power_grid_used ?? 75);
      entity.cpuMax = Number(shipData?.cpu_max ?? 180);
      entity.cpuUsed = Number(shipData?.cpu_used ?? 110);
      entity.state = 'IDLE';
      entity.isEscapePod = false;
      entity.weaponsDisabled = false;
      entity.lifeSupportSeconds = undefined;
    }
  }

  public destroyEntity(entityId: string, killerId: string = 'player_acc_sol_captain'): boolean {
    const target = this.entities.get(entityId);
    if (!target) return false;
    target.hp = 0;
    target.shields = 0;
    this.handleEntityDestruction(target, killerId);
    return true;
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

  public setCommsStandDown(sectorId: number, isStandDown: boolean): void {
    const room = this.rooms.get(sectorId);
    if (room) {
      room.setCommsStandDown(isStandDown);
    }
  }

  public declareAllegiance(sectorId: number, playerId: string, factionId: string): void {
    const room = this.rooms.get(sectorId);
    if (room) {
      room.declareAllegiance(playerId, factionId);
    }
  }

  public spawnAmbushWing(sectorId: number, convoyId: string, riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME' = 'MODERATE'): string[] {
    const room = this.rooms.get(sectorId);
    if (room) {
      return room.spawnAmbushWing(convoyId, riskLevel);
    }
    return [];
  }

  public destroyEntity(sectorId: number, entityId: string, killerId: string = 'player_acc_sol_captain'): boolean {
    const room = this.rooms.get(sectorId);
    if (room) {
      return room.destroyEntity(entityId, killerId);
    }
    return false;
  }

  public spawnBountyTarget(
    sectorId: number,
    missionId: string,
    callsign: string,
    factionId: string,
    hullClass?: string
  ): string {
    const room = this.getOrCreateRoom(sectorId);
    return room.spawnBountyTarget(missionId, callsign, factionId, hullClass);
  }

  public setTacticalOrder(
    sectorId: number,
    playerId: string,
    order: 'FORMATION_FOLLOW' | 'FOCUS_TARGET' | 'ESCORT_FLAGSHIP' | 'FLANK_HARASS' | 'REGROUP_HOLD',
    targetEntityId?: string
  ) {
    const room = this.getOrCreateRoom(sectorId);
    return room.setTacticalOrder(playerId, order, targetEntityId);
  }

  public getTacticalState(sectorId: number, playerId: string) {
    const room = this.getOrCreateRoom(sectorId);
    return room.getTacticalState(playerId);
  }

  public async spawnWingmenForPlayer(sectorId: number, playerId: string, overrideWingmen?: any[]) {
    const room = this.getOrCreateRoom(sectorId);
    return await room.spawnWingmenForPlayer(playerId, overrideWingmen);
  }

  public triggerWingmanAbility(sectorId: number, playerId: string, slot: number, targetEntityId?: string) {
    const room = this.getOrCreateRoom(sectorId);
    return room.triggerPlayerWingmanAbility(playerId, slot, targetEntityId);
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
        } else if (msg.type === 'START_MINING_BEAM') {
          const mineRes = room.startMiningBeam(playerId, msg.asteroidId);
          try {
            socket.send(JSON.stringify({ type: 'S_MINING_BEAM_ACK', ...mineRes }));
          } catch {}
        } else if (msg.type === 'STOP_MINING_BEAM') {
          room.stopMiningBeam(playerId);
        } else if (msg.type === 'DECLARE_ALLEGIANCE') {
          room.declareAllegiance(playerId, msg.factionId);
        } else if (msg.type === 'C_TACTICAL_ORDER' || msg.type === 'TACTICAL_ORDER') {
          const res = room.setTacticalOrder(playerId, msg.order, msg.targetEntityId);
          try {
            socket.send(
              JSON.stringify({
                type: 'S_TACTICAL_ORDER_ACK',
                success: res.success,
                order: msg.order,
                targetEntityId: msg.targetEntityId,
                affectedWingmenCount: res.affectedWingmenCount,
                message: res.message,
              })
            );
          } catch {
            // Socket might be closed
          }
        } else if (msg.type === 'C_TRIGGER_ABILITY' || msg.type === 'TRIGGER_ABILITY') {
          const slot = Number(msg.slot || 1);
          const res = room.triggerPlayerWingmanAbility(playerId, slot, msg.targetEntityId);
          try {
            socket.send(
              JSON.stringify({
                type: 'S_ABILITY_ACK',
                success: res.success,
                slot,
                ability: res.ability,
                cooldownRemaining: res.cooldownRemaining,
                message: res.message,
                error: res.error,
              })
            );
          } catch {
            // Socket might be closed
          }
        } else if (msg.type === 'C_DISENGAGE' || msg.type === 'C_REQUEST_AAR') {
          const aar = room.finalizeAAR(playerId);
          try {
            socket.send(
              JSON.stringify({
                type: 'S_COMBAT_AAR',
                success: true,
                data: aar,
              })
            );
          } catch {}
        }
      } catch (err) {
        // Ignore malformed client frames
      }
    });

    socket.on('close', () => {
      room.finalizeAAR(playerId);
      room.removePlayer(playerId);
    });
  }

  // Day 36: Static AAR Storage & Access
  public static latestAARByAccount: Map<string, CombatAAR> = new Map();

  public static getLatestAAR(accountId: string): CombatAAR | null {
    return SectorCombatManager.latestAARByAccount.get(accountId) || null;
  }

  public static setLatestAAR(accountId: string, aar: CombatAAR): void {
    SectorCombatManager.latestAARByAccount.set(accountId, aar);
  }
}

export const combatManager = new SectorCombatManager();
