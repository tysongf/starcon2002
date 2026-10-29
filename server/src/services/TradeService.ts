import { db } from '../db/Database';
import { reputationService } from './ReputationService';


export interface CommodityDef {
  id: string;
  name: string;
  basePrice: number;
  category: 'FUEL' | 'CONSUMABLE' | 'RAW_MATERIAL' | 'MANUFACTURED';
  description: string;
}

export const COMMODITIES: Record<string, CommodityDef> = {
  COMM_FUEL: {
    id: 'COMM_FUEL',
    name: 'Deuterium Fuel',
    basePrice: 25,
    category: 'FUEL',
    description: 'Refined cryogenic deuterium isotope for sub-light and warp jump drives.',
  },
  COMM_RATIONS: {
    id: 'COMM_RATIONS',
    name: 'Bio-Protein Rations',
    basePrice: 40,
    category: 'CONSUMABLE',
    description: 'Nutrient-dense synthetic protein blocks sustaining orbital habitats.',
  },
  COMM_ORE: {
    id: 'COMM_ORE',
    name: 'Silicate Ore',
    basePrice: 60,
    category: 'RAW_MATERIAL',
    description: 'Unprocessed heavy silicate mineral rocks mined from asteroids.',
  },
  COMM_ALLOY: {
    id: 'COMM_ALLOY',
    name: 'Plasteel Alloy',
    basePrice: 150,
    category: 'MANUFACTURED',
    description: 'High-tensile structural plating forged in industrial smelters.',
  },
};

export interface MarketItem {
  commodity_id: string;
  name: string;
  description: string;
  category: string;
  stock: number;
  demand: number;
  capacity: number;
  buy_price: number;   // Effective price player pays to purchase 1 unit
  sell_price: number;  // Effective price player receives when selling 1 unit
  base_buy_price?: number;
  base_sell_price?: number;
  rep_multiplier?: number;
  rep_modifier_label?: string; // e.g. "[SOL ALLIANCE DISCOUNT -5%]" or "[HEGEMONY TARIFF +25%]"
  player_cargo: number;// Units currently in player ship hold
}


export interface PlayerHoldStatus {
  playerId: string;
  shipId: string;
  credits: number;
  cargoCapacity: number;
  usedCargo: number;
  freeCargo: number;
  cargo: Array<{ commodity_id: string; name: string; quantity: number }>;
}

export interface TradeResult {
  success: boolean;
  type?: 'BUY' | 'SELL';
  commodityId?: string;
  commodityName?: string;
  quantity?: number;
  unitPrice?: number;
  totalCredits?: number;
  newCredits?: number;
  hold?: PlayerHoldStatus;
  updatedInventory?: MarketItem[];
  error?: string;
}

export class TradeService {
  // In-memory mutex locks per port to ensure atomic inventory and price updates
  private portLocks: Map<string, Promise<void>> = new Map();

  private async acquireLock(portId: string): Promise<() => void> {
    while (this.portLocks.has(portId)) {
      await this.portLocks.get(portId);
    }
    let release: () => void = () => {};
    const p = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.portLocks.set(portId, p);
    return () => {
      this.portLocks.delete(portId);
      release();
    };
  }

  /**
   * Calculates dynamic pricing based on the mathematical supply/demand curve:
   * P_buy = B * (1 + k * (D - S) / C) * (1 + Tariff)
   * P_sell = B * (1 + k * (D - S) / C) * (1 - Spread) * (1 - Tariff)
   */
  public calculatePrices(
    commodityId: string,
    stock: number,
    demand: number,
    capacity: number,
    tariffRate: number = 0.05,
    spread: number = 0.06
  ): { buyPrice: number; sellPrice: number } {
    const def = COMMODITIES[commodityId];
    const base = def ? def.basePrice : 25;
    const k = 0.50; // Elasticity curve factor

    const cap = Math.max(100, capacity);
    const imbalance = (demand - stock) / cap;
    let multiplier = 1 + k * imbalance;
    multiplier = Math.max(0.25, Math.min(3.0, multiplier)); // Clamp price variation

    const pBase = base * multiplier;
    const buyPrice = Math.round(pBase * (1 + tariffRate) * 10) / 10;
    const sellPrice = Math.max(1.0, Math.round(pBase * (1 - spread) * (1 - tariffRate) * 10) / 10);

    return { buyPrice, sellPrice };
  }

