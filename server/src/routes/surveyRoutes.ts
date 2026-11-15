import type { FastifyPluginAsync } from 'fastify';
import { planetaryService } from '../services/PlanetaryService';
import { reputationService } from '../services/ReputationService';
import { getAllPlanetSubtypes, getDistinctMainClasses } from '../procgen/PlanetTaxonomyCatalog';

export const surveyRoutes: FastifyPluginAsync = async (server) => {
  // Planet Taxonomy Catalog (15 Main Classes x 3 Subtypes = 45 Types)
  server.get('/taxonomy', async (_req, reply) => {
    reply.send({
      success: true,
      mainClassCount: getDistinctMainClasses().length,
      subtypeCount: getAllPlanetSubtypes().length,
      mainClasses: getDistinctMainClasses(),
      subtypes: getAllPlanetSubtypes(),
    });
  });

  // Sector Planets
  server.get('/sector/:sectorId', async (req, reply) => {
    const { sectorId } = req.params as { sectorId: string };
    const query = (req.query || {}) as { accountId?: string };
    const accountId = req.authAccountId!;
    try {
      const planets = await planetaryService.getSectorPlanets(parseInt(sectorId, 10), accountId);
      reply.send({ success: true, planets });
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message });
    }
  });

  // Planetary Procedural Lifeforms (Lazy-Seeded Pure Xenobiology)
  server.get('/:planetId/lifeforms', async (req, reply) => {
    const { planetId } = req.params as { planetId: string };
    try {
      const data = await planetaryService.getPlanetLifeforms(planetId);
      reply.send({
        success: true,
        planetId,
        subtype: data.planet.subtype,
        mainClass: data.planet.mainClassLabel,
        count: data.lifeforms.length,
        lifeforms: data.lifeforms,
      });
    } catch (err: any) {
      reply.status(404).send({ success: false, error: err.message });
    }
  });

  // Planet Detail
  server.get('/:planetId', async (req, reply) => {
    const { planetId } = req.params as { planetId: string };
    const query = (req.query || {}) as { accountId?: string };
    const accountId = req.authAccountId!;
    try {
      const planet = await planetaryService.getPlanetDetail(planetId, accountId);
      reply.send({ success: true, planet });
    } catch (err: any) {
      reply.status(404).send({ success: false, error: err.message });
    }
  });

  // Scanner Sweep (minerals, bio, anomalies)
  server.post('/:planetId/scan', async (req, reply) => {
    const { planetId } = req.params as { planetId: string };
    const body = (req.body || {}) as { accountId?: string; scanBand: 'MINERALS' | 'BIO' | 'ANOMALIES' };
    const accountId = req.authAccountId!;
    try {
      const result = await planetaryService.performScannerSweep(accountId, planetId, body.scanBand);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Atmospheric Probe Descent
  server.post('/:planetId/probe', async (req, reply) => {
    const { planetId } = req.params as { planetId: string };
    const body = (req.body || {}) as { accountId?: string; targetLat?: number; targetLng?: number; shieldBoost?: boolean };
    const accountId = req.authAccountId!;
    try {
      const result = await planetaryService.launchAtmosphericProbe(
        accountId,
        planetId,
        body.targetLat,
        body.targetLng,
        body.shieldBoost || false
      );
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Astrometry Bureau Cartography Remittance
  server.post('/:planetId/sell-data', async (req, reply) => {
    const { planetId } = req.params as { planetId: string };
    const body = (req.body || {}) as { accountId?: string; portId?: string };
    const accountId = req.authAccountId!;
    try {
      const result = await planetaryService.sellSurveyData(accountId, planetId, body.portId || 'PORT_AEGIS_01');
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Airspace Clearance & Truce Check
  server.get('/:planetId/airspace', async (req, reply) => {
    const { planetId } = req.params as { planetId: string };
    const query = (req.query || {}) as { accountId?: string };
    const accountId = req.authAccountId!;
    try {
      const clearance = await reputationService.getAirspaceClearance(accountId, planetId);
      reply.send({ success: true, clearance, serverTime: new Date().toISOString() });
    } catch (err: any) {
      reply.status(404).send({ success: false, error: err.message });
    }
  });
};
