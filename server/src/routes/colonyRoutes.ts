import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/Database';
import { colonyService } from '../services/ColonyService';
import { outpostGridService } from '../services/OutpostGridService';
import { allianceService } from '../services/AllianceService';
import { OUTPOST_BUILDINGS, type BuildingTypeId, type OutpostLayer } from '../procgen/OutpostCatalog';
import { shipyardService } from '../services/ShipyardService';
import { COLONY_MODULES, COLONY_FACILITY_CREW_REQUIREMENTS, type ColonyModuleKey } from '../procgen/CrewCatalog';

export const colonyRoutes: FastifyPluginAsync = async (server) => {
  // Found Colony Outpost
  server.post('/api/colonies/found', async (req, reply) => {
    const body = (req.body || {}) as {
      accountId?: string;
      planetId: string;
      beaconId: string;
      name?: string;
    };
    const accountId = req.authAccountId!;
    try {
      const colony = await colonyService.foundColony(accountId, body.planetId, body.beaconId, body.name);
      reply.send({ success: true, colony });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Planet Colonies List (includes own colonies + visible foreign colonies with grant flags)
  server.get('/api/colonies/planet/:planetId', async (req, reply) => {
    const { planetId } = req.params as { planetId: string };
    const accountId = req.authAccountId!;
    try {
      const [colonies, foreignColonies] = await Promise.all([
        colonyService.getPlanetColonies(planetId, accountId),
        colonyService.getForeignPlanetColonies(planetId, accountId),
      ]);
      reply.send({ success: true, colonies, foreignColonies });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Colony Detail
  server.get('/api/colonies/:colonyId', async (req, reply) => {
    const { colonyId } = req.params as { colonyId: string };
    const query = (req.query || {}) as { accountId?: string };
    const accountId = req.authAccountId!;
    try {
      const colony = await colonyService.getColonyDetail(colonyId, accountId);
      reply.send({ success: true, colony });
    } catch (err: any) {
      reply.status(err.statusCode || 400).send({ success: false, error: err.message });
    }
  });

  // Upgrade Colony Facility
  server.post('/api/colonies/:colonyId/upgrade', async (req, reply) => {
    const { colonyId } = req.params as { colonyId: string };
    const body = (req.body || {}) as {
      accountId?: string;
      facilityType: 'DERRICK' | 'HABITATION' | 'TERRAFORMER' | 'SILO' | 'SHIPYARD';
    };
    const accountId = req.authAccountId!;
    try {
      const result = await colonyService.upgradeFacility(colonyId, accountId, body.facilityType);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Colony Modules Catalog & Crew Requirements
  server.get('/api/colonies/modules/catalog', async (_req, reply) => {
    reply.send({
      success: true,
      modules: COLONY_MODULES,
      facilityRequirements: COLONY_FACILITY_CREW_REQUIREMENTS,
    });
  });

  // Upgrade Specialty Colony Module
  server.post('/api/colonies/:colonyId/modules/upgrade', async (req, reply) => {
    const { colonyId } = req.params as { colonyId: string };
    const body = (req.body || {}) as { accountId?: string; moduleKey: ColonyModuleKey };
    const accountId = req.authAccountId!;
    try {
      const result = await colonyService.upgradeColonyModule(colonyId, accountId, body.moduleKey);
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Dedicated Colony Shipyard Upgrade Endpoint
  server.post('/api/colonies/:colonyId/shipyard/upgrade', async (req, reply) => {
    const { colonyId } = req.params as { colonyId: string };
    const body = (req.body || {}) as { accountId?: string };
    const accountId = req.authAccountId!;
    try {
      const result = await colonyService.upgradeFacility(colonyId, accountId, 'SHIPYARD');
      reply.send(result);
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Harvest Stockpiled Cargo
  server.post('/api/colonies/:colonyId/harvest', async (req, reply) => {
    const { colonyId } = req.params as { colonyId: string };
    const accountId = req.authAccountId!;
    try {
      const perm = await allianceService.checkColonyPermission(colonyId, accountId, 'HARVEST');
      if (!perm.allowed) {
        return reply.status(403).send({
          success: false,
          error: 'FORBIDDEN: Harvesting this colony silo requires ownership or an active Peer Alliance Harvest grant.',
        });
      }
      const result = await colonyService.harvestColonyCargo(colonyId, accountId);
      reply.send(result);
    } catch (err: any) {
      reply.status(err.statusCode || 400).send({ success: false, error: err.message });
    }
  });

  // Fast-Forward Debug Hook (Supports both /api/colony and /api/colonies)
  const handleFastForward = async (req: any, reply: any) => {
    const body = (req.body || {}) as { accountId?: string; colonyId?: string; seconds?: number };
    const accountId = req.authAccountId!;
    const seconds = Math.max(0, Math.floor(Number(body.seconds) || 0));
    try {
      const params: unknown[] = [accountId, seconds];
      let where = 'account_id = $1';
      if (body.colonyId) {
        params.push(body.colonyId);
        where += ' AND id = $3';
      }
      const { rows } = await db.query<{ id: string }>(
        `UPDATE colonies SET last_harvest_at = last_harvest_at - make_interval(secs => $2::double precision) WHERE ${where} RETURNING id`,
        params
      );
      reply.send({ success: true, fastForwardedSeconds: seconds, colonies: rows.map((r) => r.id) });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  };

  server.post('/api/colony/debug-fast-forward', handleFastForward);
  server.post('/api/colonies/debug-fast-forward', handleFastForward);

  // Resupply Fleet at Colony Orbital Shipyard (Day 36)
  const handleFleetResupply = async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { accountId?: string };
    const accountId = req.authAccountId!;
    const result = await shipyardService.resupplyFleetAtColony(accountId, id);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  };

  server.post('/api/colonies/:id/shipyard/resupply-fleet', handleFleetResupply);
  server.post('/api/colony/:id/shipyard/resupply-fleet', handleFleetResupply);

  // --- Milestone 1.7: Outpost Multi-Layer 12x12 Isometric Grid Routes ---
  server.get('/api/colonies/outpost/catalog', async (_req, reply) => {
    reply.send({ success: true, buildings: OUTPOST_BUILDINGS });
  });

  server.get('/api/colonies/:colonyId/grid', async (req, reply) => {
    const { colonyId } = req.params as { colonyId: string };
    const accountId = req.authAccountId!;
    try {
      const colony = await colonyService.getColonyDetail(colonyId, accountId);
      const { tiles, telemetry } = await outpostGridService.evaluateGridSimulation(colonyId, colony.population);
      reply.send({
        success: true,
        colony,
        telemetry,
        tiles,
        catalog: OUTPOST_BUILDINGS,
      });
    } catch (err: any) {
      reply.status(err.statusCode || 400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/colonies/:colonyId/grid/build', async (req, reply) => {
    const { colonyId } = req.params as { colonyId: string };
    const body = (req.body || {}) as {
      layer: number;
      x: number;
      y: number;
      buildingType: BuildingTypeId;
      instant?: boolean;
    };
    const accountId = req.authAccountId!;
    try {
      const perm = await allianceService.checkColonyPermission(colonyId, accountId, 'BUILD');
      if (!perm.allowed) {
        return reply.status(403).send({
          success: false,
          error: 'FORBIDDEN: Building on this colony requires ownership or an active Peer Alliance Build grant.',
        });
      }
      const placed = await outpostGridService.placeBuilding(
        accountId,
        colonyId,
        Number(body.layer) as OutpostLayer,
        Number(body.x),
        Number(body.y),
        body.buildingType,
        { instant: !!body.instant }
      );
      const colony = await colonyService.getColonyDetail(colonyId, accountId);
      const { tiles, telemetry } = await outpostGridService.evaluateGridSimulation(colonyId, colony.population);
      reply.send({
        success: true,
        tile: placed.tile,
        creditCostPaid: placed.creditCostPaid,
        alloyCostPaid: placed.alloyCostPaid,
        colony,
        telemetry,
        tiles,
      });
    } catch (err: any) {
      reply.status(err.statusCode || 400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/colonies/:colonyId/grid/toggle', async (req, reply) => {
    const { colonyId } = req.params as { colonyId: string };
    const body = (req.body || {}) as { layer: number; x: number; y: number };
    const accountId = req.authAccountId!;
    try {
      const perm = await allianceService.checkColonyPermission(colonyId, accountId, 'BUILD');
      if (!perm.allowed) {
        return reply.status(403).send({
          success: false,
          error: 'FORBIDDEN: Toggling structures requires ownership or an active Peer Alliance Build grant.',
        });
      }
      const toggled = await outpostGridService.toggleBuildingPower(
        colonyId,
        Number(body.layer) as OutpostLayer,
        Number(body.x),
        Number(body.y)
      );
      const colony = await colonyService.getColonyDetail(colonyId, accountId);
      const { tiles, telemetry } = await outpostGridService.evaluateGridSimulation(colonyId, colony.population);
      reply.send({ success: true, tile: toggled.tile, colony, telemetry, tiles });
    } catch (err: any) {
      reply.status(err.statusCode || 400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/colonies/:colonyId/grid/demolish', async (req, reply) => {
    const { colonyId } = req.params as { colonyId: string };
    const body = (req.body || {}) as { layer: number; x: number; y: number };
    const accountId = req.authAccountId!;
    try {
      const perm = await allianceService.checkColonyPermission(colonyId, accountId, 'BUILD');
      if (!perm.allowed) {
        return reply.status(403).send({
          success: false,
          error: 'FORBIDDEN: Demolishing structures requires ownership or an active Peer Alliance Build grant.',
        });
      }
      const res = await outpostGridService.demolishBuilding(
        accountId,
        colonyId,
        Number(body.layer) as OutpostLayer,
        Number(body.x),
        Number(body.y)
      );
      const colony = await colonyService.getColonyDetail(colonyId, accountId);
      const { tiles, telemetry } = await outpostGridService.evaluateGridSimulation(colonyId, colony.population);
      reply.send({ success: true, refundCredits: res.refundCredits, colony, telemetry, tiles });
    } catch (err: any) {
      reply.status(err.statusCode || 400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/colonies/:colonyId/grid/complete-now', async (req, reply) => {
    const { colonyId } = req.params as { colonyId: string };
    const accountId = req.authAccountId!;
    try {
      const perm = await allianceService.checkColonyPermission(colonyId, accountId, 'BUILD');
      if (!perm.allowed) {
        return reply.status(403).send({
          success: false,
          error: 'FORBIDDEN: Queue operations require ownership or an active Peer Alliance Build grant.',
        });
      }
      const completedCount = await outpostGridService.completePendingNow(colonyId);
      const colony = await colonyService.getColonyDetail(colonyId, accountId);
      const { tiles, telemetry } = await outpostGridService.evaluateGridSimulation(colonyId, colony.population);
      reply.send({ success: true, completedCount, colony, telemetry, tiles });
    } catch (err: any) {
      reply.status(err.statusCode || 400).send({ success: false, error: err.message });
    }
  });
};
