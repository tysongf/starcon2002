import { getFactionEntry } from '../../shared/FactionRegistry';

export interface FleetContext {
  getAccountId: () => string;
  showNotification?: (msg: string, isError?: boolean) => void;
  playUiBlip?: () => void;
  onFleetUpdated?: () => void;
}

export class FleetController {
  private ctx: FleetContext;

  public viewTabFleet: HTMLElement | null = null;
  public tabBtnFleet: HTMLElement | null = null;
  public fleetBridgeBadge: HTMLElement | null = null;
  public fleetBridgeTitle: HTMLElement | null = null;
  public fleetBridgeSubtext: HTMLElement | null = null;
  public fleetUpkeepVal: HTMLElement | null = null;
  public activeWingmenGrid: HTMLElement | null = null;
  public reserveHangarList: HTMLElement | null = null;

  // Day 33: Orbital Shipyard Subview Elements
  public btnSubtabRoster: HTMLElement | null = null;
  public btnSubtabShipyard: HTMLElement | null = null;
  public fleetSubviewRoster: HTMLElement | null = null;
  public fleetSubviewShipyard: HTMLElement | null = null;
  public shipyardBlueprintsGrid: HTMLElement | null = null;
  public shipyardDiscountPill: HTMLElement | null = null;

  public rosterData: any = null;
  public shipyardData: any = null;
  public activeSubtab: 'roster' | 'shipyard' = 'roster';

  constructor(ctx: FleetContext) {
    this.ctx = ctx;
    this.initDOM();
  }

  private initDOM(): void {
    this.viewTabFleet = document.getElementById('view-tab-fleet');
    this.tabBtnFleet = document.getElementById('tab-btn-fleet');
    this.fleetBridgeBadge = document.getElementById('fleet-bridge-badge');
    this.fleetBridgeTitle = document.getElementById('fleet-bridge-title');
    this.fleetBridgeSubtext = document.getElementById('fleet-bridge-subtext');
    this.fleetUpkeepVal = document.getElementById('fleet-upkeep-val');
    this.activeWingmenGrid = document.getElementById('active-wingmen-grid');
    this.reserveHangarList = document.getElementById('reserve-hangar-list');

    // Day 33: Sub-tabs
    this.btnSubtabRoster = document.getElementById('btn-subtab-roster');
    this.btnSubtabShipyard = document.getElementById('btn-subtab-shipyard');
    this.fleetSubviewRoster = document.getElementById('fleet-subview-roster');
    this.fleetSubviewShipyard = document.getElementById('fleet-subview-shipyard');
    this.shipyardBlueprintsGrid = document.getElementById('shipyard-blueprints-grid');
    this.shipyardDiscountPill = document.getElementById('shipyard-discount-pill');

    this.btnSubtabRoster?.addEventListener('click', () => this.switchFleetSubtab('roster'));
    this.btnSubtabShipyard?.addEventListener('click', () => this.switchFleetSubtab('shipyard'));
  }

  public switchFleetSubtab(subtab: 'roster' | 'shipyard'): void {
    this.activeSubtab = subtab;
    this.ctx.playUiBlip?.();

    this.btnSubtabRoster?.classList.toggle('active', subtab === 'roster');
    this.btnSubtabShipyard?.classList.toggle('active', subtab === 'shipyard');

    this.fleetSubviewRoster?.classList.toggle('hidden', subtab !== 'roster');
    this.fleetSubviewShipyard?.classList.toggle('hidden', subtab !== 'shipyard');

    if (subtab === 'shipyard') {
      this.loadShipyardData();
    } else {
      this.loadFleetData();
    }
  }

  public async loadFleetData(): Promise<void> {
    const accountId = this.ctx.getAccountId();
    try {
      const res = await fetch(`/api/fleet/roster?accountId=${encodeURIComponent(accountId)}`);
      if (res.ok) {
        const data = await res.json();
        this.rosterData = data;
        this.renderRoster(data);
      } else {
        const err = await res.json();
        this.ctx.showNotification?.(err.error || 'Failed to load fleet data', true);
      }
    } catch (err: any) {
      console.error('[FleetController] Failed to fetch fleet roster:', err);
    }
  }

