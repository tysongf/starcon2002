export interface XenobiologyContext {
  getAccountId: () => string;
  onCargoUpdated?: () => void;
}

export class XenobiologyController {
  private ctx: XenobiologyContext;

  public modalXenobiologyLab: HTMLElement | null = null;
  public tabBtnSequencer: HTMLElement | null = null;
  public tabBtnColony: HTMLElement | null = null;
  public tabBtnSynthesis: HTMLElement | null = null;
  public tabBtnXenodex: HTMLElement | null = null;
  public viewTabSequencer: HTMLElement | null = null;
  public viewTabColony: HTMLElement | null = null;
  public viewTabSynthesis: HTMLElement | null = null;
  public viewTabXenodex: HTMLElement | null = null;
  public xenodexSpeciesGrid: HTMLElement | null = null;
  public xenodexCountBadge: HTMLElement | null = null;

  public labBioDataPoints: HTMLElement | null = null;
  public labCargoSpecimens: HTMLElement | null = null;
  public inputSpecimenQty: HTMLInputElement | null = null;
  public btnSpecimenMax: HTMLElement | null = null;
  public btnSubmitSpecimens: HTMLElement | null = null;
  public speciesMasteryList: HTMLElement | null = null;

  public biosphereBadge: HTMLElement | null = null;
  public biosphereName: HTMLElement | null = null;
  public biosphereDescription: HTMLElement | null = null;
  public biospherePopMult: HTMLElement | null = null;
  public biosphereMoraleBonus: HTMLElement | null = null;
  public biosphereTaxBonus: HTMLElement | null = null;
  public btnUpgradeBiosphere: HTMLElement | null = null;
  public colonyProjectsGrid: HTMLElement | null = null;
  public synthesisCatalogGrid: HTMLElement | null = null;
  public xenoLabToast: HTMLElement | null = null;

  // Flight HUD Buff widgets
  public biotechBuffHud: HTMLElement | null = null;
  public stimAdrenalBadge: HTMLElement | null = null;
  public stimTimer: HTMLElement | null = null;
  public regenCoatingBadge: HTMLElement | null = null;

  public labData: any = null;
  public activeStimTimeRemaining: number = 0;
  public hasRegenCoating: boolean = false;
  public activeTab: 'sequencer' | 'colony' | 'synthesis' | 'xenodex' = 'sequencer';

  constructor(ctx: XenobiologyContext) {
    this.ctx = ctx;
    this.initDOM();
  }

