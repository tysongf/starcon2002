import Fastify, { type FastifyInstance, type FastifyServerOptions, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { db } from './db/Database';
import { cache } from './cache/CacheManager';
import { reputationService } from './services/ReputationService';
import { combatManager } from './services/SectorCombatManager';

import { playerRoutes } from './routes/playerRoutes';
import { navigationRoutes } from './routes/navigationRoutes';
import { marketRoutes } from './routes/marketRoutes';
import { outfittingRoutes } from './routes/outfittingRoutes';
import { combatRoutes } from './routes/combatRoutes';
import { dialogRoutes } from './routes/dialogRoutes';
import { reputationRoutes } from './routes/reputationRoutes';
import { surveyRoutes } from './routes/surveyRoutes';
import { colonyRoutes } from './routes/colonyRoutes';
import { precursorRoutes } from './routes/precursorRoutes';
import { convoyRoutes } from './routes/convoyRoutes';
import { faunaRoutes } from './routes/faunaRoutes';
import { shipyardRoutes } from './routes/shipyardRoutes';
import { xenobiologyRoutes } from './routes/xenobiologyRoutes';
import { fleetRoutes } from './routes/fleetRoutes';
import { starmapRoutes } from './routes/starmapRoutes';
import { missionRoutes } from './routes/missionRoutes';
import { captainRoutes } from './routes/captainRoutes';
import { crewRoutes } from './routes/crewRoutes';
import { galacticMissionService } from './services/GalacticMissionService';

export async function buildApp(options: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const startTime = Date.now();

  const server = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
    ...options,
  });

  // 1. Initialize Database & Cache
  await db.initialize();
  await cache.initialize();

  // 2. Register Global Fastify Plugins
  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });

  await server.register(websocket);

  // 3. Centralized Fastify Error Handler
  server.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.message,
        details: error.validation,
      });
    }

    const statusCode = error.statusCode || 500;
    const msg = error.message || 'Internal Server Error';

    reply.status(statusCode).send({
      success: false,
      error: msg,
    });
  });

  // 4. Global Healthcheck Endpoint
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

  // 5. Wire Domain Cross-Service Event Listeners
  reputationService.onTruceDeclared((accountId, sectorId, factionId, durationMs) => {
    combatManager.notifyTruce(sectorId, accountId, factionId, durationMs);
  });

  galacticMissionService.onBountyMissionActivated((sectorId, missionId, callsign, factionId, hullClass) => {
    combatManager.spawnBountyTarget(sectorId, missionId, callsign, factionId, hullClass);
  });

  // 6. Register 10 Service-Aligned Domain Route Plugins
  await server.register(playerRoutes, { prefix: '/api/player' });
  await server.register(navigationRoutes);
  await server.register(marketRoutes);
  await server.register(outfittingRoutes, { prefix: '/api/outfitting' });
  await server.register(combatRoutes);
  await server.register(dialogRoutes, { prefix: '/api/dialog' });
  await server.register(reputationRoutes, { prefix: '/api/reputation' });
  await server.register(surveyRoutes, { prefix: '/api/planets' });
  await server.register(colonyRoutes);
  await server.register(precursorRoutes, { prefix: '/api/precursor' });
  await server.register(convoyRoutes, { prefix: '/api/convoys' });
  await server.register(faunaRoutes, { prefix: '/api/planets' });
  await server.register(shipyardRoutes, { prefix: '/api/shipyard' });
  await server.register(xenobiologyRoutes, { prefix: '/api/xenobiology' });
  await server.register(fleetRoutes, { prefix: '/api/fleet' });
  await server.register(starmapRoutes, { prefix: '/api/starmap' });
  await server.register(missionRoutes, { prefix: '/api/missions' });
  await server.register(captainRoutes, { prefix: '/api/captains' });
  await server.register(crewRoutes, { prefix: '/api/crew' });

  return server;
}
