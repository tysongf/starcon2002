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

  public rosterData: any = null;

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
          const factionColor = occupied.factionId === 'FACTION_SOL' ? '#38bdf8' : occupied.factionId === 'FACTION_KRYLL' ? '#fbbf24' : '#f87171';
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
              <button class="hud-btn small-btn recall-btn" data-ship-id="${occupied.id}">
                RECALL TO RESERVE
              </button>
            </div>
          `;

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
          const factionColor = ship.factionId === 'FACTION_SOL' ? '#38bdf8' : ship.factionId === 'FACTION_KRYLL' ? '#fbbf24' : '#f87171';

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
              <span>${ship.hullClass}</span>
            </div>
            <div class="slot-stats-row">
              <div class="slot-stat-item">
                <span class="slot-stat-label">HULL</span>
                <span class="slot-stat-val">${ship.hull} / ${ship.maxHull}</span>
              </div>
              <div class="slot-stat-item">
                <span class="slot-stat-label">SHIELD</span>
                <span class="slot-stat-val">${ship.shield} / ${ship.maxShield}</span>
              </div>
              <div class="slot-stat-item">
                <span class="slot-stat-label">SPEED</span>
                <span class="slot-stat-val">${ship.speed} m/s</span>
              </div>
              <div class="slot-stat-item">
                <span class="slot-stat-label">FIREPOWER</span>
                <span class="slot-stat-val">${ship.firepower} DPS</span>
              </div>
            </div>
            <div class="fleet-actions-row">
              <select class="hud-select slot-picker" id="slot-picker-${ship.id}">
                ${slotOptions}
              </select>
              <button class="hud-btn small-btn primary deploy-reserve-btn" data-ship-id="${ship.id}">
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
}