  public renderRoster(roster: any): void {
    if (!roster) return;

    // 0. Update Active Flagship Banner (Milestone 1.2)
    if (roster.activeFlagship) {
      const f = roster.activeFlagship;
      const elClass = document.getElementById('flagship-banner-class');
      const elTitle = document.getElementById('flagship-banner-title');
      const elStats = document.getElementById('flagship-banner-stats');
      if (elClass) {
        elClass.textContent = `ACTIVE FLAGSHIP // ${f.mainHullClass} [${(f.factionId || '').replace('FACTION_', '')}]`;
      }
      if (elTitle) {
        elTitle.textContent = `${f.name} — ${f.hullSubtype}`;
      }
      if (elStats) {
        elStats.textContent =
          `SLOTS: ${f.slotLayout.high}H / ${f.slotLayout.mid}M / ${f.slotLayout.low}L • ` +
          `${f.powerGridMax} MW / ${f.cpuMax} tf • ` +
          `ARMOR ${f.armor}/${f.maxArmor} • SHIELD ${f.shield}/${f.maxShield} • ` +
          `CARGO ${f.cargoCapacity} m³ • FUEL ${f.fuel}/${f.maxFuel} • SPD ${f.baseSpeed}`;
      }
    }

    // 1. Update Command Bridge Telemetry
    if (this.fleetBridgeBadge) {
      this.fleetBridgeBadge.textContent = `COMMAND BRIDGE // TIER ${roster.bridgeTier}`;
    }
    if (this.fleetBridgeTitle) {
      this.fleetBridgeTitle.textContent = roster.bridgeModuleName || 'Standard Command Cockpit (Baseline)';
    }
    if (this.fleetBridgeSubtext) {
      const s = roster.maxWingmen === 1 ? '' : 'S';
      this.fleetBridgeSubtext.textContent = `MAX COMBAT ESCORTS: ${roster.maxWingmen} WINGMAN${s} (SLOT 1..${roster.maxWingmen})`;
    }
    if (this.fleetUpkeepVal) {
      this.fleetUpkeepVal.textContent = `${roster.upkeepPerCycle} Cr / cycle`;
    }

    // 2. Render Active Wingmen Slots (1..4)
    if (this.activeWingmenGrid) {
      this.activeWingmenGrid.innerHTML = '';

      for (let slot = 1; slot <= 4; slot++) {
        const isLocked = slot > roster.maxWingmen;
        const occupied = (roster.activeWingmen || []).find((s: any) => s.deploymentSlot === slot);

        const card = document.createElement('div');
        card.className = `wingman-slot-card ${isLocked ? 'locked-slot' : occupied ? 'occupied-slot' : 'empty-slot'}`;

        if (isLocked) {
          card.innerHTML = `
            <div class="slot-header">
              <span class="slot-number-badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border-color: rgba(239, 68, 68, 0.4);">
                🔒 SLOT ${slot} // LOCKED
              </span>
            </div>
            <div style="font-family: monospace; font-size: 0.78rem; color: #94a3b8; padding: 0.5rem 0;">
              Requires Command Bridge Mk.${slot === 2 ? 'II' : slot === 3 ? 'III' : 'IV'} (Tier ${slot}) outfitting upgrade to unlock this wingman channel.
            </div>
          `;
        } else if (occupied) {
          const factionColor = getFactionEntry(occupied.factionId).primaryColor;
          card.innerHTML = `
            <div class="slot-header">
              <span class="slot-number-badge">WINGMAN SLOT ${slot} // ACTIVE</span>
              <span class="ability-badge">⚡ ${occupied.specialAbility}</span>
            </div>
            <div class="slot-ship-name">${occupied.name}</div>
            <div class="slot-ship-meta">
              <span style="color: ${factionColor}; font-weight: bold;">[${occupied.factionId.replace('FACTION_', '')}]</span>
              <span>${occupied.hullClass}</span>
            </div>
            <div class="slot-stats-row">
              <div class="slot-stat-item">
                <span class="slot-stat-label">HULL</span>
                <span class="slot-stat-val" style="color: #4ade80;">${occupied.hull} / ${occupied.maxHull}</span>
              </div>
              <div class="slot-stat-item">
                <span class="slot-stat-label">SHIELD</span>
                <span class="slot-stat-val" style="color: #60a5fa;">${occupied.shield} / ${occupied.maxShield}</span>
              </div>
              <div class="slot-stat-item">
                <span class="slot-stat-label">SPEED</span>
                <span class="slot-stat-val">${occupied.speed} m/s</span>
              </div>
              <div class="slot-stat-item">
                <span class="slot-stat-label">FIREPOWER</span>
                <span class="slot-stat-val">${occupied.firepower} DPS</span>
              </div>
            </div>
            <div class="fleet-actions-row">
              <button class="hud-btn small-btn primary promote-btn" data-ship-id="${occupied.id}" data-ship-name="${occupied.name}">
                ★ SET AS FLAGSHIP
              </button>
              <button class="hud-btn small-btn recall-btn" data-ship-id="${occupied.id}">
                RECALL TO RESERVE
              </button>
            </div>
          `;

          const promoteBtn = card.querySelector('.promote-btn');
          promoteBtn?.addEventListener('click', () => this.promoteFlagship(occupied.id, occupied.name));
          const recallBtn = card.querySelector('.recall-btn');
          recallBtn?.addEventListener('click', () => this.assignSlot(occupied.id, null));
        } else {
          // Empty active slot
          const reserveOptions = (roster.reserveShips || [])
            .map((s: any) => `<option value="${s.id}">${s.name} (${s.hullClass})</option>`)
            .join('');

          card.innerHTML = `
            <div class="slot-header">
              <span class="slot-number-badge" style="background: rgba(148, 163, 184, 0.2); color: #cbd5e1; border-color: rgba(148, 163, 184, 0.4);">
                WINGMAN SLOT ${slot} // READY
              </span>
            </div>
            <div style="font-family: monospace; font-size: 0.78rem; color: #94a3b8; padding: 0.25rem 0;">
              No combat escort deployed to this tactical vector.
            </div>
            ${
              roster.reserveShips && roster.reserveShips.length > 0
                ? `
              <div class="fleet-actions-row">
                <select class="hud-select deploy-select" id="deploy-select-slot-${slot}">
                  ${reserveOptions}
                </select>
                <button class="hud-btn small-btn primary deploy-btn" data-slot="${slot}">
                  DEPLOY TO SLOT ${slot}
                </button>
              </div>
            `
                : `
              <div style="font-family: monospace; font-size: 0.72rem; color: #64748b; font-style: italic;">
                (No reserve ships available in hangar)
              </div>
            `
            }
          `;

          const deployBtn = card.querySelector('.deploy-btn');
          const deploySelect = card.querySelector(`#deploy-select-slot-${slot}`) as HTMLSelectElement | null;
          deployBtn?.addEventListener('click', () => {
            if (deploySelect?.value) {
              this.assignSlot(deploySelect.value, slot);
            }
          });
        }

        this.activeWingmenGrid.appendChild(card);
      }
    }

    // 3. Render Reserve Hangar List
    if (this.reserveHangarList) {
      this.reserveHangarList.innerHTML = '';

      if (!roster.reserveShips || roster.reserveShips.length === 0) {
        this.reserveHangarList.innerHTML = `
          <div style="padding: 1.5rem; text-align: center; font-family: monospace; color: #64748b; border: 1px dashed rgba(255,255,255,0.1); border-radius: 6px;">
            NO ESCORTS CURRENTLY IN HANGAR RESERVE
          </div>
        `;
      } else {
        for (const ship of roster.reserveShips) {
          const card = document.createElement('div');
          card.className = 'wingman-slot-card';
          const factionColor = getFactionEntry(ship.factionId).primaryColor;

          let slotOptions = '';
          for (let s = 1; s <= roster.maxWingmen; s++) {
            slotOptions += `<option value="${s}">Slot ${s}</option>`;
          }

          card.innerHTML = `
            <div class="slot-header">
              <span class="slot-number-badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border-color: rgba(148, 163, 184, 0.3);">
                HANGAR RESERVE
              </span>
              <span class="ability-badge">⚡ ${ship.specialAbility}</span>
            </div>
            <div class="slot-ship-name">${ship.name}</div>
            <div class="slot-ship-meta">
              <span style="color: ${factionColor}; font-weight: bold;">[${ship.factionId.replace('FACTION_', '')}]</span>
              <span>${ship.mainHullClass || ''} • ${ship.hullSubtype || ship.hullClass}</span>
            </div>
            <div class="slot-stats-row">
              <div class="slot-stat-item">
                <span class="slot-stat-label">SLOTS</span>
                <span class="slot-stat-val" style="color: #fbbf24;">${ship.slotLayout ? `${ship.slotLayout.high}H/${ship.slotLayout.mid}M/${ship.slotLayout.low}L` : '2H/2M/2L'}</span>
              </div>
              <div class="slot-stat-item">
                <span class="slot-stat-label">HULL / SHLD</span>
                <span class="slot-stat-val">${ship.hull}/${ship.maxHull} • ${ship.shield}</span>
              </div>
              <div class="slot-stat-item">
                <span class="slot-stat-label">PG / CPU</span>
                <span class="slot-stat-val">${ship.powerGridMax || 120}MW / ${ship.cpuMax || 180}tf</span>
              </div>
              <div class="slot-stat-item">
                <span class="slot-stat-label">CARGO / SPD</span>
                <span class="slot-stat-val">${ship.cargoCapacity || 50}m³ • ${ship.speed}</span>
              </div>
            </div>
            <div class="fleet-actions-row">
              <button class="hud-btn small-btn primary promote-reserve-btn" data-ship-id="${ship.id}" data-ship-name="${ship.name}">
                ★ SET AS FLAGSHIP
              </button>
              <select class="hud-select slot-picker" id="slot-picker-${ship.id}">
                ${slotOptions}
              </select>
              <button class="hud-btn small-btn deploy-reserve-btn" data-ship-id="${ship.id}">
                ASSIGN TO WING
              </button>
              <button class="hud-btn small-btn rename-btn" data-ship-id="${ship.id}" data-current-name="${ship.name}">
                RENAME
              </button>
              <button class="hud-btn small-btn danger scrap-btn" data-ship-id="${ship.id}" data-ship-name="${ship.name}">
                SCRAP (+200 Cr, +5 Alloys)
              </button>
            </div>
          `;

          const promoteReserveBtn = card.querySelector('.promote-reserve-btn');
          promoteReserveBtn?.addEventListener('click', () => {
            this.promoteFlagship(ship.id, ship.name);
          });

          const deployBtn = card.querySelector('.deploy-reserve-btn');
          const slotPicker = card.querySelector(`#slot-picker-${ship.id}`) as HTMLSelectElement | null;
          deployBtn?.addEventListener('click', () => {
            const slotNum = parseInt(slotPicker?.value || '1', 10);
            this.assignSlot(ship.id, slotNum);
          });

          const renameBtn = card.querySelector('.rename-btn');
          renameBtn?.addEventListener('click', () => {
            this.promptRename(ship.id, ship.name);
          });

          const scrapBtn = card.querySelector('.scrap-btn');
          scrapBtn?.addEventListener('click', () => {
            this.confirmScrap(ship.id, ship.name);
          });

          this.reserveHangarList.appendChild(card);
        }
      }
    }
  }

