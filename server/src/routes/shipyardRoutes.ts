import { FastifyPluginAsync } from 'fastify';
import { planetaryHazardService, LANDER_MODULE_CATALOG } from '../services/PlanetaryHazardService';
import { planetaryFaunaService } from '../services/PlanetaryFaunaService';
import {
  PurchaseLanderBodySchema,
  ClaimLoanerBodySchema,
  EquipModuleBodySchema,
  type PurchaseLanderBody,
  type ClaimLoanerBody,
  type EquipModuleBody,
} from '../schemas/hazardSchemas';

export const shipyardRoutes: FastifyPluginAsync = async (server) => {
  // 1. Get Outfitting Module Catalog for Landers
  server.get('/lander/modules', async (_req, reply) => {
    reply.send({
      success: true,
      modules: Object.values(LANDER_MODULE_CATALOG),
    });
  });

  // 2. Query Current Lander Status
  server.get('/lander/status', async (req, reply) => {
    const query = req.query as { accountId?: string };
    const accountId = query?.accountId || 'acc_sol_captain';
    const lander = await planetaryFaunaService.getActiveLander(accountId);
    if (!lander) {
      return reply.send({
        success: true,
        hasActiveLander: false,
        lander: null,
      });
    }

    reply.send({
      success: true,
      hasActiveLander: true,
      lander,
    });
  });

  // 3. Purchase Replacement Vanguard Mk.I Lander Chassis (1,000 Credits)
  server.post<{ Body: PurchaseLanderBody }>(
    '/lander/purchase',
    { schema: { body: PurchaseLanderBodySchema } },
    async (req, reply) => {
      const { accountId } = req.body;
      const result = await planetaryHazardService.purchaseReplacementLander(accountId);
      if (!result.success) {
        return reply.status(400).send(result);
      }
      reply.send(result);
    }
  );

  // 4. Claim Emergency Loaner Drone (Destitute pilots < 1,000 CR)
  server.post<{ Body: ClaimLoanerBody }>(
    '/lander/claim-loaner',
    { schema: { body: ClaimLoanerBodySchema } },
    async (req, reply) => {
      const { accountId } = req.body;
      const result = await planetaryHazardService.claimLoanerLander(accountId);
      if (!result.success) {
        return reply.status(400).send(result);
      }
      reply.send(result);
    }
  );

  // 5. Equip Environmental Protection Module into Lander
  server.post<{ Body: EquipModuleBody }>(
    '/lander/equip-module',
    { schema: { body: EquipModuleBodySchema } },
    async (req, reply) => {
      const { accountId, slot, moduleId } = req.body;
      const result = await planetaryHazardService.equipLanderModule(accountId, slot, moduleId);
      if (!result.success) {
        return reply.status(400).send(result);
      }
      reply.send(result);
    }
  );
};

