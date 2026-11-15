import crypto from 'node:crypto';
import { db } from '../db/Database';

export class DuelService {
  public async getActiveDuelForPlayer(accountId: string) {
    const res = await db.query<any>(
      `SELECT * FROM player_duels
       WHERE status = 'ACTIVE' AND (challenger_id = $1 OR defender_id = $1)
       ORDER BY created_at DESC LIMIT 1`,
      [accountId]
    );
    return res.rows[0] || null;
  }

  public async challengeDuel(challengerId: string, defenderId: string, wagerCredits: number = 0) {
    if (challengerId === defenderId) {
      throw new Error('Cannot challenge yourself to a duel.');
    }
    const wager = Math.max(0, Math.floor(Number(wagerCredits || 0)));

    const [cRes, dRes] = await Promise.all([
      db.query<any>(
        `SELECT a.id, a.callsign, a.credits, s.current_sector_id, s.armor
         FROM accounts a JOIN ships s ON s.account_id = a.id WHERE a.id = $1 LIMIT 1`,
        [challengerId]
      ),
      db.query<any>(
        `SELECT a.id, a.callsign, a.credits, s.current_sector_id, s.armor
         FROM accounts a JOIN ships s ON s.account_id = a.id WHERE a.id = $1 LIMIT 1`,
        [defenderId]
      ),
    ]);
    if (cRes.rows.length === 0 || dRes.rows.length === 0) {
      throw new Error('Duel participant ship/account not found.');
    }
    const chal = cRes.rows[0];
    const def = dRes.rows[0];

    if (Number(chal.current_sector_id) !== Number(def.current_sector_id)) {
      throw new Error('Both captains must be in the same sector to start a duel.');
    }
    if (Number(chal.credits) < wager) {
      throw new Error('Insufficient Credits for duel wager.');
    }
    if ((await this.getActiveDuelForPlayer(challengerId)) || (await this.getActiveDuelForPlayer(defenderId))) {
      throw new Error('One of the captains is already in an active duel.');
    }

    const id = `duel_${crypto.randomBytes(6).toString('hex')}`;
    await db.query(
      `INSERT INTO player_duels (id, sector_id, challenger_id, defender_id, wager_credits, status, challenger_pre_hull, defender_pre_hull)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)`,
      [
        id,
        Number(chal.current_sector_id),
        challengerId,
        defenderId,
        wager,
        Number(chal.armor || 100),
        Number(def.armor || 100),
      ]
    );

    return {
      id,
      sectorId: Number(chal.current_sector_id),
      challengerId,
      challengerCallsign: chal.callsign,
      defenderId,
      defenderCallsign: def.callsign,
      wagerCredits: wager,
      status: 'PENDING',
    };
  }

  public async acceptDuel(defenderId: string, duelId: string) {
    const res = await db.query<any>(`SELECT * FROM player_duels WHERE id = $1`, [duelId]);
    if (res.rows.length === 0) throw new Error('Duel challenge not found.');
    const d = res.rows[0];
    if (d.defender_id !== defenderId) {
      throw new Error('Forbidden: Only the challenged captain can accept this duel.');
    }
    if (d.status !== 'PENDING') {
      throw new Error(`Duel is ${d.status}, not PENDING.`);
    }

    const [cShip, dShip] = await Promise.all([
      db.query<any>(
        `SELECT a.credits, s.current_sector_id, s.armor FROM accounts a JOIN ships s ON s.account_id = a.id WHERE a.id = $1`,
        [d.challenger_id]
      ),
      db.query<any>(
        `SELECT a.credits, s.current_sector_id, s.armor FROM accounts a JOIN ships s ON s.account_id = a.id WHERE a.id = $1`,
        [d.defender_id]
      ),
    ]);

    if (
      Number(cShip.rows[0]?.current_sector_id) !== Number(dShip.rows[0]?.current_sector_id)
    ) {
      throw new Error('Both captains must remain in the same sector to accept the duel.');
    }
    const wager = Number(d.wager_credits || 0);
    if (Number(cShip.rows[0]?.credits || 0) < wager || Number(dShip.rows[0]?.credits || 0) < wager) {
      throw new Error('Insufficient Credits to cover duel wager.');
    }

    await db.query(
      `UPDATE player_duels
       SET status = 'ACTIVE', challenger_pre_hull = $1, defender_pre_hull = $2
       WHERE id = $3`,
      [Number(cShip.rows[0]?.armor || 100), Number(dShip.rows[0]?.armor || 100), duelId]
    );

    return {
      ...d,
      status: 'ACTIVE',
      sectorId: Number(dShip.rows[0]?.current_sector_id),
      wagerCredits: wager,
    };
  }

