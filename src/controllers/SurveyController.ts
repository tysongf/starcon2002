/**
 * SurveyController.ts
 *
 * Encapsulates planetary orbital survey, CRT console HUD, 3D rotating canvas globe,
 * multi-band sensor sweeps (minerals, bio, anomalies), atmospheric probe deployment,
 * hostile airspace clearance checks, and Station Astrometry cartography remissions.
 */

import * as THREE from 'three';
import { ProceduralPlanet, type PlanetData } from '../entities/ProceduralPlanet';
import { ShipFlightController } from '../physics/ShipFlightController';
import { AudioEngine } from '../audio/AudioEngine';
import type { ColonyController } from './ColonyController';
import type { CommsController } from './CommsController';
import type { LanderController } from './LanderController';
import type { PrecursorTerminalController } from './PrecursorTerminalController';

export interface SurveyControllerCallbacks {
  audio: AudioEngine;
  showApNotification: (message: string, isWarning?: boolean) => void;
  fetchPlayerAP: () => Promise<void> | void;
  refreshFactionStandings: () => Promise<void> | void;
  getPlayerAP: () => { currentAP: number; maxAP: number };
  getCurrentSectorId: () => number;
  getScene: () => THREE.Scene;
  getFlightController: () => ShipFlightController;
  getColonyController: () => ColonyController;
  getCommsController: () => CommsController;
  getLanderController: () => LanderController;
  getPrecursorTerminalController: () => PrecursorTerminalController;
}

export class SurveyController {
  private callbacks: SurveyControllerCallbacks;
  private audio: AudioEngine;

  // Orbit & Planet State
  public sectorPlanets: ProceduralPlanet[] = [];
  public activePlanet: ProceduralPlanet | null = null;
  public activePlanetDetail: any | null = null;
  public activePlanetLifeforms: any[] = [];
  public isInOrbit: boolean = false;
  public activeAirspaceClearance: any | null = null;

  // Globe Canvas Rendering & Controls
  public globeCanvas: HTMLCanvasElement | null = null;
  public globeCtx: CanvasRenderingContext2D | null = null;
  public globeRotX: number = 0.2;
  public globeRotY: number = 0;
  public globeIsDragging: boolean = false;
  public globeDragLastX: number = 0;
  public globeDragLastY: number = 0;
  public globeAnimId: number | null = null;
  public hoveredHotspot: any | null = null;
  public hoveredColony: any | null = null;
  public targetedLat: number = 0;
  public targetedLng: number = 0;

  // DOM Elements
  public modalPlanetarySurvey: HTMLElement | null = null;
  private elOrbitalBanner: HTMLElement | null = null;
  private elOrbitalMsg: HTMLElement | null = null;

  constructor(callbacks: SurveyControllerCallbacks) {
    this.callbacks = callbacks;
    this.audio = callbacks.audio;
    this.initDOM();
  }

  private initDOM(): void {
    this.modalPlanetarySurvey = document.getElementById('planetary-survey-modal');
    this.elOrbitalBanner = document.getElementById('hud-orbital-banner');
    this.elOrbitalMsg = document.getElementById('orbital-msg');
    this.globeCanvas = document.getElementById('orbital-globe-canvas') as HTMLCanvasElement | null;
    if (this.globeCanvas) {
      this.globeCtx = this.globeCanvas.getContext('2d');
    }

    this.elOrbitalBanner?.addEventListener('click', () => this.enterOrbit());
    document.getElementById('btn-hud-orbit')?.addEventListener('click', () => this.enterOrbit());
    document.getElementById('btn-exit-orbit')?.addEventListener('click', () => this.exitOrbit());

    document.getElementById('btn-scan-minerals')?.addEventListener('click', () => this.performScannerSweep('MINERALS'));
    document.getElementById('btn-scan-bio')?.addEventListener('click', () => this.performScannerSweep('BIO'));
    document.getElementById('btn-scan-anomalies')?.addEventListener('click', () => this.performScannerSweep('ANOMALIES'));
    document.getElementById('btn-launch-probe')?.addEventListener('click', () => this.launchAtmosphericProbe());

    this.initGlobeCanvasControls();
  }

