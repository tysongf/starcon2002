import { AudioEngine } from '../audio/AudioEngine';
import { apiClient } from '../network/ApiClient';

export interface StationMarketCallbacks {
  audio: AudioEngine;
  showApNotification: (msg: string, isError?: boolean) => void;
  getCurrentSectorId: () => number;
  getPlayerCredits: () => number;
  setPlayerCredits: (credits: number) => void;
  onCargoUpdated: (usedCargo: number, capacity: number, hold: Array<{ commodity_id: string; name: string; quantity: number }>) => void;
}

/**
 * Encapsulates Station Commodity Exchange ordering, Market Feed rendering,
 * Player Cargo Hold tracking, and Market Toast alerts.
 */
export class StationMarketController {
  private audio: AudioEngine;
  private callbacks: StationMarketCallbacks;

  public currentMarketPortId: string | null = null;
  public currentMarketItems: any[] = [];
  public playerCargoCapacity: number = 40;
  public playerUsedCargo: number = 0;
  public playerCargoHold: Array<{ commodity_id: string; name: string; quantity: number }> = [];

  private initialSessionCredits: number = 2500;
  private hasInitialCreditsSet: boolean = false;
  private sessionArbitrageProfit: number = 0;

  private modalMarketExchange: HTMLElement | null = null;
  private modalMarketPlayerCredits: HTMLElement | null = null;
  private modalMarketPlayerCargo: HTMLElement | null = null;
  private modalCargoDisplay: HTMLElement | null = null;
  private marketToast: HTMLElement | null = null;
  private marketToastTimer: number | null = null;

  private elTelemetryCredits: HTMLElement | null = null;
  private elTelemetryCargo: HTMLElement | null = null;
  private elTelemetryNetWorth: HTMLElement | null = null;
  private elTelemetryProfit: HTMLElement | null = null;
  private elContractsPlayerCredits: HTMLElement | null = null;

  constructor(callbacks: StationMarketCallbacks) {
    this.audio = callbacks.audio;
    this.callbacks = callbacks;
    this.bindDOM();
  }

  private bindDOM(): void {
    this.modalMarketExchange = document.getElementById('modal-market-exchange');
    this.modalMarketPlayerCredits = document.getElementById('market-player-credits');
    this.modalMarketPlayerCargo = document.getElementById('market-player-cargo');
    this.modalCargoDisplay = document.getElementById('modal-cargo-display');
    this.marketToast = document.getElementById('market-toast');
    this.elTelemetryCredits = document.getElementById('val-telemetry-credits');
    this.elTelemetryCargo = document.getElementById('val-telemetry-cargo');
    this.elTelemetryNetWorth = document.getElementById('val-telemetry-networth');
    this.elTelemetryProfit = document.getElementById('val-telemetry-profit');
    this.elContractsPlayerCredits = document.getElementById('contracts-player-credits');
  }

  public syncCreditDisplays(credits: number): void {
    const formatted = `${credits.toLocaleString('en-US')} Cr`;
    if (this.modalMarketPlayerCredits) this.modalMarketPlayerCredits.textContent = formatted;
    if (this.elTelemetryCredits) this.elTelemetryCredits.textContent = formatted;
    if (this.elContractsPlayerCredits) this.elContractsPlayerCredits.textContent = formatted;
  }

  public async refreshPlayerHold(): Promise<void> {
    const accountId = apiClient.getAccountId();
    if (!accountId) return;

    try {
      const res = await fetch(`/api/player/hold?playerId=${encodeURIComponent(accountId)}`);
      if (res.ok) {
        const hold = await res.json();
        if (!this.hasInitialCreditsSet) {
          this.initialSessionCredits = hold.credits;
          this.hasInitialCreditsSet = true;
        }
        this.callbacks.setPlayerCredits(hold.credits);
        this.playerCargoCapacity = hold.cargoCapacity;
        this.playerUsedCargo = hold.usedCargo;
        this.playerCargoHold = hold.cargo || [];
        this.sessionArbitrageProfit = hold.credits - this.initialSessionCredits;
        this.updateHoldUI();
      }
    } catch (err) {
      console.warn('[HOLD] Failed to load hold:', err);
    }
  }

  public updateHoldUI(): void {
    const credits = this.callbacks.getPlayerCredits();
    const cargoRatio = `${this.playerUsedCargo} / ${this.playerCargoCapacity} m³`;

    const estimatedCargoVal = this.playerCargoHold.reduce((sum, item) => {
      const match = this.currentMarketItems.find((i) => i.commodity_id === item.commodity_id);
      const unitVal = match ? match.sell_price : 35;
      return sum + item.quantity * unitVal;
    }, 0);
    const netWorth = Math.round(credits + estimatedCargoVal);

    this.syncCreditDisplays(credits);
    this.callbacks.onCargoUpdated(this.playerUsedCargo, this.playerCargoCapacity, this.playerCargoHold);

    if (this.elTelemetryCargo) this.elTelemetryCargo.textContent = cargoRatio;
    if (this.elTelemetryNetWorth) this.elTelemetryNetWorth.textContent = `${netWorth.toLocaleString('en-US')} Cr`;
    if (this.elTelemetryProfit) {
      const sign = this.sessionArbitrageProfit >= 0 ? '+' : '';
      this.elTelemetryProfit.textContent = `${sign}${this.sessionArbitrageProfit.toLocaleString('en-US')} Cr`;
      this.elTelemetryProfit.style.color = this.sessionArbitrageProfit > 0 ? '#34d399' : '#94a3b8';
    }
    if (this.modalMarketPlayerCargo) this.modalMarketPlayerCargo.textContent = cargoRatio;
    if (this.modalCargoDisplay) this.modalCargoDisplay.textContent = cargoRatio;
  }

