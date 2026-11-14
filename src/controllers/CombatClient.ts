/**
 * CombatClient.ts
 *
 * Encapsulates the 20Hz authoritative WebSocket combat room, projectile interpolation & rendering,
 * shield bubble synchronization, player MMORPG ability hotbar & stacked vitals, 3D tactical reticle,
 * floating ARPG loot canisters, persistent wrecks, elastic tow cable, laser scrap mining,
 * escape pod simulation, clinic rescue, and killmail / bounty processing.
 */

import * as THREE from 'three';
import { ProceduralHullGenerator } from '../procgen/ProceduralHullGenerator';
import { FACTION_STYLES } from '../procgen/FactionStyles';
import { ShieldBubble, CombatVfxSystem } from '../vfx/CombatVfxSystem';
import { ShipFlightController } from '../physics/ShipFlightController';
import { AudioEngine } from '../audio/AudioEngine';

export interface CombatClientCallbacks {
  audio: AudioEngine;
  combatVfx: CombatVfxSystem;
  playerShieldBubble: ShieldBubble;
  showApNotification: (msg: string, isWarning?: boolean) => void;
  getFlightController: () => ShipFlightController;
  getScene: () => THREE.Scene;
  getCamera: () => THREE.Camera;
  getCurrentSectorId: () => number;
  setCurrentSectorId: (id: number) => void;
  getShipMesh: () => THREE.Mesh | null;
  dockShip: () => void;
  refreshFactionStandings: () => Promise<void> | void;
  startTruceCountdown: (seconds: number) => void;
  getTruceTimerInterval: () => any;
  setTruceTimerInterval: (interval: any) => void;
  setActiveTruceExpiresAt: (time: number | null) => void;
  getPlayerCredits?: () => number;
  setPlayerCredits?: (cr: number) => void;
  closeComms?: () => void;
  loadSectorScene?: (sectorId: number, seed?: number) => void;
  onCombatSnapshot?: (snapshot: any) => void;
}

export class CombatClient {
  private callbacks: CombatClientCallbacks;
  private audio: AudioEngine;
  private combatVfx: CombatVfxSystem;

  public combatSocket: WebSocket | null = null;
  public combatInputs = {
    forward: false,
    reverse: false,
    turnLeft: false,
    turnRight: false,
    brake: false,
    firePrimary: false,
    fireTactical: false,
    afterburner: false,
    activeWeaponId: 'PULSE' as 'PULSE' | 'PLASMA' | 'FLAK',
  };

  // Targeting & Reticle
  public primaryDroneTarget: {
    id: string;
    type?: string;
    x: number;
    z: number;
    hp: number;
    maxHp: number;
    shields: number;
    maxShields: number;
    name: string;
    faction?: string;
    factionId?: string;
    isConvoyHauler?: boolean;
    convoyId?: string;
    warpChargeRemaining?: number;
    isWarpSpooling?: boolean;
    isWarpInterrupted?: boolean;
    cargoManifest?: any[];
  } | null = null;
  public availableDrones: any[] = [];
  public targetLockIndex: number = 0;

  // Player vitals tracking
  public lastPlayerShields: number = 100;
  public lastPlayerMaxShields: number = 100;

  // Meshes & Entities
  public droneMeshes: Map<string, THREE.Mesh> = new Map();
  public droneShieldBubbles: Map<string, ShieldBubble> = new Map();
  public haulerMeshes: Map<string, THREE.Group> = new Map();
  public haulerShieldBubbles: Map<string, ShieldBubble> = new Map();
  // Day 34: Wingman Squadron Meshes & Shield Bubbles
  public wingmanMeshes: Map<string, THREE.Group | THREE.Mesh> = new Map();
  public wingmanShieldBubbles: Map<string, ShieldBubble> = new Map();
  public targetedEntityId: string | null = null;
  public activeSquadronOrder: string = 'FORMATION_FOLLOW';

  public projectileMeshes: Map<string, THREE.Mesh> = new Map();
  public containerMeshes: Map<string, THREE.Group> = new Map();
  public activeLootContainers: Map<string, any> = new Map();
  public targetedContainerId: string | null = null;
  public activeLootModalContainer: any | null = null;

  public wreckMeshes: Map<string, THREE.Group> = new Map();
  public activeWrecks: Map<string, any> = new Map();
  public scavengerMeshes: Map<string, THREE.Group> = new Map();

  // Escape Pod & Clinic
  public escapePodMesh: THREE.Group | null = null;
  public isEscapePod: boolean = false;
  private lastKlaxonTime: number = 0;

  // Tow Cable & Mining Laser
  public towCableMesh: THREE.Line | null = null;
  public salvageBeamMesh: THREE.Group | null = null;
  public isMiningLaserActive: boolean = false;
  public currentTowedWreckId: string | null = null;
  public targetedWreckId: string | null = null;
  public tetheredStationWreck: any | null = null;

  // Killmail & Bounty
  public activeKillmailData: any | null = null;
  public selectedBountyAmount: number = 5000;

