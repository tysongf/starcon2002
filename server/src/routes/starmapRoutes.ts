import type { FastifyPluginAsync } from 'fastify';
import { starmapService } from '../services/StarmapService';

export const starmapRoutes: FastifyPluginAsync = async (server) => {
  // 1. Get Star Systems with optional spatial radius & text filters
  server.get('/systems', async (req, reply) => {
    const query = (req.query || {}) as {
      search?: string;
      faction?: string;
      nearX?: string;
      nearY?: string;
      radius?: string;
    };

    const filters: {
      search?: string;
      faction?: string;
      nearX?: number;
      nearY?: number;
      radius?: number;
    } = {};

    if (query.search) filters.search = query.search;
    if (query.faction) filters.faction = query.faction;
    if (query.nearX !== undefined && query.nearY !== undefined && query.radius !== undefined) {
      filters.nearX = parseFloat(query.nearX);
      filters.nearY = parseFloat(query.nearY);
      filters.radius = parseFloat(query.radius);
    }

    const systems = await starmapService.getStarSystems(filters);
    reply.send({
      success: true,
      count: systems.length,
      systems,
    });
  });

  // 2. Get Single Star System Details (Planets, Ports, Colonies)
  server.get('/systems/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const sectorId = parseInt(id, 10);
    if (isNaN(sectorId)) {
      return reply.status(400).send({ success: false, error: 'Invalid sector ID provided.' });
    }

    const system = await starmapService.getStarSystemById(sectorId);
    if (!system) {
      return reply.status(404).send({
        success: false,
        error: `SYSTEM_NOT_FOUND: Star system #${sectorId} was not found in the galactic registry.`,
      });
    }

    reply.send({
      success: true,
      system,
    });
  });

  // 3. Get Faction Territorial Spheres of Influence
  server.get('/spheres', async (_req, reply) => {
    const spheres = await starmapService.getFactionSpheres();
    reply.send({
      success: true,
      spheres,
    });
  });

  // 4. Calculate Euclidean Route & Lock Autopilot Waypoint
  server.post('/course/plot', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
      targetSectorId: number;
      lockCourse?: boolean;
    };

    const accountId = body.accountId || body.playerId || 'acc_sol_captain';
    const targetSectorId = Number(body.targetSectorId);
    const lockCourse = body.lockCourse !== undefined ? Boolean(body.lockCourse) : true;

    if (isNaN(targetSectorId)) {
      return reply.status(400).send({ success: false, error: 'targetSectorId is required.' });
    }

    const result = await starmapService.plotCourse(accountId, targetSectorId, lockCourse);
    if (!result.success) {
      return reply.status(400).send(result);
    }

    reply.send(result);
  });

  // 5. Clear Active Navigation Course
  server.post('/course/clear', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';

    const result = await starmapService.clearCourse(accountId);
    reply.send(result);
  });

  // 6. Enter Hyperspace Flight (Day 38)
  server.post('/hyperspace/enter', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';

    const result = await starmapService.enterHyperspace(accountId);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 7. Synchronize Continuous Hyperspace Coordinates & Distance Fuel Burn (Day 38)
  server.post('/hyperspace/sync', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
      currentCoords: [number, number];
      fuelBurned: number;
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';

    if (!body.currentCoords || !Array.isArray(body.currentCoords) || body.currentCoords.length < 2) {
      return reply.status(400).send({ success: false, error: 'currentCoords [x, y] is required.' });
    }

    const result = await starmapService.syncHyperspaceFlight(
      accountId,
      [Number(body.currentCoords[0]), Number(body.currentCoords[1])],
      Number(body.fuelBurned || 0)
    );
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 8. Orbital Gravity Well Arrival & Drop-Out into TrueSpace (Day 38)
  server.post('/hyperspace/arrive', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
      targetSectorId: number;
      finalCoords?: [number, number];
      remainingFuel?: number;
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';
    const targetSectorId = Number(body.targetSectorId);

    if (isNaN(targetSectorId)) {
      return reply.status(400).send({ success: false, error: 'targetSectorId is required.' });
    }

    const result = await starmapService.arriveAtStarSystem(
      accountId,
      targetSectorId,
      body.finalCoords,
      body.remainingFuel !== undefined ? Number(body.remainingFuel) : undefined
    );
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // =========================================================================
  // Day 39: Hyperspace Radar Blips, Hunter AI & Tactical Interceptions
  // =========================================================================

  // 9. Scan for Active Subspace Radar Blips & Hunter Pursuers
  server.post('/hyperspace/blips', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
      currentCoords: [number, number];
      isBoosting?: boolean;
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';

    if (!body.currentCoords || !Array.isArray(body.currentCoords) || body.currentCoords.length < 2) {
      return reply.status(400).send({ success: false, error: 'currentCoords [x, y] is required.' });
    }

    const result = await starmapService.getHyperspaceRadarBlips(
      accountId,
      [Number(body.currentCoords[0]), Number(body.currentCoords[1])],
      Boolean(body.isBoosting)
    );
    reply.send(result);
  });

  // 10. Deploy Subspace Thermal Decoy
  server.post('/hyperspace/decoy', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
      currentCoords: [number, number];
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';

    if (!body.currentCoords || !Array.isArray(body.currentCoords) || body.currentCoords.length < 2) {
      return reply.status(400).send({ success: false, error: 'currentCoords [x, y] is required.' });
    }

    const result = await starmapService.deployHyperspaceDecoy(
      accountId,
      [Number(body.currentCoords[0]), Number(body.currentCoords[1])]
    );
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 11. Initiate Hyperspace Interception Handshake (Tier 1 Comms)
  server.post('/hyperspace/intercept', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
      blipId: string;
      currentCoords?: [number, number];
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';

    if (!body.blipId) {
      return reply.status(400).send({ success: false, error: 'blipId is required.' });
    }

    const result = await starmapService.initiateHyperspaceInterception(
      accountId,
      body.blipId,
      body.currentCoords
    );
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 12. Resolve Comms Dialog Decision (Bribe, Bluff, Peaceful, Attack)
  server.post('/hyperspace/comms-action', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
      blipId: string;
      actionId: string;
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';

    if (!body.blipId || !body.actionId) {
      return reply.status(400).send({ success: false, error: 'blipId and actionId are required.' });
    }

    const result = await starmapService.resolveInterceptionComms(
      accountId,
      body.blipId,
      body.actionId
    );
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 13. In-Situ Hyperspace Resumption Post-Combat/Comms with Warp Immunity
  server.post('/hyperspace/resume', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
      combatOutcome?: 'VICTORY' | 'FLED';
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';

    const result = await starmapService.resumeHyperspaceFlight(
      accountId,
      body.combatOutcome || 'VICTORY'
    );
    reply.send(result);
  });

  // =========================================================================
  // Day 40: Precursor Quasi-Space Slipstream & Emergency SOS Transponder
  // =========================================================================

  // 14. Get Precursor Quasi-Space Portal Gateways
  server.get('/quasispace/portals', async (_req, reply) => {
    const portals = await starmapService.getQuasiSpacePortals();
    reply.send({
      success: true,
      portals,
    });
  });

  // 15. Enter Precursor Quasi-Space (Requires Precursor Deciphering Resonance)
  server.post('/quasispace/enter', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';

    const result = await starmapService.enterQuasiSpace(accountId);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 16. Synchronize Quasi-Space Coordinates (ZERO Fuel Burn)
  server.post('/quasispace/sync', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
      currentCoords: [number, number];
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';

    if (!body.currentCoords || !Array.isArray(body.currentCoords) || body.currentCoords.length < 2) {
      return reply.status(400).send({ success: false, error: 'currentCoords [x, y] is required.' });
    }

    const result = await starmapService.syncQuasiSpaceFlight(
      accountId,
      [Number(body.currentCoords[0]), Number(body.currentCoords[1])]
    );
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 17. Exit Quasi-Space Through Precursor Portal (Returns to Real Hyperspace with 5s Immunity)
  server.post('/quasispace/exit', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
      portalId: string;
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';

    if (!body.portalId) {
      return reply.status(400).send({ success: false, error: 'portalId is required.' });
    }

    const result = await starmapService.exitQuasiSpaceViaPortal(accountId, body.portalId);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 18. Broadcast Automated Emergency SOS Distress Beacon (Zero-Fuel Crisis)
  server.post('/hyperspace/sos-trigger', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';

    const result = await starmapService.triggerEmergencySOS(accountId);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 19. Resolve Emergency SOS Transaction (Buy Fuel, Barter Cargo, Surrender, Fight)
  server.post('/hyperspace/sos-resolve', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
      choice: 'BUY_FUEL' | 'BARTER_ORE' | 'BARTER_BIO' | 'SURRENDER' | 'FIGHT';
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';

    if (!body.choice) {
      return reply.status(400).send({ success: false, error: 'choice is required.' });
    }

    const result = await starmapService.resolveEmergencySOSTrade(accountId, body.choice);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 20. Get Galactic Expedition Summary & Telemetry
  server.get('/expedition/summary', async (req, reply) => {
    const query = (req.query || {}) as { accountId?: string; playerId?: string };
    const accountId = query.accountId || query.playerId || 'acc_sol_captain';
    const summary = await starmapService.getExpeditionSummary(accountId);
    reply.send({
      success: true,
      summary,
    });
  });

  // 21. Record System Visit in Expedition Ledger
  server.post('/expedition/visit', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string; playerId?: string; systemId: string | number };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';
    if (!body.systemId) {
      return reply.status(400).send({ success: false, error: 'systemId is required.' });
    }
    starmapService.recordSystemVisit(accountId, body.systemId);
    const summary = await starmapService.getExpeditionSummary(accountId);
    reply.send({
      success: true,
      systemsVisited: summary.systemsVisited,
    });
  });

  // 22. Record Custom Expedition Metric
  server.post('/expedition/record-metric', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      playerId?: string;
      metric: 'blipsEvaded' | 'portalsTransited' | 'sosBeaconsBroadcast' | 'interceptionsSurvived';
      delta?: number;
    };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';
    if (!body.metric) {
      return reply.status(400).send({ success: false, error: 'metric is required.' });
    }
    starmapService.recordExpeditionMetric(accountId, body.metric, body.delta ?? 1);
    const summary = await starmapService.getExpeditionSummary(accountId);
    reply.send({
      success: true,
      summary,
    });
  });

  // 23. Reset Expedition Ledger (Debug / Baseline)
  server.post('/expedition/reset', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string; playerId?: string };
    const accountId = body.accountId || body.playerId || 'acc_sol_captain';
    starmapService.resetExpedition(accountId);
    const summary = await starmapService.getExpeditionSummary(accountId);
    reply.send({
      success: true,
      message: 'Galactic expedition telemetry reset.',
      summary,
    });
  });
};

