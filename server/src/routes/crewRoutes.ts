import type { FastifyPluginAsync } from 'fastify';
import { crewService } from '../services/CrewService';
import {
  CREW_SPECIALTIES,
  CREW_RARITY_SPECS,
  SHIP_BAY_BLUEPRINTS,
  COLONY_MODULES,
  COLONY_FACILITY_CREW_REQUIREMENTS,
  type CrewRarity,
  type CrewSpecialtyId,
} from '../procgen/CrewCatalog';

export const crewRoutes: FastifyPluginAsync = async (server) => {
  server.get('/catalog', async (_req, reply) => {
    reply.send({
      success: true,
      specialties: CREW_SPECIALTIES,
      raritySpecs: CREW_RARITY_SPECS,
      shipBays: SHIP_BAY_BLUEPRINTS,
      colonyModules: COLONY_MODULES,
      colonyFacilityRequirements: COLONY_FACILITY_CREW_REQUIREMENTS,
    });
  });

  server.get('/roster', async (req, reply) => {
    const query = (req.query || {}) as { accountId?: string };
    const accountId = query.accountId || 'acc_sol_captain';
    const summary = await crewService.getRosterSummary(accountId);
    reply.send(summary);
  });

  server.get('/market', async (req, reply) => {
    const query = (req.query || {}) as {
      accountId?: string;
      sourceType?: 'STARPORT' | 'COLONY';
      sourceId?: string;
    };
    const accountId = query.accountId || 'acc_sol_captain';
    const sourceType = query.sourceType === 'COLONY' ? 'COLONY' : 'STARPORT';
    const sourceId = query.sourceId || (sourceType === 'STARPORT' ? 'PORT_AEGIS_01' : '');
    const data = await crewService.getHiringMarket(accountId, sourceType, sourceId);
    reply.send(data);
  });

  server.post('/market/refresh', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string };
    try {
      const res = await crewService.refreshHiringMarket(body.accountId || 'acc_sol_captain');
      reply.send(res);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/hire', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      listingId: string;
      sourceType?: 'STARPORT' | 'COLONY';
      sourceId?: string;
    };
    try {
      const res = await crewService.hireFromMarket(
        body.accountId || 'acc_sol_captain',
        body.listingId,
        body.sourceType === 'COLONY' ? 'COLONY' : 'STARPORT',
        body.sourceId || 'PORT_AEGIS_01'
      );
      reply.send(res);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/assign', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      crewId: string;
      assignmentType: 'RESERVE' | 'SHIP_BAY' | 'COLONY';
      baySlotKey?: string;
      colonyId?: string;
      moduleKey?: string;
    };
    try {
      const overview = await crewService.assignCrew(body.accountId || 'acc_sol_captain', body.crewId, {
        assignmentType: body.assignmentType,
        baySlotKey: body.baySlotKey,
        colonyId: body.colonyId,
        moduleKey: body.moduleKey,
      });
      reply.send(overview);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/broker', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string; crewId: string };
    try {
      const res = await crewService.brokerCrewContract(body.accountId || 'acc_sol_captain', body.crewId);
      reply.send(res);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/settle-cycle', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string };
    try {
      const res = await crewService.settleSalaryCycle(body.accountId || 'acc_sol_captain');
      reply.send(res);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.get('/casualties', async (req, reply) => {
    const query = (req.query || {}) as { accountId?: string };
    const accountId = query.accountId || 'acc_sol_captain';
    const casualties = await crewService.getCrewCasualties(accountId);
    reply.send({ success: true, casualties });
  });

  server.post('/debug-seed', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      specialties: CrewSpecialtyId[];
      rarity?: CrewRarity;
      aptitude?: number;
      grit?: number;
      assignColonyId?: string;
      assignBaySlot?: string;
      name?: string;
    };
    try {
      const member = await crewService.debugSeedOfficer(body.accountId || 'acc_sol_captain', {
        specialties: body.specialties,
        rarity: body.rarity,
        aptitude: body.aptitude,
        grit: body.grit,
        assignColonyId: body.assignColonyId,
        assignBaySlot: body.assignBaySlot,
        name: body.name,
      });
      reply.send({ success: true, crewMember: member });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/debug-clear', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string };
    await crewService.debugClearCrew(body.accountId || 'acc_sol_captain');
    reply.send({ success: true });
  });
};

