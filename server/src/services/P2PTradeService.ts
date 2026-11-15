import crypto from 'node:crypto';
import { db } from '../db/Database';

export interface TradeOfferPayload {
  credits: number;
  cargo: Array<{ commodityId: string; quantity: number }>;
  inventoryIds: string[];
  crewIds: string[];
}

function normalizeOffer(raw: any): TradeOfferPayload {
  const credits = Math.max(0, Math.floor(Number(raw?.credits || 0)));
  const cargoMap = new Map<string, number>();
  if (Array.isArray(raw?.cargo)) {
    for (const c of raw.cargo) {
      if (c && typeof c.commodityId === 'string') {
        const qty = Math.max(0, Math.floor(Number(c.quantity || 0)));
        if (qty > 0) cargoMap.set(c.commodityId, (cargoMap.get(c.commodityId) || 0) + qty);
      }
    }
  }
  const inventoryIds = Array.isArray(raw?.inventoryIds)
    ? Array.from(new Set(raw.inventoryIds.filter((id: any) => typeof id === 'string' && id.length > 0)))
    : [];
  const crewIds = Array.isArray(raw?.crewIds)
    ? Array.from(new Set(raw.crewIds.filter((id: any) => typeof id === 'string' && id.length > 0)))
    : [];

  return {
    credits,
    cargo: Array.from(cargoMap.entries()).map(([commodityId, quantity]) => ({ commodityId, quantity })),
    inventoryIds: inventoryIds as string[],
    crewIds: crewIds as string[],
  };
}

export class P2PTradeService {
  public async initiateTrade(initiatorId: string, partnerId: string) {
    if (initiatorId === partnerId) {
      throw new Error('Cannot initiate a P2P trade with yourself.');
    }

    const partRes = await db.query<{ id: string; callsign: string }>(
      `SELECT id, callsign FROM accounts WHERE id = $1`,
      [partnerId]
    );
    if (partRes.rows.length === 0) {
      throw new Error('Trade partner account not found.');
    }

    const tradeId = `trd_${crypto.randomBytes(6).toString('hex')}`;
    const emptyOffer: TradeOfferPayload = { credits: 0, cargo: [], inventoryIds: [], crewIds: [] };
    await db.query(
      `INSERT INTO player_trades (id, initiator_id, partner_id, status, initiator_offer, partner_offer)
       VALUES ($1, $2, $3, 'ACTIVE', $4::jsonb, $4::jsonb)`,
      [tradeId, initiatorId, partnerId, JSON.stringify(emptyOffer)]
    );

    return this.getTradeDetail(initiatorId, tradeId);
  }

  public async getTradeDetail(actorId: string, tradeId: string) {
    const res = await db.query<any>(
      `SELECT t.*, a1.callsign AS initiator_callsign, a2.callsign AS partner_callsign
       FROM player_trades t
       JOIN accounts a1 ON a1.id = t.initiator_id
       JOIN accounts a2 ON a2.id = t.partner_id
       WHERE t.id = $1`,
      [tradeId]
    );
    if (res.rows.length === 0) throw new Error('Trade session not found.');
    const t = res.rows[0];
    if (t.initiator_id !== actorId && t.partner_id !== actorId) {
      throw new Error('Forbidden: Not a participant in this trade.');
    }

    return {
      id: t.id,
      status: t.status,
      initiatorId: t.initiator_id,
      initiatorCallsign: t.initiator_callsign,
      partnerId: t.partner_id,
      partnerCallsign: t.partner_callsign,
      initiatorOffer: normalizeOffer(t.initiator_offer),
      partnerOffer: normalizeOffer(t.partner_offer),
      initiatorLocked: Boolean(t.initiator_locked),
      partnerLocked: Boolean(t.partner_locked),
      initiatorConfirmed: Boolean(t.initiator_confirmed),
      partnerConfirmed: Boolean(t.partner_confirmed),
      updatedAt: t.updated_at,
    };
  }