  public showMarketToast(message: string, isError: boolean = false): void {
    if (!this.marketToast) return;
    if (this.marketToastTimer) {
      clearTimeout(this.marketToastTimer);
      this.marketToastTimer = null;
    }

    this.marketToast.textContent = message;
    this.marketToast.className = `market-toast ${isError ? 'error' : 'success'}`;
    this.marketToastTimer = window.setTimeout(() => {
      if (this.marketToast) {
        this.marketToast.className = 'market-toast hidden';
      }
    }, 4500);
  }

  public async loadPortInventory(portId?: string): Promise<void> {
    const sectorId = this.callbacks.getCurrentSectorId();
    const targetPort = portId || (sectorId === 1 ? 'PORT_AEGIS_01' : sectorId === 3 ? 'PORT_SMELTER_01' : null);
    this.currentMarketPortId = targetPort;

    if (!targetPort) {
      if (this.modalMarketExchange) {
        this.modalMarketExchange.innerHTML = `<div class="market-loading-hint">⚠️ NO COMMERCIAL EXCHANGE IN THIS SECTOR</div>`;
      }
      return;
    }

    const accountId = apiClient.getAccountId();
    if (!accountId) return;

    try {
      const res = await fetch(`/api/ports/${targetPort}/market?playerId=${encodeURIComponent(accountId)}`);
      if (res.ok) {
        const data = await res.json();
        this.currentMarketItems = data.items || [];
        if (data.hold) {
          this.callbacks.setPlayerCredits(data.hold.credits);
          this.playerCargoCapacity = data.hold.cargoCapacity;
          this.playerUsedCargo = data.hold.usedCargo;
          this.playerCargoHold = data.hold.cargo || [];
          this.updateHoldUI();
        }
        this.renderMarketExchange(targetPort, this.currentMarketItems);
      } else if (this.modalMarketExchange) {
        this.modalMarketExchange.innerHTML = `<div class="market-loading-hint">Failed to load market telemetry.</div>`;
      }
    } catch (err) {
      console.warn('[MARKET] Failed to load market:', err);
    }
  }

