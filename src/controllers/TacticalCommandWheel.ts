import { AudioEngine } from '../audio/AudioEngine';
import { CombatClient } from './CombatClient';

export type TacticalOrderType = 'FORMATION_FOLLOW' | 'FOCUS_TARGET' | 'ESCORT_FLAGSHIP' | 'FLANK_HARASS' | 'REGROUP_HOLD';

export class TacticalCommandWheel {
  private overlayEl: HTMLElement | null = null;
  private activeDirectiveEl: HTMLElement | null = null;
  private bannerEl: HTMLElement | null = null;
  private bannerOrderEl: HTMLElement | null = null;
  private squadronBadgeEl: HTMLElement | null = null;
  private squadronListEl: HTMLElement | null = null;
  private wedges: NodeListOf<HTMLElement> | null = null;

  public isOpen: boolean = false;
  public selectedOrder: TacticalOrderType | null = null;
  public currentActiveOrder: TacticalOrderType = 'FORMATION_FOLLOW';

  private combatClient: CombatClient;
  private audio: AudioEngine;
  private bannerTimeout: any = null;
  private lastHoveredWedge: string | null = null;

  constructor(combatClient: CombatClient, audio: AudioEngine) {
    this.combatClient = combatClient;
    this.audio = audio;

    this.initElements();
    this.bindEvents();
  }

  private initElements(): void {
    this.overlayEl = document.getElementById('tactical-command-wheel');
    this.activeDirectiveEl = document.getElementById('wheel-active-directive');
    this.bannerEl = document.getElementById('tactical-order-banner');
    this.bannerOrderEl = document.getElementById('tactical-banner-order');
    this.squadronBadgeEl = document.getElementById('squadron-order-badge');
    this.squadronListEl = document.getElementById('squadron-wingmen-list');
    this.wedges = document.querySelectorAll('.wheel-wedge');
  }

  private bindEvents(): void {
    if (!this.overlayEl) return;

    // Track mouse movement over the radial overlay to determine active quadrant
    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isOpen || !this.overlayEl) return;

      const rect = this.overlayEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const dist = Math.hypot(dx, dy);

      // Deadzone near exact center (radius < 45px)
      if (dist < 45) {
        this.clearWedgeHighlights();
        this.selectedOrder = null;
        return;
      }

      // Determine angle in radians (-PI to PI) where 0 is East, PI/2 is South, -PI/2 is North
      const angle = Math.atan2(dy, dx);
      let order: TacticalOrderType = 'FORMATION_FOLLOW';

      if (angle >= -Math.PI * 0.75 && angle < -Math.PI * 0.25) {
        // North (-90 deg)
        order = 'FOCUS_TARGET';
      } else if (angle >= -Math.PI * 0.25 && angle < Math.PI * 0.25) {
        // East (0 deg)
        order = 'ESCORT_FLAGSHIP';
      } else if (angle >= Math.PI * 0.25 && angle < Math.PI * 0.75) {
        // South (+90 deg)
        order = 'FLANK_HARASS';
      } else {
        // West (+-180 deg)
        order = 'REGROUP_HOLD';
      }

