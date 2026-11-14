/**
 * Deterministic Hashing and Mulberry32 PRNG utilities for Milestone 1.0
 * Ensures planets, xenobiology, and rotating shop modules are reproducible from seeds.
 */

export function hashStringFNV1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createMulberry32(seed: number | string): () => number {
  let state = typeof seed === 'string' ? hashStringFNV1a(seed) : (seed >>> 0);
  if (state === 0) state = 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngPick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function rngInt(rng: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

export function rngFloat(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

