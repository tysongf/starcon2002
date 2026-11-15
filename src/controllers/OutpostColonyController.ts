/**
 * Milestone 1.7: OutpostColonyController.ts
 * Full-screen Sierra Outpost (1994)-inspired 4-layer (0..-3) 12x12 Isometric Colony Command View
 * blended into Wayward Void's Neon/CRT Starcon HUD.
 */

import { apiClient } from '../network/ApiClient';
export interface OutpostBuildingSpec {
  id: string;
  name: string;
  icon: string;
  category: string;
  allowedLayers: number[];
  buildTimeSec: number;
  creditCost: number;
  alloyCost: number;
  powerDeltaMW: number;
  o2Delta: number;
  workersRequired: number;
  colorHex: string;
  description: string;
}

export interface OutpostTileData {
  id: string;
  colonyId: string;
  layer: 0 | -1 | -2 | -3;
  x: number;
  y: number;
  terrainType: string;
  buildingType: string | null;
  status: 'CONSTRUCTING' | 'ACTIVE' | 'OFFLINE';
  isConnected: boolean;
  isPowered: boolean;
  remainingBuildSec: number;
}

export interface OutpostCallbacks {
  audio: {
    playUiBlip: () => void;
    playFacilityUpgradeSound: () => void;
    playCargoHarvestSound: () => void;
  };
  showApNotification: (msg: string, isError?: boolean) => void;
  fetchPlayerAP: () => Promise<void> | void;
  refreshPlayerHold: () => Promise<void> | void;
  onColonyUpdated: (colony: any) => void;
}

const GRID_SIZE = 12;
const LAYER_NAMES: Record<number, string> = {
  0: 'SURFACE (L0)',
  '-1': 'SHALLOW CRUST (L-1)',
  '-2': 'MID MANTLE (L-2)',
  '-3': 'DEEP CORE (L-3)',
};

export class OutpostColonyController {
  private callbacks: OutpostCallbacks;

  public isOpen: boolean = false;
  public colonyId: string | null = null;
  public colony: any = null;
  public telemetry: any = null;
  public tiles: OutpostTileData[] = [];
  public catalog: OutpostBuildingSpec[] = [];
  public relicCatalog: OutpostBuildingSpec[] = [];
  public unlockedRelicIds: Set<string> = new Set();

  public activeLayer: 0 | -1 | -2 | -3 = 0;
  public activeCategory: string = 'ALL';
  public selectedBuildType: string | null = null; // null = Inspect Mode
  public selectedTile: { layer: number; x: number; y: number } | null = { layer: 0, x: 5, y: 5 };
  public hoveredCoord: { x: number; y: number } | null = null;

  // Isometric camera pan & zoom
  private camOffsetX: number = 0;
  private camOffsetY: number = 85;
  private camZoom: number = 1.0;
  private isDragging: boolean = false;
  private dragMoved: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragBaseX: number = 0;
  private dragBaseY: number = 0;

  private modalEl: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private timerIntervalId: number | null = null;
  private lastTimerSyncMs: number = 0;

  constructor(callbacks: OutpostCallbacks) {
    this.callbacks = callbacks;
    this.bindDOM();
  }

  private bindDOM(): void {
    this.modalEl = document.getElementById('outpost-colony-modal');
    this.canvas = document.getElementById('outpost-grid-canvas') as HTMLCanvasElement | null;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.bindCanvasEvents(this.canvas);
    }

    document.getElementById('btn-close-outpost-modal')?.addEventListener('click', () => this.close());
    document.getElementById('btn-outpost-harvest')?.addEventListener('click', () => this.harvestSilo());
    document.getElementById('btn-outpost-rush-all')?.addEventListener('click', () => this.completePendingNow());
    document.getElementById('btn-outpost-inspect-mode')?.addEventListener('click', () => {
      this.selectedBuildType = null;
      this.callbacks.audio.playUiBlip();
      this.renderBuildPalette();
    });