      this.highlightWedge(order);
    });

    // Clicking a wedge directly selects and commits the order
    if (this.wedges) {
      this.wedges.forEach((wedge) => {
        wedge.addEventListener('click', (e) => {
          e.stopPropagation();
          const order = wedge.getAttribute('data-order') as TacticalOrderType;
          if (order) {
            this.executeOrder(order);
            this.close();
          }
        });
      });
    }
  }

  public open(): void {
    if (this.isOpen || !this.overlayEl) return;
    this.isOpen = true;
    this.overlayEl.classList.remove('hidden');
    this.audio.playTacticalWheelOpenSound();

    if (this.activeDirectiveEl) {
      this.activeDirectiveEl.textContent = this.currentActiveOrder.replace('_', ' ');
    }
  }

  public close(): void {
    if (!this.isOpen || !this.overlayEl) return;
    this.isOpen = false;
    this.overlayEl.classList.add('hidden');

    if (this.selectedOrder) {
      this.executeOrder(this.selectedOrder);
      this.selectedOrder = null;
    }
    this.clearWedgeHighlights();
  }

  public highlightWedge(order: TacticalOrderType): void {
    if (this.lastHoveredWedge !== order) {
      this.audio.playTacticalWheelTickSound();
      this.lastHoveredWedge = order;
    }

    this.selectedOrder = order;

    if (this.wedges) {
      this.wedges.forEach((w) => {
        if (w.getAttribute('data-order') === order) {
          w.classList.add('active-hover');
        } else {
          w.classList.remove('active-hover');
        }
      });
    }

    if (this.activeDirectiveEl) {
      this.activeDirectiveEl.textContent = `TARGET: ${order.replace('_', ' ')}`;
    }
  }

  private clearWedgeHighlights(): void {
    this.lastHoveredWedge = null;
    if (this.wedges) {
      this.wedges.forEach((w) => w.classList.remove('active-hover'));
    }
    if (this.activeDirectiveEl) {
      this.activeDirectiveEl.textContent = this.currentActiveOrder.replace('_', ' ');
    }
  }

  /**
   * Executes tactical directive: sends WebSocket packet, plays audio, and displays HUD banner.
   */
  public executeOrder(order: TacticalOrderType, targetEntityId?: string): void {
    this.currentActiveOrder = order;
    this.combatClient.sendTacticalOrder(order, targetEntityId);
    this.audio.playTacticalOrderConfirmedSound();

    // Show snappy HUD Banner Notification
    if (this.bannerEl && this.bannerOrderEl) {
      this.bannerOrderEl.textContent = order.replace('_', ' ');
      this.bannerEl.classList.remove('hidden');

      if (this.bannerTimeout) {
        clearTimeout(this.bannerTimeout);
      }
      this.bannerTimeout = setTimeout(() => {
        this.bannerEl?.classList.add('hidden');
      }, 2500);
    }

    // Update persistent widget badge
    if (this.squadronBadgeEl) {
      const shortLabels: Record<TacticalOrderType, string> = {
        FORMATION_FOLLOW: 'FOLLOW',
        FOCUS_TARGET: 'FOCUS',
        ESCORT_FLAGSHIP: 'ESCORT',
        FLANK_HARASS: 'FLANK',
        REGROUP_HOLD: 'REGROUP',
      };
      this.squadronBadgeEl.textContent = shortLabels[order] || order;
      this.squadronBadgeEl.className = `widget-order-badge badge-${order.toLowerCase().replace('_', '-')}`;
    }
  }

  /**
   * Update the persistent in-game squadron HUD widget with live telemetry
   */
  public updateSquadronTelemetry(entities: any[]): void {
    if (!this.squadronListEl) return;

    const wingmen = entities.filter((e) => e.type === 'WINGMAN' && e.state !== 'DESTROYED');
    if (wingmen.length === 0) {
      this.squadronListEl.innerHTML = `<div class="no-wingmen-label">NO ACTIVE ESCORTS</div>`;
      return;
    }

    this.squadronListEl.innerHTML = wingmen
      .map((w) => {
        const hpPct = Math.max(0, Math.min(100, (w.hp / w.maxHp) * 100));
        const shieldPct = Math.max(0, Math.min(100, (w.shields / w.maxShields) * 100));
        const slot = w.wingmanSlot || 1;
        const orderTag = (w.tacticalOrder || 'FOLLOW').replace('_', ' ');

        return `
          <div class="wingman-row">
            <div class="wm-slot">W${slot}</div>
            <div class="wm-info">
              <div class="wm-name">${w.name || 'Sol Vanguard'}</div>
              <div class="wm-vitals">
                <div class="wm-bar-track"><div class="wm-shield-fill" style="width: ${shieldPct}%;"></div></div>
                <div class="wm-bar-track"><div class="wm-hull-fill" style="width: ${hpPct}%;"></div></div>
              </div>
            </div>
            <div class="wm-order-tag">${orderTag}</div>
          </div>
        `;
      })
      .join('');
  }
}
