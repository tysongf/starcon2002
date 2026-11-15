import { AudioEngine } from '../audio/AudioEngine';
import { apiClient } from '../network/ApiClient';

export interface OutfittingControllerCallbacks {
  audio: AudioEngine;
  showApNotification: (msg: string, isError?: boolean) => void;
  getCurrentSectorId: () => number;
  getPlayerCredits: () => number;
  setPlayerCredits: (credits: number) => void;
  refreshPlayerHold: () => Promise<void>;
  onLoadoutUpdated?: (loadout: any) => void;
}

/**
 * Encapsulates Station Outfitting Bay, variable hull paperdoll hardpoints,
 * Engineering Reforging/Upgrade Workbench, and Armory Storefront.
 */
export class OutfittingController {
  private audio: AudioEngine;
  private callbacks: OutfittingControllerCallbacks;

  public playerLoadout: any = null;
  public equipmentCatalog: any[] = [];
  public isLoadoutOverBudget: boolean = false;

  private workbenchSelectedItemId: string | null = null;
  private workbenchLockedAffixIndex: number | null = null;
  private workbenchCostCache: Record<string, any> | null = null;

  private valFittingPg: HTMLElement | null = null;
  private valFittingCpu: HTMLElement | null = null;
  private barFittingPg: HTMLElement | null = null;
  private barFittingCpu: HTMLElement | null = null;
  private fittingOverbudgetAlert: HTMLElement | null = null;
  private paperdollSlotsList: HTMLElement | null = null;
  private lockerModulesList: HTMLElement | null = null;
  private lockerItemCount: HTMLElement | null = null;

  private elArmoryCatalogGrid: HTMLElement | null = null;
  private elArmoryProceduralShopGrid: HTMLElement | null = null;
  private elArmoryPlayerCredits: HTMLElement | null = null;

  private elSlotHigh1: HTMLElement | null = null;
  private elSlotHigh2: HTMLElement | null = null;
  private elSlotHigh3: HTMLElement | null = null;
  private elSlotMid1: HTMLElement | null = null;
  private elSlotMid2: HTMLElement | null = null;
  private elSlotMid3: HTMLElement | null = null;
  private elSlotLow1: HTMLElement | null = null;
  private elSlotLow2: HTMLElement | null = null;
  private elSlotLow3: HTMLElement | null = null;

  constructor(callbacks: OutfittingControllerCallbacks) {
    this.audio = callbacks.audio;
    this.callbacks = callbacks;
    this.bindDOM();
  }

  private bindDOM(): void {
    this.valFittingPg = document.getElementById('val-fitting-pg');
    this.valFittingCpu = document.getElementById('val-fitting-cpu');
    this.barFittingPg = document.getElementById('bar-fitting-pg');
    this.barFittingCpu = document.getElementById('bar-fitting-cpu');
    this.fittingOverbudgetAlert = document.getElementById('fitting-overbudget-alert');
    this.paperdollSlotsList = document.getElementById('paperdoll-slots-list');
    this.lockerModulesList = document.getElementById('locker-modules-list');
    this.lockerItemCount = document.getElementById('locker-item-count');

    this.elArmoryCatalogGrid = document.getElementById('armory-catalog-grid');
    this.elArmoryProceduralShopGrid = document.getElementById('armory-procedural-shop-grid');
    this.elArmoryPlayerCredits = document.getElementById('armory-player-credits');

    this.elSlotHigh1 = document.getElementById('slot-high-1');
    this.elSlotHigh2 = document.getElementById('slot-high-2');
    this.elSlotHigh3 = document.getElementById('slot-high-3');
    this.elSlotMid1 = document.getElementById('slot-mid-1');
    this.elSlotMid2 = document.getElementById('slot-mid-2');
    this.elSlotMid3 = document.getElementById('slot-mid-3');
    this.elSlotLow1 = document.getElementById('slot-low-1');
    this.elSlotLow2 = document.getElementById('slot-low-2');
    this.elSlotLow3 = document.getElementById('slot-low-3');
  }