  /**
   * Fetches all sector planets from backend and spawns 3D ProceduralPlanets in the sector.
   */
  public async loadSectorPlanet(sectorId: number): Promise<void> {
    try {
      const res = await fetch(`http://localhost:3000/api/planets/sector/${sectorId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.planets) && data.planets.length > 0) {
        const scene = this.callbacks.getScene();
        for (const existing of this.sectorPlanets) {
          scene.remove(existing.group);
        }
        this.sectorPlanets = [];
        this.activePlanet = null;

        for (const pData of data.planets as PlanetData[]) {
          const planetObj = new ProceduralPlanet(pData);
          scene.add(planetObj.group);
          this.sectorPlanets.push(planetObj);
        }

        this.activePlanet = this.sectorPlanets[0];
        this.activePlanetDetail = data.planets[0];
        console.log(`[SurveyController] Spawned ${this.sectorPlanets.length} 3D Planets in Sector ${sectorId}`);

        // Check for founded colonies in primary sector planet
        await this.callbacks.getColonyController().fetchPlanetColonies(data.planets[0].id);
      }
    } catch (err) {
      console.warn('[SurveyController] Failed to load sector planets:', err);
    }
  }

  /**
   * Updates distance to nearest sector planet and toggles HUD orbital guidance banner.
   */
  public updatePlanetaryGuidance(deltaSec: number): void {
    if (this.sectorPlanets.length === 0 && !this.activePlanet) {
      if (this.elOrbitalBanner) this.elOrbitalBanner.classList.add('hidden');
      return;
    }

    const flightController = this.callbacks.getFlightController();
    let nearest: ProceduralPlanet | null = this.activePlanet;
    let nearestDist = Infinity;

    for (const p of this.sectorPlanets) {
      p.update(deltaSec);
      const d = p.getDistanceTo(flightController.position);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = p;
      }
    }

    if (this.sectorPlanets.length === 0 && this.activePlanet) {
      this.activePlanet.update(deltaSec);
      nearestDist = this.activePlanet.getDistanceTo(flightController.position);
    }

    if (!this.isInOrbit && nearest && nearest !== this.activePlanet) {
      this.activePlanet = nearest;
      this.activePlanetDetail = nearest.data;
    }

    if (!this.activePlanet) return;
    const dist = nearestDist;

    if (this.elOrbitalBanner && this.elOrbitalMsg) {
      if (dist <= 65.0) {
        this.elOrbitalBanner.classList.remove('hidden');
        const col = this.callbacks.getColonyController().activeColony;
        const siloPct = col ? Math.min(100, Math.round((col.stockpiled_amount / col.silo_capacity) * 100)) : 0;
        const colBadge = col ? `[🏛️ ${col.name.toUpperCase()}: ${siloPct}% SILO] ` : '';
        const typeLabel = this.activePlanet.data.subtype ? ` (${this.activePlanet.data.subtype})` : '';

        if (dist <= this.activePlanet.orbitalRadius) {
          this.elOrbitalMsg.textContent = `SYNCHRONOUS ORBIT READY: ${this.activePlanet.data.name}${typeLabel} // ${colBadge}DIST: ${dist.toFixed(1)}u [O]`;
          this.elOrbitalBanner.style.borderColor = siloPct >= 100 ? '#f59e0b' : '#10b981';
          this.elOrbitalBanner.style.color = siloPct >= 100 ? '#fbbf24' : '#10b981';
        } else {
          this.elOrbitalMsg.textContent = `APPROACHING ${this.activePlanet.data.name}${typeLabel} // ${colBadge}DIST: ${dist.toFixed(1)}u`;
          this.elOrbitalBanner.style.borderColor = siloPct >= 100 ? '#f59e0b' : '#38bdf8';
          this.elOrbitalBanner.style.color = siloPct >= 100 ? '#fbbf24' : '#38bdf8';
        }
      } else {
        this.elOrbitalBanner.classList.add('hidden');
      }
    }
  }

  /**
   * Locks ship thrusters into synchronous orbit and launches the CRT Survey Console.
   */
  public async enterOrbit(): Promise<void> {
    if (!this.activePlanet) {
      this.activePlanet = new ProceduralPlanet({
        id: 'planet_sec1_aegis',
        sectorId: 1,
        name: 'Aegis Prime',
        archetype: 'BARREN',
        radius: 24.0,
        posX: -140.0,
        posY: 0.0,
        posZ: 180.0,
        textureSeed: 101,
        atmosphereColor: '#38bdf8',
        atmosphereDensity: 0.12,
        surfaceTempK: 215,
        hazardClass: 'LOW_RADIATION',
        habitabilityRating: 18,
        controllingFaction: 'FACTION_SOL',
        description: 'Airless metallic moon rich in heavy silicate crust and structural plasteel strata.',
      });
    }
    this.isInOrbit = true;

    // Smooth thruster dampening
    const flightController = this.callbacks.getFlightController();
    flightController.reset(flightController.position.clone());

    // Sensory Immersion
    this.audio.playOrbitalCaptureSound();
    this.audio.startPlanetaryAmbience(this.activePlanet.data.archetype);

    // Populate modal telemetry
    const p = this.activePlanet.data;
    const ap = this.callbacks.getPlayerAP();
    const elName = document.getElementById('survey-planet-name');
    const elArch = document.getElementById('survey-planet-archetype');
    const elHab = document.getElementById('survey-hab-val');
    const elTemp = document.getElementById('val-telemetry-temp');
    const elDensity = document.getElementById('val-telemetry-density');
    const elHazard = document.getElementById('val-telemetry-hazard');
    const elFaction = document.getElementById('val-telemetry-faction');
    const elAp = document.getElementById('survey-player-ap');

    if (elName) elName.textContent = p.name.toUpperCase();
    const subTag = p.subtype ? `${p.subtype.toUpperCase()} [${(p.mainClassLabel || p.archetype).toUpperCase()}]` : `${p.archetype} CELESTIAL WORLD`;
    const geoStats = p.abundanceRating != null ? ` // ABUND ${p.abundanceRating} • TECT ${p.tectonicsRating ?? 3} • DENS ${p.densityRating ?? 5}` : '';
    if (elArch) elArch.textContent = `${subTag} // SECTOR ${String(p.sectorId).padStart(2, '0')}${geoStats}`;
    if (elHab) elHab.textContent = `${p.habitabilityRating}%`;
    if (elTemp) elTemp.textContent = `${p.surfaceTempK} K`;
    if (elDensity) elDensity.textContent = `${p.atmosphereDensity.toFixed(2)} Bar`;
    if (elHazard) elHazard.textContent = p.hazardClass.replace(/_/g, ' ');
    if (elFaction) elFaction.textContent = p.controllingFaction.replace(/_/g, ' ');
    if (elAp) elAp.textContent = `${ap.currentAP} / ${ap.maxAP}`;

    if (!this.modalPlanetarySurvey) {
      this.modalPlanetarySurvey = document.getElementById('planetary-survey-modal');
    }
    if (this.modalPlanetarySurvey) {
      this.modalPlanetarySurvey.classList.remove('hidden');
    }
    this.startGlobeRender();

    // Fetch authoritative survey state
    this.activePlanetLifeforms = [];
    try {
      const res = await fetch(`http://localhost:3000/api/planets/${p.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.planet) {
          this.activePlanetDetail = data.planet;
          if (data.planet.survey?.scannedBio) {
            const lfRes = await fetch(`http://localhost:3000/api/planets/${p.id}/lifeforms`);
            if (lfRes.ok) {
              const lfJson = await lfRes.json();
              this.activePlanetLifeforms = lfJson.lifeforms || [];
            }
          }
        }
      }
    } catch (err) {
      console.warn('[SurveyController] Failed to fetch planet survey detail:', err);
    }

    // Fetch Hostile Airspace Clearance
    await this.fetchPlanetAirspace(p.id);

    // Fetch Authoritative Colony State
    const colonyCtrl = this.callbacks.getColonyController();
    await colonyCtrl.fetchPlanetColonies(p.id);

    // Fetch Authoritative Precursor Sites & Relics
    await colonyCtrl.fetchPlanetPrecursorSites(p.id);

    this.updateSurveyConsoleUI();
  }

  /**
   * Disengages orbital capture and returns to flight view.
   */
  public exitOrbit(): void {
    const landerCtrl = this.callbacks.getLanderController();
    if (landerCtrl.isLanderActive) {
      landerCtrl.closeSurfaceLander();
    }
    this.callbacks.getPrecursorTerminalController().closePrecursorTerminal();
    this.isInOrbit = false;
    this.audio.stopPlanetaryAmbience();
    this.audio.playUiBlip();
    this.stopGlobeRender();

    if (this.modalPlanetarySurvey) {
      this.modalPlanetarySurvey.classList.add('hidden');
    }

    // Nudge ship slightly away from planet center
    if (this.activePlanet) {
      const flightController = this.callbacks.getFlightController();
      const awayDir = flightController.position.clone().sub(this.activePlanet.position).normalize();
      flightController.position.addScaledVector(awayDir, 3.5);
    }
  }

  /**
   * Day 21: Checks whether the pilot has airspace clearance (or needs a ceasefire truce) over a planet.
   */
  public async fetchPlanetAirspace(planetId: string): Promise<void> {
    try {
      const res = await fetch(`http://localhost:3000/api/planets/${planetId}/airspace?accountId=acc_sol_captain`);
      if (res.ok) {
        const data = await res.json();
        this.activeAirspaceClearance = data.clearance || null;
      }
    } catch (err) {
      console.warn('[SurveyController] Failed to fetch airspace clearance:', err);
    }
  }

  /**
   * Initializes mouse drag and hover listeners for the 3D canvas globe.
   */
  private initGlobeCanvasControls(): void {
    if (!this.globeCanvas) return;

    this.globeCanvas.addEventListener('mousedown', (e: MouseEvent) => {
      this.globeIsDragging = true;
      this.globeDragLastX = e.clientX;
      this.globeDragLastY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.globeIsDragging = false;
    });

    this.globeCanvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.globeCanvas) return;
      const rect = this.globeCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.globeIsDragging) {
        const dx = e.clientX - this.globeDragLastX;
        const dy = e.clientY - this.globeDragLastY;
        this.globeRotY += dx * 0.012;
        this.globeRotX = Math.max(-1.3, Math.min(1.3, this.globeRotX + dy * 0.012));
        this.globeDragLastX = e.clientX;
        this.globeDragLastY = e.clientY;
      }

      // Calculate spherical coordinates under cursor
      const cx = 170;
      const cy = 170;
      const R = 125;
      const dx = mouseX - cx;
      const dy = mouseY - cy;
      const d = Math.sqrt(dx * dx + dy * dy);

      const elLat = document.getElementById('val-cursor-lat');
      const elLng = document.getElementById('val-cursor-lng');

      if (d <= R) {
        const z = Math.sqrt(R * R - d * d);
        // Inverse sphere rotation
        const cosX = Math.cos(-this.globeRotX);
        const sinX = Math.sin(-this.globeRotX);
        const cosY = Math.cos(-this.globeRotY);
        const sinY = Math.sin(-this.globeRotY);

        const y1 = dy * cosX - z * sinX;
        const z1 = dy * sinX + z * cosX;
        const x2 = dx * cosY + z1 * sinY;
        const z2 = -dx * sinY + z1 * cosY;

        const latDeg = Math.round((-y1 / R) * 90);
        const lngDeg = Math.round(Math.atan2(x2, z2) * (180 / Math.PI));

        if (elLat) elLat.textContent = `${latDeg >= 0 ? '+' : ''}${latDeg}°`;
        if (elLng) elLng.textContent = `${lngDeg >= 0 ? '+' : ''}${lngDeg}°`;

        // Check if hovering near a hotspot
        this.hoveredHotspot = null;
        if (this.activePlanetDetail?.survey?.discoveredHotspots) {
          for (const h of this.activePlanetDetail.survey.discoveredHotspots) {
            const hPos = this.getHotspotScreenPos(h.lat, h.lng, R, cx, cy);
            if (hPos && Math.hypot(mouseX - hPos.x, mouseY - hPos.y) < 14) {
              this.hoveredHotspot = h;
              break;
            }
          }
        }

        // Check if hovering near a colony
        this.hoveredColony = null;
        const coloniesList = this.callbacks.getColonyController().activeColoniesList;
        if (coloniesList) {
          for (const col of coloniesList) {
            const cPos = this.getHotspotScreenPos(col.surface_lat, col.surface_lng, R, cx, cy);
            if (cPos && Math.hypot(mouseX - cPos.x, mouseY - cPos.y) < 16) {
              this.hoveredColony = col;
              break;
            }
          }
        }
      } else {
        this.hoveredHotspot = null;
        this.hoveredColony = null;
      }
    });

    this.globeCanvas.addEventListener('click', (e: MouseEvent) => {
      if (!this.globeCanvas) return;
      const rect = this.globeCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const cx = 170;
      const cy = 170;
      const R = 125;
      const dx = mouseX - cx;
      const dy = mouseY - cy;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d <= R) {
        // If clicked on an existing colony, switch to Colony Command tab!
        if (this.hoveredColony) {
          this.callbacks.getColonyController().switchSurveyTab('COLONY');
          this.callbacks.showApNotification(`🏛️ Interfacing with ${this.hoveredColony.name}...`, false);
          return;
        }

        const z = Math.sqrt(R * R - d * d);
        const cosX = Math.cos(-this.globeRotX);
        const sinX = Math.sin(-this.globeRotX);
        const cosY = Math.cos(-this.globeRotY);
        const sinY = Math.sin(-this.globeRotY);

        const y1 = dy * cosX - z * sinX;
        const z1 = dy * sinX + z * cosX;
        const x2 = dx * cosY + z1 * sinY;
        const z2 = -dx * sinY + z1 * cosY;

        this.targetedLat = Math.round((-y1 / R) * 90);
        this.targetedLng = Math.round(Math.atan2(x2, z2) * (180 / Math.PI));
        this.audio.playUiBlip();
        this.callbacks.showApNotification(`🎯 PROBE TARGET LOCKED: Lat ${this.targetedLat}°, Lng ${this.targetedLng}°`, false);
      }
    });
  }

  /**
   * Helper to project (lat, lng) to 2D canvas coordinates on the rotating sphere.
   */
  public getHotspotScreenPos(lat: number, lng: number, R: number, cx: number, cy: number): { x: number; y: number } | null {
    const phi = (lat * Math.PI) / 180;
    const lambda = (lng * Math.PI) / 180;

    // Local sphere coordinates
    const x = R * Math.cos(phi) * Math.sin(lambda);
    const y = -R * Math.sin(phi);
    const z = R * Math.cos(phi) * Math.cos(lambda);

    // Apply Y-axis rotation (spin)
    const cosY = Math.cos(this.globeRotY);
    const sinY = Math.sin(this.globeRotY);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;

    // Apply X-axis rotation (tilt)
    const cosX = Math.cos(this.globeRotX);
    const sinX = Math.sin(this.globeRotX);
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    // Visible on front hemisphere only
    if (z2 <= 0) return null;

    return {
      x: cx + x1,
      y: cy + y2,
    };
  }

  /**
   * Starts the 60fps render loop for the 3D rotating canvas globe.
   */
  public startGlobeRender(): void {
    this.stopGlobeRender();
    const render = () => {
      if (!this.isInOrbit) return;
      this.drawGlobeCanvas();
      this.globeAnimId = requestAnimationFrame(render);
    };
    this.globeAnimId = requestAnimationFrame(render);
  }

  /**
   * Stops the canvas globe animation loop.
   */
  public stopGlobeRender(): void {
    if (this.globeAnimId !== null) {
      cancelAnimationFrame(this.globeAnimId);
      this.globeAnimId = null;
    }
  }

  /**
   * Draws the Star Control II style shaded 3D globe with latitude/longitude grid and phosphor hotspots.
   */
  public drawGlobeCanvas(): void {
    if (!this.globeCtx || !this.globeCanvas) return;
    const ctx = this.globeCtx;
    const w = this.globeCanvas.width;
    const h = this.globeCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const R = 125;

    // Continuous auto-rotation when not dragging
    if (!this.globeIsDragging) {
      this.globeRotY += 0.003;
    }

    // Clear background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    // 1. Shaded Sphere Base with Archetype Gradient
    const archetype = this.activePlanetDetail?.archetype || 'BARREN';
    let lightColor = '#64748b';
    let darkColor = '#0f172a';
    let rimColor = 'rgba(56, 189, 248, 0.4)';

    if (archetype === 'VOLCANIC') {
      lightColor = '#b91c1c';
      darkColor = '#450a0a';
      rimColor = 'rgba(249, 115, 22, 0.5)';
    } else if (archetype === 'TERRESTRIAL') {
      lightColor = '#059669';
      darkColor = '#022c22';
      rimColor = 'rgba(16, 185, 129, 0.5)';
    } else if (archetype === 'GAS_GIANT') {
      lightColor = '#0284c7';
      darkColor = '#082f49';
      rimColor = 'rgba(56, 189, 248, 0.6)';
    } else if (archetype === 'PRECURSOR_RUIN') {
      lightColor = '#7e22ce';
      darkColor = '#3b0764';
      rimColor = 'rgba(236, 72, 153, 0.5)';
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    // Radial gradient simulating sun lighting from top-left
    const grad = ctx.createRadialGradient(cx - 40, cy - 40, 10, cx, cy, R);
    grad.addColorStop(0, lightColor);
    grad.addColorStop(0.7, darkColor);
    grad.addColorStop(1.0, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. Latitude Circles
    const latBands = [-60, -30, 0, 30, 60];
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 1.0;

    for (const lat of latBands) {
      ctx.beginPath();
      let started = false;
      for (let lng = -180; lng <= 180; lng += 10) {
        const pt = this.getHotspotScreenPos(lat, lng, R, cx, cy);
        if (pt) {
          if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    // 3. Longitude Meridians
    for (let lng = -180; lng < 180; lng += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -80; lat <= 80; lat += 5) {
        const pt = this.getHotspotScreenPos(lat, lng, R, cx, cy);
        if (pt) {
          if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    // 4. Discovered Hotspots (Phosphor Blips)
    if (this.activePlanetDetail?.survey?.discoveredHotspots) {
      const now = performance.now();
      const pulse = 0.7 + 0.3 * Math.sin(now * 0.006);

      for (const h of this.activePlanetDetail.survey.discoveredHotspots) {
        const pt = this.getHotspotScreenPos(h.lat, h.lng, R, cx, cy);
        if (!pt) continue;

        ctx.save();
        ctx.fillStyle = h.color || '#38bdf8';
        ctx.shadowColor = h.color || '#38bdf8';
        ctx.shadowBlur = 8 * pulse;

        // Diamond blip
        const size = (this.hoveredHotspot?.id === h.id ? 7 : 4.5) * pulse;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - size);
        ctx.lineTo(pt.x + size, pt.y);
        ctx.lineTo(pt.x, pt.y + size);
        ctx.lineTo(pt.x - size, pt.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 5. Active Sensor Beacons (Pulsating Rings)
    if (this.activePlanetDetail?.beacons) {
      const now = performance.now();
      for (const b of this.activePlanetDetail.beacons) {
        const pt = this.getHotspotScreenPos(b.surfaceLat, b.surfaceLng, R, cx, cy);
        if (!pt) continue;

        const ringR = 3 + ((now * 0.005) % 8);
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 5b. Active Surface Colonies (Geodesic Dome & Foundation Ring)
    const coloniesList = this.callbacks.getColonyController().activeColoniesList;
    if (coloniesList && coloniesList.length > 0) {
      const now = performance.now();
      for (const col of coloniesList) {
        const pt = this.getHotspotScreenPos(col.surface_lat, col.surface_lng, R, cx, cy);
        if (!pt) continue;

        ctx.save();
        // Pulsing foundation ring
        const pulse = 0.8 + 0.2 * Math.sin(now * 0.005);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10 * pulse;
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y + 2, 9 * pulse, 4.5 * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Glowing geodesic dome (semi-circle)
        ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y + 2, 7, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Dome facet structural lines
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(pt.x - 4, pt.y + 2);
        ctx.lineTo(pt.x, pt.y - 5);
        ctx.lineTo(pt.x + 4, pt.y + 2);
        ctx.stroke();

        // Communication Spire & beacon ping
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - 5);
        ctx.lineTo(pt.x, pt.y - 11);
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y - 11, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Subtle colony label badge
        const colLabel = `${col.name.toUpperCase()} [T${Math.max(col.derrick_tier, col.habitation_tier)}]`;
        ctx.font = 'bold 8px monospace';
        const lw = ctx.measureText(colLabel).width;
        ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
        ctx.fillRect(pt.x - lw / 2 - 3, pt.y - 23, lw + 6, 11);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.strokeRect(pt.x - lw / 2 - 3, pt.y - 23, lw + 6, 11);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(colLabel, pt.x - lw / 2, pt.y - 15);

        ctx.restore();
      }
    }

    // 5c. Precursor Megastructures & Unresolved Signal Blips
    const colonyCtrl = this.callbacks.getColonyController();
    if (colonyCtrl.planetPrecursorSites && colonyCtrl.planetPrecursorSites.length > 0) {
      const now = performance.now();
      const pulse = 0.7 + 0.3 * Math.sin(now * 0.007);
      for (const site of colonyCtrl.planetPrecursorSites) {
        const pt = this.getHotspotScreenPos(site.surfaceLat, site.surfaceLng, R, cx, cy);
        if (!pt) continue;
        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10 * pulse;

        // Monolith marker
        ctx.beginPath();
        ctx.rect(pt.x - 3, pt.y - 7, 6, 14);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 8px monospace';
        const label = site.name.toUpperCase();
        const lw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
        ctx.fillRect(pt.x - lw / 2 - 2, pt.y - 20, lw + 4, 10);
        ctx.fillStyle = '#00f0ff';
        ctx.fillText(label, pt.x - lw / 2, pt.y - 12);
        ctx.restore();
      }
    } else if (colonyCtrl.unresolvedPrecursorSignals > 0) {
      const now = performance.now();
      const pulse = 0.6 + 0.4 * Math.sin(now * 0.006);
      const pt = this.getHotspotScreenPos(-15.0, 60.0, R, cx, cy);
      if (pt) {
        ctx.save();
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 10 * pulse;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#e9d5ff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('?', pt.x, pt.y + 3);
        ctx.restore();
      }
    }

    ctx.restore(); // End sphere clip

    // 6. Atmospheric Rim Glow
    ctx.save();
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = rimColor;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 7. Hovered Hotspot Tooltip
    if (this.hoveredHotspot) {
      const pt = this.getHotspotScreenPos(this.hoveredHotspot.lat, this.hoveredHotspot.lng, R, cx, cy);
      if (pt) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = this.hoveredHotspot.color || '#38bdf8';
        ctx.lineWidth = 1;
        const text = `${this.hoveredHotspot.name} [${this.hoveredHotspot.yieldEstimate}]`;
        ctx.font = 'bold 9px monospace';
        const tw = ctx.measureText(text).width;
        ctx.fillRect(pt.x + 8, pt.y - 18, tw + 10, 16);
        ctx.strokeRect(pt.x + 8, pt.y - 18, tw + 10, 16);

        ctx.fillStyle = '#f8fafc';
        ctx.fillText(text, pt.x + 13, pt.y - 6);
        ctx.restore();
      }
    }

    // 8. Hovered Colony Tooltip
    if (this.hoveredColony) {
      const pt = this.getHotspotScreenPos(this.hoveredColony.surface_lat, this.hoveredColony.surface_lng, R, cx, cy);
      if (pt) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.2;
        const text = `🏛️ ${this.hoveredColony.name} [POP: ${this.hoveredColony.population}] (CLICK TO MANAGE)`;
        ctx.font = 'bold 9px monospace';
        const tw = ctx.measureText(text).width;
        ctx.fillRect(pt.x + 8, pt.y - 18, tw + 10, 16);
        ctx.strokeRect(pt.x + 8, pt.y - 18, tw + 10, 16);

        ctx.fillStyle = '#fbbf24';
        ctx.fillText(text, pt.x + 13, pt.y - 6);
        ctx.restore();
      }
    }
  }

  /**
   * Updates all survey modal widgets, buttons, and progress counters.
   */
  public updateSurveyConsoleUI(): void {
    if (!this.activePlanetDetail) return;
    const survey = this.activePlanetDetail.survey;

    const elCompVal = document.getElementById('survey-comp-val');
    if (elCompVal) elCompVal.textContent = `${survey.surveyCompletion}%`;

    const elStatMin = document.getElementById('status-scan-minerals');
    const elStatBio = document.getElementById('status-scan-bio');
    const elStatAno = document.getElementById('status-scan-anomalies');

    const isAirspaceLocked = Boolean(
      this.activeAirspaceClearance &&
      !this.activeAirspaceClearance.cleared &&
      this.activeAirspaceClearance.truceRequired
    );

    // Dynamic Airspace Banner & Lock-State Controls
    const scannerSection = document.querySelector('.survey-scanner-section');
    let banner = document.getElementById('survey-airspace-banner');

    if (isAirspaceLocked) {
      if (!banner && scannerSection) {
        banner = document.createElement('div');
        banner.id = 'survey-airspace-banner';
        banner.className = 'survey-airspace-banner';
        scannerSection.prepend(banner);
      }
      if (banner) {
        const facName = this.activeAirspaceClearance.factionName || 'FACTION';
        banner.innerHTML = `
          <div class="airspace-banner-text">
            <span class="airspace-banner-title">⚠️ ${facName.toUpperCase()} AIRSPACE — TRUCE REQUIRED</span>
            <span class="airspace-banner-sub">Standing: ${this.activeAirspaceClearance.standing}. Ceasefire truce required for planetary survey and surface operations.</span>
          </div>
          <button class="btn-hail-airspace" id="btn-hail-airspace-patrol">HAIL PATROL [COMM]</button>
        `;
        const hailBtn = document.getElementById('btn-hail-airspace-patrol');
        if (hailBtn) {
          hailBtn.onclick = () => {
            const fid = this.activeAirspaceClearance.factionId;
            const npcId = fid === 'FACTION_PHORID' ? 'npc_mycelis' : fid === 'FACTION_KRYLL' ? 'npc_skrit' : 'npc_vorash';
            this.callbacks.getCommsController().openAlienComms(npcId);
          };
        }
      }
    } else {
      if (banner) {
        banner.remove();
      }
    }

    // Buttons
    const btnMin = document.getElementById('btn-scan-minerals') as HTMLButtonElement | null;
    const btnBio = document.getElementById('btn-scan-bio') as HTMLButtonElement | null;
    const btnAno = document.getElementById('btn-scan-anomalies') as HTMLButtonElement | null;
    const btnProbe = document.getElementById('btn-launch-probe') as HTMLButtonElement | null;
    const btnLander = document.getElementById('btn-deploy-lander') as HTMLButtonElement | null;
    const btnFoundColony = document.getElementById('btn-found-colony') as HTMLButtonElement | null;

    if (btnMin) btnMin.disabled = isAirspaceLocked;
    if (btnBio) btnBio.disabled = isAirspaceLocked;
    if (btnAno) btnAno.disabled = isAirspaceLocked;
    if (btnProbe) btnProbe.disabled = isAirspaceLocked;
    if (btnLander) btnLander.disabled = isAirspaceLocked;
    if (btnFoundColony) btnFoundColony.disabled = isAirspaceLocked;

    if (elStatMin) {
      if (isAirspaceLocked && !survey.scannedMinerals) {
        elStatMin.textContent = 'HEGEMONY AIRSPACE — TRUCE REQUIRED';
        elStatMin.classList.remove('active');
      } else if (survey.scannedMinerals) {
        elStatMin.textContent = 'ACTIVE // SCAN COMPLETE';
        elStatMin.classList.add('active');
      } else {
        elStatMin.textContent = 'UNSCANNED // 2 AP';
        elStatMin.classList.remove('active');
      }
    }

    if (elStatBio) {
      if (isAirspaceLocked && !survey.scannedBio) {
        elStatBio.textContent = 'HEGEMONY AIRSPACE — TRUCE REQUIRED';
        elStatBio.classList.remove('active');
      } else if (survey.scannedBio) {
        elStatBio.textContent = 'ACTIVE // SCAN COMPLETE';
        elStatBio.classList.add('active');
      } else {
        elStatBio.textContent = 'UNSCANNED // 2 AP';
        elStatBio.classList.remove('active');
      }
    }

    if (elStatAno) {
      if (isAirspaceLocked && !survey.scannedAnomalies) {
        elStatAno.textContent = 'HEGEMONY AIRSPACE — TRUCE REQUIRED';
        elStatAno.classList.remove('active');
      } else if (survey.scannedAnomalies) {
        elStatAno.textContent = 'ACTIVE // SCAN COMPLETE';
        elStatAno.classList.add('active');
      } else {
        elStatAno.textContent = 'UNSCANNED // 2 AP';
        elStatAno.classList.remove('active');
      }
    }

    const elBeaconsCount = document.getElementById('survey-beacons-count');
    if (elBeaconsCount) {
      elBeaconsCount.textContent = `${this.activePlanetDetail.beacons?.length || 0}`;
    }

    const ap = this.callbacks.getPlayerAP();
    const elAp = document.getElementById('survey-player-ap');
    if (elAp) elAp.textContent = `${ap.currentAP} / ${ap.maxAP}`;

    this.refreshHotspotsLedger();
  }

  /**
   * Refreshes the scrollable list of discovered hotspots and active beacons.
   */
  public refreshHotspotsLedger(): void {
    const list = document.getElementById('survey-hotspots-list');
    if (!list) return;

    const hotspots = this.activePlanetDetail?.survey?.discoveredHotspots || [];
    const beacons = this.activePlanetDetail?.beacons || [];
    const colonyCtrl = this.callbacks.getColonyController();

    if (hotspots.length === 0 && beacons.length === 0 && colonyCtrl.unresolvedPrecursorSignals === 0) {
      list.innerHTML = `<div class="ledger-empty">NO HOTSPOTS DETECTED. INITIATE SENSOR SWEEPS [1-3] TO IDENTIFY SURFACE DEPOSITS.</div>`;
      return;
    }

    let html = '';

    // Unresolved Precursor Signal entry
    if (colonyCtrl.unresolvedPrecursorSignals > 0 && colonyCtrl.planetPrecursorSites.length === 0) {
      html += `
        <div class="hotspot-card unresolved">
          <div class="hotspot-card-left">
            <span class="hotspot-dot" style="color: #a855f7; box-shadow: 0 0 10px #a855f7;"></span>
            <div class="hotspot-card-info">
              <span class="hotspot-name">UNRESOLVED PRECURSOR SIGNAL</span>
              <span class="hotspot-coords">SURFACE RESONANCE DETECTED // CARRIER FREQUENCIES OBSCURED</span>
            </div>
          </div>
          <span class="unresolved-pill">REQ >= ${colonyCtrl.precursorRequiredSurvey}% SURVEY (${this.activePlanetDetail?.survey?.surveyCompletion || 0}%)</span>
        </div>
      `;
    }

    for (const h of hotspots) {
      html += `
        <div class="hotspot-card" data-lat="${h.lat}" data-lng="${h.lng}">
          <div class="hotspot-card-left">
            <span class="hotspot-dot" style="color: ${h.color};"></span>
            <div class="hotspot-card-info">
              <span class="hotspot-name">${h.name}</span>
              <span class="hotspot-coords">LAT: ${h.lat.toFixed(1)}° // LNG: ${h.lng.toFixed(1)}°</span>
            </div>
          </div>
          <span class="hotspot-yield">${h.yieldEstimate}</span>
        </div>
      `;
    }

    for (const b of beacons) {
      html += `
        <div class="hotspot-card" style="border-color: rgba(255, 255, 255, 0.4);">
          <div class="hotspot-card-left">
            <span class="hotspot-dot" style="color: #ffffff; box-shadow: 0 0 10px #ffffff;"></span>
            <div class="hotspot-card-info">
              <span class="hotspot-name">SURFACE SENSOR BEACON</span>
              <span class="hotspot-coords">LAT: ${b.surfaceLat.toFixed(1)}° // LNG: ${b.surfaceLng.toFixed(1)}°</span>
            </div>
          </div>
          <span class="hotspot-yield" style="color: #10b981;">${b.yieldSummary}</span>
        </div>
      `;
    }

    if (this.activePlanetDetail?.survey?.scannedBio && this.activePlanetLifeforms.length > 0) {
      for (const sp of this.activePlanetLifeforms) {
        html += `
          <div class="hotspot-card" style="border-color: ${sp.primaryColor || '#10b981'};">
            <div class="hotspot-card-left">
              <span class="hotspot-dot" style="color: ${sp.primaryColor || '#10b981'};"></span>
              <div class="hotspot-card-info">
                <span class="hotspot-name">🧬 ${sp.commonName} <em style="opacity:0.75;">(${sp.scientificName})</em></span>
                <span class="hotspot-coords">${sp.kingdom} // ${sp.covering}, ${sp.sizeMeters}m // ${sp.adaptationTrait}</span>
              </div>
            </div>
            <span class="hotspot-yield">${sp.rarityTier} • ${sp.bioUnitValue}u</span>
          </div>
        `;
      }
    }

    list.innerHTML = html;
  }

  /**
   * Executes a specialized sensor sweep across the chosen sensor band.
   */
  public async performScannerSweep(band: 'MINERALS' | 'BIO' | 'ANOMALIES'): Promise<void> {
    if (!this.activePlanet || !this.activePlanetDetail) return;

    const ap = this.callbacks.getPlayerAP();
    if (ap.currentAP < 2) {
      this.callbacks.showApNotification('⚠️ INSUFFICIENT ACTION POINTS: Sweep requires 2 AP.', true);
      return;
    }

    // Play band sonar ping
    this.audio.playScannerSonarPing(band);

    try {
      const res = await fetch(`http://localhost:3000/api/planets/${this.activePlanet.data.id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
          scanBand: band,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Scan sweep failed'}`, true);
        return;
      }

      this.activePlanetDetail.survey = data.survey;
      if (Array.isArray(data.lifeformsDiscovered)) {
        this.activePlanetLifeforms = data.lifeformsDiscovered;
      }
      this.callbacks.fetchPlayerAP();
      this.updateSurveyConsoleUI();
      this.callbacks.showApNotification(`📡 ${data.message}`, false);
    } catch (err) {
      console.error('[SurveyController] Scanner sweep failed:', err);
    }
  }

  /**
   * Launches an Atmospheric / Surface Probe to sample materials and establish a permanent beacon.
   */
  public async launchAtmosphericProbe(): Promise<void> {
    if (!this.activePlanet || !this.activePlanetDetail) return;

    const checkShield = document.getElementById('check-probe-shield') as HTMLInputElement | null;
    const shieldBoost = checkShield ? checkShield.checked : false;

    const ap = this.callbacks.getPlayerAP();
    if (shieldBoost && ap.currentAP < 1) {
      this.callbacks.showApNotification('⚠️ INSUFFICIENT AP: Shield reinforcement requires 1 AP.', true);
      return;
    }

    const btn = document.getElementById('btn-launch-probe') as HTMLButtonElement | null;
    if (btn) btn.disabled = true;

    // Show descent telemetry display
    const descentBox = document.getElementById('probe-descent-display');
    const altMarker = document.getElementById('probe-altitude-marker');
    const altVal = document.getElementById('probe-alt-val');
    const velVal = document.getElementById('probe-vel-val');
    const shieldVal = document.getElementById('probe-shield-val');
    const statusMsg = document.getElementById('probe-status-msg');

    if (descentBox) descentBox.classList.remove('hidden');

    this.audio.playProbeAtmosphericBurn(shieldBoost);

    // Animate descent
    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.08;
      const pct = Math.min(100, Math.round(progress * 100));
      const altKm = Math.max(0, Math.round(120 * (1 - progress)));
      const velKms = Math.max(0.5, Number((4.2 * (1 - progress * 0.7)).toFixed(1)));

      if (altMarker) altMarker.style.width = `${pct}%`;
      if (altVal) altVal.textContent = `${altKm} km`;
      if (velVal) velVal.textContent = `${velKms} km/s`;
      if (shieldVal) shieldVal.textContent = shieldBoost ? '94%' : '68%';

      if (progress >= 1.0) {
        clearInterval(interval);
      }
    }, 80);

    try {
      const res = await fetch(`http://localhost:3000/api/planets/${this.activePlanet.data.id}/probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
          targetLat: this.targetedLat,
          targetLng: this.targetedLng,
          shieldBoost,
        }),
      });

      const data = await res.json();
      if (btn) btn.disabled = false;

      if (!res.ok || !data.success) {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Probe deployment failed'}`, true);
        if (statusMsg) statusMsg.textContent = 'PROBE TELEMETRY LOST';
        return;
      }

      if (statusMsg) statusMsg.textContent = `TOUCHDOWN CONFIRMED // BEACON ONLINE`;

      // Update local state
      this.activePlanetDetail.beacons.unshift({
        id: data.beaconId,
        surfaceLat: this.targetedLat,
        surfaceLng: this.targetedLng,
        yieldSummary: data.yieldSummary,
        createdAt: new Date().toISOString(),
      });

      this.callbacks.fetchPlayerAP();
      this.updateSurveyConsoleUI();
      this.callbacks.showApNotification(`🚀 ${data.message}`, false);

      setTimeout(() => {
        if (descentBox) descentBox.classList.add('hidden');
      }, 4000);
    } catch (err) {
      if (btn) btn.disabled = false;
      console.error('[SurveyController] Probe launch failed:', err);
    }
  }

  /**
   * Refreshes the Station Astrometry Cartography Bureau in the diplomacy lounge.
   */
  public async refreshAstrometryBureau(): Promise<void> {
    const list = document.getElementById('astrometry-planets-list');
    if (!list) return;

    try {
      const sectorId = this.callbacks.getCurrentSectorId();
      const res = await fetch(`http://localhost:3000/api/planets/sector/${sectorId}`);
      if (!res.ok) return;
      const data = await res.json();
      const planets = data.planets || [];

      let html = '';
      let qualifyingCount = 0;

      for (const p of planets) {
        const comp = p.survey?.surveyCompletion || 0;
        if (comp >= 33) {
          qualifyingCount++;
          const isSold = p.survey.isDataSold;
          const factionMultiplier = p.controllingFaction === 'FACTION_SOL' ? 1.4 : 1.0;
          const creditReward = Math.round((comp / 100) * 1000 * factionMultiplier);

          html += `
            <div class="astrometry-card">
              <div class="astrometry-card-left">
                <div class="astrometry-planet-title">
                  <span>${p.name}</span>
                  <span class="astrometry-comp-badge">${comp}% SURVEYED</span>
                </div>
                <div class="astrometry-planet-details">
                  ${p.archetype} WORLD // HABITABILITY: ${p.habitabilityRating}% // BEACONS: ${p.beacons?.length || 0}
                </div>
              </div>
              <button class="astrometry-bounty-btn" data-planet-id="${p.id}" ${isSold ? 'disabled' : ''}>
                ${isSold ? 'REMITTED // PAID' : `REMIT DATA (+${creditReward} CR, +5 AP, +15 Goodwill)`}
              </button>
            </div>
          `;
        }
      }

      if (qualifyingCount === 0) {
        html = `
          <div class="ledger-empty" style="color: #94a3b8; text-align: left; padding: 0.8rem 0;">
            No authenticated survey logs in archive. Scan celestial planets in the sector to >=33% completion to sell astrometry logs here.
          </div>
        `;
      }

      list.innerHTML = html;

      // Bind remit buttons
      const btns = list.querySelectorAll('.astrometry-bounty-btn:not([disabled])');
      btns.forEach((b) => {
        b.addEventListener('click', async (e) => {
          const planetId = (e.currentTarget as HTMLElement).getAttribute('data-planet-id');
          if (!planetId) return;
          try {
            const sellRes = await fetch(`http://localhost:3000/api/planets/${planetId}/sell-data`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accountId: 'acc_sol_captain',
                portId: 'PORT_AEGIS_01',
              }),
            });
            const sellData = await sellRes.json();
            if (sellRes.ok && sellData.success) {
              this.audio.playUiBlip();
              this.callbacks.showApNotification(`💰 ${sellData.message}`, false);
              this.callbacks.fetchPlayerAP();
              this.callbacks.refreshFactionStandings();
              this.refreshAstrometryBureau();
            } else {
              this.callbacks.showApNotification(`⚠️ ${sellData.error || 'Sale failed'}`, true);
            }
          } catch (err) {
            console.error('[SurveyController] Failed to sell survey data:', err);
          }
        });
      });
    } catch (err) {
      console.warn('[SurveyController] Astrometry bureau fetch failed:', err);
    }
  }
}
