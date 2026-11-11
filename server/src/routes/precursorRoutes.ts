import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/Database';
import { precursorService } from '../services/PrecursorService';
import { apService } from '../services/ActionPointService';

export const precursorRoutes: FastifyPluginAsync = async (server) => {
  // Planet Precursor Sites
  server.get('/planet/:planetId', async (req, reply) => {
    const { planetId } = req.params as { planetId: string };
    const accountId = ((req.query as any)?.accountId as string) || 'acc_sol_captain';
    try {
      const view = await precursorService.getPlanetPrecursorSitesForPlayer(planetId, accountId);
      const relicRes = await db.query<any>(
        `SELECT sc.quantity FROM ship_cargo sc
         JOIN ships s ON s.id = sc.ship_id
         WHERE s.account_id = $1 AND sc.commodity_id = 'COMM_PRECURSOR_RELIC'`,
        [accountId]
      );
      const relics = relicRes.rows[0]?.quantity || 0;
      reply.send({ success: true, ...view, relics });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Decipher Precursor Megastructure Resonance Waveform
  server.post('/:siteId/decipher', async (req, reply) => {
    const { siteId } = req.params as { siteId: string };
    const body = (req.body || {}) as {
      accountId?: string;
      solution: { freq: number; phase: number; damping: number };
    };
    const accountId = body.accountId || 'acc_sol_captain';
    try {
      const result = await precursorService.decipherPrecursorSite(siteId, accountId, body.solution);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Proto-Tech Research Grid Catalog
  server.get('/research', async (req, reply) => {
    const query = (req.query || {}) as { accountId?: string };
    const accountId = query.accountId || 'acc_sol_captain';
    try {
      const catalog = await precursorService.getResearchCatalog(accountId);
      const relicRes = await db.query<any>(
        `SELECT sc.quantity FROM ship_cargo sc
         JOIN ships s ON s.id = sc.ship_id
         WHERE s.account_id = $1 AND sc.commodity_id = 'COMM_PRECURSOR_RELIC'`,
        [accountId]
      );
      const relics = relicRes.rows[0]?.quantity || 0;
      const accRes = await db.query<any>('SELECT credits FROM accounts WHERE id = $1', [accountId]);
      const credits = accRes.rows[0]?.credits || 0;
      const ap = await apService.getAP(accountId);

      reply.send({ success: true, catalog, relics, credits, ap });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Synthesize Prototype Tech Module
  server.post('/synthesize', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string; techId: string };
    const accountId = body.accountId || 'acc_sol_captain';
    try {
      const result = await precursorService.synthesizePrototypeTech(accountId, body.techId);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Remit Relic to Faction Ambassador
  server.post('/remit', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string; factionId?: string };
    const accountId = body.accountId || 'acc_sol_captain';
    const factionId = (body.factionId || 'FACTION_SOL') as any;
    try {
      const result = await precursorService.remitRelic(accountId, factionId);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });
};
