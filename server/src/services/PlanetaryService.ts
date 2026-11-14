import { db } from '../db/Database';
import { apService } from './ActionPointService';
import { reputationService } from './ReputationService';
import { getPlanetSubtypeDef, type PlanetMainClass, type PlanetPalette } from '../procgen/PlanetTaxonomyCatalog';
import { generatePlanetEcosystem, type ProceduralLifeform } from '../procgen/XenobiologyEngine';

export type ScanBand = 'MINERALS' | 'BIO' | 'ANOMALIES';
export type HotspotCategory =
  | 'SILICATE_DEPOSIT'
  | 'PLASTEEL_STRATA'
  | 'RADIOACTIVE_VENT'
  | 'BIO_ORGANIC_COLONY'
  | 'DEUTERIUM_GEYSER'
  | 'PRECURSOR_MONOLITH';

export interface PlanetHotspot {
  id: string;
  name: string;
  category: HotspotCategory;
  scanBand: ScanBand;
  lat: number;   // -75 to +75 degrees
  lng: number;   // -180 to +180 degrees
  yieldEstimate: string;
  commodityId: string;
  rarity: 'COMMON' | 'RARE' | 'EXOTIC';
  color: string;
}

export interface PlanetSurveyState {
  scannedMinerals: boolean;
  scannedBio: boolean;
  scannedAnomalies: boolean;
  surveyCompletion: number; // 0 to 100%
  discoveredHotspots: PlanetHotspot[];
  isDataSold: boolean;
}

export interface PlanetDetail {
  id: string;
  sectorId: number;
  name: string;
  mainClass: PlanetMainClass;
  mainClassLabel: string;
  subtype: string;
  abundanceRating: number;
  tectonicsRating: number;
  atmosphereRating: number;
  densityRating: number;
  orbitIndex: number;
  primaryResource: string;
  exoticResource: string;
  planetPalette: PlanetPalette;
  lifeformsCount: number;
  radius: number;
  posX: number;
  posY: number;
  posZ: number;
  textureSeed: number;
  atmosphereColor: string;
  atmosphereDensity: number;
  surfaceTempK: number;
  hazardClass: string;
  habitabilityRating: number; // 0 to 100%
  controllingFaction: string;
  description: string;
  survey: PlanetSurveyState;
  beacons: Array<{
    id: string;
    surfaceLat: number;
    surfaceLng: number;
    yieldSummary: string;
    createdAt: string;
  }>;
}

