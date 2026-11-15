import crypto from 'node:crypto';
import { db } from '../db/Database';
import { ALL_FACTION_IDS, FACTION_REGISTRY, type FactionId } from '../../../shared/FactionRegistry';
import { getHullsByMainClass } from '../procgen/HullClassCatalog';

export const FACTION_HOME_SECTORS: Record<FactionId, number> = {
  FACTION_SOL: 1,
  FACTION_HEGEMONY: 11,
  FACTION_KRYLL: 17,
  FACTION_LITHOS: 23,
  FACTION_PHORID: 29,
  FACTION_WARDENS: 52,
  FACTION_MINERS_GUILD: 61,
  FACTION_FREEBOOTERS: 64,
};

export const DEFAULT_CAPTAIN_USERNAME = 'cmdr_vance';
export const DEFAULT_CAPTAIN_PASSWORD = process.env.STARCON_DEFAULT_CAPTAIN_PASS || 'solaris2002';

export interface VerifiedSession {
  sessionId: string;
  accountId: string;
}

export class AuthService {
  private cachedHmacSecret: string | null = null;
  private initializedDefaults = false;

  public async initialize(): Promise<void> {
    await this.getHmacSecret();
    await this.ensureDefaultCaptainCredentials();
  }

  private async getHmacSecret(): Promise<string> {
    if (process.env.STARCON_JWT_SECRET) {
      return process.env.STARCON_JWT_SECRET;
    }
    if (this.cachedHmacSecret) {
      return this.cachedHmacSecret;
    }

    const res = await db.query<{ value: string }>(
      `SELECT value FROM system_settings WHERE key = 'auth_hmac_secret'`
    );
    if (res.rows.length > 0 && res.rows[0].value) {
      this.cachedHmacSecret = res.rows[0].value;
      return this.cachedHmacSecret;
    }

    const generated = crypto.randomBytes(48).toString('hex');
    await db.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('auth_hmac_secret', $1, NOW())
       ON CONFLICT (key) DO NOTHING`,
      [generated]
    );
    const verify = await db.query<{ value: string }>(
      `SELECT value FROM system_settings WHERE key = 'auth_hmac_secret'`
    );
    this.cachedHmacSecret = verify.rows[0]?.value || generated;
    return this.cachedHmacSecret;
  }

  public hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
  }

  public verifyPassword(password: string, storedHash: string | null | undefined): boolean {
    if (!storedHash || !storedHash.includes(':')) return false;
    const [salt, expectedHex] = storedHash.split(':');
    if (!salt || !expectedHex) return false;
    try {
      const derived = crypto.scryptSync(password, salt, 64);
      const expected = Buffer.from(expectedHex, 'hex');
      if (derived.length !== expected.length) return false;
      return crypto.timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private signPayload(payload: { sid: string; aid: string; exp: number }, secret: string): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  public async ensureDefaultCaptainCredentials(): Promise<void> {
    if (this.initializedDefaults) return;
    const res = await db.query<{ id: string; password_hash: string | null }>(
      `SELECT id, password_hash FROM accounts WHERE id = 'acc_sol_captain'`
    );
    if (res.rows.length > 0 && !res.rows[0].password_hash) {
      const hashed = this.hashPassword(DEFAULT_CAPTAIN_PASSWORD);
      await db.query(
        `UPDATE accounts SET password_hash = $1 WHERE id = 'acc_sol_captain' AND password_hash IS NULL`,
        [hashed]
      );
    }
    this.initializedDefaults = true;
  }

  public async issueSessionForAccount(accountId: string): Promise<string> {
    const secret = await this.getHmacSecret();
    const sessionId = `sess_${crypto.randomUUID()}`;
    const expiresAtMs = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
    const token = this.signPayload({ sid: sessionId, aid: accountId, exp: expiresAtMs }, secret);
    const tokenHash = this.hashToken(token);

    await db.query(
      `INSERT INTO auth_sessions (id, account_id, token_hash, created_at, expires_at, revoked)
       VALUES ($1, $2, $3, NOW(), $4, FALSE)`,
      [sessionId, accountId, tokenHash, new Date(expiresAtMs).toISOString()]
    );

    await db.query(
      `UPDATE accounts SET last_seen_at = NOW(), online_status = 'ONLINE' WHERE id = $1`,
      [accountId]
    );

    return token;
  }

  public async verifyBearerToken(rawToken: string | null | undefined): Promise<VerifiedSession | null> {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const trimmed = rawToken.trim();
    const parts = trimmed.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    if (!body || !sig) return null;

    const secret = await this.getHmacSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('base64url');

    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    let payload: { sid?: string; aid?: string; exp?: number };
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    } catch {
      return null;
    }

    if (!payload.sid || !payload.aid || !payload.exp || payload.exp <= Date.now()) {
      return null;
    }

    const tokenHash = this.hashToken(trimmed);
    const sessRes = await db.query<{ id: string; account_id: string }>(
      `SELECT id, account_id FROM auth_sessions
       WHERE id = $1 AND account_id = $2 AND token_hash = $3 AND revoked = FALSE AND expires_at > NOW()`,
      [payload.sid, payload.aid, tokenHash]
    );
    if (sessRes.rows.length === 0) return null;

    return {
      sessionId: sessRes.rows[0].id,
      accountId: sessRes.rows[0].account_id,
    };
  }

  public async register(input: {
    username: string;
    password: string;
    callsign: string;
    factionId?: string;
  }): Promise<{ token: string; account: any; ship: any; homeSectorId: number }> {
    await this.initialize();

    const username = String(input.username || '').trim();
    const password = String(input.password || '');
    const callsign = String(input.callsign || '').trim();
    const requestedFaction = String(input.factionId || 'FACTION_SOL').toUpperCase() as FactionId;
    const factionId: FactionId = ALL_FACTION_IDS.includes(requestedFaction)
      ? requestedFaction
      : 'FACTION_SOL';

    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
      throw new Error('Username must be 3-32 alphanumeric characters (._- allowed).');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    if (callsign.length < 2 || callsign.length > 32) {
      throw new Error('Callsign must be between 2 and 32 characters.');
    }

    const dupCheck = await db.query<{ id: string }>(
      `SELECT id FROM accounts WHERE LOWER(username) = LOWER($1) OR LOWER(callsign) = LOWER($2)`,
      [username, callsign]
    );
    if (dupCheck.rows.length > 0) {
      throw new Error('Username or Callsign is already registered.');
    }

    const homeSectorId = FACTION_HOME_SECTORS[factionId] || 1;
    const sectorRes = await db.query<{ coordinates_x: number; coordinates_y: number; name: string }>(
      `SELECT coordinates_x, coordinates_y, name FROM sectors WHERE id = $1`,
      [homeSectorId]
    );
    const hx = Number(sectorRes.rows[0]?.coordinates_x ?? 500);
    const hy = Number(sectorRes.rows[0]?.coordinates_y ?? 500);

    const starterHull = getHullsByMainClass('CORVETTE', factionId)[0] || getHullsByMainClass('CORVETTE', 'FACTION_SOL')[0];
    const factionMeta = FACTION_REGISTRY[factionId];
    const accountId = `acc_${crypto.randomBytes(6).toString('hex')}`;
    const shipId = `ship_${crypto.randomBytes(6).toString('hex')}`;
    const hullSeed = crypto.randomInt(10000, 999999);
    const passwordHash = this.hashPassword(password);
    const flagshipName = `${factionMeta.shortName} ${callsign}`;

    await db.query(
      `INSERT INTO accounts (id, username, callsign, credits, faction_id, password_hash, role, online_status)
       VALUES ($1, $2, $3, 1500, $4, $5, 'CAPTAIN', 'ONLINE')`,
      [accountId, username, callsign, factionId, passwordHash]
    );

    await db.query(
      `INSERT INTO ships (
         id, account_id, hull_class, hull_seed, current_sector_id,
         fuel, max_fuel, armor, max_armor, shield, max_shield, cargo_capacity,
         flagship_name, main_hull_class, hull_subtype, faction_id,
         power_grid_max, cpu_max, base_speed, base_turn_rate,
         high_slots, mid_slots, low_slots, bay_slots,
         is_in_hyperspace, hyperspace_x, hyperspace_y
       )
       VALUES (
         $1, $2, $3, $4, $5,
         $6, $6, $7, $7, $8, $8, $9,
         $10, $11, $12, $13,
         $14, $15, $16, $17,
         $18, $19, $20, $21,
         FALSE, $22, $23
       )`,
      [
        shipId,
        accountId,
        starterHull.hullClass,
        hullSeed,
        homeSectorId,
        starterHull.maxFuel,
        starterHull.baseArmor,
        starterHull.baseShield,
        starterHull.cargoCapacity,
        flagshipName,
        starterHull.mainClass,
        starterHull.displayName,
        factionId,
        starterHull.powerGridMax,
        starterHull.cpuMax,
        starterHull.baseSpeed,
        starterHull.baseTurnRate,
        starterHull.highSlots,
        starterHull.midSlots,
        starterHull.lowSlots,
        starterHull.baySlots,
        hx,
        hy,
      ]
    );

    // Equip starter weapon & propulsion modules from blueprints if present
    const bpPulse = await db.query(`SELECT id FROM equipment_blueprints WHERE id = 'MOD_PULSE_01'`);
    if (bpPulse.rows.length > 0) {
      await db.query(
        `INSERT INTO player_inventory (
           id, account_id, blueprint_id, custom_name, rarity, affixes, main_category, subtype, is_fitted, fit_slot
         ) VALUES ($1, $2, 'MOD_PULSE_01', $3, 'COMMON', '[]'::jsonb, 'OFFENSE', 'Laser Turret', TRUE, 'H1')`,
        [crypto.randomUUID(), accountId, `${factionMeta.shortName} Pulse Cannon`]
      );
    }

    const bpAfter = await db.query(`SELECT id FROM equipment_blueprints WHERE id = 'MOD_AFTERBURNER_01'`);
    if (bpAfter.rows.length > 0) {
      await db.query(
        `INSERT INTO player_inventory (
           id, account_id, blueprint_id, custom_name, rarity, affixes, main_category, subtype, is_fitted, fit_slot
         ) VALUES ($1, $2, 'MOD_AFTERBURNER_01', 'Standard Afterburner Core', 'COMMON', '[]'::jsonb, 'TRAVEL', 'Plasma Drive', TRUE, 'M1')`,
        [crypto.randomUUID(), accountId]
      );
    }

    await db.query(
      `INSERT INTO faction_standings (account_id, faction_id, standing)
       VALUES ($1, $2, 35)
       ON CONFLICT (account_id, faction_id) DO UPDATE SET standing = 35`,
      [accountId, factionId]
    );

    await db.query(
      `INSERT INTO player_biotech_research (account_id)
       VALUES ($1)
       ON CONFLICT (account_id) DO NOTHING`,
      [accountId]
    );

    const token = await this.issueSessionForAccount(accountId);
    const profile = await this.getCaptainProfile(accountId);
    return {
      token,
      account: profile.account,
      ship: profile.ship,
      homeSectorId,
    };
  }

  public async login(username: string, password: string): Promise<{ token: string; account: any; ship: any }> {
    await this.initialize();
    const cleanUser = String(username || '').trim();
    const res = await db.query<any>(
      `SELECT id, username, callsign, credits, faction_id, password_hash, role
       FROM accounts
       WHERE LOWER(username) = LOWER($1)`,
      [cleanUser]
    );
    if (res.rows.length === 0) {
      throw new Error('Invalid username or password.');
    }
    const row = res.rows[0];
    if (!this.verifyPassword(password, row.password_hash)) {
      throw new Error('Invalid username or password.');
    }

    const token = await this.issueSessionForAccount(row.id);
    const profile = await this.getCaptainProfile(row.id);
    return {
      token,
      account: profile.account,
      ship: profile.ship,
    };
  }

  public async logout(sessionId: string, accountId: string): Promise<void> {
    await db.query(`UPDATE auth_sessions SET revoked = TRUE WHERE id = $1`, [sessionId]);
    await db.query(`UPDATE accounts SET online_status = 'OFFLINE' WHERE id = $1`, [accountId]);
  }

  public async getCaptainProfile(accountId: string): Promise<{ account: any; ship: any; squadronId: string | null }> {
    const accRes = await db.query<any>(
      `SELECT id, username, callsign, credits, faction_id, tech_components, role, online_status, last_seen_at
       FROM accounts WHERE id = $1`,
      [accountId]
    );
    if (accRes.rows.length === 0) {
      throw new Error('Captain account not found.');
    }
    const a = accRes.rows[0];

    const shipRes = await db.query<any>(
      `SELECT * FROM ships WHERE account_id = $1 LIMIT 1`,
      [accountId]
    );
    const s = shipRes.rows[0] || null;

    const sqRes = await db.query<{ squadron_id: string }>(
      `SELECT squadron_id FROM squadron_members WHERE account_id = $1 LIMIT 1`,
      [accountId]
    );

    return {
      account: {
        id: a.id,
        username: a.username,
        callsign: a.callsign,
        credits: Number(a.credits),
        factionId: a.faction_id,
        techComponents: Number(a.tech_components || 0),
        role: a.role || 'CAPTAIN',
        onlineStatus: a.online_status || 'ONLINE',
      },
      ship: s
        ? {
            id: s.id,
            hullClass: s.hull_class,
            mainHullClass: s.main_hull_class,
            hullSubtype: s.hull_subtype,
            flagshipName: s.flagship_name,
            factionId: s.faction_id,
            currentSectorId: Number(s.current_sector_id),
            fuel: Number(s.fuel),
            maxFuel: Number(s.max_fuel),
            armor: Number(s.armor),
            maxArmor: Number(s.max_armor),
            shield: Number(s.shield),
            maxShield: Number(s.max_shield),
            cargoCapacity: Number(s.cargo_capacity),
            isInHyperspace: Boolean(s.is_in_hyperspace),
            hyperspaceX: Number(s.hyperspace_x ?? 500),
            hyperspaceY: Number(s.hyperspace_y ?? 500),
          }
        : null,
      squadronId: sqRes.rows[0]?.squadron_id || null,
    };
  }
}

export const authService = new AuthService();

