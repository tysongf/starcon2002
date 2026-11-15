import crypto from 'node:crypto';
import { db } from '../db/Database';

export const MAX_SQUADRON_SIZE = 12;

export class SquadronService {
  public async getAccountSquadronId(accountId: string): Promise<string | null> {
    const res = await db.query<{ squadron_id: string }>(
      `SELECT squadron_id FROM squadron_members WHERE account_id = $1 LIMIT 1`,
      [accountId]
    );
    return res.rows[0]?.squadron_id || null;
  }

  public async getSquadronMemberIds(accountId: string): Promise<Set<string>> {
    const sqId = await this.getAccountSquadronId(accountId);
    if (!sqId) return new Set();
    const res = await db.query<{ account_id: string }>(
      `SELECT account_id FROM squadron_members WHERE squadron_id = $1`,
      [sqId]
    );
    return new Set(res.rows.map((r) => r.account_id));
  }

  public async createSquadron(accountId: string, name?: string) {
    const existing = await this.getAccountSquadronId(accountId);
    if (existing) {
      throw new Error('You are already in a Squadron. Leave your current Squadron first.');
    }

    const accRes = await db.query<{ callsign: string }>(`SELECT callsign FROM accounts WHERE id = $1`, [accountId]);
    const callsign = accRes.rows[0]?.callsign || 'Commander';
    const sqName = (name && name.trim().length > 0 ? name.trim() : `${callsign}'s Wing`).slice(0, 64);
    const id = `sq_${crypto.randomBytes(6).toString('hex')}`;

    await db.query(`INSERT INTO squadrons (id, name, leader_id) VALUES ($1, $2, $3)`, [
      id,
      sqName,
      accountId,
    ]);
    await db.query(
      `INSERT INTO squadron_members (squadron_id, account_id, role) VALUES ($1, $2, 'LEADER')`,
      [id, accountId]
    );

    return this.getMySquadron(accountId);
  }

  public async inviteToSquadron(inviterId: string, targetAccountId: string) {
    if (inviterId === targetAccountId) {
      throw new Error('Cannot invite yourself to a Squadron.');
    }

    let sqId = await this.getAccountSquadronId(inviterId);
    if (!sqId) {
      const created = await this.createSquadron(inviterId);
      sqId = created?.id || null;
    }
    if (!sqId) throw new Error('Unable to initialize Squadron.');

    const countRes = await db.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM squadron_members WHERE squadron_id = $1`,
      [sqId]
    );
    if (Number(countRes.rows[0]?.cnt || 0) >= MAX_SQUADRON_SIZE) {
      throw new Error(`Squadron is at maximum capacity (${MAX_SQUADRON_SIZE} pilots).`);
    }

    const targetRes = await db.query<{ id: string; callsign: string }>(
      `SELECT id, callsign FROM accounts WHERE id = $1`,
      [targetAccountId]
    );
    if (targetRes.rows.length === 0) {
      throw new Error('Target captain not found.');
    }

    const targetExisting = await this.getAccountSquadronId(targetAccountId);
    if (targetExisting) {
      throw new Error('Target captain is already in a Squadron.');
    }

    const inviteId = `sqinv_${crypto.randomBytes(6).toString('hex')}`;
    await db.query(
      `INSERT INTO squadron_invites (id, squadron_id, inviter_id, target_account_id, status)
       VALUES ($1, $2, $3, $4, 'PENDING')`,
      [inviteId, sqId, inviterId, targetAccountId]
    );

    return { inviteId, squadronId: sqId, targetCallsign: targetRes.rows[0].callsign };
  }

  public async acceptInvite(accountId: string, inviteId: string) {
    const invRes = await db.query<any>(
      `SELECT * FROM squadron_invites WHERE id = $1 AND target_account_id = $2 AND status = 'PENDING'`,
      [inviteId, accountId]
    );
    if (invRes.rows.length === 0) {
      throw new Error('Pending Squadron invite not found.');
    }
    const inv = invRes.rows[0];

    const existing = await this.getAccountSquadronId(accountId);
    if (existing) {
      throw new Error('Leave your current Squadron before accepting a new invite.');
    }

    const countRes = await db.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM squadron_members WHERE squadron_id = $1`,
      [inv.squadron_id]
    );
    if (Number(countRes.rows[0]?.cnt || 0) >= MAX_SQUADRON_SIZE) {
      throw new Error(`Squadron has reached its ${MAX_SQUADRON_SIZE}-pilot cap.`);
    }

    await db.query(
      `INSERT INTO squadron_members (squadron_id, account_id, role) VALUES ($1, $2, 'MEMBER')`,
      [inv.squadron_id, accountId]
    );
    await db.query(`UPDATE squadron_invites SET status = 'ACCEPTED' WHERE id = $1`, [inviteId]);

