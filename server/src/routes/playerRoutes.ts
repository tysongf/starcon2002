import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/Database';
import { tradeService } from '../services/TradeService';
import { apService, AP_COSTS, type ActionType } from '../services/ActionPointService';
import { navigationService } from '../services/NavigationService';
import { reputationService } from '../services/ReputationService';
import { FACTION_REGISTRY } from '../../../shared/FactionRegistry';
import { fleetService } from '../services/FleetService';
import { starmapService } from '../services/StarmapService';
import { getHullDef } from '../procgen/HullClassCatalog';

export const playerRoutes: FastifyPluginAsync = async (server) => {
  // Hold telemetry
  server.get('/hold', async (req, reply) => {
    const query = req.query as { playerId?: string };
    const playerId = req.authAccountId!;

    const hold = await tradeService.getPlayerHold(playerId);
    if (!hold) {
      return reply.status(404).send({ error: 'Hold not found for player' });
    }
    reply.send(hold);
  });

  // Action Point (AP) System
  server.get('/ap', async (req, reply) => {
    const query = req.query as { playerId?: string };
    const playerId = req.authAccountId!;
    const state = await apService.getAP(playerId);
    reply.send({
      ...state,
      costs: AP_COSTS,
    });
  });

  server.post('/ap/spend', async (req, reply) => {
    const body = (req.body || {}) as {
      playerId?: string;
      action: ActionType;
      cost?: number;
    };

    const playerId = req.authAccountId!;
    const action = body.action || 'SECTOR_WARP';

    const result = await apService.spendAP(playerId, action, body.cost);
    if (!result.success) {
      return reply.status(400).send(result);
    }
    reply.send(result);
  });

  server.post('/ap/debug-set', async (req, reply) => {
    const body = (req.body || {}) as {
      playerId?: string;
      amount?: number;
    };
    const playerId = req.authAccountId!;
    const amount = typeof body.amount === 'number' ? body.amount : 600;

    const state = await apService.debugSetAP(playerId, amount);
    reply.send(state);
  });

  // Ship Status & Refuel
  server.get('/ship', async (req, reply) => {
    const query = req.query as { playerId?: string };
    const playerId = req.authAccountId!;
    const ship = await navigationService.getPlayerShip(playerId);
    if (!ship) {
      return reply.status(404).send({ error: 'Ship not found' });
    }
    const currentSector = await navigationService.getSector(ship.current_sector_id);
    const adjacentSectors = await navigationService.getAdjacentSectors(ship.current_sector_id);
    const hullDef = getHullDef(ship.hull_class);
    reply.send({
      ship: {
        ...ship,
        main_hull_class: (ship as any).main_hull_class || hullDef.mainClass,
        hull_subtype: (ship as any).hull_subtype || hullDef.displayName,
        faction_id: (ship as any).faction_id || hullDef.factionId,
        power_grid_max: Number((ship as any).power_grid_max ?? hullDef.powerGridMax),
        cpu_max: Number((ship as any).cpu_max ?? hullDef.cpuMax),
        base_speed: Number((ship as any).base_speed ?? hullDef.baseSpeed),
        base_turn_rate: Number((ship as any).base_turn_rate ?? hullDef.baseTurnRate),
        high_slots: Number((ship as any).high_slots ?? hullDef.highSlots),
        mid_slots: Number((ship as any).mid_slots ?? hullDef.midSlots),
        low_slots: Number((ship as any).low_slots ?? hullDef.lowSlots),
        geometryProfile: hullDef.geometryProfile,
      },
      currentSector,
      adjacentSectors,
    });
  });

  server.post('/ship/refuel', async (req, reply) => {
    const body = (req.body || {}) as {
      playerId?: string;
      amount?: number;
    };
    const playerId = req.authAccountId!;
    const updatedShip = await navigationService.refuelShip(playerId, body.amount);
    reply.send({
      success: true,
      ship: updatedShip,
    });
  });

  server.post('/ship/debug-set', async (req, reply) => {
    const body = (req.body || {}) as {
      playerId?: string;
      sectorId?: number;
      fuel?: number;
    };
    const playerId = req.authAccountId!;
    const sectorId = body.sectorId || 1;
    const fuel = typeof body.fuel === 'number' ? body.fuel : 100;
    const res = await db.query(
      'UPDATE ships SET current_sector_id = $1, fuel = $2, updated_at = NOW() WHERE account_id = $3 RETURNING *',
      [sectorId, fuel, playerId]
    );
    reply.send({ success: true, ship: res.rows[0] });
  });

  // Debug Credits
  server.post('/debug-credits', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string; credits?: number };
    const accountId = req.authAccountId!;
    const credits = typeof body.credits === 'number' ? body.credits : 2500;
    await db.query('UPDATE accounts SET credits = $1 WHERE id = $2', [credits, accountId]);
    reply.send({ success: true, credits });
  });

  // Debug Cargo Helper
  server.post('/debug-cargo', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string; commodityId?: string; quantity?: number };
    const accountId = req.authAccountId!;
    const commodityId = body.commodityId || 'COMM_BIO_SPECIMENS';
    const quantity = typeof body.quantity === 'number' ? body.quantity : 10;
    const sRes = await db.query<{ id: string }>('SELECT id FROM ships WHERE account_id = $1 LIMIT 1', [accountId]);
    if (sRes.rows.length === 0) return reply.status(404).send({ success: false, error: 'Ship not found' });
    const shipId = sRes.rows[0].id;
    if (quantity <= 0) {
      await db.query('DELETE FROM ship_cargo WHERE ship_id = $1 AND commodity_id = $2', [shipId, commodityId]);
    } else {
      await db.query(
        `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (ship_id, commodity_id)
         DO UPDATE SET quantity = EXCLUDED.quantity`,
        [shipId, commodityId, quantity]
      );
    }
    reply.send({ success: true, commodityId, quantity });
  });

  // Debug Reset Survey / Colony / Precursor
  server.post('/debug-reset-survey', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string; planetId?: string };
    const accountId = req.authAccountId!;
    if (body.planetId) {
      await db.query('DELETE FROM planet_surveys WHERE account_id = $1 AND planet_id = $2', [accountId, body.planetId]);
      await db.query('DELETE FROM planet_beacons WHERE account_id = $1 AND planet_id = $2', [accountId, body.planetId]);
      await db.query('DELETE FROM colonies WHERE account_id = $1 AND planet_id = $2', [accountId, body.planetId]);
      await db.query('UPDATE precursor_sites SET is_deciphered = FALSE WHERE planet_id = $1', [body.planetId]);
      if (body.planetId === 'planet_sec1_aegis') {
        await db.query(`UPDATE planets SET habitability_rating = 18 WHERE id = 'planet_sec1_aegis'`);
      }
    } else {
      await db.query('DELETE FROM planet_surveys WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM planet_beacons WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM colonies WHERE account_id = $1', [accountId]);
      await db.query(`UPDATE planets SET habitability_rating = 18 WHERE id = 'planet_sec1_aegis'`);
      await db.query('UPDATE player_fleet SET deployment_slot = NULL WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM crew_roster WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM crew_market_claims WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM crew_casualties WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM player_landers WHERE account_id = $1', [accountId]);
      await db.query('UPDATE accounts SET crew_arrears_cycles = 0, crew_refresh_nonce = 0 WHERE id = $1', [accountId]);
      await db.query('UPDATE precursor_sites SET is_deciphered = FALSE');
      await db.query('DELETE FROM precursor_research WHERE account_id = $1', [accountId]);
    }
    reply.send({ success: true, message: 'Survey, colony, and precursor state reset successfully.' });
  });

  // Fresh-Pilot Baseline Reset (Day 21 / Milestone 0.4 baseline)
  server.post('/debug-baseline', async (req, reply) => {
    const body = (req.body || {}) as { accountId?: string };
    const accountId = req.authAccountId!;
    try {
      await db.query('UPDATE accounts SET credits = 2500, tech_components = 25, crew_arrears_cycles = 0, crew_refresh_nonce = 0 WHERE id = $1', [accountId]);
      await db.query(
        `UPDATE ships SET
           current_sector_id = 1,
           hull_class = 'CORVETTE',
           main_hull_class = 'CORVETTE',
           hull_subtype = 'Sol Endeavour Corvette',
           flagship_name = 'UNS Endeavour',
           faction_id = 'FACTION_SOL',
           hull_seed = 12345,
           fuel = 100,
           max_fuel = 100,
           cargo_capacity = 40,
           armor = 100,
           max_armor = 100,
           shield = 100,
           max_shield = 100,
           power_grid_max = 120.0,
           cpu_max = 180.0,
           base_speed = 60.0,
           base_turn_rate = 2.4,
           high_slots = 2,
           mid_slots = 2,
           low_slots = 2,
           bay_slots = 2,
           nav_target_sector_id = NULL,
           is_in_hyperspace = FALSE,
           hyperspace_x = 500.0,
           hyperspace_y = 500.0,
           is_in_quasispace = FALSE,
           quasispace_x = 150.0,
           quasispace_y = 150.0,
           decoys_remaining = 3,
           hyperspace_immunity_until = NULL,
           updated_at = NOW()
         WHERE account_id = $1`,
        [accountId]
      );
      await db.query('DELETE FROM ship_cargo WHERE ship_id IN (SELECT id FROM ships WHERE account_id = $1)', [accountId]);
      await apService.debugSetAP(accountId, 600);
      for (const entry of Object.values(FACTION_REGISTRY)) {
        await reputationService.debugSetStanding(accountId, entry.id, entry.startingStanding);
      }
      await db.query('DELETE FROM diplomatic_truces WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM player_dialog_state WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM frontier_captain_encounters WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM galactic_missions WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM planet_surveys WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM planet_beacons WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM colonies WHERE account_id = $1', [accountId]);
      await db.query('UPDATE player_fleet SET deployment_slot = NULL WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM crew_roster WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM crew_market_claims WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM crew_casualties WHERE account_id = $1', [accountId]);
      await db.query('DELETE FROM player_landers WHERE account_id = $1', [accountId]);
      await db.query('UPDATE accounts SET crew_arrears_cycles = 0, crew_refresh_nonce = 0 WHERE id = $1', [accountId]);
      await db.query('UPDATE precursor_sites SET is_deciphered = FALSE');
      await db.query('DELETE FROM precursor_research WHERE account_id = $1', [accountId]);
      await db.query(`DELETE FROM player_inventory WHERE account_id = $1 AND (blueprint_id LIKE 'BP_PRECURSOR_%' OR id::text NOT LIKE 'a1b2c3d4-%')`, [accountId]);
      await db.query(`UPDATE player_inventory SET is_fitted = true, fit_slot = 'H1' WHERE id = 'a1b2c3d4-e5f6-7890-abcd-111111111111' AND account_id = $1`, [accountId]);
      await db.query(`UPDATE player_inventory SET is_fitted = true, fit_slot = 'H2' WHERE id = 'a1b2c3d4-e5f6-7890-abcd-222222222222' AND account_id = $1`, [accountId]);
      await db.query(`UPDATE player_inventory SET is_fitted = true, fit_slot = 'M1' WHERE id = 'a1b2c3d4-e5f6-7890-abcd-333333333333' AND account_id = $1`, [accountId]);
      await db.query(`UPDATE player_inventory SET is_fitted = true, fit_slot = 'M2' WHERE id = 'a1b2c3d4-e5f6-7890-abcd-444444444444' AND account_id = $1`, [accountId]);
      await db.query(`UPDATE player_inventory SET is_fitted = true, fit_slot = 'L1' WHERE id = 'a1b2c3d4-e5f6-7890-abcd-555555555555' AND account_id = $1`, [accountId]);
      await db.query(`UPDATE player_inventory SET is_fitted = true, fit_slot = 'L2' WHERE id = 'a1b2c3d4-e5f6-7890-abcd-666666666666' AND account_id = $1`, [accountId]);
      await db.query(`UPDATE player_inventory SET is_fitted = false, fit_slot = NULL WHERE id IN ('a1b2c3d4-e5f6-7890-abcd-777777777777', 'a1b2c3d4-e5f6-7890-abcd-888888888888') AND account_id = $1`, [accountId]);
      await db.query(`
        INSERT INTO port_inventory (port_id, commodity_id, stock, demand, capacity, buy_price, sell_price)
        VALUES 
          ('PORT_AEGIS_01', 'COMM_FUEL', 2450, 500, 4000, 24.5, 26.2),
          ('PORT_AEGIS_01', 'COMM_RATIONS', 1200, 600, 2000, 38.0, 41.5),
          ('PORT_AEGIS_01', 'COMM_ORE', 400, 1800, 2500, 62.0, 68.0),
          ('PORT_AEGIS_01', 'COMM_ALLOY', 450, 900, 1500, 152.0, 160.0),
          ('PORT_AEGIS_01', 'COMM_BIO_SPECIMENS', 35, 120, 300, 75.0, 78.0),
          ('PORT_SMELTER_01', 'COMM_FUEL', 750, 1200, 2500, 32.0, 35.0),
          ('PORT_SMELTER_01', 'COMM_RATIONS', 550, 1400, 2000, 52.0, 56.5),
          ('PORT_SMELTER_01', 'COMM_ORE', 2300, 300, 4000, 35.0, 38.0),
          ('PORT_SMELTER_01', 'COMM_ALLOY', 1250, 400, 2500, 115.0, 122.0),
          ('PORT_SMELTER_01', 'COMM_BIO_SPECIMENS', 20, 150, 400, 89.0, 92.0),
          ('PORT_AEGIS_01', 'COMM_PYRITE_ORE', 280, 1200, 2200, 82.0, 88.0),
          ('PORT_AEGIS_01', 'COMM_CRYO_ICE', 420, 950, 2000, 92.0, 98.0),
          ('PORT_AEGIS_01', 'COMM_TITANIUM_ORE', 260, 1350, 2200, 134.0, 144.0),
          ('PORT_AEGIS_01', 'COMM_LITHIUM_QUARTZ', 110, 850, 1400, 208.0, 224.0),
          ('PORT_AEGIS_01', 'COMM_PHORID_RESIN', 95, 780, 1200, 222.0, 240.0),
          ('PORT_AEGIS_01', 'COMM_OBSIDIAN_MATRIX', 45, 620, 1000, 328.0, 355.0),
          ('PORT_AEGIS_01', 'COMM_AETHER_CORE', 18, 450, 700, 485.0, 520.0),
          ('PORT_SMELTER_01', 'COMM_PYRITE_ORE', 1450, 500, 3200, 62.0, 68.0),
          ('PORT_SMELTER_01', 'COMM_CRYO_ICE', 180, 1400, 2400, 104.0, 114.0),
          ('PORT_SMELTER_01', 'COMM_TITANIUM_ORE', 980, 750, 2500, 108.0, 118.0),
          ('PORT_SMELTER_01', 'COMM_LITHIUM_QUARTZ', 580, 450, 1600, 172.0, 186.0),
          ('PORT_SMELTER_01', 'COMM_PHORID_RESIN', 65, 920, 1200, 228.0, 246.0),
          ('PORT_SMELTER_01', 'COMM_OBSIDIAN_MATRIX', 310, 400, 1200, 285.0, 305.0),
          ('PORT_SMELTER_01', 'COMM_AETHER_CORE', 24, 520, 800, 490.0, 530.0)
        ON CONFLICT (port_id, commodity_id) DO UPDATE SET 
          stock = EXCLUDED.stock,
          demand = EXCLUDED.demand,
          capacity = EXCLUDED.capacity,
          buy_price = EXCLUDED.buy_price,
          sell_price = EXCLUDED.sell_price
      `);
      await fleetService.debugReset(accountId);
      starmapService.resetExpedition(accountId);
      reply.send({ success: true, message: 'Pilot reset to fresh-start baseline.' });
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message });
    }
  });
};
