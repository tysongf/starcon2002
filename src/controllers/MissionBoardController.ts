export interface MissionCallbacks {
  showNotification: (msg: string, isError?: boolean) => void;
  playUiBlip: () => void;
  getCurrentSectorId: () => number;
  getPlayerCredits: () => number;
  setPlayerCredits: (credits: number) => void;
  onPlotCourse: (sectorId: number) => Promise<void> | void;
  onBoardMutated?: () => void;
}

export interface MissionRecord {
  id: string;
  boardSectorId: number;
  sourceType: 'BOARD' | 'CAPTAIN_RUMOR' | 'STORY_CHAIN';
  missionType: 'XENOBIOLOGY_SURVEY' | 'PLANET_RECON' | 'WRECK_RECOVERY' | 'SYNDICATE_BOUNTY';
  issuerFactionId: string;
  giverName: string;
  title: string;
  briefing: string;
  targetSectorId: number;
  targetPlanetId: string | null;
  targetMetadata: Record<string, any>;
  progress: { currentCount?: number; requiredCount?: number; label?: string };
  chainId: string | null;
  chainStage: number;
  chainTotalStages: number;
  isUrgent: boolean;
  urgentExpiresAt: string | null;
  rewardCredits: number;
  rewardStanding: number;
  rewardModuleRarity: string | null;
  rewardModuleCategory: string | null;
  status: 'OFFERED' | 'ACTIVE' | 'READY_TO_CLAIM' | 'COMPLETED' | 'EXPIRED' | 'ABANDONED';
  branchMeta?: {
    rivalFactionId: string;
    loyalLabel: string;
    rivalLabel: string;
  };
}

export class MissionBoardController {
  private callbacks: MissionCallbacks;
  private filterMode: 'ALL' | 'STORY' | 'URGENT' | 'RUMORS' = 'ALL';
  private boardOffers: MissionRecord[] = [];
  private activeMissions: MissionRecord[] = [];
  private rumorOffers: MissionRecord[] = [];
  private maxActiveSlots: number = 5;
  private completedCount: number = 0;
  private trackerCollapsed: boolean = false;
  private timerInterval: number | null = null;

  private elOffersList: HTMLElement | null = null;
  private elActiveList: HTMLElement | null = null;
  private elActiveCount: HTMLElement | null = null;
  private elOfferCount: HTMLElement | null = null;
  private elCreditsPill: HTMLElement | null = null;
  private elRewardBanner: HTMLElement | null = null;
  private elBranchModal: HTMLElement | null = null;
  private elTrackerBox: HTMLElement | null = null;
  private elTrackerBody: HTMLElement | null = null;
  private elTrackerCount: HTMLElement | null = null;

  constructor(callbacks: MissionCallbacks) {
    this.callbacks = callbacks;
    this.bindUI();
  }