  public async assignSlot(fleetShipId: string, slot: number | null): Promise<void> {
    const accountId = this.ctx.getAccountId();
    this.ctx.playUiBlip?.();
    try {
      const res = await fetch('/api/fleet/assign-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, fleetShipId, slot }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.rosterData = data;
        this.renderRoster(data);
        this.ctx.showNotification?.(slot ? `Escort deployed to Wingman Slot ${slot}.` : `Escort recalled to Hangar Reserve.`);
        this.ctx.onFleetUpdated?.();
      } else {
        this.ctx.showNotification?.(data.error || 'Failed to update deployment slot.', true);
      }
    } catch (err: any) {
      console.error('[FleetController] Failed to assign slot:', err);
    }
  }

  public async promptRename(fleetShipId: string, currentName: string): Promise<void> {
    const newName = prompt('Enter new callsign for escort ship:', currentName);
    if (!newName || newName.trim() === currentName) return;

    const accountId = this.ctx.getAccountId();
    try {
      const res = await fetch('/api/fleet/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, fleetShipId, name: newName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.ctx.showNotification?.(`Escort rechristened as "${newName.trim()}".`);
        await this.loadFleetData();
        this.ctx.onFleetUpdated?.();
      } else {
        this.ctx.showNotification?.(data.error || 'Failed to rename ship.', true);
      }
    } catch (err: any) {
      console.error('[FleetController] Failed to rename ship:', err);
    }
  }