  public async declineDuel(defenderId: string, duelId: string) {
    const res = await db.query<any>(`SELECT * FROM player_duels WHERE id = $1`, [duelId]);
    if (res.rows.length === 0) throw new Error('Duel not found.');
    if (res.rows[0].defender_id !== defenderId && res.rows[0].challenger_id !== defenderId) {
      throw new Error('Forbidden');
    }
    await db.query(`UPDATE player_duels SET status = 'DECLINED', completed_at = NOW() WHERE id = $1`, [duelId]);
    return { id: duelId, status: 'DECLINED' };
  }

  public async forfeitDuel(actorId: string, duelId: string) {
    const res = await db.query<any>(`SELECT * FROM player_duels WHERE id = $1`, [duelId]);
    if (res.rows.length === 0) throw new Error('Duel not found.');
    const d = res.rows[0];
    if (d.challenger_id !== actorId && d.defender_id !== actorId) {
      throw new Error('Forbidden');
    }
    if (d.status !== 'ACTIVE') {
      await db.query(`UPDATE player_duels SET status = 'DECLINED', completed_at = NOW() WHERE id = $1`, [duelId]);
      return { id: duelId, status: 'DECLINED' };
    }
    const winnerId = d.challenger_id === actorId ? d.defender_id : d.challenger_id;
    return this.completeDuel(duelId, winnerId, actorId, 'FORFEITED');
  }

  public async completeDuel(
    duelId: string,
    winnerId: string,
    loserId: string,
    finalStatus: 'COMPLETED' | 'FORFEITED' = 'COMPLETED'
  ) {
    const res = await db.query<any>(`SELECT * FROM player_duels WHERE id = $1`, [duelId]);
    if (res.rows.length === 0) return null;
    const d = res.rows[0];
    if (d.status !== 'ACTIVE') return d;

    const wager = Number(d.wager_credits || 0);
    await db.query('BEGIN');
    try {
      if (wager > 0) {
        await db.query(`UPDATE accounts SET credits = GREATEST(0, credits - $1) WHERE id = $2`, [wager, loserId]);
        await db.query(`UPDATE accounts SET credits = credits + $1 WHERE id = $2`, [wager, winnerId]);
      }
      // Restore both ships' armor/shield to pre-duel integrity (or max if higher)
      await db.query(
        `UPDATE ships SET armor = GREATEST(armor, $1), shield = max_shield WHERE account_id = $2`,
        [Number(d.challenger_pre_hull || 100), d.challenger_id]
      );
      await db.query(
        `UPDATE ships SET armor = GREATEST(armor, $1), shield = max_shield WHERE account_id = $2`,
        [Number(d.defender_pre_hull || 100), d.defender_id]
      );
      await db.query(
        `UPDATE player_duels SET status = $1, winner_id = $2, loser_id = $3, completed_at = NOW() WHERE id = $4`,
        [finalStatus, winnerId, loserId, duelId]
      );
      await db.query('COMMIT');
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }

    return {
      id: duelId,
      sectorId: Number(d.sector_id),
      challengerId: d.challenger_id,
      defenderId: d.defender_id,
      winnerId,
      loserId,
      wagerCredits: wager,
      status: finalStatus,
    };
  }
}

export const duelService = new DuelService();

