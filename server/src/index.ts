import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';
import { db } from './db/Database';
import { cache } from './cache/CacheManager';

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

    // 6. Listen
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Wayward Void API] Server listening on http://localhost:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

startServer();