    return this.getMySquadron(accountId);
  }

  public async declineInvite(accountId: string, inviteId: string): Promise<void> {
    await db.query(
      `UPDATE squadron_invites SET status = 'DECLINED' WHERE id = $1 AND target_account_id = $2 AND status = 'PENDING'`,
      [inviteId, accountId]
    );
  }

  public async leaveSquadron(accountId: string) {
    const sqId = await this.getAccountSquadronId(accountId);
    if (!sqId) return null;

    const sqRes = await db.query<any>(`SELECT leader_id FROM squadrons WHERE id = $1`, [sqId]);
    const isLeader = sqRes.rows[0]?.leader_id === accountId;

    await db.query(`DELETE FROM squadron_members WHERE squadron_id = $1 AND account_id = $2`, [sqId, accountId]);

    const remRes = await db.query<{ account_id: string }>(
      `SELECT account_id FROM squadron_members WHERE squadron_id = $1 ORDER BY joined_at ASC`,
      [sqId]
    );
    if (remRes.rows.length === 0) {
      await db.query(`DELETE FROM squadrons WHERE id = $1`, [sqId]);
      return null;
    }

    if (isLeader) {
      const nextLeader = remRes.rows[0].account_id;
      await db.query(`UPDATE squadrons SET leader_id = $1 WHERE id = $2`, [nextLeader, sqId]);
      await db.query(
        `UPDATE squadron_members SET role = 'LEADER' WHERE squadron_id = $1 AND account_id = $2`,
        [sqId, nextLeader]
      );
    }

    return { leftSquadronId: sqId };
  }

  public async kickMember(leaderId: string, targetAccountId: string) {
    const sqId = await this.getAccountSquadronId(leaderId);
    if (!sqId) throw new Error('You are not in a Squadron.');
    const sqRes = await db.query<any>(`SELECT leader_id FROM squadrons WHERE id = $1`, [sqId]);
    if (sqRes.rows[0]?.leader_id !== leaderId) {
      throw new Error('Only the Squadron Leader can remove pilots.');
    }
    if (targetAccountId === leaderId) {
      throw new Error('Use Leave Squadron to depart as leader.');
    }
    await db.query(`DELETE FROM squadron_members WHERE squadron_id = $1 AND account_id = $2`, [
      sqId,
      targetAccountId,
    ]);
    return this.getMySquadron(leaderId);
  }

  public async getMySquadron(accountId: string) {
    const sqId = await this.getAccountSquadronId(accountId);
    if (!sqId) return null;

    const sqRes = await db.query<any>(`SELECT * FROM squadrons WHERE id = $1`, [sqId]);
    if (sqRes.rows.length === 0) return null;
    const sq = sqRes.rows[0];

    const memRes = await db.query<any>(
      `SELECT m.account_id, m.role, m.joined_at, a.callsign, a.faction_id, a.online_status,
              s.current_sector_id, s.hull_class, s.flagship_name, s.armor, s.max_armor,
              s.shield, s.max_shield, s.is_in_hyperspace, s.hyperspace_x, s.hyperspace_y
       FROM squadron_members m
       JOIN accounts a ON a.id = m.account_id
       LEFT JOIN ships s ON s.account_id = m.account_id
       WHERE m.squadron_id = $1
       ORDER BY m.joined_at ASC`,
      [sqId]
    );

    return {
      id: sq.id,
      name: sq.name,
      leaderId: sq.leader_id,
      maxMembers: MAX_SQUADRON_SIZE,
      members: memRes.rows.map((r) => ({
        accountId: r.account_id,
        callsign: r.callsign,
        factionId: r.faction_id,
        role: r.role,
        onlineStatus: r.online_status,
        currentSectorId: Number(r.current_sector_id || 1),
        hullClass: r.hull_class,
        flagshipName: r.flagship_name,
        armor: Number(r.armor ?? 100),
        maxArmor: Number(r.max_armor ?? 100),
        shield: Number(r.shield ?? 100),
        maxShield: Number(r.max_shield ?? 100),
        isInHyperspace: Boolean(r.is_in_hyperspace),
        hyperspaceX: Number(r.hyperspace_x ?? 500),
        hyperspaceY: Number(r.hyperspace_y ?? 500),
      })),
    };
  }

  public async getPendingInvites(accountId: string) {
    const res = await db.query<any>(
      `SELECT i.id, i.squadron_id, i.inviter_id, i.created_at, s.name AS squadron_name, a.callsign AS inviter_callsign
       FROM squadron_invites i
       JOIN squadrons s ON s.id = i.squadron_id
       JOIN accounts a ON a.id = i.inviter_id
       WHERE i.target_account_id = $1 AND i.status = 'PENDING'
       ORDER BY i.created_at DESC`,
      [accountId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      squadronId: r.squadron_id,
      squadronName: r.squadron_name,
      inviterId: r.inviter_id,
      inviterCallsign: r.inviter_callsign,
      createdAt: r.created_at,
    }));
  }
}

export const squadronService = new SquadronService();