  private renderMarketExchange(portId: string, items: any[]): void {
    if (!this.modalMarketExchange) return;
    if (items.length === 0) {
      this.modalMarketExchange.innerHTML = `<div class="market-loading-hint">No commodities registered at this terminal.</div>`;
      return;
    }

    const freeSpace = Math.max(0, this.playerCargoCapacity - this.playerUsedCargo);
    const credits = this.callbacks.getPlayerCredits();

    this.modalMarketExchange.innerHTML = items
      .map((item) => {
        const canAfford = credits >= item.buy_price;
        const canBuy = freeSpace > 0 && canAfford && item.stock > 0;
        const canSell = item.player_cargo > 0;

        return `
          <div class="comm-item-card" data-commodity="${item.commodity_id}">
            <div class="comm-header-row">
              <div class="comm-name-group">
                <span class="comm-name">${item.name}</span>
                <span class="comm-category-badge ${item.category}">${item.category.replace('_', ' ')}</span>
              </div>
              <div class="comm-player-hold">HOLD: <strong>${item.player_cargo}</strong></div>
            </div>

            <div class="comm-details-row">
              <div class="comm-prices">
                <div class="price-tag buy">
                  <span class="p-label">BUY</span>
                  <span class="p-val">${item.buy_price.toFixed(1)} Cr</span>
                  ${item.rep_modifier_label ? `<span class="rep-tariff-badge ${item.rep_multiplier < 1.0 ? 'discount' : 'tariff'}">${item.rep_modifier_label}</span>` : ''}
                </div>
                <div class="price-tag sell">
                  <span class="p-label">SELL</span>
                  <span class="p-val">${item.sell_price.toFixed(1)} Cr</span>
                </div>
              </div>
              <div class="comm-stock-info">STOCK: <span class="stock-val">${item.stock} / ${item.capacity}</span></div>
            </div>

            <div class="comm-actions-row">
              <div class="comm-stepper">
                <button class="stepper-btn btn-step-down" data-action="dec" title="Decrease quantity">-</button>
                <input type="number" class="stepper-input" value="1" min="1" max="40" />
                <button class="stepper-btn btn-step-up" data-action="inc" title="Increase quantity">+</button>
                <button class="stepper-max-btn" data-action="max" title="Max buyable / sellable units">MAX</button>
              </div>
              <div class="comm-trade-buttons">
                <button class="btn-trade buy" data-action="buy" ${!canBuy ? 'disabled' : ''} title="Purchase from Port">BUY</button>
                <button class="btn-trade sell" data-action="sell" ${!canSell ? 'disabled' : ''} title="Sell to Port">SELL</button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    this.modalMarketExchange.querySelectorAll('.comm-item-card').forEach((card) => {
      const commId = card.getAttribute('data-commodity');
      if (!commId) return;

      const input = card.querySelector('.stepper-input') as HTMLInputElement;
      const btnDec = card.querySelector('.btn-step-down') as HTMLButtonElement;
      const btnInc = card.querySelector('.btn-step-up') as HTMLButtonElement;
      const btnMax = card.querySelector('.stepper-max-btn') as HTMLButtonElement;
      const btnBuy = card.querySelector('.btn-trade.buy') as HTMLButtonElement;
      const btnSell = card.querySelector('.btn-trade.sell') as HTMLButtonElement;

      const item = items.find((i) => i.commodity_id === commId);
      if (!item) return;

      const getQty = () => {
        const val = parseInt(input.value, 10);
        return isNaN(val) || val < 1 ? 1 : val;
      };

      btnDec?.addEventListener('click', () => {
        input.value = String(Math.max(1, getQty() - 1));
        this.audio.playUiBlip();
      });

      btnInc?.addEventListener('click', () => {
        input.value = String(getQty() + 1);
        this.audio.playUiBlip();
      });

      btnMax?.addEventListener('click', () => {
        const currentFree = Math.max(0, this.playerCargoCapacity - this.playerUsedCargo);
        const maxAffordable = Math.floor(this.callbacks.getPlayerCredits() / item.buy_price);
        const buyLimit = Math.min(item.stock, currentFree, maxAffordable);
        input.value = String(Math.max(1, Math.max(buyLimit, item.player_cargo)));
        this.audio.playUiBlip();
      });

      input?.addEventListener('change', () => {
        input.value = String(getQty());
      });

      btnBuy?.addEventListener('click', () => this.executeTrade(portId, commId, getQty(), 'BUY'));
      btnSell?.addEventListener('click', () => this.executeTrade(portId, commId, getQty(), 'SELL'));
    });
  }

  public async executeTrade(portId: string, commodityId: string, quantity: number, type: 'BUY' | 'SELL'): Promise<void> {
    if (quantity <= 0) return;

    try {
      const res = await fetch(`/api/ports/${portId}/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: apiClient.getAccountId(),
          commodityId,
          quantity,
          type,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (type === 'BUY') this.audio.playTradeBuySound();
        else this.audio.playTradeSellSound();

        const actionText = type === 'BUY' ? 'Purchased' : 'Sold';
        const costText = type === 'BUY' ? `-${data.totalCredits} Cr` : `+${data.totalCredits} Cr`;
        this.showMarketToast(`✓ ${actionText} ${data.quantity}x ${data.commodityName} (${costText})`, false);

        if (data.hold) {
          this.callbacks.setPlayerCredits(data.hold.credits);
          this.playerCargoCapacity = data.hold.cargoCapacity;
          this.playerUsedCargo = data.hold.usedCargo;
          this.playerCargoHold = data.hold.cargo || [];
          this.updateHoldUI();
        }

        if (Array.isArray(data.updatedInventory)) {
          this.currentMarketItems = data.updatedInventory;
          this.renderMarketExchange(portId, this.currentMarketItems);
        } else {
          await this.loadPortInventory(portId);
        }
      } else {
        this.audio.playApWarningSound();
        let errMsg = `⚠️ Trade Error: ${data.error || 'Server rejected order'}`;
        if (data.error === 'INSUFFICIENT_CREDITS') errMsg = `⚠️ Insufficient Credits! Requires ${data.requiredCredits || ''} Cr.`;
        else if (data.error === 'HOLD_CAPACITY_EXCEEDED' || data.error === 'CARGO_BAY_FULL')
          errMsg = `⚠️ Cargo Bay Full! Only ${data.freeCargo || 0} m³ available.`;
        else if (data.error === 'INSUFFICIENT_STOCK') errMsg = `⚠️ Station has insufficient stock (${data.availableStock || 0} available).`;
        else if (data.error === 'INSUFFICIENT_CARGO') errMsg = `⚠️ Insufficient Cargo in hold (${data.availableCargo || 0} in hold).`;
        else if (data.error === 'OUT_OF_RANGE') errMsg = `⚠️ Trade Out of Range! Vessel must be docked in same sector.`;
        this.showMarketToast(errMsg, true);
      }
    } catch (err) {
      console.error('[TRADE] Trade execution failed:', err);
      this.audio.playApWarningSound();
      this.showMarketToast('⚠️ Network failure during transaction', true);
    }
  }
}