  private async validateOwnership(accountId: string, offer: TradeOfferPayload) {
    const accRes = await db.query<{ credits: string }>(`SELECT credits FROM accounts WHERE id = $1`, [accountId]);
    if (accRes.rows.length === 0) throw new Error('Account not found.');
    if (Number(accRes.rows[0].credits) < offer.credits) {
      throw new Error('Insufficient Credits for trade offer.');
    }

    const shipRes = await db.query<{ id: string }>(`SELECT id FROM ships WHERE account_id = $1 LIMIT 1`, [
      accountId,
    ]);
    const shipId = shipRes.rows[0]?.id;

    if (offer.cargo.length > 0) {
      if (!shipId) throw new Error('Active ship required to trade cargo.');
      for (const c of offer.cargo) {
        const cRes = await db.query<{ quantity: number }>(
          `SELECT quantity FROM ship_cargo WHERE ship_id = $1 AND commodity_id = $2`,
          [shipId, c.commodityId]
        );
        const held = Number(cRes.rows[0]?.quantity || 0);
        if (held < c.quantity) {
          throw new Error(`Insufficient cargo '${c.commodityId}' (held ${held}, offered ${c.quantity}).`);
        }
      }
    }

    if (offer.inventoryIds.length > 0) {
      for (const invId of offer.inventoryIds) {
        const iRes = await db.query<{ id: string; is_fitted: boolean }>(
          `SELECT id, is_fitted FROM player_inventory WHERE id = $1 AND account_id = $2`,
          [invId, accountId]
        );
        if (iRes.rows.length === 0) {
          throw new Error(`Module '${invId}' not owned by you.`);
        }
        if (iRes.rows[0].is_fitted) {
          throw new Error('Unequip modules before placing them in P2P trade escrow.');
        }
      }
    }

    if (offer.crewIds.length > 0) {
      for (const cid of offer.crewIds) {
        const crRes = await db.query<{ id: string; assignment_type: string }>(
          `SELECT id, assignment_type FROM crew_roster WHERE id = $1 AND account_id = $2`,
          [cid, accountId]
        );
        if (crRes.rows.length === 0) {
          throw new Error(`Crew contract '${cid}' not found on your roster.`);
        }
        if (crRes.rows[0].assignment_type !== 'RESERVE') {
          throw new Error('Unassign crew member to Reserve before transferring their contract.');
        }
      }
    }
  }

  public async updateOffer(actorId: string, tradeId: string, rawOffer: Partial<TradeOfferPayload>) {
    const trade = await this.getTradeDetail(actorId, tradeId);
    if (trade.status !== 'ACTIVE') {
      throw new Error(`Trade is ${trade.status} and cannot be modified.`);
    }

    const offer = normalizeOffer(rawOffer);
    await this.validateOwnership(actorId, offer);

    const isInit = trade.initiatorId === actorId;
    const col = isInit ? 'initiator_offer' : 'partner_offer';

    // Any offer edit resets both lock and confirm flags (anti-scam escrow guarantee)
    await db.query(
      `UPDATE player_trades
       SET ${col} = $1::jsonb,
           initiator_locked = FALSE,
           partner_locked = FALSE,
           initiator_confirmed = FALSE,
           partner_confirmed = FALSE,
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(offer), tradeId]
    );

    return this.getTradeDetail(actorId, tradeId);
  }

  public async lockOffer(actorId: string, tradeId: string) {
    const trade = await this.getTradeDetail(actorId, tradeId);
    if (trade.status !== 'ACTIVE') {
      throw new Error(`Trade is ${trade.status}.`);
    }
    const isInit = trade.initiatorId === actorId;
    const myOffer = isInit ? trade.initiatorOffer : trade.partnerOffer;
    await this.validateOwnership(actorId, myOffer);

    const col = isInit ? 'initiator_locked' : 'partner_locked';
    await db.query(`UPDATE player_trades SET ${col} = TRUE, updated_at = NOW() WHERE id = $1`, [tradeId]);
    return this.getTradeDetail(actorId, tradeId);
  }

  public async confirmTrade(actorId: string, tradeId: string) {
    const trade = await this.getTradeDetail(actorId, tradeId);
    if (trade.status !== 'ACTIVE') {
      throw new Error(`Trade is ${trade.status}.`);
    }
    if (!trade.initiatorLocked || !trade.partnerLocked) {
      throw new Error('Both captains must LOCK their offers before confirming.');
    }

    const isInit = trade.initiatorId === actorId;
    const col = isInit ? 'initiator_confirmed' : 'partner_confirmed';
    await db.query(`UPDATE player_trades SET ${col} = TRUE, updated_at = NOW() WHERE id = $1`, [tradeId]);

    const updated = await this.getTradeDetail(actorId, tradeId);
    if (!updated.initiatorConfirmed || !updated.partnerConfirmed) {
      return { executed: false, trade: updated };
    }

    // Both confirmed: execute atomic escrow swap inside DB transaction
    await db.query('BEGIN');
    try {
      await this.validateOwnership(updated.initiatorId, updated.initiatorOffer);
      await this.validateOwnership(updated.partnerId, updated.partnerOffer);

      await this.transferSide(updated.initiatorId, updated.partnerId, updated.initiatorOffer);
      await this.transferSide(updated.partnerId, updated.initiatorId, updated.partnerOffer);

      await db.query(
        `UPDATE player_trades SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
        [tradeId]
      );
      await db.query('COMMIT');
    } catch (err) {
      await db.query('ROLLBACK');
      // Unlock on failure so parties can adjust offers
      await db.query(
        `UPDATE player_trades
         SET initiator_locked = FALSE, partner_locked = FALSE, initiator_confirmed = FALSE, partner_confirmed = FALSE
         WHERE id = $1`,
        [tradeId]
      );
      throw err;
    }

