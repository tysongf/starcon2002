/**
 * CrewController.ts
 * Milestone 1.5: Procedural Crew Specialists, Ship Stations, Payroll/Brokerage & Hiring Concourse UI.
 */

import { AudioEngine } from '../audio/AudioEngine';

export interface CrewControllerCallbacks {
  audio: AudioEngine;
  getAccountId: () => string;
  getActivePortId: () => string | null;
  getCurrentSectorId: () => number;
  showApNotification: (msg: string, isAlert?: boolean) => void;
  refreshPlayerHold: () => void;
}

export class CrewController {
  private callbacks: CrewControllerCallbacks;
  private rosterData: any = null;
  private marketData: any = null;
  private catalogData: any = null;
  private marketSourceType: 'STARPORT' | 'COLONY' = 'STARPORT';
  private marketSourceId: string = 'PORT_AEGIS_01';

  constructor(callbacks: CrewControllerCallbacks) {
    this.callbacks = callbacks;
  }

  private getPortSourceId(): string {
    return this.callbacks.getActivePortId() || `PORT_SEC_${this.callbacks.getCurrentSectorId()}`;
  }

  public async loadCrewTab(sourceOverride?: { type: 'STARPORT' | 'COLONY'; id: string }): Promise<void> {
    const accountId = this.callbacks.getAccountId();
    if (sourceOverride) {
      this.marketSourceType = sourceOverride.type;
      this.marketSourceId = sourceOverride.id;
    } else {
      this.marketSourceType = 'STARPORT';
      this.marketSourceId = this.getPortSourceId();
    }

    try {
      const [rosterRes, marketRes, catalogRes] = await Promise.all([
        fetch(`/api/crew/roster?accountId=${encodeURIComponent(accountId)}`),
        fetch(
          `/api/crew/market?accountId=${encodeURIComponent(accountId)}&sourceType=${this.marketSourceType}&sourceId=${encodeURIComponent(this.marketSourceId)}`
        ),
        this.catalogData ? Promise.resolve(null) : fetch('/api/crew/catalog'),
      ]);

      if (rosterRes.ok) this.rosterData = await rosterRes.json();
      if (marketRes.ok) this.marketData = await marketRes.json();
      if (catalogRes && catalogRes.ok) this.catalogData = await catalogRes.json();

      this.renderCrewTab();
    } catch (err) {
      console.error('[CrewController] Failed to load crew tab:', err);
    }
  }

  private fmtBonusPct(val: number): string {
    return `+${Math.round((val || 0) * 100)}%`;
  }

