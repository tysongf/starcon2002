import * as THREE from 'three';
import { type DockingStatus } from './DockingZone';

export interface SpaceStationConfig {
  stationId: string;
  name: string;
  portClass: number;         // Class 1 to 8 (e.g. 1 = Free-Trade Hub)
  factionId: string;         // e.g. 'FACTION_SOL'
  position: THREE.Vector3;
}

/**
 * Procedural low-poly orbital space station with rotating habitat ring,
 * solar panel arrays, and an illuminated central docking bay.
 */
export class SpaceStation {
  public readonly config: SpaceStationConfig;
  public readonly group: THREE.Group;
  public readonly position: THREE.Vector3;
  public readonly dockingRadius: number = 7.5;
  public readonly maxDockSpeed: number = 3.5;

  private habitatRingGroup: THREE.Group;
  private dockingGuideRing: THREE.LineLoop;
  private pylonLights: THREE.Mesh[];

  constructor(config: SpaceStationConfig) {
    this.config = config;
    this.position = config.position.clone();
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const stationMat = new THREE.MeshStandardMaterial({
      color: 0x2e3846,
      roughness: 0.55,
      metalness: 0.35,
      flatShading: true,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.4,
      metalness: 0.5,
      flatShading: true,
    });

    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x092d47,
      roughness: 0.2,
      metalness: 0.9,
      flatShading: true,
    });

    // 1. Central Core Spindle (Vertical Octagonal Tower)
    const coreHeight = 28;
    const coreGeo = new THREE.CylinderGeometry(2.4, 2.8, coreHeight, 8);
    const coreMesh = new THREE.Mesh(coreGeo, stationMat);
    coreMesh.position.y = 8;
    this.group.add(coreMesh);

    // Spire Antenna Top
    const antennaGeo = new THREE.CylinderGeometry(0.1, 0.4, 12, 6);
    const antennaMesh = new THREE.Mesh(antennaGeo, accentMat);
    antennaMesh.position.y = 8 + coreHeight / 2 + 6;
    this.group.add(antennaMesh);

    // 2. Rotating Centrifugal Habitat Ring
    this.habitatRingGroup = new THREE.Group();
    this.habitatRingGroup.position.y = 10;

    const ringRadius = 18;
    const ringThickness = 1.6;
    const ringSegments = 16;
    const ringGeo = new THREE.TorusGeometry(ringRadius, ringThickness, 6, ringSegments);
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, stationMat);
    this.habitatRingGroup.add(ringMesh);

    // Structural Cross-Spokes (4 connecting core to habitat ring)
    const spokeGeo = new THREE.BoxGeometry(ringRadius * 2, 0.8, 1.2);
    const spoke1 = new THREE.Mesh(spokeGeo, stationMat);
    const spoke2 = new THREE.Mesh(spokeGeo, stationMat);
    spoke2.rotation.y = Math.PI / 2;
    this.habitatRingGroup.add(spoke1);
    this.habitatRingGroup.add(spoke2);

    this.group.add(this.habitatRingGroup);

    // 3. Solar Panel Arrays (4 wings extending outward)
    const solarWingGroup = new THREE.Group();
    solarWingGroup.position.y = 18;
    for (let w = 0; w < 4; w++) {
      const angle = (w / 4) * Math.PI * 2;
      const wingArm = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 0.4), accentMat);
      wingArm.position.set(Math.cos(angle) * 7.5, 0, Math.sin(angle) * 7.5);
      wingArm.rotation.y = -angle;

      const panel = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 3.5), solarMat);
      panel.position.set(Math.cos(angle) * 11, 0, Math.sin(angle) * 11);
      panel.rotation.y = -angle;

      solarWingGroup.add(wingArm);
      solarWingGroup.add(panel);
    }
    this.group.add(solarWingGroup);

    // 4. Lower Docking Bay Deck & Illuminated Guidance Ring
    const bayPlatformGeo = new THREE.CylinderGeometry(this.dockingRadius * 1.35, this.dockingRadius * 1.2, 1.5, 8);
    const bayPlatform = new THREE.Mesh(bayPlatformGeo, stationMat);
    bayPlatform.position.y = -0.75;
    this.group.add(bayPlatform);

    // Glowing docking guidance loop
    const guidePoints = 32;
    const guidePositions = new Float32Array(guidePoints * 3);
    for (let i = 0; i < guidePoints; i++) {
      const theta = (i / guidePoints) * Math.PI * 2;
      guidePositions[i * 3] = Math.cos(theta) * this.dockingRadius;
      guidePositions[i * 3 + 1] = 0.08;
      guidePositions[i * 3 + 2] = Math.sin(theta) * this.dockingRadius;
    }
    const guideGeo = new THREE.BufferGeometry();
    guideGeo.setAttribute('position', new THREE.BufferAttribute(guidePositions, 3));
    this.dockingGuideRing = new THREE.LineLoop(
      guideGeo,
      new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 })
    );
    this.group.add(this.dockingGuideRing);

    // Peripheral Docking Pylons
    this.pylonLights = [];
    const pylonGeo = new THREE.CylinderGeometry(0.15, 0.15, 2.5, 6);
    const pylonMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(
        Math.cos(angle) * (this.dockingRadius * 1.15),
        1.25,
        Math.sin(angle) * (this.dockingRadius * 1.15)
      );
      this.pylonLights.push(pylon);
      this.group.add(pylon);
    }
  }

  /**
   * Station visual update loop
   */
  public update(deltaSec: number): void {
    // Slowly rotate habitat ring around core
    this.habitatRingGroup.rotation.y += deltaSec * 0.12;

    // Station central core very slow counter-drift
    this.group.rotation.y += deltaSec * 0.015;
  }

  /**
   * Validates if a ship is inside docking parameters
   */
  public checkDocking(shipPos: THREE.Vector3, shipSpeed: number): DockingStatus {
    const dist = shipPos.distanceTo(this.position);
    const inRange = dist <= this.dockingRadius;

    if (!inRange) {
      return {
        inRange: false,
        distance: dist,
        canDock: false,
        message: `${this.config.name} // BEACON: ${dist.toFixed(1)}m`,
      };
    }

    if (shipSpeed > this.maxDockSpeed) {
      return {
        inRange: true,
        distance: dist,
        canDock: false,
        message: `SPEED HIGH (${shipSpeed.toFixed(1)} m/s) // SLOW < ${this.maxDockSpeed.toFixed(1)}`,
      };
    }

    return {
      inRange: true,
      distance: dist,
      canDock: true,
      message: `IN DOCKING BAY // PRESS [E] OR [SPACE] TO DOCK`,
    };
  }
}