export class PlanetaryService {
  /**
   * Generates deterministic hotspots for a planet using its texture_seed.
   */
  public generateDeterministicHotspots(planetId: string, mainClass: PlanetMainClass, seed: number): PlanetHotspot[] {
    const spots: PlanetHotspot[] = [];

    const mineralRichClasses: readonly PlanetMainClass[] = [
      'METALLIC_ORE', 'PYRO_TECTONIC', 'PRECURSOR_ANOMALOUS', 'CRYSTALLINE_GEM',
      'SILICATE_DESERT', 'RARE_EARTH', 'CRYO_GLACIAL', 'SYNTHETIC_CYBERNETIC', 'RADIOLOGIC_ISOTOPIC',
    ];
    if (mineralRichClasses.includes(mainClass)) {
      spots.push({
        id: `${planetId}_min_1`,
        name: mainClass === 'PYRO_TECTONIC' ? 'Heavy Basalt Pyrite Chimney' : 'High-Density Silicate Vein',
        category: 'SILICATE_DEPOSIT',
        scanBand: 'MINERALS',
        lat: Math.sin(seed * 1.1) * 55,
        lng: Math.cos(seed * 1.3) * 160,
        yieldEstimate: '10-15 Units Silicate Ore',
        commodityId: 'COMM_ORE',
        rarity: 'COMMON',
        color: '#f59e0b',
      });
      spots.push({
        id: `${planetId}_min_2`,
        name: 'Plasteel Structural Strata',
        category: 'PLASTEEL_STRATA',
        scanBand: 'MINERALS',
        lat: Math.sin(seed * 2.3) * 45,
        lng: Math.cos(seed * 2.7) * 150,
        yieldEstimate: '6-8 Units Plasteel Alloy',
        commodityId: 'COMM_ALLOY',
        rarity: 'RARE',
        color: '#38bdf8',
      });
    }

    if (mainClass === 'PYRO_TECTONIC' || mainClass === 'RADIOLOGIC_ISOTOPIC') {
      spots.push({
        id: `${planetId}_min_3`,
        name: 'Radioactive Magma Geode',
        category: 'RADIOACTIVE_VENT',
        scanBand: 'MINERALS',
        lat: Math.sin(seed * 3.1) * 60,
        lng: Math.cos(seed * 3.5) * 140,
        yieldEstimate: '4-6 Units Superdense Core',
        commodityId: 'COMM_ORE',
        rarity: 'EXOTIC',
        color: '#ef4444',
      });
    }

    if (
      mainClass === 'LIVING_BIOSPHERE' ||
      mainClass === 'FUNGAL_MYCELIAL' ||
      mainClass === 'HYDROSPHERE' ||
      mainClass === 'CAUSTIC_SOLVENT'
    ) {
      spots.push({
        id: `${planetId}_bio_1`,
        name: 'Symbiotic Spore Canopy Biome',
        category: 'BIO_ORGANIC_COLONY',
        scanBand: 'BIO',
        lat: Math.sin(seed * 4.2) * 40,
        lng: Math.cos(seed * 4.4) * 150,
        yieldEstimate: '12-18 Units Bio-Protein Rations',
        commodityId: 'COMM_RATIONS',
        rarity: 'COMMON',
        color: '#10b981',
      });
      spots.push({
        id: `${planetId}_bio_2`,
        name: 'Mycelial Enzyme Caldera',
        category: 'BIO_ORGANIC_COLONY',
        scanBand: 'BIO',
        lat: Math.sin(seed * 5.1) * 50,
        lng: Math.cos(seed * 5.3) * 120,
        yieldEstimate: '6-9 Units Ancient Spore Culture',
        commodityId: 'COMM_RATIONS',
        rarity: 'RARE',
        color: '#a855f7',
      });
    } else if (mainClass === 'GAS_ICE_GIANT' || mainClass === 'MAGNETOSPHERIC') {
      spots.push({
        id: `${planetId}_bio_1`,
        name: 'Supercooled Deuterium Vapour Current',
        category: 'DEUTERIUM_GEYSER',
        scanBand: 'BIO',
        lat: Math.sin(seed * 6.2) * 35,
        lng: Math.cos(seed * 6.5) * 170,
        yieldEstimate: '20-25 Units Refined Fuel',
        commodityId: 'COMM_FUEL',
        rarity: 'COMMON',
        color: '#38bdf8',
      });
    }

    const anomalyClasses: readonly PlanetMainClass[] = [
      'PRECURSOR_ANOMALOUS', 'SYNTHETIC_CYBERNETIC', 'METALLIC_ORE',
      'LIVING_BIOSPHERE', 'FUNGAL_MYCELIAL', 'CRYSTALLINE_GEM',
    ];
    if (anomalyClasses.includes(mainClass)) {
      spots.push({
        id: `${planetId}_ano_1`,
        name: 'Resonant Sub-Crustal Monolith',
        category: 'PRECURSOR_MONOLITH',
        scanBand: 'ANOMALIES',
        lat: Math.sin(seed * 7.7) * 50,
        lng: Math.cos(seed * 7.9) * 135,
        yieldEstimate: 'Harmonic Precursor Energy Signal',
        commodityId: 'COMM_ALLOY',
        rarity: 'EXOTIC',
        color: '#ec4899',
      });
    }

    return spots;
  }

  /**
   * Retrieves all planets in a given sector.
   */
  public async getSectorPlanets(sectorId: number, accountId: string = 'acc_sol_captain'): Promise<PlanetDetail[]> {
    const { rows: planetRows } = await db.query<any>(
      `SELECT * FROM planets WHERE sector_id = $1 ORDER BY COALESCE(orbit_index, 1) ASC, id ASC`,
      [sectorId]
    );

    const planets: PlanetDetail[] = [];
    for (const r of planetRows) {
      const detail = await this.getPlanetDetail(r.id, accountId);
      planets.push(detail);
    }

    return planets;
  }