  public async loadOutfittingData(): Promise<void> {
    const accountId = apiClient.getAccountId();
    if (!accountId) return;

    try {
      const res = await fetch(`/api/outfitting/player?playerId=${encodeURIComponent(accountId)}`);
      if (!res.ok) return;
      const data = await res.json();
      this.playerLoadout = data;
      this.callbacks.onLoadoutUpdated?.(data);

      const { fitted, locker, powerGridMax, powerGridUsed, cpuMax, cpuUsed } = data;
      const loadout = fitted || {};
      const lockerList = locker || [];
      const layout = data.slotLayout || { high: 2, mid: 2, low: 2, bay: 2 };
      const bayCount = Number(layout.bay ?? 2);
      const techComponents = Number(data.techComponents ?? 25);

      const elHullBadge = document.getElementById('outfitting-hull-badge');
      const elHullName = document.getElementById('outfitting-hull-name');
      const elTechComp = document.getElementById('outfitting-tech-components');
      const elOutfitCredits = document.getElementById('outfitting-player-credits');
      if (elHullBadge) {
        elHullBadge.textContent = `${data.mainHullClass || data.shipClass} // ${layout.high}H • ${layout.mid}M • ${layout.low}L • ${bayCount} BAY`;
      }
      if (elHullName) {
        elHullName.textContent = `${data.flagshipName || 'UNS Endeavour'} — ${data.hullSubtype || data.shipClass}`;
      }
      if (elTechComp) {
        elTechComp.textContent = `${techComponents} Comp`;
      }
      if (elOutfitCredits) {
        elOutfitCredits.textContent = `${this.callbacks.getPlayerCredits().toLocaleString()} Cr`;
      }

      // Sync HUD Hotbar Slot Visibility with Active Flagship Slot Layout
      this.elSlotHigh1?.classList.toggle('hidden', layout.high < 1);
      this.elSlotHigh2?.classList.toggle('hidden', layout.high < 2);
      this.elSlotHigh3?.classList.toggle('hidden', layout.high < 3);
      this.elSlotMid1?.classList.toggle('hidden', layout.mid < 1);
      this.elSlotMid2?.classList.toggle('hidden', layout.mid < 2);
      this.elSlotMid3?.classList.toggle('hidden', layout.mid < 3);
      this.elSlotLow1?.classList.toggle('hidden', layout.low < 1);
      this.elSlotLow2?.classList.toggle('hidden', layout.low < 2);
      this.elSlotLow3?.classList.toggle('hidden', layout.low < 3);

      const pgMax = powerGridMax || 120;
      const cpuMaxVal = cpuMax || 180;
      const totalPg = Number(powerGridUsed) || 0;
      const totalCpu = Number(cpuUsed) || 0;
      const pgPct = Math.min(100, (totalPg / pgMax) * 100);
      const cpuPct = Math.min(100, (totalCpu / cpuMaxVal) * 100);

      this.isLoadoutOverBudget = totalPg > pgMax || totalCpu > cpuMaxVal;

      if (this.valFittingPg) {
        this.valFittingPg.textContent = `${totalPg.toFixed(1)} / ${pgMax.toFixed(1)} MW (${pgPct.toFixed(1)}%)`;
        this.valFittingPg.style.color = totalPg > pgMax ? '#ef4444' : '#f8fafc';
      }
      if (this.barFittingPg) {
        this.barFittingPg.style.width = `${Math.min(100, pgPct)}%`;
        this.barFittingPg.classList.toggle('over-budget', totalPg > pgMax);
      }

      if (this.valFittingCpu) {
        this.valFittingCpu.textContent = `${totalCpu.toFixed(1)} / ${cpuMaxVal.toFixed(1)} tf (${cpuPct.toFixed(1)}%)`;
        this.valFittingCpu.style.color = totalCpu > cpuMaxVal ? '#ef4444' : '#f8fafc';
      }
      if (this.barFittingCpu) {
        this.barFittingCpu.style.width = `${Math.min(100, cpuPct)}%`;
        this.barFittingCpu.classList.toggle('over-budget', totalCpu > cpuMaxVal);
      }

      if (this.fittingOverbudgetAlert) {
        this.fittingOverbudgetAlert.classList.toggle('hidden', !this.isLoadoutOverBudget);
      }

      if (this.paperdollSlotsList) {
        this.paperdollSlotsList.innerHTML = '';
        const slots: Array<{ slot: string; cat: 'HIGH' | 'MID' | 'LOW' | 'BAY' }> = [];
        for (let i = 1; i <= layout.high; i++) slots.push({ slot: `H${i}`, cat: 'HIGH' });
        for (let i = 1; i <= layout.mid; i++) slots.push({ slot: `M${i}`, cat: 'MID' });
        for (let i = 1; i <= layout.low; i++) slots.push({ slot: `L${i}`, cat: 'LOW' });
        for (let i = 1; i <= bayCount; i++) slots.push({ slot: `B${i}`, cat: 'BAY' });

        for (const s of slots) {
          const item = loadout[s.slot];
          const card = document.createElement('div');
          const catClass = s.cat.toLowerCase();

          if (item) {
            const rarity = item.rarity ? item.rarity.toLowerCase() : 'common';
            card.className = `paperdoll-slot-card rarity-${rarity}`;
            const mfg = item.manufacturer ? `<span class="mfg-badge">${item.manufacturer}</span>` : '';
            const subTag = item.subtype
              ? `<span class="mfg-badge" style="border-color:#38bdf8;color:#7dd3fc;">${item.mainCategory || ''} • ${item.subtype}</span>`
              : '';
            const affixesText =
              item.affixes && item.affixes.length > 0
                ? item.affixes.map((a: any) => a.label || a.description || `${a.stat}: x${a.multiplier}`).join(' • ')
                : '';
            const pgCost = item.powerGridCost ?? item.power_grid_cost ?? 0;
            const cpuCost = item.cpuCost ?? item.cpu_cost ?? 0;

            card.innerHTML = `
              <div class="slot-tag-badge ${catClass}">[${s.slot}]</div>
              <div class="slot-info-block">
                <div class="slot-item-name">${item.customName || item.name} ${subTag} ${mfg}</div>
                <div class="slot-item-sub">
                  <span>⚡ ${pgCost} MW</span>
                  <span>🧠 ${cpuCost} tf</span>
                </div>
                ${affixesText ? `<div class="slot-item-stats">${affixesText}</div>` : ''}
              </div>
              <button class="unfit-btn-small" data-slot="${s.slot}">UNFIT</button>
            `;
            card.querySelector('.unfit-btn-small')?.addEventListener('click', () => this.unfitModule(s.slot));
          } else {
            card.className = 'paperdoll-slot-card empty-slot';
            card.innerHTML = `
              <div class="slot-tag-badge ${catClass}">[${s.slot}]</div>
              <div class="slot-info-block">
                <span class="slot-empty-notice">EMPTY ${s.cat} SOCKET // READY FOR INSTALLATION</span>
              </div>
            `;
          }
          this.paperdollSlotsList.appendChild(card);
        }
      }

      if (this.lockerModulesList) {
        this.lockerModulesList.innerHTML = '';
        if (this.lockerItemCount) {
          this.lockerItemCount.textContent = `${lockerList.length} UNFITTED MODULES`;
        }

        if (lockerList.length === 0) {
          this.lockerModulesList.innerHTML =
            '<div class="slot-empty-notice" style="padding: 1.5rem; text-align: center;">Station locker empty. Acquire modules from Armory or recover orbital loot containers.</div>';
        } else {
          for (const mod of lockerList) {
            const card = document.createElement('div');
            const rarity = mod.rarity ? mod.rarity.toLowerCase() : 'common';
            card.className = `locker-module-card rarity-${rarity}`;

            const mfg = mod.manufacturer ? `<span class="mfg-badge">${mod.manufacturer}</span>` : '';
            const subTag = mod.subtype
              ? `<span class="mfg-badge" style="border-color:#38bdf8;color:#7dd3fc;">${mod.mainCategory || ''} • ${mod.subtype}</span>`
              : '';
            const cat = mod.slotType || mod.slot_type || 'HIGH';
            const affixesText =
              mod.affixes && mod.affixes.length > 0
                ? mod.affixes.map((a: any) => a.label || a.description || `${a.stat}: x${a.multiplier}`).join(' • ')
                : '';

            const pgCost = mod.powerGridCost ?? mod.power_grid_cost ?? 0;
            const cpuCost = mod.cpuCost ?? mod.cpu_cost ?? 0;

            const prefix = cat === 'HIGH' ? 'H' : cat === 'MID' ? 'M' : cat === 'BAY' ? 'B' : 'L';
            const slotCount = cat === 'HIGH' ? layout.high : cat === 'MID' ? layout.mid : cat === 'BAY' ? bayCount : layout.low;
            let fitButtonsHtml = '';
            for (let i = 1; i <= slotCount; i++) {
              const sId = `${prefix}${i}`;
              fitButtonsHtml += `<button class="fit-btn-small" data-id="${mod.id}" data-slot="${sId}">FIT [${sId}]</button>`;
            }
            fitButtonsHtml += `<button class="fit-btn-small workbench-select-btn" data-id="${mod.id}" style="border-color: #fbbf24; color: #fbbf24;">🔧 WORKBENCH</button>`;

            card.innerHTML = `
              <div class="locker-card-header">
                <span class="locker-item-title">
                  <span class="rarity-pill rarity-${rarity}">${mod.rarity || 'COMMON'}</span>
                  <span>${mod.customName || mod.name}</span>
                  ${subTag}
                  ${mfg}
                </span>
                <span class="slot-tag-badge ${cat.toLowerCase()}">${cat}</span>
              </div>
              <div class="locker-card-specs">
                <span>⚡ ${pgCost} MW</span>
                <span>🧠 ${cpuCost} tf</span>
              </div>
              ${affixesText ? `<div class="locker-card-affixes">${affixesText}</div>` : ''}
              <div class="locker-card-actions">
                ${fitButtonsHtml}
              </div>
            `;

            card.querySelectorAll('.fit-btn-small:not(.workbench-select-btn)').forEach((btn) => {
              btn.addEventListener('click', (ev) => {
                const target = ev.currentTarget as HTMLElement;
                this.fitModule(target.dataset.id!, target.dataset.slot!);
              });
            });

            card.querySelector('.workbench-select-btn')?.addEventListener('click', () => {
              this.workbenchSelectedItemId = mod.id;
              this.workbenchLockedAffixIndex = null;
              this.renderWorkbenchPanel(lockerList, techComponents);
            });

            this.lockerModulesList.appendChild(card);
          }
        }
      }

      await this.renderWorkbenchPanel(lockerList, techComponents);
    } catch (err) {
      console.error('[OUTFITTING] Failed to load loadout:', err);
    }
  }

