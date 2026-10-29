import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';
import { db } from './db/Database';
import { cache } from './cache/CacheManager';

import { apService, AP_COSTS, type ActionType } from './services/ActionPointService';
import { navigationService } from './services/NavigationService';
import { tradeService } from './services/TradeService';
import { combatManager } from './services/SectorCombatManager';
import { outfittingService } from './services/OutfittingService';

dotenv.config();

const server = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
});

const PORT = parseInt(process.env.PORT || '3000', 10);
const startTime = Date.now();

async function startServer() {
  try {
    // 1. Initialize Database & Cache
    await db.initialize();
    await cache.initialize();

    // 2. Register Plugins
    await server.register(cors, {
      origin: true, // Allow frontend dev server
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    });

    await server.register(websocket);

    // 3. Healthcheck Endpoint (Acceptance Criterion for Day 6)
    server.get('/health', async (_req, reply) => {
      const dbHealth = await db.checkHealth();
      const cacheHealth = await cache.checkHealth();
      const uptimeSec = Math.round((Date.now() - startTime) / 1000);

      const isOverallHealthy = dbHealth.status === 'healthy' && cacheHealth.status === 'healthy';

      reply.status(isOverallHealthy ? 200 : 503).send({
        service: 'Wayward Void Backend',
        status: isOverallHealthy ? 'ONLINE' : 'DEGRADED',
        version: '0.1.0',
        uptimeSeconds: uptimeSec,
        timestamp: new Date().toISOString(),
        database: dbHealth,
        cache: cacheHealth,
      });
    });

    // 4. Sector Registry Endpoint
    server.get('/api/sectors', async (_req, reply) => {
      const { rows } = await db.query('SELECT * FROM sectors ORDER BY id ASC');
      reply.send({ sectors: rows });
    });

    // 5. Port Detail & Dynamic Market Endpoints (Day 9)
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

    server.get('/api/ports/:id/market', async (req, reply) => {
      const { id } = req.params as { id: string };
      const query = req.query as { playerId?: string };
      const playerId = query?.playerId || 'acc_sol_captain';

      const market = await tradeService.getMarketInventory(id, playerId);
      if (!market) {
        return reply.status(404).send({ error: 'Port not found' });
      }

      reply.send(market);
    });

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

    server.get('/api/player/hold', async (req, reply) => {
      const query = req.query as { playerId?: string };
      const playerId = query?.playerId || 'acc_sol_captain';

      const hold = await tradeService.getPlayerHold(playerId);
      if (!hold) {
        return reply.status(404).send({ error: 'Hold not found for player' });
      }

      reply.send(hold);
    });

    server.get('/api/market/intel', async (_req, reply) => {
      const intel = await tradeService.getSectorTradeIntel();
      reply.send(intel);
    });

    // 6. Action Point (AP) Engine Endpoints (Day 7)
    server.get('/api/player/ap', async (req, reply) => {
      const query = req.query as { playerId?: string };
      const playerId = query?.playerId || 'acc_sol_captain';
      const state = await apService.getAP(playerId);
      reply.send({
        ...state,
        costs: AP_COSTS,
      });
    });

    server.post('/api/player/ap/spend', async (req, reply) => {
      const body = (req.body || {}) as {
        playerId?: string;
        action: ActionType;
        cost?: number;
      };

      const playerId = body.playerId || 'acc_sol_captain';
      const action = body.action || 'SECTOR_WARP';

      const result = await apService.spendAP(playerId, action, body.cost);
      if (!result.success) {
        return reply.status(400).send(result);
      }

      reply.send(result);
    });

    server.post('/api/player/ap/debug-set', async (req, reply) => {
      const body = (req.body || {}) as {
        playerId?: string;
        amount: number;
      };

      const playerId = body.playerId || 'acc_sol_captain';
      const amount = typeof body.amount === 'number' ? body.amount : 600;

      const state = await apService.debugSetAP(playerId, amount);
      reply.send(state);
    });

    // 7. Navigation & Hyperspace Warp Endpoints (Day 8)
    server.get('/api/player/ship', async (req, reply) => {
      const query = req.query as { playerId?: string };
      const playerId = query?.playerId || 'acc_sol_captain';
      const ship = await navigationService.getPlayerShip(playerId);
      if (!ship) {
        return reply.status(404).send({ error: 'Ship not found' });
      }
      const currentSector = await navigationService.getSector(ship.current_sector_id);
      const adjacentSectors = await navigationService.getAdjacentSectors(ship.current_sector_id);
      reply.send({
        ship,
        currentSector,
        adjacentSectors,
      });
    });

    server.post('/api/player/ship/refuel', async (req, reply) => {
      const body = (req.body || {}) as {
        playerId?: string;
        amount?: number;
      };
      const playerId = body.playerId || 'acc_sol_captain';
      const updatedShip = await navigationService.refuelShip(playerId, body.amount);
      reply.send({
        success: true,
        ship: updatedShip,
      });
    });

    server.post('/api/player/ship/debug-set', async (req, reply) => {
      const body = (req.body || {}) as {
        playerId?: string;
        sectorId?: number;
        fuel?: number;
      };
      const playerId = body.playerId || 'acc_sol_captain';
      const sectorId = body.sectorId || 1;
      const fuel = typeof body.fuel === 'number' ? body.fuel : 100;
      const res = await db.query(
        'UPDATE ships SET current_sector_id = $1, fuel = $2, updated_at = NOW() WHERE account_id = $3 RETURNING *',
        [sectorId, fuel, playerId]
      );
      reply.send({ success: true, ship: res.rows[0] });
    });

    server.get('/api/sectors/:id', async (req, reply) => {
      const { id } = req.params as { id: string };
      const sectorId = parseInt(id, 10);
      const sector = await navigationService.getSector(sectorId);
      if (!sector) {
        return reply.status(404).send({ error: 'Sector not found' });
      }
      const adjacent = await navigationService.getAdjacentSectors(sectorId);
      const portRes = await db.query('SELECT * FROM ports WHERE sector_id = $1', [sectorId]);
      reply.send({
        sector,
        adjacent,
        port: portRes.rows[0] || null,
      });
    });

    server.post('/api/navigate/jump', async (req, reply) => {
      const body = (req.body || {}) as {
        playerId?: string;
        targetSectorId: number;
      };

      const playerId = body.playerId || 'acc_sol_captain';
      const targetSectorId = typeof body.targetSectorId === 'number'
        ? body.targetSectorId
        : parseInt(body.targetSectorId, 10);

      if (isNaN(targetSectorId)) {
        return reply.status(400).send({
          success: false,
          error: 'targetSectorId must be a valid integer.',
        });
      }

      const result = await navigationService.executeJump(playerId, targetSectorId);
      if (!result.success) {
        return reply.status(400).send(result);
      }

      reply.send(result);
    });

    // 8. EVE-Style Outfitting & Module Management Endpoints (Day 13)
    server.get('/api/outfitting/catalog', async (_req, reply) => {
      const catalog = await outfittingService.getCatalog();
      reply.send({ catalog });
    });

    server.get('/api/outfitting/player', async (req, reply) => {
      const query = (req.query || {}) as { playerId?: string };
      const playerId = query.playerId || 'acc_sol_captain';
      const loadout = await outfittingService.getPlayerLoadout(playerId);
      reply.send(loadout);
    });

    server.post('/api/outfitting/fit', async (req, reply) => {
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

    server.post('/api/outfitting/unfit', async (req, reply) => {
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

    server.post('/api/outfitting/buy', async (req, reply) => {
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

    // 9. Authoritative 20Hz WebSocket Combat Room (Milestone 0.3)
    server.get('/ws/combat', { websocket: true }, async (socket, req) => {
      const query = (req.query || {}) as { playerId?: string; sectorId?: string };
      const playerId = query.playerId || 'acc_sol_captain';
      const sectorId = parseInt(query.sectorId || '1', 10);

      try {
        const ship = await navigationService.getPlayerShip(playerId);
        const loadout = await outfittingService.getPlayerLoadout(playerId);
        combatManager.handleConnection(socket, sectorId, playerId, { ...ship, loadout });
      } catch (err) {
        combatManager.handleConnection(socket, sectorId, playerId);
      }
    });

    // 10. Listen
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Wayward Void API] Server listening on http://localhost:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

startServer();
