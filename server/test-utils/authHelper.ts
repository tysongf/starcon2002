import WsWebSocket from 'ws';

export const BASE_URL = 'http://localhost:3000';
export const WS_BASE_URL = 'ws://localhost:3000';

export const rawFetch: typeof globalThis.fetch = globalThis.fetch.bind(globalThis);

let cachedDefaultToken: string | null = process.env.TEST_DEFAULT_TOKEN || null;

export async function loginCaptain(
  username: string = 'cmdr_vance',
  password: string = 'solaris2002',
): Promise<{ token: string; account: any; ship: any }> {
  const res = await rawFetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.success || !data.token) {
    throw new Error(`loginCaptain failed for ${username}: ${JSON.stringify(data)}`);
  }
  return data;
}

export async function registerTestCaptain(opts: {
  username: string;
  password: string;
  callsign: string;
  factionId: string;
}): Promise<{ token: string; account: any; ship: any }> {
  const res = await rawFetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const data = await res.json();
  if (!res.ok || !data.success || !data.token) {
    throw new Error(`registerTestCaptain failed for ${opts.username}: ${JSON.stringify(data)}`);
  }
  return data;
}

export function authWsUrl(url: string, token?: string): string {
  const tok = token || cachedDefaultToken;
  if (!tok) return url;
  if (url.includes('token=')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(tok)}`;
}

let fetchPatched = false;

export async function installGlobalTestAuth(): Promise<string> {
  if (!cachedDefaultToken) {
    const auth = await loginCaptain('cmdr_vance', 'solaris2002');
    cachedDefaultToken = auth.token;
  }

  if (!fetchPatched) {
    fetchPatched = true;
    globalThis.fetch = async (input: any, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined));
      if (headers.get('x-skip-default-auth') === '1') {
        headers.delete('x-skip-default-auth');
        return rawFetch(input, { ...init, headers });
      }
      if (!headers.has('authorization') && cachedDefaultToken) {
        headers.set('Authorization', `Bearer ${cachedDefaultToken}`);
      }
      return rawFetch(input, { ...init, headers });
    };
  }

  return cachedDefaultToken;
}

export function getDefaultAuthToken(): string | null {
  return cachedDefaultToken;
}

export class AuthedWebSocket extends WsWebSocket {
  constructor(address: string | URL, protocols?: any, options?: any) {
    const urlStr = typeof address === 'string' ? address : address.toString();
    super(authWsUrl(urlStr), protocols, options);
  }
}

// Auto-install default Captain Bearer auth when imported by regression suites
if (process.env.SKIP_AUTO_TEST_AUTH !== '1') {
  await installGlobalTestAuth();
}

