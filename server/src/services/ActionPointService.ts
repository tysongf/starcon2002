import { cache } from '../cache/CacheManager';

export interface ActionPointState {
  playerId: string;
  currentAP: number;
  maxAP: number;
  lastRegenAt: number;        // Epoch timestamp (ms)
  nextRegenSeconds: number;   // Seconds remaining until next +1 AP
}

export type ActionType = 'SECTOR_WARP' | 'DEEP_WARP' | 'ORBITAL_SCAN' | 'EXTRACTION' | 'HAGGLE';

export const AP_COSTS: Record<ActionType, number> = {
  SECTOR_WARP: 5,
  DEEP_WARP: 12,
  ORBITAL_SCAN: 3,
  EXTRACTION: 8,
  HAGGLE: 1,
};

export interface SpendResult {
  success: boolean;
  action: string;
  cost: number;
  currentAP: number;
  maxAP: number;
  nextRegenSeconds: number;
  error?: string;
}

/**
 * High-performance Action Point (AP) service with atomic spend validation
 * and deterministic timestamp-based regeneration (1 AP per 60 seconds).
 */
export class ActionPointService {
  public static readonly MAX_AP = 600;       // Max 10 hours stored capacity
  public static readonly REGEN_INTERVAL_MS = 60000; // 60 seconds per 1 AP

  // In-memory mutex locks per player ID to prevent race conditions across async tasks
  private locks: Map<string, Promise<void>> = new Map();

  /**
   * Acquires an async mutex lock for a specific player ID
   */
  private async acquireLock(playerId: string): Promise<() => void> {
    while (this.locks.has(playerId)) {
      await this.locks.get(playerId);
    }

    let release: () => void = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.locks.set(playerId, lockPromise);

    return () => {
      this.locks.delete(playerId);
      release();
    };
  }

  /**
   * Fetches or initializes player AP state with dynamic timestamp-based regeneration
   */
  public async getAP(playerId: string): Promise<ActionPointState> {
    const key = `ap:${playerId}`;
    const raw = await cache.get(key);
    const now = Date.now();

    let state: { current: number; max: number; lastRegenAt: number };

    if (raw) {
      state = JSON.parse(raw);
    } else {
      // Default initial state: full 600 AP
      state = {
        current: ActionPointService.MAX_AP,
        max: ActionPointService.MAX_AP,
        lastRegenAt: now,
      };
    }

    // Dynamic regeneration calculation
    const elapsedMs = now - state.lastRegenAt;
    if (elapsedMs >= ActionPointService.REGEN_INTERVAL_MS && state.current < state.max) {
      const addedAP = Math.floor(elapsedMs / ActionPointService.REGEN_INTERVAL_MS);
      state.current = Math.min(state.max, state.current + addedAP);
      state.lastRegenAt += addedAP * ActionPointService.REGEN_INTERVAL_MS;
      await cache.set(key, JSON.stringify(state));
    }

    const msUntilNext = state.current >= state.max
      ? 0
      : Math.max(0, ActionPointService.REGEN_INTERVAL_MS - (now - state.lastRegenAt));
    const nextRegenSeconds = Math.ceil(msUntilNext / 1000);

    return {
      playerId,
      currentAP: state.current,
      maxAP: state.max,
      lastRegenAt: state.lastRegenAt,
      nextRegenSeconds,
    };
  }

  /**
   * Atomically validates and spends AP under mutex protection
   */
  public async spendAP(
    playerId: string,
    action: ActionType,
    customCost?: number
  ): Promise<SpendResult> {
    const cost = customCost !== undefined ? customCost : AP_COSTS[action] ?? 5;
    const releaseLock = await this.acquireLock(playerId);

    try {
      // Retrieve current regenerated state
      const state = await this.getAP(playerId);

      if (state.currentAP < cost) {
        return {
          success: false,
          action,
          cost,
          currentAP: state.currentAP,
          maxAP: state.maxAP,
          nextRegenSeconds: state.nextRegenSeconds,
          error: `INSUFFICIENT_ACTION_POINTS (Requires ${cost} AP, currently have ${state.currentAP} AP)`,
        };
      }

      // Deduct atomically
      const newBalance = state.currentAP - cost;
      const key = `ap:${playerId}`;
      const updatedData = {
        current: newBalance,
        max: state.maxAP,
        lastRegenAt: state.lastRegenAt,
      };

      await cache.set(key, JSON.stringify(updatedData));

      return {
        success: true,
        action,
        cost,
        currentAP: newBalance,
        maxAP: state.maxAP,
        nextRegenSeconds: state.nextRegenSeconds,
      };
    } finally {
      releaseLock();
    }
  }

  /**
   * Directly sets AP balance (used for testing and admin overrides)
   */
  public async debugSetAP(playerId: string, amount: number): Promise<ActionPointState> {
    const releaseLock = await this.acquireLock(playerId);
    try {
      const key = `ap:${playerId}`;
      const clamped = Math.max(0, Math.min(ActionPointService.MAX_AP, amount));
      const updatedData = {
        current: clamped,
        max: ActionPointService.MAX_AP,
        lastRegenAt: Date.now(),
      };
      await cache.set(key, JSON.stringify(updatedData));
      return {
        playerId,
        currentAP: clamped,
        maxAP: ActionPointService.MAX_AP,
        lastRegenAt: updatedData.lastRegenAt,
        nextRegenSeconds: clamped >= ActionPointService.MAX_AP ? 0 : 60,
      };
    } finally {
      releaseLock();
    }
  }
}

export const apService = new ActionPointService();
