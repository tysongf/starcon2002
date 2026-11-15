import type { FastifyPluginAsync } from 'fastify';
import { authService, FACTION_HOME_SECTORS } from '../services/AuthService';
import { ALL_FACTION_IDS, FACTION_REGISTRY } from '../../../shared/FactionRegistry';

export const authRoutes: FastifyPluginAsync = async (server) => {
  // Public Faction Starter Options
  server.get('/api/auth/factions', async (_req, reply) => {
    // Notice: if strict global auth blocks /api/auth/factions unless added or open, wait: let's add /api/auth/factions or return via register UI from FACTION_REGISTRY directly too!
    reply.send({
      factions: ALL_FACTION_IDS.map((fid) => ({
        id: fid,
        name: FACTION_REGISTRY[fid].name,
        shortName: FACTION_REGISTRY[fid].shortName,
        homeSectorId: FACTION_HOME_SECTORS[fid],
      })),
    });
  });

  // Register New Captain
  server.post('/api/auth/register', async (req, reply) => {
    const body = (req.body || {}) as {
      username: string;
      password: string;
      callsign: string;
      factionId?: string;
    };
    try {
      const result = await authService.register(body);
      reply.send({ success: true, ...result });
    } catch (err: any) {
      reply.status(400).send({ success: false, error: err.message });
    }
  });

  // Login Existing Captain
  server.post('/api/auth/login', async (req, reply) => {
    const body = (req.body || {}) as { username: string; password: string };
    try {
      const result = await authService.login(body.username, body.password);
      reply.send({ success: true, ...result });
    } catch (err: any) {
      reply.status(401).send({ success: false, error: err.message });
    }
  });

  // Current Authenticated Session Info
  server.get('/api/auth/me', async (req, reply) => {
    if (!req.authAccountId) {
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
    }
    try {
      const profile = await authService.getCaptainProfile(req.authAccountId);
      reply.send({ success: true, ...profile });
    } catch (err: any) {
      reply.status(404).send({ success: false, error: err.message });
    }
  });

  // Logout (revoke active session)
  server.post('/api/auth/logout', async (req, reply) => {
    if (req.authSessionId && req.authAccountId) {
      await authService.logout(req.authSessionId, req.authAccountId);
    }
    reply.send({ success: true });
  });
};

