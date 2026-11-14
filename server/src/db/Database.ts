import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'offline';
  engine: 'postgresql-remote' | 'pglite-embedded';
  latencyMs: number;
  sectorCount: number;
  portCount: number;
}

export class DatabaseManager {
  private pgPool: Pool | null = null;
  private pglite: PGlite | null = null;
  public engineType: 'postgresql-remote' | 'pglite-embedded' = 'pglite-embedded';

  public get isInitialized(): boolean {
    return this.pgPool !== null || this.pglite !== null;
  }

  public async initialize(): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;

    if (dbUrl) {
      try {
        console.log(`[DB] Attempting connection to PostgreSQL via DATABASE_URL...`);
        const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 3000 });
        const client = await pool.connect();
        client.release();
        this.pgPool = pool;
        this.engineType = 'postgresql-remote';
        console.log(`[DB] Successfully connected to PostgreSQL instance.`);
      } catch (err) {
        console.warn(`[DB] Remote PostgreSQL unreachable (${(err as Error).message}). Falling back to embedded PGlite engine.`);
        this.pgPool = null;
      }
    }

    if (!this.pgPool) {
      console.log(`[DB] Initializing embedded PostgreSQL (PGlite)...`);
      // Use persisted local database in ./data/pglite if directory exists or memory
      const dataDir = path.resolve(process.cwd(), '.pgdata');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      } else {
        const pidPath = path.join(dataDir, 'postmaster.pid');
        if (fs.existsSync(pidPath)) {
          try {
            fs.unlinkSync(pidPath);
          } catch {}
        }
      }
      this.pglite = new PGlite(dataDir);
      this.engineType = 'pglite-embedded';
      console.log(`[DB] Embedded PostgreSQL engine ready at ${dataDir}`);
    }

    // Run Migration & Seed Scripts
    await this.runMigrations();
  }

  private async runMigrations(): Promise<void> {
    // 1. Ensure migrations ledger exists
    await this.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Scan and execute pending migrations sequentially
    const migrationsDir = path.resolve(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const { rows } = await this.query('SELECT name FROM _migrations WHERE name = $1', [file]);
        if (rows.length === 0) {
          console.log(`[DB] Applying migration: ${file}...`);
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
          await this.exec(sql);
          await this.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
          console.log(`[DB] Migration ${file} applied successfully.`);

          // Ensure prerequisite seed data exists before downstream migrations run
          if (file === '001_initial_schema.sql') {
            await this.seedFile('001_initial_world_seed.sql');
          } else if (file === '002_convoys_and_skirmishes.sql') {
            await this.seedFile('002_convoys_and_skirmishes_seed.sql');
          }
        }
      }
    } else {
      // Legacy fallback
      const schemaPath = path.resolve(__dirname, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf-8');
        await this.exec(sql);
      }
    }

    // 3. Auto-seed if database is fresh (0 sectors exist)
    const { rows: sectorCheck } = await this.query<{ count: string }>('SELECT COUNT(*) as count FROM sectors');
    const sectorCount = parseInt(sectorCheck[0]?.count || '0', 10);
    if (sectorCount === 0) {
      console.log(`[DB] Fresh database detected (0 sectors). Running initial world seeds...`);
      const seedsDir = path.resolve(__dirname, 'seeds');
      if (fs.existsSync(seedsDir)) {
        const seedFiles = fs.readdirSync(seedsDir)
          .filter(f => f.endsWith('.sql'))
          .sort();
        for (const seedFile of seedFiles) {
          await this.seedFile(seedFile);
        }
      }
    }
  }

  private async seedFile(fileName: string): Promise<void> {
    const seedsDir = path.resolve(__dirname, 'seeds');
    const filePath = path.join(seedsDir, fileName);
    if (fs.existsSync(filePath)) {
      console.log(`[DB] Applying seed: ${fileName}...`);
      const seedSql = fs.readFileSync(filePath, 'utf-8');
      await this.exec(seedSql);
      console.log(`[DB] Seed ${fileName} applied successfully.`);
    }
  }

  public async exec(sql: string): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.query(sql);
    } else if (this.pglite) {
      await this.pglite.exec(sql);
    } else {
      throw new Error('[DB] Database is not initialized.');
    }
  }

  public async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
    if (this.pgPool) {
      const res = await this.pgPool.query(sql, params);
      return { rows: res.rows as T[] };
    } else if (this.pglite) {
      const res = await this.pglite.query<T>(sql, params);
      return { rows: res.rows };
    } else {
      throw new Error('[DB] Database is not initialized.');
    }
  }

  public async checkHealth(): Promise<DatabaseHealth> {
    const start = performance.now();
    try {
      const res = await this.query<{ count: string }>('SELECT COUNT(*) as count FROM sectors');
      const portRes = await this.query<{ count: string }>('SELECT COUNT(*) as count FROM ports');
      const latency = Math.round(performance.now() - start);

      return {
        status: 'healthy',
        engine: this.engineType,
        latencyMs: latency,
        sectorCount: parseInt(res.rows[0]?.count ?? '0', 10),
        portCount: parseInt(portRes.rows[0]?.count ?? '0', 10),
      };
    } catch (err) {
      return {
        status: 'offline',
        engine: this.engineType,
        latencyMs: Math.round(performance.now() - start),
        sectorCount: 0,
        portCount: 0,
      };
    }
  }

  public async close(): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.end();
    }
    if (this.pglite) {
      await this.pglite.close();
    }
  }
}

export const db = new DatabaseManager();
