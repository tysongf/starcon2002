import { FastifyPluginAsync } from 'fastify';
import { planetaryFaunaService } from '../services/PlanetaryFaunaService';
import { planetaryHazardService } from '../services/PlanetaryHazardService';
import {
  PlanetParamSchema,
  DeployLanderBodySchema,
  RecoverLanderBodySchema,
  StashCargoBodySchema,
  TitanHitBodySchema,
  type PlanetParam,
  type DeployLanderBody,
  type RecoverLanderBody,
  type StashCargoBody,
  type TitanHitBody,
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

  // 1.1 Get Planetary Atmospheric & Geological Hazard Profile
  server.get<{ Params: PlanetParam }>(
    '/:id/hazards',
    { schema: { params: PlanetParamSchema } },
    async (req, reply) => {
      const planetId = req.params.id;
      const result = await planetaryHazardService.getPlanetHazards(planetId);
      if (!result.success) {
        return reply.status(404).send(result);
      }
      reply.send(result);
    }
  );

  // 1.2 Get Planetary Apex Titans
  server.get<{ Params: PlanetParam }>(
    '/:id/fauna/titans',
    { schema: { params: PlanetParamSchema } },
    async (req, reply) => {
      const planetId = req.params.id;
      const titans = await planetaryFaunaService.getPlanetTitans(planetId);
      reply.send({
        success: true,
        planetId,
        count: titans.length,
        titans,
      });
    }
  );

  // 2. Deploy Surface Lander from Orbit
  server.post<{ Params: PlanetParam; Body: DeployLanderBody }>(
    '/:id/lander/deploy',
    { schema: { params: PlanetParamSchema, body: DeployLanderBodySchema } },
    async (req, reply) => {
      const planetId = req.params.id;
      const { accountId, crewIds } = req.body;
      const result = await planetaryFaunaService.deployLander(accountId, planetId, crewIds || []);
      if (!result.success) {
        return reply.status(400).send(result);
      }
      reply.send(result);
    }
  );

  // 2.1 Mid-Mission Stash Lander Cargo at Rendezvous Beacon
  server.post<{ Params: PlanetParam; Body: StashCargoBody }>(
    '/:id/lander/stash-cargo',
    { schema: { params: PlanetParamSchema, body: StashCargoBodySchema } },
    async (req, reply) => {
      const planetId = req.params.id;
      const result = await planetaryFaunaService.stashLanderCargo(planetId, req.body);
      if (!result.success) {
        return reply.status(400).send(result);
      }
      reply.send(result);
    }
  );

  // 2.2 Record Titan Stun Hit & Manage Enrage State
  server.post<{ Params: PlanetParam; Body: TitanHitBody }>(
    '/:id/lander/titan-hit',
    { schema: { params: PlanetParamSchema, body: TitanHitBodySchema } },
    async (req, reply) => {
      const planetId = req.params.id;
      const { speciesId } = req.body;
      const result = await planetaryFaunaService.recordTitanStunHit(planetId, speciesId);
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

