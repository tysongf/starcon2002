import { OutpostColonyController } from './OutpostColonyController.ts';
import { apiClient } from '../network/ApiClient';

/**
 * ColonyController.ts
 *
 * Encapsulates planetary colony outposts, Sierra Outpost isometric grid orchestration,
 * resource extraction/harvesting, Precursor Proto-Tech laboratory catalog synthesis,
 * and relic diplomatic remittance.
 */

export interface ColonyControllerCallbacks {
  audio: {
    playUiBlip: () => void;
    playSiloAlertChime: () => void;
    playColonyFoundingFanfare: () => void;
    playFacilityUpgradeSound: () => void;
    playCargoHarvestSound: () => void;
    playPrecursorDecipherFanfare: () => void;
  };
  showApNotification: (message: string, isWarning?: boolean) => void;
  fetchPlayerAP: () => Promise<void> | void;
  refreshPlayerHold: () => Promise<void> | void;
  refreshFactionStandings: () => Promise<void> | void;
  getActivePlanet: () => { data: { id: string; name: string } } | null;
  getActivePlanetDetail: () => { beacons?: any[] } | null;
  getPlayerAP: () => { currentAP: number; maxAP: number };
}

export class ColonyController {
  private callbacks: ColonyControllerCallbacks;

  public activeSurveyTab: 'SENSORS' | 'COLONY' | 'PRECURSOR' = 'SENSORS';
  public activeColoniesList: any[] = [];
  public activeColony: any | null = null;
  public planetPrecursorSites: any[] = [];
  public unresolvedPrecursorSignals: number = 0;
  public precursorRequiredSurvey: number = 33;
  public playerRelicCount: number = 0;
  public precursorResearchCatalog: any[] = [];
  public outpostController: OutpostColonyController;

  constructor(callbacks: ColonyControllerCallbacks) {
    this.callbacks = callbacks;
    this.outpostController = new OutpostColonyController({
      audio: callbacks.audio,
      showApNotification: callbacks.showApNotification,
      fetchPlayerAP: callbacks.fetchPlayerAP,
      refreshPlayerHold: callbacks.refreshPlayerHold,
      onColonyUpdated: (colony) => {
        if (colony) {
          this.activeColony = colony;
          this.refreshColonyDashboardUI();
        }
      },
    });
    this.bindEvents();
  }

  /**
   * Attach DOM listeners for colony action buttons.
   */
  private bindEvents(): void {
    const tabSensors = document.getElementById('tab-survey-sensors');
    const tabColony = document.getElementById('tab-survey-colony');
    const tabPrecursor = document.getElementById('tab-survey-precursor');

    tabSensors?.addEventListener('click', () => this.switchSurveyTab('SENSORS'));
    tabColony?.addEventListener('click', () => this.switchSurveyTab('COLONY'));
    tabPrecursor?.addEventListener('click', () => this.switchSurveyTab('PRECURSOR'));

    const btnFound = document.getElementById('btn-found-colony');
    btnFound?.addEventListener('click', () => this.foundColony());

    const btnOpenOutpost = document.getElementById('btn-open-outpost-modal');
    btnOpenOutpost?.addEventListener('click', () => {
      if (this.activeColony?.id) {
        void this.outpostController.open(this.activeColony.id);
      }
    });

    const btnHarvest = document.getElementById('btn-harvest-cargo') || document.getElementById('btn-harvest-colony');
    btnHarvest?.addEventListener('click', () => this.harvestColonyCargo());

    const btnRemit = document.getElementById('btn-remit-relic');
    btnRemit?.addEventListener('click', () => this.remitPrecursorRelic());
  }

  /**
   * Toggles between Astrometry Sensor sweep array, Colony Command console, and Precursor Proto-Tech Lab.
   */
  public switchSurveyTab(tab: 'SENSORS' | 'COLONY' | 'PRECURSOR'): void {
    this.activeSurveyTab = tab;
    this.callbacks.audio.playUiBlip();

    const btnSensors = document.getElementById('tab-survey-sensors');
    const btnColony = document.getElementById('tab-survey-colony');
    const btnPrecursor = document.getElementById('tab-survey-precursor');
    const panelSensors = document.getElementById('panel-survey-sensors');
    const panelColony = document.getElementById('panel-survey-colony');
    const panelPrecursor = document.getElementById('panel-survey-precursor');

    btnSensors?.classList.toggle('active', tab === 'SENSORS');
    btnColony?.classList.toggle('active', tab === 'COLONY');
    btnPrecursor?.classList.toggle('active', tab === 'PRECURSOR');

    panelSensors?.classList.toggle('hidden', tab !== 'SENSORS');
    panelColony?.classList.toggle('hidden', tab !== 'COLONY');
    panelPrecursor?.classList.toggle('hidden', tab !== 'PRECURSOR');

    if (tab === 'COLONY') {
      if (this.activeColony) {
        this.refreshColonyDashboardUI();
      } else {
        this.populateColonyBeaconSelect();
      }
    } else if (tab === 'PRECURSOR') {
      this.fetchPrecursorResearch();
    }
  }