  /**
   * Retrieves full planetary telemetry, survey progress, hotspots, and active beacons.
   */
  public async getPlanetDetail(planetId: string, accountId: string = 'acc_sol_captain'): Promise<PlanetDetail> {
    const { rows: pRows } = await db.query<any>(`SELECT * FROM planets WHERE id = $1`, [planetId]);
    if (pRows.length === 0) {
      throw new Error(`Planet with ID ${planetId} not found.`);
    }
    const p = pRows[0];

    // Query or initialize survey state
    const { rows: sRows } = await db.query<any>(
      `SELECT * FROM planet_surveys WHERE account_id = $1 AND planet_id = $2`,
      [accountId, planetId]
    );

    let survey: PlanetSurveyState;
    if (sRows.length > 0) {
      const s = sRows[0];
      survey = {
        scannedMinerals: s.scanned_minerals,
        scannedBio: s.scanned_bio,
        scannedAnomalies: s.scanned_anomalies,
        surveyCompletion: s.survey_completion,
        discoveredHotspots: typeof s.discovered_hotspots === 'string' ? JSON.parse(s.discovered_hotspots) : s.discovered_hotspots || [],
        isDataSold: s.is_data_sold,
      };
    } else {
      survey = {
        scannedMinerals: false,
        scannedBio: false,
        scannedAnomalies: false,
        surveyCompletion: 0,
        discoveredHotspots: [],
        isDataSold: false,
      };
      await db.query(
        `INSERT INTO planet_surveys (account_id, planet_id, scanned_minerals, scanned_bio, scanned_anomalies, survey_completion, discovered_hotspots, is_data_sold)
         VALUES ($1, $2, FALSE, FALSE, FALSE, 0, '[]'::jsonb, FALSE)
         ON CONFLICT (account_id, planet_id) DO NOTHING`,
        [accountId, planetId]
      );
    }

    // Query active beacons
    const { rows: bRows } = await db.query<any>(
      `SELECT * FROM planet_beacons WHERE account_id = $1 AND planet_id = $2 ORDER BY created_at DESC`,
      [accountId, planetId]
    );

    const beacons = bRows.map((b) => ({
      id: b.id,
      surfaceLat: Number(b.surface_lat),
      surfaceLng: Number(b.surface_lng),
      yieldSummary: b.yield_summary,
      createdAt: b.created_at,
    }));

    const subtypeDef = getPlanetSubtypeDef(p.subtype, p.main_class);
    const parsedPalette: PlanetPalette = p.planet_palette
      ? (typeof p.planet_palette === 'string' ? JSON.parse(p.planet_palette) : p.planet_palette)
      : subtypeDef.palette;
    const resolvedMainClass = (p.main_class || subtypeDef.mainClass) as PlanetMainClass;
    const lifeforms = generatePlanetEcosystem({
      id: p.id,
      name: p.name,
      subtype: p.subtype || subtypeDef.subtype,
      mainClass: resolvedMainClass,
      textureSeed: Number(p.texture_seed || 101),
    });

    return {
      id: p.id,
      sectorId: p.sector_id,
      name: p.name,
      mainClass: resolvedMainClass,
      mainClassLabel: subtypeDef.mainClassLabel,
      subtype: p.subtype || subtypeDef.subtype,
      abundanceRating: p.abundance_rating != null ? Number(p.abundance_rating) : subtypeDef.abundanceRating,
      tectonicsRating: p.tectonics_rating != null ? Number(p.tectonics_rating) : subtypeDef.tectonicsRating,
      atmosphereRating: p.atmosphere_rating != null ? Number(p.atmosphere_rating) : subtypeDef.atmosphereRating,
      densityRating: p.density_rating != null ? Number(p.density_rating) : subtypeDef.densityRating,
      orbitIndex: p.orbit_index != null ? Number(p.orbit_index) : 1,
      primaryResource: subtypeDef.primaryResource,
      exoticResource: subtypeDef.exoticResource,
      planetPalette: parsedPalette,
      lifeformsCount: lifeforms.length,
      radius: Number(p.radius),
      posX: Number(p.pos_x),
      posY: Number(p.pos_y),
      posZ: Number(p.pos_z),
      textureSeed: p.texture_seed,
      atmosphereColor: p.atmosphere_color,
      atmosphereDensity: Number(p.atmosphere_density),
      surfaceTempK: p.surface_temp_k,
      hazardClass: p.hazard_class,
      habitabilityRating: p.habitability_rating,
      controllingFaction: p.controlling_faction,
      description: p.description,
      survey,
      beacons,
    };
  }

