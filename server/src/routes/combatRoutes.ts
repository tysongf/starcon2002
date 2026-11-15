import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/Database';
import { contractService } from '../services/ContractService';
import { wreckService } from '../services/WreckService';
import { combatManager } from '../services/SectorCombatManager';
import { navigationService } from '../services/NavigationService';
import { outfittingService } from '../services/OutfittingService';

export const combatRoutes: FastifyPluginAsync = async (server) => {
  // Killmails
  server.get('/api/combat/killmails', async (req, reply) => {
    const query = (req.query || {}) as { accountId?: string };
    const accountId = query.accountId || 'acc_sol_captain';
    const killmails = await contractService.getKillmails(accountId);
    reply.send({ killmails });
  });

  // Contracts
  server.get('/api/combat/contracts', async (req, reply) => {
    const query = (req.query || {}) as { publicOnly?: string; accountId?: string };
    const publicOnly = query.publicOnly === 'true';
    const accountId = query.accountId || 'acc_sol_captain';
    const contracts = await contractService.getContracts(publicOnly, accountId);
    reply.send({ contracts });
  });

  server.get('/api/combat/contracts/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const contract = await contractService.getContractById(id);
    if (!contract) {
      return reply.status(404).send({ success: false, error: 'Contract not found' });
    }
    reply.send({ success: true, contract });
  });

  server.post('/api/combat/contracts', async (req, reply) => {
    const body = (req.body || {}) as {
      creatorAccountId?: string;
      targetName?: string;
      targetEntityId?: string;
      rewardCredits?: number;
      isPublic?: boolean;
    };
    const creatorAccountId = body.creatorAccountId || 'acc_sol_captain';
    const targetName = body.targetName || 'Hostile Combatant';
    const rewardCredits = typeof body.rewardCredits === 'number' ? body.rewardCredits : 2500;
    const isPublic = body.isPublic !== false;

    try {
      const contract = await contractService.createRevengeContract(
        creatorAccountId,
        targetName,
        body.targetEntityId || null,
        rewardCredits,
        isPublic
      );
      reply.send({ success: true, contract });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Replacement Frigate & Clinic Rescue
  server.post('/api/combat/claim-frigate', async (req, reply) => {
    const body = (req.body || {}) as { playerId?: string; sectorId?: number };
    const playerId = body.playerId || 'acc_sol_captain';
    const sectorId = body.sectorId || 1;

    try {
      const result = await contractService.claimReplacementFrigate(playerId);
      combatManager.resetPlayerFrigate(sectorId, playerId, result.ship);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/combat/emergency-recall', async (req, reply) => {
    const body = (req.body || {}) as { playerId?: string };
    const playerId = body.playerId || 'acc_sol_captain';

    // Deduct clone medical insurance fee (500 CR) if available
    await db.query('UPDATE accounts SET credits = GREATEST(0, credits - 500) WHERE id = $1', [playerId]);
    const result = await contractService.claimReplacementFrigate(playerId);
    // Move ship to home sector 1
    await db.query('UPDATE ships SET current_sector_id = 1 WHERE account_id = $1', [playerId]);
    combatManager.resetPlayerFrigate(1, playerId, result.ship);

    reply.send({
      success: true,
      message: 'Pilot emergency medical recall complete. Transferred to Aegis Terminal Station Clinic.',
      ship: result.ship,
    });
  });

  server.post('/api/combat/reset-sector', async (req, reply) => {
    const body = (req.body || {}) as { sectorId?: number };
    const sectorId = body.sectorId || 2;
    combatManager.reseedSector(sectorId);
    reply.send({ success: true, message: `Sector ${sectorId} entities reseeded.` });
  });

  server.post('/api/combat/destroy-entity', async (req, reply) => {
    const body = (req.body || {}) as { sectorId?: number; entityId: string; killerId?: string };
    const sectorId = body.sectorId || 2;
    const ok = combatManager.destroyEntity(sectorId, body.entityId, body.killerId || 'player_acc_sol_captain');
    if (!ok) {
      return reply.status(404).send({ success: false, error: 'Entity or room not found.' });
    }
    reply.send({ success: true, entityId: body.entityId, sectorId });
  });

  // Milestone 1.4: Authoritative Space Mining Asteroids Telemetry & Test Rig Helper
  server.get('/api/combat/asteroids', async (req, reply) => {
    const query = (req.query || {}) as { sectorId?: string };
    const sectorId = parseInt(query.sectorId || '2', 10);
    const room = combatManager.getOrCreateRoom(sectorId);
    reply.send({ success: true, sectorId, asteroids: room.serializeAsteroids() });
  });

  server.post('/api/combat/debug/mining-setup', async (req, reply) => {
    const body = (req.body || {}) as {
      sectorId?: number;
      playerId?: string;
      asteroidId?: string;
      x?: number;
      z?: number;
      hp?: number;
      maxHp?: number;
      oreCommodityId?: string;
      oreName?: string;
      tier?: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'EXOTIC';
      remainingYield?: number;
      playerX?: number;
      playerZ?: number;
      playerYaw?: number;
      miningHeat?: number;
      clearCargo?: boolean;
      fillCargo?: boolean;
    };
    const sectorId = body.sectorId || 2;
    const playerId = body.playerId || 'acc_sol_captain';
    const room = combatManager.getOrCreateRoom(sectorId);
    const pEntity = room.entities.get(`player_${playerId}`);
    if (pEntity) {
      if (typeof body.playerX === 'number') pEntity.x = body.playerX;
      if (typeof body.playerZ === 'number') pEntity.z = body.playerZ;
      if (typeof body.playerYaw === 'number') pEntity.yaw = body.playerYaw;
      if (typeof body.miningHeat === 'number') pEntity.miningHeat = body.miningHeat;
      pEntity.vx = 0;
      pEntity.vz = 0;
      pEntity.energy = pEntity.maxEnergy;
      pEntity.shields = pEntity.maxShields;
      pEntity.hp = pEntity.maxHp;
      pEntity.state = 'IDLE';
      pEntity.isEscapePod = false;
      pEntity.lastAmbushAt = undefined;
      pEntity.miningAsteroidId = null;
      pEntity.miningBusy = false;
    }
    room.projectiles = [];
    if (body.asteroidId) {
      const ast = room.asteroids.get(body.asteroidId);
      if (ast) {
        if (typeof body.x === 'number') ast.x = body.x;
        if (typeof body.z === 'number') ast.z = body.z;
        if (typeof body.hp === 'number') ast.hp = body.hp;
        if (typeof body.maxHp === 'number') ast.maxHp = body.maxHp;
        if (body.oreCommodityId) ast.oreCommodityId = body.oreCommodityId;
        if (body.oreName) ast.oreName = body.oreName;
        if (body.tier) ast.tier = body.tier;
        if (typeof body.remainingYield === 'number') ast.remainingYield = body.remainingYield;
        ast.depletedUntil = null;
        ast.fractured50 = false;
        ast.heatState = 'NORMAL';
        ast.ventChargeUntil = null;
        ast.ventCooldownUntil = null;
      }
    }
    if (body.clearCargo) {
      await db.query('DELETE FROM ship_cargo WHERE ship_id IN (SELECT id FROM ships WHERE account_id = $1)', [playerId]);
    }
    if (body.fillCargo) {
      const sRes = await db.query<any>('SELECT id, cargo_capacity FROM ships WHERE account_id = $1', [playerId]);
      if (sRes.rows.length > 0) {
        const s = sRes.rows[0];
        await db.query('DELETE FROM ship_cargo WHERE ship_id = $1', [s.id]);
        await db.query(
          'INSERT INTO ship_cargo (ship_id, commodity_id, quantity) VALUES ($1, $2, $3)',
          [s.id, 'COMM_PYRITE_ORE', Number(s.cargo_capacity || 40)]
        );
      }
    }
    reply.send({ success: true, asteroids: room.serializeAsteroids(), containers: room.containers });
  });

  // Persistent Wrecks & In-Situ Salvage
  server.get('/api/combat/wrecks', async (req, reply) => {
    const query = (req.query || {}) as { sectorId?: string };
    const sectorId = parseInt(query.sectorId || '2', 10);
    const wrecks = await wreckService.getWrecksBySector(sectorId);
    reply.send({ success: true, wrecks });
  });

  server.get('/api/combat/wrecks/:id', async (req, reply) => {
    const params = req.params as { id: string };
    const wreck = await wreckService.getWreckById(params.id);
    if (!wreck) {
      return reply.status(404).send({ success: false, error: 'Wreck not found' });
    }
    reply.send({ success: true, wreck });
  });

  server.post('/api/combat/wrecks', async (req, reply) => {
    const body = (req.body || {}) as {
      sectorId?: number;
      shipName?: string;
      shipClass?: string;
      faction?: string;
      x?: number;
      y?: number;
      z?: number;
      rotation?: number;
      maxScrap?: number;
      hullIntactness?: number;
    };
    try {
      const wreck = await wreckService.createWreck(
        body.sectorId || 2,
        body.shipName || 'Unknown Derelict',
        body.shipClass || 'Solaris Scout',
        body.faction || 'Solaris Coalition',
        body.x || 0,
        body.y || 0,
        body.z || 0,
        body.rotation || 0,
        body.maxScrap || 100,
        body.hullIntactness || 0.8
      );
      reply.send({ success: true, wreck });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/combat/wrecks/salvage-mine', async (req, reply) => {
    const body = (req.body || {}) as { wreckId: string; accountId?: string; extractUnits?: number };
    const accountId = body.accountId || 'acc_sol_captain';
    const extractUnits = typeof body.extractUnits === 'number' ? body.extractUnits : 10;

    try {
      const result = await wreckService.mineScrap(body.wreckId, accountId, extractUnits);
      reply.send({ success: true, ...result });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/combat/wrecks/tow', async (req, reply) => {
    const body = (req.body || {}) as { wreckId: string; accountId?: string; isTowed?: boolean };
    const accountId = body.accountId || 'acc_sol_captain';
    const attach = body.isTowed !== false;

    try {
      const result = await wreckService.setTowed(body.wreckId, attach ? accountId : null);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/combat/wrecks/dismantle', async (req, reply) => {
    const body = (req.body || {}) as { wreckId: string; accountId?: string };
    const accountId = body.accountId || 'acc_sol_captain';

    try {
      const result = await wreckService.dismantleWreck(body.wreckId, accountId);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/combat/wrecks/refurbish', async (req, reply) => {
    const body = (req.body || {}) as { wreckId: string; accountId?: string };
    const accountId = body.accountId || 'acc_sol_captain';

    try {
      const result = await wreckService.refurbishWreck(body.wreckId, accountId);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Authoritative 20Hz WebSocket Combat Room
  server.get('/ws/combat', { websocket: true }, async (socket, req) => {
    const query = (req.query || {}) as { playerId?: string; sectorId?: string };
    const playerId = query.playerId || 'acc_sol_captain';
    const sectorId = parseInt(query.sectorId || '1', 10);

    // Buffer early WebSocket frames until async DB/loadout lookups complete and handleConnection binds handlers.
    const bufferedMessages: Array<string | Buffer> = [];
    let closedEarly = false;
    const earlyMessageHandler = (data: string | Buffer) => {
      bufferedMessages.push(data);
    };
    const earlyCloseHandler = () => {
      closedEarly = true;
    };
    socket.on('message', earlyMessageHandler);
    socket.on('close', earlyCloseHandler);

    let shipData: any;
    try {
      const ship = await navigationService.getPlayerShip(playerId);
      const loadout = await outfittingService.getPlayerLoadout(playerId);
      shipData = { ...ship, loadout };
    } catch {
      shipData = undefined;
    }

    socket.removeListener('message', earlyMessageHandler);
    socket.removeListener('close', earlyCloseHandler);
    if (closedEarly) return;

    combatManager.handleConnection(socket, sectorId, playerId, shipData);
    for (const msg of bufferedMessages) {
      socket.emit('message', msg);
    }
  });
};
