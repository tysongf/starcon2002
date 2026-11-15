import type { FastifyPluginAsync } from 'fastify';
import { fleetService } from '../services/FleetService';
import { combatManager, SectorCombatManager } from '../services/SectorCombatManager';
import { shipyardService } from '../services/ShipyardService';

export const fleetRoutes: FastifyPluginAsync = async (server) => {
  // 1. Get Fleet Roster & Command Bridge Status
  server.get('/roster', async (req, reply) => {
    const query = (req.query || {}) as { accountId?: string };
    const accountId = query.accountId || 'acc_sol_captain';
    const roster = await fleetService.getFleetRoster(accountId);
    reply.send(roster);
  });

  // 2. Assign Escort to Active Wingman Slot (or Recall to Reserve)
  server.post('/assign-slot', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      fleetShipId: string;
      slot: number | null;
    };
    const accountId = body.accountId || 'acc_sol_captain';
    if (!body.fleetShipId) {
      return reply.status(400).send({ success: false, error: 'fleetShipId is required.' });
    }

    const result = await fleetService.assignDeploymentSlot(accountId, body.fleetShipId, body.slot);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 3. Rename Escort Ship
  server.post('/rename', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      fleetShipId: string;
      name: string;
    };
    const accountId = body.accountId || 'acc_sol_captain';
    if (!body.fleetShipId || !body.name) {
      return reply.status(400).send({ success: false, error: 'fleetShipId and name are required.' });
    }

    const result = await fleetService.renameFleetShip(accountId, body.fleetShipId, body.name);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 4. Scrap Escort Ship for Residual Credits and Alloys
  server.post('/scrap', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      fleetShipId: string;
    };
    const accountId = body.accountId || 'acc_sol_captain';
    if (!body.fleetShipId) {
      return reply.status(400).send({ success: false, error: 'fleetShipId is required.' });
    }

    const result = await fleetService.scrapFleetShip(accountId, body.fleetShipId);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 5. Process Fleet Upkeep
  server.post('/upkeep', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string };
    const accountId = body.accountId || 'acc_sol_captain';
    const result = await fleetService.processFleetUpkeep(accountId);
    reply.send(result);
  });

  // 6. Promote Reserve or Active Escort Ship to Player Active Flagship (Milestone 1.2)
  server.post('/promote', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      fleetShipId: string;
    };
    const accountId = body.accountId || 'acc_sol_captain';
    if (!body.fleetShipId) {
      return reply.status(400).send({ success: false, error: 'fleetShipId is required.' });
    }
    const result = await fleetService.promoteFlagship(accountId, body.fleetShipId);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 7. Debug Reset
  server.post('/debug-reset', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string };
    const accountId = body.accountId || 'acc_sol_captain';
    await fleetService.debugReset(accountId);
    reply.send({ success: true, message: 'Fleet reset to baseline starter escorts.' });
  });

  // 7. Day 34: Tactical Order Directives (REST Mirror & Headless Directives)
  server.post('/tactical-order', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      sectorId?: number;
      order: 'FORMATION_FOLLOW' | 'FOCUS_TARGET' | 'ESCORT_FLAGSHIP' | 'FLANK_HARASS' | 'REGROUP_HOLD';
      targetEntityId?: string;
    };
    const accountId = body.accountId || 'acc_sol_captain';
    const sectorId = body.sectorId || 1;
    const result = combatManager.setTacticalOrder(sectorId, accountId, body.order, body.targetEntityId);
    reply.send(result);
  });

  // 8. Day 34: Tactical State Query
  server.get('/tactical-state', async (req, reply) => {
    const query = (req.query || {}) as { accountId?: string; sectorId?: string };
    const accountId = query.accountId || 'acc_sol_captain';
    const sectorId = parseInt(query.sectorId || '1', 10);
    const result = combatManager.getTacticalState(sectorId, accountId);
    reply.send(result);
  });

  // 9. Day 34: Headless Spawn Combat Wingmen (Debug)
  server.post('/debug-spawn-combat-wing', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string; sectorId?: number; overrideWingmen?: any[] };
    const accountId = body.accountId || 'acc_sol_captain';
    const sectorId = body.sectorId || 1;
    const wingmen = await combatManager.spawnWingmenForPlayer(sectorId, accountId, body.overrideWingmen);
    reply.send({ success: true, count: wingmen.length, wingmen });
  });

  // 10. Day 35: Refurbish Escort Wreck Mirror
  server.post('/refurbish', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      wreckId: string;
      colonyId?: string;
    };
    const accountId = body.accountId || 'acc_sol_captain';
    if (!body.wreckId) {
      return reply.status(400).send({ success: false, error: 'wreckId is required.' });
    }

    const result = await shipyardService.refurbishEscortWreck(
      accountId,
      body.wreckId,
      body.colonyId
    );
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 11. Day 35: Trigger Wingman Signature Fleet Ability
  server.post('/trigger-ability', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      sectorId?: number;
      slot: number;
      targetEntityId?: string;
    };
    const accountId = body.accountId || 'acc_sol_captain';
    const sectorId = body.sectorId || 1;
    const slot = Number(body.slot || 1);
    const result = combatManager.triggerWingmanAbility(sectorId, accountId, slot, body.targetEntityId);
    reply.send(result);
  });

  // 12. Day 36: Get Latest Tactical Combat After-Action Report (AAR)
  server.get('/aar/last', async (req, reply) => {
    const query = (req.query || {}) as { accountId?: string };
    const accountId = query.accountId || 'acc_sol_captain';
    let aar = SectorCombatManager.getLatestAAR(accountId);
    if (!aar) {
      aar = {
        sessionId: `aar_baseline_${Date.now()}`,
        sectorId: 1,
        timestamp: new Date().toISOString(),
        flagship: { accountId, damageDealt: 0, damageAbsorbed: 0, kills: 0 },
        escorts: [],
        salvageCollected: 0,
        totalDamageDealt: 0,
        totalDamageAbsorbed: 0,
        medal: 'A',
      };
    }
    reply.send({ success: true, aar });
  });
};

