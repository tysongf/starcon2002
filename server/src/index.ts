import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';
import { db } from './db/Database';
import { cache } from './cache/CacheManager';

import { apService, AP_COSTS, type ActionType } from './services/ActionPointService';

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

    // 5. Port Detail Endpoint
    server.get('/api/ports/:id', async (req, reply) => {
      const { id } = req.params as { id: string };
      const portRes = await db.query('SELECT * FROM ports WHERE id = $1', [id]);
      if (portRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Port not found' });
      }

      const invRes = await db.query(
        'SELECT * FROM port_inventory WHERE port_id = $1 ORDER BY commodity_id ASC',
        [id]
      );

      reply.send({
        port: portRes.rows[0],
        inventory: invRes.rows,
      });
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

    // 7. Listen
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Wayward Void API] Server listening on http://localhost:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

startServer();
