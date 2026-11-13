import { AudioEngine } from '../audio/AudioEngine';

export interface CommsCallbacks {
  audio: AudioEngine;
  showApNotification: (msg: string, isError: boolean) => void;
  getCurrentSectorId: () => number;
  refreshPlayerHold: () => Promise<void>;
  getTarget?: () => any;
  getPlayerPosition?: () => any;
  onCommsClosed?: () => void;
}

export class CommsController {
  private audio: AudioEngine;
  private callbacks: CommsCallbacks;

  // DOM Elements
  private elAlienCommsModal: HTMLElement | null = null;
  private elBtnCloseAlienComms: HTMLElement | null = null;
  private elAlienPortraitCanvas: HTMLCanvasElement | null = null;
  private elCommsWaveformCanvas: HTMLCanvasElement | null = null;
  private elAlienCommsSpeakerName: HTMLElement | null = null;
  private elAlienCommsSpeakerTitle: HTMLElement | null = null;
  private elAlienCommsSpeciesLabel: HTMLElement | null = null;
  private elAlienCommsMoodBadge: HTMLElement | null = null;
  private elAlienCommsCrestIcon: HTMLElement | null = null;
  private elAlienCommsCrestLabel: HTMLElement | null = null;
  private elAlienCommsDialogueText: HTMLElement | null = null;
  private elAlienCommsDialogueSpeaker: HTMLElement | null = null;
  private elAlienCommsOptionsList: HTMLElement | null = null;

  // Diplomacy & Faction Dossier
  private elDiplomacyEnvoysList: HTMLElement | null = null;
  private elDiplomacyEnvoysCount: HTMLElement | null = null;
  private elFactionDossierList: HTMLElement | null = null;
  private modalFactionStandings: HTMLElement | null = null;

  // HUD Allegiance & Truce
  private elHudFactionBadge: HTMLElement | null = null;
  private elHudFactionCrest: HTMLElement | null = null;
  private elHudFactionName: HTMLElement | null = null;
  private elHudFactionStandingTier: HTMLElement | null = null;
  private elHudTruceTimerPill: HTMLElement | null = null;

  // State
  public currentAlienNpcId: string | null = null;
  public isConvoyComms: boolean = false;
  public currentConvoyId: string | null = null;
  public currentAlienSpecies: string = 'VAELIC';
  public currentAlienMood: string = 'AGGRESSIVE';
  public alienPortraitAnimId: number | null = null;
  public commsWaveformAnimId: number | null = null;
  public alienPortraitTime: number = 0;
  public isAlienSpeaking: boolean = false;
  public alienTypewriterTimer: any = null;
  public alienCurrentOptions: any[] = [];

  public playerStandings: any[] = [];
  public activeTruceExpiresAt: number | null = null;
  public truceTimerInterval: any = null;

  constructor(callbacks: CommsCallbacks) {
    this.callbacks = callbacks;
    this.audio = callbacks.audio;
    this.initUI();
  }