  public async confirmScrap(fleetShipId: string, shipName: string): Promise<void> {
    const ok = confirm(`Scrap "${shipName}" for 200 Credits and 5 Plasteel Alloys? This action is permanent.`);
    if (!ok) return;

    const accountId = this.ctx.getAccountId();
    try {
      const res = await fetch('/api/fleet/scrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, fleetShipId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.ctx.showNotification?.(`Scrapped "${shipName}": +${data.creditsRecovered} Cr, +${data.alloysRecovered} Plasteel Alloys.`);
        await this.loadFleetData();
        this.ctx.onFleetUpdated?.();
      } else {
        this.ctx.showNotification?.(data.error || 'Failed to scrap ship.', true);
      }
    } catch (err: any) {
      console.error('[FleetController] Failed to scrap ship:', err);
    }
  }

  // =========================================================================
  // Milestone 1.3: Unified Flagship Swap & 64-Hull Starship Foundry (8x8)
  // =========================================================================

  private selectedHullClassFilter: string = 'ALL';
  private selectedHullFactionFilter: string = 'ALL';

  public async promoteFlagship(fleetShipId: string, shipName?: string): Promise<void> {
    const accountId = this.ctx.getAccountId();
    this.ctx.playUiBlip?.();
    try {
      const res = await fetch('/api/fleet/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, fleetShipId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.rosterData = data.roster;
        this.renderRoster(data.roster);
        const unfittedCount = (data.unfittedModules || []).length;
        const unfittedNote =
          unfittedCount > 0 ? ` (${unfittedCount} overflow module(s) returned to Locker)` : '';
        this.ctx.showNotification?.(
          `★ Flagship Transferred to "${data.activeFlagship?.name || shipName || 'New Vessel'}"${unfittedNote}`
        );
        this.ctx.onFleetUpdated?.();
      } else {
        this.ctx.showNotification?.(data.error || 'Flagship promotion failed.', true);
      }
    } catch (err: any) {
      console.error('[FleetController] Failed to promote flagship:', err);
    }
  }