  /**
   * Fetches all colonies established on the target planet.
   */
  public async fetchPlanetColonies(planetId: string): Promise<void> {
    try {
      const res = await fetch(`/api/colonies/planet/${planetId}?accountId=${encodeURIComponent(apiClient.getAccountId())}`);
      if (res.ok) {
        const data = await res.json();
        this.activeColoniesList = data.colonies || [];
        this.activeColony = this.activeColoniesList.length > 0 ? this.activeColoniesList[0] : null;

        const pill = document.getElementById('survey-colony-pill');
        if (pill) {
          pill.textContent = `${this.activeColoniesList.length} ACTIVE`;
        }

        const cardUnfounded = document.getElementById('colony-unfounded-card');
        const cardActive = document.getElementById('colony-active-dashboard');

        if (this.activeColony) {
          cardUnfounded?.classList.add('hidden');
          cardActive?.classList.remove('hidden');
          this.refreshColonyDashboardUI();

          // Audio notification if silo reached maximum capacity
          if (this.activeColony.stockpiled_amount >= this.activeColony.silo_capacity) {
            this.callbacks.audio.playSiloAlertChime();
          }
        } else {
          cardUnfounded?.classList.remove('hidden');
          cardActive?.classList.add('hidden');
          this.populateColonyBeaconSelect();
        }
      }
    } catch (err) {
      console.warn('[ColonyController] Failed to fetch planet colonies:', err);
    }
  }

  /**
   * Populates target beacon options for establishing a new colony outpost.
   */
  public populateColonyBeaconSelect(): void {
    const sel = document.getElementById('select-colony-beacon') as HTMLSelectElement | null;
    if (!sel) return;

    const planetDetail = this.callbacks.getActivePlanetDetail();
    const beacons = planetDetail?.beacons || [];
    if (beacons.length === 0) {
      sel.innerHTML = '<option value="">-- No Beacons Available (Deploy Surface Probe First) --</option>';
      return;
    }

    sel.innerHTML = '<option value="">-- Choose Target Planted Recon Beacon --</option>' +
      beacons.map((b: any) => `
        <option value="${b.id}">Beacon at Lat ${b.surfaceLat.toFixed(1)}°, Lng ${b.surfaceLng.toFixed(1)}° (${b.yieldSummary})</option>
      `).join('');
  }

