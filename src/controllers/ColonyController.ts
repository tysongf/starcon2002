/**
 * ColonyController.ts
 *
 * Encapsulates planetary colony outposts, facility modules (Derrick, Habitation,
 * Terraformer, Silo), resource extraction/harvesting, Precursor Proto-Tech
 * laboratory catalog synthesis, and relic diplomatic remittance.
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

  constructor(callbacks: ColonyControllerCallbacks) {
    this.callbacks = callbacks;
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

    const btnDerrick = document.getElementById('btn-upgrade-derrick');
    btnDerrick?.addEventListener('click', () => this.upgradeColonyFacility('DERRICK'));

    const btnHab = document.getElementById('btn-upgrade-habitation');
    btnHab?.addEventListener('click', () => this.upgradeColonyFacility('HABITATION'));

    const btnTer = document.getElementById('btn-upgrade-terraformer');
    btnTer?.addEventListener('click', () => this.upgradeColonyFacility('TERRAFORMER'));

    const btnSilo = document.getElementById('btn-upgrade-silo');
    btnSilo?.addEventListener('click', () => this.upgradeColonyFacility('SILO'));

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
      const res = await fetch(`http://localhost:3000/api/colonies/planet/${planetId}?accountId=acc_sol_captain`);
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
   * Updates Colony Command UI metrics, silo meter, and facility cards.
   */
  public refreshColonyDashboardUI(): void {
    if (!this.activeColony) return;
    const col = this.activeColony;

    const elName = document.getElementById('colony-outpost-name');
    const elCoords = document.getElementById('colony-outpost-coords');
    const elPop = document.getElementById('colony-stat-pop');
    const elRate = document.getElementById('colony-stat-rate');
    const elTerraform = document.getElementById('colony-stat-terraform');
    const elSiloText = document.getElementById('colony-silo-text');
    const elSiloFill = document.getElementById('colony-silo-fill');

    if (elName) elName.textContent = col.name.toUpperCase();
    if (elCoords) elCoords.textContent = `LAT: ${col.surface_lat >= 0 ? '+' : ''}${col.surface_lat.toFixed(1)}° // LNG: ${col.surface_lng >= 0 ? '+' : ''}${col.surface_lng.toFixed(1)}°`;
    if (elPop) elPop.textContent = `${col.population} / ${col.max_population}`;
    if (elRate) elRate.textContent = `${(col.production_rate * 60).toFixed(1)} u/min`;
    if (elTerraform) elTerraform.textContent = `+${(col.terraformer_tier * 0.5).toFixed(1)}% / hr (Hab: ${col.habitability_rating}%)`;

    const siloPct = Math.min(100, Math.round((col.stockpiled_amount / col.silo_capacity) * 100));
    if (elSiloText) elSiloText.textContent = `${col.stockpiled_amount} / ${col.silo_capacity} Units Stockpiled (${col.commodity_id.replace('COMM_', '')})`;
    if (elSiloFill) {
      elSiloFill.style.width = `${siloPct}%`;
      if (siloPct >= 100) {
        elSiloFill.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
      } else {
        elSiloFill.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
      }
    }

    // Facility Cards: Derrick
    const bDerrick = document.getElementById('badge-derrick-tier');
    const dDerrick = document.getElementById('desc-derrick-tier');
    const btnDerrick = document.getElementById('btn-upgrade-derrick') as HTMLButtonElement | null;
    if (bDerrick) bDerrick.textContent = col.derrick_tier >= 3 ? 'TIER 3 (MAX)' : `TIER ${col.derrick_tier}`;
    if (bDerrick && col.derrick_tier >= 3) bDerrick.classList.add('max');
    if (dDerrick) {
      const mult = col.derrick_tier === 1 ? '1.0x' : col.derrick_tier === 2 ? '2.5x' : '5.0x';
      dDerrick.textContent = `Surface mineral drills operating at ${mult} extraction multiplier.`;
    }
    if (btnDerrick) {
      if (col.derrick_tier >= 3) {
        btnDerrick.textContent = 'MAXIMUM TIER REACHED';
        btnDerrick.disabled = true;
      } else {
        const cost = col.derrick_tier === 1 ? '400 CR // 3 AP // 5 ALLOY' : '900 CR // 4 AP // 10 ALLOY';
        btnDerrick.textContent = `UPGRADE TO TIER ${col.derrick_tier + 1} (${cost})`;
        btnDerrick.disabled = false;
      }
    }

    // Facility Cards: Habitation
    const bHab = document.getElementById('badge-habitation-tier');
    const dHab = document.getElementById('desc-habitation-tier');
    const btnHab = document.getElementById('btn-upgrade-habitation') as HTMLButtonElement | null;
    if (bHab) bHab.textContent = col.habitation_tier >= 3 ? 'TIER 3 (MAX)' : `TIER ${col.habitation_tier}`;
    if (bHab && col.habitation_tier >= 3) bHab.classList.add('max');
    if (dHab) {
      dHab.textContent = `Pressurized biospheres supporting up to ${col.max_population} workforce.`;
    }
    if (btnHab) {
      if (col.habitation_tier >= 3) {
        btnHab.textContent = 'MAXIMUM TIER REACHED';
        btnHab.disabled = true;
      } else {
        const cost = col.habitation_tier === 1 ? '400 CR // 3 AP // 5 ALLOY' : '900 CR // 4 AP // 10 ALLOY';
        btnHab.textContent = `UPGRADE TO TIER ${col.habitation_tier + 1} (${cost})`;
        btnHab.disabled = false;
      }
    }

    // Facility Cards: Terraformer
    const bTer = document.getElementById('badge-terraformer-tier');
    const dTer = document.getElementById('desc-terraformer-tier');
    const btnTer = document.getElementById('btn-upgrade-terraformer') as HTMLButtonElement | null;
    if (bTer) bTer.textContent = col.terraformer_tier >= 3 ? 'TIER 3 (MAX)' : `TIER ${col.terraformer_tier}`;
    if (bTer && col.terraformer_tier >= 3) bTer.classList.add('max');
    if (dTer) {
      dTer.textContent = `Ion scrubbers detoxifying atmosphere (+${(col.terraformer_tier * 0.5).toFixed(1)}% Hab/hr).`;
    }
    if (btnTer) {
      if (col.terraformer_tier >= 3) {
        btnTer.textContent = 'MAXIMUM TIER REACHED';
        btnTer.disabled = true;
      } else {
        const cost = col.terraformer_tier === 1 ? '500 CR // 4 AP // 5 ALLOY' : '1,200 CR // 5 AP // 10 ALLOY';
        btnTer.textContent = `UPGRADE TO TIER ${col.terraformer_tier + 1} (${cost})`;
        btnTer.disabled = false;
      }
    }

    // Facility Cards: Silo
    const bSilo = document.getElementById('badge-silo-tier');
    const dSilo = document.getElementById('desc-silo-tier');
    const btnSilo = document.getElementById('btn-upgrade-silo') as HTMLButtonElement | null;
    if (bSilo) bSilo.textContent = col.silo_tier >= 3 ? 'TIER 3 (MAX)' : `TIER ${col.silo_tier}`;
    if (bSilo && col.silo_tier >= 3) bSilo.classList.add('max');
    if (dSilo) {
      dSilo.textContent = `Reinforced storage vaults buffering up to ${col.silo_capacity} units.`;
    }
    if (btnSilo) {
      if (col.silo_tier >= 3) {
        btnSilo.textContent = 'MAXIMUM TIER REACHED';
        btnSilo.disabled = true;
      } else {
        const cost = col.silo_tier === 1 ? '350 CR // 3 AP // 5 ALLOY' : '800 CR // 4 AP // 10 ALLOY';
        btnSilo.textContent = `UPGRADE TO TIER ${col.silo_tier + 1} (${cost})`;
        btnSilo.disabled = false;
      }
    }
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
      const res = await fetch('http://localhost:3000/api/colonies/found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
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
      const res = await fetch(`http://localhost:3000/api/colonies/${this.activeColony.id}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
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
      const res = await fetch(`http://localhost:3000/api/colonies/${this.activeColony.id}/harvest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
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
      const res = await fetch(`http://localhost:3000/api/precursor/planet/${planetId}?accountId=acc_sol_captain`);
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
      const res = await fetch(`http://localhost:3000/api/precursor/research?accountId=acc_sol_captain`);
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
              <span class="slot-badge slot-${tech.slotType.toLowerCase()}">${tech.slotType} SLOT // ${tech.category}</span>
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
      const res = await fetch('http://localhost:3000/api/precursor/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: 'acc_sol_captain', techId }),
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
      const res = await fetch('http://localhost:3000/api/precursor/remit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: 'acc_sol_captain', factionId }),
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
}