  public initDOM(): void {
    this.modalXenobiologyLab = document.getElementById('modal-xenobiology-lab');
    this.tabBtnSequencer = document.getElementById('tab-lab-sequencer');
    this.tabBtnColony = document.getElementById('tab-lab-colony');
    this.tabBtnSynthesis = document.getElementById('tab-lab-synthesis');
    this.tabBtnXenodex = document.getElementById('tab-lab-xenodex');
    this.viewTabSequencer = document.getElementById('view-lab-sequencer');
    this.viewTabColony = document.getElementById('view-lab-colony');
    this.viewTabSynthesis = document.getElementById('view-lab-synthesis');
    this.viewTabXenodex = document.getElementById('view-lab-xenodex');
    this.xenodexSpeciesGrid = document.getElementById('xenodex-species-grid');
    this.xenodexCountBadge = document.getElementById('xenodex-count-badge');

    this.labBioDataPoints = document.getElementById('lab-bio-data-points');
    this.labCargoSpecimens = document.getElementById('lab-cargo-specimens');
    this.inputSpecimenQty = document.getElementById('input-specimen-qty') as HTMLInputElement;
    this.btnSpecimenMax = document.getElementById('btn-specimen-max');
    this.btnSubmitSpecimens = document.getElementById('btn-submit-specimens');
    this.speciesMasteryList = document.getElementById('species-mastery-list');

    this.biosphereBadge = document.getElementById('biosphere-badge');
    this.biosphereName = document.getElementById('biosphere-name');
    this.biosphereDescription = document.getElementById('biosphere-description');
    this.biospherePopMult = document.getElementById('biosphere-pop-mult');
    this.biosphereMoraleBonus = document.getElementById('biosphere-morale-bonus');
    this.biosphereTaxBonus = document.getElementById('biosphere-tax-bonus');
    this.btnUpgradeBiosphere = document.getElementById('btn-upgrade-biosphere');
    this.colonyProjectsGrid = document.getElementById('colony-projects-grid');
    this.synthesisCatalogGrid = document.getElementById('synthesis-catalog-grid');
    this.xenoLabToast = document.getElementById('xeno-lab-toast');

    // Flight HUD
    this.biotechBuffHud = document.getElementById('biotech-buff-hud');
    this.stimAdrenalBadge = document.getElementById('stim-adrenal-badge');
    this.stimTimer = document.getElementById('stim-timer');
    this.regenCoatingBadge = document.getElementById('regen-coating-badge');

    // Event Listeners
    this.tabBtnSequencer?.addEventListener('click', () => this.switchTab('sequencer'));
    this.tabBtnColony?.addEventListener('click', () => this.switchTab('colony'));
    this.tabBtnSynthesis?.addEventListener('click', () => this.switchTab('synthesis'));
    this.tabBtnXenodex?.addEventListener('click', () => this.switchTab('xenodex'));

    document.getElementById('btn-close-xenobiology-lab')?.addEventListener('click', () => this.closeLab());
    document.getElementById('btn-dock-xenobiology')?.addEventListener('click', () => this.openLab());

    this.btnSpecimenMax?.addEventListener('click', () => {
      if (this.inputSpecimenQty && this.labData) {
        this.inputSpecimenQty.value = String(Math.max(1, this.labData.specimensInHold || 1));
      }
    });

    this.btnSubmitSpecimens?.addEventListener('click', async () => {
      const qty = parseInt(this.inputSpecimenQty?.value || '1', 10);
      if (qty > 0) {
        await this.submitSpecimens(qty);
      }
    });

    this.btnUpgradeBiosphere?.addEventListener('click', async () => {
      await this.upgradeBiosphere();
    });
  }

  public async openLab(): Promise<void> {
    if (!this.modalXenobiologyLab) this.initDOM();
    if (this.modalXenobiologyLab) {
      this.modalXenobiologyLab.classList.remove('hidden');
    }
    await this.fetchLabStatus();
  }

  public closeLab(): void {
    if (this.modalXenobiologyLab) {
      this.modalXenobiologyLab.classList.add('hidden');
    }
  }

  public switchTab(tab: 'sequencer' | 'colony' | 'synthesis' | 'xenodex'): void {
    this.activeTab = tab;
    this.tabBtnSequencer?.classList.toggle('active', tab === 'sequencer');
    this.tabBtnColony?.classList.toggle('active', tab === 'colony');
    this.tabBtnSynthesis?.classList.toggle('active', tab === 'synthesis');
    this.tabBtnXenodex?.classList.toggle('active', tab === 'xenodex');

    this.viewTabSequencer?.classList.toggle('hidden', tab !== 'sequencer');
    this.viewTabColony?.classList.toggle('hidden', tab !== 'colony');
    this.viewTabSynthesis?.classList.toggle('hidden', tab !== 'synthesis');
    this.viewTabXenodex?.classList.toggle('hidden', tab !== 'xenodex');

    if (tab === 'xenodex') {
      this.fetchXenodex();
    }
  }