  // Geometries & Materials
  private projectileGeom = new THREE.CylinderGeometry(0.16, 0.16, 2.0, 6);
  private projectileSphereGeom = new THREE.SphereGeometry(0.42, 8, 8);
  private projectileFlakGeom = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 5);
  private projectileMatCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  private projectileMatRed = new THREE.MeshBasicMaterial({ color: 0xff2a5f });
  private projectileMatEmerald = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  private projectileMatAmber = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

  // DOM Lookups
  private elTelemetryShields: HTMLElement | null = null;
  private elTelemetryHull: HTMLElement | null = null;
  private elTelemetryEnergy: HTMLElement | null = null;
  private elTelemetryCombat: HTMLElement | null = null;

  private elTacticalReticle: HTMLElement | null = null;
  private elReticleName: HTMLElement | null = null;
  private elReticleShieldFill: HTMLElement | null = null;
  private elReticleHullFill: HTMLElement | null = null;
  private elReticleRange: HTMLElement | null = null;

  private elVitalShieldBar: HTMLElement | null = null;
  private elVitalShieldText: HTMLElement | null = null;
  private elVitalHullBar: HTMLElement | null = null;
  private elVitalHullText: HTMLElement | null = null;
  private elVitalEnergyBar: HTMLElement | null = null;
  private elVitalEnergyText: HTMLElement | null = null;

  private elSlotHigh1: HTMLElement | null = null;
  private elSlotHigh2: HTMLElement | null = null;
  private elSlotMid1: HTMLElement | null = null;
  private elSlotMid2: HTMLElement | null = null;

  private elTargetTelemetryHud: HTMLElement | null = null;
  private elTargetName: HTMLElement | null = null;
  private elTargetFaction: HTMLElement | null = null;
  private elTargetDistance: HTMLElement | null = null;
  private elTargetShieldBar: HTMLElement | null = null;
  private elTargetShieldVal: HTMLElement | null = null;
  private elTargetHullBar: HTMLElement | null = null;
  private elTargetHullVal: HTMLElement | null = null;
  // Day 23 Convoy & Tactical Reticle
  private elTargetConvoyHud: HTMLElement | null = null;
  private elConvoyWarpBadge: HTMLElement | null = null;
  private elConvoyWarpBarFill: HTMLElement | null = null;
  private elConvoyCargoItems: HTMLElement | null = null;
  private elReticleWarpBadge: HTMLElement | null = null;

  private elTargetQuickActions: HTMLElement | null = null;
  private btnHudSalvageBeam: HTMLElement | null = null;
  private btnHudTetherWreck: HTMLElement | null = null;
  private elTowCableHud: HTMLElement | null = null;
  private elTowTargetName: HTMLElement | null = null;
  private elTowDistMetric: HTMLElement | null = null;
  private elTowTensionBadge: HTMLElement | null = null;
  private btnHudReleaseTow: HTMLElement | null = null;

  private elEscapePodHud: HTMLElement | null = null;
  private elPodTimerClock: HTMLElement | null = null;
  public modalClinicRescue: HTMLElement | null = null;
  private btnClaimFrigate: HTMLElement | null = null;

  private elLootPromptHud: HTMLElement | null = null;
  private elLootPromptText: HTMLElement | null = null;
  public modalContainerLoot: HTMLElement | null = null;
  private modalLootRarity: HTMLElement | null = null;
  private modalLootTitle: HTMLElement | null = null;
  private elLootDistanceDisplay: HTMLElement | null = null;
  private elLootItemCount: HTMLElement | null = null;
  private elLootItemsList: HTMLElement | null = null;
  private btnCloseLoot: HTMLElement | null = null;
  private btnLootAll: HTMLElement | null = null;

  private modalKillmail: HTMLElement | null = null;
  private elKmTimestamp: HTMLElement | null = null;
  private elKmLossValuation: HTMLElement | null = null;
  private elKmKillerName: HTMLElement | null = null;
  private elKmSectorName: HTMLElement | null = null;
  private elKmTotalLoss: HTMLElement | null = null;
  private elKmDroppedSummary: HTMLElement | null = null;
  private btnPostBounty: HTMLElement | null = null;
  private elKmShareRow: HTMLElement | null = null;
  private elKmShareUrl: HTMLInputElement | null = null;
  private btnCopyKmUrl: HTMLElement | null = null;
  private elKmCopyToast: HTMLElement | null = null;
  private btnCloseKm: HTMLElement | null = null;

  // Station Salvage Bay elements
  private elSalvagePlayerCredits: HTMLElement | null = null;
  private elSalvageTetherStatus: HTMLElement | null = null;
  private elSalvageEmptyCard: HTMLElement | null = null;
  private elSalvageWreckCard: HTMLElement | null = null;
  private elSalvageWreckFaction: HTMLElement | null = null;
  private elSalvageWreckTitle: HTMLElement | null = null;
  private elSalvageWreckClass: HTMLElement | null = null;
  private elSalvageWreckScrap: HTMLElement | null = null;
  private elSalvageWreckIntactness: HTMLElement | null = null;
  private elSalvageWreckVal: HTMLElement | null = null;
  private btnDismantleWreck: HTMLElement | null = null;
  private btnRefurbishWreck: HTMLElement | null = null;
  private elSalvageDerelictsList: HTMLElement | null = null;
  private elSalvageSweepCount: HTMLElement | null = null;

  private elHudTruceTimerPill: HTMLElement | null = null;

  // Day 25 Skirmish & Escort
  public skirmishBeacon: { id: string; name: string; x: number; z: number; radius: number; skirmishSectorId: number } | null = null;
  public skirmishBeaconMesh: THREE.Group | null = null;
  public isSkirmishArena: boolean = false;
  public skirmishScores: { FACTION_HEGEMONY: number; FACTION_KRYLL: number } = { FACTION_HEGEMONY: 100, FACTION_KRYLL: 100 };
  public playerAllegiance: string | null = null;
  public playerCombatBonds: number = 0;
  public activeEscortHauler: any | null = null;

  // Day 25 DOM Elements
  private btnHudEngageSkirmish: HTMLElement | null = null;
  private elSkirmishScoreHud: HTMLElement | null = null;
  private elSkirmishHegemonyBar: HTMLElement | null = null;
  private elSkirmishHegemonyTickets: HTMLElement | null = null;
  private elSkirmishKryllBar: HTMLElement | null = null;
  private elSkirmishKryllTickets: HTMLElement | null = null;
  private elSkirmishPlayerAllegiance: HTMLElement | null = null;
  private elSkirmishPlayerBonds: HTMLElement | null = null;

  private elEscortTelemetryHud: HTMLElement | null = null;
  private elEscortTetherStatus: HTMLElement | null = null;
  private elEscortHaulerName: HTMLElement | null = null;
  private elEscortShieldBar: HTMLElement | null = null;
  private elEscortShieldVal: HTMLElement | null = null;
  private elEscortHullBar: HTMLElement | null = null;
  private elEscortHullVal: HTMLElement | null = null;
  private btnEscortClaimBounty: HTMLElement | null = null;

  private modalSkirmishAllegiance: HTMLElement | null = null;
  private btnAllegianceHegemony: HTMLElement | null = null;
  private btnAllegianceKryll: HTMLElement | null = null;

  constructor(callbacks: CombatClientCallbacks) {
    this.callbacks = callbacks;
    this.audio = callbacks.audio;
    this.combatVfx = callbacks.combatVfx;
    this.initDOM();
  }

  private initDOM(): void {
    this.elTelemetryShields = document.getElementById('val-telemetry-shields');
    this.elTelemetryHull = document.getElementById('val-telemetry-hull');
    this.elTelemetryEnergy = document.getElementById('val-telemetry-energy');
    this.elTelemetryCombat = document.getElementById('val-telemetry-combat');

    this.elTacticalReticle = document.getElementById('tactical-target-reticle') || document.getElementById('tactical-reticle');
    this.elReticleName = document.getElementById('reticle-name');
    this.elReticleShieldFill = document.getElementById('reticle-shield-fill');
    this.elReticleHullFill = document.getElementById('reticle-hull-fill');
    this.elReticleRange = document.getElementById('reticle-range');
    this.elReticleWarpBadge = document.getElementById('reticle-warp-badge');

    this.elVitalShieldBar = document.getElementById('vital-shield-bar');
    this.elVitalShieldText = document.getElementById('vital-shield-text');
    this.elVitalHullBar = document.getElementById('vital-hull-bar');
    this.elVitalHullText = document.getElementById('vital-hull-text');
    this.elVitalEnergyBar = document.getElementById('vital-energy-bar');
    this.elVitalEnergyText = document.getElementById('vital-energy-text');

    this.elSlotHigh1 = document.getElementById('slot-high-1');
    this.elSlotHigh2 = document.getElementById('slot-high-2');
    this.elSlotMid1 = document.getElementById('slot-mid-1');
    this.elSlotMid2 = document.getElementById('slot-mid-2');

    this.elTargetTelemetryHud = document.getElementById('target-telemetry-hud');
    this.elTargetName = document.getElementById('target-name');
    this.elTargetFaction = document.getElementById('target-faction');
    this.elTargetDistance = document.getElementById('target-distance');
    this.elTargetShieldBar = document.getElementById('target-shield-bar');
    this.elTargetShieldVal = document.getElementById('target-shield-val');
    this.elTargetHullBar = document.getElementById('target-hull-bar');
    this.elTargetHullVal = document.getElementById('target-hull-val');

    this.elTargetConvoyHud = document.getElementById('target-convoy-hud');
    this.elConvoyWarpBadge = document.getElementById('convoy-warp-badge');
    this.elConvoyWarpBarFill = document.getElementById('convoy-warp-bar-fill');
    this.elConvoyCargoItems = document.getElementById('convoy-cargo-items');

    this.elTargetQuickActions = document.getElementById('target-quick-actions');
    this.btnHudSalvageBeam = document.getElementById('btn-hud-salvage-beam');
    this.btnHudTetherWreck = document.getElementById('btn-hud-tether-wreck');
    this.elTowCableHud = document.getElementById('tow-cable-hud');
    this.elTowTargetName = document.getElementById('tow-target-name');
    this.elTowDistMetric = document.getElementById('tow-dist-metric');
    this.elTowTensionBadge = document.getElementById('tow-tension-badge');
    this.btnHudReleaseTow = document.getElementById('btn-hud-release-tow');

    this.elEscapePodHud = document.getElementById('escape-pod-hud');
    this.elPodTimerClock = document.getElementById('pod-timer-clock');
    this.modalClinicRescue = document.getElementById('clinic-rescue-modal');
    this.btnClaimFrigate = document.getElementById('btn-claim-frigate');

    this.elLootPromptHud = document.getElementById('loot-prompt-hud');
    this.elLootPromptText = document.getElementById('loot-prompt-text');
    this.modalContainerLoot = document.getElementById('container-loot-modal');
    this.modalLootRarity = document.getElementById('loot-modal-rarity');
    this.modalLootTitle = document.getElementById('loot-modal-title');
    this.elLootDistanceDisplay = document.getElementById('loot-distance-display');
    this.elLootItemCount = document.getElementById('loot-item-count');
    this.elLootItemsList = document.getElementById('loot-items-list');
    this.btnCloseLoot = document.getElementById('btn-close-loot');
    this.btnLootAll = document.getElementById('btn-loot-all');

    this.modalKillmail = document.getElementById('killmail-modal');
    this.elKmTimestamp = document.getElementById('km-timestamp');
    this.elKmLossValuation = document.getElementById('km-loss-valuation');
    this.elKmKillerName = document.getElementById('km-killer-name');
    this.elKmSectorName = document.getElementById('km-sector-name');
    this.elKmTotalLoss = document.getElementById('km-total-loss');
    this.elKmDroppedSummary = document.getElementById('km-dropped-summary');
    this.btnPostBounty = document.getElementById('btn-post-bounty');
    this.elKmShareRow = document.getElementById('km-share-link-row');
    this.elKmShareUrl = document.getElementById('km-share-url') as HTMLInputElement | null;
    this.btnCopyKmUrl = document.getElementById('btn-copy-km-url');
    this.elKmCopyToast = document.getElementById('km-copy-toast');
    this.btnCloseKm = document.getElementById('btn-close-km');

    this.elSalvagePlayerCredits = document.getElementById('salvage-player-credits');
    this.elSalvageTetherStatus = document.getElementById('salvage-tether-status');
    this.elSalvageEmptyCard = document.getElementById('salvage-empty-card');
    this.elSalvageWreckCard = document.getElementById('salvage-wreck-card');
    this.elSalvageWreckFaction = document.getElementById('salvage-wreck-faction');
    this.elSalvageWreckTitle = document.getElementById('salvage-wreck-title');
    this.elSalvageWreckClass = document.getElementById('salvage-wreck-class');
    this.elSalvageWreckScrap = document.getElementById('salvage-wreck-scrap');
    this.elSalvageWreckIntactness = document.getElementById('salvage-wreck-intactness');
    this.elSalvageWreckVal = document.getElementById('salvage-wreck-val');
    this.btnDismantleWreck = document.getElementById('btn-dismantle-wreck');
    this.btnRefurbishWreck = document.getElementById('btn-refurbish-wreck');
    this.elSalvageDerelictsList = document.getElementById('salvage-derelicts-list');
    this.elSalvageSweepCount = document.getElementById('salvage-sweep-count');

    this.elHudTruceTimerPill = document.getElementById('hud-truce-timer-pill');

    // Day 25 Skirmish & Escort DOM Lookups
    this.btnHudEngageSkirmish = document.getElementById('btn-hud-engage-skirmish');
    this.elSkirmishScoreHud = document.getElementById('skirmish-score-hud');
    this.elSkirmishHegemonyBar = document.getElementById('skirmish-hegemony-bar');
    this.elSkirmishHegemonyTickets = document.getElementById('skirmish-hegemony-tickets');
    this.elSkirmishKryllBar = document.getElementById('skirmish-kryll-bar');
    this.elSkirmishKryllTickets = document.getElementById('skirmish-kryll-tickets');
    this.elSkirmishPlayerAllegiance = document.getElementById('skirmish-player-allegiance');
    this.elSkirmishPlayerBonds = document.getElementById('skirmish-player-bonds');

    this.elEscortTelemetryHud = document.getElementById('escort-telemetry-hud');
    this.elEscortTetherStatus = document.getElementById('escort-tether-status');
    this.elEscortHaulerName = document.getElementById('escort-hauler-name');
    this.elEscortShieldBar = document.getElementById('escort-shield-bar');
    this.elEscortShieldVal = document.getElementById('escort-shield-val');
    this.elEscortHullBar = document.getElementById('escort-hull-bar');
    this.elEscortHullVal = document.getElementById('escort-hull-val');
    this.btnEscortClaimBounty = document.getElementById('btn-escort-claim-bounty');

    this.modalSkirmishAllegiance = document.getElementById('skirmish-allegiance-modal');
    this.btnAllegianceHegemony = document.getElementById('btn-allegiance-hegemony');
    this.btnAllegianceKryll = document.getElementById('btn-allegiance-kryll');

    // Attach listeners
    this.btnHudEngageSkirmish?.addEventListener('click', () => this.engageSkirmish());
    this.btnAllegianceHegemony?.addEventListener('click', () => this.declareAllegiance('FACTION_HEGEMONY'));
    this.btnAllegianceKryll?.addEventListener('click', () => this.declareAllegiance('FACTION_KRYLL'));
    this.btnEscortClaimBounty?.addEventListener('click', () => this.claimEscortBounty());

    this.btnCloseLoot?.addEventListener('click', () => this.closeContainerLootModal());
    this.btnLootAll?.addEventListener('click', () => this.lootAllCurrentContainer());

    this.btnDismantleWreck?.addEventListener('click', () => this.dismantleTetheredWreck());
    this.btnRefurbishWreck?.addEventListener('click', () => this.refurbishTetheredWreck());
    this.btnHudSalvageBeam?.addEventListener('click', () => this.toggleSalvageMining());
    this.btnHudTetherWreck?.addEventListener('click', () => this.toggleTowTether());
    this.btnHudReleaseTow?.addEventListener('click', () => this.toggleTowTether());

    this.btnClaimFrigate?.addEventListener('click', () => this.claimReplacementFrigate());
    this.btnPostBounty?.addEventListener('click', () => this.postRevengeBounty());
    this.btnCloseKm?.addEventListener('click', () => {
      if (this.modalKillmail) this.modalKillmail.classList.add('hidden');
    });
    this.btnCopyKmUrl?.addEventListener('click', () => {
      if (this.elKmShareUrl) {
        navigator.clipboard.writeText(this.elKmShareUrl.value);
        if (this.elKmCopyToast) {
          this.elKmCopyToast.classList.remove('hidden');
          setTimeout(() => this.elKmCopyToast?.classList.add('hidden'), 2000);
        }
      }
    });
  }

  public initCombatWebSocket(sectorId: number): void {
    if (this.combatSocket) {
      try {
        this.combatSocket.close();
      } catch (e) {}
      this.combatSocket = null;
    }

    const scene = this.callbacks.getScene();

    // Clean up old drone meshes and projectiles
    for (const mesh of this.droneMeshes.values()) {
      scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.droneMeshes.clear();
    for (const sb of this.droneShieldBubbles.values()) {
      scene.remove(sb.mesh);
      sb.dispose();
    }
    this.droneShieldBubbles.clear();

    // Clean up old hauler meshes & shield bubbles
    for (const hGroup of this.haulerMeshes.values()) {
      scene.remove(hGroup);
      hGroup.traverse((child) => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
      });
    }
    this.haulerMeshes.clear();
    for (const sb of this.haulerShieldBubbles.values()) {
      scene.remove(sb.mesh);
      sb.dispose();
    }
    this.haulerShieldBubbles.clear();

    // Day 34: Clean up wingman meshes & shield bubbles
    for (const wMesh of this.wingmanMeshes.values()) {
      scene.remove(wMesh);
      wMesh.traverse((child) => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
      });
    }
    this.wingmanMeshes.clear();
    for (const sb of this.wingmanShieldBubbles.values()) {
      scene.remove(sb.mesh);
      sb.dispose();
    }
    this.wingmanShieldBubbles.clear();

    for (const pMesh of this.projectileMeshes.values()) {
      scene.remove(pMesh);
    }
    this.projectileMeshes.clear();

    if (this.skirmishBeaconMesh) {
      scene.remove(this.skirmishBeaconMesh);
      this.skirmishBeaconMesh = null;
    }
    this.skirmishBeacon = null;

    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:3000/ws/combat?playerId=acc_sol_captain&sectorId=${sectorId}`;

    try {
      this.combatSocket = new WebSocket(wsUrl);

      this.combatSocket.onopen = () => {
        console.log(`[CombatClient] Connected to Sector ${sectorId} 20Hz combat room.`);
        if (this.elTelemetryCombat) {
          this.elTelemetryCombat.textContent = 'ONLINE // 20Hz';
          this.elTelemetryCombat.style.color = '#38bdf8';
        }
      };

      this.combatSocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'TICK_SNAPSHOT') {
            this.handleCombatSnapshot(msg);
          } else if (msg.type === 'KILLMAIL_NOTIFICATION') {
            this.audio.playShipExplosionSound();
            this.openKillmailModal(msg.killmail);
          } else if (msg.type === 'S_TACTICAL_ORDER_ACK') {
            this.activeSquadronOrder = msg.order;
          }
        } catch (err) {
          console.error('[CombatClient] Parse error:', err);
        }
      };

      this.combatSocket.onclose = () => {
        console.warn(`[CombatClient] Disconnected from Sector ${sectorId}`);
      };

      this.combatSocket.onerror = (err) => {
        console.warn('[CombatClient] Socket error:', err);
      };
    } catch (err) {
      console.error('[CombatClient] Failed to connect:', err);
    }
  }

  public sendCombatInputs(): void {
    if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
      const inputs = { ...this.combatInputs };
      if (this.isEscapePod) {
        inputs.firePrimary = false;
        inputs.fireTactical = false;
      }
      this.combatSocket.send(
        JSON.stringify({
          type: 'INPUT',
          inputs,
        })
      );
    }
  }

  // Day 34: Tactical Order WebSocket Dispatch
  public sendTacticalOrder(order: string, targetEntityId?: string): void {
    if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
      this.activeSquadronOrder = order;
      this.combatSocket.send(
        JSON.stringify({
          type: 'C_TACTICAL_ORDER',
          order,
          targetEntityId: targetEntityId || this.targetedEntityId || undefined,
        })
      );
    }
  }

  // Day 35: Signature Fleet Ability Dispatch
  private lastEscortAlarmTime: number = 0;
  public sendTriggerAbility(slot: number, targetEntityId?: string): void {
    if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
      this.combatSocket.send(
        JSON.stringify({
          type: 'C_TRIGGER_ABILITY',
          slot,
          targetEntityId: targetEntityId || this.targetedEntityId || undefined,
        })
      );
    }
  }

  public handleCombatSnapshot(snapshot: any): void {
    this.callbacks.onCombatSnapshot?.(snapshot);
    const scene = this.callbacks.getScene();
    const flightController = this.callbacks.getFlightController();
    const shipMesh = this.callbacks.getShipMesh();

    // 1. Player Telemetry & Stacked Vitals Update
    const playerEntity = snapshot.entities.find((e: any) => e.type === 'PLAYER');
    if (playerEntity) {
      this.lastPlayerShields = playerEntity.shields;
      this.lastPlayerMaxShields = playerEntity.maxShields;

      if (this.elTelemetryShields) {
        this.elTelemetryShields.textContent = `${playerEntity.shields} / ${playerEntity.maxShields}`;
      }
      if (this.elTelemetryHull) {
        this.elTelemetryHull.textContent = `${playerEntity.hp} / ${playerEntity.maxHp}`;
        this.elTelemetryHull.style.color = playerEntity.hp < 30 ? '#ef4444' : '#10b981';
      }
      if (this.elTelemetryEnergy) {
        this.elTelemetryEnergy.textContent = `${Math.round(playerEntity.energy)} / ${playerEntity.maxEnergy}`;
      }

      // Update MMORPG Stacked Vitals
      if (this.elVitalShieldBar) {
        const sPct = Math.max(0, Math.min(100, (playerEntity.shields / playerEntity.maxShields) * 100));
        this.elVitalShieldBar.style.width = `${sPct}%`;
      }
      if (this.elVitalShieldText) {
        this.elVitalShieldText.textContent = `${playerEntity.shields} / ${playerEntity.maxShields}`;
      }
      if (this.elVitalHullBar) {
        const hPct = Math.max(0, Math.min(100, (playerEntity.hp / playerEntity.maxHp) * 100));
        this.elVitalHullBar.style.width = `${hPct}%`;
        this.elVitalHullBar.style.background = playerEntity.hp < 30 ? '#ef4444' : 'linear-gradient(90deg, #059669, #10b981)';
      }
      if (this.elVitalHullText) {
        this.elVitalHullText.textContent = `${playerEntity.hp} / ${playerEntity.maxHp}`;
      }
      if (this.elVitalEnergyBar) {
        const ePct = Math.max(0, Math.min(100, (playerEntity.energy / playerEntity.maxEnergy) * 100));
        this.elVitalEnergyBar.style.width = `${ePct}%`;
      }
      if (this.elVitalEnergyText) {
        this.elVitalEnergyText.textContent = `${Math.round(playerEntity.energy)} / ${playerEntity.maxEnergy}`;
      }

      // Hotbar energy cost states
      if (this.elSlotHigh1) {
        if (playerEntity.energy < 8) this.elSlotHigh1.classList.add('insufficient-energy');
        else this.elSlotHigh1.classList.remove('insufficient-energy');
      }
      if (this.elSlotHigh2) {
        if (playerEntity.energy < 22) this.elSlotHigh2.classList.add('insufficient-energy');
        else this.elSlotHigh2.classList.remove('insufficient-energy');
      }
      if (this.elSlotMid1) {
        if (playerEntity.energy < 10) this.elSlotMid1.classList.add('insufficient-energy');
        else this.elSlotMid1.classList.remove('insufficient-energy');
      }
      if (this.elSlotMid2) {
        if (playerEntity.energy < 18) this.elSlotMid2.classList.add('insufficient-energy');
        else this.elSlotMid2.classList.remove('insufficient-energy');
      }

      // Check Escape Pod state
      const wasEscapePod = this.isEscapePod;
      this.isEscapePod = !!playerEntity.isEscapePod || playerEntity.hullClass === 'ESCAPE_POD';

      if (this.isEscapePod) {
        if (!wasEscapePod) {
          this.audio.playShipExplosionSound();
          if (shipMesh) shipMesh.visible = false;
          if (!this.escapePodMesh) {
            this.escapePodMesh = this.createEscapePodMesh();
            scene.add(this.escapePodMesh);
          }
          this.escapePodMesh.visible = true;
        }

        // Keep escape pod mesh positioned at ship position
        if (this.escapePodMesh) {
          this.escapePodMesh.position.copy(flightController.position);
          this.escapePodMesh.rotation.y = flightController.yaw;
        }

        // Show Escape Pod HUD & timer
        if (this.elEscapePodHud) {
          this.elEscapePodHud.classList.remove('hidden');
          const sec = typeof playerEntity.lifeSupportSeconds === 'number' ? playerEntity.lifeSupportSeconds : 300;
          const mins = Math.floor(sec / 60);
          const remSec = Math.floor(sec % 60);
          if (this.elPodTimerClock) {
            this.elPodTimerClock.textContent = `${mins.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`;
          }

          if (sec <= 60) {
            this.elEscapePodHud.classList.add('critical');
            const now = Date.now();
            if (now - this.lastKlaxonTime > 3000) {
              this.lastKlaxonTime = now;
              this.audio.playKlaxonSound();
            }
          } else {
            this.elEscapePodHud.classList.remove('critical');
          }
        }
      } else {
        if (wasEscapePod) {
          if (this.escapePodMesh) this.escapePodMesh.visible = false;
          if (shipMesh) shipMesh.visible = true;
          if (this.elEscapePodHud) this.elEscapePodHud.classList.add('hidden');
        }
      }
    }

    // 2. Drone Mesh & Forcefield Shield Bubble Synchronization
    const drones = snapshot.entities.filter((e: any) => e.type === 'DRONE' && e.state !== 'DESTROYED');
    const droneIds = new Set(drones.map((d: any) => d.id));

    // Remove defunct meshes & shield bubbles
    for (const [id, mesh] of this.droneMeshes.entries()) {
      if (!droneIds.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        this.droneMeshes.delete(id);
      }
    }
    for (const [id, sb] of this.droneShieldBubbles.entries()) {
      if (!droneIds.has(id)) {
        scene.remove(sb.mesh);
        sb.dispose();
        this.droneShieldBubbles.delete(id);
      }
    }

    // Update or spawn drones
    let nearestDrone: any = null;
    let minDroneDist = Infinity;

    for (const drone of drones) {
      let mesh = this.droneMeshes.get(drone.id);
      if (!mesh) {
        const droneStyle = FACTION_STYLES.FACTION_VAELIC;
        const res = ProceduralHullGenerator.generate({
          seed: drone.hullSeed || 98765,
          faction: droneStyle,
        });

        const mat = new THREE.MeshStandardMaterial({
          color: droneStyle.palette.primary,
          roughness: 0.35,
          metalness: 0.85,
          flatShading: true,
          emissive: droneStyle.palette.engineGlow,
          emissiveIntensity: 0.4,
        });

        mesh = new THREE.Mesh(res.geometry, mat);
        mesh.scale.set(0.9, 0.9, 0.9);
        scene.add(mesh);
        this.droneMeshes.set(drone.id, mesh);
      }

      // Smooth position lerp
      mesh.position.x = mesh.position.x + (drone.x - mesh.position.x) * 0.45;
      mesh.position.z = mesh.position.z + (drone.z - mesh.position.z) * 0.45;
      mesh.rotation.y = drone.yaw;

      // Update 3D Forcefield Shield Bubble for this drone
      let sb = this.droneShieldBubbles.get(drone.id);
      if (!sb) {
        sb = new ShieldBubble(4.2, true);
        scene.add(sb.mesh);
        this.droneShieldBubbles.set(drone.id, sb);
      }
      sb.update(0.05, mesh.position, drone.shields, drone.maxShields);

      const pPos = flightController.position;
      const dist = Math.sqrt((drone.x - pPos.x) ** 2 + (drone.z - pPos.z) ** 2);
      if (dist < minDroneDist) {
        minDroneDist = dist;
        nearestDrone = drone;
      }
    }

    // 2b. Day 23: Convoy Bulk Hauler Synchronization
    const haulers = snapshot.entities.filter((e: any) => (e.type === 'HAULER' || e.isConvoyHauler) && e.state !== 'DESTROYED');
    const haulerIds = new Set(haulers.map((h: any) => h.id));

    for (const [id, hGroup] of this.haulerMeshes.entries()) {
      if (!haulerIds.has(id)) {
        scene.remove(hGroup);
        hGroup.traverse((c) => {
          if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
        });
        this.haulerMeshes.delete(id);
      }
    }
    for (const [id, sb] of this.haulerShieldBubbles.entries()) {
      if (!haulerIds.has(id)) {
        scene.remove(sb.mesh);
        sb.dispose();
        this.haulerShieldBubbles.delete(id);
      }
    }

    let nearestHauler: any = null;
    let minHaulerDist = Infinity;

    for (const hauler of haulers) {
      let hGroup = this.haulerMeshes.get(hauler.id);
      if (!hGroup) {
        hGroup = this.createHaulerMesh(hauler.factionId);
        scene.add(hGroup);
        this.haulerMeshes.set(hauler.id, hGroup);
      }

      hGroup.position.x = hGroup.position.x + (hauler.x - hGroup.position.x) * 0.45;
      hGroup.position.z = hGroup.position.z + (hauler.z - hGroup.position.z) * 0.45;
      hGroup.rotation.y = hauler.yaw;

      // Hauler shield bubble (larger radius 7.5u)
      let sb = this.haulerShieldBubbles.get(hauler.id);
      if (!sb) {
        sb = new ShieldBubble(7.5, true);
        scene.add(sb.mesh);
        this.haulerShieldBubbles.set(hauler.id, sb);
      }
      sb.update(0.05, hGroup.position, hauler.shields, hauler.maxShields);

      const pPos = flightController.position;
      const dist = Math.sqrt((hauler.x - pPos.x) ** 2 + (hauler.z - pPos.z) ** 2);
      if (dist < minHaulerDist) {
        minHaulerDist = dist;
        nearestHauler = hauler;
      }
    }

    // Combined target selection (drones and haulers)
    const combatTargets = [...drones, ...haulers];
    this.availableDrones = combatTargets;

    if (combatTargets.length > 0) {
      if (this.targetLockIndex >= combatTargets.length) this.targetLockIndex = 0;
      this.primaryDroneTarget = combatTargets[this.targetLockIndex] || (minHaulerDist < minDroneDist ? nearestHauler : nearestDrone);
      this.targetedEntityId = this.primaryDroneTarget?.id || null;
    } else {
      this.primaryDroneTarget = null;
      this.targetedEntityId = null;
    }

    // Day 34: Wingman Squadron Vessel Synchronization
    const wingmen = snapshot.entities.filter((e: any) => e.type === 'WINGMAN' && e.state !== 'DESTROYED');
    const wingmanIds = new Set(wingmen.map((w: any) => w.id));

    for (const [id, wMesh] of this.wingmanMeshes.entries()) {
      if (!wingmanIds.has(id)) {
        scene.remove(wMesh);
        wMesh.traverse((child) => {
          if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
        });
        this.wingmanMeshes.delete(id);
      }
    }
    for (const [id, sb] of this.wingmanShieldBubbles.entries()) {
      if (!wingmanIds.has(id)) {
        scene.remove(sb.mesh);
        sb.dispose();
        this.wingmanShieldBubbles.delete(id);
      }
    }

    for (const wm of wingmen) {
      let mesh = this.wingmanMeshes.get(wm.id);
      if (!mesh) {
        let factionStyle = FACTION_STYLES.FACTION_SOL;
        if (wm.factionId === 'FACTION_VAELIC') factionStyle = FACTION_STYLES.FACTION_VAELIC;
        else if (wm.factionId === 'FACTION_KRYLL') factionStyle = FACTION_STYLES.FACTION_KRYLL;

        const res = ProceduralHullGenerator.generate({
          seed: wm.hullSeed || 1000 + (wm.wingmanSlot || 1),
          faction: factionStyle,
        });

        const mat = new THREE.MeshStandardMaterial({
          color: factionStyle.palette.primary,
          roughness: 0.35,
          metalness: 0.85,
          flatShading: true,
          emissive: '#0284c7',
          emissiveIntensity: 0.4,
        });

        const m = new THREE.Mesh(res.geometry, mat);
        m.scale.set(0.9, 0.9, 0.9);
        scene.add(m);
        this.wingmanMeshes.set(wm.id, m);
        mesh = m;
      }

      mesh.position.x += (wm.x - mesh.position.x) * 0.45;
      mesh.position.z += (wm.z - mesh.position.z) * 0.45;
      mesh.rotation.y = wm.yaw;

      let sb = this.wingmanShieldBubbles.get(wm.id);
      if (!sb) {
        sb = new ShieldBubble(4.2, true);
        scene.add(sb.mesh);
        this.wingmanShieldBubbles.set(wm.id, sb);
      }
      sb.update(0.05, mesh.position, wm.shields, wm.maxShields);

      if (wm.tacticalOrder) {
        this.activeSquadronOrder = wm.tacticalOrder;
      }
    }

    // 2c. Scavenger Vessel Synchronization
    const scavengers = snapshot.entities.filter((e: any) => e.type === 'SCAVENGER' && e.state !== 'DESTROYED');
    const scavengerIds = new Set(scavengers.map((s: any) => s.id));

    for (const [id, mesh] of this.scavengerMeshes.entries()) {
      if (!scavengerIds.has(id)) {
        scene.remove(mesh);
        mesh.traverse((c) => {
          if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
        });
        this.scavengerMeshes.delete(id);
      }
    }

    for (const scav of scavengers) {
      let mesh = this.scavengerMeshes.get(scav.id);
      if (!mesh) {
        mesh = this.createScavengerMesh();
        scene.add(mesh);
        this.scavengerMeshes.set(scav.id, mesh);
      }

      mesh.position.x = mesh.position.x + (scav.x - mesh.position.x) * 0.45;
      mesh.position.z = mesh.position.z + (scav.z - mesh.position.z) * 0.45;
      mesh.rotation.y = scav.yaw;
    }

    if (this.elTelemetryCombat) {
      if (drones.length > 0 || haulers.length > 0) {
        const convoySuffix = haulers.length > 0 ? ` [${haulers.length} CONVOY]` : '';
        this.elTelemetryCombat.textContent = `ALERT: ${drones.length} HOSTILE${convoySuffix}`;
        this.elTelemetryCombat.style.color = '#ef4444';
      } else {
        this.elTelemetryCombat.textContent = 'CLEAR // 20Hz';
        this.elTelemetryCombat.style.color = '#38bdf8';
      }
    }

    // 3. Projectile Mesh Synchronization with Ballistic Profiles
    const activeProjIds = new Set(snapshot.projectiles.map((p: any) => p.id));
    for (const [id, pMesh] of this.projectileMeshes.entries()) {
      if (!activeProjIds.has(id)) {
        scene.remove(pMesh);
        this.projectileMeshes.delete(id);
      }
    }

    for (const proj of snapshot.projectiles) {
      let pMesh = this.projectileMeshes.get(proj.id);
      if (!pMesh) {
        if (proj.projType === 'PLASMA') {
          pMesh = new THREE.Mesh(this.projectileSphereGeom, this.projectileMatEmerald);
        } else if (proj.projType === 'FLAK') {
          pMesh = new THREE.Mesh(this.projectileFlakGeom, this.projectileMatAmber);
        } else {
          // PULSE
          pMesh = new THREE.Mesh(
            this.projectileGeom,
            proj.color === '#ff2a5f' ? this.projectileMatRed : this.projectileMatCyan
          );
        }
        scene.add(pMesh);
        this.projectileMeshes.set(proj.id, pMesh);
      }

      pMesh.position.set(proj.x, 0.4, proj.z);

      // Orient cylinder along velocity vector
      const angle = Math.atan2(proj.vx, proj.vz);
      pMesh.rotation.y = angle;
      pMesh.rotation.x = Math.PI / 2;
    }

    // 3b. Floating Loot Container Canister Synchronization
    const containers = snapshot.containers || [];
    const activeContainerIds = new Set(containers.map((c: any) => c.id));
    this.activeLootContainers.clear();
    for (const c of containers) {
      this.activeLootContainers.set(c.id, c);
    }

    for (const [id, cGroup] of this.containerMeshes.entries()) {
      if (!activeContainerIds.has(id)) {
        scene.remove(cGroup);
        cGroup.traverse((child) => {
          if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
        });
        this.containerMeshes.delete(id);
      }
    }

    for (const c of containers) {
      let cGroup = this.containerMeshes.get(c.id);
      if (!cGroup) {
        cGroup = this.createCanisterMesh(c.rarity);
        cGroup.position.set(c.x, 0.5, c.z);
        scene.add(cGroup);
        this.containerMeshes.set(c.id, cGroup);
      }
      cGroup.position.x = c.x;
      cGroup.position.z = c.z;
    }

    // 3.5 Sync Persistent 3D Sector Wrecks
    const wrecks = snapshot.wrecks || [];
    const activeWreckIds = new Set<string>();
    this.activeWrecks.clear();

    for (const w of wrecks) {
      activeWreckIds.add(w.id);
      this.activeWrecks.set(w.id, w);
    }

    for (const [id, wGroup] of this.wreckMeshes.entries()) {
      if (!activeWreckIds.has(id)) {
        scene.remove(wGroup);
        wGroup.traverse((child) => {
          if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
        });
        this.wreckMeshes.delete(id);
      }
    }

    for (const w of wrecks) {
      let wGroup = this.wreckMeshes.get(w.id);
      if (!wGroup) {
        wGroup = this.createWreckMesh(w);
        wGroup.position.set(w.x, 0.0, w.z);
        wGroup.rotation.y = w.rotation || 0;
        scene.add(wGroup);
        this.wreckMeshes.set(w.id, wGroup);
      }
      wGroup.position.x = w.x;
      wGroup.position.z = w.z;
      wGroup.rotation.y = w.rotation || 0;
    }

    // Tow Cable Check
    if (playerEntity && playerEntity.towedWreckId) {
      this.currentTowedWreckId = playerEntity.towedWreckId;
      const towedWreck = this.activeWrecks.get(playerEntity.towedWreckId);
      if (towedWreck) {
        const pPos = new THREE.Vector3(playerEntity.x, 0, playerEntity.z);
        const wPos = new THREE.Vector3(towedWreck.x, 0, towedWreck.z);
        const dist = pPos.distanceTo(wPos);
        this.updateTowCable(pPos, wPos, dist);

        if (this.elTowCableHud) {
          this.elTowCableHud.classList.remove('hidden');
          if (this.elTowTargetName) this.elTowTargetName.textContent = towedWreck.shipName;
          if (this.elTowDistMetric) this.elTowDistMetric.textContent = `${dist.toFixed(1)} u`;
          if (this.elTowTensionBadge) {
            const isStrain = dist > 18.0;
            this.elTowTensionBadge.className = `tow-status-badge ${isStrain ? 'tension-strain' : 'tension-nominal'}`;
            this.elTowTensionBadge.textContent = isStrain ? 'TENSION: HIGH STRAIN' : 'TENSION: NOMINAL';
          }
        }
      }
    } else {
      this.currentTowedWreckId = null;
      if (this.towCableMesh) this.towCableMesh.visible = false;
      if (this.elTowCableHud) this.elTowCableHud.classList.add('hidden');
    }

    // Laser Salvage Beam Check
    if (playerEntity && playerEntity.isMiningWreckId) {
      const miningWreck = this.activeWrecks.get(playerEntity.isMiningWreckId);
      if (miningWreck) {
        const pPos = new THREE.Vector3(playerEntity.x, 0.4, playerEntity.z);
        const wPos = new THREE.Vector3(miningWreck.x, 0.4, miningWreck.z);
        this.updateSalvageBeam(pPos, wPos);
        this.audio.playMiningLaserSound();
      }
    } else {
      this.hideSalvageBeam();
    }

    // Day 25: 3D Skirmish Beacon & Engage Action
    if (snapshot.skirmishBeacon) {
      this.skirmishBeacon = snapshot.skirmishBeacon;
      this.updateSkirmishBeaconMesh(scene, snapshot.skirmishBeacon);
      const pPos = flightController.position;
      const bDist = Math.hypot(pPos.x - snapshot.skirmishBeacon.x, pPos.z - snapshot.skirmishBeacon.z);
      if (bDist <= 35.0) {
        if (this.btnHudEngageSkirmish) this.btnHudEngageSkirmish.classList.remove('hidden');
        if (this.elTargetQuickActions) this.elTargetQuickActions.classList.remove('hidden');
      } else {
        if (this.btnHudEngageSkirmish) this.btnHudEngageSkirmish.classList.add('hidden');
      }
    } else {
      this.skirmishBeacon = null;
      if (this.skirmishBeaconMesh) {
        this.skirmishBeaconMesh.visible = false;
      }
      if (this.btnHudEngageSkirmish) {
        this.btnHudEngageSkirmish.classList.add('hidden');
      }
    }

    // Day 25: Skirmish Arena State & HUD Synchronization
    const currentSec = this.callbacks.getCurrentSectorId();
    this.isSkirmishArena = !!snapshot.isSkirmishArena || currentSec === 201;

    if (this.isSkirmishArena) {
      if (this.elSkirmishScoreHud) this.elSkirmishScoreHud.classList.remove('hidden');

      if (snapshot.skirmishScores) {
        this.skirmishScores = snapshot.skirmishScores;
        const heg = snapshot.skirmishScores.FACTION_HEGEMONY ?? 100;
        const kry = snapshot.skirmishScores.FACTION_KRYLL ?? 100;

        if (this.elSkirmishHegemonyBar) this.elSkirmishHegemonyBar.style.width = `${Math.max(0, Math.min(100, heg))}%`;
        if (this.elSkirmishHegemonyTickets) this.elSkirmishHegemonyTickets.textContent = `${heg} / 100`;

        if (this.elSkirmishKryllBar) this.elSkirmishKryllBar.style.width = `${Math.max(0, Math.min(100, kry))}%`;
        if (this.elSkirmishKryllTickets) this.elSkirmishKryllTickets.textContent = `${kry} / 100`;
      }

      if (!this.playerAllegiance) {
        if (this.modalSkirmishAllegiance) this.modalSkirmishAllegiance.classList.remove('hidden');
      }
    } else {
      if (this.elSkirmishScoreHud) this.elSkirmishScoreHud.classList.add('hidden');
      if (this.modalSkirmishAllegiance) this.modalSkirmishAllegiance.classList.add('hidden');
    }

    // Day 25: VIP Escort Telemetry Widget Synchronization
    const escortHauler = snapshot.entities?.find((e: any) => e.isConvoyHauler && e.state !== 'DESTROYED');
    if (escortHauler) {
      this.activeEscortHauler = escortHauler;
      if (this.elEscortTelemetryHud) this.elEscortTelemetryHud.classList.remove('hidden');
      if (this.elEscortHaulerName) this.elEscortHaulerName.textContent = escortHauler.name;

      if (this.elEscortShieldBar) {
        const sPct = Math.max(0, Math.min(100, (escortHauler.shields / (escortHauler.maxShields || 1)) * 100));
        this.elEscortShieldBar.style.width = `${sPct}%`;
      }
      if (this.elEscortShieldVal) {
        this.elEscortShieldVal.textContent = `${escortHauler.shields}/${escortHauler.maxShields}`;
      }
      if (this.elEscortHullBar) {
        const hPct = Math.max(0, Math.min(100, (escortHauler.hp / (escortHauler.maxHp || 1)) * 100));
        this.elEscortHullBar.style.width = `${hPct}%`;
      }
      if (this.elEscortHullVal) {
        this.elEscortHullVal.textContent = `${escortHauler.hp}/${escortHauler.maxHp}`;
      }

      const pPos = flightController.position;
      const dist = Math.hypot(pPos.x - escortHauler.x, pPos.z - escortHauler.z);
      if (this.elEscortTetherStatus) {
        if (dist <= 45.0) {
          this.elEscortTetherStatus.className = 'escort-tether-badge';
          this.elEscortTetherStatus.textContent = `TETHER: NOMINAL (${dist.toFixed(1)} u)`;
        } else {
          this.elEscortTetherStatus.className = 'escort-tether-badge tether-warning';
          this.elEscortTetherStatus.textContent = `WARNING: TETHER BREAKING (${dist.toFixed(1)} u > 45u)`;
        }
      }

      if (escortHauler.state === 'DOCKED') {
        if (this.btnEscortClaimBounty) this.btnEscortClaimBounty.classList.remove('hidden');
      } else {
        if (this.btnEscortClaimBounty) this.btnEscortClaimBounty.classList.add('hidden');
      }
    } else {
      this.activeEscortHauler = null;
      if (this.elEscortTelemetryHud) this.elEscortTelemetryHud.classList.add('hidden');
    }

    // 4. Process Combat Events (VFX, Audio & Alerts)
    if (snapshot.events && snapshot.events.length > 0) {
      for (const ev of snapshot.events) {
        if (ev.type === 'HIT') {
          const impactPos = new THREE.Vector3(ev.x, 0, ev.z);
          if (ev.hitShield) {
            this.combatVfx.emitShieldSparks(impactPos);
            if (playerEntity && ev.targetId === playerEntity.id) {
              this.callbacks.playerShieldBubble.triggerImpact(false);
            } else if (this.droneShieldBubbles.has(ev.targetId)) {
              this.droneShieldBubbles.get(ev.targetId)!.triggerImpact(true);
            }
            this.audio.playShieldDeflection();
          } else {
            this.combatVfx.emitHullBreachSparks(impactPos);
            this.audio.playShieldDeflection();
          }
        } else if (ev.type === 'SHIELD_BREAK') {
          const breakPos = new THREE.Vector3(ev.x, 0, ev.z);
          this.combatVfx.emitShieldBreakBurst(breakPos);
          this.audio.playShieldBreakSound();
          if (playerEntity && ev.targetId === playerEntity.id) {
            this.callbacks.showApNotification('⚡ SHIELD COLLAPSE // VULNERABLE TO HULL DAMAGE', true);
          }
        } else if (ev.type === 'DESTROYED') {
          const expPos = new THREE.Vector3(ev.x, 0, ev.z);
          this.combatVfx.emitExplosionDebris(expPos);
          this.audio.playExplosion();
          this.callbacks.showApNotification('💥 HOSTILE TARGET DESTROYED!', false);
          this.callbacks.refreshFactionStandings();
        } else if (ev.type === 'POD_EJECTED') {
          const podPos = new THREE.Vector3(ev.x, 0, ev.z);
          this.combatVfx.emitExplosionDebris(podPos);
          this.audio.playExplosion();
          this.callbacks.showApNotification('🚨 CRITICAL HULL BREACH // EJECTED IN ESCAPE POD', true);
        } else if (ev.type === 'LOOT_SPAWNED') {
          this.callbacks.showApNotification(`📦 SALVAGE CANISTER DETECTED // ${ev.data?.title || 'CARGO'}`, false);
        } else if (ev.type === 'LOOT_COLLECTED') {
          if (ev.data?.playerId === 'commander-1') {
            this.callbacks.showApNotification(`📦 CARGO SECURED // TRANSFERRED TO SHIP LOCKER`, false);
          }
        } else if (ev.type === 'CONTAINER_SCOOPED') {
          this.callbacks.showApNotification(`📦 ${ev.data?.scavengerName || 'Scavenger'} scooped ${ev.data?.title || 'Canister'}!`, false);
        } else if (ev.type === 'LIFE_SUPPORT_EXHAUSTED') {
          this.callbacks.showApNotification('⚠️ LIFE SUPPORT EXHAUSTED: Initiating emergency clone recall!', true);
          this.handleEmergencyRecall();
        } else if (ev.type === 'WRECK_SPAWNED') {
          this.callbacks.showApNotification(`🛰️ DERELICT WRECK FORMED // ${ev.data?.shipName || 'WRECK'}`, false);
        } else if (ev.type === 'TOW_ATTACHED') {
          this.audio.playTowCableAttachSound();
          this.callbacks.showApNotification(`🪝 MAGNETIC TOW TETHER ATTACHED // ${ev.data?.wreckName || 'DERELICT'}`, false);
        } else if (ev.type === 'TOW_RELEASED') {
          this.audio.playTowCableReleaseSound();
          this.callbacks.showApNotification('🪝 MAGNETIC TOW TETHER RELEASED', false);
        } else if (ev.type === 'SALVAGE_BEAM_TICK') {
          this.callbacks.showApNotification(`⚡ EXTRACTED ${ev.data?.extracted || 10}x SCRAP ALLOY`, false);
        } else if (ev.type === 'WRECK_DISINTEGRATED') {
          this.callbacks.showApNotification('💨 DERELICT DISINTEGRATED // REPOSITORIES EXHAUSTED', false);
        } else if (ev.type === 'WARP_SPOOL_STARTED') {
          this.audio.playApWarningSound();
          this.callbacks.showApNotification('⚡ CONVOY WARP ESCAPE SPOOLING // 30s COUNTDOWN', true);
        } else if (ev.type === 'WARP_SPOOL_INTERRUPTED') {
          this.audio.playShieldBreakSound();
          this.callbacks.showApNotification('⚠️ CONVOY WARP DRIVE DISRUPTED // SHIELDS COMPROMISED', false);
        } else if (ev.type === 'WARP_JUMP_SUCCESS') {
          this.callbacks.showApNotification('🌌 CONVOY ESCAPED VIA HYPERSPACE WARP JUMP', false);
        } else if (ev.type === 'COMMS_ABORTED') {
          this.audio.playCommsCloseSound();
          this.callbacks.showApNotification('⚠️ COMMS ABORTED // WEAPONS FIRE DETECTED', true);
          this.callbacks.closeComms?.();
        } else if (ev.type === 'CONVOY_SURRENDERED') {
          this.audio.playLootPickupSound();
          this.callbacks.showApNotification('🚨 CONVOY SURRENDERED! Cargo pods jettisoned into sector space!', false);
        } else if (ev.type === 'TRUCE_DECLARED') {
          this.callbacks.startTruceCountdown(Math.floor((ev.data?.durationMs || 300000) / 1000));
          this.callbacks.showApNotification('🕊️ CEASEFIRE TRUCE CONFIRMED // PATROLS DISARMED', false);
          this.callbacks.refreshFactionStandings();
        } else if (ev.type === 'TRUCE_BROKEN') {
          const interval = this.callbacks.getTruceTimerInterval();
          if (interval) clearInterval(interval);
          this.callbacks.setActiveTruceExpiresAt(null);
          if (this.elHudTruceTimerPill) this.elHudTruceTimerPill.classList.add('hidden');
          this.callbacks.showApNotification('⚠️ CEASEFIRE VIOLATED! Hostile patrols engaging!', true);
          this.audio.playApWarningSound();
          this.callbacks.refreshFactionStandings();
        } else if (ev.type === 'AMBUSH_TRIGGERED') {
          this.audio.playApWarningSound();
          this.callbacks.showApNotification('⚠️ HOSTILE RAIDING WING INBOUND // PROTECT BULK HAULER', true);
        } else if (ev.type === 'AMBUSH_CLEARED') {
          this.callbacks.showApNotification('🛡️ AMBUSH REPELLED // ESCORT ROUTE SECURED', false);
        } else if (ev.type === 'ESCORT_FAILED') {
          this.audio.playShipExplosionSound();
          this.callbacks.showApNotification('❌ ESCORT MISSION FAILED // BULK HAULER DESTROYED', true);
        } else if (ev.type === 'ALLEGIANCE_DECLARED') {
          this.callbacks.showApNotification(ev.data?.message || 'Allegiance declared. IFF online.', false);
        } else if (ev.type === 'COMBAT_BOND_AWARDED') {
          this.audio.playLootPickupSound();
          const reward = ev.data?.rewardCredits || 750;
          this.playerCombatBonds += reward;
          if (this.elSkirmishPlayerBonds) {
            this.elSkirmishPlayerBonds.textContent = `COMBAT BONDS: +${this.playerCombatBonds.toLocaleString()} CR`;
          }
          this.callbacks.showApNotification(`🎖️ COMBAT BOND VOUCHER: +${reward} CR (Confirmed Skirmish Kill)`, false);
          if (this.callbacks.getPlayerCredits && this.callbacks.setPlayerCredits) {
            this.callbacks.setPlayerCredits(this.callbacks.getPlayerCredits() + reward);
          }
        } else if (ev.type === 'SKIRMISH_VICTORY') {
          const winFaction = ev.data?.winningFaction || 'Allies';
          this.callbacks.showApNotification(`🏆 SKIRMISH VICTORY: ${winFaction} claims sector front! (+15 Influence)`, false);
          this.callbacks.refreshFactionStandings();
        } else if (ev.type === 'ABILITY_TRIGGERED') {
          const ability = ev.data?.ability;
          const pos = new THREE.Vector3(ev.x || 0, 0, ev.z || 0);
          if (ability === 'POINT_DEFENSE') {
            this.audio.playPointDefenseSound();
            this.combatVfx.emitPointDefenseGrid(pos, ev.data?.radius || 35);
            this.callbacks.showApNotification(`🛡️ POINT-DEFENSE GRID ENGAGED // ${ev.data?.destroyedProjectilesCount || 0} Projectiles Neutralized`, false);
          } else if (ability === 'PLASMA_LANCE') {
            this.audio.playPlasmaLanceSound();
            const targetPos = new THREE.Vector3(ev.data?.targetX || 0, 0, ev.data?.targetZ || 0);
            this.combatVfx.emitPlasmaLanceBeam(pos, targetPos);
            this.callbacks.showApNotification(`⚡ PLASMA LANCE DISCHARGE // 70 DMG (60% Shield Piercing)`, false);
          } else if (ability === 'DECOY_HOLO') {
            this.audio.playDecoyHoloSound();
            this.combatVfx.emitHoloDecoyGlow(new THREE.Vector3(ev.data?.x || pos.x, 0, ev.data?.z || pos.z));
            this.callbacks.showApNotification('👻 HOLOGRAPHIC SENSOR GHOST DEPLOYED // Hostile Locks Broken', false);
          } else if (ability === 'BIO_SPORE_CLOUD') {
            this.audio.playBioSporeSound();
            this.combatVfx.emitBioSporeCloud(pos, ev.data?.radius || 40);
            this.callbacks.showApNotification('☣️ BIO-SPORE CORROSIVE CLOUD VENTED // 14 Hull DoT/s', false);
          } else if (ability === 'HARMONIC_SHIELD') {
            this.audio.playHarmonicShieldSound();
            this.combatVfx.emitHarmonicBarrier(pos);
            this.callbacks.showApNotification('💎 HARMONIC CRYSTALLINE BARRIER ONLINE // 50% Absorb, 25% Reflect', false);
          }
        } else if (ev.type === 'WINGMAN_DESTROYED') {
          this.audio.playShipExplosionSound();
          this.callbacks.showApNotification(ev.data?.message || '🚨 WINGMAN DESTROYED // Derelict wreck spawned', true);
        }
      }
    }

    // Day 35: Monitor wingman critical vitals for alarm
    const livingWingmen = (snapshot.entities || []).filter((e: any) => e.type === 'WINGMAN' && e.state !== 'DESTROYED');
    const hasCriticalWingman = livingWingmen.some((w: any) => w.hp > 0 && w.hp < w.maxHp * 0.25);
    const now = Date.now();
    if (hasCriticalWingman && now - this.lastEscortAlarmTime > 4000) {
      this.lastEscortAlarmTime = now;
      this.audio.playEscortCriticalAlarm();
      this.callbacks.showApNotification('🚨 ESCORT HULL INTEGRITY CRITICAL (< 25%)', true);
    }
  }

  public updateTacticalReticle(): void {
    if (!this.primaryDroneTarget) {
      if (this.elTacticalReticle) this.elTacticalReticle.classList.add('hidden');
      if (this.elTargetTelemetryHud) this.elTargetTelemetryHud.classList.add('hidden');
      if (this.elTargetConvoyHud) this.elTargetConvoyHud.classList.add('hidden');
      if (this.elReticleWarpBadge) this.elReticleWarpBadge.classList.add('hidden');
      return;
    }

    const targetPos = new THREE.Vector3(this.primaryDroneTarget.x, 0, this.primaryDroneTarget.z);
    const flightController = this.callbacks.getFlightController();
    const pPos = flightController.position;
    const dist = pPos.distanceTo(targetPos);

    if (dist > 180) {
      if (this.elTacticalReticle) this.elTacticalReticle.classList.add('hidden');
      if (this.elTargetTelemetryHud) this.elTargetTelemetryHud.classList.add('hidden');
      if (this.elTargetConvoyHud) this.elTargetConvoyHud.classList.add('hidden');
      if (this.elReticleWarpBadge) this.elReticleWarpBadge.classList.add('hidden');
      return;
    }

    const isHauler = !!(this.primaryDroneTarget.isConvoyHauler || this.primaryDroneTarget.type === 'HAULER');

    // 1. Update Top-Center Target Telemetry Box
    if (this.elTargetTelemetryHud) {
      this.elTargetTelemetryHud.classList.remove('hidden');
      if (this.elTargetName) {
        this.elTargetName.textContent = this.primaryDroneTarget.name.toUpperCase();
      }
      if (this.elTargetFaction) {
        const truceSuffix = (this.primaryDroneTarget as any).state === 'TRUCE' ? ' [🕊️ TRUCE]' : '';
        const fName = this.primaryDroneTarget.factionId || this.primaryDroneTarget.faction || 'HEGEMONY';
        this.elTargetFaction.textContent = fName + truceSuffix;
      }

      if (this.elTargetDistance) {
        this.elTargetDistance.textContent = `${dist.toFixed(1)} u`;
      }
      const shieldPct = Math.max(0, Math.min(100, (this.primaryDroneTarget.shields / this.primaryDroneTarget.maxShields) * 100));
      const hullPct = Math.max(0, Math.min(100, (this.primaryDroneTarget.hp / this.primaryDroneTarget.maxHp) * 100));

      if (this.elTargetShieldBar) {
        this.elTargetShieldBar.style.width = `${shieldPct}%`;
      }
      if (this.elTargetShieldVal) {
        this.elTargetShieldVal.textContent = `${this.primaryDroneTarget.shields}/${this.primaryDroneTarget.maxShields}`;
      }
      if (this.elTargetHullBar) {
        this.elTargetHullBar.style.width = `${hullPct}%`;
      }
      if (this.elTargetHullVal) {
        this.elTargetHullVal.textContent = `${this.primaryDroneTarget.hp}/${this.primaryDroneTarget.maxHp}`;
      }

      // Day 23: Convoy Telemetry (Warp Spooling & Cargo Scan Preview)
      if (this.elTargetConvoyHud) {
        if (isHauler) {
          this.elTargetConvoyHud.classList.remove('hidden');
          const isInterrupted = !!this.primaryDroneTarget.isWarpInterrupted;
          const isSpooling = !!this.primaryDroneTarget.isWarpSpooling;
          const warpCharge = typeof this.primaryDroneTarget.warpChargeRemaining === 'number' ? this.primaryDroneTarget.warpChargeRemaining : 30.0;

          if (this.elConvoyWarpBadge) {
            if (isInterrupted) {
              this.elConvoyWarpBadge.className = 'convoy-warp-badge interrupted';
              this.elConvoyWarpBadge.textContent = '⚠️ WARP DRIVE DISRUPTED';
            } else if (isSpooling) {
              this.elConvoyWarpBadge.className = 'convoy-warp-badge spooling';
              this.elConvoyWarpBadge.textContent = `⚡ WARP ESCAPE: ${warpCharge.toFixed(1)}s [SPOOLING]`;
            } else {
              this.elConvoyWarpBadge.className = 'convoy-warp-badge';
              this.elConvoyWarpBadge.textContent = '⚡ WARP DRIVE: STANDBY (30.0s)';
            }
          }

          if (this.elConvoyWarpBarFill) {
            const warpPct = Math.max(0, Math.min(100, (warpCharge / 30.0) * 100));
            this.elConvoyWarpBarFill.style.width = `${warpPct}%`;
            this.elConvoyWarpBarFill.className = isInterrupted ? 'convoy-warp-bar-fill interrupted' : 'convoy-warp-bar-fill';
          }

          if (this.elConvoyCargoItems) {
            if (dist <= 60.0) {
              const manifest = this.primaryDroneTarget.cargoManifest || [];
              if (manifest.length > 0) {
                this.elConvoyCargoItems.textContent = manifest
                  .map((m: any) => `${m.quantity || m.units || 1}x ${m.name || m.commodityId || 'Commodity'}`)
                  .join(', ');
              } else {
                this.elConvoyCargoItems.textContent = '24x Silicate Ore, 12x Plasteel Alloy';
              }
            } else {
              this.elConvoyCargoItems.textContent = 'OUT OF SCANNER RANGE (>60u)';
            }
          }
        } else {
          this.elTargetConvoyHud.classList.add('hidden');
        }
      }
    }

    // 2. Project 3D target coordinates to 2D screen coordinates for 3D Reticle
    if (!this.elTacticalReticle) return;

    const camera = this.callbacks.getCamera();
    const screenCoord = targetPos.clone().project(camera);

    // Behind camera check
    if (screenCoord.z > 1.0) {
      this.elTacticalReticle.classList.add('hidden');
      return;
    }

    const x = (screenCoord.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(screenCoord.y * 0.5) + 0.5) * window.innerHeight;

    this.elTacticalReticle.style.left = `${Math.round(x)}px`;
    this.elTacticalReticle.style.top = `${Math.round(y)}px`;
    this.elTacticalReticle.classList.remove('hidden');

    // Day 25: Inter-faction IFF Friend/Foe Reticle Coloring
    const targetAllegiance = (this.primaryDroneTarget as any).allegiance || (this.primaryDroneTarget as any).factionId;
    if (this.playerAllegiance && targetAllegiance) {
      const isAlly = targetAllegiance === this.playerAllegiance;
      if (isAlly) {
        this.elTacticalReticle.classList.add('iff-ally');
        this.elTacticalReticle.classList.remove('iff-hostile');
      } else {
        this.elTacticalReticle.classList.add('iff-hostile');
        this.elTacticalReticle.classList.remove('iff-ally');
      }
    } else {
      this.elTacticalReticle.classList.remove('iff-ally', 'iff-hostile');
    }

    if (this.elReticleName) {
      const isTruce = (this.primaryDroneTarget as any).state === 'TRUCE';
      this.elReticleName.textContent = this.primaryDroneTarget.name.toUpperCase() + (isTruce ? ' [🕊️ TRUCE]' : '');
    }

    if (this.elReticleRange) {
      this.elReticleRange.textContent = `RANGE: ${dist.toFixed(1)}u`;
    }
    const shieldPct = Math.max(0, Math.min(100, (this.primaryDroneTarget.shields / this.primaryDroneTarget.maxShields) * 100));
    const hullPct = Math.max(0, Math.min(100, (this.primaryDroneTarget.hp / this.primaryDroneTarget.maxHp) * 100));

    if (this.elReticleShieldFill) {
      this.elReticleShieldFill.style.width = `${shieldPct}%`;
    }
    if (this.elReticleHullFill) {
      this.elReticleHullFill.style.width = `${hullPct}%`;
    }

    // Day 23: Reticle Warp Escape Badge
    if (this.elReticleWarpBadge) {
      if (isHauler) {
        this.elReticleWarpBadge.classList.remove('hidden');
        const isInterrupted = !!this.primaryDroneTarget.isWarpInterrupted;
        const isSpooling = !!this.primaryDroneTarget.isWarpSpooling;
        const warpCharge = typeof this.primaryDroneTarget.warpChargeRemaining === 'number' ? this.primaryDroneTarget.warpChargeRemaining : 30.0;
        if (isInterrupted) {
          this.elReticleWarpBadge.className = 'reticle-warp-badge interrupted';
          this.elReticleWarpBadge.textContent = '⚠️ WARP DISRUPTED';
        } else if (isSpooling) {
          this.elReticleWarpBadge.className = 'reticle-warp-badge';
          this.elReticleWarpBadge.textContent = `⚡ WARP: ${warpCharge.toFixed(1)}s`;
        } else {
          this.elReticleWarpBadge.className = 'reticle-warp-badge';
          this.elReticleWarpBadge.textContent = '⚡ WARP: STANDBY';
        }
      } else {
        this.elReticleWarpBadge.classList.add('hidden');
      }
    }
  }

  public createCanisterMesh(rarity: string): THREE.Group {
    const group = new THREE.Group();
    const rarityColors: Record<string, number> = {
      COMMON: 0x94a3b8,
      UNCOMMON: 0x22c55e,
      RARE: 0x38bdf8,
      EPIC: 0xa855f7,
      LEGENDARY: 0xf59e0b,
    };
    const glowColor = rarityColors[rarity] || 0x38bdf8;

    // Outer hexagonal body
    const bodyGeom = new THREE.CylinderGeometry(1.1, 1.1, 2.4, 6);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.35,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    group.add(body);

    // Glowing energy bands
    const ringGeom = new THREE.TorusGeometry(1.15, 0.08, 8, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: glowColor });
    [-0.7, 0, 0.7].forEach((y) => {
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      group.add(ring);
    });

    // Pulsing point light
    const light = new THREE.PointLight(glowColor, 1.2, 12);
    group.add(light);
    return group;
  }

  public updateLootCanisters(deltaSec: number): void {
    // 1. Rotate meshes
    for (const cGroup of this.containerMeshes.values()) {
      cGroup.rotation.y += deltaSec * 1.2;
    }

    // 2. Find closest canister within 25u
    const flightController = this.callbacks.getFlightController();
    const pPos = flightController.position;
    let nearestContainer: any = null;
    let minContainerDist = Infinity;

    for (const c of this.activeLootContainers.values()) {
      const dist = Math.hypot(c.x - pPos.x, c.z - pPos.z);
      if (dist < minContainerDist) {
        minContainerDist = dist;
        nearestContainer = c;
      }
    }

    if (nearestContainer && minContainerDist <= 25.0) {
      this.targetedContainerId = nearestContainer.id;
      if (this.elLootPromptHud && this.elLootPromptText) {
        this.elLootPromptHud.classList.remove('hidden');
        this.elLootPromptText.textContent = `PRESS [F] TO SECURE ${nearestContainer.rarity} CARGO (${minContainerDist.toFixed(1)}u)`;
      }
      if (this.elLootDistanceDisplay && this.activeLootModalContainer?.id === nearestContainer.id) {
        this.elLootDistanceDisplay.textContent = `RANGE: ${minContainerDist.toFixed(1)}u`;
      }
    } else {
      this.targetedContainerId = null;
      if (this.elLootPromptHud) {
        this.elLootPromptHud.classList.add('hidden');
      }
      if (this.modalContainerLoot && !this.modalContainerLoot.classList.contains('hidden') && minContainerDist > 30.0) {
        this.closeContainerLootModal();
      }
    }
  }

  public openContainerLootModal(containerId: string): void {
    const container = this.activeLootContainers.get(containerId);
    if (!container) return;
    this.activeLootModalContainer = container;

    if (this.modalLootRarity) {
      this.modalLootRarity.textContent = `${container.rarity} RECOVERY`;
      this.modalLootRarity.className = `dock-badge loot-rarity-badge rarity-${container.rarity.toLowerCase()}`;
    }
    if (this.modalLootTitle) {
      this.modalLootTitle.textContent = container.title;
    }
    if (this.elLootDistanceDisplay) {
      const flightController = this.callbacks.getFlightController();
      const pPos = flightController.position;
      const dist = Math.hypot(container.x - pPos.x, container.z - pPos.z);
      this.elLootDistanceDisplay.textContent = `RANGE: ${dist.toFixed(1)}u`;
    }
    if (this.elLootItemCount) {
      this.elLootItemCount.textContent = `${container.items.length} ITEMS SECURED`;
    }

    if (this.elLootItemsList) {
      this.elLootItemsList.innerHTML = '';
      container.items.forEach((item: any) => {
        const itemCard = document.createElement('div');
        const rarity = item.rarity ? item.rarity.toLowerCase() : 'common';
        itemCard.className = `loot-item-card rarity-${rarity}`;

        const mfgHtml = item.manufacturer ? `<span class="mfg-badge">${item.manufacturer}</span>` : '';
        const specsHtml = item.category === 'COMMODITY'
          ? `Qty: ${item.quantity || 1} • Unit Value: ${item.unitValue || 0} Cr`
          : `⚡ ${item.energyCost || 0} MW • 🧠 ${item.cpuCost || 0} tf`;

        let affixesHtml = '';
        if (item.affixes && item.affixes.length > 0) {
          affixesHtml = `<div class="loot-item-stat-row">${item.affixes.map((a: any) => a.description).join(' • ')}</div>`;
        }

        itemCard.innerHTML = `
          <div class="loot-item-info">
            <div class="loot-item-title-row">
              <span class="rarity-pill rarity-${rarity}">${item.rarity || 'COMMODITY'}</span>
              <span>${item.customName || item.name}</span>
              ${mfgHtml}
            </div>
            <span class="slot-item-sub">${specsHtml}</span>
            ${affixesHtml}
          </div>
        `;
        this.elLootItemsList!.appendChild(itemCard);
      });
    }

    if (this.modalContainerLoot) {
      this.modalContainerLoot.classList.remove('hidden');
    }
    this.audio.playUiBlip();
  }

  public closeContainerLootModal(): void {
    if (this.modalContainerLoot) {
      this.modalContainerLoot.classList.add('hidden');
    }
    this.activeLootModalContainer = null;
  }

  public lootAllCurrentContainer(): void {
    if (!this.activeLootModalContainer) return;
    const cid = this.activeLootModalContainer.id;

    if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
      this.combatSocket.send(JSON.stringify({
        type: 'LOOT_CONTAINER',
        containerId: cid,
      }));
    }

    this.audio.playLootPickupSound();
    this.callbacks.showApNotification('📦 CARGO SECURED // TRANSFERRED TO SHIP LOCKER', false);
    this.closeContainerLootModal();
  }

  public cycleTargetLock(): void {
    if (this.availableDrones.length === 0) {
      this.primaryDroneTarget = null;
      return;
    }
    this.targetLockIndex = (this.targetLockIndex + 1) % this.availableDrones.length;
    this.primaryDroneTarget = this.availableDrones[this.targetLockIndex];
    this.audio.playUiBlip();
    if (this.primaryDroneTarget) {
      this.callbacks.showApNotification(`🎯 TARGET LOCKED: ${this.primaryDroneTarget.name}`, false);
    }
  }

  public createEscapePodMesh(): THREE.Group {
    const group = new THREE.Group();

    const capsuleGeom = new THREE.CapsuleGeometry(1.2, 2.8, 8, 16);
    const capsuleMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.3,
      flatShading: true,
    });
    const capsule = new THREE.Mesh(capsuleGeom, capsuleMat);
    capsule.rotation.x = Math.PI / 2;
    group.add(capsule);

    const canopyGeom = new THREE.SphereGeometry(0.8, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.5,
      metalness: 0.2,
      roughness: 0.1,
    });
    const canopy = new THREE.Mesh(canopyGeom, canopyMat);
    canopy.position.set(0, 0.6, 0.4);
    canopy.rotation.x = -Math.PI / 6;
    group.add(canopy);

    const beaconGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const beacon = new THREE.Mesh(beaconGeom, beaconMat);
    beacon.position.set(0, 1.35, -0.4);
    group.add(beacon);

    const beaconLight = new THREE.PointLight(0xef4444, 2.0, 18);
    beaconLight.position.set(0, 1.5, -0.4);
    group.add(beaconLight);

    return group;
  }

  public createHaulerMesh(factionId: string = 'FACTION_VAELIC'): THREE.Group {
    const group = new THREE.Group();

    const isVaelic = factionId === 'FACTION_VAELIC' || factionId === 'FACTION_HEGEMONY';
    const primaryColor = isVaelic ? 0x475569 : 0x334155;
    const accentColor = isVaelic ? 0xef4444 : 0x38bdf8;
    const podColor = isVaelic ? 0xd97706 : 0x0284c7;

    // 1. Central heavy spinal hull
    const spineGeom = new THREE.BoxGeometry(4.8, 3.2, 14.0);
    const spineMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      metalness: 0.85,
      roughness: 0.35,
      flatShading: true,
    });
    const spine = new THREE.Mesh(spineGeom, spineMat);
    group.add(spine);

    // 2. Command Bridge / Fore superstructure
    const bridgeGeom = new THREE.BoxGeometry(3.6, 2.0, 4.0);
    const bridgeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.2,
      flatShading: true,
    });
    const bridge = new THREE.Mesh(bridgeGeom, bridgeMat);
    bridge.position.set(0, 1.8, 4.5);
    group.add(bridge);

    // Bridge canopy glow
    const canopyGeom = new THREE.BoxGeometry(2.8, 0.6, 1.2);
    const canopyMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const canopy = new THREE.Mesh(canopyGeom, canopyMat);
    canopy.position.set(0, 2.2, 6.2);
    group.add(canopy);

    // 3. Flanking Cargo Pod Containers (3 pods on each flank = 6 total)
    const podGeom = new THREE.CylinderGeometry(1.2, 1.2, 3.2, 6);
    const podMat = new THREE.MeshStandardMaterial({
      color: podColor,
      metalness: 0.7,
      roughness: 0.4,
      flatShading: true,
    });

    const podOffsetsZ = [-3.8, -0.4, 3.0];
    for (const zOff of podOffsetsZ) {
      // Left pod
      const pLeft = new THREE.Mesh(podGeom, podMat);
      pLeft.rotation.x = Math.PI / 2;
      pLeft.position.set(-3.2, 0.0, zOff);
      group.add(pLeft);

      // Right pod
      const pRight = new THREE.Mesh(podGeom, podMat);
      pRight.rotation.x = Math.PI / 2;
      pRight.position.set(3.2, 0.0, zOff);
      group.add(pRight);
    }

    // 4. Twin Heavy Sublight & Warp Nacelles
    const nacelleGeom = new THREE.BoxGeometry(1.4, 2.2, 5.0);
    const nacelleMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.9,
      roughness: 0.3,
    });

    const nacelleL = new THREE.Mesh(nacelleGeom, nacelleMat);
    nacelleL.position.set(-2.6, 0.2, -6.5);
    group.add(nacelleL);

    const nacelleR = new THREE.Mesh(nacelleGeom, nacelleMat);
    nacelleR.position.set(2.6, 0.2, -6.5);
    group.add(nacelleR);

    // Thruster Bells & Engine Plumes
    const thrusterGeom = new THREE.CylinderGeometry(0.6, 0.7, 0.6, 8);
    const thrusterMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const thrustL = new THREE.Mesh(thrusterGeom, thrusterMat);
    thrustL.rotation.x = Math.PI / 2;
    thrustL.position.set(-2.6, 0.2, -9.1);
    group.add(thrustL);

    const thrustR = new THREE.Mesh(thrusterGeom, thrusterMat);
    thrustR.rotation.x = Math.PI / 2;
    thrustR.position.set(2.6, 0.2, -9.1);
    group.add(thrustR);

    // Point Light for engine wash
    const engineLight = new THREE.PointLight(accentColor, 1.8, 25);
    engineLight.position.set(0, 0, -8.0);
    group.add(engineLight);

    return group;
  }

  public createScavengerMesh(): THREE.Group {
    const group = new THREE.Group();

    const bodyGeom = new THREE.BoxGeometry(3.6, 1.8, 5.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.4,
      flatShading: true,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    group.add(body);

    const armGeom = new THREE.BoxGeometry(0.6, 0.8, 3.2);
    const armMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.6,
      roughness: 0.5,
    });

    const leftArm = new THREE.Mesh(armGeom, armMat);
    leftArm.position.set(-2.2, -0.2, 2.0);
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeom, armMat);
    rightArm.position.set(2.2, -0.2, 2.0);
    group.add(rightArm);

    const scoopGeom = new THREE.CylinderGeometry(0.8, 1.2, 1.0, 8);
    const scoopMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const scoop = new THREE.Mesh(scoopGeom, scoopMat);
    scoop.rotation.x = Math.PI / 2;
    scoop.position.set(0, -0.4, 3.0);
    group.add(scoop);

    const amberLight = new THREE.PointLight(0xf59e0b, 1.5, 20);
    amberLight.position.set(0, 1.5, 0);
    group.add(amberLight);

    return group;
  }

  public createWreckMesh(wreck: any): THREE.Group {
    const group = new THREE.Group();

    const hullGeom = new THREE.DodecahedronGeometry(2.8, 1);
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      metalness: 0.85,
      roughness: 0.6,
      flatShading: true,
    });
    const hull = new THREE.Mesh(hullGeom, hullMat);
    hull.scale.set(1.4, 0.7, 2.2);
    group.add(hull);

    const ribsGeom = new THREE.TorusGeometry(2.0, 0.22, 6, 8, Math.PI * 1.3);
    const ribsMat = new THREE.MeshStandardMaterial({
      color: 0x44403c,
      metalness: 0.9,
      roughness: 0.4,
    });
    const ribs1 = new THREE.Mesh(ribsGeom, ribsMat);
    ribs1.rotation.y = Math.PI / 3;
    ribs1.position.set(-0.8, 0.4, -0.6);
    group.add(ribs1);

    const ribs2 = new THREE.Mesh(ribsGeom, ribsMat);
    ribs2.rotation.y = -Math.PI / 4;
    ribs2.position.set(0.6, -0.3, 0.8);
    group.add(ribs2);

    const breachGeom = new THREE.CylinderGeometry(0.3, 0.6, 2.4, 6);
    const breachMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      emissive: 0xf97316,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    const breach = new THREE.Mesh(breachGeom, breachMat);
    breach.rotation.z = Math.PI / 3;
    breach.position.set(0.2, 0.6, 0.2);
    group.add(breach);

    const sparkLight = new THREE.PointLight(0xf97316, 1.5, 20);
    sparkLight.position.set(0.2, 1.0, 0.2);
    group.add(sparkLight);

    const shardGeom = new THREE.BoxGeometry(0.8, 0.3, 1.4);
    const shard = new THREE.Mesh(shardGeom, hullMat);
    shard.position.set(2.4, -0.8, 1.2);
    shard.rotation.set(0.4, 0.8, 0.2);
    group.add(shard);

    group.userData = { wreckId: wreck.id, scrapRemaining: wreck.scrapRemaining, maxScrap: wreck.maxScrap };
    return group;
  }

  public updateTowCable(shipPos: THREE.Vector3, wreckPos: THREE.Vector3, dist: number): void {
    const points: THREE.Vector3[] = [];
    const segments = 12;

    const sag = Math.max(0.2, (dist / 12.0) * 0.8);
    const midPoint = new THREE.Vector3()
      .addVectors(shipPos, wreckPos)
      .multiplyScalar(0.5);
    midPoint.y -= sag;

    const curve = new THREE.QuadraticBezierCurve3(shipPos, midPoint, wreckPos);
    for (let i = 0; i <= segments; i++) {
      points.push(curve.getPoint(i / segments));
    }

    if (!this.towCableMesh) {
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: 0x06b6d4,
        linewidth: 3,
      });
      this.towCableMesh = new THREE.Line(geom, mat);
      this.callbacks.getScene().add(this.towCableMesh);
    } else {
      this.towCableMesh.geometry.setFromPoints(points);
      const isStrain = dist > 18.0;
      (this.towCableMesh.material as THREE.LineBasicMaterial).color.setHex(isStrain ? 0xf59e0b : 0x06b6d4);
    }

    this.towCableMesh.visible = true;
  }

  public updateSalvageBeam(shipPos: THREE.Vector3, wreckPos: THREE.Vector3): void {
    if (!this.salvageBeamMesh) {
      this.salvageBeamMesh = new THREE.Group();

      const beamGeom = new THREE.CylinderGeometry(0.12, 0.12, 1, 8);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.85,
      });
      const beam = new THREE.Mesh(beamGeom, beamMat);
      beam.name = 'core';
      this.salvageBeamMesh.add(beam);

      const sparkGeom = new THREE.SphereGeometry(0.4, 8, 8);
      const sparkMat = new THREE.MeshBasicMaterial({
        color: 0xffedd5,
        wireframe: true,
      });
      const spark = new THREE.Mesh(sparkGeom, sparkMat);
      spark.name = 'spark';
      this.salvageBeamMesh.add(spark);

      this.callbacks.getScene().add(this.salvageBeamMesh);
    }

    this.salvageBeamMesh.visible = true;

    const dir = new THREE.Vector3().subVectors(wreckPos, shipPos);
    const length = dir.length();
    const midPoint = new THREE.Vector3().addVectors(shipPos, wreckPos).multiplyScalar(0.5);

    const beam = this.salvageBeamMesh.getObjectByName('core') as THREE.Mesh;
    if (beam) {
      beam.scale.set(1, length, 1);
      beam.position.copy(midPoint);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    }

    const spark = this.salvageBeamMesh.getObjectByName('spark') as THREE.Mesh;
    if (spark) {
      spark.position.copy(wreckPos);
      spark.rotation.y += 0.2;
    }
  }

  public hideSalvageBeam(): void {
    if (this.salvageBeamMesh) {
      this.salvageBeamMesh.visible = false;
    }
  }

  public updateWrecksAndTether(_deltaSec: number): void {
    const flightController = this.callbacks.getFlightController();
    const pPos = flightController.position;
    let nearestWreck: any = null;
    let minWreckDist = Infinity;

    for (const wreck of this.activeWrecks.values()) {
      const wPos = new THREE.Vector3(wreck.x, 0, wreck.z);
      const dist = pPos.distanceTo(wPos);
      if (dist < minWreckDist) {
        minWreckDist = dist;
        nearestWreck = wreck;
      }
    }

    if (nearestWreck && minWreckDist <= 35.0) {
      this.targetedWreckId = nearestWreck.id;

      if (!this.primaryDroneTarget || minWreckDist <= 25.0) {
        if (this.elTargetTelemetryHud) {
          this.elTargetTelemetryHud.classList.remove('hidden');
          if (this.elTargetName) this.elTargetName.textContent = nearestWreck.shipName.toUpperCase();
          if (this.elTargetFaction) this.elTargetFaction.textContent = 'DERELICT // WRECKAGE';
          if (this.elTargetDistance) this.elTargetDistance.textContent = `${minWreckDist.toFixed(1)} u`;

          if (this.elTargetShieldBar) this.elTargetShieldBar.style.width = '0%';
          if (this.elTargetShieldVal) this.elTargetShieldVal.textContent = '0/0';

          const intactPct = Math.round(nearestWreck.hullIntactness * 100);
          if (this.elTargetHullBar) this.elTargetHullBar.style.width = `${intactPct}%`;
          if (this.elTargetHullVal) {
            this.elTargetHullVal.textContent = `${nearestWreck.scrapRemaining}/${nearestWreck.maxScrap} ALLOY`;
          }
        }

        // Show target quick actions (Salvage Beam & Tow Tether)
        if (this.elTargetQuickActions) {
          this.elTargetQuickActions.classList.remove('hidden');

          if (this.btnHudTetherWreck) {
            const isTowed = this.currentTowedWreckId === nearestWreck.id;
            this.btnHudTetherWreck.textContent = isTowed ? '🪝 RELEASE TETHER [T]' : '🪝 TETHER WRECK [T]';
          }

          if (this.btnHudSalvageBeam) {
            this.btnHudSalvageBeam.textContent = this.isMiningLaserActive ? '⚡ STOP BEAM [E]' : '⚡ SALVAGE BEAM [E]';
          }
        }
      }
    } else {
      this.targetedWreckId = null;
      if (!this.primaryDroneTarget && this.elTargetTelemetryHud) {
        this.elTargetTelemetryHud.classList.add('hidden');
      }
      if (this.elTargetQuickActions) {
        this.elTargetQuickActions.classList.add('hidden');
      }
    }
  }

  public toggleTowTether(): void {
    if (this.currentTowedWreckId) {
      if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
        this.combatSocket.send(JSON.stringify({ type: 'RELEASE_TOW' }));
      }
      this.currentTowedWreckId = null;
      if (this.towCableMesh) this.towCableMesh.visible = false;
      if (this.elTowCableHud) this.elTowCableHud.classList.add('hidden');
      this.audio.playTowCableReleaseSound();
      this.callbacks.showApNotification('🪝 MAGNETIC TOW TETHER RELEASED', false);
    } else if (this.targetedWreckId) {
      if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
        this.combatSocket.send(JSON.stringify({ type: 'ATTACH_TOW', wreckId: this.targetedWreckId }));
      }
      this.currentTowedWreckId = this.targetedWreckId;
      this.audio.playTowCableAttachSound();
      this.callbacks.showApNotification('🪝 ATTACHING MAGNETIC TOW TETHER...', false);
    } else {
      this.callbacks.showApNotification('⚠️ NO WRECK TARGETED TO TETHER', true);
    }
  }

  public toggleSalvageMining(): void {
    if (this.isMiningLaserActive) {
      this.stopSalvageMining();
    } else if (this.targetedWreckId) {
      this.startSalvageMining();
    } else {
      this.callbacks.showApNotification('⚠️ NO WRECK TARGETED FOR SALVAGE BEAM', true);
    }
  }

  public startSalvageMining(): void {
    if (!this.targetedWreckId) return;
    this.isMiningLaserActive = true;
    if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
      this.combatSocket.send(JSON.stringify({ type: 'START_SALVAGE_BEAM', wreckId: this.targetedWreckId }));
    }
    this.audio.playMiningLaserSound();
    this.callbacks.showApNotification('⚡ SALVAGE MINING BEAM ENGAGED', false);
  }

  public stopSalvageMining(): void {
    this.isMiningLaserActive = false;
    this.hideSalvageBeam();
    if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
      this.combatSocket.send(JSON.stringify({ type: 'STOP_SALVAGE_BEAM' }));
    }
  }

  public async loadSalvageData(): Promise<void> {
    try {
      const holdRes = await fetch('/api/player/hold?playerId=acc_sol_captain');
      if (holdRes.ok) {
        const holdData = await holdRes.json();
        if (this.elSalvagePlayerCredits) {
          this.elSalvagePlayerCredits.textContent = `${(holdData.credits || 0).toLocaleString()} Cr`;
        }
      }

      const wreckRes = await fetch('/api/combat/wrecks?sectorId=2');
      if (wreckRes.ok) {
        const data = await wreckRes.json();
        const wrecks = data.wrecks || [];
        if (this.elSalvageSweepCount) {
          this.elSalvageSweepCount.textContent = `${wrecks.length} DERELICTS DETECTED`;
        }

        if (this.elSalvageDerelictsList) {
          this.elSalvageDerelictsList.innerHTML = '';
          wrecks.forEach((w: any) => {
            const item = document.createElement('div');
            item.className = 'derelict-card-item';
            item.innerHTML = `
              <div class="derelict-card-info">
                <span class="derelict-card-title">${w.shipName}</span>
                <span class="derelict-card-sub">${w.shipClass} // ${w.faction} [Sector ${w.sectorId}]</span>
              </div>
              <div class="derelict-card-scrap">
                ${w.scrapRemaining} / ${w.maxScrap} ALLOY (${Math.round(w.hullIntactness * 100)}%)
              </div>
            `;
            this.elSalvageDerelictsList?.appendChild(item);
          });
        }

        const towed = wrecks.find((w: any) => w.isTowed && w.towedByAccountId === 'acc_sol_captain') || 
                      (this.currentTowedWreckId ? wrecks.find((w: any) => w.id === this.currentTowedWreckId) : null);

        if (towed) {
          if (this.elSalvageEmptyCard) this.elSalvageEmptyCard.classList.add('hidden');
          if (this.elSalvageWreckCard) this.elSalvageWreckCard.classList.remove('hidden');
          if (this.elSalvageTetherStatus) {
            this.elSalvageTetherStatus.textContent = 'DERELICT SECURED IN DOCK';
            this.elSalvageTetherStatus.style.color = '#34d399';
          }
          if (this.elSalvageWreckFaction) this.elSalvageWreckFaction.textContent = towed.faction.toUpperCase();
          if (this.elSalvageWreckTitle) this.elSalvageWreckTitle.textContent = towed.shipName;
          if (this.elSalvageWreckClass) this.elSalvageWreckClass.textContent = towed.shipClass;
          if (this.elSalvageWreckScrap) this.elSalvageWreckScrap.textContent = `${towed.scrapRemaining} / ${towed.maxScrap} Units`;
          if (this.elSalvageWreckIntactness) this.elSalvageWreckIntactness.textContent = `${Math.round(towed.hullIntactness * 100)}%`;
          const estValue = Math.round(2000 + towed.scrapRemaining * 12 + towed.hullIntactness * 1500);
          if (this.elSalvageWreckVal) this.elSalvageWreckVal.textContent = `${estValue.toLocaleString()} Cr`;

          this.tetheredStationWreck = towed;
        } else {
          if (this.elSalvageEmptyCard) this.elSalvageEmptyCard.classList.remove('hidden');
          if (this.elSalvageWreckCard) this.elSalvageWreckCard.classList.add('hidden');
          if (this.elSalvageTetherStatus) {
            this.elSalvageTetherStatus.textContent = 'NO TOW ATTACHED';
            this.elSalvageTetherStatus.style.color = '#94a3b8';
          }
          this.tetheredStationWreck = null;
        }
      }
    } catch (err) {
      console.error('[CombatClient] Failed to load salvage data:', err);
    }
  }

  public async dismantleTetheredWreck(): Promise<void> {
    if (!this.tetheredStationWreck) return;
    const wreckId = this.tetheredStationWreck.id;

    try {
      const res = await fetch('/api/combat/wrecks/dismantle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wreckId, accountId: 'acc_sol_captain' }),
      });
      const data = await res.json();
      if (data.success) {
        this.audio.playSalvageDismantleSound();
        this.callbacks.showApNotification(`🔨 ${data.message}`, false);
        this.currentTowedWreckId = null;
        this.loadSalvageData();
      } else {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Dismantle failed'}`, true);
      }
    } catch (err: any) {
      this.callbacks.showApNotification(`⚠️ Dismantle error: ${err.message}`, true);
    }
  }

  public async refurbishTetheredWreck(): Promise<void> {
    if (!this.tetheredStationWreck) return;
    const wreckId = this.tetheredStationWreck.id;

    try {
      const res = await fetch('/api/combat/wrecks/refurbish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wreckId, accountId: 'acc_sol_captain' }),
      });
      const data = await res.json();
      if (data.success) {
        this.audio.playHullRefurbishSound();
        this.callbacks.showApNotification(`🛡️ ${data.message}`, false);
        this.currentTowedWreckId = null;
        this.loadSalvageData();
      } else {
        this.callbacks.showApNotification(`⚠️ ${data.error || 'Refurbish failed'}`, true);
      }
    } catch (err: any) {
      this.callbacks.showApNotification(`⚠️ Refurbish error: ${err.message}`, true);
    }
  }

  public openKillmailModal(km: any): void {
    this.activeKillmailData = km;
    if (this.elKmTimestamp) this.elKmTimestamp.textContent = `TIMESTAMP: ${new Date(km.createdAt).toLocaleTimeString()} // SECTOR 0${km.sectorId}`;
    if (this.elKmLossValuation) this.elKmLossValuation.textContent = `LOSS: ${km.lossValuation.toLocaleString()} CR`;
    if (this.elKmKillerName) this.elKmKillerName.textContent = km.killerName;
    if (this.elKmSectorName) this.elKmSectorName.textContent = `Sector 0${km.sectorId} // Deep Hazard Void`;
    if (this.elKmTotalLoss) this.elKmTotalLoss.textContent = `${km.lossValuation.toLocaleString()} Credits`;
    if (this.elKmDroppedSummary) {
      const dropped = km.droppedItems || [];
      this.elKmDroppedSummary.textContent = dropped.map((d: any) => `${d.quantity || 1}x ${d.name}`).join(', ') || 'No salvage recovered';
    }

    if (this.elKmShareRow) this.elKmShareRow.classList.add('hidden');
    if (this.modalKillmail) this.modalKillmail.classList.remove('hidden');
  }

  public async postRevengeBounty(): Promise<void> {
    if (!this.activeKillmailData) return;
    try {
      const res = await fetch('/api/combat/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorAccountId: 'acc_sol_captain',
          targetName: this.activeKillmailData.killerName,
          targetEntityId: this.activeKillmailData.killerId,
          rewardCredits: this.selectedBountyAmount,
          isPublic: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        this.callbacks.showApNotification(`⚠️ Bounty failed: ${err.error}`, true);
        this.audio.playApWarningSound();
        return;
      }

      const data = await res.json();
      const contract = data.contract;
      const shareUrl = `${window.location.origin}/?contract=${contract.id}`;

      if (this.elKmShareUrl) this.elKmShareUrl.value = shareUrl;
      if (this.elKmShareRow) this.elKmShareRow.classList.remove('hidden');
      this.callbacks.showApNotification(`💀 Revenge bounty posted for ${this.selectedBountyAmount.toLocaleString()} CR!`, false);
      this.audio.playUiBlip();

      if (this.callbacks.getPlayerCredits && this.callbacks.setPlayerCredits) {
        const currentCredits = this.callbacks.getPlayerCredits();
        this.callbacks.setPlayerCredits(Math.max(0, currentCredits - this.selectedBountyAmount));
      }
    } catch (err: any) {
      this.callbacks.showApNotification(`⚠️ Bounty error: ${err.message}`, true);
    }
  }

  public async claimReplacementFrigate(): Promise<void> {
    try {
      const sectorId = this.callbacks.getCurrentSectorId();
      const res = await fetch('/api/combat/claim-frigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'acc_sol_captain', sectorId }),
      });

      if (res.ok) {
        this.audio.playFrigateReissueSound();
        this.callbacks.showApNotification('🚀 Sol Cutter Frigate reissued by Aegis Naval Command!', false);

        // Reset escape pod state
        this.isEscapePod = false;
        if (this.elEscapePodHud) this.elEscapePodHud.classList.add('hidden');
        if (this.modalClinicRescue) this.modalClinicRescue.classList.add('hidden');

        // Swap 3D mesh back to frigate
        if (this.escapePodMesh) {
          this.callbacks.getScene().remove(this.escapePodMesh);
          this.escapePodMesh = null;
        }
        const shipMesh = this.callbacks.getShipMesh();
        if (shipMesh) {
          shipMesh.visible = true;
        }

        // Reset vitals
        this.lastPlayerShields = 100;
        this.lastPlayerMaxShields = 100;

        // Open regular station dock modal
        this.callbacks.dockShip();
      }
    } catch (err) {
      console.error('[CombatClient] Error claiming replacement frigate:', err);
    }
  }

  public async handleEmergencyRecall(): Promise<void> {
    try {
      const res = await fetch('/api/combat/emergency-recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: 'acc_sol_captain' }),
      });

      if (res.ok) {
        this.callbacks.showApNotification('🏥 Clone emergency recall complete! 500 CR deductible deducted.', true);
        this.isEscapePod = false;
        if (this.elEscapePodHud) this.elEscapePodHud.classList.add('hidden');

        if (this.escapePodMesh) {
          this.callbacks.getScene().remove(this.escapePodMesh);
          this.escapePodMesh = null;
        }
        const shipMesh = this.callbacks.getShipMesh();
        if (shipMesh) {
          shipMesh.visible = true;
        }

        this.callbacks.setCurrentSectorId(1);
        this.initCombatWebSocket(1);
        this.callbacks.dockShip();
      }
    } catch (err) {
      console.error('[CombatClient] Error handling emergency recall:', err);
    }
  }

  // Day 25: Skirmish Arena & Escort Contracts Methods

  public updateSkirmishBeaconMesh(scene: THREE.Scene, beacon: any): void {
    if (!this.skirmishBeaconMesh) {
      const group = new THREE.Group();

      // Glowing outer ring
      const ringGeom = new THREE.RingGeometry(6, 7.5, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      // Rotating inner diamond beacon
      const diamondGeom = new THREE.OctahedronGeometry(2.8, 0);
      const diamondMat = new THREE.MeshBasicMaterial({
        color: 0xff3b3b,
        wireframe: true,
      });
      const diamond = new THREE.Mesh(diamondGeom, diamondMat);
      diamond.position.y = 1.8;
      diamond.name = 'beacon_diamond';
      group.add(diamond);

      // Light beacon pillar
      const pillarGeom = new THREE.CylinderGeometry(0.2, 0.2, 16, 8);
      const pillarMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.35,
      });
      const pillar = new THREE.Mesh(pillarGeom, pillarMat);
      pillar.position.y = 8;
      group.add(pillar);

      scene.add(group);
      this.skirmishBeaconMesh = group;
    }

    this.skirmishBeaconMesh.position.set(beacon.x, 0, beacon.z);
    this.skirmishBeaconMesh.visible = true;

    const diamond = this.skirmishBeaconMesh.getObjectByName('beacon_diamond');
    if (diamond) {
      diamond.rotation.y += 0.03;
      diamond.rotation.x += 0.01;
    }
  }

  public canEngageSkirmish(): boolean {
    if (!this.skirmishBeacon) return false;
    const flightController = this.callbacks.getFlightController();
    const dist = Math.hypot(
      flightController.position.x - this.skirmishBeacon.x,
      flightController.position.z - this.skirmishBeacon.z
    );
    return dist <= 35.0;
  }

  public engageSkirmish(): void {
    if (!this.skirmishBeacon) return;
    const targetSector = this.skirmishBeacon.skirmishSectorId;
    this.callbacks.showApNotification(`⚔️ DROPPING OUT OF WARP INTO CONTESTED SKIRMISH FRONT (SECTOR ${targetSector})`, false);
    this.callbacks.setCurrentSectorId(targetSector);
    if (this.callbacks.loadSectorScene) {
      this.callbacks.loadSectorScene(targetSector, 99201);
    } else {
      this.initCombatWebSocket(targetSector);
    }
  }

  public declareAllegiance(factionId: 'FACTION_HEGEMONY' | 'FACTION_KRYLL'): void {
    this.playerAllegiance = factionId;
    if (this.modalSkirmishAllegiance) {
      this.modalSkirmishAllegiance.classList.add('hidden');
    }
    if (this.combatSocket && this.combatSocket.readyState === WebSocket.OPEN) {
      this.combatSocket.send(JSON.stringify({
        type: 'DECLARE_ALLEGIANCE',
        factionId,
      }));
    }
    const name = factionId === 'FACTION_HEGEMONY' ? 'Vaelic Hegemony Ally' : 'Kryll Cartel Raider';
    this.callbacks.showApNotification(`🎖️ IFF ONLINE: Enlisted as ${name}`, false);
    if (this.elSkirmishPlayerAllegiance) {
      this.elSkirmishPlayerAllegiance.textContent = `ALLEGIANCE: ${factionId === 'FACTION_HEGEMONY' ? 'VAELIC HEGEMONY' : 'KRYLL CARTEL'}`;
      this.elSkirmishPlayerAllegiance.style.color = factionId === 'FACTION_HEGEMONY' ? '#38bdf8' : '#f87171';
    }
  }

  public closeAllegianceModal(): void {
    if (this.modalSkirmishAllegiance) {
      this.modalSkirmishAllegiance.classList.add('hidden');
    }
  }

  public async claimEscortBounty(): Promise<void> {
    if (!this.activeEscortHauler || !this.activeEscortHauler.convoyId) {
      this.callbacks.showApNotification('❌ No active escort contract found.', true);
      return;
    }
    try {
      const res = await fetch('/api/convoys/contracts/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc_sol_captain',
          convoyId: this.activeEscortHauler.convoyId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        this.callbacks.showApNotification(`💰 ESCORT BOUNTY CLAIMED: +${data.rewardCredits} CR // +${data.reputationGain} Rep`, false);
        this.audio.playLootPickupSound();
        if (this.callbacks.getPlayerCredits && this.callbacks.setPlayerCredits) {
          this.callbacks.setPlayerCredits(this.callbacks.getPlayerCredits() + (data.rewardCredits || 0));
        }
        if (this.btnEscortClaimBounty) {
          this.btnEscortClaimBounty.classList.add('hidden');
        }
        this.callbacks.refreshFactionStandings();
      } else {
        this.callbacks.showApNotification(`❌ ${data.error || 'Failed to claim bounty'}`, true);
      }
    } catch (err) {
      console.error('[CombatClient] Error claiming escort bounty:', err);
    }
  }
}
