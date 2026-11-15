import type { FastifyPluginAsync } from 'fastify';
import { dialogService, DIALOG_TREES } from '../services/DialogService';
import { convoyDialogService } from '../services/ConvoyDialogService';
import { combatManager } from '../services/SectorCombatManager';

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
    const accountId = req.authAccountId!;

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
    const accountId = req.authAccountId!;

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
    const accountId = req.authAccountId!;

    try {
      await dialogService.resetDialog(accountId, body.npcId);
      const resetState = await dialogService.getDialogState(accountId, body.npcId);
      reply.send({ success: true, dialog: resetState });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Day 24: In-Flight Convoy Hailing, Dialogue & Surrender Endpoints
  server.get('/convoy/:convoyId', async (req, reply) => {
    const params = req.params as { convoyId: string };
    const query = (req.query || {}) as { accountId?: string; sectorId?: string };
    const accountId = req.authAccountId!;
    const sectorId = parseInt(query.sectorId || '2', 10);

    try {
      const dialog = await convoyDialogService.getConvoyDialog(accountId, sectorId, params.convoyId);
      reply.send({ success: true, dialog });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/convoy/respond', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      sectorId?: number;
      convoyId: string;
      optionIndex: number;
      actionPayload?: any;
    };
    const accountId = req.authAccountId!;
    const sectorId = body.sectorId || 2;

    try {
      const result = await convoyDialogService.respondConvoyDialog(
        accountId,
        sectorId,
        body.convoyId,
        body.optionIndex,
        body.actionPayload
      );
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/convoy/stand-down', async (req, reply) => {
    const body = (req.body || {}) as { sectorId?: number; isStandDown: boolean };
    const sectorId = body.sectorId || 2;
    combatManager.setCommsStandDown(sectorId, body.isStandDown !== false);
    reply.send({ success: true, isStandDown: body.isStandDown !== false });
  });
};
