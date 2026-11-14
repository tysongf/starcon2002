import { FastifyPluginAsync } from 'fastify';
import { xenobiologyService } from '../services/XenobiologyService';
import {
  SubmitSpecimensBodySchema,
  ResearchProjectBodySchema,
  UpgradeBiosphereBodySchema,
  SynthesizeItemBodySchema,
  UseStimBodySchema,
  DebugResetBodySchema,
  type SubmitSpecimensBody,
  type ResearchProjectBody,
  type UpgradeBiosphereBody,
  type SynthesizeItemBody,
  type UseStimBody,
  type DebugResetBody,
} from '../schemas/xenobiologySchemas';

export const xenobiologyRoutes: FastifyPluginAsync = async (server) => {
  // 1. Get Xenobiology Lab Status & Catalogs
  server.get('/lab', async (req, reply) => {
    const query = req.query as { accountId?: string };
    const accountId = query?.accountId || 'acc_sol_captain';
    const status = await xenobiologyService.getLabStatus(accountId);
    reply.send(status);
  });

  // 2. Submit Harvested Biological Specimens
  server.post<{ Body: SubmitSpecimensBody }>(
    '/submit-specimens',
    { schema: { body: SubmitSpecimensBodySchema } },
    async (req, reply) => {
      const { accountId, quantity, speciesId } = req.body;
      const result = await xenobiologyService.submitSpecimens(accountId, quantity, speciesId);
      if (!result.success) {
        return reply.status(400).send(result);
      }
      reply.send(result);
    }
  );

  // 3. Research Targeted Colony Genetic Breakthrough
  server.post<{ Body: ResearchProjectBody }>(
    '/research-project',
    { schema: { body: ResearchProjectBodySchema } },
    async (req, reply) => {
      const { accountId, projectId } = req.body;
      const result = await xenobiologyService.researchProject(accountId, projectId);
      if (!result.success) {
        return reply.status(400).send(result);
      }
      reply.send(result);
    }
  );

  // 4. Upgrade Global Biosphere Fertility Tier (Tiers 1-5)
  server.post<{ Body: UpgradeBiosphereBody }>(
    '/upgrade-biosphere',
    { schema: { body: UpgradeBiosphereBodySchema } },
    async (req, reply) => {
      const { accountId } = req.body;
      const result = await xenobiologyService.upgradeBiosphereTier(accountId);
      if (!result.success) {
        return reply.status(400).send(result);
      }
      reply.send(result);
    }
  );

  // 5. Synthesize Tactical Bio-Tech Item / Consumable
  server.post<{ Body: SynthesizeItemBody }>(
    '/synthesize',
    { schema: { body: SynthesizeItemBodySchema } },
    async (req, reply) => {
      const { accountId, itemId } = req.body;
      const result = await xenobiologyService.synthesizeItem(accountId, itemId);
      if (!result.success) {
        return reply.status(400).send(result);
      }
      reply.send(result);
    }
  );

  // 6. Activate Combat Stimulant Buff
  server.post<{ Body: UseStimBody }>(
    '/use-stim',
    { schema: { body: UseStimBodySchema } },
    async (req, reply) => {
      const { accountId, stimId } = req.body;
      const result = await xenobiologyService.useCombatStim(accountId, stimId);
      if (!result.success) {
        return reply.status(400).send(result);
      }
      reply.send(result);
    }
  );

  // 6.1 Galactic Xenodex Catalog
  server.get('/xenodex', async (req, reply) => {
    const query = req.query as { accountId?: string };
    const accountId = query?.accountId || 'acc_sol_captain';
    const xenodex = await xenobiologyService.getXenodex(accountId);
    reply.send(xenodex);
  });

  // 7. Debug Reset Endpoint
  server.post<{ Body: DebugResetBody }>(
    '/debug-reset',
    { schema: { body: DebugResetBodySchema } },
    async (req, reply) => {
      const accountId = req.body?.accountId || 'acc_sol_captain';
      await xenobiologyService.debugReset(accountId);
      reply.send({ success: true, message: 'Reset biotech research state.' });
    }
  );
};

