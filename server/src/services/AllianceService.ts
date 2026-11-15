import crypto from 'node:crypto';
import { db } from '../db/Database';

export type ColonyPermissionKind = 'INSPECT' | 'HARVEST' | 'BUILD';

export class AllianceService {
  private canonicalPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  public async proposePact(requesterId: string, targetAccountId: string) {
    if (requesterId === targetAccountId) {
      throw new Error('Cannot propose a peer alliance pact with yourself.');
    }

    const targetRes = await db.query<{ id: string; callsign: string }>(
      `SELECT id, callsign FROM accounts WHERE id = $1`,
      [targetAccountId]
    );
    if (targetRes.rows.length === 0) {
      throw new Error('Target captain not found.');
    }

    const [capA, capB] = this.canonicalPair(requesterId, targetAccountId);
    const existing = await db.query<any>(
      `SELECT * FROM alliance_pacts WHERE captain_a_id = $1 AND captain_b_id = $2`,
      [capA, capB]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.status === 'ACTIVE') {
        throw new Error('You already have an active peer alliance pact with this captain.');
      }
      if (row.status === 'PENDING') {
        throw new Error('A peer alliance pact proposal is already pending between you.');
      }
      await db.query(
        `UPDATE alliance_pacts SET status = 'PENDING', initiated_by = $1, updated_at = NOW() WHERE id = $2`,
        [requesterId, row.id]
      );
      return { pactId: row.id, targetAccountId, targetCallsign: targetRes.rows[0].callsign, status: 'PENDING' };
    }

    const pactId = `ally_${crypto.randomBytes(6).toString('hex')}`;
    await db.query(
      `INSERT INTO alliance_pacts (id, captain_a_id, captain_b_id, initiated_by, status)
       VALUES ($1, $2, $3, $4, 'PENDING')`,
      [pactId, capA, capB, requesterId]
    );

