import type { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/AuthService';

declare module 'fastify' {
  interface FastifyRequest {
    authAccountId?: string;
    authSessionId?: string;
  }
}

const PUBLIC_PATHS = new Set<string>([
  '/health',
  '/api/auth/factions',
  '/api/auth/register',
  '/api/auth/login',
]);

/**
 * Extracts Bearer token from Authorization header or ?token= WebSocket query param.
 */
export function extractBearerToken(req: FastifyRequest): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const query = (req.query || {}) as { token?: string };
  if (typeof query.token === 'string' && query.token.trim().length > 0) {
    return query.token.trim();
  }
  return null;
}

/**
 * Strict global authentication hook enforcing valid Bearer sessions on all
 * protected /api/* and /ws/* endpoints.
 */
export async function requireAuthHook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const rawUrl = req.url || '';
  const pathOnly = rawUrl.split('?')[0];

  if (req.method === 'OPTIONS' || PUBLIC_PATHS.has(pathOnly)) {
    return;
  }

  // Only enforce strict auth on API and WebSocket routes
  if (!pathOnly.startsWith('/api/') && !pathOnly.startsWith('/ws/')) {
    return;
  }

  const token = extractBearerToken(req);
  if (!token) {
    return reply.status(401).send({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Supply Authorization: Bearer <token>.',
    });
  }

  const verified = await authService.verifyBearerToken(token);
  if (!verified) {
    return reply.status(401).send({
      success: false,
      error: 'INVALID_SESSION',
      message: 'Session token is invalid or expired.',
    });
  }

  req.authAccountId = verified.accountId;
  req.authSessionId = verified.sessionId;
}

/**
 * Enforces that no route caller can spoof another account via accountId / playerId / creatorAccountId,
 * and binds the verified session accountId onto request params when omitted.
 */
export async function enforceAuthenticatedIdentity(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authedId = req.authAccountId;
  if (!authedId) return; // Public routes already skipped in onRequest

  const query = (req.query && typeof req.query === 'object' ? req.query : null) as Record<string, any> | null;
  const body = (req.body && typeof req.body === 'object' ? req.body : null) as Record<string, any> | null;

  for (const field of ['accountId', 'playerId', 'creatorAccountId']) {
    if (query && typeof query[field] === 'string' && query[field].length > 0 && query[field] !== authedId) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN_ACCOUNT_SPOOF',
        message: `Forbidden: Cannot act as account '${query[field]}'.`,
      });
    }
    if (body && typeof body[field] === 'string' && body[field].length > 0 && body[field] !== authedId) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN_ACCOUNT_SPOOF',
        message: `Forbidden: Cannot act as account '${body[field]}'.`,
      });
    }
  }

  if (query) {
    query.accountId = authedId;
    query.playerId = authedId;
  }
  if (body && !Array.isArray(body)) {
    body.accountId = authedId;
    body.playerId = authedId;
    if ('creatorAccountId' in body) body.creatorAccountId = authedId;
  }
}

/**
 * Resolves the acting account ID solely from the verified Bearer session and rejects
 * cross-account impersonation attempts unless intentionally targeting another player.
 */
export function getVerifiedAccountId(req: FastifyRequest, claimedAccountId?: string | null): string {
  const authedId = req.authAccountId;
  if (!authedId) {
    throw new Error('UNAUTHORIZED: Verified session missing.');
  }
  if (claimedAccountId && claimedAccountId !== authedId) {
    const err: any = new Error(`Forbidden: Cannot impersonate account '${claimedAccountId}'.`);
    err.statusCode = 403;
    throw err;
  }
  return authedId;
}
