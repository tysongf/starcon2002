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
};