  /**
   * Updates Colony Command UI metrics, silo meter, and Sierra Outpost grid summary.
   */
  public refreshColonyDashboardUI(): void {
    if (!this.activeColony) return;
    const col = this.activeColony;

    const surfaceLat = Number(col.surfaceLat ?? col.surface_lat ?? 0);
    const surfaceLng = Number(col.surfaceLng ?? col.surface_lng ?? 0);
    const population = Number(col.population ?? 0);
    const maxPopulation = Number(col.maxPopulation ?? col.max_population ?? 500);
    const prodPerMin =
      col.productionRatePerMinute !== undefined
        ? Number(col.productionRatePerMinute)
        : Number(col.production_rate ?? 0) * 60;
    const terraformerTier = Number(col.terraformerTier ?? col.terraformer_tier ?? 1);
    const habitability = Number(col.habitabilityRating ?? col.habitability_rating ?? 50);
    const stockpiled = Number(col.stockpiledAmount ?? col.stockpiled_amount ?? 0);
    const siloCap = Math.max(1, Number(col.siloCapacity ?? col.silo_capacity ?? 50));
    const commodityId = String(col.commodityId ?? col.commodity_id ?? 'COMM_RAW_ORE');

    const elName = document.getElementById('colony-outpost-name');
    const elCoords = document.getElementById('colony-outpost-coords');
    const elPop = document.getElementById('colony-stat-pop');
    const elRate = document.getElementById('colony-stat-rate');
    const elTerraform = document.getElementById('colony-stat-terraform');
    const elSiloText = document.getElementById('colony-silo-text');
    const elSiloFill = document.getElementById('colony-silo-fill');

    if (elName) elName.textContent = String(col.name || 'COLONY').toUpperCase();
    if (elCoords) {
      elCoords.textContent = `LAT: ${surfaceLat >= 0 ? '+' : ''}${surfaceLat.toFixed(1)}° // LNG: ${surfaceLng >= 0 ? '+' : ''}${surfaceLng.toFixed(1)}°`;
    }
    if (elPop) elPop.textContent = `${population} / ${maxPopulation}`;
    if (elRate) elRate.textContent = `${prodPerMin.toFixed(1)} u/min`;
    if (elTerraform) elTerraform.textContent = `+${(terraformerTier * 0.5).toFixed(1)}% / hr (Hab: ${habitability}%)`;

    const siloPct = Math.min(100, Math.round((stockpiled / siloCap) * 100));
    if (elSiloText) {
      elSiloText.textContent = `${stockpiled} / ${siloCap} Units Stockpiled (${commodityId.replace('COMM_', '')})`;
    }
    if (elSiloFill) {
      elSiloFill.style.width = `${siloPct}%`;
      if (siloPct >= 100) {
        elSiloFill.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
      } else {
        elSiloFill.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
      }
    }

    // Update Milestone 1.7 Outpost Isometric Grid telemetry summary
    const pGen = Number(col.powerGeneratedMW ?? col.power_generated_mw ?? 30);
    const pCon = Number(col.powerConsumedMW ?? col.power_consumed_mw ?? 15);
    const o2Gen = Number(col.o2Generated ?? col.o2_generated ?? 30);
    const o2Con = Number(col.o2Consumed ?? col.o2_consumed ?? 15);
    const morale = Number(col.morale ?? 80);
    const effPct = Math.round(Number(col.gridEfficiency ?? col.grid_efficiency ?? 1) * 100);

    const elEff = document.getElementById('colony-outpost-grid-eff');
    if (elEff) {
      elEff.textContent = `EFFICIENCY: ${effPct}%`;
      elEff.classList.toggle('danger', effPct < 90 || morale < 50);
    }

    const elSummary = document.getElementById('colony-outpost-grid-summary');
    if (elSummary) {
      elSummary.innerHTML = `
        <span>⚡ ${pGen} / ${pCon} MW</span>
        <span>🫁 O2 ${o2Gen} / ${o2Con}</span>
        <span>💚 MORALE ${morale}%</span>
      `;
    }

    void this.loadColonyWorkforceUI(col);
  }