    document.querySelectorAll('.outpost-layer-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const layer = Number((btn as HTMLElement).getAttribute('data-layer') || 0) as 0 | -1 | -2 | -3;
        this.switchLayer(layer);
      });
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.isOpen) return;
      if (e.code === 'Escape') {
        if (this.selectedBuildType) {
          this.selectedBuildType = null;
          this.renderBuildPalette();
        } else {
          this.close();
        }
      } else if (e.key === '1') this.switchLayer(0);
      else if (e.key === '2') this.switchLayer(-1);
      else if (e.key === '3') this.switchLayer(-2);
      else if (e.key === '4') this.switchLayer(-3);
    });
  }

  private bindCanvasEvents(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.selectedBuildType) {
        this.selectedBuildType = null;
        this.renderBuildPalette();
      }
    });

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (!this.isOpen) return;
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragBaseX = this.camOffsetX;
      this.dragBaseY = this.camOffsetY;
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isOpen || !this.canvas) return;
      if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        if (Math.hypot(dx, dy) > 5) {
          this.dragMoved = true;
          this.camOffsetX = this.dragBaseX + dx;
          this.camOffsetY = this.dragBaseY + dy;
        }
      }
      this.updateHoverFromMouse(e);
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (!this.isOpen) return;
      if (this.isDragging && !this.dragMoved && e.target === this.canvas && e.button === 0) {
        this.handleTileClick();
      }
      this.isDragging = false;
    });

    canvas.addEventListener('wheel', (e: WheelEvent) => {
      if (!this.isOpen) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      this.camZoom = Math.max(0.65, Math.min(1.85, Number((this.camZoom + delta).toFixed(2))));
    });
  }

  public async open(colonyId: string): Promise<void> {
    this.colonyId = colonyId;
    this.isOpen = true;
    this.camOffsetX = 0;
    this.camOffsetY = 85;
    this.camZoom = 1.0;

    if (!this.modalEl) this.modalEl = document.getElementById('outpost-colony-modal');
    this.modalEl?.classList.remove('hidden');

    await this.refreshGrid();
    this.startLoops();
  }

  public close(): void {
    this.isOpen = false;
    this.modalEl?.classList.add('hidden');
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.timerIntervalId !== null) {
      window.clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  public switchLayer(layer: 0 | -1 | -2 | -3): void {
    this.activeLayer = layer;
    this.callbacks.audio.playUiBlip();
    document.querySelectorAll('.outpost-layer-btn').forEach((btn) => {
      const bl = Number((btn as HTMLElement).getAttribute('data-layer'));
      btn.classList.toggle('active', bl === layer);
    });
    // Reset build choice if disallowed on target layer
    if (this.selectedBuildType) {
      const spec = this.catalog.find((c) => c.id === this.selectedBuildType);
      if (spec && !spec.allowedLayers.includes(layer)) {
        this.selectedBuildType = null;
      }
    }
    this.renderBuildPalette();
    this.renderInspector();
  }

  public async refreshGrid(): Promise<void> {
    if (!this.colonyId) return;
    try {
      const res = await fetch(`/api/colonies/${this.colonyId}/grid?accountId=${encodeURIComponent(apiClient.getAccountId())}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      this.colony = data.colony;
      this.telemetry = data.telemetry;
      this.tiles = Array.isArray(data.tiles) ? data.tiles : [];
      if (Array.isArray(data.catalog)) this.catalog = data.catalog;
      try {
        const [catRes, relRes] = await Promise.all([
          fetch('/api/colonies/outpost/catalog').then((r) => r.json()).catch(() => null),
          fetch('/api/raids/relics').then((r) => r.json()).catch(() => null),
        ]);
        if (catRes?.relicBuildings) this.relicCatalog = catRes.relicBuildings;
        if (relRes?.relics) {
          this.unlockedRelicIds = new Set(
            relRes.relics.filter((rl: any) => Number(rl.chargesRemaining ?? 1) > 0).map((rl: any) => rl.blueprintId)
          );
        }
      } catch {}
      this.lastTimerSyncMs = Date.now();

      this.callbacks.onColonyUpdated(this.colony);
      this.renderHeaderTelemetry();
      this.renderBuildPalette();
      this.renderInspector();
    } catch (err) {
      console.warn('[OutpostColony] Failed to refresh grid:', err);
    }
  }

  private startLoops(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    const draw = () => {
      if (!this.isOpen) return;
      this.renderCanvas();
      this.rafId = requestAnimationFrame(draw);
    };
    this.rafId = requestAnimationFrame(draw);

    if (this.timerIntervalId !== null) window.clearInterval(this.timerIntervalId);
    this.timerIntervalId = window.setInterval(() => {
      if (!this.isOpen) return;
      const hasConstructing = this.tiles.some((t) => t.status === 'CONSTRUCTING');
      if (hasConstructing) {
        const now = Date.now();
        let anyExpired = false;
        const dtSec = Math.max(1, Math.floor((now - this.lastTimerSyncMs) / 1000));
        this.lastTimerSyncMs = now;
        for (const t of this.tiles) {
          if (t.status === 'CONSTRUCTING') {
            t.remainingBuildSec = Math.max(0, t.remainingBuildSec - dtSec);
            if (t.remainingBuildSec <= 0) anyExpired = true;
          }
        }
        this.renderInspector();
        if (anyExpired) {
          void this.refreshGrid();
        }
      }
    }, 1000);
  }

  private getTile(layer: number, x: number, y: number): OutpostTileData | undefined {
    return this.tiles.find((t) => t.layer === layer && t.x === x && t.y === y);
  }

  private screenToIsoTile(mx: number, my: number): { x: number; y: number } | null {
    if (!this.canvas) return null;
    const cx = this.canvas.width / 2 + this.camOffsetX;
    const cy = this.camOffsetY;
    const tileW = 64 * this.camZoom;
    const tileH = 32 * this.camZoom;

    const dx = mx - cx;
    const dy = my - cy;

    const gx = Math.floor((dx / (tileW / 2) + dy / (tileH / 2)) / 2);
    const gy = Math.floor((dy / (tileH / 2) - dx / (tileW / 2)) / 2);
    if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
      return { x: gx, y: gy };
    }
    return null;
  }

  private isoToScreen(x: number, y: number): { sx: number; sy: number; tileW: number; tileH: number } {
    const cx = (this.canvas?.width || 840) / 2 + this.camOffsetX;
    const cy = this.camOffsetY;
    const tileW = 64 * this.camZoom;
    const tileH = 32 * this.camZoom;
    return {
      sx: cx + (x - y) * (tileW / 2),
      sy: cy + (x + y) * (tileH / 2),
      tileW,
      tileH,
    };
  }

  private updateHoverFromMouse(e: MouseEvent): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / Math.max(1, rect.width);
    const scaleY = this.canvas.height / Math.max(1, rect.height);
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    this.hoveredCoord = this.screenToIsoTile(mx, my);
  }

  private async handleTileClick(): Promise<void> {
    if (!this.hoveredCoord || !this.colonyId) return;
    const { x, y } = this.hoveredCoord;
    const tile = this.getTile(this.activeLayer, x, y);
    if (!tile) return;

    this.selectedTile = { layer: this.activeLayer, x, y };

    // If building selected and tile is empty & buildable -> place structure!
    if (this.selectedBuildType && !tile.buildingType) {
      try {
        const res = await fetch(`/api/colonies/${this.colonyId}/grid/build`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: apiClient.getAccountId(),
            layer: this.activeLayer,
            x,
            y,
            buildingType: this.selectedBuildType,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          this.callbacks.showApNotification(`⚠️ ${data.error || 'Construction rejected'}`, true);
          return;
        }
        this.callbacks.audio.playFacilityUpgradeSound();
        this.colony = data.colony;
        this.telemetry = data.telemetry;
        this.tiles = data.tiles || [];
        this.lastTimerSyncMs = Date.now();
        this.callbacks.onColonyUpdated(this.colony);
        this.callbacks.refreshPlayerHold();
        this.renderHeaderTelemetry();
        this.renderBuildPalette();
        this.renderInspector();
        const spec = this.catalog.find((c) => c.id === this.selectedBuildType);
        this.callbacks.showApNotification(
          `🏗️ ${spec?.name || this.selectedBuildType} queued at (${LAYER_NAMES[this.activeLayer]}, ${x},${y})!`,
          false
        );
      } catch (err) {
        console.warn('[OutpostColony] Build failed:', err);
      }
      return;
    }

    this.callbacks.audio.playUiBlip();
    this.renderInspector();
  }

  private async toggleSelectedTilePower(): Promise<void> {
    if (!this.colonyId || !this.selectedTile) return;
    try {
      const res = await fetch(`/api/colonies/${this.colonyId}/grid/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: apiClient.getAccountId(), ...this.selectedTile }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.colony = data.colony;
        this.telemetry = data.telemetry;
        this.tiles = data.tiles || [];
        this.callbacks.onColonyUpdated(this.colony);
        this.callbacks.audio.playUiBlip();
        this.renderHeaderTelemetry();
        this.renderInspector();
      } else {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Toggle failed'}`, true);
      }
    } catch {
      // ignore
    }
  }

  private async demolishSelectedTile(): Promise<void> {
    if (!this.colonyId || !this.selectedTile) return;
    try {
      const res = await fetch(`/api/colonies/${this.colonyId}/grid/demolish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: apiClient.getAccountId(), ...this.selectedTile }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.colony = data.colony;
        this.telemetry = data.telemetry;
        this.tiles = data.tiles || [];
        this.callbacks.onColonyUpdated(this.colony);
        this.callbacks.audio.playUiBlip();
        this.callbacks.showApNotification(`💥 Salvaged structure (+${data.refundCredits || 0} Cr refunded).`, false);
        this.renderHeaderTelemetry();
        this.renderInspector();
      } else {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Demolish failed'}`, true);
      }
    } catch {
      // ignore
    }
  }

  private async completePendingNow(): Promise<void> {
    if (!this.colonyId) return;
    try {
      const res = await fetch(`/api/colonies/${this.colonyId}/grid/complete-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: apiClient.getAccountId() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.colony = data.colony;
        this.telemetry = data.telemetry;
        this.tiles = data.tiles || [];
        this.callbacks.onColonyUpdated(this.colony);
        this.callbacks.audio.playFacilityUpgradeSound();
        this.renderHeaderTelemetry();
        this.renderInspector();
        this.callbacks.showApNotification(`⚡ Completed ${data.completedCount || 0} pending Outpost structures!`, false);
      }
    } catch {
      // ignore
    }
  }

  private async harvestSilo(): Promise<void> {
    if (!this.colonyId) return;
    try {
      const res = await fetch(`/api/colonies/${this.colonyId}/harvest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: apiClient.getAccountId() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.colony = data.colony;
        this.callbacks.onColonyUpdated(this.colony);
        this.callbacks.audio.playCargoHarvestSound();
        this.callbacks.refreshPlayerHold();
        this.callbacks.showApNotification(`📦 ${data.message}`, false);
        this.renderHeaderTelemetry();
      } else {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Silo empty'}`, true);
      }
    } catch {
      // ignore
    }
  }

  private renderHeaderTelemetry(): void {
    const col = this.colony;
    const tel = this.telemetry;
    if (!col || !tel) return;

    const titleEl = document.getElementById('outpost-modal-title');
    if (titleEl) {
      titleEl.textContent = `${String(col.name || 'COLONY').toUpperCase()} // OUTPOST ISOMETRIC COMMAND`;
    }

    const setEl = (id: string, text: string, warn?: boolean) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = text;
        el.classList.toggle('danger', !!warn);
      }
    };

    const brownout = tel.powerGeneratedMW < tel.powerConsumedMW;
    const o2Deficit = tel.o2Generated < tel.o2Consumed;
    const understaffed = tel.workersAvailable < tel.workersRequired;

    setEl(
      'outpost-gauge-power',
      `⚡ ${tel.powerGeneratedMW}/${tel.powerConsumedMW} MW (${Math.round(tel.gridEfficiency * 100)}%)`,
      brownout
    );
    setEl('outpost-gauge-o2', `🫁 O2 ${tel.o2Generated}/${tel.o2Consumed}`, o2Deficit);
    setEl('outpost-gauge-workers', `👷 ${tel.workersRequired}/${col.population} POP`, understaffed);
    setEl('outpost-gauge-morale', `💚 MORALE ${tel.morale}%`, tel.morale < 50);
    setEl('outpost-gauge-rate', `⛏️ ${col.productionRatePerMinute} u/min`);
    setEl('outpost-gauge-silo', `📦 ${col.stockpiledAmount}/${col.siloCapacity}`);

    const rushBtn = document.getElementById('btn-outpost-rush-all') as HTMLButtonElement | null;
    if (rushBtn) {
      rushBtn.style.display = tel.constructingCount > 0 ? 'inline-flex' : 'none';
      rushBtn.textContent = `⚡ FINALIZE QUEUE (${tel.constructingCount})`;
    }
  }

  private renderBuildPalette(): void {
    const container = document.getElementById('outpost-build-palette');
    if (!container) return;

    const inspectBtn = document.getElementById('btn-outpost-inspect-mode');
    if (inspectBtn) {
      inspectBtn.classList.toggle('active', this.selectedBuildType === null);
    }

    const allowed = [...this.catalog, ...this.relicCatalog].filter(
      (b) => b.id !== 'COMMAND_HUB' && b.allowedLayers.includes(this.activeLayer)
    );

    container.innerHTML = allowed
      .map((b) => {
        const selected = this.selectedBuildType === b.id;
        const isRelic = this.relicCatalog.some((rc) => rc.id === b.id);
        const hasPermit = !isRelic || this.unlockedRelicIds.has(b.id);
        const mwTag = b.powerDeltaMW >= 0 ? `+${b.powerDeltaMW} MW` : `${b.powerDeltaMW} MW`;
        const o2Tag = b.o2Delta > 0 ? ` • +${b.o2Delta} O2` : b.o2Delta < 0 ? ` • ${b.o2Delta} O2` : '';
        const relicBadge = isRelic
          ? hasPermit
            ? ' <span class="mp-badge">[RELIC READY]</span>'
            : ' <span class="mp-badge">[RAID RELIC LOCKED]</span>'
          : '';
        return `
          <button class="outpost-palette-card ${selected ? 'selected' : ''}" data-build-id="${b.id}" title="${b.description}">
            <div class="outpost-pal-top">
              <span>${b.icon} <strong>${b.name}</strong>${relicBadge}</span>
              <span class="outpost-pal-time">${b.buildTimeSec}s</span>
            </div>
            <div class="outpost-pal-meta">
              ${b.creditCost} Cr${b.alloyCost > 0 ? ` • ${b.alloyCost} Alloy` : ''} // ${mwTag}${o2Tag}
            </div>
          </button>
        `;
      })
      .join('');

    container.querySelectorAll('.outpost-palette-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).getAttribute('data-build-id');
        this.selectedBuildType = this.selectedBuildType === id ? null : id;
        this.callbacks.audio.playUiBlip();
        this.renderBuildPalette();
      });
    });
  }

  private renderInspector(): void {
    const box = document.getElementById('outpost-tile-inspector');
    if (!box) return;

    const sel = this.selectedTile;
    const tile = sel ? this.getTile(sel.layer, sel.x, sel.y) : undefined;
    if (!tile) {
      box.innerHTML = `<div class="ledger-empty">Click any isometric tile to inspect terrain, power conduits, or structures.</div>`;
      return;
    }

    const spec = tile.buildingType ? this.catalog.find((b) => b.id === tile.buildingType) : null;
    const terrainLabels: Record<string, string> = {
      FLAT: 'Flat Regolith (Standard)',
      CRATER: 'Impact Crater (Impassable)',
      BEDROCK: 'Subsurface Bedrock (Stable)',
      GEO_VENT: 'Surface Thermal Vent (2.0x Geothermal MW!)',
      DEEP_GEO_VENT: 'Magma Fissure (2.0x Deep Geothermal MW!)',
      ORE_SEAM_L1: 'Rich Ore Seam (+75% Ore Mine Yield!)',
      RARE_SEAM_L2: 'Plasteel & Cryo Vein (+85% Deep Extractor!)',
      DEEP_SEAM_L3: 'Deep Plutonium / Precursor Seam (+85% Yield!)',
      WATER_POCKET: 'Subsurface Aquifer (+35% Agridome O2!)',
    };

    const crewHtml = (this.colony?.stationedCrew || [])
      .map((c: any) => `<span class="lander-crew-pill">${c.name} [${c.primarySpecialty}]</span>`)
      .join('');

    box.innerHTML = `
      <div class="outpost-insp-coord">${LAYER_NAMES[tile.layer]} // TILE (${tile.x}, ${tile.y})</div>
      <div class="outpost-insp-terrain">${terrainLabels[tile.terrainType] || tile.terrainType}</div>
      ${
        spec
          ? `
        <div class="outpost-insp-struct">
          <div class="outpost-insp-title">${spec.icon} ${spec.name}</div>
          <div class="outpost-insp-badges">
            <span class="lander-crew-pill">${tile.status}${tile.status === 'CONSTRUCTING' ? ` (${tile.remainingBuildSec}s)` : ''}</span>
            <span class="lander-crew-pill">${tile.isConnected ? '🔗 LINKED TO HUB' : '⚠️ UNLINKED (BUILD TUBE)'}</span>
          </div>
          <p class="outpost-insp-desc">${spec.description}</p>
          ${
            spec.id !== 'COMMAND_HUB'
              ? `
            <div class="outpost-insp-actions">
              ${
                tile.status !== 'CONSTRUCTING'
                  ? `<button id="btn-insp-toggle" class="colony-action-btn">${tile.status === 'ACTIVE' ? '⚡ POWER DOWN' : '⚡ RESTORE POWER'}</button>`
                  : ''
              }
              <button id="btn-insp-demolish" class="colony-action-btn">💥 SALVAGE (+${Math.floor(spec.creditCost * 0.5)} Cr)</button>
            </div>
          `
              : ''
          }
        </div>
      `
          : `<div class="outpost-insp-empty">${
              this.selectedBuildType
                ? `Click tile on map to build <strong>${this.catalog.find((b) => b.id === this.selectedBuildType)?.name}</strong>.`
                : 'Empty plot. Pick a building on the left palette to construct here.'
            }</div>`
      }
      <div class="outpost-crew-summary">
        <div class="outpost-crew-hd">STATIONED SPECIALISTS (${this.colony?.stationedCrew?.length || 0}):</div>
        <div class="lander-crew-roster-pills">${crewHtml || '<span class="lander-crew-pill">NONE ASSIGNED</span>'}</div>
      </div>
    `;

    document.getElementById('btn-insp-toggle')?.addEventListener('click', () => this.toggleSelectedTilePower());
    document.getElementById('btn-insp-demolish')?.addEventListener('click', () => this.demolishSelectedTile());
  }

  private renderCanvas(): void {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const nowSec = Date.now() / 1000;

    // Layer-tinted deep CRT space background
    const bgColors: Record<number, [string, string]> = {
      0: ['#051324', '#02060e'],
      '-1': ['#17110a', '#060403'],
      '-2': ['#081026', '#02040d'],
      '-3': ['#210912', '#070205'],
    };
    const [c0, c1] = bgColors[this.activeLayer] || bgColors[0];
    const grad = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w / 1.5);
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const layerTiles = this.tiles.filter((t) => t.layer === this.activeLayer);
    const tileMap = new Map<string, OutpostTileData>();
    for (const t of layerTiles) tileMap.set(`${t.x}:${t.y}`, t);

    // Painter's algorithm: iterate back-to-front by (x + y)
    for (let sum = 0; sum <= (GRID_SIZE - 1) * 2; sum++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const y = sum - x;
        if (y < 0 || y >= GRID_SIZE) continue;
        const tile = tileMap.get(`${x}:${y}`);
        if (!tile) continue;

        const { sx, sy, tileW, tileH } = this.isoToScreen(x, y);
        const isHovered = this.hoveredCoord?.x === x && this.hoveredCoord?.y === y;
        const isSelected =
          this.selectedTile?.layer === this.activeLayer &&
          this.selectedTile?.x === x &&
          this.selectedTile?.y === y;

        // 1. Base Isometric Diamond
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + tileW / 2, sy + tileH / 2);
        ctx.lineTo(sx, sy + tileH);
        ctx.lineTo(sx - tileW / 2, sy + tileH / 2);
        ctx.closePath();

        ctx.fillStyle = this.getTerrainFill(tile.terrainType, this.activeLayer);
        ctx.fill();
        ctx.strokeStyle = isSelected
          ? '#fbbf24'
          : isHovered
          ? '#00f0ff'
          : 'rgba(56, 189, 248, 0.22)';
        ctx.lineWidth = isSelected || isHovered ? 2 : 1;
        ctx.stroke();

        // 2. Terrain Seam / Vent Feature Accent
        this.drawTerrainFeature(ctx, tile.terrainType, sx, sy + tileH / 2, tileW, nowSec);

        // 3. Draw Auto-Connecting Transit Tubes between adjacent occupied tiles
        if (tile.buildingType && tile.status !== 'CONSTRUCTING') {
          this.drawTubeLinks(ctx, tile, tileMap, sx, sy + tileH / 2, tileW, tileH, nowSec);
        }

        // 4. Draw Structure Sprite or Construction Ghost
        if (tile.buildingType) {
          this.drawStructure(ctx, tile, sx, sy + tileH / 2, tileW, tileH, nowSec);
        } else if (isHovered && this.selectedBuildType && tile.terrainType !== 'CRATER') {
          // Placement ghost preview
          ctx.save();
          ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + tileW / 2, sy + tileH / 2);
          ctx.lineTo(sx, sy + tileH);
          ctx.lineTo(sx - tileW / 2, sy + tileH / 2);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // HUD Corner Legend
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(12, 12, 245, 26);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.strokeRect(12, 12, 245, 26);
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`DEPTH: ${LAYER_NAMES[this.activeLayer]}`, 20, 29);
  }

  private getTerrainFill(terrain: string, layer: number): string {
    if (terrain === 'CRATER') return '#1c1917';
    if (terrain === 'GEO_VENT') return '#331c10';
    if (terrain === 'DEEP_GEO_VENT') return '#451212';
    if (terrain === 'ORE_SEAM_L1') return '#2e2612';
    if (terrain === 'RARE_SEAM_L2') return '#13253a';
    if (terrain === 'DEEP_SEAM_L3') return '#2d1438';
    if (terrain === 'WATER_POCKET') return '#0e2d38';
    if (layer === 0) return '#0f2137';
    if (layer === -1) return '#221b14';
    if (layer === -2) return '#111a2e';
    return '#211119';
  }

  private drawTerrainFeature(
    ctx: CanvasRenderingContext2D,
    terrain: string,
    cx: number,
    cy: number,
    tileW: number,
    nowSec: number
  ): void {
    if (terrain === 'CRATER') {
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.ellipse(cx, cy, tileW * 0.28, tileW * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (terrain === 'GEO_VENT' || terrain === 'DEEP_GEO_VENT') {
      const pulse = 0.65 + Math.sin(nowSec * 4) * 0.35;
      ctx.fillStyle = `rgba(249, 115, 22, ${pulse})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, tileW * 0.18, tileW * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (terrain === 'ORE_SEAM_L1' || terrain === 'RARE_SEAM_L2' || terrain === 'DEEP_SEAM_L3') {
      ctx.fillStyle =
        terrain === 'ORE_SEAM_L1' ? '#fbbf24' : terrain === 'RARE_SEAM_L2' ? '#38bdf8' : '#e879f9';
      ctx.fillRect(cx - 5, cy - 3, 4, 4);
      ctx.fillRect(cx + 2, cy + 1, 5, 3);
      ctx.fillRect(cx - 1, cy - 6, 3, 3);
    } else if (terrain === 'WATER_POCKET') {
      ctx.fillStyle = 'rgba(34, 211, 238, 0.5)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, tileW * 0.22, tileW * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawTubeLinks(
    ctx: CanvasRenderingContext2D,
    tile: OutpostTileData,
    tileMap: Map<string, OutpostTileData>,
    cx: number,
    cy: number,
    tileW: number,
    tileH: number,
    nowSec: number
  ): void {
    const dirs = [
      [1, 0],
      [0, 1],
    ];
    for (const [dx, dy] of dirs) {
      const nb = tileMap.get(`${tile.x + dx}:${tile.y + dy}`);
      if (!nb || !nb.buildingType || nb.status === 'CONSTRUCTING') continue;

      const nScreen = this.isoToScreen(nb.x, nb.y);
      const nx = nScreen.sx;
      const ny = nScreen.sy + tileH / 2;

      const linked = tile.isConnected && nb.isConnected && tile.status === 'ACTIVE' && nb.status === 'ACTIVE';
      ctx.strokeStyle = linked ? '#00f0ff' : '#64748b';
      ctx.lineWidth = Math.max(2, 3.5 * this.camZoom);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      if (linked) {
        const t = (nowSec * 1.4) % 1;
        const px = cx + (nx - cx) * t;
        const py = cy + (ny - cy) * t;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.5, 2.2 * this.camZoom), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    void tileW;
  }

  private drawStructure(
    ctx: CanvasRenderingContext2D,
    tile: OutpostTileData,
    cx: number,
    cy: number,
    tileW: number,
    tileH: number,
    nowSec: number
  ): void {
    const spec = this.catalog.find((b) => b.id === tile.buildingType);
    const color = spec?.colorHex || '#38bdf8';
    const scale = this.camZoom;

    if (tile.buildingType === 'TRANSIT_TUBE') {
      ctx.fillStyle = tile.isConnected ? '#0ea5e9' : '#64748b';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5 * scale, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // 2.5D Isometric Box / Dome Height
    const boxW = tileW * 0.42;
    const boxD = tileH * 0.42;
    const height =
      tile.buildingType === 'COMMAND_HUB'
        ? 26 * scale
        : tile.buildingType === 'SPACEPORT_GANTRY'
        ? 24 * scale
        : tile.buildingType === 'ACCESS_SHAFT'
        ? 14 * scale
        : 16 * scale;

    const alpha = tile.status === 'CONSTRUCTING' ? 0.45 : tile.status === 'OFFLINE' ? 0.35 : 0.92;
    ctx.save();
    ctx.globalAlpha = alpha;

    if (tile.buildingType === 'AGRIDOME' || tile.buildingType === 'BIOSPHERE_DOME' || tile.buildingType === 'ASTRO_OBSERVATORY') {
      // Geodesic dome
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(cx, cy, boxW * 0.85, boxD * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy - 2 * scale, boxW * 0.62, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      // 3D Isometric Prism
      // Left face
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(cx - boxW, cy);
      ctx.lineTo(cx, cy + boxD);
      ctx.lineTo(cx, cy + boxD - height);
      ctx.lineTo(cx - boxW, cy - height);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Right face
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(cx + boxW, cy);
      ctx.lineTo(cx, cy + boxD);
      ctx.lineTo(cx, cy + boxD - height);
      ctx.lineTo(cx + boxW, cy - height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Top face
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, cy - boxD - height);
      ctx.lineTo(cx + boxW, cy - height);
      ctx.lineTo(cx, cy + boxD - height);
      ctx.lineTo(cx - boxW, cy - height);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Command Hub rotating dish / Shaft pulsing beacon
    if (tile.buildingType === 'COMMAND_HUB') {
      const ang = nowSec * 2.2;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - height - 2);
      ctx.lineTo(cx + Math.cos(ang) * 9 * scale, cy - height - 10 * scale);
      ctx.stroke();
    } else if (tile.buildingType === 'ACCESS_SHAFT') {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cx - 3 * scale, cy - height - 3 * scale, 6 * scale, 6 * scale);
    }

    ctx.restore();

    // Status Overlay Badges (CONSTRUCTING countdown / UNLINKED warning / OFFLINE)
    if (tile.status === 'CONSTRUCTING') {
      ctx.fillStyle = '#00f0ff';
      ctx.font = `bold ${Math.max(9, Math.round(10 * scale))}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`⏳ ${tile.remainingBuildSec}s`, cx, cy - height - 6);
    } else if (!tile.isConnected && tile.status === 'ACTIVE') {
      const blink = Math.sin(nowSec * 6) > 0;
      if (blink) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = `bold ${Math.max(9, Math.round(10 * scale))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ UNLINKED', cx, cy - height - 6);
      }
    } else if (tile.status === 'OFFLINE') {
      ctx.fillStyle = '#f87171';
      ctx.font = `bold ${Math.max(9, Math.round(10 * scale))}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('OFFLINE', cx, cy - height - 6);
    }
  }
}

