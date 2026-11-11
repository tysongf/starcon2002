import type { FastifyPluginAsync } from 'fastify';
import { tradeService } from '../services/TradeService';
import { reputationService } from '../services/ReputationService';

export const marketRoutes: FastifyPluginAsync = async (server) => {
  // Port Details
  server.get('/api/ports/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const market = await tradeService.getMarketInventory(id);
    if (!market) {
      return reply.status(404).send({ error: 'Port not found' });
    }

    reply.send({
      port: market.port,
      inventory: market.items,
    });
  });

  // Port Market Inventory (with Nemesis docking check)
  server.get('/api/ports/:id/market', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { playerId?: string };
    const playerId = query?.playerId || 'acc_sol_captain';

    const market = await tradeService.getMarketInventory(id, playerId);
    if (!market) {
      return reply.status(404).send({ error: 'Port not found' });
    }

    // Check Nemesis station docking lockdown
    const dockCheck = await reputationService.canDockAtStation(playerId, market.port.faction_id);
    if (!dockCheck.permitted) {
      return reply.status(403).send({
        error: 'STATION_LOCKDOWN',
        reason: dockCheck.reason,
        standing: dockCheck.standing,
        tier: dockCheck.tier,
        port: market.port,
      });
    }

    reply.send(market);
  });

  // Trade Execution
  server.post('/api/ports/:id/trade', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as {
      playerId?: string;
      commodityId: string;
      quantity: number;
      type: 'BUY' | 'SELL';
    };

    const playerId = body.playerId || 'acc_sol_captain';
    const result = await tradeService.executeTrade(
      playerId,
      id,
      body.commodityId,
      body.quantity,
      body.type
    );

    if (!result.success) {
      return reply.status(400).send(result);
    }

    reply.send(result);
  });

  // Trade Intel Radar
  server.get('/api/market/intel', async (_req, reply) => {
    const intel = await tradeService.getSectorTradeIntel();
    reply.send(intel);
  });
};
