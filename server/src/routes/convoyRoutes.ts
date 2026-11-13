import { FastifyPluginAsync } from 'fastify';
import { convoyService } from '../services/ConvoyService';
import { combatManager } from '../services/SectorCombatManager';
import {
  ConvoyQuerySchema,
  ConvoyParamSchema,
  EscortContractQuerySchema,
  AcceptEscortBodySchema,
  ClaimEscortBodySchema,
  FastForwardConvoysBodySchema,
  RaidConvoyBodySchema,
  ResolveSkirmishBodySchema,
  DeclareAllegianceBodySchema,
  type ConvoyQuery,
  type ConvoyParam,
  type EscortContractQuery,
  type AcceptEscortBody,
  type ClaimEscortBody,
  type FastForwardConvoysBody,
  type RaidConvoyBody,
  type ResolveSkirmishBody,
  type DeclareAllegianceBody,
} from '../schemas/convoySchemas';

export const convoyRoutes: FastifyPluginAsync = async (server) => {
  // 1. Sub-Space Traffic Radar: Live Convoys & Skirmishes
  server.get<{ Querystring: ConvoyQuery }>(
    '/traffic',
    { schema: { querystring: ConvoyQuerySchema } },
    async (req, reply) => {
      const sectorId = req.query.sectorId;
      const convoys = await convoyService.getActiveConvoys(sectorId);
      const skirmishes = await convoyService.getActiveSkirmishes(sectorId);
      reply.send({
        success: true,
        count: convoys.length,
        convoys,
        skirmishes,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // 2. Active Sector Skirmishes
  server.get<{ Querystring: ConvoyQuery }>(
    '/skirmishes',
    { schema: { querystring: ConvoyQuerySchema } },
    async (req, reply) => {
      const sectorId = req.query.sectorId;
      const skirmishes = await convoyService.getActiveSkirmishes(sectorId);
      reply.send({
        success: true,
        count: skirmishes.length,
        skirmishes,
      });
    }
  );

  // 3. Mercenary Escort Contracts
  server.get<{ Querystring: EscortContractQuery }>(
    '/contracts',
    { schema: { querystring: EscortContractQuerySchema } },
    async (req, reply) => {
      const accountId = req.query.accountId || 'acc_sol_captain';
      const contracts = await convoyService.getEscortContracts(accountId);
      reply.send({
        success: true,
        count: contracts.length,
        contracts,
      });
    }
  );

  // 4. Accept Escort Contract
  server.post<{ Body: AcceptEscortBody }>(
    '/contracts/accept',
    { schema: { body: AcceptEscortBodySchema } },
    async (req, reply) => {
      const { accountId, convoyId } = req.body;
      const result = await convoyService.acceptEscortContract(accountId, convoyId);
      if (!result.success) {
        return reply.status(400).send({ success: false, error: result.error });
      }
      reply.send(result);
    }
  );

  // 5. Claim Escort Contract Reward
  server.post<{ Body: ClaimEscortBody }>(
    '/contracts/claim',
    { schema: { body: ClaimEscortBodySchema } },
    async (req, reply) => {
      const { accountId, convoyId } = req.body;
      const result = await convoyService.claimEscortContract(accountId, convoyId);
      if (!result.success) {
        return reply.status(400).send({ success: false, error: result.error });
      }
      reply.send(result);
    }
  );

  // 6. Fast-Forward Convoy Schedules (Testing & Time Simulation)
  server.post<{ Body: FastForwardConvoysBody }>(
    '/fast-forward',
    { schema: { body: FastForwardConvoysBodySchema } },
    async (req, reply) => {
      const deltaMinutes = req.body?.deltaMinutes || 5.0;
      const result = await convoyService.advanceConvoySchedules(deltaMinutes);
      reply.send({ success: true, ...result });
    }
  );

  // 7. Record Convoy Raid (Piracy & Market Shortage)
  server.post<{ Body: RaidConvoyBody }>(
    '/raid',
    { schema: { body: RaidConvoyBodySchema } },
    async (req, reply) => {
      const { convoyId, status } = req.body;
      const result = await convoyService.recordConvoyRaid(convoyId, status || 'SURRENDERED');
      if (!result.success) {
        return reply.status(400).send({ success: false, error: result.shortageSummary });
      }
      reply.send(result);
    }
  );

  // 8. Resolve Contested Skirmish
  server.post<{ Body: ResolveSkirmishBody }>(
    '/skirmish/resolve',
    { schema: { body: ResolveSkirmishBodySchema } },
    async (req, reply) => {
      const { skirmishId, winningFactionId, accountId } = req.body;
      const result = await convoyService.resolveSkirmish(skirmishId, winningFactionId, accountId);
      if (!result.success) {
        return reply.status(400).send({ success: false, error: result.message });
      }
      reply.send(result);
    }
  );

  // 8b. Declare Skirmish Allegiance
  server.post<{ Body: DeclareAllegianceBody }>(
    '/skirmish/allegiance',
    { schema: { body: DeclareAllegianceBodySchema } },
    async (req, reply) => {
      const { accountId, sectorId = 201, factionId } = req.body;
      combatManager.declareAllegiance(sectorId, accountId, factionId);
      reply.send({
        success: true,
        accountId,
        sectorId,
        factionId,
        message: `Allegiance declared for ${factionId} in sector ${sectorId}.`,
      });
    }
  );

  // 8c. Trigger Ambush Wing (Testing & Dynamic Hazard Interception)
  server.post<{ Body: { sectorId?: number; convoyId: string; riskLevel?: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME' } }>(
    '/ambush/trigger',
    async (req, reply) => {
      const { sectorId = 2, convoyId, riskLevel = 'MODERATE' } = req.body;
      const raiderIds = combatManager.spawnAmbushWing(sectorId, convoyId, riskLevel);
      reply.send({
        success: true,
        convoyId,
        sectorId,
        riskLevel,
        raiderIds,
      });
    }
  );

  // 9. Single Convoy Lookup
  server.get<{ Params: ConvoyParam }>(
    '/:id',
    { schema: { params: ConvoyParamSchema } },
    async (req, reply) => {
      const convoy = await convoyService.getConvoyById(req.params.id);
      if (!convoy) {
        return reply.status(404).send({ success: false, error: 'CONVOY_NOT_FOUND: Convoy not found.' });
      }
      reply.send({ success: true, convoy });
    }
  );

  // 10. Debug Reset Convoys & Skirmishes
  server.post('/debug-reset', async (_req, reply) => {
    await convoyService.debugReset();
    reply.send({ success: true, message: 'Convoys and skirmishes reset to fresh baseline.' });
  });
};
