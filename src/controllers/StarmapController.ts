export interface StarSystem {
  id: number;
  name: string;
  coordinatesX: number;
  coordinatesY: number;
  spectralClass: string;
  starRadius: number;
  hazardLevel: number;
  controllingFaction: string;
  description: string;
  hasPort: boolean;
  hasColony: boolean;
  planetCount: number;
}

export interface FactionSphere {
  factionId: string;
  name: string;
  centerX: number;
  centerY: number;
  radius: number;
  color: string;
  description: string;
}

export interface CoursePlotResult {
  success: boolean;
  sourceSectorId: number;
  sourceName: string;
  sourceCoords: [number, number];
  targetSectorId: number;
  targetName: string;
  targetCoords: [number, number];
  distanceLY: number;
  baseFuelCost: number;
  escortFuelCost: number;
  totalFuelCost: number;
  etaSeconds: number;
  hasSufficientFuel: boolean;
  currentFuel: number;
  activeEscortsCount: number;
  locked: boolean;
  error?: string;
}

export interface StarmapContext {
  getAccountId: () => string;
  showNotification?: (msg: string, isError?: boolean) => void;
  playUiBlip?: () => void;
  playNavPlotTone?: () => void;
  playStarmapOpen?: () => void;
}

export class StarmapController {
  private ctx: StarmapContext;

  public modal: HTMLElement | null = null;
  public canvas: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;

  public systems: StarSystem[] = [];
  public spheres: FactionSphere[] = [];
  public selectedSystem: StarSystem | null = null;
  public hoveredSystem: StarSystem | null = null;
  public activeCourse: CoursePlotResult | null = null;

  public playerCoords: [number, number] = [500.0, 500.0];
  public playerFuel: number = 100;
  public playerSectorId: number = 1;
  public activeEscortsCount: number = 0;

  // Viewport camera
  public cameraX: number = 500.0;
  public cameraY: number = 500.0;
  public zoom: number = 1.0;
  public isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private camStartX: number = 0;
  private camStartY: number = 0;

  // Mouse coords for tooltip
  private mouseScreenX: number = 0;
  private mouseScreenY: number = 0;

  // Search & Filter
  public searchTerm: string = '';
  public factionFilter: string = 'ALL';

  // DOM Elements
  public searchInput: HTMLInputElement | null = null;
  public factionSelect: HTMLSelectElement | null = null;
  public btnClose: HTMLElement | null = null;
  public btnLockCourse: HTMLButtonElement | null = null;
  public btnClearCourse: HTMLButtonElement | null = null;
  public btnCenterPlayer: HTMLButtonElement | null = null;
  public selectedInfoCard: HTMLElement | null = null;

  public isOpen: boolean = false;

  constructor(ctx: StarmapContext) {
    this.ctx = ctx;
    this.initDOM();
  }

  private initDOM(): void {
    this.modal = document.getElementById('starmap-modal');
    this.canvas = document.getElementById('starmap-canvas') as HTMLCanvasElement;
    if (this.canvas) {
      this.canvasCtx = this.canvas.getContext('2d');
    }

    this.searchInput = document.getElementById('starmap-search') as HTMLInputElement;
    this.factionSelect = document.getElementById('starmap-faction-filter') as HTMLSelectElement;
    this.btnClose = document.getElementById('starmap-btn-close');
    this.btnLockCourse = document.getElementById('starmap-btn-lock') as HTMLButtonElement;
    this.btnClearCourse = document.getElementById('starmap-btn-clear') as HTMLButtonElement;
    this.btnCenterPlayer = document.getElementById('starmap-btn-center') as HTMLButtonElement;
    this.selectedInfoCard = document.getElementById('starmap-selected-card');

    // Bind event listeners
    this.btnClose?.addEventListener('click', () => this.closeStarmap());
    this.btnCenterPlayer?.addEventListener('click', () => this.centerOnPlayer());
    this.btnLockCourse?.addEventListener('click', () => {
      if (this.selectedSystem) {
        this.lockCourse(this.selectedSystem.id);
      }
    });
    this.btnClearCourse?.addEventListener('click', () => this.clearCourse());

    this.searchInput?.addEventListener('input', (e) => {
      this.searchTerm = (e.target as HTMLInputElement).value;
    });

    this.factionSelect?.addEventListener('change', (e) => {
      this.factionFilter = (e.target as HTMLSelectElement).value;
    });

    // Canvas interactivity
    if (this.canvas) {
      this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
      window.addEventListener('mousemove', (e) => this.onMouseMove(e));
      window.addEventListener('mouseup', () => this.onMouseUp());
      this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      this.canvas.addEventListener('click', (e) => this.onClick(e));
    }

    window.addEventListener('resize', () => {
      if (this.isOpen) this.resizeCanvas();
    });
  }

