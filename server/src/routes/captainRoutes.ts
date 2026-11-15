import type { FastifyPluginAsync } from 'fastify';
import { frontierCaptainService } from '../services/FrontierCaptainService';

export const captainRoutes: FastifyPluginAsync = async (server) => {
  server.get('/sector/:sectorId', async (req, reply) => {
    const { sectorId } = req.params as { sectorId: string };
    const query = (req.query || {}) as { accountId?: string };
    const accountId = query.accountId || 'acc_sol_captain';
    const parsedSector = parseInt(sectorId, 10) || 1;
    const captains = await frontierCaptainService.getSectorCaptains(accountId, parsedSector);
    reply.send({ success: true, sectorId: parsedSector, captains });
  });

  server.get('/:captainKey', async (req, reply) => {
    const { captainKey } = req.params as { captainKey: string };
    const query = (req.query || {}) as { accountId?: string; sectorId?: string };
    const accountId = query.accountId || 'acc_sol_captain';
    const sectorId = parseInt(query.sectorId || '1', 10) || 1;
    try {
      const dialog = await frontierCaptainService.openCaptainComms(accountId, captainKey, sectorId);
      reply.send({ success: true, dialog });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/respond', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      captainKey: string;
      sectorId?: number;
      optionId: string;
    };
    try {
      const outcome = await frontierCaptainService.respondToCaptain({
        accountId: body.accountId || 'acc_sol_captain',
        captainKey: body.captainKey,
        sectorId: body.sectorId || 1,
        optionId: body.optionId,
      });
      reply.send(outcome);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });
};