  /**
   * Retrieves full player cargo hold and credit balance
   */
  public async getPlayerHold(playerId: string): Promise<PlayerHoldStatus | null> {
    const accRes = await db.query<{ credits: string | number }>(
      'SELECT credits FROM accounts WHERE id = $1',
      [playerId]
    );
    if (accRes.rows.length === 0) return null;

    const shipRes = await db.query<{ id: string; cargo_capacity: number }>(
      'SELECT id, cargo_capacity FROM ships WHERE account_id = $1',
      [playerId]
    );
    if (shipRes.rows.length === 0) return null;

    const shipId = shipRes.rows[0].id;
    const capacity = shipRes.rows[0].cargo_capacity;

    const cargoRes = await db.query<{ commodity_id: string; quantity: number }>(
      'SELECT commodity_id, quantity FROM ship_cargo WHERE ship_id = $1 ORDER BY commodity_id ASC',
      [shipId]
    );

    let used = 0;
    const cargo = cargoRes.rows.map((row) => {
      used += row.quantity;
      const def = COMMODITIES[row.commodity_id];
      return {
        commodity_id: row.commodity_id,
        name: def ? def.name : row.commodity_id,
        quantity: row.quantity,
      };
    });

    return {
      playerId,
      shipId,
      credits: parseInt(String(accRes.rows[0].credits), 10),
      cargoCapacity: capacity,
      usedCargo: used,
      freeCargo: Math.max(0, capacity - used),
      cargo,
    };
  }

  /**
   * Retrieves port market inventory with dynamic pricing and player cargo count
   */
  public async getMarketInventory(portId: string, playerId: string = 'acc_sol_captain'): Promise<{
    port: any;
    items: MarketItem[];
    hold: PlayerHoldStatus | null;
  } | null> {
    const portRes = await db.query('SELECT * FROM ports WHERE id = $1', [portId]);
    if (portRes.rows.length === 0) return null;
    const port = portRes.rows[0];

    const hold = await this.getPlayerHold(playerId);
    const holdMap = new Map<string, number>();
    if (hold) {
      for (const item of hold.cargo) {
        holdMap.set(item.commodity_id, item.quantity);
      }
    }

    const invRes = await db.query<any>(
      'SELECT * FROM port_inventory WHERE port_id = $1 ORDER BY commodity_id ASC',
      [portId]
    );

    // Calculate dynamic faction tariff / discount modifier
    const repMultiplier = await reputationService.calculateMarketMultiplier(playerId, port.faction_id);
    let repModifierLabel = '';
    if (repMultiplier <= 0.85) {
      repModifierLabel = '[-15% ALLIANCE DISCOUNT]';
    } else if (repMultiplier <= 0.95) {
      repModifierLabel = '[-5% FRIENDLY DISCOUNT]';
    } else if (repMultiplier >= 1.50) {
      repModifierLabel = '[+50% NEMESIS TARIFF]';
    } else if (repMultiplier >= 1.25) {
      repModifierLabel = '[+25% HOSTILE TARIFF]';
    }

    const items: MarketItem[] = invRes.rows.map((row) => {
      const def = COMMODITIES[row.commodity_id];
      const { buyPrice, sellPrice } = this.calculatePrices(
        row.commodity_id,
        row.stock,
        row.demand,
        row.capacity,
        port.tariff_rate,
        0.06
      );

      const effectiveBuyPrice = Math.round(buyPrice * repMultiplier);
      const effectiveSellPrice = Math.max(1, Math.round(sellPrice / repMultiplier));

      return {
        commodity_id: row.commodity_id,
        name: def ? def.name : row.commodity_id,
        description: def ? def.description : '',
        category: def ? def.category : 'COMMODITY',
        stock: row.stock,
        demand: row.demand,
        capacity: row.capacity,
        buy_price: effectiveBuyPrice,
        sell_price: effectiveSellPrice,
        base_buy_price: buyPrice,
        base_sell_price: sellPrice,
        rep_multiplier: repMultiplier,
        rep_modifier_label: repModifierLabel,
        player_cargo: holdMap.get(row.commodity_id) || 0,
      };
    });

    return { port, items, hold };
  }