  private bindUI(): void {
    this.elOffersList = document.getElementById('missions-offers-list');
    this.elActiveList = document.getElementById('missions-active-list');
    this.elActiveCount = document.getElementById('missions-active-count');
    this.elOfferCount = document.getElementById('missions-offers-count');
    this.elCreditsPill = document.getElementById('missions-player-credits');
    this.elRewardBanner = document.getElementById('missions-reward-banner');
    this.elBranchModal = document.getElementById('missions-branch-overlay');
    this.elTrackerBox = document.getElementById('hud-mission-tracker');
    this.elTrackerBody = document.getElementById('hud-mission-tracker-body');
    this.elTrackerCount = document.getElementById('hud-mission-tracker-count');

    document.getElementById('btn-missions-refresh')?.addEventListener('click', () => this.refreshBoard());
    document.getElementById('btn-missions-sync')?.addEventListener('click', () => this.syncAndLoad());
    document.getElementById('btn-tracker-toggle')?.addEventListener('click', () => {
      this.trackerCollapsed = !this.trackerCollapsed;
      this.elTrackerBody?.classList.toggle('hidden', this.trackerCollapsed);
    });

    document.querySelectorAll('.mission-filter-pill').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = (e.currentTarget as HTMLElement).dataset.filter as any;
        if (!mode) return;
        this.filterMode = mode;
        document.querySelectorAll('.mission-filter-pill').forEach((b) =>
          b.classList.toggle('active', (b as HTMLElement).dataset.filter === mode)
        );
        this.callbacks.playUiBlip();
        this.renderBoard();
      });
    });

    if (this.timerInterval === null) {
      this.timerInterval = window.setInterval(() => this.updateCountdowns(), 1000);
    }
  }

  public getActiveMissionSectorIds(): number[] {
    return Array.from(new Set(this.activeMissions.map((m) => m.targetSectorId)));
  }

  public async loadBoard(): Promise<void> {
    try {
      const sectorId = this.callbacks.getCurrentSectorId();
      const res = await fetch(`/api/missions?accountId=acc_sol_captain&sectorId=${sectorId}`);
      if (!res.ok) return;
      const data = await res.json();
      this.boardOffers = data.boardOffers || [];
      this.activeMissions = data.activeMissions || [];
      this.rumorOffers = data.rumorOffers || [];
      this.maxActiveSlots = data.maxActiveSlots || 5;
      this.completedCount = data.completedCount || 0;
      this.renderBoard();
      this.renderHudTracker();
    } catch (err) {
      console.error('[Missions] Failed to load mission board:', err);
    }
  }

  public async syncAndLoad(): Promise<void> {
    try {
      await fetch('/api/missions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: 'acc_sol_captain' }),
      });
      await this.loadBoard();
    } catch (err) {
      console.error('[Missions] Sync failed:', err);
    }
  }

  public async refreshBoard(): Promise<void> {
    this.callbacks.playUiBlip();
    try {
      const res = await fetch('/api/missions/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
          sectorId: this.callbacks.getCurrentSectorId(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        this.callbacks.showNotification(data.error || 'Failed to refresh board.', true);
        return;
      }
      if (typeof data.remainingCredits === 'number') {
        this.callbacks.setPlayerCredits(data.remainingCredits);
      }
      this.callbacks.showNotification('📡 Refreshed Galactic Contracts Dispatch (-50 Cr)', false);
      await this.loadBoard();
    } catch (err: any) {
      this.callbacks.showNotification(err.message || 'Refresh failed.', true);
    }
  }

  private getTypeIcon(type: MissionRecord['missionType']): string {
    switch (type) {
      case 'XENOBIOLOGY_SURVEY':
        return '🧬';
      case 'PLANET_RECON':
        return '🪐';
      case 'WRECK_RECOVERY':
        return '🛰️';
      case 'SYNDICATE_BOUNTY':
        return '⚔️';
    }
  }

  private formatFactionBadge(fid: string): string {
    return fid.replace('FACTION_', '');
  }

  private formatUrgentRemaining(expiresAt: string | null): string {
    if (!expiresAt) return '';
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'BONUS EXPIRED';
    const totalSec = Math.floor(diffMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `⏱ ${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  private updateCountdowns(): void {
    document.querySelectorAll('.mission-urgent-timer[data-expires]').forEach((el) => {
      const exp = (el as HTMLElement).dataset.expires || null;
      el.textContent = this.formatUrgentRemaining(exp);
    });
  }

  public renderBoard(): void {
    if (this.elCreditsPill) {
      this.elCreditsPill.textContent = `${this.callbacks.getPlayerCredits().toLocaleString()} Cr`;
    }

    const combinedOffers = [...this.rumorOffers, ...this.boardOffers];
    const filteredOffers = combinedOffers.filter((m) => {
      if (this.filterMode === 'STORY') return m.chainTotalStages > 1;
      if (this.filterMode === 'URGENT') return m.isUrgent;
      if (this.filterMode === 'RUMORS') return m.sourceType === 'CAPTAIN_RUMOR';
      return true;
    });

    if (this.elOfferCount) {
      this.elOfferCount.textContent = `${filteredOffers.length} AVAILABLE // ${this.completedCount} COMPLETED`;
    }
    if (this.elActiveCount) {
      this.elActiveCount.textContent = `${this.activeMissions.length} / ${this.maxActiveSlots} ACTIVE`;
    }

    if (this.elOffersList) {
      if (filteredOffers.length === 0) {
        this.elOffersList.innerHTML = `<div class="meta-subtext" style="padding:1rem;text-align:center;">No dispatches match filter "${this.filterMode}". Refresh board or hail Frontier Captains for secret rumors.</div>`;
      } else {
        this.elOffersList.innerHTML = filteredOffers.map((m) => {
          const icon = this.getTypeIcon(m.missionType);
          const stageTag = m.chainTotalStages > 1 ? `<span class="mission-tag tag-chain">STAGE ${m.chainStage}/${m.chainTotalStages}</span>` : '';
          const rumorTag = m.sourceType === 'CAPTAIN_RUMOR' ? `<span class="mission-tag tag-rumor">SECRET RUMOR</span>` : '';
          const urgentTag = m.isUrgent && m.urgentExpiresAt
            ? `<span class="mission-tag tag-urgent mission-urgent-timer" data-expires="${m.urgentExpiresAt}">${this.formatUrgentRemaining(m.urgentExpiresAt)}</span>`
            : '';
          const modTag = m.rewardModuleRarity
            ? `<span class="mission-tag tag-module">${m.rewardModuleRarity} ${m.rewardModuleCategory || 'MODULE'}</span>`
            : '';
          const targetName = m.targetMetadata.targetSectorName || `Sector ${m.targetSectorId}`;
          const planetSub = m.targetMetadata.targetPlanetName
            ? ` • ${m.targetMetadata.targetPlanetName} (${m.targetMetadata.targetPlanetSubtype || 'World'})`
            : '';

          return `
            <div class="mission-card">
              <div class="mission-card-top">
                <div class="mission-card-title">${icon} ${m.title}</div>
                <div class="mission-tags-row">${rumorTag}${stageTag}${urgentTag}</div>
              </div>
              <div class="mission-card-meta">${this.formatFactionBadge(m.issuerFactionId)} // Target: <strong>Sector ${m.targetSectorId} (${targetName})</strong>${planetSub}</div>
              <p class="mission-card-brief">${m.briefing}</p>
              <div class="mission-card-footer">
                <div class="mission-rewards-preview">
                  <span class="mission-reward-cr">+${m.rewardCredits.toLocaleString()} CR</span>
                  <span class="mission-reward-rep">+${m.rewardStanding} REP</span>
                  ${modTag}
                </div>
                <button class="hud-btn primary btn-accept-mission" data-id="${m.id}">ACCEPT</button>
              </div>
            </div>
          `;
        }).join('');

        this.elOffersList.querySelectorAll('.btn-accept-mission').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const id = (e.currentTarget as HTMLElement).dataset.id;
            if (id) this.acceptMission(id);
          });
        });
      }
    }

    if (this.elActiveList) {
      if (this.activeMissions.length === 0) {
        this.elActiveList.innerHTML = `<div class="meta-subtext" style="padding:1rem;text-align:center;">No active Galactic Missions. Accept dispatches from the left panel or hail patrolling Frontier Captains (C).</div>`;
      } else {
        this.elActiveList.innerHTML = this.activeMissions.map((m) => {
          const icon = this.getTypeIcon(m.missionType);
          const ready = m.status === 'READY_TO_CLAIM';
          const progressPct = m.progress.requiredCount
            ? Math.min(100, Math.round(((m.progress.currentCount || 0) / m.progress.requiredCount) * 100))
            : ready ? 100 : 0;
          const stageTag = m.chainTotalStages > 1 ? `<span class="mission-tag tag-chain">STAGE ${m.chainStage}/${m.chainTotalStages}</span>` : '';
          const urgentTag = m.isUrgent && m.urgentExpiresAt
            ? `<span class="mission-tag tag-urgent mission-urgent-timer" data-expires="${m.urgentExpiresAt}">${this.formatUrgentRemaining(m.urgentExpiresAt)}</span>`
            : '';

          return `
            <div class="mission-card ${ready ? 'mission-ready' : ''}">
              <div class="mission-card-top">
                <div class="mission-card-title">${icon} ${m.title}</div>
                <div class="mission-tags-row">${stageTag}${urgentTag}</div>
              </div>
              <div class="mission-card-meta">Target: <strong>Sector ${m.targetSectorId}</strong> • ${m.progress.label || m.status}</div>
              <div class="mission-progress-bar-wrap">
                <div class="mission-progress-bar-fill ${ready ? 'ready' : ''}" style="width:${progressPct}%"></div>
              </div>
              <div class="mission-card-footer">
                <div class="mission-actions-row">
                  <button class="hud-btn-mini btn-plot-mission" data-sector="${m.targetSectorId}">📍 PLOT COURSE</button>
                  <button class="hud-btn-mini btn-abandon-mission" data-id="${m.id}">ABANDON</button>
                </div>
                ${ready
                  ? `<button class="hud-btn primary btn-claim-mission" data-id="${m.id}">🏆 CLAIM REWARD</button>`
                  : `<span class="mission-status-pill">IN PROGRESS</span>`}
              </div>
            </div>
          `;
        }).join('');

        this.elActiveList.querySelectorAll('.btn-plot-mission').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const sectorId = parseInt((e.currentTarget as HTMLElement).dataset.sector || '1', 10);
            this.callbacks.playUiBlip();
            this.callbacks.onPlotCourse(sectorId);
          });
        });

        this.elActiveList.querySelectorAll('.btn-abandon-mission').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const id = (e.currentTarget as HTMLElement).dataset.id;
            if (id) this.abandonMission(id);
          });
        });

        this.elActiveList.querySelectorAll('.btn-claim-mission').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const id = (e.currentTarget as HTMLElement).dataset.id;
            if (id) this.handleClaimClick(id);
          });
        });
      }
    }
  }

  public renderHudTracker(): void {
    if (!this.elTrackerBox || !this.elTrackerBody) return;
    if (this.elTrackerCount) {
      this.elTrackerCount.textContent = `${this.activeMissions.length}/${this.maxActiveSlots}`;
    }

    if (this.activeMissions.length === 0) {
      this.elTrackerBody.innerHTML = `<div class="tracker-empty">No active missions — Dock & open 📜 Galactic Missions</div>`;
      return;
    }

    this.elTrackerBody.innerHTML = this.activeMissions.slice(0, 3).map((m) => {
      const icon = this.getTypeIcon(m.missionType);
      const ready = m.status === 'READY_TO_CLAIM';
      const urgent = m.isUrgent && m.urgentExpiresAt
        ? `<span class="mission-urgent-timer" data-expires="${m.urgentExpiresAt}">${this.formatUrgentRemaining(m.urgentExpiresAt)}</span>`
        : '';
      return `
        <div class="hud-tracker-item ${ready ? 'ready' : ''}">
          <div class="tracker-item-head">
            <span>${icon} S${m.targetSectorId}: ${m.title}</span>
            ${urgent}
          </div>
          <div class="tracker-item-foot">
            <span>${ready ? '✅ READY TO CLAIM' : m.progress.label || 'Active'}</span>
            <button class="hud-btn-mini tracker-plot-btn" data-sector="${m.targetSectorId}">PLOT</button>
          </div>
        </div>
      `;
    }).join('');

    this.elTrackerBody.querySelectorAll('.tracker-plot-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const sec = parseInt((e.currentTarget as HTMLElement).dataset.sector || '1', 10);
        this.callbacks.playUiBlip();
        this.callbacks.onPlotCourse(sec);
      });
    });
  }

  public async acceptMission(missionId: string): Promise<void> {
    this.callbacks.playUiBlip();
    try {
      const res = await fetch(`/api/missions/${missionId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: 'acc_sol_captain' }),
      });
      const data = await res.json();
      if (!res.ok) {
        this.callbacks.showNotification(data.error || 'Could not accept mission.', true);
        return;
      }
      this.callbacks.showNotification(`📜 Mission Accepted: ${data.mission.title}`, false);
      await this.loadBoard();
      this.callbacks.onBoardMutated?.();
    } catch (err: any) {
      this.callbacks.showNotification(err.message || 'Accept failed.', true);
    }
  }

  public async abandonMission(missionId: string): Promise<void> {
    this.callbacks.playUiBlip();
    try {
      const res = await fetch(`/api/missions/${missionId}/abandon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: 'acc_sol_captain' }),
      });
      if (res.ok) {
        this.callbacks.showNotification('Mission abandoned.', false);
        await this.loadBoard();
        this.callbacks.onBoardMutated?.();
      }
    } catch (err) {
      console.error('[Missions] Abandon failed:', err);
    }
  }

  private handleClaimClick(missionId: string): void {
    const mission = this.activeMissions.find((m) => m.id === missionId);
    if (mission && mission.branchMeta && this.elBranchModal) {
      this.elBranchModal.classList.remove('hidden');
      this.elBranchModal.innerHTML = `
        <div class="branch-choice-card">
          <h4>OPERATION FINALE // CHOOSE INTEL RESOLUTION</h4>
          <p>${mission.title}</p>
          <div class="branch-buttons">
            <button class="hud-btn primary" id="btn-branch-loyal">🛡️ ${mission.branchMeta.loyalLabel}</button>
            <button class="hud-btn" id="btn-branch-blackmarket">🕶️ ${mission.branchMeta.rivalLabel}</button>
            <button class="hud-btn-mini" id="btn-branch-cancel">Cancel</button>
          </div>
        </div>
      `;
      document.getElementById('btn-branch-loyal')?.addEventListener('click', () => {
        this.elBranchModal?.classList.add('hidden');
        this.claimMission(missionId, 'LOYAL_HANDOFF');
      });
      document.getElementById('btn-branch-blackmarket')?.addEventListener('click', () => {
        this.elBranchModal?.classList.add('hidden');
        this.claimMission(missionId, 'BLACK_MARKET_AUCTION');
      });
      document.getElementById('btn-branch-cancel')?.addEventListener('click', () => {
        this.elBranchModal?.classList.add('hidden');
      });
      return;
    }

    this.claimMission(missionId);
  }

  public async claimMission(missionId: string, branch?: 'LOYAL_HANDOFF' | 'BLACK_MARKET_AUCTION'): Promise<void> {
    this.callbacks.playUiBlip();
    try {
      const res = await fetch(`/api/missions/${missionId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: 'acc_sol_captain', branch }),
      });
      const data = await res.json();
      if (!res.ok) {
        this.callbacks.showNotification(data.error || 'Could not claim mission.', true);
        return;
      }

      if (typeof data.remainingCredits === 'number') {
        this.callbacks.setPlayerCredits(data.remainingCredits);
      }

      if (this.elRewardBanner) {
        const modName = data.awardedModule?.custom_name || 'Standard Supply Cache';
        const modRarity = data.awardedModule?.rarity || 'COMMON';
        const urgentNote = data.urgentBonusApplied ? ' ⚡ URGENT +50% BONUS APPLIED!' : '';
        const chainNote = data.nextStageMission
          ? ` → Unlocked Stage ${data.nextStageMission.chainStage}: ${data.nextStageMission.title}`
          : '';
        this.elRewardBanner.classList.remove('hidden');
        this.elRewardBanner.innerHTML = `
          <strong>🏆 PAYOUT CLAIMED:</strong> +${data.creditsAwarded.toLocaleString()} CR | +${data.standingDelta} Standing${urgentNote}
          | Forged Module: <span class="rarity-${modRarity.toLowerCase()}">[${modRarity}] ${modName}</span>${chainNote}
        `;
      }

      this.callbacks.showNotification(`🏆 Claimed +${data.creditsAwarded.toLocaleString()} Cr!`, false);
      await this.loadBoard();
      this.callbacks.onBoardMutated?.();
    } catch (err: any) {
      this.callbacks.showNotification(err.message || 'Claim failed.', true);
    }
  }
}

