import { FastifyPluginAsync } from 'fastify';
import { planetaryHazardService, LANDER_MODULE_CATALOG } from '../services/PlanetaryHazardService';
import { LANDER_CHASSIS_TIERS } from '../procgen/LanderCrewCatalog';
import { planetaryFaunaService } from '../services/PlanetaryFaunaService';
import { shipyardService } from '../services/ShipyardService';
import {
  PurchaseLanderBodySchema,
  ClaimLoanerBodySchema,
  EquipModuleBodySchema,
  type PurchaseLanderBody,
  type ClaimLoanerBody,
  type EquipModuleBody,
} from '../schemas/hazardSchemas';

export const shipyardRoutes: FastifyPluginAsync = async (server) => {
  // 1. Get Outfitting Module Catalog & Chassis Tiers for Landers
  server.get('/lander/modules', async (_req, reply) => {
    reply.send({
      success: true,
      modules: Object.values(LANDER_MODULE_CATALOG),
      tiers: Object.values(LANDER_CHASSIS_TIERS),
    });
  });

  server.get('/lander/tiers', async (_req, reply) => {
    reply.send({
      success: true,
      tiers: Object.values(LANDER_CHASSIS_TIERS),
      modules: Object.values(LANDER_MODULE_CATALOG),
    });
  });

  // 2. Query Current Lander Status
  server.get('/lander/status', async (req, reply) => {
    const query = req.query as { accountId?: string };
    const accountId = req.authAccountId!;
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

  // 3. Purchase Replacement or Upgraded Tier (1..4) Lander Chassis
  server.post<{ Body: PurchaseLanderBody }>(
    '/lander/purchase',
    { schema: { body: PurchaseLanderBodySchema } },
    async (req, reply) => {
      const { accountId, tier } = req.body;
      const result = await planetaryHazardService.purchaseReplacementLander(accountId, tier ?? 1);
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

  // 6. Get Starship Fleet Blueprints Catalog (Day 33)
  server.get('/fleet/blueprints', async (req, reply) => {
    const query = (req.query || {}) as { accountId?: string; colonyId?: string };
    const accountId = req.authAccountId!;
    const result = await shipyardService.getFleetBlueprints(accountId, query.colonyId);
    reply.send(result);
  });

  // 7. Fabricate Escort Starship Hull (Day 33)
  server.post('/fleet/fabricate', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      blueprintId: string;
      customName?: string;
      colonyId?: string;
    };
    const accountId = req.authAccountId!;
    if (!body.blueprintId) {
      return reply.status(400).send({ success: false, error: 'blueprintId is required.' });
    }

    const result = await shipyardService.fabricateFleetHull(
      accountId,
      body.blueprintId,
      body.customName,
      body.colonyId
    );
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 7b. Get 64-Hull Starship Foundry Catalog (Milestone 1.3: 8 Main Classes x 8 Factions)
  server.get('/hulls', async (req, reply) => {
    const query = (req.query || {}) as {
      accountId?: string;
      colonyId?: string;
      mainClass?: string;
      factionId?: string;
    };
    const accountId = req.authAccountId!;
    const result = await shipyardService.getHullCatalog(
      accountId,
      query.colonyId,
      query.mainClass,
      query.factionId
    );
    reply.send(result);
  });

  // 7c. Commission Any of the 64 Hulls (optionally promoting immediately to Active Flagship)
  server.post('/hulls/commission', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      hullClass: string;
      customName?: string;
      colonyId?: string;
      promoteImmediately?: boolean;
    };
    const accountId = req.authAccountId!;
    if (!body.hullClass) {
      return reply.status(400).send({ success: false, error: 'hullClass is required.' });
    }
    const result = await shipyardService.commissionHull(
      accountId,
      body.hullClass,
      body.customName,
      body.colonyId,
      Boolean(body.promoteImmediately)
    );
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 8. Refurbish Recovered Derelict Escort Wreck (Day 35: 50% discount)
  server.post('/fleet/refurbish', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      wreckId: string;
      colonyId?: string;
    };
    const accountId = req.authAccountId!;
    if (!body.wreckId) {
      return reply.status(400).send({ success: false, error: 'wreckId is required.' });
    }

    const result = await shipyardService.refurbishEscortWreck(
      accountId,
      body.wreckId,
      body.colonyId
    );
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  // 9. Resupply Fleet at Colony (Day 36)
  server.post('/colonies/:id/resupply-fleet', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { accountId?: string };
    const accountId = req.authAccountId!;
    const result = await shipyardService.resupplyFleetAtColony(accountId, id);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  server.post('/fleet/resupply', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string; colonyId: string };
    const accountId = req.authAccountId!;
    if (!body.colonyId) {
      return reply.status(400).send({ success: false, error: 'colonyId is required.' });
    }
    const result = await shipyardService.resupplyFleetAtColony(accountId, body.colonyId);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });
};

