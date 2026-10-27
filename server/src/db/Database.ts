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
      }
      this.pglite = new PGlite(dataDir);
      this.engineType = 'pglite-embedded';
      console.log(`[DB] Embedded PostgreSQL engine ready at ${dataDir}`);
    }

    // Run Migration & Seed Scripts
    await this.runMigrations();
  }

  private async runMigrations(): Promise<void> {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.error(`[DB] schema.sql not found at ${schemaPath}`);
      return;
    }

    const sql = fs.readFileSync(schemaPath, 'utf-8');
    console.log(`[DB] Executing relational schema migrations...`);
    await this.exec(sql);
    console.log(`[DB] Schema migrations applied successfully.`);
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