    return { pactId, targetAccountId, targetCallsign: targetRes.rows[0].callsign, status: 'PENDING' };
  }

  public async acceptPact(responderId: string, pactId: string) {
    const res = await db.query<any>(`SELECT * FROM alliance_pacts WHERE id = $1`, [pactId]);
    if (res.rows.length === 0) {
      throw new Error('Alliance pact not found.');
    }
    const pact = res.rows[0];
    if (pact.captain_a_id !== responderId && pact.captain_b_id !== responderId) {
      throw new Error('Forbidden: You are not a party to this alliance pact.');
    }
    if (pact.status !== 'PENDING') {
      throw new Error(`Alliance pact is ${pact.status}, not PENDING.`);
    }
    if (pact.initiated_by === responderId) {
      throw new Error('Wait for the other captain to accept your alliance proposal.');
    }

    await db.query(`UPDATE alliance_pacts SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1`, [pactId]);

    // Seed bilateral peer grant rows (each side controls what they grant TO the other)
    const pairs: Array<[string, string]> = [
      [pact.captain_a_id, pact.captain_b_id],
      [pact.captain_b_id, pact.captain_a_id],
    ];
    for (const [grantor, grantee] of pairs) {
      await db.query(
        `INSERT INTO alliance_peer_grants (pact_id, grantor_account_id, grantee_account_id, friendly_fire_shield, can_share_intel, can_view_all_colonies)
         VALUES ($1, $2, $3, TRUE, TRUE, FALSE)
         ON CONFLICT (pact_id, grantor_account_id, grantee_account_id) DO NOTHING`,
        [pactId, grantor, grantee]
      );
    }

    return this.getMyAlliances(responderId);
  }

  public async endPact(actorId: string, pactId: string) {
    const res = await db.query<any>(`SELECT * FROM alliance_pacts WHERE id = $1`, [pactId]);
    if (res.rows.length === 0) throw new Error('Alliance pact not found.');
    const pact = res.rows[0];
    if (pact.captain_a_id !== actorId && pact.captain_b_id !== actorId) {
      throw new Error('Forbidden: You are not part of this alliance pact.');
    }

    await db.query(`UPDATE alliance_pacts SET status = 'ENDED', updated_at = NOW() WHERE id = $1`, [pactId]);

    // Revoke colony grants between the two captains immediately
    await db.query(
      `DELETE FROM alliance_colony_grants
       WHERE (granted_by_account_id = $1 AND grantee_account_id = $2)
          OR (granted_by_account_id = $2 AND grantee_account_id = $1)`,
      [pact.captain_a_id, pact.captain_b_id]
    );

    return { endedPactId: pactId };
  }

  public async updatePeerGrants(
    grantorId: string,
    pactId: string,
    updates: {
      friendlyFireShield?: boolean;
      canShareIntel?: boolean;
      canViewAllColonies?: boolean;
    }
  ) {
    const res = await db.query<any>(`SELECT * FROM alliance_pacts WHERE id = $1 AND status = 'ACTIVE'`, [pactId]);
    if (res.rows.length === 0) throw new Error('Active alliance pact not found.');
    const pact = res.rows[0];
    if (pact.captain_a_id !== grantorId && pact.captain_b_id !== grantorId) {
      throw new Error('Forbidden: Not part of this alliance pact.');
    }
    const granteeId = pact.captain_a_id === grantorId ? pact.captain_b_id : pact.captain_a_id;

    const curRes = await db.query<any>(
      `SELECT * FROM alliance_peer_grants WHERE pact_id = $1 AND grantor_account_id = $2 AND grantee_account_id = $3`,
      [pactId, grantorId, granteeId]
    );
    const cur = curRes.rows[0] || {
      friendly_fire_shield: true,
      can_share_intel: true,
      can_view_all_colonies: false,
    };

    const ff = updates.friendlyFireShield ?? Boolean(cur.friendly_fire_shield);
    const intel = updates.canShareIntel ?? Boolean(cur.can_share_intel);
    const viewCol = updates.canViewAllColonies ?? Boolean(cur.can_view_all_colonies);

    await db.query(
      `INSERT INTO alliance_peer_grants (pact_id, grantor_account_id, grantee_account_id, friendly_fire_shield, can_share_intel, can_view_all_colonies, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (pact_id, grantor_account_id, grantee_account_id) DO UPDATE SET
         friendly_fire_shield = EXCLUDED.friendly_fire_shield,
         can_share_intel = EXCLUDED.can_share_intel,
         can_view_all_colonies = EXCLUDED.can_view_all_colonies,
         updated_at = NOW()`,
      [pactId, grantorId, granteeId, ff, intel, viewCol]
    );

    return this.getMyAlliances(grantorId);
  }

  public async updateColonyGrants(
    ownerId: string,
    colonyId: string,
    granteeAccountId: string,
    grants: {
      canInspectGrid?: boolean;
      canHarvestSilo?: boolean;
      canBuildOutpost?: boolean;
    }
  ) {
    if (ownerId === granteeAccountId) {
      throw new Error('You already have full ownership of your own colony.');
    }
    const colRes = await db.query<{ id: string; account_id: string }>(
      `SELECT id, account_id FROM colonies WHERE id = $1`,
      [colonyId]
    );
    if (colRes.rows.length === 0) throw new Error('Colony not found.');
    if (colRes.rows[0].account_id !== ownerId) {
      throw new Error('Forbidden: Only the colony owner can assign colony access grants.');
    }

    const activeAlly = await this.hasActivePact(ownerId, granteeAccountId);
    if (!activeAlly) {
      throw new Error('Target captain must share an ACTIVE peer alliance pact before receiving colony grants.');
    }

    const curRes = await db.query<any>(
      `SELECT * FROM alliance_colony_grants WHERE colony_id = $1 AND grantee_account_id = $2`,
      [colonyId, granteeAccountId]
    );
    const cur = curRes.rows[0] || {
      can_inspect_grid: false,
      can_harvest_silo: false,
      can_build_outpost: false,
    };

    const canBuild = grants.canBuildOutpost ?? Boolean(cur.can_build_outpost);
    const canHarvest = grants.canHarvestSilo ?? Boolean(cur.can_harvest_silo);
    const canInspect = grants.canInspectGrid ?? (Boolean(cur.can_inspect_grid) || canBuild || canHarvest);

    const id = cur.id || `cgr_${crypto.randomBytes(6).toString('hex')}`;
    await db.query(
      `INSERT INTO alliance_colony_grants (id, colony_id, grantee_account_id, granted_by_account_id, can_inspect_grid, can_harvest_silo, can_build_outpost, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (colony_id, grantee_account_id) DO UPDATE SET
         can_inspect_grid = EXCLUDED.can_inspect_grid,
         can_harvest_silo = EXCLUDED.can_harvest_silo,
         can_build_outpost = EXCLUDED.can_build_outpost,
         updated_at = NOW()`,
      [id, colonyId, granteeAccountId, ownerId, canInspect, canHarvest, canBuild]
    );

    return {
      colonyId,
      granteeAccountId,
      canInspectGrid: canInspect,
      canHarvestSilo: canHarvest,
      canBuildOutpost: canBuild,
    };
  }

  public async hasActivePact(a: string, b: string): Promise<boolean> {
    if (a === b) return false;
    const [capA, capB] = this.canonicalPair(a, b);
    const res = await db.query<{ status: string }>(
      `SELECT status FROM alliance_pacts WHERE captain_a_id = $1 AND captain_b_id = $2`,
      [capA, capB]
    );
    return res.rows[0]?.status === 'ACTIVE';
  }

  public async getActiveAllyIds(accountId: string): Promise<Set<string>> {
    const res = await db.query<{ captain_a_id: string; captain_b_id: string }>(
      `SELECT captain_a_id, captain_b_id FROM alliance_pacts
       WHERE status = 'ACTIVE' AND (captain_a_id = $1 OR captain_b_id = $1)`,
      [accountId]
    );
    const set = new Set<string>();
    for (const r of res.rows) {
      set.add(r.captain_a_id === accountId ? r.captain_b_id : r.captain_a_id);
    }
    return set;
  }

  public async getFriendlyFireShieldedAllyIds(accountId: string): Promise<Set<string>> {
    const res = await db.query<{ other_id: string }>(
      `SELECT
         CASE WHEN p.captain_a_id = $1 THEN p.captain_b_id ELSE p.captain_a_id END AS other_id
       FROM alliance_pacts p
       JOIN alliance_peer_grants g1
         ON g1.pact_id = p.id AND g1.grantor_account_id = $1
       JOIN alliance_peer_grants g2
         ON g2.pact_id = p.id AND g2.grantee_account_id = $1
       WHERE p.status = 'ACTIVE'
         AND (p.captain_a_id = $1 OR p.captain_b_id = $1)
         AND g1.friendly_fire_shield = TRUE
         AND g2.friendly_fire_shield = TRUE`,
      [accountId]
    );
    return new Set(res.rows.map((r) => r.other_id));
  }

  public async checkColonyPermission(
    colonyId: string,
    actorAccountId: string,
    needed: ColonyPermissionKind
  ): Promise<{ allowed: boolean; ownerAccountId: string; isOwner: boolean }> {
    const colRes = await db.query<{ account_id: string }>(
      `SELECT account_id FROM colonies WHERE id = $1`,
      [colonyId]
    );
    if (colRes.rows.length === 0) {
      throw new Error('Colony outpost not found.');
    }
    const ownerAccountId = colRes.rows[0].account_id;
    if (ownerAccountId === actorAccountId) {
      return { allowed: true, ownerAccountId, isOwner: true };
    }

    const activeAlly = await this.hasActivePact(ownerAccountId, actorAccountId);
    if (!activeAlly) {
      return { allowed: false, ownerAccountId, isOwner: false };
    }

    const grantRes = await db.query<any>(
      `SELECT can_inspect_grid, can_harvest_silo, can_build_outpost
       FROM alliance_colony_grants
       WHERE colony_id = $1 AND grantee_account_id = $2`,
      [colonyId, actorAccountId]
    );
    const g = grantRes.rows[0];

    if (needed === 'INSPECT') {
      if (g?.can_inspect_grid || g?.can_harvest_silo || g?.can_build_outpost) {
        return { allowed: true, ownerAccountId, isOwner: false };
      }
      const peerRes = await db.query<{ can_view_all_colonies: boolean }>(
        `SELECT g.can_view_all_colonies
         FROM alliance_peer_grants g
         JOIN alliance_pacts p ON p.id = g.pact_id
         WHERE p.status = 'ACTIVE' AND g.grantor_account_id = $1 AND g.grantee_account_id = $2`,
        [ownerAccountId, actorAccountId]
      );
      return {
        allowed: Boolean(peerRes.rows[0]?.can_view_all_colonies),
        ownerAccountId,
        isOwner: false,
      };
    }

    if (needed === 'HARVEST') {
      return { allowed: Boolean(g?.can_harvest_silo), ownerAccountId, isOwner: false };
    }

    return { allowed: Boolean(g?.can_build_outpost), ownerAccountId, isOwner: false };
  }

  public async getMyAlliances(accountId: string) {
    const pactRes = await db.query<any>(
      `SELECT p.*,
              CASE WHEN p.captain_a_id = $1 THEN p.captain_b_id ELSE p.captain_a_id END AS peer_id,
              a.callsign AS peer_callsign,
              a.faction_id AS peer_faction_id,
              a.online_status AS peer_online_status
       FROM alliance_pacts p
       JOIN accounts a ON a.id = (CASE WHEN p.captain_a_id = $1 THEN p.captain_b_id ELSE p.captain_a_id END)
       WHERE p.captain_a_id = $1 OR p.captain_b_id = $1
       ORDER BY p.updated_at DESC`,
      [accountId]
    );

    const peerGrantsRes = await db.query<any>(
      `SELECT * FROM alliance_peer_grants WHERE grantor_account_id = $1 OR grantee_account_id = $1`,
      [accountId]
    );

    const colGrantsRes = await db.query<any>(
      `SELECT g.*, c.name AS colony_name, c.planet_id
       FROM alliance_colony_grants g
       JOIN colonies c ON c.id = g.colony_id
       WHERE g.granted_by_account_id = $1 OR g.grantee_account_id = $1`,
      [accountId]
    );

    const ownColoniesRes = await db.query<{ id: string; name: string; planet_id: string }>(
      `SELECT id, name, planet_id FROM colonies WHERE account_id = $1 ORDER BY created_at ASC`,
      [accountId]
    );

    const pacts = pactRes.rows
      .filter((r) => r.status !== 'ENDED')
      .map((r) => {
        const grantedByMe = peerGrantsRes.rows.find(
          (g) => g.pact_id === r.id && g.grantor_account_id === accountId
        );
        const grantedToMe = peerGrantsRes.rows.find(
          (g) => g.pact_id === r.id && g.grantee_account_id === accountId
        );
        const colonyGrantsGiven = colGrantsRes.rows
          .filter((cg) => cg.granted_by_account_id === accountId && cg.grantee_account_id === r.peer_id)
          .map((cg) => ({
            colonyId: cg.colony_id,
            colonyName: cg.colony_name,
            planetId: cg.planet_id,
            canInspectGrid: Boolean(cg.can_inspect_grid),
            canHarvestSilo: Boolean(cg.can_harvest_silo),
            canBuildOutpost: Boolean(cg.can_build_outpost),
          }));
        const colonyGrantsReceived = colGrantsRes.rows
          .filter((cg) => cg.grantee_account_id === accountId && cg.granted_by_account_id === r.peer_id)
          .map((cg) => ({
            colonyId: cg.colony_id,
            colonyName: cg.colony_name,
            planetId: cg.planet_id,
            canInspectGrid: Boolean(cg.can_inspect_grid),
            canHarvestSilo: Boolean(cg.can_harvest_silo),
            canBuildOutpost: Boolean(cg.can_build_outpost),
          }));

        return {
          pactId: r.id,
          status: r.status,
          initiatedByMe: r.initiated_by === accountId,
          peerAccountId: r.peer_id,
          peerCallsign: r.peer_callsign,
          peerFactionId: r.peer_faction_id,
          peerOnlineStatus: r.peer_online_status,
          myGrantsToPeer: grantedByMe
            ? {
                friendlyFireShield: Boolean(grantedByMe.friendly_fire_shield),
                canShareIntel: Boolean(grantedByMe.can_share_intel),
                canViewAllColonies: Boolean(grantedByMe.can_view_all_colonies),
              }
            : { friendlyFireShield: true, canShareIntel: true, canViewAllColonies: false },
          peerGrantsToMe: grantedToMe
            ? {
                friendlyFireShield: Boolean(grantedToMe.friendly_fire_shield),
                canShareIntel: Boolean(grantedToMe.can_share_intel),
                canViewAllColonies: Boolean(grantedToMe.can_view_all_colonies),
              }
            : { friendlyFireShield: true, canShareIntel: true, canViewAllColonies: false },
          colonyGrantsGiven,
          colonyGrantsReceived,
        };
      });

    return {
      pacts,
      myColonies: ownColoniesRes.rows.map((c) => ({ id: c.id, name: c.name, planetId: c.planet_id })),
    };
  }
}

export const allianceService = new AllianceService();

