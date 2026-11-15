import type { FastifyPluginAsync } from 'fastify';
import { reputationService, FACTION_METADATA } from '../services/ReputationService';

export const reputationRoutes: FastifyPluginAsync = async (server) => {
  server.get('/standings', async (req, reply) => {
    const query = (req.query || {}) as { accountId?: string };
    const accountId = req.authAccountId!;
    try {
      const standings = await reputationService.getStandings(accountId);
      reply.send({ success: true, standings, metadata: FACTION_METADATA });
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message });
    }
  });

  server.post('/modify', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      factionId: any;
      amount: number;
      reason?: string;
    };
    const accountId = req.authAccountId!;
    try {
      const result = await reputationService.modifyStanding(
        accountId,
        body.factionId,
        body.amount,
        body.reason || 'Diplomatic incident'
      );
      reply.send({ success: true, ...result });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/debug-set', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      factionId: any;
      standing?: number;
      score?: number;
    };
    const accountId = req.authAccountId!;
    const targetStanding = body.standing !== undefined ? body.standing : (body.score !== undefined ? body.score : 0);
    try {
      const updatedStandings = await reputationService.debugSetStanding(
        accountId,
        body.factionId,
        targetStanding
      );
      reply.send({ success: true, standings: updatedStandings });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/truce', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      sectorId: number;
      factionId: any;
      tributeType?: 'CREDITS' | 'ALLOYS';
    };
    const accountId = req.authAccountId!;
    try {
      const result = await reputationService.requestCeasefireTruce(
        accountId,
        body.sectorId,
        body.factionId,
        body.tributeType || 'CREDITS'
      );
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/debug-expire-truce', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string; sectorId?: number; factionId?: string };
    const accountId = req.authAccountId!;
    try {
      const expired = await reputationService.debugExpireTruces(accountId, body.sectorId, body.factionId);
      reply.send({ success: true, expired });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.get('/check-docking', async (req, reply) => {
    const query = (req.query || {}) as {
      accountId?: string;
      factionId?: string;
    };
    const accountId = req.authAccountId!;
    const factionId = query.factionId || 'FACTION_SOL';
    try {
      const result = await reputationService.canDockAtStation(accountId, factionId);
      reply.send({ success: true, ...result });
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message });
    }
  });
};
