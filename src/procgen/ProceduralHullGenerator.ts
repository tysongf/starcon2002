import * as THREE from 'three';
import { PRNG } from './PRNG';

/**
 * 3D Integer Vector for fixed-point math (1000 = 1.0 Three.js world unit)
 */
export interface IntVec3 {
  x: number;
  y: number;
  z: number;
}

export interface HullGenerationOptions {
  seed: number;
  length?: number;       // In integer millispaces (default ~8000 = 8.0 units)
  width?: number;        // In integer millispaces (default ~3000 = 3.0 units)
  height?: number;       // In integer millispaces (default ~1500 = 1.5 units)
  wingSpread?: number;   // Extra wing extension
  weaponHardpoints?: boolean;
}

export interface HullGenerationResult {
  geometry: THREE.BufferGeometry;
  triangleCount: number;
  vertexCount: number;
  seed: number;
}

/**
 * Procedural low-poly spacecraft hull generator using fixed-point math
 * and grammar-based parametric face extrusion with axial symmetry.
 */
export class ProceduralHullGenerator {
  private static readonly FP_SCALE = 1000; // Fixed-point divisor

  /**
   * Generates a deterministic low-poly hull geometry from an integer seed.
   */
  public static generate(options: HullGenerationOptions): HullGenerationResult {
    const prng = new PRNG(options.seed);

    // Dynamic hull dimensions with deterministic variation
    const halfLen = Math.floor((options.length ?? 8000) / 2);
    const halfWid = Math.floor((options.width ?? 2800) / 2);
    const halfHgt = Math.floor((options.height ?? 1600) / 2);

    // List of vertices (in integer coordinates)
    const vertices: IntVec3[] = [];
    // List of triangle indices [i0, i1, i2]
    const triangles: [number, number, number][] = [];
    // Face semantic tags for coloring
    const triangleTags: string[] = [];

    // Helper: add vertex
    const addVertex = (x: number, y: number, z: number): number => {
      vertices.push({ x: Math.round(x), y: Math.round(y), z: Math.round(z) });
      return vertices.length - 1;
    };

    // Helper: add quad (split into 2 triangles)
    const addQuad = (
      i0: number,
      i1: number,
      i2: number,
      i3: number,
      tag: string = 'hull'
    ) => {
      triangles.push([i0, i1, i2]);
      triangleTags.push(tag);
      triangles.push([i0, i2, i3]);
      triangleTags.push(tag);
    };

    // Helper: add single tri
    const addTri = (i0: number, i1: number, i2: number, tag: string = 'hull') => {
      triangles.push([i0, i1, i2]);
      triangleTags.push(tag);
    };

    // =========================================================================
    // 1. BASE FUSELAGE: Segmented Central Core (Axial Symmetry X >= 0 mirrored to X <= 0)
    // =========================================================================
    // We construct 6 rings of vertices along Z axis from rear (-Z) to front (+Z)
    const zSegments = 6;
    const zCoords = [
      -halfLen,                                          // Ring 0: Engine bay / Aft
      Math.floor(-halfLen * 0.5),                        // Ring 1: Rear flank
      Math.floor(-halfLen * 0.1),                        // Ring 2: Mid-section / Wing root
      Math.floor(halfLen * 0.3),                         // Ring 3: Foreward mid
      Math.floor(halfLen * 0.7),                         // Ring 4: Canopy / Cockpit base
      halfLen,                                           // Ring 5: Nose prow
    ];

    // Width and height scales per ring (normalized factors * 1000)
    const profileWid = [
      Math.floor(halfWid * 0.85),
      halfWid,
      Math.floor(halfWid * 1.15),
      Math.floor(halfWid * 0.95),
      Math.floor(halfWid * 0.65),
      Math.floor(halfWid * 0.25),
    ];

    const profileHgt = [
      Math.floor(halfHgt * 0.9),
      halfHgt,
      Math.floor(halfHgt * 1.1),
      Math.floor(halfHgt * 0.9),
      Math.floor(halfHgt * 0.6),
      Math.floor(halfHgt * 0.2),
    ];

    // Each ring has 8 perimeter vertices:
    // 0: Top-Center (X=0)
    // 1: Top-Right (+X, +Y)
    // 2: Mid-Right (+X, Y=0)
    // 3: Bot-Right (+X, -Y)
    // 4: Bot-Center (X=0)
    // 5: Bot-Left (-X, -Y)
    // 6: Mid-Left (-X, Y=0)
    // 7: Top-Left (-X, +Y)
    const ringVerts: number[][] = [];

    for (let r = 0; r < zSegments; r++) {
      const z = zCoords[r];
      const w = profileWid[r];
      const h = profileHgt[r];
      const wCorner = Math.floor(w * 0.75);
      const hCorner = Math.floor(h * 0.75);

      const rIndices = [
        addVertex(0, h, z),                    // 0: Top-Center
        addVertex(wCorner, hCorner, z),        // 1: Top-Right
        addVertex(w, 0, z),                    // 2: Mid-Right
        addVertex(wCorner, -hCorner, z),       // 3: Bot-Right
        addVertex(0, -h, z),                   // 4: Bot-Center
        addVertex(-wCorner, -hCorner, z),      // 5: Bot-Left
        addVertex(-w, 0, z),                   // 6: Mid-Left
        addVertex(-wCorner, hCorner, z),       // 7: Top-Left
      ];
      ringVerts.push(rIndices);
    }

    // Connect adjacent rings with quad skins
    for (let r = 0; r < zSegments - 1; r++) {
      const cur = ringVerts[r];
      const next = ringVerts[r + 1];
      const isCockpit = r === 3 || r === 4;

      for (let p = 0; p < 8; p++) {
        const nextP = (p + 1) % 8;
        const tag = (isCockpit && (p === 0 || p === 7)) ? 'canopy' : 'hull';
        addQuad(cur[p], next[p], next[nextP], cur[nextP], tag);
      }
    }

    // Nose Cap (Front Ring 5)
    const noseTip = addVertex(0, 0, halfLen + 600);
    const rFront = ringVerts[zSegments - 1];
    for (let p = 0; p < 8; p++) {
      const nextP = (p + 1) % 8;
      addTri(rFront[p], noseTip, rFront[nextP], 'accent');
    }

    // Aft Cap / Engine Bulkhead (Rear Ring 0)
    const aftCenter = addVertex(0, 0, -halfLen - 200);
    const rAft = ringVerts[0];
    for (let p = 0; p < 8; p++) {
      const nextP = (p + 1) % 8;
      addTri(rAft[nextP], aftCenter, rAft[p], 'engine_bulkhead');
    }

    // =========================================================================
    // 2. PARAMETRIC ENGINE NACELLES / EXHAUST BELLS
    // =========================================================================
    // Two twin engine exhausts at left and right of aft center
    const engineRadius = Math.floor(halfWid * 0.35);
    const engineZ = -halfLen - 800;
    const engineOffsets = [Math.floor(halfWid * 0.5), -Math.floor(halfWid * 0.5)];

    for (const xOff of engineOffsets) {
      const eRingAft: number[] = [];
      const eRingFore: number[] = [];
      const segments = 8;

      for (let s = 0; s < segments; s++) {
        const angle = (s / segments) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const ex = xOff + Math.floor(cos * engineRadius);
        const ey = Math.floor(sin * engineRadius);

        eRingAft.push(addVertex(ex, ey, engineZ));
        eRingFore.push(addVertex(ex * 0.9 + xOff * 0.1, ey * 0.9, -halfLen));
      }

      // Engine exterior cowl
      for (let s = 0; s < segments; s++) {
        const nextS = (s + 1) % segments;
        addQuad(eRingFore[s], eRingAft[s], eRingAft[nextS], eRingFore[nextS], 'hull');
      }

      // Recessed glowing nozzle interior
      const nozzleCore = addVertex(xOff, 0, engineZ + 400);
      for (let s = 0; s < segments; s++) {
        const nextS = (s + 1) % segments;
        addTri(eRingAft[s], nozzleCore, eRingAft[nextS], 'engine_glow');
      }
    }

    // =========================================================================
    // 3. PARAMETRIC WINGS WITH AXIAL-X SYMMETRY
    // =========================================================================
    const wingSweepBack = Math.floor(halfLen * 0.35) + prng.rangeInt(-200, 400);
    const wingSpan = halfWid * 2 + (options.wingSpread ?? 2500) + prng.rangeInt(-300, 600);
    const wingThickness = Math.floor(halfHgt * 0.25);

    // Right Wing (+X)
    const rwRootFore = ringVerts[3][2];   // Mid-section forward
    const rwRootAft = ringVerts[1][2];    // Rear flank

    const rwTipFore = addVertex(wingSpan, 0, zCoords[3] - wingSweepBack);
    const rwTipAft = addVertex(wingSpan - 400, 0, zCoords[1] - wingSweepBack - 600);
    const rwTipUp = addVertex(wingSpan + 200, wingThickness * 2, zCoords[2] - wingSweepBack);
    const rwTipDown = addVertex(wingSpan + 200, -wingThickness * 2, zCoords[2] - wingSweepBack);

    // Left Wing (-X)
    const lwRootFore = ringVerts[3][6];
    const lwRootAft = ringVerts[1][6];

    const lwTipFore = addVertex(-wingSpan, 0, zCoords[3] - wingSweepBack);
    const lwTipAft = addVertex(-wingSpan + 400, 0, zCoords[1] - wingSweepBack - 600);
    const lwTipUp = addVertex(-wingSpan - 200, wingThickness * 2, zCoords[2] - wingSweepBack);
    const lwTipDown = addVertex(-wingSpan - 200, -wingThickness * 2, zCoords[2] - wingSweepBack);

    // Right wing top & bottom skin
    addQuad(rwRootFore, rwTipFore, rwTipAft, rwRootAft, 'hull');
    addQuad(rwRootAft, rwTipAft, rwTipFore, rwRootFore, 'accent');
    // Wing tip vertical fins
    addTri(rwTipFore, rwTipUp, rwTipAft, 'accent');
    addTri(rwTipFore, rwTipAft, rwTipDown, 'accent');

    // Left wing top & bottom skin (mirrored winding)
    addQuad(lwRootAft, lwTipAft, lwTipFore, lwRootFore, 'hull');
    addQuad(lwRootFore, lwTipFore, lwTipAft, lwRootAft, 'accent');
    // Left wing tip vertical fins
    addTri(lwTipFore, lwTipAft, lwTipUp, 'accent');
    addTri(lwTipFore, lwTipDown, lwTipAft, 'accent');

    // =========================================================================
    // 4. DORSAL STABILIZER FIN (Top spine)
    // =========================================================================
    const spineFore = ringVerts[3][0];
    const spineAft = ringVerts[1][0];
    const finHeight = Math.floor(halfHgt * 1.8);
    const finTopFore = addVertex(0, finHeight, zCoords[2] - 300);
    const finTopAft = addVertex(0, finHeight * 0.8, zCoords[1] - 400);

    addQuad(spineAft, finTopAft, finTopFore, spineFore, 'accent');
    addQuad(spineFore, finTopFore, finTopAft, spineAft, 'accent');

    // =========================================================================
    // 5. HARDPOINT CANNONS / WEAPON PODS (Wing-tip and Bow mounts)
    // =========================================================================
    const barrelLen = 1000;
    const barrelRad = 90;

    // Twin bow kinetic cannons
    const cannonBases = [
      { x: Math.floor(halfWid * 0.4), y: -Math.floor(halfHgt * 0.2), z: zCoords[4] },
      { x: -Math.floor(halfWid * 0.4), y: -Math.floor(halfHgt * 0.2), z: zCoords[4] },
    ];

    for (const b of cannonBases) {
      const b0 = addVertex(b.x - barrelRad, b.y - barrelRad, b.z);
      const b1 = addVertex(b.x + barrelRad, b.y - barrelRad, b.z);
      const b2 = addVertex(b.x + barrelRad, b.y + barrelRad, b.z);
      const b3 = addVertex(b.x - barrelRad, b.y + barrelRad, b.z);

      const m0 = addVertex(b.x - barrelRad, b.y - barrelRad, b.z + barrelLen);
      const m1 = addVertex(b.x + barrelRad, b.y - barrelRad, b.z + barrelLen);
      const m2 = addVertex(b.x + barrelRad, b.y + barrelRad, b.z + barrelLen);
      const m3 = addVertex(b.x - barrelRad, b.y + barrelRad, b.z + barrelLen);

      // 4 sides of rectangular barrel
      addQuad(b0, m0, m1, b1, 'metal');
      addQuad(b1, m1, m2, b2, 'metal');
      addQuad(b2, m2, m3, b3, 'metal');
      addQuad(b3, m3, m0, b0, 'metal');
      // Muzzle opening
      addQuad(m0, m3, m2, m1, 'engine_glow');
    }

    // =========================================================================
    // 6. BUILD NON-INDEXED THREE.JS BUFFERGEOMETRY (Flat-Shading with Vertex Colors)
    // =========================================================================
    const totalTris = triangles.length;
    const positions = new Float32Array(totalTris * 3 * 3);
    const normals = new Float32Array(totalTris * 3 * 3);
    const colors = new Float32Array(totalTris * 3 * 3);

    // Color definitions for visual distinction
    const colorMap: Record<string, THREE.Color> = {
      hull: new THREE.Color(0x3a4454),            // Steel gunmetal grey
      accent: new THREE.Color(0x38bdf8),          // Neon cyan trim
      canopy: new THREE.Color(0x0f172a),          // Deep cockpit glass
      engine_bulkhead: new THREE.Color(0x1e293b), // Dark exhaust frame
      engine_glow: new THREE.Color(0xf59e0b),     // Warm amber plasma glow
      metal: new THREE.Color(0x64748b),           // Hardened titanium barrels
    };

    let pIdx = 0;
    for (let t = 0; t < totalTris; t++) {
      const [i0, i1, i2] = triangles[t];
      const tag = triangleTags[t] || 'hull';
      const c = colorMap[tag] || colorMap.hull;

      // Unpack fixed-point to float world coords
      const v0 = vertices[i0];
      const v1 = vertices[i1];
      const v2 = vertices[i2];

      const p0x = v0.x / ProceduralHullGenerator.FP_SCALE;
      const p0y = v0.y / ProceduralHullGenerator.FP_SCALE;
      const p0z = v0.z / ProceduralHullGenerator.FP_SCALE;

      const p1x = v1.x / ProceduralHullGenerator.FP_SCALE;
      const p1y = v1.y / ProceduralHullGenerator.FP_SCALE;
      const p1z = v1.z / ProceduralHullGenerator.FP_SCALE;

      const p2x = v2.x / ProceduralHullGenerator.FP_SCALE;
      const p2y = v2.y / ProceduralHullGenerator.FP_SCALE;
      const p2z = v2.z / ProceduralHullGenerator.FP_SCALE;

      // Compute flat face normal via cross product (p1 - p0) x (p2 - p0)
      const ax = p1x - p0x;
      const ay = p1y - p0y;
      const az = p1z - p0z;

      const bx = p2x - p0x;
      const by = p2y - p0y;
      const bz = p2z - p0z;

      let nx = ay * bz - az * by;
      let ny = az * bx - ax * bz;
      let nz = ax * by - ay * bx;

      const len = Math.hypot(nx, ny, nz) || 1.0;
      nx /= len;
      ny /= len;
      nz /= len;

      // Store 3 vertices for the triangle
      const triPoints = [
        [p0x, p0y, p0z],
        [p1x, p1y, p1z],
        [p2x, p2y, p2z],
      ];

      for (const [px, py, pz] of triPoints) {
        positions[pIdx] = px;
        positions[pIdx + 1] = py;
        positions[pIdx + 2] = pz;

        normals[pIdx] = nx;
        normals[pIdx + 1] = ny;
        normals[pIdx + 2] = nz;

        colors[pIdx] = c.r;
        colors[pIdx + 1] = c.g;
        colors[pIdx + 2] = c.b;

        pIdx += 3;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return {
      geometry,
      triangleCount: totalTris,
      vertexCount: totalTris * 3,
      seed: options.seed,
    };
  }
}