  /**
   * Atomically executes a BUY or SELL order at a port
   */
  public async executeTrade(
    playerId: string,
    portId: string,
    commodityId: string,
    quantity: number,
    type: 'BUY' | 'SELL'
  ): Promise<TradeResult> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { success: false, error: 'Invalid order quantity. Must be a positive integer.' };
    }

    const def = COMMODITIES[commodityId];
    if (!def) {
      return { success: false, error: `Unknown commodity ID: ${commodityId}` };
    }

    const releaseLock = await this.acquireLock(portId);

    try {
      // 1. Fetch Port & Location Check
      const portRes = await db.query<any>('SELECT * FROM ports WHERE id = $1', [portId]);
      if (portRes.rows.length === 0) {
        return { success: false, error: `Port "${portId}" not found in star directory.` };
      }
      const port = portRes.rows[0];

      // 2. Fetch Player Ship & Location Verification
      const shipRes = await db.query<any>('SELECT * FROM ships WHERE account_id = $1', [playerId]);
      if (shipRes.rows.length === 0) {
        return { success: false, error: `Player vessel not found.` };
      }
      const ship = shipRes.rows[0];

      if (ship.current_sector_id !== port.sector_id) {
        return {
          success: false,
          error: `OUT_OF_RANGE: Vessel is in Sector ${ship.current_sector_id}, but ${port.name} is in Sector ${port.sector_id}. You must dock in the station sector to trade.`,
        };
      }

      // 3. Fetch Port Inventory Row
      const invRes = await db.query<any>(
        'SELECT * FROM port_inventory WHERE port_id = $1 AND commodity_id = $2',
        [portId, commodityId]
      );
      if (invRes.rows.length === 0) {
        return { success: false, error: `Port does not trade ${def.name}.` };
      }
      const inv = invRes.rows[0];

      // 4. Calculate Live Authoritative Price with Faction Reputation Multiplier
      const { buyPrice, sellPrice } = this.calculatePrices(
        commodityId,
        inv.stock,
        inv.demand,
        inv.capacity,
        port.tariff_rate,
        0.06
      );
      const repMultiplier = await reputationService.calculateMarketMultiplier(playerId, port.faction_id);
      const effectiveBuyPrice = Math.round(buyPrice * repMultiplier);
      const effectiveSellPrice = Math.max(1, Math.round(sellPrice / repMultiplier));

      // 5. Fetch Hold & Credit Status
      const hold = await this.getPlayerHold(playerId);
      if (!hold) {
        return { success: false, error: `Unable to access pilot cargo hold.` };
      }

      // 6. Branch on Order Type
      if (type === 'BUY') {
        if (inv.stock < quantity) {
          return {
            success: false,
            error: `INSUFFICIENT_STOCK: ${port.name} only has ${inv.stock} units of ${def.name} available (requested: ${quantity}).`,
          };
        }

        if (hold.freeCargo < quantity) {
          return {
            success: false,
            error: `CARGO_BAY_FULL: Cargo hold only has ${hold.freeCargo} m³ free space (requested: ${quantity} m³).`,
          };
        }

        const totalCost = Math.round(effectiveBuyPrice * quantity);
        if (hold.credits < totalCost) {
          return {
            success: false,
            error: `INSUFFICIENT_CREDITS: Order requires ${totalCost} Credits, but you only have ${hold.credits} Credits.`,
          };
        }

        // Deduct Credits & Port Stock

        await db.query('UPDATE accounts SET credits = credits - $1 WHERE id = $2', [totalCost, playerId]);
        await db.query(
          'UPDATE port_inventory SET stock = stock - $1 WHERE port_id = $2 AND commodity_id = $3',
          [quantity, portId, commodityId]
        );

        // Add to Ship Cargo
        await db.query(
          `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (ship_id, commodity_id)
           DO UPDATE SET quantity = ship_cargo.quantity + EXCLUDED.quantity`,
          [ship.id, commodityId, quantity]
        );

        // Update dynamic prices in DB after stock shift
        const newPrices = this.calculatePrices(
          commodityId,
          inv.stock - quantity,
          inv.demand,
          inv.capacity,
          port.tariff_rate,
          0.06
        );
        await db.query(
          'UPDATE port_inventory SET buy_price = $1, sell_price = $2 WHERE port_id = $3 AND commodity_id = $4',
          [newPrices.buyPrice, newPrices.sellPrice, portId, commodityId]
        );

        const updatedHold = await this.getPlayerHold(playerId);
        const marketData = await this.getMarketInventory(portId, playerId);

        return {
          success: true,
          type: 'BUY',
          commodityId,
          commodityName: def.name,
          quantity,
          unitPrice: effectiveBuyPrice,
          totalCredits: totalCost,
          newCredits: updatedHold ? updatedHold.credits : hold.credits - totalCost,
          hold: updatedHold || undefined,
          updatedInventory: marketData ? marketData.items : undefined,
        };
      } else {
        // SELL Order
        const playerItem = hold.cargo.find((c) => c.commodity_id === commodityId);
        const currentHeld = playerItem ? playerItem.quantity : 0;

        if (currentHeld < quantity) {
          return {
            success: false,
            error: `INSUFFICIENT_CARGO: You only have ${currentHeld} units of ${def.name} in your hold (attempted to sell: ${quantity}).`,
          };
        }

        if (inv.stock + quantity > inv.capacity) {
          return {
            success: false,
            error: `PORT_STORAGE_FULL: Port cannot accept ${quantity} units (Capacity: ${inv.capacity}, Current Stock: ${inv.stock}).`,
          };
        }

        const totalPayout = Math.round(effectiveSellPrice * quantity);


        // Add Credits & Port Stock
        await db.query('UPDATE accounts SET credits = credits + $1 WHERE id = $2', [totalPayout, playerId]);
        await db.query(
          'UPDATE port_inventory SET stock = stock + $1 WHERE port_id = $2 AND commodity_id = $3',
          [quantity, portId, commodityId]
        );

        // Deduct from Ship Cargo
        if (currentHeld - quantity === 0) {
          await db.query(
            'DELETE FROM ship_cargo WHERE ship_id = $1 AND commodity_id = $2',
            [ship.id, commodityId]
          );
        } else {
          await db.query(
            'UPDATE ship_cargo SET quantity = quantity - $1 WHERE ship_id = $2 AND commodity_id = $3',
            [quantity, ship.id, commodityId]
          );
        }

        // Update dynamic prices in DB after stock shift
        const newPrices = this.calculatePrices(
          commodityId,
          inv.stock + quantity,
          inv.demand,
          inv.capacity,
          port.tariff_rate,
          0.06
        );
        await db.query(
          'UPDATE port_inventory SET buy_price = $1, sell_price = $2 WHERE port_id = $3 AND commodity_id = $4',
          [newPrices.buyPrice, newPrices.sellPrice, portId, commodityId]
        );

        const updatedHold = await this.getPlayerHold(playerId);
        const marketData = await this.getMarketInventory(portId, playerId);

        return {
          success: true,
          type: 'SELL',
          commodityId,
          commodityName: def.name,
          quantity,
          unitPrice: effectiveSellPrice,
          totalCredits: totalPayout,
          newCredits: updatedHold ? updatedHold.credits : hold.credits + totalPayout,
          hold: updatedHold || undefined,
          updatedInventory: marketData ? marketData.items : undefined,
        };

      }
    } finally {
      releaseLock();
    }
  }

  /**
   * Retrieves trade intelligence across all ports and calculates cross-sector arbitrage routes
   */
  public async getSectorTradeIntel(): Promise<{
    ports: Array<{
      portId: string;
      name: string;
      sectorId: number;
      factionId: string;
      inventory: Array<{
        commodityId: string;
        name: string;
        buyPrice: number;
        sellPrice: number;
        stock: number;
        demand: number;
      }>;
    }>;
    arbitrage: Array<{
      fromPortId: string;
      fromPortName: string;
      fromSectorId: number;
      toPortId: string;
      toPortName: string;
      toSectorId: number;
      commodityId: string;
      commodityName: string;
      buyPrice: number;
      sellPrice: number;
      profitPerUnit: number;
    }>;
  }> {
    const portsRes = await db.query<any>('SELECT * FROM ports ORDER BY sector_id ASC');
    const portDataList: Array<{
      portId: string;
      name: string;
      sectorId: number;
      factionId: string;
      inventory: Array<{
        commodityId: string;
        name: string;
        buyPrice: number;
        sellPrice: number;
        stock: number;
        demand: number;
      }>;
    }> = [];

    for (const p of portsRes.rows) {
      const invRes = await db.query<any>(
        'SELECT * FROM port_inventory WHERE port_id = $1 ORDER BY commodity_id ASC',
        [p.id]
      );

      const items = invRes.rows.map((r) => {
        const def = COMMODITIES[r.commodity_id];
        const prices = this.calculatePrices(
          r.commodity_id,
          r.stock,
          r.demand,
          r.capacity,
          p.tariff_rate,
          0.06
        );
        return {
          commodityId: r.commodity_id,
          name: def ? def.name : r.commodity_id,
          buyPrice: prices.buyPrice,
          sellPrice: prices.sellPrice,
          stock: r.stock,
          demand: r.demand,
        };
      });

      portDataList.push({
        portId: p.id,
        name: p.name,
        sectorId: p.sector_id,
        factionId: p.faction_id,
        inventory: items,
      });
    }

    // Find cross-sector arbitrage routes where toPort.sellPrice > fromPort.buyPrice
    const arbitrage: Array<{
      fromPortId: string;
      fromPortName: string;
      fromSectorId: number;
      toPortId: string;
      toPortName: string;
      toSectorId: number;
      commodityId: string;
      commodityName: string;
      buyPrice: number;
      sellPrice: number;
      profitPerUnit: number;
    }> = [];

    for (const sourcePort of portDataList) {
      for (const destPort of portDataList) {
        if (sourcePort.portId === destPort.portId) continue;

        for (const sItem of sourcePort.inventory) {
          const dItem = destPort.inventory.find((di) => di.commodityId === sItem.commodityId);
          if (!dItem) continue;

          const profit = Math.round((dItem.sellPrice - sItem.buyPrice) * 10) / 10;
          if (profit > 1.0) {
            arbitrage.push({
              fromPortId: sourcePort.portId,
              fromPortName: sourcePort.name,
              fromSectorId: sourcePort.sectorId,
              toPortId: destPort.portId,
              toPortName: destPort.name,
              toSectorId: destPort.sectorId,
              commodityId: sItem.commodityId,
              commodityName: sItem.name,
              buyPrice: sItem.buyPrice,
              sellPrice: dItem.sellPrice,
              profitPerUnit: profit,
            });
          }
        }
      }
    }

    arbitrage.sort((a, b) => b.profitPerUnit - a.profitPerUnit);

    return {
      ports: portDataList,
      arbitrage,
    };
  }
}

export const tradeService = new TradeService();