  public async loadShipyardData(colonyId?: string): Promise<void> {
    const accountId = this.ctx.getAccountId();
    try {
      let url = `/api/shipyard/hulls?accountId=${encodeURIComponent(accountId)}`;
      if (colonyId) url += `&colonyId=${encodeURIComponent(colonyId)}`;

      const [res, relicRes] = await Promise.all([
        fetch(url),
        fetch('/api/raids/relics').catch(() => null),
      ]);
      if (res.ok) {
        const data = await res.json();
        if (relicRes && relicRes.ok) {
          const rData = await relicRes.json();
          const unlockedSet = new Set(
            (rData.relics || []).filter((rl: any) => Number(rl.chargesRemaining ?? 1) > 0).map((rl: any) => rl.blueprintId)
          );
          const relicHulls = (rData.availableHullBlueprints || []).map((rh: any) => {
            const hasPermit = unlockedSet.has(rh.hullClass);
            const missing = [...(hasPermit ? [] : ['REQUIRES DREADNOUGHT RELIC PERMIT'])];
            return {
              ...rh,
              effectiveCreditCost: rh.creditCost,
              effectiveApCost: rh.apCost,
              effectiveAlloyCost: rh.alloyCost,
              effectiveOreCost: rh.oreCost,
              effectiveFuelCost: rh.fuelCost,
              hasReputation: true,
              canAfford: hasPermit && (data.credits ?? 0) >= rh.creditCost,
              missingRequirements: missing,
            };
          });
          data.hulls = [...(data.hulls || []), ...relicHulls];
        }
        this.shipyardData = data;
        this.bindHullFilterButtons(colonyId);
        this.renderShipyard(data, colonyId);
      } else {
        const err = await res.json();
        this.ctx.showNotification?.(err.error || 'Failed to load shipyard hulls', true);
      }
    } catch (err: any) {
      console.error('[FleetController] Failed to load shipyard data:', err);
    }
  }

