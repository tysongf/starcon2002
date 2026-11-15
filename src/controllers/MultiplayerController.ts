/**
 * Milestone 1.8: MultiplayerController.ts
 * Manages Strict Bearer Authentication Gate, /ws/social real-time Comms & Roster,
 * Co-op Squadrons (up to 12 pilots), Peer-to-Peer Alliances with Granular Per-Ally
 * and Per-Colony Grants, Atomic P2P Escrow Trades, and Consensual Duels.
 */

import { apiClient } from '../network/ApiClient.ts';

export interface MultiplayerCallbacks {
  audio: {
    playUiBlip: () => void;
    playShipHailBeep?: () => void;
  };
  showApNotification: (msg: string, isError?: boolean) => void;
  onAuthenticated: (profile: { account: any; ship: any }) => Promise<void> | void;
  onLoggedOut: () => void;
  onRemoteHyperspacePos: (pos: {
    accountId: string;
    callsign: string;
    factionId: string;
    hullClass: string;
    isInHyperspace: boolean;
    hyperspaceX: number;
    hyperspaceY: number;
  }) => void;
  onRefreshShipState: () => Promise<void> | void;
}

export class MultiplayerController {
  private callbacks: MultiplayerCallbacks;
  private socialSocket: WebSocket | null = null;
  private activeChannel: 'GALAXY' | 'SECTOR' | 'SQUAD' | 'ALLIES' | 'WHISPER' = 'GALAXY';
  private whisperTargetId: string | null = null;
  private chatMessages: any[] = [];
  private onlineCaptains: any[] = [];
  private currentModalTab: 'HAIL' | 'SQUADRON' | 'ALLIES' | 'TRADE' | 'RAIDS' = 'HAIL';
  private hailedDossier: any | null = null;
  private activeTrade: any | null = null;
  private activeDuel: any | null = null;
  private authResolve: ((profile: { account: any; ship: any }) => void) | null = null;

  constructor(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
    this.bindDOM();
  }

  public isAuthModalOpen(): boolean {
    const m = document.getElementById('captain-auth-modal');
    return !!m && !m.classList.contains('hidden');
  }

  public isSocialModalOpen(): boolean {
    const m = document.getElementById('multiplayer-social-modal');
    return !!m && !m.classList.contains('hidden');
  }

