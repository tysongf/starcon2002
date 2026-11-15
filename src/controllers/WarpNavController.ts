import * as THREE from 'three';
import { AudioEngine } from '../audio/AudioEngine';
import { apiClient } from '../network/ApiClient';

export interface AdjacentSectorInfo {
  id: number;
  name: string;
  system_seed: number;
  controlling_faction: string;
  connected_sectors: number[];
}

export interface WarpNavCallbacks {
  audio: AudioEngine;
  showApNotification: (msg: string, isError?: boolean) => void;
  getCurrentSectorId: () => number;
  getCurrentSectorName: () => string;
  getAdjacentSectors: () => AdjacentSectorInfo[];
  getShipFuel: () => number;
  getMaxShipFuel: () => number;
  getCurrentAP: () => number;
  setSectorAndFuel: (sectorId: number, sectorName: string, fuel: number, ap: number) => void;
  getCamera: () => THREE.PerspectiveCamera;
  getBaseFov: () => number;
  loadSectorScene: (sectorId: number, seed: number) => void;
  loadShipAndSector: () => Promise<void>;
  updateHudSectorAllegiance: () => void;
}

/**
 * Encapsulates Warp Navigation Computer modal, jump lane validation,
 * traffic & arbitrage radar feeds, and warp jump camera transition.
 */
export class WarpNavController {
  private audio: AudioEngine;
  private callbacks: WarpNavCallbacks;

  public isWarping: boolean = false;
  public warpAnimationTime: number = 0;

  private modalNav: HTMLElement | null = null;
  private btnCloseNav: HTMLElement | null = null;
  private navLanesList: HTMLElement | null = null;
  private navCurrentSectorTitle: HTMLElement | null = null;
  private navCurrentSectorSubtext: HTMLElement | null = null;
  private navFuelDisplay: HTMLElement | null = null;
  private navRadarRoutes: HTMLElement | null = null;
  private activeRadarTab: 'TRAFFIC' | 'COMMERCE' = 'TRAFFIC';

  constructor(callbacks: WarpNavCallbacks) {
    this.audio = callbacks.audio;
    this.callbacks = callbacks;
    this.bindDOM();
  }

  private bindDOM(): void {
    this.modalNav = document.getElementById('nav-modal');
    this.btnCloseNav = document.getElementById('btn-close-nav');
    this.navLanesList = document.getElementById('nav-lanes-list');
    this.navCurrentSectorTitle = document.getElementById('nav-current-sector-title');
    this.navCurrentSectorSubtext = document.getElementById('nav-current-sector-subtext');
    this.navFuelDisplay = document.getElementById('nav-fuel-display');
    this.navRadarRoutes = document.getElementById('nav-radar-routes');

    this.btnCloseNav?.addEventListener('click', () => this.closeNavModal());

    const tabTraffic = document.getElementById('tab-radar-traffic');
    const tabCommerce = document.getElementById('tab-radar-commerce');
    tabTraffic?.addEventListener('click', () => {
      this.activeRadarTab = 'TRAFFIC';
      tabTraffic.classList.add('active');
      tabCommerce?.classList.remove('active');
      this.loadRadarFeed();
    });
    tabCommerce?.addEventListener('click', () => {
      this.activeRadarTab = 'COMMERCE';
      tabCommerce.classList.add('active');
      tabTraffic?.classList.remove('active');
      this.loadRadarFeed();
    });
  }

  public isOpen(): boolean {
    return !!this.modalNav && !this.modalNav.classList.contains('hidden');
  }

