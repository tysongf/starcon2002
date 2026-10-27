import * as THREE from 'three';

export interface DockingStatus {
  inRange: boolean;
  distance: number;
  canDock: boolean;
  message: string;
}

export class DockingZone {
  public readonly position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public readonly radius: number = 6.0;
  public readonly maxDockSpeed: number = 3.5;
  public group: THREE.Group;

  private innerRing: THREE.LineLoop;
  private outerRing: THREE.LineSegments;

  constructor(pos: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
    this.position.copy(pos);
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    // Inner Glowing Docking Circle
    const innerSegments = 48;
    const innerPositions = new Float32Array(innerSegments * 3);
    for (let i = 0; i < innerSegments; i++) {
      const theta = (i / innerSegments) * Math.PI * 2;
      innerPositions[i * 3] = Math.cos(theta) * this.radius;
      innerPositions[i * 3 + 1] = 0.05;
      innerPositions[i * 3 + 2] = Math.sin(theta) * this.radius;
    }
    const innerGeo = new THREE.BufferGeometry();
    innerGeo.setAttribute('position', new THREE.BufferAttribute(innerPositions, 3));
    this.innerRing = new THREE.LineLoop(
      innerGeo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2, transparent: true, opacity: 0.85 })
    );
    this.group.add(this.innerRing);

    // Outer Segmented Brackets
    const outerRadius = this.radius * 1.25;
    const bracketGeo = new THREE.BufferGeometry();
    const bracketPositions: number[] = [];
    const numBrackets = 8;
    for (let b = 0; b < numBrackets; b++) {
      const startAng = (b / numBrackets) * Math.PI * 2;
      const endAng = startAng + 0.35;
      bracketPositions.push(
        Math.cos(startAng) * outerRadius, 0.05, Math.sin(startAng) * outerRadius,
        Math.cos(endAng) * outerRadius, 0.05, Math.sin(endAng) * outerRadius
      );
    }
    bracketGeo.setAttribute('position', new THREE.Float32BufferAttribute(bracketPositions, 3));
    this.outerRing = new THREE.LineSegments(
      bracketGeo,
      new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.75 })
    );
    this.group.add(this.outerRing);

    // Corner Alignment Beacons (4 corner light pillars)
    const pylonRadius = this.radius * 1.05;
    const pylonGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.8, 6);
    const pylonMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(
        Math.cos(angle) * pylonRadius,
        0.9,
        Math.sin(angle) * pylonRadius
      );
      this.group.add(pylon);
    }
  }

  public update(deltaSec: number): void {
    // Slowly counter-rotate outer brackets
    this.outerRing.rotation.y -= deltaSec * 0.4;
    this.innerRing.rotation.y += deltaSec * 0.15;
  }

  public checkDocking(shipPos: THREE.Vector3, shipSpeed: number): DockingStatus {
    const dist = shipPos.distanceTo(this.position);
    const inRange = dist <= this.radius;

    if (!inRange) {
      return {
        inRange: false,
        distance: dist,
        canDock: false,
        message: `DOCKING BEACON // DIST: ${dist.toFixed(1)}m`,
      };
    }

    if (shipSpeed > this.maxDockSpeed) {
      return {
        inRange: true,
        distance: dist,
        canDock: false,
        message: `SPEED HIGH (${shipSpeed.toFixed(1)} m/s) // REDUCE < ${this.maxDockSpeed.toFixed(1)}`,
      };
    }

    return {
      inRange: true,
      distance: dist,
      canDock: true,
      message: `IN DOCKING ZONE // PRESS [E] OR [SPACE] TO DOCK`,
    };
  }
}