  private renderCrewTab(): void {
    const container = document.getElementById('crew-station-root');
    if (!container || !this.rosterData) return;

    const {
      credits = 0,
      arrearsCycles = 0,
      crew = [],
      shipStations = [],
      reserveBerthLimit = 6,
      bonuses = {},
    } = this.rosterData;

    const candidates = this.marketData?.candidates || [];
    const totalWage = crew.reduce((s: number, c: any) => s + Number(c.baseSalary || 0), 0);

    const openBaySlots = shipStations.filter((st: any) => !st.occupantCrewId);

    const bonusChips = [
      { label: 'Mining', val: this.fmtBonusPct(bonuses.miningYieldBonus) },
      { label: 'Research', val: this.fmtBonusPct(Math.max(bonuses.researchBioDataBonus || 0, bonuses.researchPrecursorBonus || 0)) },
      { label: 'Weapons', val: this.fmtBonusPct(bonuses.weaponDamageBonus) },
      { label: 'Shields/Hull', val: this.fmtBonusPct(bonuses.shieldMaxBonus) },
      { label: 'Engines', val: this.fmtBonusPct(bonuses.sublightSpeedBonus) },
      { label: 'Trade Margin', val: this.fmtBonusPct(bonuses.tradeMarginBonus) },
      { label: 'Standing', val: this.fmtBonusPct(bonuses.reputationGainBonus) },
    ];

    container.innerHTML = `
      <div class="crew-payroll-banner">
        <div class="crew-payroll-left">
          <div class="crew-title-row">
            <span class="bridge-badge">FLEET PERSONNEL &amp; STATIONS</span>
            <span class="crew-arrears-pill ${arrearsCycles > 0 ? 'alert' : 'ok'}">
              ${arrearsCycles > 0 ? `⚠️ ARREARS: ${arrearsCycles} CYCLES (BONUSES PENALIZED)` : '✅ PAYROLL CURRENT'}
            </span>
          </div>
          <div class="crew-bonus-strip">
            ${bonusChips.map((b) => `<span class="crew-bonus-chip"><strong>${b.label}:</strong> ${b.val}</span>`).join('')}
          </div>
        </div>
        <div class="crew-payroll-right">
          <div class="stat-pill">
            <span class="pill-label">ROSTER:</span>
            <span class="pill-value">${crew.length} / ${reserveBerthLimit + shipStations.length}</span>
          </div>
          <div class="stat-pill">
            <span class="pill-label">CYCLE PAYROLL:</span>
            <span class="pill-value">${totalWage} Cr</span>
          </div>
          <div class="stat-pill credits-pill">
            <span class="pill-label">CREDITS:</span>
            <span class="pill-value">${Number(credits).toLocaleString()} Cr</span>
          </div>
          <button id="btn-crew-settle-cycle" class="crew-action-btn primary">SETTLE CYCLE PAY</button>
        </div>
      </div>

      <div class="crew-main-grid">
        <div class="crew-panel-col">
          <div class="col-header">
            <h4>🛸 FLAGSHIP BAY STATIONS (${shipStations.length} BERTHS)</h4>
            <span class="col-subtext">FIT TIERED BAY MODULES IN OUTFITTING TO UNLOCK STATIONS</span>
          </div>
          <div class="crew-stations-list">
            ${
              shipStations.length === 0
                ? '<div class="slot-empty-notice" style="padding:1rem;">No Bay Modules fitted on flagship [B1..B8] sockets. Fit a Research Bay, Mining Bay, Gunnery Deck, or Medbay in Outfitting!</div>'
                : shipStations
                    .map((st: any) => {
                      const occ = st.occupantCrewId
                        ? crew.find((c: any) => c.id === st.occupantCrewId)
                        : null;
                      const acceptedLabel = Array.isArray(st.acceptedSpecialties)
                        ? st.acceptedSpecialties.join(', ')
                        : 'ANY SPECIALTY (COMMAND DECK)';
                      return `
                        <div class="crew-station-card ${occ ? 'occupied' : 'vacant'}">
                          <div class="crew-station-head">
                            <span class="slot-tag-badge bay">[${st.slotKey}]</span>
                            <div>
                              <strong>${st.bayName || st.moduleName} (${st.baySlot})</strong>
                              <div class="col-subtext">Accepts: ${acceptedLabel}</div>
                            </div>
                          </div>
                          ${
                            occ
                              ? `<div class="crew-occupant-row">
                                  <span>${occ.name} • <span class="rarity-pill rarity-${occ.rarity.toLowerCase()}">${occ.rarity}</span> (${occ.specialties.join(', ')}) • Morale ${occ.morale}%</span>
                                  <button class="fit-btn-small btn-crew-to-reserve" data-crew-id="${occ.id}">UNASSIGN</button>
                                </div>`
                              : `<div class="crew-vacant-notice">VACANT STATION — Assign a matching Specialist from your Roster below.</div>`
                          }
                        </div>
                      `;
                    })
                    .join('')
            }
          </div>

          <div class="col-header" style="margin-top:0.85rem;">
            <h4>👥 ACTIVE CREW ROSTER (${crew.length})</h4>
            <span class="col-subtext">ASSIGN TO STATIONS OR BROKER SURPLUS CONTRACTS</span>
          </div>
          <div class="crew-roster-list">
            ${
              crew.length === 0
                ? '<div class="slot-empty-notice" style="padding:1rem;">No Specialists hired yet. Recruit from the Concourse on the right!</div>'
                : crew
                    .map((c: any) => {
                      const compatibleBays = openBaySlots.filter(
                        (st: any) =>
                          st.acceptedSpecialties === 'ANY' ||
                          (Array.isArray(st.acceptedSpecialties) &&
                            c.specialties.some((sp: string) => st.acceptedSpecialties.includes(sp)))
                      );
                      const assignOptions = compatibleBays
                        .map(
                          (st: any) =>
                            `<button class="fit-btn-small btn-assign-bay" data-crew-id="${c.id}" data-bay-slot="${st.slotKey}">ASSIGN [${st.slotKey}]</button>`
                        )
                        .join('');
                      return `
                        <div class="crew-member-card rarity-${c.rarity.toLowerCase()}">
                          <div class="crew-member-top">
                            <div>
                              <span class="rarity-pill rarity-${c.rarity.toLowerCase()}">${c.rarity}</span>
                              <strong>${c.name}</strong>
                              <span class="mfg-badge">${c.species}</span>
                              <span class="mfg-badge" style="color:#7dd3fc;">${c.assignmentType === 'SHIP_BAY' ? `BAY ${c.assignedBaySlot}` : c.assignmentType === 'COLONY' ? 'COLONY WORKFORCE' : 'RESERVE'}</span>
                            </div>
                            <span class="crew-wage-tag">${c.baseSalary} Cr/cycle • Morale ${c.morale}%</span>
                          </div>
                          <div class="crew-specialties-row">
                            ${c.specialties.map((sp: string) => `<span class="crew-spec-pill">${sp}</span>`).join('')}
                            <span class="crew-trait-tag" title="${c.traitDesc}">✦ ${c.traitLabel}</span>
                          </div>
                          <div class="crew-stats-row">
                            <span>Aptitude: <strong>${c.aptitude}</strong></span>
                            <span>Grit: <strong>${c.grit}</strong></span>
                            <span>Efficiency: <strong>${c.efficiency}</strong></span>
                            <span>Origin: ${c.originLabel}</span>
                          </div>
                          <div class="crew-actions-row">
                            ${assignOptions}
                            ${
                              c.assignmentType !== 'RESERVE'
                                ? `<button class="fit-btn-small btn-crew-to-reserve" data-crew-id="${c.id}">TO RESERVE</button>`
                                : ''
                            }
                            <button class="fit-btn-small btn-crew-broker" data-crew-id="${c.id}" style="border-color:#f59e0b;color:#fbbf24;">BROKER CONTRACT (+${c.resaleValue} Cr)</button>
                          </div>
                        </div>
                      `;
                    })
                    .join('')
            }
          </div>
        </div>

        <div class="crew-panel-col">
          <div class="col-header">
            <h4>🏢 CONCOURSE RECRUITMENT (${this.marketSourceType}: ${this.marketSourceId})</h4>
            <button id="btn-crew-refresh-market" class="fit-btn-small">↻ REFRESH SLATE (75 Cr)</button>
          </div>
          <div class="crew-market-list">
            ${
              candidates.length === 0
                ? '<div class="slot-empty-notice" style="padding:1rem;">All applicants on this slate signed. Click Refresh Slate to post a new concourse listing!</div>'
                : candidates
                    .map(
                      (cand: any) => `
                        <div class="crew-member-card rarity-${cand.rarity.toLowerCase()}">
                          <div class="crew-member-top">
                            <div>
                              <span class="rarity-pill rarity-${cand.rarity.toLowerCase()}">${cand.rarity}</span>
                              <strong>${cand.name}</strong>
                              <span class="mfg-badge">${cand.species}</span>
                            </div>
                            <span class="crew-wage-tag">${cand.baseSalary} Cr/cycle</span>
                          </div>
                          <div class="crew-specialties-row">
                            ${cand.specialties.map((sp: string) => `<span class="crew-spec-pill">${sp}</span>`).join('')}
                            <span class="crew-trait-tag" title="${cand.traitDesc}">✦ ${cand.traitLabel}</span>
                          </div>
                          <div class="crew-stats-row">
                            <span>Aptitude: <strong>${cand.aptitude}</strong></span>
                            <span>Grit: <strong>${cand.grit}</strong></span>
                            <span>Efficiency: <strong>${cand.efficiency}</strong></span>
                            <span>${cand.factionId.replace('FACTION_', '')}</span>
                          </div>
                          <div class="crew-actions-row">
                            <button class="crew-action-btn success btn-crew-hire" data-listing-id="${cand.listingId}">
                              RECRUIT SPECIALIST (${cand.hiringFee.toLocaleString()} Cr)
                            </button>
                          </div>
                        </div>
                      `
                    )
                    .join('')
            }
          </div>
        </div>
      </div>
    `;

    this.bindCrewTabEvents(container);
  }

