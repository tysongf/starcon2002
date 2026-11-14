import type { FastifyPluginAsync } from 'fastify';
import { outfittingService } from '../services/OutfittingService';

export const outfittingRoutes: FastifyPluginAsync = async (server) => {
  server.get('/catalog', async (_req, reply) => {
    const catalog = await outfittingService.getCatalog();
    reply.send({ catalog });
  });

  server.get('/taxonomy', async (_req, reply) => {
    reply.send({
      success: true,
      ...outfittingService.getModuleTaxonomy(),
    });
  });

  server.get('/shop', async (req, reply) => {
    const query = (req.query || {}) as { sectorId?: string; epoch?: string };
    const sectorId = parseInt(query.sectorId || '1', 10) || 1;
    const epoch = parseInt(query.epoch || '1', 10) || 1;
    const stock = await outfittingService.getStationShopStock(sectorId, epoch);
    reply.send({ success: true, ...stock });
  });

  server.post('/shop/buy', async (req, reply) => {
    const body = (req.body || {}) as {
      playerId?: string;
      sectorId?: number;
      slotIndex?: number;
      epoch?: number;
    };
    const playerId = body.playerId || 'acc_sol_captain';
    const sectorId = Number(body.sectorId || 1);
    const slotIndex = Number(body.slotIndex ?? 0);
    const epoch = Number(body.epoch || 1);
    try {
      const result = await outfittingService.buyShopModule(playerId, sectorId, slotIndex, epoch);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
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
