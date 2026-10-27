/**
 * Deterministic Pseudo-Random Number Generator (Mulberry32)
 * Ensures 100% cross-platform deterministic output from integer seeds.
 */
export class PRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  /**
   * Returns a 32-bit unsigned integer [0, 4294967295]
   */
  public nextInt(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /**
   * Returns a deterministic float in range [0, 1)
   */
  public nextFloat(): number {
    return this.nextInt() / 4294967296;
  }

  /**
   * Returns a float in range [min, max)
   */
  public range(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  /**
   * Returns an integer in range [min, max] inclusive
   */
  public rangeInt(min: number, max: number): number {
    const rMin = Math.ceil(min);
    const rMax = Math.floor(max);
    return Math.floor(this.nextFloat() * (rMax - rMin + 1)) + rMin;
  }

  /**
   * Returns true or false with given probability
   */
  public chance(probability: number = 0.5): boolean {
    return this.nextFloat() < probability;
  }
}
