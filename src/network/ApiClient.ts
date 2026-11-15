/**
 * Milestone 1.8: Authenticated API & WebSocket Client
 * Manages per-tab Bearer session tokens (sessionStorage), automatic Authorization header
 * injection across all /api/* requests, and WebSocket token URL construction.
 */

const TOKEN_KEY = 'starcon_bearer_token';
const ACCOUNT_KEY = 'starcon_account_id';
const CALLSIGN_KEY = 'starcon_callsign';

class ApiClient {
  private interceptorInstalled = false;

  public getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  public getAccountId(): string {
    return sessionStorage.getItem(ACCOUNT_KEY) || '';
  }

  public getCallsign(): string {
    return sessionStorage.getItem(CALLSIGN_KEY) || 'Captain';
  }

  public setSession(token: string, account: { id: string; callsign: string }): void {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(ACCOUNT_KEY, account.id);
    sessionStorage.setItem(CALLSIGN_KEY, account.callsign);
  }

  public clearSession(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(ACCOUNT_KEY);
    sessionStorage.removeItem(CALLSIGN_KEY);
  }

  public wsUrl(pathAndQuery: string): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const sep = pathAndQuery.includes('?') ? '&' : '?';
    const tok = encodeURIComponent(this.getToken() || '');
    return `${proto}//${host}${pathAndQuery}${sep}token=${tok}`;
  }

  /**
   * Installs a global window.fetch wrapper so all controllers automatically authenticate
   * with the current tab's Bearer session and route relative to current host.
   */
  public installGlobalFetchInterceptor(): void {
    if (this.interceptorInstalled) return;
    this.interceptorInstalled = true;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      // Normalize any hardcoded localhost:3000 origins to same-origin paths for LAN/multiplayer compatibility
      if (url.startsWith('http://localhost:3000/')) {
        url = url.slice('http://localhost:3000'.length);
      }

      const activeId = this.getAccountId();
      if (activeId && url.includes('acc_sol_captain')) {
        url = url.replace(/acc_sol_captain/g, encodeURIComponent(activeId));
      }

      const isPublic =
        url.startsWith('/health') ||
        url.startsWith('/api/auth/login') ||
        url.startsWith('/api/auth/register') ||
        url.startsWith('/api/auth/factions');

      const nextInit: RequestInit = { ...(init || {}) };
      const headers = new Headers(nextInit.headers || (input instanceof Request ? input.headers : undefined));

      const token = this.getToken();
      if (!isPublic && token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      if (activeId && typeof nextInit.body === 'string' && nextInit.body.includes('acc_sol_captain')) {
        nextInit.body = nextInit.body.replace(/"acc_sol_captain"/g, JSON.stringify(activeId));
      }

      nextInit.headers = headers;
      return nativeFetch(url, nextInit);
    };
  }
}

export const apiClient = new ApiClient();
