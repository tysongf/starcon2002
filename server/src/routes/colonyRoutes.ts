import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/Database';
import { colonyService } from '../services/ColonyService';

export const colonyRoutes: FastifyPluginAsync = async (server) => {
  // Found Colony Outpost
  server.post('/api/colonies/found', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      planetId: string;
      beaconId: string;
      name?: string;
    };
    const accountId = body.accountId || 'acc_sol_captain';
    try {
      const colony = await colonyService.foundColony(accountId, body.planetId, body.beaconId, body.name);
      reply.send({ success: true, colony });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Planet Colonies List
  server.get('/api/colonies/planet/:planetId', async (req, reply) => {
    const { planetId } = req.params as { planetId: string };
    const query = (req.query || {}) as { accountId?: string };
    const accountId = query.accountId || 'acc_sol_captain';
    try {
      const colonies = await colonyService.getPlanetColonies(planetId, accountId);
      reply.send({ success: true, colonies });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Colony Detail
  server.get('/api/colonies/:colonyId', async (req, reply) => {
    const { colonyId } = req.params as { colonyId: string };
    const query = (req.query || {}) as { accountId?: string };
    const accountId = query.accountId || 'acc_sol_captain';
    try {
      const colony = await colonyService.getColonyDetail(colonyId, accountId);
      reply.send({ success: true, colony });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Upgrade Colony Facility
  server.post('/api/colonies/:colonyId/upgrade', async (req, reply) => {
    const { colonyId } = req.params as { colonyId: string };
    const body = (req.body || {}) as {
      accountId?: string;
      facilityType: 'DERRICK' | 'HABITATION' | 'TERRAFORMER' | 'SILO' | 'SHIPYARD';
    };
    const accountId = body.accountId || 'acc_sol_captain';
    try {
      const result = await colonyService.upgradeFacility(colonyId, accountId, body.facilityType);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Dedicated Colony Shipyard Upgrade Endpoint
  server.post('/api/colonies/:colonyId/shipyard/upgrade', async (req, reply) => {
    const { colonyId } = req.params as { colonyId: string };
    const body = (req.body || {}) as { accountId?: string };
    const accountId = body.accountId || 'acc_sol_captain';
    try {
      const result = await colonyService.upgradeFacility(colonyId, accountId, 'SHIPYARD');
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Harvest Stockpiled Cargo
  server.post('/api/colonies/:colonyId/harvest', async (req, reply) => {
    const { colonyId } = req.params as { colonyId: string };
    const body = (req.body || {}) as { accountId?: string };
    const accountId = body.accountId || 'acc_sol_captain';
    try {
      const result = await colonyService.harvestColonyCargo(colonyId, accountId);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Fast-Forward Debug Hook (Supports both /api/colony and /api/colonies)
  const handleFastForward = async (req: any, reply: any) => {
    const body = (req.body || {}) as { accountId?: string; colonyId?: string; seconds?: number };
    const accountId = body.accountId || 'acc_sol_captain';
    const seconds = Math.max(0, Math.floor(Number(body.seconds) || 0));
    try {
      const params: unknown[] = [accountId, seconds];
      let where = 'account_id = $1';
      if (body.colonyId) {
        params.push(body.colonyId);
        where += ' AND id = $3';
      }
      const { rows } = await db.query<{ id: string }>(
        `UPDATE colonies SET last_harvest_at = last_harvest_at - make_interval(secs => $2::double precision) WHERE ${where} RETURNING id`,
        params
      );
      reply.send({ success: true, fastForwardedSeconds: seconds, colonies: rows.map((r) => r.id) });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  };

  server.post('/api/colony/debug-fast-forward', handleFastForward);
  server.post('/api/colonies/debug-fast-forward', handleFastForward);
};
