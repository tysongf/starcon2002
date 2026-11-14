import type { FastifyPluginAsync } from 'fastify';
import { fleetService } from '../services/FleetService';

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

  // 6. Debug Reset
  server.post('/debug-reset', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string };
    const accountId = body.accountId || 'acc_sol_captain';
    await fleetService.debugReset(accountId);
    reply.send({ success: true, message: 'Fleet reset to baseline starter escorts.' });
  });
};