  /**
   * Returns deterministic lazy-seeded procedural lifeforms for a planet.
   */
  public async getPlanetLifeforms(planetId: string): Promise<{ planet: PlanetDetail; lifeforms: ProceduralLifeform[] }> {
    const planet = await this.getPlanetDetail(planetId);
    const lifeforms = generatePlanetEcosystem({
      id: planet.id,
      name: planet.name,
      subtype: planet.subtype,
      mainClass: planet.mainClass,
      textureSeed: planet.textureSeed,
    });
    return { planet, lifeforms };
  }

  /**
   * Records discovered lazy-seeded species into the Galactic Xenodex without DB bloat.
   */
  public async recordDiscoveredSpecies(accountId: string, lifeform: ProceduralLifeform): Promise<void> {
    const rowId = `${accountId}__${lifeform.speciesUid}`;
    await db.query(
      `INSERT INTO discovered_species (
        id, account_id, species_uid, planet_id, common_name, scientific_name,
        kingdom, species_class, covering, size_meters, trophic_role,
        adaptation_trait, rarity_tier, genotype_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
      ON CONFLICT (account_id, species_uid) DO NOTHING`,
      [
        rowId,
        accountId,
        lifeform.speciesUid,
        lifeform.planetId,
        lifeform.commonName,
        lifeform.scientificName,
        lifeform.kingdom,
        lifeform.speciesClass,
        lifeform.covering,
        lifeform.sizeMeters,
        lifeform.trophicRole,
        lifeform.adaptationTrait,
        lifeform.rarityTier,
        JSON.stringify(lifeform),
      ]
    );
  }

  /**
   * Performs an orbital scanner sweep on a chosen sensor band.
   * Consumes 2 AP. Reveals matching hotspots and updates completion percentage.
   */
  public async performScannerSweep(
    accountId: string,
    planetId: string,
    scanBand: ScanBand
  ): Promise<{
    success: boolean;
    scanBand: ScanBand;
    newlyDiscovered: PlanetHotspot[];
    lifeformsDiscovered?: ProceduralLifeform[];
    totalCompletion: number;
    message: string;
    survey: PlanetSurveyState;
  }> {
    // 0. Day 21: Hostile airspace requires an active ceasefire truce (checked at action start)
    await reputationService.assertAirspaceClearance(accountId, planetId, 'Orbital scanner sweep');

    // 1. Deduct 2 AP
    const apCheck = await apService.deductAP(accountId, 2, `Orbital ${scanBand} Sweep`);
    if (!apCheck.success) {
      throw new Error(apCheck.error || 'INSUFFICIENT_AP: Scanner sweep requires 2 AP.');
    }

    const planet = await this.getPlanetDetail(planetId, accountId);
    const allHotspots = this.generateDeterministicHotspots(planet.id, planet.mainClass, planet.textureSeed);

    const bandHotspots = allHotspots.filter((h) => h.scanBand === scanBand);

    // Update survey state
    const survey = planet.survey;
    if (scanBand === 'MINERALS') survey.scannedMinerals = true;
    if (scanBand === 'BIO') survey.scannedBio = true;
    if (scanBand === 'ANOMALIES') survey.scannedAnomalies = true;

    // Merge discovered hotspots uniquely
    const existingIds = new Set(survey.discoveredHotspots.map((h) => h.id));
    const newlyDiscovered: PlanetHotspot[] = [];

    for (const h of bandHotspots) {
      if (!existingIds.has(h.id)) {
        survey.discoveredHotspots.push(h);
        newlyDiscovered.push(h);
      }
    }

    // Compute completion: 33% per band, 100% when all 3 completed
    let count = 0;
    if (survey.scannedMinerals) count++;
    if (survey.scannedBio) count++;
    if (survey.scannedAnomalies) count++;
    survey.surveyCompletion = count === 3 ? 100 : Math.round(count * 33.3);

    await db.query(
      `UPDATE planet_surveys 
       SET scanned_minerals = $1, scanned_bio = $2, scanned_anomalies = $3, survey_completion = $4, discovered_hotspots = $5, updated_at = NOW()
       WHERE account_id = $6 AND planet_id = $7`,
      [
        survey.scannedMinerals,
        survey.scannedBio,
        survey.scannedAnomalies,
        survey.surveyCompletion,
        JSON.stringify(survey.discoveredHotspots),
        accountId,
        planetId,
      ]
    );

    let lifeformsDiscovered: ProceduralLifeform[] | undefined;
    if (scanBand === 'BIO') {
      lifeformsDiscovered = generatePlanetEcosystem({
        id: planet.id,
        name: planet.name,
        subtype: planet.subtype,
        mainClass: planet.mainClass,
        textureSeed: planet.textureSeed,
      });
      for (const sp of lifeformsDiscovered) {
        await this.recordDiscoveredSpecies(accountId, sp);
      }
    }

    const bandName = scanBand === 'MINERALS' ? 'Mineral & Geological Strata' : scanBand === 'BIO' ? 'Biological & Atmosphere' : 'Precursor Energy Resonance';
    const lifeNote = lifeformsDiscovered ? ` Indexed ${lifeformsDiscovered.length} endemic species in Xenodex.` : '';
    const message = `${bandName} sweep complete. Detected ${bandHotspots.length} orbital signatures.${lifeNote} Survey completion: ${survey.surveyCompletion}%.`;

    return {
      success: true,
      scanBand,
      newlyDiscovered,
      lifeformsDiscovered,
      totalCompletion: survey.surveyCompletion,
      message,
      survey,
    };
  }

