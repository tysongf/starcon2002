import type { FastifyPluginAsync } from 'fastify';
import { squadronService } from '../services/SquadronService';
import { allianceService } from '../services/AllianceService';
import { p2pTradeService, type TradeOfferPayload } from '../services/P2PTradeService';
import { duelService } from '../services/DuelService';
import { socialHubService } from '../services/SocialHubService';
import { combatManager } from '../services/SectorCombatManager';

async function syncAlliesAndSquadFor(accountIds: string[]) {
  for (const id of accountIds) {
    const [sqId, allies] = await Promise.all([
      squadronService.getAccountSquadronId(id),
      allianceService.getFriendlyFireShieldedAllyIds(id),
    ]);
    combatManager.syncPlayerSocialContext(id, {
      squadronId: sqId,
      friendlyFireAllyIds: Array.from(allies),
    });
  }
}

export const multiplayerRoutes: FastifyPluginAsync = async (server) => {
  // =========================================================================
  // 1. Co-op Squadrons (Parties up to 12)
  // =========================================================================
  server.get('/api/squadrons/mine', async (req, reply) => {
    const accountId = req.authAccountId!;
    const [squadron, pendingInvites] = await Promise.all([
      squadronService.getMySquadron(accountId),
      squadronService.getPendingInvites(accountId),
    ]);
    reply.send({ success: true, squadron, pendingInvites });
  });

  server.post('/api/squadrons/create', async (req, reply) => {
    const accountId = req.authAccountId!;
    const body = (req.body || {}) as { name?: string };
    try {
      const squadron = await squadronService.createSquadron(accountId, body.name);
      await syncAlliesAndSquadFor([accountId]);
      reply.send({ success: true, squadron });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/squadrons/invite', async (req, reply) => {
    const accountId = req.authAccountId!;
    const body = (req.body || {}) as { targetAccountId: string };
    try {
      const res = await squadronService.inviteToSquadron(accountId, body.targetAccountId);
      socialHubService.pushToAccount(body.targetAccountId, 'SQUAD_INVITE', {
        inviteId: res.inviteId,
        squadronId: res.squadronId,
        inviterAccountId: accountId,
      });
      reply.send({ success: true, ...res });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/squadrons/accept', async (req, reply) => {
    const accountId = req.authAccountId!;
    const body = (req.body || {}) as { inviteId: string };
    try {
      const squadron = await squadronService.acceptInvite(accountId, body.inviteId);
      const memberIds = squadron?.members.map((m: any) => m.accountId) || [accountId];
      await syncAlliesAndSquadFor(memberIds);
      for (const mid of memberIds) {
        socialHubService.pushToAccount(mid, 'SQUAD_UPDATED', { squadron });
      }
      reply.send({ success: true, squadron });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/squadrons/leave', async (req, reply) => {
    const accountId = req.authAccountId!;
    try {
      const res = await squadronService.leaveSquadron(accountId);
      await syncAlliesAndSquadFor([accountId]);
      reply.send({ success: true, ...res });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/squadrons/kick', async (req, reply) => {
    const accountId = req.authAccountId!;
    const body = (req.body || {}) as { targetAccountId: string };
    try {
      const squadron = await squadronService.kickMember(accountId, body.targetAccountId);
      await syncAlliesAndSquadFor([accountId, body.targetAccountId]);
      reply.send({ success: true, squadron });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // =========================================================================
  // 2. Strictly Peer-to-Peer Alliances (Per-Ally & Per-Colony Granular Grants)
  // =========================================================================
  server.get('/api/alliances/mine', async (req, reply) => {
    const accountId = req.authAccountId!;
    const data = await allianceService.getMyAlliances(accountId);
    reply.send({ success: true, ...data });
  });

  server.post('/api/alliances/propose', async (req, reply) => {
    const accountId = req.authAccountId!;
    const body = (req.body || {}) as { targetAccountId: string };
    try {
      const res = await allianceService.proposePact(accountId, body.targetAccountId);
      socialHubService.pushToAccount(body.targetAccountId, 'ALLY_PACT_PROPOSAL', {
        pactId: res.pactId,
        fromAccountId: accountId,
      });
      reply.send({ success: true, ...res });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/alliances/:pactId/accept', async (req, reply) => {
    const accountId = req.authAccountId!;
    const { pactId } = req.params as { pactId: string };
    try {
      const data = await allianceService.acceptPact(accountId, pactId);
      const pact = data.pacts.find((p: any) => p.pactId === pactId);
      if (pact) {
        await syncAlliesAndSquadFor([accountId, pact.peerAccountId]);
        socialHubService.pushToAccount(pact.peerAccountId, 'ALLY_PACT_ACCEPTED', { pactId, peerId: accountId });
      }
      reply.send({ success: true, ...data });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/alliances/:pactId/end', async (req, reply) => {
    const accountId = req.authAccountId!;
    const { pactId } = req.params as { pactId: string };
    try {
      const before = await allianceService.getMyAlliances(accountId);
      const targetPact = before.pacts.find((p: any) => p.pactId === pactId);
      const res = await allianceService.endPact(accountId, pactId);
      if (targetPact) {
        await syncAlliesAndSquadFor([accountId, targetPact.peerAccountId]);
        socialHubService.pushToAccount(targetPact.peerAccountId, 'ALLY_PACT_ENDED', { pactId });
      }
      reply.send({ success: true, ...res });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/alliances/:pactId/peer-grants', async (req, reply) => {
    const accountId = req.authAccountId!;
    const { pactId } = req.params as { pactId: string };
    const body = (req.body || {}) as {
      friendlyFireShield?: boolean;
      canShareIntel?: boolean;
      canViewAllColonies?: boolean;
    };
    try {
      const data = await allianceService.updatePeerGrants(accountId, pactId, body);
      const pact = data.pacts.find((p: any) => p.pactId === pactId);
      if (pact) {
        await syncAlliesAndSquadFor([accountId, pact.peerAccountId]);
        socialHubService.pushToAccount(pact.peerAccountId, 'ALLY_GRANTS_UPDATED', { pactId });
      }
      reply.send({ success: true, ...data });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/alliances/colony-grants', async (req, reply) => {
    const accountId = req.authAccountId!;
    const body = (req.body || {}) as {
      colonyId: string;
      granteeAccountId: string;
      canInspectGrid?: boolean;
      canHarvestSilo?: boolean;
      canBuildOutpost?: boolean;
    };
    try {
      const grant = await allianceService.updateColonyGrants(accountId, body.colonyId, body.granteeAccountId, {
        canInspectGrid: body.canInspectGrid,
        canHarvestSilo: body.canHarvestSilo,
        canBuildOutpost: body.canBuildOutpost,
      });
      socialHubService.pushToAccount(body.granteeAccountId, 'COLONY_GRANT_UPDATED', grant);
      reply.send({ success: true, grant });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // =========================================================================
  // 3. Atomic P2P Escrow Trades (Credits, Cargo, Procedural Gear, Crew)
  // =========================================================================
  server.post('/api/p2p-trade/initiate', async (req, reply) => {
    const accountId = req.authAccountId!;
    const body = (req.body || {}) as { partnerId: string };
    try {
      const trade = await p2pTradeService.initiateTrade(accountId, body.partnerId);
      socialHubService.pushToAccount(body.partnerId, 'TRADE_INVITE', { trade });
      reply.send({ success: true, trade });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.get('/api/p2p-trade/:tradeId', async (req, reply) => {
    const accountId = req.authAccountId!;
    const { tradeId } = req.params as { tradeId: string };
    try {
      const trade = await p2pTradeService.getTradeDetail(accountId, tradeId);
      reply.send({ success: true, trade });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/p2p-trade/:tradeId/offer', async (req, reply) => {
    const accountId = req.authAccountId!;
    const { tradeId } = req.params as { tradeId: string };
    const body = (req.body || {}) as Partial<TradeOfferPayload>;
    try {
      const trade = await p2pTradeService.updateOffer(accountId, tradeId, body);
      const other = trade.initiatorId === accountId ? trade.partnerId : trade.initiatorId;
      socialHubService.pushToAccount(other, 'TRADE_UPDATED', { trade });
      reply.send({ success: true, trade });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/p2p-trade/:tradeId/lock', async (req, reply) => {
    const accountId = req.authAccountId!;
    const { tradeId } = req.params as { tradeId: string };
    try {
      const trade = await p2pTradeService.lockOffer(accountId, tradeId);
      const other = trade.initiatorId === accountId ? trade.partnerId : trade.initiatorId;
      socialHubService.pushToAccount(other, 'TRADE_UPDATED', { trade });
      reply.send({ success: true, trade });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/p2p-trade/:tradeId/confirm', async (req, reply) => {
    const accountId = req.authAccountId!;
    const { tradeId } = req.params as { tradeId: string };
    try {
      const res = await p2pTradeService.confirmTrade(accountId, tradeId);
      const other = res.trade.initiatorId === accountId ? res.trade.partnerId : res.trade.initiatorId;
      socialHubService.pushToAccount(other, res.executed ? 'TRADE_COMPLETED' : 'TRADE_UPDATED', {
        trade: res.trade,
      });
      reply.send({ success: true, ...res });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/p2p-trade/:tradeId/cancel', async (req, reply) => {
    const accountId = req.authAccountId!;
    const { tradeId } = req.params as { tradeId: string };
    try {
      const trade = await p2pTradeService.cancelTrade(accountId, tradeId);
      const other = trade.initiatorId === accountId ? trade.partnerId : trade.initiatorId;
      socialHubService.pushToAccount(other, 'TRADE_CANCELLED', { trade });
      reply.send({ success: true, trade });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // =========================================================================
  // 4. Consensual Duels (Anywhere, stops at <= 15% hull)
  // =========================================================================
  server.post('/api/duels/challenge', async (req, reply) => {
    const accountId = req.authAccountId!;
    const body = (req.body || {}) as { defenderId: string; wagerCredits?: number };
    try {
      const duel = await duelService.challengeDuel(accountId, body.defenderId, body.wagerCredits || 0);
      socialHubService.pushToAccount(body.defenderId, 'DUEL_CHALLENGE', { duel });
      reply.send({ success: true, duel });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/duels/:duelId/accept', async (req, reply) => {
    const accountId = req.authAccountId!;
    const { duelId } = req.params as { duelId: string };
    try {
      const duel = await duelService.acceptDuel(accountId, duelId);
      combatManager.syncPlayerSocialContext(duel.challenger_id, { activeDuelId: duel.id });
      combatManager.syncPlayerSocialContext(duel.defender_id, { activeDuelId: duel.id });
      socialHubService.pushToAccount(duel.challenger_id, 'DUEL_STARTED', { duel });
      socialHubService.pushToAccount(duel.defender_id, 'DUEL_STARTED', { duel });
      reply.send({ success: true, duel });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/duels/:duelId/decline', async (req, reply) => {
    const accountId = req.authAccountId!;
    const { duelId } = req.params as { duelId: string };
    try {
      const res = await duelService.declineDuel(accountId, duelId);
      reply.send({ success: true, ...res });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  server.post('/api/duels/:duelId/forfeit', async (req, reply) => {
    const accountId = req.authAccountId!;
    const { duelId } = req.params as { duelId: string };
    try {
      const res = await duelService.forfeitDuel(accountId, duelId);
      if (res?.challengerId && res?.defenderId) {
        combatManager.syncPlayerSocialContext(res.challengerId, { activeDuelId: null });
        combatManager.syncPlayerSocialContext(res.defenderId, { activeDuelId: null });
        socialHubService.pushToAccount(res.challengerId, 'DUEL_COMPLETED', res);
        socialHubService.pushToAccount(res.defenderId, 'DUEL_COMPLETED', res);
      }
      reply.send({ success: true, duel: res });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });
};