  private async renderWorkbenchPanel(lockerList: any[], techComponents: number): Promise<void> {
    const bodyEl = document.getElementById('workbench-body');
    if (!bodyEl) return;

    const selected = lockerList.find((m) => m.id === this.workbenchSelectedItemId) || lockerList[0] || null;
    if (!selected) {
      this.workbenchSelectedItemId = null;
      this.workbenchLockedAffixIndex = null;
      bodyEl.innerHTML =
        '<div class="slot-empty-notice">Locker empty — acquire or unfit a module to use Salvage, Reforge, or Rarity Upgrade.</div>';
      return;
    }

    this.workbenchSelectedItemId = selected.id;
    const rarity = (selected.rarity || 'COMMON').toUpperCase();
    const affixes: any[] = Array.isArray(selected.affixes) ? selected.affixes : [];

    if (!this.workbenchCostCache) {
      try {
        const cRes = await fetch('/api/outfitting/workbench/costs');
        if (cRes.ok) {
          const cData = await cRes.json();
          this.workbenchCostCache = cData.costs;
        }
      } catch {
        // Fallback defaults below
      }
    }

    const costTable = this.workbenchCostCache || {};
    const entry = costTable[rarity] || {
      salvageComp: 4,
      reforge: { credits: 120, components: 4 },
      lockedReforge: null,
      upgrade: { nextRarity: 'UNCOMMON', credits: 350, components: 12 },
    };

    const hasValidLock =
      rarity !== 'COMMON' &&
      this.workbenchLockedAffixIndex !== null &&
      this.workbenchLockedAffixIndex >= 0 &&
      this.workbenchLockedAffixIndex < affixes.length;
    if (!hasValidLock) this.workbenchLockedAffixIndex = null;

    const activeReforgeCost = hasValidLock && entry.lockedReforge ? entry.lockedReforge : entry.reforge;
    const salvageCredits = Math.round(Number(selected.basePrice || 400) * 0.2);

    const affixesHtml = affixes.length
      ? affixes
          .map((a, idx) => {
            const isLocked = this.workbenchLockedAffixIndex === idx;
            const canLock = rarity !== 'COMMON';
            return `<button class="hud-btn small-btn workbench-affix-pill ${isLocked ? 'primary' : ''}" data-idx="${idx}" ${
              !canLock ? 'disabled title="Locking unlocks at UNCOMMON+"' : 'title="Click to lock/unlock this affix during Reforge"'
            }>${isLocked ? '🔒' : canLock ? '🔓' : '•'} ${a.label || `${a.stat}: x${a.multiplier}`}</button>`;
          })
          .join('')
      : '<span class="slot-empty-notice">No rolled affixes (COMMON chassis)</span>';

    bodyEl.innerHTML = `
      <div class="workbench-selected-card">
        <div class="workbench-item-summary">
          <div>
            <span class="rarity-pill rarity-${rarity.toLowerCase()}">${rarity}</span>
            <strong style="margin-left: 0.4rem;">${selected.customName || selected.name}</strong>
            <span class="col-subtext" style="margin-left: 0.5rem;">[${selected.slotType} • ${selected.subtype || ''}]</span>
          </div>
          <span style="font-family: monospace; color: #38bdf8;">Available: ${techComponents} Tech Comp • ${this.callbacks
      .getPlayerCredits()
      .toLocaleString()} Cr</span>
        </div>
        <div class="workbench-affixes-row">${affixesHtml}</div>
        <div class="workbench-actions-row">
          <button id="wb-btn-salvage" class="hud-btn small-btn danger">
            ♻️ SALVAGE (+${entry.salvageComp} Comp, +${salvageCredits} Cr)
          </button>
          <button id="wb-btn-reforge" class="hud-btn small-btn">
            🎲 REFORGE ${hasValidLock ? '(1 LOCKED)' : ''} (-${activeReforgeCost.credits} Cr, -${activeReforgeCost.components} Comp)
          </button>
          ${
            entry.upgrade
              ? `<button id="wb-btn-upgrade" class="hud-btn small-btn primary">⬆️ UPGRADE → ${entry.upgrade.nextRarity} (-${entry.upgrade.credits} Cr, -${entry.upgrade.components} Comp)</button>`
              : `<span class="mfg-badge" style="border-color:#f59e0b;color:#fbbf24;">★ MAX LEGENDARY TIER</span>`
          }
        </div>
      </div>
    `;

    bodyEl.querySelectorAll('.workbench-affix-pill').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        const idx = parseInt((ev.currentTarget as HTMLElement).dataset.idx || '-1', 10);
        this.workbenchLockedAffixIndex = this.workbenchLockedAffixIndex === idx ? null : idx;
        this.renderWorkbenchPanel(lockerList, techComponents);
      });
    });

    document.getElementById('wb-btn-salvage')?.addEventListener('click', async () => {
      await this.executeWorkbenchAction('/api/outfitting/workbench/salvage', {
        playerId: apiClient.getAccountId(),
        itemId: selected.id,
      });
    });

    document.getElementById('wb-btn-reforge')?.addEventListener('click', async () => {
      await this.executeWorkbenchAction('/api/outfitting/workbench/reforge', {
        playerId: apiClient.getAccountId(),
        itemId: selected.id,
        lockedAffixIndex: this.workbenchLockedAffixIndex,
      });
    });

    document.getElementById('wb-btn-upgrade')?.addEventListener('click', async () => {
      await this.executeWorkbenchAction('/api/outfitting/workbench/upgrade', {
        playerId: apiClient.getAccountId(),
        itemId: selected.id,
      });
    });
  }

  private async executeWorkbenchAction(endpoint: string, payload: Record<string, any>): Promise<void> {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        this.audio.playApWarningSound();
        this.callbacks.showApNotification(`⚠️ WORKBENCH ERROR: ${data.error || 'Action failed'}`, true);
        return;
      }
      this.audio.playUiBlip();
      if (typeof data.credits === 'number') {
        this.callbacks.setPlayerCredits(data.credits);
      }
      if (endpoint.endsWith('/salvage')) {
        this.callbacks.showApNotification(
          `♻️ Salvaged "${data.salvagedName}": +${data.componentsGained} Comp, +${data.creditsGained} Cr`,
          false
        );
        this.workbenchSelectedItemId = null;
      } else if (endpoint.endsWith('/reforge')) {
        this.callbacks.showApNotification(`🎲 Reforged → "${data.item?.custom_name}"`, false);
      } else if (endpoint.endsWith('/upgrade')) {
        this.callbacks.showApNotification(
          `⬆️ Upgraded ${data.previousRarity} → ${data.newRarity}: "${data.item?.custom_name}"`,
          false
        );
      }
      await this.loadOutfittingData();
      await this.callbacks.refreshPlayerHold();
    } catch (err) {
      console.error('[WORKBENCH] Action error:', err);
    }
  }

  public async fitModule(inventoryId: string, slot: string): Promise<void> {
    try {
      const res = await fetch('/api/outfitting/fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: apiClient.getAccountId(),
          inventoryId,
          slot,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        this.audio.playApWarningSound();
        this.callbacks.showApNotification(`⚠️ FIT REJECTED: ${data.message || data.error || 'Capacity exceeded'}`, true);
        return;
      }
      this.audio.playUiBlip();
      this.callbacks.showApNotification(`✅ MODULE INSTALLED TO SLOT [${slot}]`, false);
      await this.loadOutfittingData();
    } catch (err) {
      console.error('[OUTFITTING] Fit error:', err);
    }
  }

  public async unfitModule(slot: string): Promise<void> {
    try {
      const res = await fetch('/api/outfitting/unfit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: apiClient.getAccountId(),
          slot,
        }),
      });
      if (res.ok) {
        this.audio.playUiBlip();
        this.callbacks.showApNotification('MODULE UNMOUNTED TO STATION LOCKER', false);
        await this.loadOutfittingData();
      }
    } catch (err) {
      console.error('[OUTFITTING] Unfit error:', err);
    }
  }

  public async loadArmoryData(): Promise<void> {
    try {
      const res = await fetch('/api/outfitting/catalog');
      if (!res.ok) return;
      const json = await res.json();
      const blueprints = Array.isArray(json) ? json : json.catalog || [];
      this.equipmentCatalog = blueprints;

      if (this.elArmoryPlayerCredits) {
        this.elArmoryPlayerCredits.textContent = `${this.callbacks.getPlayerCredits().toLocaleString()} Cr`;
      }

      if (this.elArmoryProceduralShopGrid) {
        try {
          const shopRes = await fetch(`/api/outfitting/shop?sectorId=${this.callbacks.getCurrentSectorId()}`);
          if (shopRes.ok) {
            const shopJson = await shopRes.json();
            const stock = shopJson.stock || [];
            this.elArmoryProceduralShopGrid.innerHTML = '';
            for (const item of stock) {
              const card = document.createElement('div');
              const cat = item.slotType || 'HIGH';
              const rarity = (item.rarity || 'COMMON').toLowerCase();
              card.className = `armory-card rarity-${rarity}`;
              const affixText = (item.affixes || []).map((a: any) => a.label || `${a.stat} x${a.multiplier}`).join(' • ');
              card.innerHTML = `
                <div class="armory-card-header">
                  <span class="slot-tag-badge ${cat.toLowerCase()}">${cat} • ${item.mainCategory}</span>
                  <span class="armory-price-pill">${Number(item.basePrice).toLocaleString()} Cr</span>
                </div>
                <div class="armory-item-title">
                  <span class="rarity-pill rarity-${rarity}">${item.rarity}</span>
                  ${item.customName}
                </div>
                <div class="locker-card-specs">
                  <span>⚡ ${item.powerGridCost} MW</span>
                  <span>🧠 ${item.cpuCost} tf</span>
                  <span>📦 ${item.subtype}</span>
                </div>
                ${affixText ? `<div class="locker-card-affixes">${affixText}</div>` : ''}
                <button class="hud-btn primary fit-btn-small" style="margin-top: 0.4rem;">
                  PURCHASE PROCEDURAL HARDWARE 🛒
                </button>
              `;
              card.querySelector('button')?.addEventListener('click', () => {
                this.buyProceduralShopModule(item.slotIndex);
              });
              this.elArmoryProceduralShopGrid.appendChild(card);
            }
          }
        } catch (shopErr) {
          console.warn('[ARMORY] Procedural shop load skipped:', shopErr);
        }
      }

      if (this.elArmoryCatalogGrid) {
        this.elArmoryCatalogGrid.innerHTML = '';
        for (const bp of blueprints) {
          const card = document.createElement('div');
          const cat = bp.slot_type || bp.slotType || 'HIGH';
          card.className = 'armory-card';

          const mfg = bp.manufacturer ? `<span class="mfg-badge">${bp.manufacturer}</span>` : '';
          const pgCost = bp.power_grid_cost ?? bp.powerGridCost ?? 0;
          const cpuCost = bp.cpu_cost ?? bp.cpuCost ?? 0;
          const price = bp.base_price ?? bp.basePrice ?? 500;
          const stats = bp.base_stats || bp.baseStats;
          const statsText = stats ? Object.entries(stats).map(([k, v]) => `${k}: ${v}`).join(' | ') : '';

          card.innerHTML = `
            <div class="armory-card-header">
              <span class="slot-tag-badge ${cat.toLowerCase()}">${cat}</span>
              <span class="armory-price-pill">${price.toLocaleString()} Cr</span>
            </div>
            <div class="armory-item-title">${bp.name} ${mfg}</div>
            <div class="locker-card-specs">
              <span>⚡ ${pgCost} MW</span>
              <span>🧠 ${cpuCost} tf</span>
            </div>
            ${statsText ? `<div class="locker-card-affixes">${statsText}</div>` : ''}
            <button class="hud-btn primary fit-btn-small" style="margin-top: 0.4rem;" data-id="${bp.id}">
              PURCHASE MODULE 🛒
            </button>
          `;

          card.querySelector('button')?.addEventListener('click', () => {
            this.buyModule(bp.id);
          });

          this.elArmoryCatalogGrid.appendChild(card);
        }
      }
    } catch (err) {
      console.error('[ARMORY] Catalog load error:', err);
    }
  }

  public async buyModule(blueprintId: string): Promise<void> {
    try {
      const res = await fetch('/api/outfitting/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: apiClient.getAccountId(),
          blueprintId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        this.audio.playApWarningSound();
        this.callbacks.showApNotification(`REQUISITION FAILED: ${data.error || 'Check funds'}`, true);
        return;
      }
      this.audio.playTradeBuySound();
      this.callbacks.setPlayerCredits(data.credits);
      if (this.elArmoryPlayerCredits) this.elArmoryPlayerCredits.textContent = `${data.credits.toLocaleString()} Cr`;
      this.callbacks.showApNotification('🛒 MODULE PURCHASED & TRANSFERRED TO LOCKER', false);
      await this.loadArmoryData();
    } catch (err) {
      console.error('[ARMORY] Buy error:', err);
    }
  }

  public async buyProceduralShopModule(slotIndex: number): Promise<void> {
    try {
      const res = await fetch('/api/outfitting/shop/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: apiClient.getAccountId(),
          sectorId: this.callbacks.getCurrentSectorId(),
          slotIndex,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        this.audio.playApWarningSound();
        this.callbacks.showApNotification(`REQUISITION FAILED: ${data.error || 'Check funds'}`, true);
        return;
      }
      this.audio.playTradeBuySound();
      this.callbacks.setPlayerCredits(data.credits);
      if (this.elArmoryPlayerCredits) this.elArmoryPlayerCredits.textContent = `${data.credits.toLocaleString()} Cr`;
      this.callbacks.showApNotification(`🛒 ACQUIRED ${data.module?.customName || 'PROCEDURAL HARDWARE'}`, false);
      await this.loadArmoryData();
    } catch (err) {
      console.error('[ARMORY] Procedural buy error:', err);
    }
  }
}