  private bindHullFilterButtons(colonyId?: string): void {
    const filterBar = document.getElementById('shipyard-class-filters');
    if (filterBar && filterBar.dataset.bound !== '1') {
      filterBar.dataset.bound = '1';
      filterBar.querySelectorAll('.hull-filter-btn').forEach((btn) => {
        btn.addEventListener('click', (ev) => {
          const target = ev.currentTarget as HTMLElement;
          this.selectedHullClassFilter = target.dataset.class || 'ALL';
          filterBar.querySelectorAll('.hull-filter-btn').forEach((b) => b.classList.remove('active', 'primary'));
          target.classList.add('active', 'primary');
          if (this.shipyardData) {
            this.renderShipyard(this.shipyardData, colonyId);
          }
        });
      });
    }

    const factionSelect = document.getElementById('shipyard-faction-filter') as HTMLSelectElement | null;
    if (factionSelect && factionSelect.dataset.bound !== '1') {
      factionSelect.dataset.bound = '1';
      factionSelect.addEventListener('change', (ev) => {
        this.selectedHullFactionFilter = (ev.currentTarget as HTMLSelectElement).value || 'ALL';
        if (this.shipyardData) {
          this.renderShipyard(this.shipyardData, colonyId);
        }
      });
    }
  }

  public renderShipyard(data: any, colonyId?: string): void {
    if (!data || !this.shipyardBlueprintsGrid) return;

    if (this.shipyardDiscountPill) {
      this.shipyardDiscountPill.classList.toggle('hidden', !data.isColonyShipyard);
    }

    this.shipyardBlueprintsGrid.innerHTML = '';

    const allHulls = data.hulls || data.blueprints || [];
    const filteredHulls = allHulls.filter((h: any) => {
      if (this.selectedHullClassFilter !== 'ALL' && h.mainClass !== this.selectedHullClassFilter) {
        return false;
      }
      if (this.selectedHullFactionFilter !== 'ALL' && h.factionId !== this.selectedHullFactionFilter) {
        return false;
      }
      return true;
    });

    for (const bp of filteredHulls) {
      const card = document.createElement('div');
      card.className = `blueprint-card ${!bp.canAfford ? 'locked' : ''}`;

      const fac = getFactionEntry(bp.factionId);
      const factionColor = fac.primaryColor;

      const missingText = (bp.missingRequirements || []).join(' • ');
      const slotsLabel = `${bp.highSlots}H / ${bp.midSlots}M / ${bp.lowSlots}L`;

      card.innerHTML = `
        <div class="blueprint-header">
          <div>
            <div class="blueprint-title">${bp.displayName || bp.name}</div>
            <div style="font-family: monospace; font-size: 0.75rem; color: ${factionColor}; font-weight: bold;">
              ${fac.crestIcon} [${fac.shortName}] • ${bp.mainClass} (T${bp.tier})
            </div>
          </div>
          <span class="ability-badge" style="color: #fbbf24;">SLOTS: ${slotsLabel}</span>
        </div>

        <p style="font-size: 0.78rem; color: #94a3b8; margin: 0; line-height: 1.3;">
          ${bp.description}
        </p>

        <div class="slot-stats-row">
          <div class="slot-stat-item">
            <span class="slot-stat-label">ARMOR / SHLD</span>
            <span class="slot-stat-val" style="color: #4ade80;">${bp.baseArmor} / ${bp.baseShield}</span>
          </div>
          <div class="slot-stat-item">
            <span class="slot-stat-label">PG / CPU</span>
            <span class="slot-stat-val" style="color: #60a5fa;">${bp.powerGridMax}MW / ${bp.cpuMax}tf</span>
          </div>
          <div class="slot-stat-item">
            <span class="slot-stat-label">CARGO / FUEL</span>
            <span class="slot-stat-val">${bp.cargoCapacity}m³ / ${bp.maxFuel}u</span>
          </div>
          <div class="slot-stat-item">
            <span class="slot-stat-label">SPD / TURN</span>
            <span class="slot-stat-val">${bp.baseSpeed} / ${bp.baseTurnRate}</span>
          </div>
        </div>

        <div class="bom-checklist">
          <div class="bom-item">
            <span class="bom-label">CREDITS</span>
            <span class="bom-val">${bp.effectiveCreditCost} Cr</span>
          </div>
          <div class="bom-item">
            <span class="bom-label">ACTION PTS</span>
            <span class="bom-val">${bp.effectiveApCost} AP</span>
          </div>
          <div class="bom-item">
            <span class="bom-label">PLASTEEL</span>
            <span class="bom-val">${bp.effectiveAlloyCost} Alloy</span>
          </div>
          <div class="bom-item">
            <span class="bom-label">SILICATE</span>
            <span class="bom-val">${bp.effectiveOreCost} Ore</span>
          </div>
          <div class="bom-item">
            <span class="bom-label">DEUTERIUM</span>
            <span class="bom-val">${bp.effectiveFuelCost} Fuel</span>
          </div>
          <div class="bom-item">
            <span class="bom-label">REQ. STANDING</span>
            <span class="bom-val" style="color: ${bp.hasReputation ? '#4ade80' : '#f87171'};">+${bp.requiredReputation}</span>
          </div>
        </div>

        ${
          !bp.canAfford
            ? `
          <div style="font-family: monospace; font-size: 0.72rem; color: #f87171; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 4px; padding: 0.35rem 0.5rem;">
            ⚠️ ${missingText}
          </div>
        `
            : ''
        }

        <div class="fleet-actions-row">
          <input type="text" class="hud-input name-input" id="hull-name-${bp.hullClass}" placeholder="${bp.displayName}" style="flex: 1; font-size: 0.78rem;" />
          <button class="hud-btn small-btn fabricate-btn" data-hull-class="${bp.hullClass}" data-promote="false" ${!bp.canAfford ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
            COMMISSION
          </button>
          <button class="hud-btn primary small-btn fabricate-fly-btn" data-hull-class="${bp.hullClass}" data-promote="true" ${!bp.canAfford ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
            ★ COMMISSION & FLY
          </button>
        </div>
      `;

      const nameInput = card.querySelector(`#hull-name-${bp.hullClass}`) as HTMLInputElement | null;
      card.querySelector('.fabricate-btn')?.addEventListener('click', () => {
        const customName = nameInput?.value?.trim() || bp.displayName;
        this.commissionHull(bp.hullClass, customName, colonyId, false);
      });
      card.querySelector('.fabricate-fly-btn')?.addEventListener('click', () => {
        const customName = nameInput?.value?.trim() || bp.displayName;
        this.commissionHull(bp.hullClass, customName, colonyId, true);
      });

      this.shipyardBlueprintsGrid.appendChild(card);
    }
  }

  public async commissionHull(
    hullClass: string,
    customName?: string,
    colonyId?: string,
    promoteImmediately: boolean = false
  ): Promise<void> {
    const accountId = this.ctx.getAccountId();
    this.ctx.playUiBlip?.();
    try {
      const res = await fetch('/api/shipyard/hulls/commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, hullClass, customName, colonyId, promoteImmediately }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.promoted) {
          this.ctx.showNotification?.(`★ Commissioned & Promoted "${customName || hullClass}" as Active Flagship!`);
        } else if (data.promotionWarning) {
          this.ctx.showNotification?.(`Commissioned "${data.ship?.name}" into Hangar (${data.promotionWarning})`, true);
        } else {
          this.ctx.showNotification?.(`Commissioned "${data.ship?.name}" into Fleet Hangar!`);
        }
        this.ctx.onFleetUpdated?.();
        await this.loadShipyardData(colonyId);
        this.switchFleetSubtab('roster');
      } else {
        this.ctx.showNotification?.(data.error || 'Commission failed.', true);
      }
    } catch (err: any) {
      console.error('[FleetController] Failed to commission hull:', err);
    }
  }
}
