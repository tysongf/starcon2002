import type { FastifyPluginAsync } from 'fastify';
import { galacticMissionService } from '../services/GalacticMissionService';
import { StoryBranchChoice } from '../procgen/GalacticMissionGenerator';

export const missionRoutes: FastifyPluginAsync = async (server) => {
  server.get('/', async (req, reply) => {
    const query = (req.query || {}) as { accountId?: string; sectorId?: string };
    const accountId = req.authAccountId!;
    const sectorId = parseInt(query.sectorId || '1', 10) || 1;
    const data = await galacticMissionService.getBoard(accountId, sectorId);
    reply.send({ success: true, ...data });
  });

  server.post('/refresh', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string; sectorId?: number };
    const accountId = req.authAccountId!;
    const sectorId = body.sectorId || 1;
    try {
      const result = await galacticMissionService.refreshBoard(accountId, sectorId);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/sync', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string };
    const accountId = req.authAccountId!;
    const missions = await galacticMissionService.syncProgress(accountId);
    reply.send({ success: true, missions });
  });

  server.post('/:id/accept', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { accountId?: string };
    const accountId = req.authAccountId!;
    try {
      const mission = await galacticMissionService.acceptMission(accountId, id);
      reply.send({ success: true, mission });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/:id/abandon', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { accountId?: string };
    const accountId = req.authAccountId!;
    try {
      await galacticMissionService.abandonMission(accountId, id);
      reply.send({ success: true });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/:id/claim', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { accountId?: string; branch?: StoryBranchChoice };
    const accountId = req.authAccountId!;
    try {
      const result = await galacticMissionService.claimMission(accountId, id, body.branch);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });
};