    return {
      executed: true,
      trade: await this.getTradeDetail(actorId, tradeId),
    };
  }

  private async transferSide(fromId: string, toId: string, offer: TradeOfferPayload) {
    if (offer.credits > 0) {
      await db.query(`UPDATE accounts SET credits = credits - $1 WHERE id = $2`, [offer.credits, fromId]);
      await db.query(`UPDATE accounts SET credits = credits + $1 WHERE id = $2`, [offer.credits, toId]);
    }

    if (offer.cargo.length > 0) {
      const fromShipRes = await db.query<{ id: string }>(`SELECT id FROM ships WHERE account_id = $1 LIMIT 1`, [
        fromId,
      ]);
      const toShipRes = await db.query<{ id: string; cargo_capacity: number }>(
        `SELECT id, cargo_capacity FROM ships WHERE account_id = $1 LIMIT 1`,
        [toId]
      );
      const fromShipId = fromShipRes.rows[0]?.id;
      const toShip = toShipRes.rows[0];
      if (!fromShipId || !toShip) throw new Error('Both traders must have active ships to swap cargo.');

      const usedRes = await db.query<{ total: string }>(
        `SELECT COALESCE(SUM(quantity), 0)::text AS total FROM ship_cargo WHERE ship_id = $1`,
        [toShip.id]
      );
      const incomingUnits = offer.cargo.reduce((s, c) => s + c.quantity, 0);
      if (Number(usedRes.rows[0]?.total || 0) + incomingUnits > Number(toShip.cargo_capacity)) {
        throw new Error('Recipient ship hold lacks capacity for incoming traded cargo.');
      }

      for (const c of offer.cargo) {
        await db.query(
          `UPDATE ship_cargo SET quantity = quantity - $1 WHERE ship_id = $2 AND commodity_id = $3`,
          [c.quantity, fromShipId, c.commodityId]
        );
        await db.query(`DELETE FROM ship_cargo WHERE ship_id = $1 AND quantity <= 0`, [fromShipId]);
        await db.query(
          `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (ship_id, commodity_id) DO UPDATE SET quantity = ship_cargo.quantity + EXCLUDED.quantity`,
          [toShip.id, c.commodityId, c.quantity]
        );
      }
    }

    if (offer.inventoryIds.length > 0) {
      for (const invId of offer.inventoryIds) {
        await db.query(
          `UPDATE player_inventory SET account_id = $1, is_fitted = FALSE, fit_slot = NULL WHERE id = $2 AND account_id = $3`,
          [toId, invId, fromId]
        );
      }
    }

    if (offer.crewIds.length > 0) {
      for (const cid of offer.crewIds) {
        await db.query(
          `UPDATE crew_roster
           SET account_id = $1, assignment_type = 'RESERVE', assigned_bay_slot = NULL, assigned_colony_id = NULL, assigned_module_key = NULL, updated_at = NOW()
           WHERE id = $2 AND account_id = $3`,
          [toId, cid, fromId]
        );
      }
    }
  }

  public async cancelTrade(actorId: string, tradeId: string) {
    const trade = await this.getTradeDetail(actorId, tradeId);
    if (trade.status === 'COMPLETED') {
      throw new Error('Completed trade cannot be cancelled.');
    }
    await db.query(`UPDATE player_trades SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [tradeId]);
    return this.getTradeDetail(actorId, tradeId);
  }
}

export const p2pTradeService = new P2PTradeService();