  public openNavModal(): void {
    if (this.isWarping || !this.modalNav) return;

    const currentSectorId = this.callbacks.getCurrentSectorId();
    const currentSectorName = this.callbacks.getCurrentSectorName();
    const adjacentSectors = this.callbacks.getAdjacentSectors();

    this.audio.playUiBlip();
    this.modalNav.classList.remove('hidden');

    if (this.navCurrentSectorTitle) {
      this.navCurrentSectorTitle.textContent = `SECTOR 0${currentSectorId} // ${currentSectorName.toUpperCase()}`;
    }
    if (this.navCurrentSectorSubtext) {
      const faction =
        currentSectorId === 1 ? 'SOL-PERIMETER LEAGUE' : currentSectorId === 2 ? 'UNCLAIMED VOID / HAZARD' : 'THE LITHOS AXIOM';
      this.navCurrentSectorSubtext.textContent = `SYSTEM SEED: ${currentSectorId * 101} // JURISDICTION: ${faction}`;
    }
    if (this.navFuelDisplay) {
      this.navFuelDisplay.textContent = `FUEL: ${this.callbacks.getShipFuel()} / ${this.callbacks.getMaxShipFuel()}`;
    }

    [1, 2, 3].forEach((id) => {
      document.getElementById(`node-sec-${id}`)?.classList.toggle('active', id === currentSectorId);
    });

    if (this.navLanesList) {
      if (adjacentSectors.length === 0) {
        this.navLanesList.innerHTML = `<div class="nav-lane-card"><span class="nav-lane-target">NO ADJACENT WARP LANES DETECTED</span></div>`;
        return;
      }

      this.navLanesList.innerHTML = adjacentSectors
        .map(
          (sec) => `
          <div class="nav-lane-card">
            <div class="nav-lane-info">
              <span class="nav-lane-target">SEC-0${sec.id} // ${sec.name.toUpperCase()}</span>
              <span class="nav-lane-details">FACTION: ${sec.controlling_faction.replace('FACTION_', '')} // SYSTEM SEED: ${sec.system_seed}</span>
              <span class="nav-lane-cost">⚡ Warp Cost: 5 AP + 1 Fuel</span>
            </div>
            <button class="hud-btn jump-btn" data-target-id="${sec.id}">ENGAGE JUMP 🚀</button>
          </div>
        `
        )
        .join('');

      this.navLanesList.querySelectorAll('.jump-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const targetId = parseInt((e.currentTarget as HTMLElement).getAttribute('data-target-id') || '0', 10);
          if (targetId > 0) this.executeWarpJump(targetId);
        });
      });
    }

    this.loadRadarFeed();
  }

  public closeNavModal(): void {
    this.modalNav?.classList.add('hidden');
  }

  private loadRadarFeed(): void {
    if (this.activeRadarTab === 'TRAFFIC') this.loadTrafficRadar();
    else this.loadCommerceRadar();
  }

  private async loadCommerceRadar(): Promise<void> {
    if (!this.navRadarRoutes) return;
    try {
      const res = await fetch('/api/market/intel');
      if (res.ok) {
        const intel = await res.json();
        if (intel.arbitrage && intel.arbitrage.length > 0) {
          this.navRadarRoutes.innerHTML = intel.arbitrage
            .slice(0, 4)
            .map(
              (arb: any) => `
              <div class="radar-arbitrage-card">
                <div class="radar-route-info">
                  <span class="radar-route-title">${arb.commodityName}</span>
                  <span class="radar-route-path">SEC-0${arb.fromSectorId} (${arb.fromPortName}) ➔ SEC-0${arb.toSectorId} (${arb.toPortName})</span>
                </div>
                <div class="radar-route-profit">
                  <span class="profit-badge">+${arb.profitPerUnit.toFixed(1)} Cr</span>
                  <span class="profit-label">SPREAD / UNIT</span>
                </div>
              </div>
            `
            )
            .join('');
        } else {
          this.navRadarRoutes.innerHTML = `<div class="radar-loading">No active market disparities detected.</div>`;
        }
      }
    } catch {
      this.navRadarRoutes.innerHTML = `<div class="radar-loading">Subspace commerce relay offline.</div>`;
    }
  }

  private async loadTrafficRadar(): Promise<void> {
    if (!this.navRadarRoutes) return;
    try {
      const res = await fetch('/api/convoys/traffic');
      if (res.ok) {
        const data = await res.json();
        let html = '';
        if (data.skirmishes && data.skirmishes.length > 0) {
          const sk = data.skirmishes[0];
          html += `
            <div class="radar-skirmish-banner">
              <span>⚠️ SEC-0${sk.sector_id} CONFLICT ZONE: ${sk.initiator_faction_id === 'FACTION_VAELIC' ? 'Vaelic Hegemony' : sk.initiator_faction_id} vs ${
            sk.defender_faction_id === 'FACTION_KRYLL' ? 'Kryll Cartel' : sk.defender_faction_id
          }</span>
              <span class="profit-badge" style="color: #ef4444;">${sk.hazard_level} RISK</span>
            </div>
          `;
        }
        if (data.convoys && data.convoys.length > 0) {
          html += data.convoys
            .map((convoy: any) => {
              const manifestSummary = convoy.cargo_manifest.map((m: any) => `${m.quantity}x ${m.name}`).join(', ');
              const progressPercent = Math.min(100, Math.max(0, Math.round((convoy.transitProgress || 0) * 100)));
              return `
                <div class="radar-convoy-card">
                  <div class="radar-route-info" style="flex: 1; margin-right: 0.75rem;">
                    <span class="radar-route-title">${convoy.name}</span>
                    <span class="radar-route-path">SEC-0${convoy.current_sector_id} ➔ Target: SEC-0${convoy.target_sector_id || convoy.current_sector_id} (Shield: ${convoy.escort_count}x Escorts)</span>
                    <span class="convoy-manifest-summary">📦 Cargo: ${manifestSummary} (~${convoy.totalCargoValue} Cr)</span>
                    <div class="radar-eta-container">
                      <div class="radar-eta-bar" style="width: ${progressPercent}%;"></div>
                    </div>
                  </div>
                  <div class="radar-route-profit">
                    <span class="convoy-badge-transit">ETA ${convoy.etaSeconds}s</span>
                    <span class="profit-label">${convoy.status}</span>
                  </div>
                </div>
              `;
            })
            .join('');
        } else {
          html += `<div class="radar-loading">No active faction convoys detected in local sectors.</div>`;
        }
        this.navRadarRoutes.innerHTML = html;
        this.updateTopologyRadarDecorations(data.convoys || [], data.skirmishes || []);
      }
    } catch {
      this.navRadarRoutes.innerHTML = `<div class="radar-loading">Subspace traffic relay offline.</div>`;
    }
  }

  private updateTopologyRadarDecorations(convoys: any[], skirmishes: any[]): void {
    [1, 2, 3].forEach((sectorId) => {
      const node = document.getElementById(`node-sec-${sectorId}`);
      if (node) {
        node.classList.remove('has-skirmish');
        node.querySelector('.skirmish-node-badge')?.remove();
      }
    });

    skirmishes.forEach((sk: any) => {
      const node = document.getElementById(`node-sec-${sk.sector_id}`);
      if (node && !node.querySelector('.skirmish-node-badge')) {
        node.classList.add('has-skirmish');
        const badge = document.createElement('div');
        badge.className = 'skirmish-node-badge';
        badge.textContent = '⚔️ CONTESTED';
        node.appendChild(badge);
      }
    });

    document.querySelectorAll('.convoy-pip').forEach((pip) => pip.remove());

    convoys.forEach((convoy: any) => {
      const cur = convoy.current_sector_id;
      const tgt = convoy.target_sector_id;
      const progress = typeof convoy.transitProgress === 'number' ? convoy.transitProgress : 0.5;

      let targetEl: HTMLElement | null = null;
      let pipLeft = 50;

      if ((cur === 1 && tgt === 2) || (cur === 2 && tgt === 1)) {
        targetEl = document.getElementById('lane-1-2');
        const normalized = cur === 1 ? progress : 1 - progress;
        pipLeft = Math.min(85, Math.max(15, normalized * 100));
      } else if ((cur === 2 && tgt === 3) || (cur === 3 && tgt === 2)) {
        targetEl = document.getElementById('lane-2-3');
        const normalized = cur === 2 ? progress : 1 - progress;
        pipLeft = Math.min(85, Math.max(15, normalized * 100));
      } else {
        targetEl = document.getElementById(`node-sec-${cur}`);
      }

      if (targetEl) {
        const pip = document.createElement('div');
        pip.className = 'convoy-pip';
        pip.textContent = '🚛';
        pip.setAttribute('data-tooltip', `${convoy.name} (ETA ${convoy.etaSeconds}s)`);
        if (targetEl.classList.contains('lane-connector')) {
          pip.style.left = `${pipLeft}%`;
        } else {
          pip.style.top = '-14px';
          pip.style.right = '-6px';
        }
        targetEl.appendChild(pip);
      }
    });
  }

  public async executeWarpJump(targetSectorId: number): Promise<void> {
    if (this.isWarping) return;
    this.closeNavModal();

    if (this.callbacks.getCurrentAP() < 5) {
      this.audio.playApWarningSound();
      this.callbacks.showApNotification('⚠️ INSUFFICIENT ACTION POINTS (Requires 5 AP to jump)', true);
      return;
    }
    if (this.callbacks.getShipFuel() < 1) {
      this.audio.playApWarningSound();
      this.callbacks.showApNotification('⚠️ INSUFFICIENT FUEL (Requires 1 unit Deuterium)', true);
      return;
    }

    this.isWarping = true;
    this.warpAnimationTime = 0;
    this.audio.playWarpDriveEngage();
    this.callbacks.showApNotification(`🌌 ENGAGING HYPERSPACE JUMP -> SEC-0${targetSectorId}...`, false);

    const camera = this.callbacks.getCamera();
    const baseFov = this.callbacks.getBaseFov();

    try {
      const res = await fetch('/api/navigate/jump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: apiClient.getAccountId(), targetSectorId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.isWarping = false;
        camera.fov = baseFov;
        camera.updateProjectionMatrix();
        this.audio.playApWarningSound();
        this.callbacks.showApNotification(`⚠️ ${data.error || 'WARP JUMP REJECTED'}`, true);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1100));

      this.callbacks.setSectorAndFuel(data.toSector.id, data.toSector.name, data.remainingFuel, data.currentAP);
      this.callbacks.loadSectorScene(data.toSector.id, data.toSector.system_seed);
      await this.callbacks.loadShipAndSector();
      this.callbacks.updateHudSectorAllegiance();

      this.audio.playWarpExitChime();
      this.callbacks.showApNotification(`🚀 WARP COMPLETE // ENTERED SEC-0${data.toSector.id} (${data.toSector.name})`, false);

      setTimeout(() => {
        this.isWarping = false;
        camera.fov = baseFov;
        camera.updateProjectionMatrix();
      }, 500);
    } catch (err) {
      this.isWarping = false;
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
      console.error('[WARP] Jump failed:', err);
      this.callbacks.showApNotification('⚠️ SUB-SPACE TRANSIT COLLAPSE', true);
    }
  }
}

