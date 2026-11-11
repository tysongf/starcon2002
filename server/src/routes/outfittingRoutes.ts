import type { FastifyPluginAsync } from 'fastify';
import { outfittingService } from '../services/OutfittingService';

export const outfittingRoutes: FastifyPluginAsync = async (server) => {
  server.get('/catalog', async (_req, reply) => {
    const catalog = await outfittingService.getCatalog();
    reply.send({ catalog });
  });

  server.get('/player', async (req, reply) => {
    const query = (req.query || {}) as { playerId?: string };
    const playerId = query.playerId || 'acc_sol_captain';
    const loadout = await outfittingService.getPlayerLoadout(playerId);
    reply.send(loadout);
  });

  server.post('/fit', async (req, reply) => {
    const body = (req.body || {}) as {
      playerId?: string;
      itemId?: string;
      inventoryId?: string;
      targetSlot?: 'H1' | 'H2' | 'M1' | 'M2' | 'L1' | 'L2';
      slot?: 'H1' | 'H2' | 'M1' | 'M2' | 'L1' | 'L2';
    };
    const playerId = body.playerId || 'acc_sol_captain';
    const itemId = body.itemId || body.inventoryId;
    const targetSlot = body.targetSlot || body.slot;

    if (!itemId || !targetSlot) {
      return reply.status(400).send({ success: false, error: 'Missing itemId or targetSlot' });
    }

    try {
      const loadout = await outfittingService.fitModule(playerId, itemId, targetSlot);
      reply.send({ success: true, loadout });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/unfit', async (req, reply) => {
    const body = (req.body || {}) as {
      playerId?: string;
      itemId?: string;
      slot?: string;
    };
    const playerId = body.playerId || 'acc_sol_captain';
    try {
      const loadout = await outfittingService.unfitModule(playerId, body.itemId, body.slot);
      reply.send({ success: true, loadout });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/buy', async (req, reply) => {
    const body = (req.body || {}) as {
      playerId?: string;
      blueprintId: string;
    };
    const playerId = body.playerId || 'acc_sol_captain';
    try {
      const result = await outfittingService.buyModule(playerId, body.blueprintId);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });
};