  /**
   * Establishes a permanent colony outpost at the selected sensor beacon.
   */
  public async foundColony(): Promise<void> {
    const activePlanet = this.callbacks.getActivePlanet();
    if (!activePlanet) return;
    const selBeacon = document.getElementById('select-colony-beacon') as HTMLSelectElement | null;
    const inputName = document.getElementById('input-colony-name') as HTMLInputElement | null;

    const beaconId = selBeacon ? selBeacon.value : '';
    const name = inputName && inputName.value.trim() ? inputName.value.trim() : `${activePlanet.data.name} Outpost`;

    if (!beaconId) {
      this.callbacks.showApNotification('⚠️ Please select a planted surface beacon location first.', true);
      return;
    }

    const ap = this.callbacks.getPlayerAP();
    if (ap.currentAP < 5) {
      this.callbacks.showApNotification('⚠️ INSUFFICIENT ACTION POINTS: Founding an outpost requires 5 AP.', true);
      return;
    }

    const btn = document.getElementById('btn-found-colony') as HTMLButtonElement | null;
    if (btn) btn.disabled = true;

    try {
      const res = await fetch('/api/colonies/found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: apiClient.getAccountId(),
          planetId: activePlanet.data.id,
          beaconId,
          name,
        }),
      });

      const data = await res.json();
      if (btn) btn.disabled = false;

      if (!res.ok || !data.success) {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Colony founding failed'}`, true);
        return;
      }

      this.callbacks.audio.playColonyFoundingFanfare();
      this.callbacks.showApNotification(`🏛️ Outpost "${name}" successfully established!`, false);

      this.callbacks.fetchPlayerAP();
      this.callbacks.refreshPlayerHold();
      await this.fetchPlanetColonies(activePlanet.data.id);
    } catch (err) {
      if (btn) btn.disabled = false;
      console.error('[ColonyController] Failed to found colony:', err);
    }
  }

  /**
   * Upgrades a colony facility module to its next tier.
   */
  public async upgradeColonyFacility(facilityType: 'DERRICK' | 'HABITATION' | 'TERRAFORMER' | 'SILO'): Promise<void> {
    if (!this.activeColony) return;

    try {
      const res = await fetch(`/api/colonies/${this.activeColony.id}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: apiClient.getAccountId(),
          facilityType,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Facility upgrade failed'}`, true);
        return;
      }

      this.callbacks.audio.playFacilityUpgradeSound();
      this.callbacks.showApNotification(`⚙️ ${data.message}`, false);

      this.activeColony = data.colony;
      this.callbacks.fetchPlayerAP();
      this.callbacks.refreshPlayerHold();
      this.refreshColonyDashboardUI();
    } catch (err) {
      console.error('[ColonyController] Failed to upgrade colony facility:', err);
    }
  }

  /**
   * Transfers all stockpiled commodities from the colony silo directly into ship cargo.
   */
  public async harvestColonyCargo(): Promise<void> {
    if (!this.activeColony) return;

    if (this.activeColony.stockpiled_amount <= 0) {
      this.callbacks.showApNotification('⚠️ Logistics Silo is empty. Wait for automated extraction cycles.', true);
      return;
    }

    try {
      const res = await fetch(`/api/colonies/${this.activeColony.id}/harvest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: apiClient.getAccountId(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Harvest failed'}`, true);
        return;
      }

      this.callbacks.audio.playCargoHarvestSound();
      this.callbacks.showApNotification(`📦 Transferred ${data.transferred} units into ship hold!`, false);

      this.activeColony = data.colony;
      this.callbacks.refreshPlayerHold();
      this.refreshColonyDashboardUI();
    } catch (err) {
      console.error('[ColonyController] Failed to harvest colony cargo:', err);
    }
  }

  /**
   * Fetches Precursor Megastructure sites on the active planet and updates UI pills.
   */
  public async fetchPlanetPrecursorSites(planetId: string): Promise<void> {
    try {
      const res = await fetch(`/api/precursor/planet/${planetId}?accountId=${encodeURIComponent(apiClient.getAccountId())}`);
      if (res.ok) {
        const data = await res.json();
        this.planetPrecursorSites = data.sites || [];
        this.unresolvedPrecursorSignals = data.unresolvedSignals || 0;
        this.precursorRequiredSurvey = data.requiredSurvey || 33;
        this.playerRelicCount = data.relics || 0;

        const relicPill = document.getElementById('survey-relics-pill');
        if (relicPill) {
          relicPill.textContent =
            this.planetPrecursorSites.length > 0
              ? `${this.playerRelicCount} RELICS`
              : this.unresolvedPrecursorSignals > 0
              ? `${this.unresolvedPrecursorSignals} UNRESOLVED`
              : `${this.playerRelicCount} RELICS`;
        }

        const relicCount = document.getElementById('precursor-relic-count');
        if (relicCount) {
          relicCount.textContent = `${this.playerRelicCount}x IN CARGO`;
        }
      }
    } catch (err) {
      console.warn('[ColonyController] Failed to fetch planet precursor sites:', err);
    }
  }

  /**
   * Retrieves the prototype technology research catalog and updates the Precursor Lab grid.
   */
  public async fetchPrecursorResearch(): Promise<void> {
    try {
      const res = await fetch(`/api/precursor/research?accountId=${encodeURIComponent(apiClient.getAccountId())}`);
      if (!res.ok) return;
      const data = await res.json();
      this.precursorResearchCatalog = data.catalog || [];
      this.playerRelicCount = data.relics ?? this.playerRelicCount;

      const relicCountEl = document.getElementById('precursor-relic-count');
      const creditsCountEl = document.getElementById('precursor-credits-count');
      const apCountEl = document.getElementById('precursor-ap-count');
      const relicPill = document.getElementById('survey-relics-pill');

      if (relicCountEl) relicCountEl.textContent = `${this.playerRelicCount}x IN CARGO`;
      if (creditsCountEl && data.credits !== undefined) creditsCountEl.textContent = `${Number(data.credits).toLocaleString()} Cr`;
      const ap = this.callbacks.getPlayerAP();
      if (apCountEl) apCountEl.textContent = `${data.ap?.currentAP ?? ap.currentAP} / ${ap.maxAP}`;
      if (relicPill) relicPill.textContent = `${this.playerRelicCount} RELICS`;

      this.renderPrecursorTechGrid();
    } catch (err) {
      console.warn('[ColonyController] Failed to fetch precursor research:', err);
    }
  }

  /**
   * Renders the 4 legendary prototype ship systems in the Proto-Tech Laboratory.
   */
  public renderPrecursorTechGrid(): void {
    const grid = document.getElementById('precursor-tech-grid');
    if (!grid) return;

    if (this.precursorResearchCatalog.length === 0) {
      grid.innerHTML = '<div class="precursor-empty-state">No precursor prototypes loaded.</div>';
      return;
    }

    grid.innerHTML = this.precursorResearchCatalog.map((tech) => {
      const statBadges = Object.entries(tech.stats || {})
        .map(([k, v]) => `<span class="stat-pill">${k.toUpperCase()}: <strong>${v}</strong></span>`)
        .join('');

      const actionBtn = tech.isSynthesized
        ? `<button class="colony-action-btn synthesized-badge" disabled>✔ SYNTHESIZED // READY IN SHIP HOLD</button>`
        : `<button class="colony-action-btn primary btn-synth-tech" data-tech-id="${tech.id}">
             SYNTHESIZE PROTOTYPE [${tech.relicCost}x RELIC + ${tech.apCost} AP] ⚡
           </button>`;

      return `
        <div class="precursor-tech-card ${tech.isSynthesized ? 'synthesized' : ''}">
          <div class="tech-card-header">
            <div class="tech-title-block">
              <span class="slot-badge slot-${tech.slotType.toLowerCase()}">${tech.slotType} SLOT // ${tech.mainCategory || 'OFFENSE'} (${tech.subtype || 'Module'})</span>
              <h3 class="tech-title">${tech.name}</h3>
            </div>
            <div class="tech-cost-badge">
              <span>💎 ${tech.relicCost}x RELIC</span>
              <span>💰 ${tech.creditCost} CR</span>
            </div>
          </div>
          <p class="tech-desc">${tech.description}</p>
          <div class="tech-stats-row">
            ${statBadges}
          </div>
          <div class="tech-action-row">
            ${actionBtn}
          </div>
        </div>
      `;
    }).join('');

    // Attach synthesis button listeners
    grid.querySelectorAll('.btn-synth-tech').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const techId = (e.currentTarget as HTMLElement).getAttribute('data-tech-id');
        if (techId) {
          this.synthesizePrototypeTech(techId);
        }
      });
    });
  }

  /**
   * Synthesizes a legendary prototype ship system using an unrefined Precursor Relic Core.
   */
  public async synthesizePrototypeTech(techId: string): Promise<void> {
    try {
      const res = await fetch('/api/precursor/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: apiClient.getAccountId(), techId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Prototype synthesis failed'}`, true);
        return;
      }

      this.callbacks.audio.playPrecursorDecipherFanfare();
      this.callbacks.showApNotification(`⚡ Synthesized ${data.tech?.name}! Fitted module added to cargo hold!`, false);

      await this.fetchPrecursorResearch();
      this.callbacks.refreshPlayerHold();
    } catch (err) {
      console.error('[ColonyController] Failed to synthesize prototype tech:', err);
    }
  }

  /**
   * Remits a Precursor Relic Core to an alien ambassador for +600 Credits and +50 Goodwill.
   */
  public async remitPrecursorRelic(): Promise<void> {
    const sel = document.getElementById('select-remit-faction') as HTMLSelectElement | null;
    const factionId = sel ? sel.value : 'FACTION_SOL';

    try {
      const res = await fetch('/api/precursor/remit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: apiClient.getAccountId(), factionId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Relic remittance failed'}`, true);
        return;
      }

      this.callbacks.audio.playCargoHarvestSound();
      this.callbacks.showApNotification(`💎 Remitted Precursor Relic to ${factionId.replace('FACTION_', '')}! +${data.creditsReward} Credits, +${data.goodwillReward} Goodwill!`, false);

      await this.fetchPrecursorResearch();
      this.callbacks.refreshFactionStandings();
    } catch (err) {
      console.error('[ColonyController] Failed to remit precursor relic:', err);
    }
  }

  private colonyModulesCatalog: any[] = [];

  /**
   * Renders Milestone 1.5 Colony Workforce, Colony Concourse Hiring & 8 Specialty Modules.
   */
  public async loadColonyWorkforceUI(col: any): Promise<void> {
    const root = document.getElementById('colony-workforce-root');
    if (!root || !col) return;

    try {
      const [rosterRes, marketRes, modCatRes] = await Promise.all([
        fetch(`/api/crew/roster?accountId=${encodeURIComponent(apiClient.getAccountId())}`),
        fetch(`/api/crew/market?accountId=${encodeURIComponent(apiClient.getAccountId())}&sourceType=COLONY&sourceId=${encodeURIComponent(col.id)}`),
        this.colonyModulesCatalog.length > 0 ? Promise.resolve(null) : fetch('/api/colonies/modules/catalog'),
      ]);

      const roster = rosterRes.ok ? await rosterRes.json() : { crew: [] };
      const market = marketRes.ok ? await marketRes.json() : { candidates: [] };
      if (modCatRes && modCatRes.ok) {
        const mc = await modCatRes.json();
        this.colonyModulesCatalog = mc.modules || [];
      }

      const crewList: any[] = roster.crew || [];
      const stationedHere = crewList.filter((c) => c.assignmentType === 'COLONY' && c.assignedColonyId === col.id);
      const assignablePool = crewList.filter((c) => c.assignmentType !== 'COLONY' || c.assignedColonyId !== col.id);
      const candidates: any[] = market.candidates || [];
      const moduleTiers: Record<string, number> = col.colony_modules || col.colonyModules || {};
      const wageSubsidy = Number(col.local_wage_subsidy ?? col.localWageSubsidy ?? 0);

      root.innerHTML = `
        <div class="colony-workforce-section">
          <div class="col-header">
            <h4>👷 COLONY SPECIALIST WORKFORCE (${stationedHere.length} STATIONED)</h4>
            <span class="col-subtext">LOCAL WAGE SUBSIDY: +${wageSubsidy} Cr/cycle • CORE UPGRADES REQUIRE MATCHING SPECIALISTS</span>
          </div>
          <div class="colony-crew-strip">
            ${
              stationedHere.length === 0
                ? '<div class="slot-empty-notice">No Specialists stationed here yet. Station Reserve crew or recruit settlers below to unlock Tier 2/3 & Specialty Modules.</div>'
                : stationedHere
                    .map(
                      (c) => `
                        <div class="colony-crew-chip rarity-${c.rarity.toLowerCase()}">
                          <strong>${c.name}</strong> (${c.specialties.join(' / ')})
                          <button class="fit-btn-small btn-col-unassign" data-crew-id="${c.id}">RECALL TO SHIP</button>
                        </div>
                      `
                    )
                    .join('')
            }
          </div>
          ${
            assignablePool.length > 0
              ? `<div class="colony-assign-bar">
                  <select id="select-col-station-crew" class="colony-select">
                    ${assignablePool.map((c) => `<option value="${c.id}">${c.name} [${c.rarity}] — ${c.specialties.join(', ')}</option>`).join('')}
                  </select>
                  <button id="btn-col-station-crew" class="colony-action-btn success">STATION SPECIALIST AT COLONY</button>
                </div>`
              : ''
          }
          <div class="colony-market-mini">
            <div class="section-title" style="margin-top:0.65rem;">🏢 SETTLEMENT HALL APPLICANTS (RECRUIT AT COLONY)</div>
            <div class="colony-candidates-row">
              ${
                candidates.length === 0
                  ? '<span class="slot-empty-notice">No local applicants currently posted.</span>'
                  : candidates
                      .map(
                        (cand) => `
                          <div class="colony-cand-card rarity-${cand.rarity.toLowerCase()}">
                            <div><strong>${cand.name}</strong> <span class="rarity-pill rarity-${cand.rarity.toLowerCase()}">${cand.rarity}</span></div>
                            <div class="col-subtext">${cand.specialties.join(' / ')} • Apt ${cand.aptitude}</div>
                            <button class="fit-btn-small btn-col-hire" data-listing-id="${cand.listingId}">HIRE (${cand.hiringFee} Cr)</button>
                          </div>
                        `
                      )
                      .join('')
              }
            </div>
          </div>

          <div class="section-title" style="margin-top:0.85rem;">🏗️ SPECIALTY COLONY MODULES (8 SPECIALIZATION TRACKS)</div>
          <div class="colony-modules-grid">
            ${this.colonyModulesCatalog
              .map((mod) => {
                const curTier = Number(moduleTiers[mod.key] || 0);
                const nextTier = curTier + 1;
                const reqCount = nextTier;
                const matching = stationedHere.filter((c) =>
                  c.specialties.some((sp: string) => mod.acceptedSpecialties.includes(sp))
                ).length;
                const reqMet = matching >= reqCount;
                return `
                  <div class="facility-card colony-module-card ${curTier > 0 ? 'built' : ''}">
                    <div class="facility-header">
                      <div class="facility-name-group">
                        <span class="facility-icon">${mod.icon}</span>
                        <span class="facility-title">${mod.name.toUpperCase()}</span>
                      </div>
                      <span class="facility-tier-badge ${curTier >= mod.maxTier ? 'max' : ''}">TIER ${curTier}/${mod.maxTier}</span>
                    </div>
                    <p class="facility-desc">${mod.benefitSummary}</p>
                    <div class="colony-req-line ${reqMet ? 'met' : 'unmet'}">
                      Requires ${curTier >= mod.maxTier ? 'MAXED' : `${reqCount}x (${mod.acceptedSpecialties.join(' / ')}) — Stationed: ${matching}/${reqCount}`}
                    </div>
                    <button class="facility-upgrade-btn btn-col-mod-upgrade" data-mod-key="${mod.key}" ${curTier >= mod.maxTier ? 'disabled' : ''}>
                      ${curTier >= mod.maxTier ? 'MAX TIER REACHED' : `${curTier === 0 ? 'CONSTRUCT' : 'UPGRADE'} TIER ${nextTier}`}
                    </button>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `;

      root.querySelector('#btn-col-station-crew')?.addEventListener('click', async () => {
        const sel = root.querySelector('#select-col-station-crew') as HTMLSelectElement | null;
        if (!sel?.value) return;
        const res = await fetch('/api/crew/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: apiClient.getAccountId(),
            crewId: sel.value,
            assignmentType: 'COLONY',
            colonyId: col.id,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          this.callbacks.showApNotification(`⚠️ ${data.error || 'Stationing failed'}`, true);
          return;
        }
        this.callbacks.audio.playUiBlip();
        this.callbacks.showApNotification('✅ Specialist stationed at colony', false);
        await this.loadColonyWorkforceUI(col);
      });

      root.querySelectorAll('.btn-col-unassign').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const crewId = (btn as HTMLElement).dataset.crewId;
          if (!crewId) return;
          const res = await fetch('/api/crew/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId: apiClient.getAccountId(),
              crewId,
              assignmentType: 'RESERVE',
            }),
          });
          if (res.ok) {
            this.callbacks.audio.playUiBlip();
            await this.loadColonyWorkforceUI(col);
          }
        });
      });

      root.querySelectorAll('.btn-col-hire').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const listingId = (btn as HTMLElement).dataset.listingId;
          if (!listingId) return;
          const res = await fetch('/api/crew/hire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId: apiClient.getAccountId(),
              listingId,
              sourceType: 'COLONY',
              sourceId: col.id,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            this.callbacks.showApNotification(`⚠️ ${data.error || 'Recruit failed'}`, true);
            return;
          }
          this.callbacks.audio.playCargoHarvestSound();
          this.callbacks.showApNotification(`👷 Recruited ${data.crewMember.name} at colony!`, false);
          this.callbacks.refreshPlayerHold();
          await this.loadColonyWorkforceUI(col);
        });
      });

      root.querySelectorAll('.btn-col-mod-upgrade').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const moduleKey = (btn as HTMLElement).dataset.modKey;
          if (!moduleKey) return;
          const res = await fetch(`/api/colonies/${col.id}/modules/upgrade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: apiClient.getAccountId(), moduleKey }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            this.callbacks.showApNotification(`⚠️ ${data.error || 'Module upgrade failed'}`, true);
            return;
          }
          this.callbacks.audio.playFacilityUpgradeSound();
          this.callbacks.showApNotification(`🏗️ ${data.message}`, false);
          this.activeColony = data.colony;
          this.callbacks.fetchPlayerAP();
          this.callbacks.refreshPlayerHold();
          this.refreshColonyDashboardUI();
        });
      });
    } catch (err) {
      console.warn('[ColonyController] Failed to load workforce/modules UI:', err);
    }
  }
}
