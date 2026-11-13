import { FastifyPluginAsync } from 'fastify';
import { planetaryFaunaService } from '../services/PlanetaryFaunaService';
import {
  PlanetParamSchema,
  DeployLanderBodySchema,
  RecoverLanderBodySchema,
  type PlanetParam,
  type DeployLanderBody,
  type RecoverLanderBody,
} from '../schemas/faunaSchemas';

export const faunaRoutes: FastifyPluginAsync = async (server) => {
  // 1. Get Planetary Fauna Species Catalog
  server.get<{ Params: PlanetParam }>(
    '/:id/fauna',
    { schema: { params: PlanetParamSchema } },
    async (req, reply) => {
      const planetId = req.params.id;
      const fauna = await planetaryFaunaService.getPlanetFauna(planetId);
      reply.send({
        success: true,
        planetId,
        count: fauna.length,
        fauna,
      });
    }
  );

  // 2. Deploy Surface Lander from Orbit
  server.post<{ Params: PlanetParam; Body: DeployLanderBody }>(
    '/:id/lander/deploy',
    { schema: { params: PlanetParamSchema, body: DeployLanderBodySchema } },
    async (req, reply) => {
      const planetId = req.params.id;
      const { accountId } = req.body;
      const result = await planetaryFaunaService.deployLander(accountId, planetId);
      if (!result.success) {
        return reply.status(400).send(result);
      }
      reply.send(result);
    }
  );

  // 3. Recover Surface Lander & Commit Harvested Ledger
  server.post<{ Params: PlanetParam; Body: RecoverLanderBody }>(
    '/:id/lander/recover',
    { schema: { params: PlanetParamSchema, body: RecoverLanderBodySchema } },
    async (req, reply) => {
      const planetId = req.params.id;
      const result = await planetaryFaunaService.recoverLander(planetId, req.body);
      if (!result.success) {
        return reply.status(400).send(result);
      }
      reply.send(result);
    }
  );

  // 4. Debug Reset Endpoint for Testing
  server.post(
    '/debug-reset-fauna',
    async (_req, reply) => {
      await planetaryFaunaService.debugReset();
      reply.send({ success: true, message: 'Planetary fauna and landers reset to initial baseline.' });
    }
  );
};
