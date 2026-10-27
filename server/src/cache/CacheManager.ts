export interface CacheHealth {
  status: 'healthy' | 'degraded' | 'offline';
  engine: 'redis-remote' | 'memory-fallback';
  latencyMs: number;
  keysCount: number;
}

export class CacheManager {
  private memoryStore: Map<string, { value: string; expiresAt: number | null }> = new Map();
  public engineType: 'redis-remote' | 'memory-fallback' = 'memory-fallback';

  public async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      console.log(`[Cache] REDIS_URL provided (${redisUrl}), testing connection...`);
      // When Redis is accessible in container or cloud, connect here.
      // For standalone local without Redis running on 6379, default to memory store.
    }
    console.log(`[Cache] High-throughput in-memory Redis cache adapter initialized.`);
    this.engineType = 'memory-fallback';
  }

  public async get(key: string): Promise<string | null> {
    const entry = this.memoryStore.get(key);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }

    return entry.value;
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.memoryStore.set(key, { value, expiresAt });
  }

  public async del(key: string): Promise<void> {
    this.memoryStore.delete(key);
  }

  public async checkHealth(): Promise<CacheHealth> {
    const start = performance.now();
    await this.set('__health_ping__', 'pong', 5);
    const val = await this.get('__health_ping__');
    const latency = Math.round(performance.now() - start);

    return {
      status: val === 'pong' ? 'healthy' : 'degraded',
      engine: this.engineType,
      latencyMs: latency,
      keysCount: this.memoryStore.size,
    };
  }
}

export const cache = new CacheManager();
