import type { FastifyPluginAsync } from 'fastify';
import { raidDirectorService, type BossArchetypeId } from '../services/RaidDirectorService';
import { SYNERGY_MODULES } from '../procgen/SynergyModuleCatalog';
import { RELIC_HULL_CATALOG } from '../procgen/HullClassCatalog';
import { OUTPOST_RELIC_BUILDINGS } from '../procgen/OutpostCatalog';
import { combatManager } from '../services/SectorCombatManager';

export const raidRoutes: FastifyPluginAsync = async (server) => {
  server.get('/api/raids/active', async (_req, reply) => {
    const raids = await raidDirectorService.getActiveRaids();
    reply.send({ success: true, raids });
  });

  server.get('/api/raids/history', async (_req, reply) => {
    const history = await raidDirectorService.getRaidHistory(20);
    reply.send({ success: true, history });
  });

  server.get('/api/raids/synergies/catalog', async (_req, reply) => {
    reply.send({
      success: true,
      modules: SYNERGY_MODULES,
      relicHulls: RELIC_HULL_CATALOG,
      relicColonyCores: OUTPOST_RELIC_BUILDINGS,
    });
  });

  server.get('/api/raids/rolls', async (req, reply) => {
    const accountId = req.authAccountId!;
    const rolls = await raidDirectorService.getOpenRollsForAccount(accountId);
    reply.send({ success: true, rolls });
  });

  server.post('/api/raids/rolls/:rollId/bid', async (req, reply) => {
    const accountId = req.authAccountId!;
    const { rollId } = req.params as { rollId: string };
    const body = (req.body || {}) as { bidType?: 'NEED' | 'GREED' | 'PASS' };
    try {
      const bidType = body.bidType || 'GREED';
      if (!['NEED', 'GREED', 'PASS'].includes(bidType)) {
        return reply.status(400).send({ success: false, error: 'bidType must be NEED, GREED, or PASS.' });
      }
      const result = await raidDirectorService.submitRollBid(accountId, rollId, bidType);
      reply.send({ success: true, roll: result });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.get('/api/raids/relics', async (req, reply) => {
    const accountId = req.authAccountId!;
    const relics = await raidDirectorService.getAccountRelics(accountId);
    reply.send({
      success: true,
      relics,
      availableHullBlueprints: RELIC_HULL_CATALOG,
      availableColonyCores: OUTPOST_RELIC_BUILDINGS,
    });
  });

  server.post('/api/raids/debug-spawn', async (req, reply) => {
    const body = (req.body || {}) as {
      sectorId?: number;
      archetype?: BossArchetypeId;
      maxHp?: number;
      maxShields?: number;
    };
    try {
      const encounter = await raidDirectorService.debugSpawnBoss({
        sectorId: Number(body.sectorId || 4),
        archetype: body.archetype,
        maxHp: body.maxHp,
        maxShields: body.maxShields,
      });
      if (encounter) {
        await combatManager.syncRaidBossRoom(encounter.sectorId, encounter);
      }
      reply.send({ success: true, encounter });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });
};