  public async openStarmap(): Promise<void> {
    this.isOpen = true;
    if (this.modal) {
      this.modal.classList.remove('hidden');
      this.modal.style.display = 'flex';
    }

    this.resizeCanvas();
    this.ctx.playStarmapOpen?.();

    await this.fetchPlayerTelemetry();
    await this.fetchGalaxyData();

    this.centerOnPlayer();
    this.startRenderLoop();
  }

  public closeStarmap(): void {
    this.isOpen = false;
    if (this.modal) {
      this.modal.classList.add('hidden');
      this.modal.style.display = 'none';
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.ctx.playUiBlip?.();
  }

  public toggleStarmap(): void {
    if (this.isOpen) {
      this.closeStarmap();
    } else {
      this.openStarmap();
    }
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
    }
  }

  public centerOnPlayer(): void {
    this.cameraX = this.playerCoords[0];
    this.cameraY = this.playerCoords[1];
    this.zoom = 1.0;
  }

  public async fetchPlayerTelemetry(): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch(`/api/player/ship?playerId=${accountId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ship) {
          this.playerSectorId = Number(data.ship.current_sector_id);
          this.playerFuel = Number(data.ship.fuel);
        }
      }

      // Fetch active wingmen count
      const fleetRes = await fetch(`/api/fleet/roster?accountId=${accountId}`);
      if (fleetRes.ok) {
        const fleetData = await fleetRes.json();
        this.activeEscortsCount = fleetData.activeWingmen?.length || 0;
      }
    } catch (err) {
      console.warn('[Starmap] Failed to fetch player telemetry:', err);
    }
  }

  public async fetchGalaxyData(): Promise<void> {
    try {
      const [sysRes, sphRes] = await Promise.all([
        fetch('/api/starmap/systems'),
        fetch('/api/starmap/spheres'),
      ]);

      if (sysRes.ok) {
        const sysData = await sysRes.json();
        this.systems = sysData.systems || [];
        // Update player coordinates matching current sector
        const currentSys = this.systems.find((s) => s.id === this.playerSectorId);
        if (currentSys) {
          this.playerCoords = [currentSys.coordinatesX, currentSys.coordinatesY];
        }
      }

      if (sphRes.ok) {
        const sphData = await sphRes.json();
        this.spheres = sphData.spheres || [];
      }
    } catch (err) {
      console.error('[Starmap] Failed to load galactic starmap data:', err);
    }
  }

  public async lockCourse(targetSectorId: number): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('/api/starmap/course/plot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, targetSectorId, lockCourse: true }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.ctx.showNotification?.(data.error || 'Failed to lock course.', true);
        return;
      }

      this.activeCourse = data;
      this.ctx.playNavPlotTone?.();
      this.ctx.showNotification?.(
        `Navigation Locked: ${data.targetName} (${data.distanceLY} LY, ${data.totalFuelCost} Fuel)`
      );
      this.updateSelectedCard();
    } catch (err: any) {
      this.ctx.showNotification?.(`Navigation error: ${err.message}`, true);
    }
  }

  public async clearCourse(): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      await fetch('/api/starmap/course/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      this.activeCourse = null;
      this.ctx.playUiBlip?.();
      this.ctx.showNotification?.('Navigation vector cleared.');
      this.updateSelectedCard();
    } catch (err: any) {
      this.ctx.showNotification?.(`Failed to clear course: ${err.message}`, true);
    }
  }

  // --- Input Handlers ---
  private onMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.camStartX = this.cameraX;
      this.camStartY = this.cameraY;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.mouseScreenX = e.clientX - rect.left;
    this.mouseScreenY = e.clientY - rect.top;

    if (this.isDragging) {
      const dx = (e.clientX - this.dragStartX) / this.zoom;
      const dy = (e.clientY - this.dragStartY) / this.zoom;
      this.cameraX = this.camStartX - dx;
      this.cameraY = this.camStartY - dy;
      // Clamp bounds 0 to 1000
      this.cameraX = Math.max(0, Math.min(1000, this.cameraX));
      this.cameraY = Math.max(0, Math.min(1000, this.cameraY));
    } else {
      // Check hover
      const worldPos = this.screenToWorld(this.mouseScreenX, this.mouseScreenY);
      this.hoveredSystem = this.findSystemAt(worldPos[0], worldPos[1], 15 / this.zoom);
    }
  }

  private onMouseUp(): void {
    this.isDragging = false;
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    this.zoom = Math.max(0.4, Math.min(3.5, this.zoom * zoomFactor));
  }

  private onClick(e: MouseEvent): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const worldPos = this.screenToWorld(sx, sy);
    const clicked = this.findSystemAt(worldPos[0], worldPos[1], 16 / this.zoom);

    if (clicked) {
      this.selectedSystem = clicked;
      this.ctx.playUiBlip?.();
      this.updateSelectedCard();
    }
  }

  private findSystemAt(worldX: number, worldY: number, tolerance: number): StarSystem | null {
    let closest: StarSystem | null = null;
    let minDist = tolerance;

    for (const sys of this.systems) {
      const dist = Math.hypot(sys.coordinatesX - worldX, sys.coordinatesY - worldY);
      if (dist < minDist) {
        minDist = dist;
        closest = sys;
      }
    }
    return closest;
  }

  public screenToWorld(sx: number, sy: number): [number, number] {
    if (!this.canvas) return [0, 0];
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const wx = (sx - cx) / this.zoom + this.cameraX;
    const wy = (sy - cy) / this.zoom + this.cameraY;
    return [wx, wy];
  }

  public worldToScreen(wx: number, wy: number): [number, number] {
    if (!this.canvas) return [0, 0];
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const sx = (wx - this.cameraX) * this.zoom + cx;
    const sy = (wy - this.cameraY) * this.zoom + cy;
    return [sx, sy];
  }

  private updateSelectedCard(): void {
    if (!this.selectedInfoCard) return;
    if (!this.selectedSystem) {
      this.selectedInfoCard.innerHTML = `<div class="starmap-empty-prompt">Select a star system to review telemetry & plot course</div>`;
      if (this.btnLockCourse) this.btnLockCourse.disabled = true;
      return;
    }

    const s = this.selectedSystem;
    const dist = Number(Math.hypot(s.coordinatesX - this.playerCoords[0], s.coordinatesY - this.playerCoords[1]).toFixed(1));
    const baseFuel = Math.max(1, Math.round(dist * 0.2));
    const totalFuel = Math.max(1, Math.round(baseFuel * (1 + 0.25 * this.activeEscortsCount)));
    const canAfford = this.playerFuel >= totalFuel;
    const isLocked = this.activeCourse && this.activeCourse.targetSectorId === s.id;

    this.selectedInfoCard.innerHTML = `
      <div class="starmap-card-header">
        <span class="starmap-card-name">${s.name}</span>
        <span class="starmap-card-spectral spectral-${s.spectralClass.toLowerCase()}">${s.spectralClass}</span>
      </div>
      <div class="starmap-card-details">
        <div><strong>Coordinates:</strong> [${s.coordinatesX.toFixed(1)}, ${s.coordinatesY.toFixed(1)}]</div>
        <div><strong>Distance:</strong> ${dist} Light Years</div>
        <div><strong>Controlling Faction:</strong> ${s.controllingFaction.replace('FACTION_', '')}</div>
        <div><strong>Hazard Level:</strong> ${s.hazardLevel > 0 ? `Level ${s.hazardLevel}` : 'Nominal (Zero)'}</div>
        <div><strong>Fuel Cost:</strong> <span style="color:${canAfford ? '#38bdf8' : '#ef4444'}">${totalFuel} Fuel (${baseFuel} base + ${totalFuel - baseFuel} escorts)</span></div>
        <div><strong>Planets:</strong> ${s.planetCount} | <strong>Port:</strong> ${s.hasPort ? 'YES' : 'NONE'} | <strong>Colony:</strong> ${s.hasColony ? 'ACTIVE' : 'NONE'}</div>
        <div class="starmap-card-desc">${s.description}</div>
      </div>
    `;

    if (this.btnLockCourse) {
      this.btnLockCourse.disabled = !canAfford || Boolean(isLocked);
      this.btnLockCourse.innerText = isLocked ? 'WAYPOINT LOCKED' : canAfford ? 'LOCK AUTOPILOT COURSE' : 'INSUFFICIENT FUEL';
    }
  }

  // --- Render Loop ---
  private startRenderLoop(): void {
    const render = () => {
      if (!this.isOpen) return;
      this.draw();
      this.animFrameId = requestAnimationFrame(render);
    };
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(render);
  }

  public draw(): void {
    if (!this.canvas || !this.canvasCtx) return;
    const ctx = this.canvasCtx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Clear & Dark CRT background
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, w, h);

    // 2. Draw Faction Spheres of Influence
    for (const sphere of this.spheres) {
      const [sx, sy] = this.worldToScreen(sphere.centerX, sphere.centerY);
      const sRadius = sphere.radius * this.zoom;

      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy, sRadius, 0, Math.PI * 2);
      ctx.fillStyle = sphere.color + '15'; // Soft translucent fill
      ctx.fill();

      ctx.strokeStyle = sphere.color + '55';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();

      // Sphere label
      ctx.fillStyle = sphere.color + 'aa';
      ctx.font = `${Math.max(10, 12 * this.zoom)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(sphere.name.toUpperCase(), sx, sy - sRadius - 6);
      ctx.restore();
    }

    // 3. Coordinate Grid Lines (every 100 LY)
    ctx.save();
    ctx.strokeStyle = '#0f293a';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    for (let gx = 0; gx <= 1000; gx += 100) {
      const [sx] = this.worldToScreen(gx, 0);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();

      // Coordinate marker label
      ctx.fillStyle = '#1e4b6e';
      ctx.font = '10px monospace';
      ctx.fillText(`${gx}`, sx + 4, 15);
    }

    for (let gy = 0; gy <= 1000; gy += 100) {
      const [, sy] = this.worldToScreen(0, gy);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();

      ctx.fillStyle = '#1e4b6e';
      ctx.font = '10px monospace';
      ctx.fillText(`${gy}`, 6, sy - 4);
    }
    ctx.restore();

    // 4. Dynamic Fuel Perimeter Circle around Player
    const maxFuelDistance = (this.playerFuel / (0.2 * (1 + 0.25 * this.activeEscortsCount)));
    const [psx, psy] = this.worldToScreen(this.playerCoords[0], this.playerCoords[1]);
    const pRadius = maxFuelDistance * this.zoom;

    ctx.save();
    ctx.beginPath();
    ctx.arc(psx, psy, pRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#0284c788';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.stroke();

    ctx.fillStyle = '#38bdf888';
    ctx.font = '11px monospace';
    ctx.fillText(`MAX RANGE (${Math.round(maxFuelDistance)} LY)`, psx + pRadius + 8, psy + 4);
    ctx.restore();

    // 5. Active Autopilot Course Vector Line
    if (this.activeCourse) {
      const [tx, ty] = this.worldToScreen(this.activeCourse.targetCoords[0], this.activeCourse.targetCoords[1]);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(psx, psy);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 5]);
      ctx.stroke();

      // Draw directional vector arrow head
      const angle = Math.atan2(ty - psy, tx - psx);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - 12 * Math.cos(angle - Math.PI / 6), ty - 12 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(tx - 12 * Math.cos(angle + Math.PI / 6), ty - 12 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = '#22c55e';
      ctx.fill();
      ctx.restore();
    }

    // 6. Draw Star Systems
    for (const sys of this.systems) {
      // Filter check
      if (this.searchTerm && !sys.name.toLowerCase().includes(this.searchTerm.toLowerCase())) {
        continue;
      }
      if (this.factionFilter !== 'ALL' && sys.controllingFaction !== this.factionFilter) {
        continue;
      }

      const [sx, sy] = this.worldToScreen(sys.coordinatesX, sys.coordinatesY);
      // Skip if offscreen
      if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) continue;

      const starColor = this.getSpectralColor(sys.spectralClass);
      const isSelected = this.selectedSystem?.id === sys.id;
      const isPlayerHere = this.playerSectorId === sys.id;
      const radius = Math.max(3, sys.starRadius * 4 * this.zoom);

      // Star Glow
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius * 3);
      glow.addColorStop(0, starColor + 'ff');
      glow.addColorStop(0.4, starColor + '66');
      glow.addColorStop(1, starColor + '00');

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, radius * 3, 0, Math.PI * 2);
      ctx.fill();

      // Star Solid Core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, radius * 0.7, 0, Math.PI * 2);
      ctx.fill();

      // Selection reticle
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, radius * 2.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Player Location Marker
      if (isPlayerHere) {
        ctx.save();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(sx, sy, radius * 3.8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('[YOU ARE HERE]', sx + radius * 3.8 + 4, sy + 3);
        ctx.restore();
      }

      // Star Name Label
      if (this.zoom >= 0.75 || isSelected || isPlayerHere) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(sys.name, sx, sy + radius * 2.2 + 10);
      }
    }

    // 7. Hover Tooltip
    if (this.hoveredSystem) {
      this.drawTooltip(ctx, this.hoveredSystem, this.mouseScreenX, this.mouseScreenY);
    }
  }

  private drawTooltip(ctx: CanvasRenderingContext2D, s: StarSystem, mx: number, my: number): void {
    const dist = Number(Math.hypot(s.coordinatesX - this.playerCoords[0], s.coordinatesY - this.playerCoords[1]).toFixed(1));
    const lines = [
      `${s.name} [${s.spectralClass}]`,
      `Coords: [${s.coordinatesX.toFixed(1)}, ${s.coordinatesY.toFixed(1)}]`,
      `Distance: ${dist} LY`,
      `Faction: ${s.controllingFaction.replace('FACTION_', '')}`,
      `Planets: ${s.planetCount} ${s.hasPort ? '• Port' : ''} ${s.hasColony ? '• Colony' : ''}`,
    ];

    ctx.save();
    ctx.font = '11px monospace';
    const padding = 10;
    const lineHeight = 16;
    const boxW = 220;
    const boxH = lines.length * lineHeight + padding * 2;

    let bx = mx + 16;
    let by = my + 16;
    if (bx + boxW > (this.canvas?.width || 800)) bx = mx - boxW - 16;
    if (by + boxH > (this.canvas?.height || 600)) by = my - boxH - 16;

    // CRT dark green panel
    ctx.fillStyle = '#06131cfa';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    lines.forEach((line, idx) => {
      if (idx === 0) ctx.fillStyle = '#f8fafc';
      else ctx.fillStyle = '#94a3b8';
      ctx.fillText(line, bx + padding, by + padding + (idx + 1) * lineHeight - 3);
    });
    ctx.restore();
  }

  private getSpectralColor(spectral: string): string {
    switch (spectral) {
      case 'BLUE_O':
        return '#38bdf8';
      case 'WHITE_A':
        return '#f8fafc';
      case 'YELLOW_G':
        return '#fbbf24';
      case 'ORANGE_K':
        return '#fb923c';
      case 'RED_M':
        return '#f87171';
      case 'NEUTRON':
        return '#c084fc';
      default:
        return '#e2e8f0';
    }
  }
}