  public async fetchXenodex(): Promise<void> {
    if (!this.xenodexSpeciesGrid) return;
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch(`http://127.0.0.1:3000/api/xenobiology/xenodex?accountId=${accountId}`);
      if (!res.ok) return;
      const data = await res.json();
      const entries = data.entries || [];
      if (this.xenodexCountBadge) {
        this.xenodexCountBadge.textContent = `${entries.length} SPECIES LOGGED`;
      }
      this.xenodexSpeciesGrid.innerHTML = '';
      if (entries.length === 0) {
        this.xenodexSpeciesGrid.innerHTML = '<div class="xeno-desc">No alien species logged yet. Perform Orbital BIO Sweeps [2] over any planetary world to catalog endemic xenobiology.</div>';
        return;
      }
      for (const sp of entries) {
        const card = document.createElement('div');
        card.className = 'mastery-card tier-2';
        card.innerHTML = `
          <div class="mastery-card-header">
            <span class="mastery-species-name">🧬 ${sp.commonName} <em style="opacity:0.75;">(${sp.scientificName})</em></span>
            <span class="mastery-tier-badge" style="color: #38bdf8;">${sp.kingdom} • ${sp.rarityTier}</span>
          </div>
          <div class="mastery-perk-text">
            World: <strong>${sp.planetName}</strong> (${sp.planetSubtype}) // ${sp.covering}, ${sp.sizeMeters}m // ${sp.trophicRole} // Trait: ${sp.adaptationTrait}
          </div>
        `;
        this.xenodexSpeciesGrid.appendChild(card);
      }
    } catch (err) {
      console.error('[XenobiologyController] Error loading Xenodex:', err);
    }
  }

  public async fetchLabStatus(): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch(`http://127.0.0.1:3000/api/xenobiology/lab?accountId=${accountId}`);
      if (res.ok) {
        this.labData = await res.json();
        this.renderLab();
      }
    } catch (err) {
      console.error('[XenobiologyController] Error fetching lab status:', err);
    }
  }

  public renderLab(): void {
    if (!this.labData) return;

    if (this.labBioDataPoints) {
      this.labBioDataPoints.textContent = `${this.labData.bioDataPoints || 0} BD`;
    }
    if (this.labCargoSpecimens) {
      this.labCargoSpecimens.textContent = `${this.labData.specimensInHold || 0}`;
    }

    // Check active buffs
    this.hasRegenCoating = this.labData.unlockedProjects?.includes('COATING_BIO_REGEN') || false;
    if (this.labData.activeStims && this.labData.activeStims.length > 0) {
      const now = Date.now();
      const latest = this.labData.activeStims[this.labData.activeStims.length - 1];
      if (latest && latest.expiresAt > now) {
        this.activeStimTimeRemaining = Math.max(0, Math.ceil((latest.expiresAt - now) / 1000));
      }
    }

    // Render Tab 1: Specimen Sequencer & Mastery
    this.renderMasteryList();

    // Render Tab 2: Biosphere Tier & Colony Projects
    this.renderBiosphereAndProjects();

    // Render Tab 3: Synthesis Workbench
    this.renderSynthesisCatalog();
  }

  private renderMasteryList(): void {
    if (!this.speciesMasteryList) return;
    this.speciesMasteryList.innerHTML = '';

    const defaultSpecies = [
      { id: 'fauna_aegis_carnivore_01', name: 'Silicon Mantis (Carnivore)', habitat: 'Silicate Crags' },
      { id: 'fauna_aegis_grazer_01', name: 'Bio-Spore Strider (Grazer)', habitat: 'Fungal Basins' },
      { id: 'fauna_charybdis_stalker', name: 'Charybdian Abyssal Stalker', habitat: 'Hydro-Thermal Vents' },
      { id: 'fauna_pyrite_beetle', name: 'Pyrite Chit-Beetle', habitat: 'Sulfuric Plains' },
    ];

    const mastery = this.labData.speciesMastery || {};

    defaultSpecies.forEach((sp) => {
      const m = mastery[sp.id] || { submittedCount: 0, tier: 1, tierLabel: 'SEQUENCED' };
      const card = document.createElement('div');
      card.className = `mastery-card tier-${m.tier}`;

      const progressPct = Math.min(100, Math.round((m.submittedCount / 8) * 100));

      card.innerHTML = `
        <div class="mastery-card-header">
          <span class="mastery-species-name">🧬 ${sp.name}</span>
          <span class="mastery-tier-badge" style="color: ${m.tier === 3 ? '#f59e0b' : m.tier === 2 ? '#34d399' : '#38bdf8'};">
            TIER ${m.tier}: ${m.tierLabel}
          </span>
        </div>
        <div class="mastery-progress-track">
          <div class="mastery-progress-fill" style="width: ${progressPct}%;"></div>
        </div>
        <div class="mastery-perk-text">
          Specimens Analyzed: <strong>${m.submittedCount}</strong> (Habitat: ${sp.habitat})
        </div>
      `;
      this.speciesMasteryList?.appendChild(card);
    });
  }

  private renderBiosphereAndProjects(): void {
    const curTier = this.labData.biosphereTierDetails || { tier: 1, name: 'Standard Biosphere', populationMultiplier: 1.0, moraleBonus: 0, taxBonus: 0, description: 'Baseline' };
    const nextTier = this.labData.nextBiosphereTier;

    if (this.biosphereBadge) this.biosphereBadge.textContent = `TIER ${curTier.tier} // ${curTier.tier === 5 ? 'APEX' : 'ACTIVE'}`;
    if (this.biosphereName) this.biosphereName.textContent = curTier.name;
    if (this.biosphereDescription) this.biosphereDescription.textContent = curTier.description;
    if (this.biospherePopMult) this.biospherePopMult.textContent = `${Number(curTier.populationMultiplier).toFixed(2)}x`;
    if (this.biosphereMoraleBonus) this.biosphereMoraleBonus.textContent = `+${Math.round(curTier.moraleBonus * 100)}%`;
    if (this.biosphereTaxBonus) this.biosphereTaxBonus.textContent = `+${Math.round(curTier.taxBonus * 100)}%`;

    if (this.btnUpgradeBiosphere) {
      if (nextTier) {
        this.btnUpgradeBiosphere.textContent = `🌱 UPGRADE TO TIER ${nextTier.tier} (${nextTier.costBioData} BD)`;
        this.btnUpgradeBiosphere.removeAttribute('disabled');
      } else {
        this.btnUpgradeBiosphere.textContent = `MAX TIER REACHED (APEX GENESIS)`;
        this.btnUpgradeBiosphere.setAttribute('disabled', 'true');
      }
    }

    // Render Projects
    if (!this.colonyProjectsGrid) return;
    this.colonyProjectsGrid.innerHTML = '';

    const unlocked = this.labData.unlockedProjects || [];
    const catalog = this.labData.colonyProjectsCatalog || [];

    catalog.forEach((proj: any) => {
      const isUnlocked = unlocked.includes(proj.id);
      const card = document.createElement('div');
      card.className = `project-card ${isUnlocked ? 'unlocked' : ''}`;

      card.innerHTML = `
        <div class="project-header">
          <span class="project-title">🌱 ${proj.name}</span>
          <span class="project-cost">${isUnlocked ? 'RESEARCHED' : `${proj.costBioData} BD`}</span>
        </div>
        <p class="project-desc">${proj.description}</p>
        <div class="project-benefit">${proj.benefit}</div>
        ${proj.requiredMastery && !isUnlocked ? `<div class="project-req">Requires: Species Mastery Tier ${proj.requiredMastery.tier}</div>` : ''}
        <button class="hud-btn ${isUnlocked ? '' : 'primary'} xeno-research-btn" data-proj-id="${proj.id}" ${isUnlocked ? 'disabled' : ''}>
          ${isUnlocked ? 'COMPLETED' : 'RESEARCH BREAKTHROUGH'}
        </button>
      `;

      card.querySelector('.xeno-research-btn')?.addEventListener('click', async () => {
        await this.researchProject(proj.id);
      });

      this.colonyProjectsGrid?.appendChild(card);
    });
  }

  private renderSynthesisCatalog(): void {
    if (!this.synthesisCatalogGrid) return;
    this.synthesisCatalogGrid.innerHTML = '';

    const catalog = this.labData.synthesisCatalog || [];

    catalog.forEach((item: any) => {
      const card = document.createElement('div');
      card.className = 'synthesis-card';

      card.innerHTML = `
        <div class="synthesis-header">
          <span class="synthesis-title">${item.category === 'COMBAT_STIM' ? '⚡' : item.category === 'COATING' ? '🧬' : '🔋'} ${item.name}</span>
          <span class="synthesis-category">${item.category}</span>
        </div>
        <p class="project-desc">${item.description}</p>
        <div class="synthesis-ingredients">
          <span class="ingredient-badge">🧪 ${item.specimenCost} Bio-Specimens</span>
          <span class="ingredient-badge">💰 ${item.creditsCost} CR</span>
        </div>
        <div class="synthesis-effect">${item.effect}</div>
        <div class="synthesis-actions">
          <button class="hud-btn primary xeno-synth-btn" data-item-id="${item.id}" style="flex: 1;">
            SYNTHESIZE
          </button>
          ${item.category === 'COMBAT_STIM' ? `
            <button class="hud-btn xeno-use-stim-btn" data-stim-id="${item.id}" style="flex: 1;">
              INJECT STIM (30s)
            </button>
          ` : ''}
        </div>
      `;

      card.querySelector('.xeno-synth-btn')?.addEventListener('click', async () => {
        await this.synthesizeItem(item.id);
      });

      card.querySelector('.xeno-use-stim-btn')?.addEventListener('click', async () => {
        await this.useStim(item.id);
      });

      this.synthesisCatalogGrid?.appendChild(card);
    });
  }

  public async submitSpecimens(quantity: number, speciesId?: string): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('http://127.0.0.1:3000/api/xenobiology/submit-specimens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, quantity, speciesId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.showToast(`Analyzed ${quantity} specimen(s)! Earned +${data.bioDataAwarded} Bio-Data points.`);
        this.ctx.onCargoUpdated?.();
        await this.fetchLabStatus();
      } else {
        this.showToast(data.error || 'Failed to submit specimens.', true);
      }
    } catch (err: any) {
      this.showToast(err.message || 'Network error.', true);
    }
  }

  public async upgradeBiosphere(): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('http://127.0.0.1:3000/api/xenobiology/upgrade-biosphere', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.showToast(`Global Biosphere upgraded to Tier ${data.newTier.tier}: ${data.newTier.name}!`);
        await this.fetchLabStatus();
      } else {
        this.showToast(data.error || 'Failed to upgrade biosphere.', true);
      }
    } catch (err: any) {
      this.showToast(err.message || 'Network error.', true);
    }
  }

  public async researchProject(projectId: string): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('http://127.0.0.1:3000/api/xenobiology/research-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, projectId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.showToast(`Breakthrough unlocked: ${data.project.name}!`);
        await this.fetchLabStatus();
      } else {
        this.showToast(data.error || 'Failed to research breakthrough.', true);
      }
    } catch (err: any) {
      this.showToast(err.message || 'Network error.', true);
    }
  }

  public async synthesizeItem(itemId: string): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('http://127.0.0.1:3000/api/xenobiology/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, itemId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.showToast(`Successfully synthesized: ${data.item.name}!`);
        this.ctx.onCargoUpdated?.();
        await this.fetchLabStatus();
      } else {
        this.showToast(data.error || 'Failed to synthesize item.', true);
      }
    } catch (err: any) {
      this.showToast(err.message || 'Network error.', true);
    }
  }

  public async useStim(stimId: string = 'STIM_ADRENAL_SURGE'): Promise<void> {
    try {
      const accountId = this.ctx.getAccountId();
      const res = await fetch('http://127.0.0.1:3000/api/xenobiology/use-stim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, stimId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.activeStimTimeRemaining = 30;
        this.showToast(`Adrenal Combat Stim injected! +35% Thrust / -30% Weapon Cooldown active!`);
      } else {
        this.showToast(data.error || 'Failed to activate stim.', true);
      }
    } catch (err: any) {
      this.showToast(err.message || 'Network error.', true);
    }
  }

  public updateHudBuffs(deltaSec: number): void {
    if (this.activeStimTimeRemaining > 0) {
      this.activeStimTimeRemaining = Math.max(0, this.activeStimTimeRemaining - deltaSec);
    }

    const showStim = this.activeStimTimeRemaining > 0;
    const showRegen = this.hasRegenCoating;

    if (this.biotechBuffHud) {
      this.biotechBuffHud.classList.toggle('hidden', !showStim && !showRegen);
    }

    if (this.stimAdrenalBadge) {
      this.stimAdrenalBadge.classList.toggle('hidden', !showStim);
      if (this.stimTimer) {
        this.stimTimer.textContent = `${Math.ceil(this.activeStimTimeRemaining)}s`;
      }
    }

    if (this.regenCoatingBadge) {
      this.regenCoatingBadge.classList.toggle('hidden', !showRegen);
    }
  }

  public showToast(msg: string, isError: boolean = false): void {
    if (!this.xenoLabToast) return;
    this.xenoLabToast.textContent = msg;
    this.xenoLabToast.className = `market-toast ${isError ? 'error' : 'success'}`;
    this.xenoLabToast.classList.remove('hidden');
    setTimeout(() => {
      this.xenoLabToast?.classList.add('hidden');
    }, 4000);
  }
}

