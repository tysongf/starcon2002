import type { FastifyPluginAsync } from 'fastify';
import { dialogService, DIALOG_TREES } from '../services/DialogService';

export const dialogRoutes: FastifyPluginAsync = async (server) => {
  server.get('/npcs', async (_req, reply) => {
    const npcs = Object.values(DIALOG_TREES).map((t) => ({
      npcId: t.npcId,
      speakerName: t.speakerName,
      species: t.species,
      title: t.title,
    }));
    reply.send({ success: true, npcs });
  });

  server.get('/:npcId', async (req, reply) => {
    const params = req.params as { npcId: string };
    const query = (req.query || {}) as { accountId?: string };
    const accountId = query.accountId || 'acc_sol_captain';

    try {
      const dialog = await dialogService.getDialogState(accountId, params.npcId);
      reply.send({ success: true, dialog });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/respond', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      npcId: string;
      optionIndex: number;
    };
    const accountId = body.accountId || 'acc_sol_captain';

    try {
      const result = await dialogService.respondDialog(accountId, body.npcId, body.optionIndex);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/reset', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      npcId: string;
    };
    const accountId = body.accountId || 'acc_sol_captain';

    try {
      await dialogService.resetDialog(accountId, body.npcId);
      const resetState = await dialogService.getDialogState(accountId, body.npcId);
      reply.send({ success: true, dialog: resetState });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });
};