  private initUI(): void {
    this.elAlienCommsModal = document.getElementById('alien-comms-modal');
    this.elBtnCloseAlienComms = document.getElementById('btn-close-alien-comms');
    this.elAlienPortraitCanvas = document.getElementById('alien-portrait-canvas') as HTMLCanvasElement;
    this.elCommsWaveformCanvas = document.getElementById('comms-waveform-canvas') as HTMLCanvasElement;
    this.elAlienCommsSpeakerName = document.getElementById('comms-speaker-name');
    this.elAlienCommsSpeakerTitle = document.getElementById('comms-speaker-title');
    this.elAlienCommsSpeciesLabel = document.getElementById('comms-species-label');
    this.elAlienCommsMoodBadge = document.getElementById('comms-mood-badge');
    this.elAlienCommsCrestIcon = document.getElementById('comms-crest-icon');
    this.elAlienCommsCrestLabel = document.getElementById('comms-crest-label');
    this.elAlienCommsDialogueText = document.getElementById('comms-dialogue-text');
    this.elAlienCommsDialogueSpeaker = document.getElementById('comms-dialogue-speaker');
    this.elAlienCommsOptionsList = document.getElementById('comms-options-list');

    this.elDiplomacyEnvoysList = document.getElementById('diplomacy-envoys-list');
    this.elDiplomacyEnvoysCount = document.getElementById('diplomacy-envoys-count');
    this.elFactionDossierList = document.getElementById('faction-dossier-list');
    this.modalFactionStandings = document.getElementById('faction-standings-modal');

    this.elHudFactionBadge = document.getElementById('hud-faction-badge');
    this.elHudFactionCrest = document.getElementById('hud-faction-crest');
    this.elHudFactionName = document.getElementById('hud-faction-name');
    this.elHudFactionStandingTier = document.getElementById('hud-faction-standing-tier');
    this.elHudTruceTimerPill = document.getElementById('hud-truce-timer-pill');

    this.elBtnCloseAlienComms?.addEventListener('click', () => this.closeAlienComms());
    document.getElementById('btn-close-faction-standings')?.addEventListener('click', () => this.closeFactionStandingsModal());
    this.elHudFactionBadge?.addEventListener('click', () => this.openFactionStandingsModal());

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.elAlienCommsModal && !this.elAlienCommsModal.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          this.closeAlienComms();
        } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          if (idx >= 0 && idx < this.alienCurrentOptions.length) {
            this.selectAlienDialogOption(idx);
          }
        }
      }
    });
  }

  public openFactionStandingsModal(): void {
    if (this.modalFactionStandings) {
      this.modalFactionStandings.classList.remove('hidden');
      this.refreshFactionStandings();
    }
  }

  public closeFactionStandingsModal(): void {
    if (this.modalFactionStandings) {
      this.modalFactionStandings.classList.add('hidden');
    }
  }

  public async loadDiplomacyData(): Promise<void> {
    this.renderFactionDossier();
    if (!this.elDiplomacyEnvoysList) return;
    try {
      const res = await fetch('/api/dialog/npcs');
      if (!res.ok) return;
      const data = await res.json();
      const npcs = data.npcs || [];

      if (this.elDiplomacyEnvoysCount) {
        this.elDiplomacyEnvoysCount.textContent = `${npcs.length} CHANNELS ONLINE`;
      }

      this.elDiplomacyEnvoysList.innerHTML = npcs.map((npc: any) => {
        let icon = '🦅';
        let faction = 'Vaelic Hegemony';
        let desc = 'Sovereign decree enforcement, sector tithes, and military ultimatum negotiations.';
        if (npc.species === 'PHORID') {
          icon = '🍄';
          faction = 'Phorid Sporeborn';
          desc = 'Harmonic spore consciousness, ancient planetary lore, and organic biocatalysts.';
        } else if (npc.species === 'KRYLL') {
          icon = '🐀';
          faction = 'Kryll Free Cartel';
          desc = 'Black-market scavenged surplus, raw alloy trading, and underworld convoy rumors.';
        }

        return `
          <div class="envoy-card">
            <div class="envoy-card-left">
              <div class="envoy-avatar-circle">${icon}</div>
              <div class="envoy-info">
                <span class="envoy-name">${npc.speakerName}</span>
                <span class="envoy-title">${npc.title} // ${faction.toUpperCase()}</span>
                <span style="font-size: 0.7rem; color: #94a3b8; margin-top: 2px;">${desc}</span>
              </div>
            </div>
            <button class="envoy-open-btn" data-npc="${npc.npcId}">OPEN SUB-SPACE LINK 📡</button>
          </div>
        `;
      }).join('');

      this.elDiplomacyEnvoysList.querySelectorAll('.envoy-open-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const npcId = (e.currentTarget as HTMLElement).getAttribute('data-npc');
          if (npcId) this.openAlienComms(npcId);
        });
      });
    } catch (err) {
      console.error('[Diplomacy] Failed to load envoys:', err);
    }
  }

  public hailCurrentTargetOrEnvoy(): void {
    const target = this.callbacks.getTarget?.();
    const playerPos = this.callbacks.getPlayerPosition?.();

    if (target) {
      if (playerPos) {
        const dx = (target.x ?? 0) - (playerPos.x ?? 0);
        const dz = (target.z ?? 0) - (playerPos.z ?? 0);
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 80.0) {
          this.callbacks.showApNotification(`📡 TARGET OUT OF HAILING RANGE (${Math.round(dist)}u > 80u)`, true);
          this.audio.playApWarningSound();
          return;
        }
      }

      if (target.isConvoyHauler || target.type === 'HAULER' || target.convoyId) {
        const convoyId = target.convoyId || target.id;
        this.openConvoyComms(convoyId);
        return;
      }
    }

    const targetName = document.getElementById('reticle-name')?.textContent || '';
    if (targetName.includes('INTERDICTOR') || targetName.includes('HEGEMONY') || targetName.includes('DRONE')) {
      this.openAlienComms('npc_vorash');
    } else if (targetName.includes('SCAVENGER') || targetName.includes('VULTURE') || targetName.includes('KRYLL')) {
      this.openAlienComms('npc_skrit');
    } else if (this.callbacks.getCurrentSectorId() === 2) {
      this.openAlienComms('npc_vorash');
    } else {
      this.openAlienComms('npc_skrit');
    }
  }

  public async openConvoyComms(convoyId: string): Promise<void> {
    this.isConvoyComms = true;
    this.currentConvoyId = convoyId;
    this.currentAlienNpcId = null;

    if (this.elAlienCommsModal) {
      this.elAlienCommsModal.classList.remove('hidden');
    }
    this.audio.playCommsHailingChime();

    const sectorId = this.callbacks.getCurrentSectorId();
    try {
      await fetch('/api/dialog/convoy/stand-down', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectorId,
          isStandDown: true,
        }),
      });
    } catch (e) {
      console.warn('[Convoy Comms] Failed to notify stand-down:', e);
    }

    try {
      const res = await fetch(`/api/dialog/convoy/${convoyId}?accountId=acc_sol_captain&sectorId=${sectorId}`);
      if (!res.ok) {
        this.callbacks.showApNotification('⚠️ CONVOY COMMS FREQUENCY UNRESPONSIVE', true);
        this.closeAlienComms();
        return;
      }
      const data = await res.json();
      if (!data.dialog) {
        this.closeAlienComms();
        return;
      }

      this.renderAlienDialogNode(data.dialog);
    } catch (err) {
      console.error('[Convoy Comms] Error fetching dialog node:', err);
      this.closeAlienComms();
    }
  }

  public async openAlienComms(npcId: string): Promise<void> {
    this.isConvoyComms = false;
    this.currentConvoyId = null;
    this.currentAlienNpcId = npcId;
    if (this.elAlienCommsModal) {
      this.elAlienCommsModal.classList.remove('hidden');
    }
    this.audio.playCommsHailingChime();

    try {
      const res = await fetch(`/api/dialog/${npcId}?accountId=acc_sol_captain`);
      if (!res.ok) return;
      const data = await res.json();
      const dialog = data.dialog;
      if (!dialog) return;

      this.renderAlienDialogNode(dialog);
    } catch (err) {
      console.error('[Alien Comms] Error fetching dialog node:', err);
    }
  }

  public renderAlienDialogNode(dialog: any): void {
    this.currentAlienSpecies = dialog.species || 'VAELIC';
    this.currentAlienMood = dialog.mood || 'NEUTRAL';
    this.alienCurrentOptions = dialog.options || [];

    if (this.elAlienCommsSpeakerName) this.elAlienCommsSpeakerName.textContent = dialog.speakerName;
    if (this.elAlienCommsSpeakerTitle) this.elAlienCommsSpeakerTitle.textContent = dialog.title;
    if (this.elAlienCommsSpeciesLabel) this.elAlienCommsSpeciesLabel.textContent = dialog.species;
    if (this.elAlienCommsDialogueSpeaker) this.elAlienCommsDialogueSpeaker.textContent = `${dialog.speakerName.toUpperCase()} SPEAKS:`;

    if (this.elAlienCommsMoodBadge) {
      this.elAlienCommsMoodBadge.textContent = `MOOD: ${dialog.mood}`;
      this.elAlienCommsMoodBadge.className = `comms-mood-badge mood-${dialog.mood.toLowerCase()}`;
    }

    if (this.elAlienCommsCrestIcon && this.elAlienCommsCrestLabel) {
      if (dialog.species === 'VAELIC') {
        this.elAlienCommsCrestIcon.textContent = '🦅';
        this.elAlienCommsCrestLabel.textContent = 'VAELIC HEGEMONY';
      } else if (dialog.species === 'PHORID') {
        this.elAlienCommsCrestIcon.textContent = '🍄';
        this.elAlienCommsCrestLabel.textContent = 'PHORID SPOREBORN';
      } else if (dialog.species === 'KRYLL') {
        this.elAlienCommsCrestIcon.textContent = '🐀';
        this.elAlienCommsCrestLabel.textContent = 'KRYLL FREE CARTEL';
      } else {
        this.elAlienCommsCrestIcon.textContent = '🚀';
        this.elAlienCommsCrestLabel.textContent = 'SOL ALLIANCE';
      }
    }

    // Start portrait animation loop if not running
    if (!this.alienPortraitAnimId) {
      this.startAlienPortraitLoop();
    }
    // Start waveform animation loop if not running
    if (!this.commsWaveformAnimId) {
      this.startCommsWaveformLoop();
    }

    // Render dialogue text with typewriter effect
    this.startDialogueTypewriter(dialog.dialogueText, dialog.species);

    // Populate response options
    if (this.elAlienCommsOptionsList) {
      let manifestHtml = '';
      if (this.isConvoyComms && dialog.manifest && dialog.manifest.length > 0) {
        const items = dialog.manifest.map((item: any) => `
          <div class="manifest-item-pill">
            <span style="color: #f1f5f9; font-weight: 600;">${item.name || item.commodityId}</span>
            <span style="color: #38bdf8;">${item.quantity}u</span>
            <span style="color: #10b981;">~${Math.round((item.unitValue || 60) * 0.85)} CR</span>
          </div>
        `).join('');

        manifestHtml = `
          <div class="convoy-barter-manifest-card">
            <div class="manifest-card-title">📦 IN-FLIGHT HAULER CARGO MANIFEST (15% BULK DISCOUNT):</div>
            <div class="manifest-items-grid">${items}</div>
          </div>
        `;
      }

      this.elAlienCommsOptionsList.innerHTML = manifestHtml + dialog.options.map((opt: any, idx: number) => {
        return `
          <button class="comms-option-btn" data-index="${idx}">
            <span class="option-num-badge">[${idx + 1}]</span>
            <span class="option-text">${opt.text}</span>
          </button>
        `;
      }).join('');

      this.elAlienCommsOptionsList.querySelectorAll('.comms-option-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-index') || '0', 10);
          this.selectAlienDialogOption(idx);
        });
      });
    }
  }

  public startDialogueTypewriter(text: string, species: string): void {
    if (this.alienTypewriterTimer) {
      clearInterval(this.alienTypewriterTimer);
      this.alienTypewriterTimer = null;
    }

    if (!this.elAlienCommsDialogueText) return;
    this.elAlienCommsDialogueText.textContent = '';
    this.isAlienSpeaking = true;

    let idx = 0;
    const len = text.length;

    this.alienTypewriterTimer = setInterval(() => {
      if (idx >= len) {
        clearInterval(this.alienTypewriterTimer);
        this.alienTypewriterTimer = null;
        this.isAlienSpeaking = false;
        return;
      }

      this.elAlienCommsDialogueText!.textContent += text[idx];

      // Voice synthesizer blip
      if (idx % 2 === 0 && text[idx] !== ' ') {
        this.audio.playAlienPhoneme(species, text[idx]);
      }

      idx++;
    }, 24);
  }

  public async selectAlienDialogOption(optionIndex: number): Promise<void> {
    if (!this.currentAlienNpcId && !this.isConvoyComms) return;

    this.audio.playUiBlip();
    try {
      if (this.isConvoyComms && this.currentConvoyId) {
        const sectorId = this.callbacks.getCurrentSectorId();
        const res = await fetch('/api/dialog/convoy/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: 'acc_sol_captain',
            sectorId,
            convoyId: this.currentConvoyId,
            optionIndex,
          }),
        });

        if (!res.ok) return;
        const data = await res.json();

        if (data.actionMessage) {
          this.callbacks.showApNotification(data.actionMessage, false);
          this.callbacks.refreshPlayerHold();
          if (data.actionMessage.includes('ceasefire') || data.actionMessage.includes('Safe transit') || data.actionMessage.includes('Truce') || data.actionMessage.includes('registered with fleet command')) {
            this.startTruceCountdown(300);
          }
          this.refreshFactionStandings();
        }

        if (data.nextNode) {
          this.renderAlienDialogNode(data.nextNode);
        } else {
          this.closeAlienComms();
        }
        return;
      }

      const res = await fetch('/api/dialog/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
          npcId: this.currentAlienNpcId,
          optionIndex,
        }),
      });

      if (!res.ok) return;
      const data = await res.json();

      if (data.actionMessage) {
        this.callbacks.showApNotification(data.actionMessage, false);
        this.callbacks.refreshPlayerHold();
        if (data.actionMessage.includes('ceasefire') || data.actionMessage.includes('disarmed') || data.actionMessage.includes('Seal')) {
          this.startTruceCountdown(300);
        }
        this.refreshFactionStandings();
      }

      if (data.nextNode) {
        this.renderAlienDialogNode(data.nextNode);
      }
    } catch (err) {
      console.error('[Alien Comms] Error selecting option:', err);
    }
  }

  public async refreshFactionStandings(): Promise<void> {
    try {
      const res = await fetch('/api/reputation/standings?accountId=acc_sol_captain');
      if (!res.ok) return;
      const data = await res.json();
      this.playerStandings = data.standings || [];
      this.renderFactionDossier();
      this.updateHudSectorAllegiance();
    } catch (err) {
      console.warn('[REPUTATION] Failed to fetch standings:', err);
    }
  }

  public renderFactionDossier(): void {
    if (!this.elFactionDossierList) return;
    if (!this.playerStandings || this.playerStandings.length === 0) {
      this.elFactionDossierList.innerHTML = `
        <div class="market-loading-hint">Loading Cluster Diplomatic Standings...</div>
      `;
      return;
    }

    this.elFactionDossierList.innerHTML = this.playerStandings.map((f: any) => {
      const score = Math.max(-100, Math.min(100, f.standing || 0));
      const isPos = score >= 0;
      const widthPct = Math.round(Math.abs(score) / 2); // 0 to 50%
      const leftPos = isPos ? 50 : 50 - widthPct;

      const tierClass = `tier-${(f.tier || 'neutral').toLowerCase()}`;
      const sign = score > 0 ? `+${score}` : `${score}`;

      let tariffText = '';
      if (f.discountPercent > 0) {
        tariffText = `<span style="color: #10b981;">-${f.discountPercent}% Market & Outfitting Discount</span>`;
      } else if (f.surchargePercent > 0) {
        tariffText = `<span style="color: #ef4444;">+${f.surchargePercent}% Hostile Tariff Surcharge</span>`;
      } else {
        tariffText = `<span style="color: #94a3b8;">Standard Cluster Rates</span>`;
      }

      const dockingPill = f.isDockingPermitted
        ? `<span class="faction-docking-status permitted">✓ DOCKING PERMITTED</span>`
        : `<span class="faction-docking-status lockdown">⚠️ SHIELDS ACTIVE (LOCKDOWN)</span>`;

      return `
        <div class="faction-card" data-faction="${f.factionId}">
          <div class="faction-card-header">
            <div class="faction-card-left">
              <span class="faction-card-crest">${f.crestIcon}</span>
              <div class="faction-card-title-group">
                <span class="faction-card-name">${f.name}</span>
                <span class="faction-card-score">STANDING: <strong style="color: ${f.primaryColor}">${sign} / 100</strong></span>
              </div>
            </div>
            <span class="standing-tier-pill ${tierClass}">${f.tier} (${sign})</span>
          </div>

          <div class="faction-meter-wrapper">
            <div class="faction-meter-track">
              <div class="faction-meter-center-line"></div>
              <div class="faction-meter-fill ${isPos ? 'positive' : 'negative'}" style="left: ${leftPos}%; width: ${widthPct}%;"></div>
            </div>
          </div>

          <div class="faction-perks-row">
            <span class="faction-perk-text">${tariffText}</span>
            ${dockingPill}
          </div>
          <div style="font-size: 0.65rem; color: #64748b; line-height: 1.3;">${f.perkDesc}</div>
        </div>
      `;
    }).join('');
  }

  public updateHudSectorAllegiance(): void {
    if (!this.elHudFactionBadge || !this.elHudFactionName || !this.elHudFactionCrest || !this.elHudFactionStandingTier) return;

    let factionId = 'FACTION_SOL';
    let factionName = 'SOL-PERIMETER ALLIANCE';
    let crest = '🚀';

    const secId = this.callbacks.getCurrentSectorId();
    if (secId === 2) {
      factionId = 'FACTION_HEGEMONY';
      factionName = 'VAELIC HEGEMONY (OCCUPIED)';
      crest = '🦅';
    } else if (secId === 3) {
      factionId = 'FACTION_HEGEMONY';
      factionName = 'LITHOS FORGE CLUSTER';
      crest = '🦾';
    } else if (secId === 4) {
      factionId = 'FACTION_PHORID';
      factionName = 'PHORID SPORE BIOSPHERE';
      crest = '🍄';
    } else if (secId === 5) {
      factionId = 'FACTION_KRYLL';
      factionName = 'KRYLL SCRAP EXCHANGE';
      crest = '🐀';
    }

    const standingObj = this.playerStandings.find((s: any) => s.factionId === factionId);
    const score = standingObj ? standingObj.standing : 0;
    const tier = standingObj ? standingObj.tier : 'NEUTRAL';
    const sign = score > 0 ? `+${score}` : `${score}`;

    this.elHudFactionCrest.textContent = crest;
    this.elHudFactionName.textContent = factionName;
    this.elHudFactionStandingTier.textContent = `${tier} (${sign})`;
    this.elHudFactionStandingTier.className = `standing-tier-pill tier-${tier.toLowerCase()}`;
  }

  public startTruceCountdown(durationSeconds: number = 300): void {
    this.activeTruceExpiresAt = Date.now() + durationSeconds * 1000;
    if (this.truceTimerInterval) clearInterval(this.truceTimerInterval);

    if (this.elHudTruceTimerPill) {
      this.elHudTruceTimerPill.classList.remove('hidden');
    }

    this.truceTimerInterval = setInterval(() => {
      if (!this.activeTruceExpiresAt || !this.elHudTruceTimerPill) return;
      const remainingMs = this.activeTruceExpiresAt - Date.now();
      if (remainingMs <= 0) {
        clearInterval(this.truceTimerInterval);
        this.truceTimerInterval = null;
        this.activeTruceExpiresAt = null;
        this.elHudTruceTimerPill.classList.add('hidden');
        this.callbacks.showApNotification('⚠️ DIPLOMATIC CEASEFIRE EXPIRED: Patrol drones resumed alert status.', true);
        this.audio.playApWarningSound();
        return;
      }
      const totalSec = Math.ceil(remainingMs / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      this.elHudTruceTimerPill.textContent = `🕊️ TRUCE: ${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }, 500);
  }

  public closeAlienComms(): void {
    if (this.isConvoyComms) {
      const sectorId = this.callbacks.getCurrentSectorId();
      fetch('/api/dialog/convoy/stand-down', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectorId,
          isStandDown: false,
        }),
      }).catch((e) => console.warn('[Convoy Comms] Error resetting stand-down:', e));
    }

    if (this.elAlienCommsModal) {
      this.elAlienCommsModal.classList.add('hidden');
    }
    if (this.alienTypewriterTimer) {
      clearInterval(this.alienTypewriterTimer);
      this.alienTypewriterTimer = null;
    }
    if (this.alienPortraitAnimId) {
      cancelAnimationFrame(this.alienPortraitAnimId);
      this.alienPortraitAnimId = null;
    }
    if (this.commsWaveformAnimId) {
      cancelAnimationFrame(this.commsWaveformAnimId);
      this.commsWaveformAnimId = null;
    }
    this.isAlienSpeaking = false;
    this.currentAlienNpcId = null;
    this.isConvoyComms = false;
    this.currentConvoyId = null;
    this.audio.playCommsCloseSound();

    this.callbacks.onCommsClosed?.();
  }

  public startAlienPortraitLoop(): void {
    const render = () => {
      if (!this.elAlienCommsModal || this.elAlienCommsModal.classList.contains('hidden')) {
        this.alienPortraitAnimId = null;
        return;
      }

      this.alienPortraitTime += 0.035;
      if (this.elAlienPortraitCanvas) {
        const ctx = this.elAlienPortraitCanvas.getContext('2d');
        if (ctx) {
          this.drawProceduralAlienPortrait(
            ctx,
            this.elAlienPortraitCanvas.width,
            this.elAlienPortraitCanvas.height,
            this.currentAlienSpecies,
            this.currentAlienMood,
            this.alienPortraitTime
          );
        }
      }

      this.alienPortraitAnimId = requestAnimationFrame(render);
    };

    this.alienPortraitAnimId = requestAnimationFrame(render);
  }

  public drawProceduralAlienPortrait(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    species: string,
    mood: string,
    t: number
  ): void {
    // 1. Clear with deep space canvas background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    // Starfield noise in portrait background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 20; i++) {
      const sx = ((i * 37 + 13) % (w - 20)) + 10;
      const sy = ((i * 59 + 29) % (h - 20)) + 10;
      const flicker = 0.3 + 0.7 * Math.sin(t * 2 + i);
      ctx.globalAlpha = flicker * 0.5;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1.0;

    const cx = w / 2;
    const cy = h / 2;

    switch (species.toUpperCase()) {
      case 'VAELIC': {
        // Vaelic Hegemony: Imperial crested conqueror
        const breathing = Math.sin(t * 2) * 3;
        const speakingMouth = this.isAlienSpeaking ? Math.sin(t * 18) * 5 : 0;
        const blink = Math.sin(t * 0.8) > 0.94 ? 0.1 : 1.0;

        // Flared Imperial Collar
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - 95, cy + 90);
        ctx.lineTo(cx - 110, cy - 30);
        ctx.lineTo(cx - 40, cy - 70);
        ctx.lineTo(cx + 40, cy - 70);
        ctx.lineTo(cx + 110, cy - 30);
        ctx.lineTo(cx + 95, cy + 90);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Armored Shoulders
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 120, cy + 130 + breathing);
        ctx.lineTo(cx - 60, cy + 60 + breathing);
        ctx.lineTo(cx + 60, cy + 60 + breathing);
        ctx.lineTo(cx + 120, cy + 130 + breathing);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Reptilian Skull Head
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 45, cy + 30 + breathing);
        ctx.lineTo(cx - 55, cy - 35 + breathing);
        ctx.lineTo(cx - 20, cy - 65 + breathing);
        ctx.lineTo(cx + 20, cy - 65 + breathing);
        ctx.lineTo(cx + 55, cy - 35 + breathing);
        ctx.lineTo(cx + 45, cy + 30 + breathing);
        ctx.lineTo(cx, cy + 50 + speakingMouth + breathing);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crest spines
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.moveTo(cx - 15, cy - 65 + breathing);
        ctx.lineTo(cx, cy - 95 + breathing + Math.sin(t * 3) * 2);
        ctx.lineTo(cx + 15, cy - 65 + breathing);
        ctx.fill();

        // Glowing Crimson Visor / Optics
        ctx.fillStyle = mood === 'TERRIFIED' ? '#38bdf8' : '#ef4444';
        ctx.shadowColor = mood === 'TERRIFIED' ? '#38bdf8' : '#ef4444';
        ctx.shadowBlur = 12;

        ctx.fillRect(cx - 36, cy - 18 + breathing, 24, 7 * blink);
        ctx.fillRect(cx + 12, cy - 18 + breathing, 24, 7 * blink);
        ctx.shadowBlur = 0;

        // Snout & Mandibles
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 15, cy + 25 + breathing);
        ctx.lineTo(cx, cy + 35 + speakingMouth + breathing);
        ctx.lineTo(cx + 15, cy + 25 + breathing);
        ctx.stroke();
        break;
      }

      case 'PHORID': {
        // Phorid Sporeborn: Bioluminescent fungal entity
        const pulse = 1.0 + Math.sin(t * 3) * 0.06;
        const gillGlow = Math.abs(Math.sin(t * 2));
        const blink = Math.sin(t * 1.2) > 0.92 ? 0.2 : 1.0;

        // Floating Spore Particles
        ctx.fillStyle = 'rgba(6, 182, 212, 0.7)';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 8;
        for (let i = 0; i < 14; i++) {
          const px = ((i * 43 + 20) % (w - 40)) + 20 + Math.sin(t + i) * 6;
          const py = (h - ((t * 22 + i * 35) % h));
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Stem Body
        ctx.fillStyle = '#1e1b4b';
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 35, cy + 130);
        ctx.lineTo(cx - 20, cy + 30);
        ctx.lineTo(cx + 20, cy + 30);
        ctx.lineTo(cx + 35, cy + 130);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Broad Fungal Mushroom Cap
        ctx.save();
        ctx.translate(cx, cy - 10);
        ctx.scale(pulse, pulse);

        ctx.fillStyle = '#311042';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 95, 55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pulsing bioluminescent gills underneath cap
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.4 + gillGlow * 0.5})`;
        ctx.lineWidth = 1.8;
        for (let x = -80; x <= 80; x += 12) {
          ctx.beginPath();
          ctx.moveTo(x, 15);
          ctx.lineTo(x * 0.6, 42);
          ctx.stroke();
        }

        // Concentric cap rings
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, -10, 65, 30, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Optical Nodes (Row of gentle glowing eyes)
        const eyeColors = ['#fbbf24', '#34d399', '#38bdf8', '#c084fc'];
        [-45, -15, 15, 45].forEach((ex, i) => {
          ctx.fillStyle = eyeColors[i];
          ctx.shadowColor = eyeColors[i];
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.ellipse(ex, -5, 5, 4 * blink, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.shadowBlur = 0;
        ctx.restore();
        break;
      }

      case 'KRYLL': {
        // Kryll Cartel: Rodentoid scavenger with cybernetic monocle
        const twitchEar = Math.sin(t * 6) > 0.85 ? 4 : 0;
        const twitchWhisker = Math.sin(t * 12) * 3;
        const speakJaw = this.isAlienSpeaking ? Math.sin(t * 22) * 4 : 0;
        const blink = Math.sin(t * 1.5) > 0.93 ? 0.1 : 1.0;

        // Large Pointed Ears
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        // Left Ear
        ctx.beginPath();
        ctx.moveTo(cx - 50, cy - 20);
        ctx.lineTo(cx - 95, cy - 85 + twitchEar);
        ctx.lineTo(cx - 30, cy - 60);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Right Ear (Cybernetic Antennas)
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(cx + 30, cy - 60);
        ctx.lineTo(cx + 90, cy - 85 - twitchEar);
        ctx.lineTo(cx + 50, cy - 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Furry Muzzle & Skull
        ctx.fillStyle = '#92400e';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 45, cy + 40);
        ctx.lineTo(cx - 55, cy - 25);
        ctx.lineTo(cx, cy - 50);
        ctx.lineTo(cx + 55, cy - 25);
        ctx.lineTo(cx + 45, cy + 40);
        ctx.lineTo(cx, cy + 55 + speakJaw);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Left Eye: Brass Steampunk / Cybernetic Monocle
        ctx.save();
        ctx.translate(cx - 24, cy - 10);
        ctx.fillStyle = '#b45309';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Monocle rotating green reticle
        ctx.rotate(t * 2.5);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
        ctx.moveTo(0, -10); ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.restore();

        // Right Eye: Beady Rat Eye
        ctx.fillStyle = '#020617';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx + 24, cy - 10, 8, 8 * blink, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Eye glint
        if (blink > 0.5) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx + 22, cy - 12, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Snout, Twitching Whiskers & Incisors
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 30, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Incisors
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(cx - 4, cy + 38 + speakJaw, 3.5, 7);
        ctx.fillRect(cx + 0.5, cy + 38 + speakJaw, 3.5, 7);

        // Whiskers
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.2;
        // Left Whiskers
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy + 28);
        ctx.lineTo(cx - 65, cy + 20 + twitchWhisker);
        ctx.moveTo(cx - 10, cy + 32);
        ctx.lineTo(cx - 68, cy + 35 - twitchWhisker);
        // Right Whiskers
        ctx.moveTo(cx + 10, cy + 28);
        ctx.lineTo(cx + 65, cy + 20 - twitchWhisker);
        ctx.moveTo(cx + 10, cy + 32);
        ctx.lineTo(cx + 68, cy + 35 + twitchWhisker);
        ctx.stroke();
        break;
      }

      default: {
        // Sol Alliance Diplomatic Avatar
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(cx, cy - 15, 45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(cx - 25, cy - 18, 50, 10);
        break;
      }
    }

    // CRT Scanline Sweeper
    const scanlineY = (t * 50) % h;
    ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
    ctx.fillRect(0, scanlineY, w, 3);
  }

  public startCommsWaveformLoop(): void {
    const render = () => {
      if (!this.elAlienCommsModal || this.elAlienCommsModal.classList.contains('hidden')) {
        this.commsWaveformAnimId = null;
        return;
      }

      if (this.elCommsWaveformCanvas) {
        const ctx = this.elCommsWaveformCanvas.getContext('2d');
        if (ctx) {
          this.drawCommsWaveform(
            ctx,
            this.elCommsWaveformCanvas.width,
            this.elCommsWaveformCanvas.height,
            this.alienPortraitTime
          );
        }
      }

      this.commsWaveformAnimId = requestAnimationFrame(render);
    };

    this.commsWaveformAnimId = requestAnimationFrame(render);
  }

  public drawCommsWaveform(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number
  ): void {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    const cy = h / 2;
    const isSpeaking = this.isAlienSpeaking;
    const amp = isSpeaking ? 9.0 : 2.0;

    ctx.strokeStyle = isSpeaking ? '#22d3ee' : 'rgba(34, 211, 238, 0.4)';
    ctx.lineWidth = isSpeaking ? 1.8 : 1.0;
    ctx.beginPath();

    for (let x = 0; x < w; x++) {
      const freq1 = isSpeaking ? 0.12 : 0.05;
      const freq2 = isSpeaking ? 0.28 : 0.08;
      const speed1 = isSpeaking ? 14 : 3;
      const speed2 = isSpeaking ? 22 : 5;

      const y = cy + Math.sin(x * freq1 + t * speed1) * amp * 0.7 +
                     Math.cos(x * freq2 - t * speed2) * amp * 0.3;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }
}