  private bindCrewTabEvents(container: HTMLElement): void {
    container.querySelector('#btn-crew-settle-cycle')?.addEventListener('click', async () => {
      await this.settleCycle();
    });
    container.querySelector('#btn-crew-refresh-market')?.addEventListener('click', async () => {
      await this.refreshMarket();
    });

    container.querySelectorAll('.btn-crew-hire').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const listingId = (btn as HTMLElement).dataset.listingId;
        if (listingId) await this.hireCandidate(listingId);
      });
    });

    container.querySelectorAll('.btn-assign-bay').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const el = btn as HTMLElement;
        await this.assignCrew(el.dataset.crewId!, 'SHIP_BAY', el.dataset.baySlot);
      });
    });

    container.querySelectorAll('.btn-crew-to-reserve').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const crewId = (btn as HTMLElement).dataset.crewId!;
        await this.assignCrew(crewId, 'RESERVE');
      });
    });

    container.querySelectorAll('.btn-crew-broker').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const crewId = (btn as HTMLElement).dataset.crewId!;
        await this.brokerCrew(crewId);
      });
    });
  }

  public async hireCandidate(
    listingId: string,
    overrideSource?: { type: 'STARPORT' | 'COLONY'; id: string }
  ): Promise<boolean> {
    const accountId = this.callbacks.getAccountId();
    const sType = overrideSource?.type || this.marketSourceType;
    const sId = overrideSource?.id || this.marketSourceId;
    try {
      const res = await fetch('/api/crew/hire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          listingId,
          sourceType: sType,
          sourceId: sId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Hiring failed'}`, true);
        return false;
      }
      this.callbacks.audio.playLootPickupSound();
      this.callbacks.showApNotification(
        `👤 Recruited ${data.crewMember.name} (${data.crewMember.rarity} ${data.crewMember.specialties.join('/')})`,
        false
      );
      this.callbacks.refreshPlayerHold();
      await this.loadCrewTab();
      return true;
    } catch (err) {
      console.error('[CrewController] Hire failed:', err);
      return false;
    }
  }

  public async refreshMarket(): Promise<void> {
    const accountId = this.callbacks.getAccountId();
    try {
      const res = await fetch('/api/crew/market/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Market refresh failed'}`, true);
        return;
      }
      this.callbacks.audio.playUiBlip();
      this.callbacks.showApNotification('📋 Posted fresh Specialist hiring slate (-75 Cr)', false);
      this.callbacks.refreshPlayerHold();
      await this.loadCrewTab({ type: this.marketSourceType, id: this.marketSourceId });
    } catch (err) {
      console.error('[CrewController] Market refresh failed:', err);
    }
  }

  public async assignCrew(
    crewId: string,
    assignmentType: 'RESERVE' | 'SHIP_BAY' | 'COLONY',
    baySlotKey?: string,
    colonyId?: string,
    moduleKey?: string
  ): Promise<boolean> {
    const accountId = this.callbacks.getAccountId();
    try {
      const res = await fetch('/api/crew/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          crewId,
          assignmentType,
          baySlotKey,
          colonyId,
          moduleKey,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Assignment failed'}`, true);
        return false;
      }
      this.callbacks.audio.playUiBlip();
      this.callbacks.showApNotification('✅ Specialist station assignment updated', false);
      await this.loadCrewTab();
      return true;
    } catch (err) {
      console.error('[CrewController] Assign failed:', err);
      return false;
    }
  }

  public async brokerCrew(crewId: string): Promise<void> {
    const accountId = this.callbacks.getAccountId();
    try {
      const res = await fetch('/api/crew/broker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, crewId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Brokerage failed'}`, true);
        return;
      }
      this.callbacks.audio.playLootPickupSound();
      this.callbacks.showApNotification(
        `💼 Brokered ${data.releasedName}'s service contract (+${data.payoutCredits} Cr)`,
        false
      );
      this.callbacks.refreshPlayerHold();
      await this.loadCrewTab();
    } catch (err) {
      console.error('[CrewController] Broker failed:', err);
    }
  }

  public async settleCycle(): Promise<void> {
    const accountId = this.callbacks.getAccountId();
    try {
      const res = await fetch('/api/crew/settle-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Payroll settlement failed'}`, true);
        return;
      }
      this.callbacks.audio.playUiBlip();
      const msg = data.paidInFull
        ? `💳 Payroll settled: Gross ${data.grossSalary} Cr − Colony Subsidy ${data.colonySubsidy} Cr = Net ${data.netPaid} Cr`
        : `⚠️ Payroll in arrears (${data.arrearsCycles} cycles)! Net due exceeded credits.`;
      this.callbacks.showApNotification(msg, !data.paidInFull);
      this.callbacks.refreshPlayerHold();
      await this.loadCrewTab();
    } catch (err) {
      console.error('[CrewController] Payroll settle failed:', err);
    }
  }
}