  /**
   * Launches an Atmospheric / Surface Probe to sample materials and establish a permanent beacon.
   * Features dynamic atmospheric entry simulation with heat shield integrity (0-100 HP).
   */
  public async launchAtmosphericProbe(
    accountId: string,
    planetId: string,
    targetLat?: number,
    targetLng?: number,
    shieldBoost: boolean = false
  ): Promise<{
    success: boolean;
    probeIntegrity: number;
    shieldBoostActive: boolean;
    entryDamage: number;
    beaconId: string;
    sampledCargo: { commodityId: string; name: string; quantity: number };
    atmosphericAnalysis: { pressure: string; thermalStatus: string; stormHazards: string };
    yieldSummary: string;
    message: string;
  }> {
    // Day 21: Hostile airspace requires an active ceasefire truce (checked at action start)
    await reputationService.assertAirspaceClearance(accountId, planetId, 'Atmospheric probe launch');

    if (shieldBoost) {
      const apRes = await apService.deductAP(accountId, 1, 'Atmospheric Probe Shield Reinforcement');
      if (!apRes.success) {
        throw new Error(apRes.error || 'INSUFFICIENT_AP: Shield boost requires 1 AP.');
      }
    }

    const planet = await this.getPlanetDetail(planetId, accountId);

    // Calculate atmospheric entry damage based on planetary hazard class
    let baseDamage = 20;
    if (planet.hazardClass.includes('EXTREME') || planet.hazardClass.includes('PYROLYSIS')) {
      baseDamage = 65;
    } else if (planet.hazardClass.includes('SUPERCRITICAL') || planet.hazardClass.includes('GAS_SHEAR')) {
      baseDamage = 55;
    } else if (planet.hazardClass.includes('CRYOGENIC') || planet.hazardClass.includes('TECTONIC')) {
      baseDamage = 40;
    } else if (planet.hazardClass.includes('BIO') || planet.hazardClass.includes('SPORE')) {
      baseDamage = 25;
    }

    // Apply shield mitigation
    const finalDamage = shieldBoost ? Math.round(baseDamage * 0.35) : baseDamage;
    const probeIntegrity = Math.max(0, 100 - finalDamage);

    // Determine primary commodity to sample
    let commodityId = 'COMM_ORE';
    let commodityName = 'Silicate Ore';
    let maxQty = 8;

    if (planet.mainClass === 'PYRO_TECTONIC' || planet.mainClass === 'RADIOLOGIC_ISOTOPIC') {
      commodityId = 'COMM_ORE';
      commodityName = 'Sulfur Pyrite Ore';
      maxQty = 10;
    } else if (
      planet.mainClass === 'LIVING_BIOSPHERE' ||
      planet.mainClass === 'FUNGAL_MYCELIAL' ||
      planet.mainClass === 'HYDROSPHERE'
    ) {
      commodityId = 'COMM_RATIONS';
      commodityName = 'Bio-Protein Organics';
      maxQty = 10;
    } else if (planet.mainClass === 'GAS_ICE_GIANT' || planet.mainClass === 'MAGNETOSPHERIC') {
      commodityId = 'COMM_FUEL';
      commodityName = 'Cryo-Deuterium Fuel';
      maxQty = 14;
    } else if (
      planet.mainClass === 'PRECURSOR_ANOMALOUS' ||
      planet.mainClass === 'SYNTHETIC_CYBERNETIC' ||
      planet.mainClass === 'CRYSTALLINE_GEM'
    ) {
      commodityId = 'COMM_ALLOY';
      commodityName = 'Precursor Alloy Relic';
      maxQty = 6;
    }

    // Yield scales with probe integrity: if probe integrity is high, yield is full. If degraded, partial.
    const sampleQty = Math.max(1, Math.round(maxQty * (probeIntegrity / 100)));

    // Add sampled resources to player ship cargo
    const sRes = await db.query<{ id: string }>('SELECT id FROM ships WHERE account_id = $1 LIMIT 1', [accountId]);
    if (sRes.rows.length > 0) {
      const shipId = sRes.rows[0].id;
      await db.query(
        `INSERT INTO ship_cargo (ship_id, commodity_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (ship_id, commodity_id)
         DO UPDATE SET quantity = ship_cargo.quantity + EXCLUDED.quantity`,
        [shipId, commodityId, sampleQty]
      );
    }

    const lat = typeof targetLat === 'number' ? targetLat : Math.round((Math.random() * 80 - 40) * 10) / 10;
    const lng = typeof targetLng === 'number' ? targetLng : Math.round((Math.random() * 300 - 150) * 10) / 10;
    const beaconId = `beacon_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const yieldSummary = `${sampleQty}x ${commodityName} [Lat: ${lat}°, Lng: ${lng}°]`;

    await db.query(
      `INSERT INTO planet_beacons (id, account_id, planet_id, beacon_type, surface_lat, surface_lng, yield_summary)
       VALUES ($1, $2, $3, 'SENSOR_PROBE', $4, $5, $6)`,
      [beaconId, accountId, planetId, lat, lng, yieldSummary]
    );

    const atmosphericAnalysis = {
      pressure: `${planet.atmosphereDensity.toFixed(2)} Bar (${planet.atmosphereDensity > 1.5 ? 'Dense / Supercritical' : planet.atmosphereDensity < 0.2 ? 'Trace / Vacuum' : 'Standard Normative'})`,
      thermalStatus: `${planet.surfaceTempK} K (${planet.surfaceTempK > 500 ? 'Extreme Thermal Pyrolysis' : planet.surfaceTempK < 150 ? 'Deep Cryogenic Glaciation' : 'Temperate Equilibrium'})`,
      stormHazards: `${planet.hazardClass.replace(/_/g, ' ')} Index`,
    };

    const message = probeIntegrity > 50
      ? `Atmospheric probe touched down at Lat: ${lat}°, Lng: ${lng}°. Hull integrity: ${probeIntegrity}%. Secured ${sampleQty} units of ${commodityName}. Sensor beacon online.`
      : `High atmospheric stress! Probe sustained ${finalDamage}% thermal/shear stress (Hull: ${probeIntegrity}%). Harvested ${sampleQty} units of ${commodityName}. Beacon planted.`;

    return {
      success: true,
      probeIntegrity,
      shieldBoostActive: shieldBoost,
      entryDamage: finalDamage,
      beaconId,
      sampledCargo: { commodityId, name: commodityName, quantity: sampleQty },
      atmosphericAnalysis,
      yieldSummary,
      message,
    };
  }

  /**
   * Sells Astrometry Survey Data to a station Cartography Bureau.
   * Features faction-aligned strategic resource bonuses and +15 goodwill.
   */
  public async sellSurveyData(
    accountId: string,
    planetId: string,
    portId: string = 'PORT_AEGIS_01'
  ): Promise<{
    success: boolean;
    creditsEarned: number;
    apEarned: number;
    reputationBonus: number;
    factionId: string;
    message: string;
  }> {
    const planet = await this.getPlanetDetail(planetId, accountId);
    if (planet.survey.surveyCompletion < 33) {
      throw new Error('INSUFFICIENT_DATA: Requires at least 33% survey completion before data can be sold.');
    }
    if (planet.survey.isDataSold) {
      throw new Error('DATA_ALREADY_SOLD: Astrometry cartography data for this planet has already been remitted.');
    }

    // Look up port faction
    const portRes = await db.query<any>('SELECT faction_id FROM ports WHERE id = $1', [portId]);
    const factionId = portRes.rows[0]?.faction_id || 'FACTION_SOL';

    // Faction strategic value multiplier
    let multiplier = 1.0;
    if (
      factionId === 'FACTION_KRYLL' &&
      (planet.mainClass === 'PYRO_TECTONIC' || planet.mainClass === 'GAS_ICE_GIANT' || planet.mainClass === 'CAUSTIC_SOLVENT' || planet.mainClass === 'RADIOLOGIC_ISOTOPIC')
    ) {
      multiplier = 1.5; // Kryll pays premium for fuels and dense heavy metals
    } else if (
      factionId === 'FACTION_SOL' &&
      (planet.mainClass === 'METALLIC_ORE' || planet.mainClass === 'LIVING_BIOSPHERE' || planet.mainClass === 'HYDROSPHERE' || planet.mainClass === 'FUNGAL_MYCELIAL' || planet.mainClass === 'SILICATE_DESERT')
    ) {
      multiplier = 1.4; // Sol Nexus pays premium for habitability and structural silicates
    } else if (
      factionId === 'FACTION_LITHOS' &&
      (planet.mainClass === 'PRECURSOR_ANOMALOUS' || planet.mainClass === 'CRYSTALLINE_GEM' || planet.mainClass === 'RARE_EARTH' || planet.mainClass === 'SYNTHETIC_CYBERNETIC')
    ) {
      multiplier = 1.6; // Lithos Axiom values ancient precursor tech anomalies and rare crystals
    }

    // Base credits: 100% = 1,000 CR, 66% = 660 CR, 33% = 330 CR, scaled by faction multiplier
    const baseCredits = Math.round((planet.survey.surveyCompletion / 100) * 1000);
    const creditsEarned = Math.round(baseCredits * multiplier);
    const apEarned = 5;
    const reputationBonus = 15; // Agreed +15 goodwill

    // Credit player
    await db.query('UPDATE accounts SET credits = credits + $1 WHERE id = $2', [creditsEarned, accountId]);
    await apService.addAP(accountId, apEarned);

    // Modify faction standing
    await reputationService.modifyStanding(accountId, factionId, reputationBonus, `Sold planetary astrometry data for ${planet.name}`);

    // Mark survey as sold
    await db.query(
      'UPDATE planet_surveys SET is_data_sold = TRUE, updated_at = NOW() WHERE account_id = $1 AND planet_id = $2',
      [accountId, planetId]
    );

    const bonusLabel = multiplier > 1.0 ? ` (includes ${(multiplier * 100 - 100).toFixed(0)}% strategic faction demand bonus)` : '';
    const message = `Astrometry Bureau processed survey of ${planet.name}. Awarded +${creditsEarned} Credits${bonusLabel}, +${apEarned} AP, and +${reputationBonus} diplomatic goodwill with ${factionId}.`;

    return {
      success: true,
      creditsEarned,
      apEarned,
      reputationBonus,
      factionId,
      message,
    };
  }
}

export const planetaryService = new PlanetaryService();