  private bindDOM(): void {
    // Auth Gate Tabs & Forms
    document.getElementById('tab-auth-login')?.addEventListener('click', () => this.switchAuthTab('LOGIN'));
    document.getElementById('tab-auth-register')?.addEventListener('click', () => this.switchAuthTab('REGISTER'));

    document.getElementById('btn-auth-submit-login')?.addEventListener('click', () => void this.submitLogin());
    document.getElementById('btn-auth-submit-register')?.addEventListener('click', () => void this.submitRegister());
    document.getElementById('btn-auth-fill-default')?.addEventListener('click', () => {
      const u = document.getElementById('auth-login-user') as HTMLInputElement | null;
      const p = document.getElementById('auth-login-pass') as HTMLInputElement | null;
      if (u) u.value = 'cmdr_vance';
      if (p) p.value = 'solaris2002';
    });

    document.getElementById('btn-captain-logout')?.addEventListener('click', () => void this.logout());

    // Comms Dock Controls
    document.getElementById('btn-comms-toggle-collapse')?.addEventListener('click', () => {
      const dock = document.getElementById('multiplayer-comms-dock');
      dock?.classList.toggle('collapsed');
    });

    document.querySelectorAll('.comms-chan-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ch = (btn as HTMLElement).getAttribute('data-channel') as any;
        if (ch) {
          this.activeChannel = ch;
          document.querySelectorAll('.comms-chan-btn').forEach((b) => b.classList.toggle('active', b === btn));
          void this.loadChatHistory();
        }
      });
    });

    document.getElementById('btn-comms-send')?.addEventListener('click', () => void this.sendChatFromInput());
    document.getElementById('input-comms-chat')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void this.sendChatFromInput();
      }
    });

    document.getElementById('btn-open-multiplayer-hub')?.addEventListener('click', () => {
      this.openSocialModal('SQUADRON');
    });

    document.getElementById('btn-close-social-modal')?.addEventListener('click', () => {
      this.closeSocialModal();
    });

    document.querySelectorAll('.mp-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = (btn as HTMLElement).getAttribute('data-tab') as any;
        if (t) this.switchSocialTab(t);
      });
    });
  }

  private switchAuthTab(tab: 'LOGIN' | 'REGISTER'): void {
    document.getElementById('tab-auth-login')?.classList.toggle('active', tab === 'LOGIN');
    document.getElementById('tab-auth-register')?.classList.toggle('active', tab === 'REGISTER');
    document.getElementById('auth-login-pane')?.classList.toggle('hidden', tab !== 'LOGIN');
    document.getElementById('auth-register-pane')?.classList.toggle('hidden', tab !== 'REGISTER');
  }

  public async ensureAuthenticated(): Promise<{ account: any; ship: any }> {
    const token = apiClient.getToken();
    if (token) {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.account) {
            apiClient.setSession(token, data.account);
            this.hideAuthGate();
            this.updateTopCaptainBadge(data.account);
            return { account: data.account, ship: data.ship };
          }
        }
      } catch {
        // Fall through to Auth Gate
      }
      apiClient.clearSession();
    }

    this.showAuthGate();
    return new Promise((resolve) => {
      this.authResolve = resolve;
    });
  }

  private showAuthGate(): void {
    const modal = document.getElementById('captain-auth-modal');
    modal?.classList.remove('hidden');
    void this.populateFactionSelect();
  }

  private hideAuthGate(): void {
    document.getElementById('captain-auth-modal')?.classList.add('hidden');
  }

  private async populateFactionSelect(): Promise<void> {
    const sel = document.getElementById('auth-reg-faction') as HTMLSelectElement | null;
    if (!sel || sel.options.length > 1) return;
    try {
      const res = await fetch('/api/auth/factions');
      const data = await res.json();
      if (Array.isArray(data.factions)) {
        sel.innerHTML = data.factions
          .map((f: any) => `<option value="${f.id}">${f.name} (Home Sector ${f.homeSectorId})</option>`)
          .join('');
      }
    } catch {}
  }

  private async submitLogin(): Promise<void> {
    const userEl = document.getElementById('auth-login-user') as HTMLInputElement | null;
    const passEl = document.getElementById('auth-login-pass') as HTMLInputElement | null;
    const errEl = document.getElementById('auth-error-msg');
    if (errEl) errEl.textContent = '';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userEl?.value.trim() || '',
          password: passEl?.value || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (errEl) errEl.textContent = data.error || 'Login failed.';
        return;
      }

      apiClient.setSession(data.token, data.account);
      this.hideAuthGate();
      this.updateTopCaptainBadge(data.account);
      const resolver = this.authResolve;
      this.authResolve = null;
      await this.callbacks.onAuthenticated({ account: data.account, ship: data.ship });
      if (resolver) resolver({ account: data.account, ship: data.ship });
    } catch (err: any) {
      if (errEl) errEl.textContent = err.message || 'Network error during login.';
    }
  }

  private async submitRegister(): Promise<void> {
    const userEl = document.getElementById('auth-reg-user') as HTMLInputElement | null;
    const callEl = document.getElementById('auth-reg-callsign') as HTMLInputElement | null;
    const passEl = document.getElementById('auth-reg-pass') as HTMLInputElement | null;
    const facEl = document.getElementById('auth-reg-faction') as HTMLSelectElement | null;
    const errEl = document.getElementById('auth-error-msg');
    if (errEl) errEl.textContent = '';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userEl?.value.trim() || '',
          callsign: callEl?.value.trim() || '',
          password: passEl?.value || '',
          factionId: facEl?.value || 'FACTION_SOL',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (errEl) errEl.textContent = data.error || 'Registration failed.';
        return;
      }

      apiClient.setSession(data.token, data.account);
      this.hideAuthGate();
      this.updateTopCaptainBadge(data.account);
      const resolver = this.authResolve;
      this.authResolve = null;
      this.callbacks.showApNotification(
        `Commissioned ${data.account.callsign} in Sector ${data.homeSectorId}!`
      );
      await this.callbacks.onAuthenticated({ account: data.account, ship: data.ship });
      if (resolver) resolver({ account: data.account, ship: data.ship });
    } catch (err: any) {
      if (errEl) errEl.textContent = err.message || 'Network error during registration.';
    }
  }

  public async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    apiClient.clearSession();
    if (this.socialSocket) {
      this.socialSocket.close();
      this.socialSocket = null;
    }
    this.callbacks.onLoggedOut();
    this.showAuthGate();
  }

  public updateTopCaptainBadge(account: any): void {
    const el = document.getElementById('hud-captain-callsign');
    if (el) {
      el.textContent = `CMDR ${String(account.callsign || 'PILOT').toUpperCase()}`;
    }
  }

  public connectSocialSocket(): void {
    if (!apiClient.getToken()) return;
    if (this.socialSocket && this.socialSocket.readyState <= WebSocket.OPEN) {
      this.socialSocket.close();
    }

    const sock = new WebSocket(apiClient.wsUrl('/ws/social'));
    this.socialSocket = sock;

    sock.onopen = () => {
      void this.loadChatHistory();
      void this.refreshOnlineRoster();
    };

    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'CHAT_MESSAGE' && msg.message) {
          this.chatMessages.push(msg.message);
          if (this.chatMessages.length > 80) this.chatMessages.shift();
          this.renderChatFeed();
        } else if (msg.type === 'REMOTE_HYPERSPACE_POS') {
          this.callbacks.onRemoteHyperspacePos(msg);
        } else if (msg.type === 'SQUAD_INVITE') {
          this.callbacks.showApNotification(
            `🛡️ SQUADRON INVITE received! Open Comms Hub -> Squadron tab to accept.`
          );
          if (this.currentModalTab === 'SQUADRON') void this.renderSquadronTab();
        } else if (msg.type === 'SQUAD_UPDATED') {
          if (this.currentModalTab === 'SQUADRON') void this.renderSquadronTab();
        } else if (msg.type === 'ALLY_PACT_PROPOSAL') {
          this.callbacks.showApNotification(
            `🤝 PEER ALLIANCE PROPOSAL received! Open Peer Allies tab to accept.`
          );
          if (this.currentModalTab === 'ALLIES') void this.renderAlliesTab();
        } else if (msg.type === 'ALLY_PACT_ACCEPTED' || msg.type === 'ALLY_GRANTS_UPDATED' || msg.type === 'ALLY_PACT_ENDED') {
          if (this.currentModalTab === 'ALLIES') void this.renderAlliesTab();
        } else if (msg.type === 'TRADE_INVITE' || msg.type === 'TRADE_UPDATED') {
          this.activeTrade = msg.trade;
          this.callbacks.showApNotification(`💱 P2P Trade update with ${msg.trade?.initiatorCallsign || 'Captain'}`);
          if (msg.type === 'TRADE_INVITE') {
            this.openSocialModal('TRADE');
          } else if (this.currentModalTab === 'TRADE') {
            void this.renderTradeTab();
          }
        } else if (msg.type === 'TRADE_COMPLETED') {
          this.activeTrade = msg.trade;
          this.callbacks.showApNotification(`✅ P2P Escrow Trade completed atomically!`);
          void this.callbacks.onRefreshShipState();
          if (this.currentModalTab === 'TRADE') void this.renderTradeTab();
        } else if (msg.type === 'DUEL_CHALLENGE' && msg.duel) {
          this.activeDuel = msg.duel;
          this.callbacks.showApNotification(
            `⚔️ DUEL CHALLENGE from ${msg.duel.challengerCallsign} (${msg.duel.wagerCredits} Cr)! Open Hail Hub to accept.`
          );
          void this.promptIncomingDuel(msg.duel);
        } else if (msg.type === 'DUEL_STARTED') {
          this.callbacks.showApNotification(`⚔️ DUEL ENGAGED! First to 15% hull yields (zero ship loss).`);
        } else if (msg.type === 'DUEL_COMPLETED') {
          const me = apiClient.getAccountId();
          const won = msg.winnerId === me;
          this.callbacks.showApNotification(
            won ? `🏆 DUEL VICTORY! (+${msg.wagerCredits || 0} Cr)` : `🛡️ DUEL CONCLUDED. Hull stabilized.`,
            !won
          );
          void this.callbacks.onRefreshShipState();
        } else if (msg.type === 'RAID_ALERT') {
          this.callbacks.showApNotification(msg.message || `☠️ Frontier Dreadnought Signal Detected in Sector ${msg.sectorId}`);
          if (this.currentModalTab === 'RAIDS') void this.renderRaidsTab();
        } else if (msg.type === 'RAID_LOOT_ROLLS') {
          this.callbacks.showApNotification(`🏆 Raid Spoils Roll Open! Need/Greed/Pass available.`);
          if (this.currentModalTab === 'RAIDS') void this.renderRaidsTab();
          else this.openSocialModal('RAIDS');
        }
      } catch {}
    };
  }

  private async promptIncomingDuel(duel: any): Promise<void> {
    this.openSocialModal('HAIL');
    try {
      const res = await fetch(`/api/social/player/${encodeURIComponent(duel.challengerId)}`);
      const data = await res.json();
      if (data.success) {
        this.hailedDossier = data.dossier;
      }
    } catch {}
    this.renderHailTab(duel);
  }

  public notifyHyperspaceMoved(): void {
    if (this.socialSocket && this.socialSocket.readyState === WebSocket.OPEN) {
      this.socialSocket.send(JSON.stringify({ type: 'HYPERSPACE_PING' }));
    }
  }

  public async loadChatHistory(): Promise<void> {
    try {
      const res = await fetch(`/api/chat/history?channelType=${this.activeChannel}`);
      const data = await res.json();
      if (data.success) {
        this.chatMessages = data.messages || [];
        this.renderChatFeed();
      }
    } catch {}
  }

  public async sendChatFromInput(): Promise<void> {
    const input = document.getElementById('input-comms-chat') as HTMLInputElement | null;
    if (!input) return;
    const raw = input.value.trim();
    if (!raw) return;

    let content = raw;
    let channelType = this.activeChannel;
    let targetAccountId = this.whisperTargetId;

    if (raw.startsWith('/w ') || raw.startsWith('@')) {
      channelType = 'WHISPER';
      const parts = raw.replace(/^\/w\s+|^@/, '').split(/\s+/);
      const targetName = parts.shift() || '';
      content = parts.join(' ');
      const match = this.onlineCaptains.find(
        (c) => c.callsign.toLowerCase() === targetName.toLowerCase() || c.accountId === targetName
      );
      if (match) targetAccountId = match.accountId;
    }

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelType, targetAccountId, content }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        this.callbacks.showApNotification(data.error || 'Chat send failed.', true);
        return;
      }
      input.value = '';
    } catch {}
  }

  private renderChatFeed(): void {
    const feed = document.getElementById('comms-chat-feed');
    if (!feed) return;
    if (this.chatMessages.length === 0) {
      feed.innerHTML = `<div class="comms-empty">No transmissions on [${this.activeChannel}].</div>`;
      return;
    }
    feed.innerHTML = this.chatMessages
      .slice(-30)
      .map((m) => {
        const tag = `[${m.channelType || m.channel_type}]`;
        const sender = m.senderCallsign || m.sender_callsign || 'Unknown';
        const senderId = m.senderId || m.sender_id;
        return `<div class="comms-msg-line">
          <span class="comms-tag">${tag}</span>
          <button class="comms-sender-btn" data-account-id="${senderId}">${sender}</button>:
          <span class="comms-msg-text">${this.escapeHtml(m.content)}</span>
        </div>`;
      })
      .join('');
    feed.scrollTop = feed.scrollHeight;

    feed.querySelectorAll('.comms-sender-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).getAttribute('data-account-id');
        if (id && id !== apiClient.getAccountId()) {
          void this.hailCaptain(id);
        }
      });
    });
  }

  public async refreshOnlineRoster(): Promise<void> {
    try {
      const res = await fetch('/api/social/online');
      const data = await res.json();
      if (data.success) {
        this.onlineCaptains = data.captains || [];
        this.renderRosterList();
      }
    } catch {}
  }

  private renderRosterList(): void {
    const box = document.getElementById('comms-roster-list');
    if (!box) return;
    box.innerHTML = this.onlineCaptains
      .filter((c) => !c.isMe)
      .slice(0, 12)
      .map(
        (c) => `
        <button class="comms-roster-pill ${c.isSocketConnected ? 'online' : ''}" data-account-id="${c.accountId}">
          <span>${c.isSocketConnected ? '🟢' : '⚪'} ${this.escapeHtml(c.callsign)}</span>
          <span class="comms-roster-sec">S${c.currentSectorId}${c.isSquadMate ? ' • SQD' : ''}${c.isPeerAlly ? ' • ALLY' : ''}</span>
        </button>`
      )
      .join('');

    box.querySelectorAll('.comms-roster-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).getAttribute('data-account-id');
        if (id) void this.hailCaptain(id);
      });
    });
  }

  public async hailCaptain(targetAccountId: string): Promise<void> {
    this.callbacks.audio.playShipHailBeep?.();
    this.whisperTargetId = targetAccountId;
    try {
      const res = await fetch(`/api/social/player/${encodeURIComponent(targetAccountId)}`);
      const data = await res.json();
      if (data.success) {
        this.hailedDossier = data.dossier;
        this.openSocialModal('HAIL');
      } else {
        this.callbacks.showApNotification(data.error || 'Unable to hail captain.', true);
      }
    } catch {}
  }

  public openSocialModal(tab: 'HAIL' | 'SQUADRON' | 'ALLIES' | 'TRADE' | 'RAIDS' = 'HAIL'): void {
    document.getElementById('multiplayer-social-modal')?.classList.remove('hidden');
    this.switchSocialTab(tab);
  }

  public closeSocialModal(): void {
    document.getElementById('multiplayer-social-modal')?.classList.add('hidden');
  }

  private switchSocialTab(tab: 'HAIL' | 'SQUADRON' | 'ALLIES' | 'TRADE' | 'RAIDS'): void {
    this.currentModalTab = tab;
    document.querySelectorAll('.mp-tab-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    if (tab === 'HAIL') this.renderHailTab(this.activeDuel);
    else if (tab === 'SQUADRON') void this.renderSquadronTab();
    else if (tab === 'ALLIES') void this.renderAlliesTab();
    else if (tab === 'TRADE') void this.renderTradeTab();
    else if (tab === 'RAIDS') void this.renderRaidsTab();
  }

  private renderHailTab(incomingDuel?: any): void {
    const body = document.getElementById('mp-modal-body');
    if (!body) return;

    const d = this.hailedDossier;
    if (!d) {
      body.innerHTML = `<div class="comms-empty">Click any online Captain in Comms Roster or target a remote ship in 3D space to inspect & hail.</div>`;
      return;
    }

    const duelBanner =
      incomingDuel && incomingDuel.status === 'PENDING' && incomingDuel.defenderId === apiClient.getAccountId()
        ? `<div class="mp-alert-box">
            ⚔️ <strong>Incoming Duel Challenge</strong> from ${this.escapeHtml(incomingDuel.challengerCallsign)} (Wager: ${incomingDuel.wagerCredits} Cr)
            <div class="mp-btn-row">
              <button id="btn-accept-duel" class="colony-action-btn primary">ACCEPT DUEL</button>
              <button id="btn-decline-duel" class="colony-action-btn">DECLINE</button>
            </div>
          </div>`
        : '';

    body.innerHTML = `
      ${duelBanner}
      <div class="mp-dossier-card">
        <div class="mp-dossier-head">
          <h3>CMDR ${this.escapeHtml(d.callsign)}</h3>
          <span>${d.factionId} // SECTOR ${d.ship?.currentSectorId ?? '?'}</span>
        </div>
        <div class="mp-dossier-stats">
          <span>Vessel: ${this.escapeHtml(d.ship?.flagshipName || 'Unknown')} (${d.ship?.hullSubtype || d.ship?.hullClass || 'CORVETTE'})</span>
          <span>Armor: ${d.ship?.armor ?? 0}/${d.ship?.maxArmor ?? 0} // Shield: ${d.ship?.shield ?? 0}/${d.ship?.maxShield ?? 0}</span>
          <span>Crew Roster: ${d.crewCount} • Colonies: ${d.colonies?.length || 0}</span>
          <span>Status: ${d.inMySquadron ? '🛡️ Squadron Mate' : 'Free Agent'} • ${d.isPeerAlly ? '🤝 Peer Ally' : 'Neutral'}</span>
        </div>
        <div class="mp-modules-row">
          ${(d.fittedModules || []).map((m: any) => `<span class="lander-crew-pill">[${m.slot}] ${this.escapeHtml(m.name)}</span>`).join('')}
        </div>
        <div class="mp-btn-row">
          <button id="btn-mp-invite-squad" class="colony-action-btn">🛡️ Invite to Squadron</button>
          <button id="btn-mp-propose-ally" class="colony-action-btn">🤝 Propose Peer Ally Pact</button>
          <button id="btn-mp-start-trade" class="colony-action-btn primary">💱 Open P2P Trade</button>
          <button id="btn-mp-challenge-duel" class="colony-action-btn warn">⚔️ Challenge Duel (250 Cr)</button>
        </div>
      </div>
    `;

    document.getElementById('btn-accept-duel')?.addEventListener('click', async () => {
      const r = await fetch(`/api/duels/${incomingDuel.id}/accept`, { method: 'POST' });
      const resData = await r.json();
      if (!r.ok) this.callbacks.showApNotification(resData.error || 'Duel accept failed', true);
      else {
        this.activeDuel = null;
        this.closeSocialModal();
      }
    });

    document.getElementById('btn-decline-duel')?.addEventListener('click', async () => {
      await fetch(`/api/duels/${incomingDuel.id}/decline`, { method: 'POST' });
      this.activeDuel = null;
      this.renderHailTab();
    });

    document.getElementById('btn-mp-invite-squad')?.addEventListener('click', async () => {
      const r = await fetch('/api/squadrons/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAccountId: d.accountId }),
      });
      const resData = await r.json();
      this.callbacks.showApNotification(resData.success ? `Squadron invite sent to ${d.callsign}` : resData.error, !resData.success);
    });

    document.getElementById('btn-mp-propose-ally')?.addEventListener('click', async () => {
      const r = await fetch('/api/alliances/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetAccountId: d.accountId }),
      });
      const resData = await r.json();
      this.callbacks.showApNotification(resData.success ? `Peer Ally Pact proposed to ${d.callsign}` : resData.error, !resData.success);
    });

    document.getElementById('btn-mp-start-trade')?.addEventListener('click', async () => {
      const r = await fetch('/api/p2p-trade/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: d.accountId }),
      });
      const resData = await r.json();
      if (resData.success) {
        this.activeTrade = resData.trade;
        this.switchSocialTab('TRADE');
      } else {
        this.callbacks.showApNotification(resData.error, true);
      }
    });

    document.getElementById('btn-mp-challenge-duel')?.addEventListener('click', async () => {
      const r = await fetch('/api/duels/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defenderId: d.accountId, wagerCredits: 250 }),
      });
      const resData = await r.json();
      this.callbacks.showApNotification(resData.success ? `Duel challenge sent to ${d.callsign}!` : resData.error, !resData.success);
    });
  }

  private async renderSquadronTab(): Promise<void> {
    const body = document.getElementById('mp-modal-body');
    if (!body) return;

    const res = await fetch('/api/squadrons/mine');
    const data = await res.json();
    const sq = data.squadron;
    const invites = data.pendingInvites || [];

    const invitesHtml = invites
      .map(
        (inv: any) => `<div class="mp-alert-box">
          Invite from <strong>${this.escapeHtml(inv.inviterCallsign)}</strong> -> ${this.escapeHtml(inv.squadronName)}
          <button class="colony-action-btn primary btn-accept-sq" data-id="${inv.id}">JOIN SQUADRON</button>
        </div>`
      )
      .join('');

    if (!sq) {
      body.innerHTML = `
        ${invitesHtml}
        <div class="mp-dossier-card">
          <h3>CREATE CO-OP SQUADRON (UP TO 12 PILOTS)</h3>
          <div class="mp-btn-row">
            <input id="input-sq-name" type="text" placeholder="Squadron Wing Name..." class="auth-input" />
            <button id="btn-create-sq" class="colony-action-btn primary">CREATE SQUADRON</button>
          </div>
        </div>
      `;
      document.getElementById('btn-create-sq')?.addEventListener('click', async () => {
        const nm = (document.getElementById('input-sq-name') as HTMLInputElement)?.value;
        await fetch('/api/squadrons/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nm }),
        });
        void this.renderSquadronTab();
      });
    } else {
      body.innerHTML = `
        ${invitesHtml}
        <div class="mp-dossier-card">
          <div class="mp-dossier-head">
            <h3>${this.escapeHtml(sq.name)} (${sq.members.length}/${sq.maxMembers} PILOTS)</h3>
            <button id="btn-leave-sq" class="colony-action-btn warn">LEAVE SQUADRON</button>
          </div>
          <div class="mp-list-stack">
            ${sq.members
              .map(
                (m: any) => `<div class="mp-member-row">
                  <span>${m.role === 'LEADER' ? '⭐' : '🚀'} <strong>${this.escapeHtml(m.callsign)}</strong> (${m.hullClass})</span>
                  <span>SEC-${m.currentSectorId} • HP ${m.armor}/${m.maxArmor} • SHD ${m.shield}/${m.maxShield}</span>
                </div>`
              )
              .join('')}
          </div>
        </div>
      `;
      document.getElementById('btn-leave-sq')?.addEventListener('click', async () => {
        await fetch('/api/squadrons/leave', { method: 'POST' });
        void this.renderSquadronTab();
      });
    }

    body.querySelectorAll('.btn-accept-sq').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).getAttribute('data-id');
        await fetch('/api/squadrons/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteId: id }),
        });
        void this.renderSquadronTab();
      });
    });
  }

  private async renderAlliesTab(): Promise<void> {
    const body = document.getElementById('mp-modal-body');
    if (!body) return;

    const res = await fetch('/api/alliances/mine');
    const data = await res.json();
    const pacts = data.pacts || [];
    const myColonies = data.myColonies || [];

    if (pacts.length === 0) {
      body.innerHTML = `<div class="comms-empty">No Peer-to-Peer Alliance Pacts yet. Hail any Captain from Comms Roster to propose a bilateral treaty.</div>`;
      return;
    }

    body.innerHTML = pacts
      .map((p: any) => {
        if (p.status === 'PENDING') {
          return `<div class="mp-alert-box">
            🤝 Peer Pact with <strong>${this.escapeHtml(p.peerCallsign)}</strong> (${p.initiatedByMe ? 'Awaiting Response' : 'Incoming Proposal'})
            ${!p.initiatedByMe ? `<button class="colony-action-btn primary btn-accept-pact" data-pact="${p.pactId}">ACCEPT PACT</button>` : ''}
            <button class="colony-action-btn btn-end-pact" data-pact="${p.pactId}">CANCEL</button>
          </div>`;
        }

        const colonyRows = myColonies
          .map((c: any) => {
            const cg = (p.colonyGrantsGiven || []).find((g: any) => g.colonyId === c.id) || {};
            return `<div class="mp-colony-grant-row">
              <span>${this.escapeHtml(c.name)}</span>
              <label><input type="checkbox" class="chk-col-grant" data-col="${c.id}" data-peer="${p.peerAccountId}" data-field="canInspectGrid" ${cg.canInspectGrid ? 'checked' : ''} /> Inspect Grid</label>
              <label><input type="checkbox" class="chk-col-grant" data-col="${c.id}" data-peer="${p.peerAccountId}" data-field="canHarvestSilo" ${cg.canHarvestSilo ? 'checked' : ''} /> Harvest Silo</label>
              <label><input type="checkbox" class="chk-col-grant" data-col="${c.id}" data-peer="${p.peerAccountId}" data-field="canBuildOutpost" ${cg.canBuildOutpost ? 'checked' : ''} /> Build Outpost</label>
            </div>`;
          })
          .join('');

        return `<div class="mp-dossier-card">
          <div class="mp-dossier-head">
            <h3>🤝 PEER ALLY: ${this.escapeHtml(p.peerCallsign)}</h3>
            <button class="colony-action-btn warn btn-end-pact" data-pact="${p.pactId}">END PACT</button>
          </div>
          <div class="mp-grants-toggles">
            <label><input type="checkbox" class="chk-peer-grant" data-pact="${p.pactId}" data-field="friendlyFireShield" ${p.myGrantsToPeer.friendlyFireShield ? 'checked' : ''} /> Friendly-Fire Immunity</label>
            <label><input type="checkbox" class="chk-peer-grant" data-pact="${p.pactId}" data-field="canShareIntel" ${p.myGrantsToPeer.canShareIntel ? 'checked' : ''} /> Share Starmap Intel</label>
            <label><input type="checkbox" class="chk-peer-grant" data-pact="${p.pactId}" data-field="canViewAllColonies" ${p.myGrantsToPeer.canViewAllColonies ? 'checked' : ''} /> Allow Colony Inspection</label>
          </div>
          <div class="mp-colony-grants-box">
            <div class="outpost-insp-subtitle">PER-COLONY ACCESS GRANTS TO ${this.escapeHtml(p.peerCallsign)}</div>
            ${colonyRows || '<span class="comms-empty">You own no colonies yet.</span>'}
          </div>
        </div>`;
      })
      .join('');

    body.querySelectorAll('.btn-accept-pact').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pactId = (btn as HTMLElement).getAttribute('data-pact');
        await fetch(`/api/alliances/${pactId}/accept`, { method: 'POST' });
        void this.renderAlliesTab();
      });
    });

    body.querySelectorAll('.btn-end-pact').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pactId = (btn as HTMLElement).getAttribute('data-pact');
        await fetch(`/api/alliances/${pactId}/end`, { method: 'POST' });
        void this.renderAlliesTab();
      });
    });

    body.querySelectorAll('.chk-peer-grant').forEach((chk) => {
      chk.addEventListener('change', async () => {
        const el = chk as HTMLInputElement;
        const pactId = el.getAttribute('data-pact');
        const field = el.getAttribute('data-field')!;
        await fetch(`/api/alliances/${pactId}/peer-grants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: el.checked }),
        });
      });
    });

    body.querySelectorAll('.chk-col-grant').forEach((chk) => {
      chk.addEventListener('change', async () => {
        const el = chk as HTMLInputElement;
        const colonyId = el.getAttribute('data-col');
        const granteeAccountId = el.getAttribute('data-peer');
        const field = el.getAttribute('data-field')!;
        await fetch('/api/alliances/colony-grants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ colonyId, granteeAccountId, [field]: el.checked }),
        });
      });
    });
  }

  private async renderTradeTab(): Promise<void> {
    const body = document.getElementById('mp-modal-body');
    if (!body) return;
    const t = this.activeTrade;
    if (!t) {
      body.innerHTML = `<div class="comms-empty">No active P2P Escrow Trade. Hail any Captain to initiate a trade session.</div>`;
      return;
    }

    const me = apiClient.getAccountId();
    const amInit = t.initiatorId === me;
    const myOffer = amInit ? t.initiatorOffer : t.partnerOffer;
    const theirOffer = amInit ? t.partnerOffer : t.initiatorOffer;
    const myLocked = amInit ? t.initiatorLocked : t.partnerLocked;
    const theirLocked = amInit ? t.partnerLocked : t.initiatorLocked;
    const myConf = amInit ? t.initiatorConfirmed : t.partnerConfirmed;

    body.innerHTML = `
      <div class="mp-dossier-card">
        <div class="mp-dossier-head">
          <h3>💱 P2P ESCROW TRADE // ${t.status}</h3>
          <span>${this.escapeHtml(t.initiatorCallsign)} ↔ ${this.escapeHtml(t.partnerCallsign)}</span>
        </div>
        <div class="mp-trade-cols">
          <div class="mp-trade-col">
            <h4>YOUR OFFER (${myLocked ? '🔒 LOCKED' : 'OPEN'})</h4>
            <label>Credits: <input id="input-trade-credits" type="number" min="0" value="${myOffer.credits}" class="auth-input" /></label>
            <div class="mp-trade-summary">
              Cargo items: ${myOffer.cargo.length} • Gear: ${myOffer.inventoryIds.length} • Crew: ${myOffer.crewIds.length}
            </div>
            <button id="btn-trade-update" class="colony-action-btn">UPDATE OFFER</button>
          </div>
          <div class="mp-trade-col">
            <h4>PARTNER OFFER (${theirLocked ? '🔒 LOCKED' : 'OPEN'})</h4>
            <div>Credits: <strong>${theirOffer.credits} Cr</strong></div>
            <div>Cargo: ${theirOffer.cargo.map((c: any) => `${c.quantity}x ${c.commodityId}`).join(', ') || 'None'}</div>
            <div>Gear Modules: ${theirOffer.inventoryIds.length} • Crew Contracts: ${theirOffer.crewIds.length}</div>
          </div>
        </div>
        <div class="mp-btn-row">
          <button id="btn-trade-lock" class="colony-action-btn primary" ${myLocked ? 'disabled' : ''}>1. LOCK MY OFFER</button>
          <button id="btn-trade-confirm" class="colony-action-btn primary" ${!myLocked || !theirLocked || myConf ? 'disabled' : ''}>2. CONFIRM ATOMIC SWAP</button>
          <button id="btn-trade-cancel" class="colony-action-btn warn">CANCEL TRADE</button>
        </div>
      </div>
    `;

    document.getElementById('btn-trade-update')?.addEventListener('click', async () => {
      const cr = Number((document.getElementById('input-trade-credits') as HTMLInputElement)?.value || 0);
      const res = await fetch(`/api/p2p-trade/${t.id}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...myOffer, credits: cr }),
      });
      const data = await res.json();
      if (data.success) {
        this.activeTrade = data.trade;
        void this.renderTradeTab();
      } else {
        this.callbacks.showApNotification(data.error, true);
      }
    });

    document.getElementById('btn-trade-lock')?.addEventListener('click', async () => {
      const res = await fetch(`/api/p2p-trade/${t.id}/lock`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.activeTrade = data.trade;
        void this.renderTradeTab();
      } else {
        this.callbacks.showApNotification(data.error, true);
      }
    });

    document.getElementById('btn-trade-confirm')?.addEventListener('click', async () => {
      const res = await fetch(`/api/p2p-trade/${t.id}/confirm`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.activeTrade = data.trade;
        void this.renderTradeTab();
      } else {
        this.callbacks.showApNotification(data.error, true);
      }
    });

    document.getElementById('btn-trade-cancel')?.addEventListener('click', async () => {
      const res = await fetch(`/api/p2p-trade/${t.id}/cancel`, { method: 'POST' });
      const data = await res.json();
      this.activeTrade = data.trade;
      void this.renderTradeTab();
    });
  }

  private async renderRaidsTab(): Promise<void> {
    const body = document.getElementById('mp-modal-body');
    if (!body) return;

    const [raidsRes, rollsRes, relicsRes] = await Promise.all([
      fetch('/api/raids/active').then((r) => r.json()).catch(() => ({ raids: [] })),
      fetch('/api/raids/rolls').then((r) => r.json()).catch(() => ({ rolls: [] })),
      fetch('/api/raids/relics').then((r) => r.json()).catch(() => ({ relics: [] })),
    ]);

    const raids = raidsRes.raids || [];
    const rolls = rollsRes.rolls || [];
    const relics = (relicsRes.relics || []).filter((r: any) => Number(r.chargesRemaining ?? 1) > 0);

    body.innerHTML = `
      <div class="mp-dossier-card">
        <h3>☠️ ACTIVE ROAMING FRONTIER DREADNOUGHTS (OPEN PvPvE // REC. 6-12 PILOTS)</h3>
        ${
          raids.length === 0
            ? '<div class="comms-empty">Scanning deep frontier beacons...</div>'
            : raids
                .map(
                  (r: any) => `<div class="mp-member-row">
                    <div>
                      <strong>${this.escapeHtml(r.bossName)}</strong> (Phase ${r.phase})<br/>
                      <span class="mp-badge">SECTOR ${r.sectorId}: ${this.escapeHtml(r.sectorName)} (${r.coordinatesX}, ${r.coordinatesY}) • HP ${r.hp}/${r.maxHp} • SHLD ${r.shields}/${r.maxShields}</span>
                    </div>
                    <button class="colony-action-btn primary btn-warp-raid" data-sector-id="${r.sectorId}">WARP INTERCEPT</button>
                  </div>`
                )
                .join('')
        }
      </div>

      <div class="mp-dossier-card">
        <h3>🎲 SQUADRON LOOT ROLLS (NEED / GREED / PASS)</h3>
        ${
          rolls.length === 0
            ? '<div class="comms-empty">No pending Dreadnought spoils rolls right now.</div>'
            : rolls
                .map(
                  (roll: any) => `<div class="mp-member-row">
                    <div>
                      <strong>${this.escapeHtml(roll.itemName)}</strong> <span class="mp-badge">[${roll.itemType}]</span>
                    </div>
                    <div class="mp-btn-row">
                      <button class="colony-action-btn primary btn-raid-bid" data-roll-id="${roll.id}" data-bid="NEED">NEED</button>
                      <button class="colony-action-btn btn-raid-bid" data-roll-id="${roll.id}" data-bid="GREED">GREED</button>
                      <button class="colony-action-btn warn btn-raid-bid" data-roll-id="${roll.id}" data-bid="PASS">PASS</button>
                    </div>
                  </div>`
                )
                .join('')
        }
      </div>

      <div class="mp-dossier-card">
        <h3>🏆 UNLOCKED RELIC BLUEPRINT PERMITS (${relics.length})</h3>
        ${
          relics.length === 0
            ? '<div class="comms-empty">Defeat Frontier Dreadnoughts to earn Tier-4 Relic Ship & Precursor Core permits.</div>'
            : relics.map((rl: any) => `<div class="mp-member-row"><span>✨ <strong>${this.escapeHtml(rl.title || rl.blueprintId)}</strong> (${this.escapeHtml(rl.unlockType || '')})</span><span class="mp-badge">CHARGES: ${rl.chargesRemaining ?? 1}</span></div>`).join('')
        }
      </div>
    `;

    body.querySelectorAll('.btn-warp-raid').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const sectorId = Number((btn as HTMLElement).getAttribute('data-sector-id'));
        const res = await fetch('/api/navigation/hyperspace-jump', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destinationSectorId: sectorId }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          this.callbacks.showApNotification(`⚡ Warping to Frontier Sector ${sectorId} Raid Beacon!`);
          this.closeSocialModal();
          void this.callbacks.onRefreshShipState();
        } else {
          this.callbacks.showApNotification(`⚠️ ${data.error || 'Warp jump failed (check Fuel/AP)'}`, true);
        }
      });
    });

    body.querySelectorAll('.btn-raid-bid').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rollId = (btn as HTMLElement).getAttribute('data-roll-id');
        const bidType = (btn as HTMLElement).getAttribute('data-bid');
        const res = await fetch(`/api/raids/rolls/${encodeURIComponent(rollId || '')}/bid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bidType }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          this.callbacks.showApNotification(`🎲 Submitted ${bidType} roll!`);
          void this.callbacks.onRefreshShipState();
          void this.renderRaidsTab();
        } else {
          this.callbacks.showApNotification(`⚠️ ${data.error || 'Bid failed'}`, true);
        }
      });
    });
  }

  private escapeHtml(str: string): string {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
