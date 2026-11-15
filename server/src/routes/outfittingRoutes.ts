import type { FastifyPluginAsync } from 'fastify';
import { outfittingService, type FitSlotId } from '../services/OutfittingService';
import { outfittingWorkbenchService } from '../services/OutfittingWorkbenchService';

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
    const playerId = req.authAccountId!;
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
    const playerId = req.authAccountId!;
    const loadout = await outfittingService.getPlayerLoadout(playerId);
    reply.send(loadout);
  });

  server.post('/fit', async (req, reply) => {
    const body = (req.body || {}) as {
      playerId?: string;
      itemId?: string;
      inventoryId?: string;
      targetSlot?: FitSlotId;
      slot?: FitSlotId;
    };
    const playerId = req.authAccountId!;
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
    const playerId = req.authAccountId!;
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
    const playerId = req.authAccountId!;
    try {
      const result = await outfittingService.buyModule(playerId, body.blueprintId);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Engineering Reforging & Salvage Workbench (Milestone 1.2)
  server.get('/workbench/costs', async (_req, reply) => {
    reply.send({
      success: true,
      costs: outfittingWorkbenchService.getCostTable(),
    });
  });

  server.post('/workbench/salvage', async (req, reply) => {
    const body = (req.body || {}) as {
      playerId?: string;
      accountId?: string;
      itemId?: string;
    };
    const playerId = req.authAccountId!;
    if (!body.itemId) {
      return reply.status(400).send({ success: false, error: 'Missing itemId' });
    }
    try {
      const result = await outfittingWorkbenchService.salvageModule(playerId, body.itemId);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/workbench/reforge', async (req, reply) => {
    const body = (req.body || {}) as {
      playerId?: string;
      accountId?: string;
      itemId?: string;
      lockedAffixIndex?: number | null;
    };
    const playerId = req.authAccountId!;
    if (!body.itemId) {
      return reply.status(400).send({ success: false, error: 'Missing itemId' });
    }
    try {
      const result = await outfittingWorkbenchService.reforgeModule(
        playerId,
        body.itemId,
        body.lockedAffixIndex
      );
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/workbench/upgrade', async (req, reply) => {
    const body = (req.body || {}) as {
      playerId?: string;
      accountId?: string;
      itemId?: string;
    };
    const playerId = req.authAccountId!;
    if (!body.itemId) {
      return reply.status(400).send({ success: false, error: 'Missing itemId' });
    }
    try {
      const result = await outfittingWorkbenchService.upgradeModule(playerId, body.itemId);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });
};
