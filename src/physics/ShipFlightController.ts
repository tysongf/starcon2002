import * as THREE from 'three';

export interface FlightInputState {
  forward: boolean;
  reverse: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  brake: boolean;
}

export interface FlightTelemetry {
  speed: number;
  maxSpeed: number;
  throttle: number;         // -1.0 to 1.0
  headingDeg: number;       // 0 to 360
  inertiaDampeners: boolean;
  isThrusting: boolean;
  isReversing: boolean;
  isTurningLeft: boolean;
  isTurningRight: boolean;
}

/**
 * 2D Newtonian Flight Controller operating on the 3D X/Z orbital plane.
 * Inspired by Star Control II melee physics: rotational inertia, directional
 * thrust vectors, and configurable inertia dampeners.
 */
export class ShipFlightController {
  // Positional and Kinematic State
  public readonly position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public readonly velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public yaw: number = 0;              // Facing angle in radians (0 = along +Z axis)
  public angularVelocity: number = 0; // Radians per second

  // Flight Tuning Parameters
  public maxSpeed: number = 28.0;              // Maximum linear speed (units/sec)
  public acceleration: number = 22.0;          // Forward thrust acceleration (units/sec²)
  public reverseAcceleration: number = 12.0;   // Retro-thruster acceleration (units/sec²)
  public turnSpeed: number = 3.6;              // Angular turn acceleration (rad/sec²)
  public maxTurnRate: number = 3.2;            // Maximum angular velocity (rad/sec)
  public angularDrag: number = 0.88;           // Natural angular friction
  public linearFriction: number = 0.998;       // Deep space vacuum drag
  public dampenerBrakeRate: number = 0.975;    // Active inertia dampening factor

  public inertiaDampeners: boolean = true;     // Flight-assist toggle

  // Current inputs
  private inputs: FlightInputState = {
    forward: false,
    reverse: false,
    turnLeft: false,
    turnRight: false,
    brake: false,
  };

  private currentThrottle: number = 0;

  constructor(initialPos?: THREE.Vector3, initialYaw?: number) {
    if (initialPos) this.position.copy(initialPos);
    if (initialYaw !== undefined) this.yaw = initialYaw;
  }

  /**
   * Updates keypress inputs
   */
  public setInput(input: keyof FlightInputState, active: boolean): void {
    this.inputs[input] = active;
  }

  public toggleDampeners(): boolean {
    this.inertiaDampeners = !this.inertiaDampeners;
    return this.inertiaDampeners;
  }

  public reset(pos: THREE.Vector3 = new THREE.Vector3(0, 0, 0)): void {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.angularVelocity = 0;
    this.currentThrottle = 0;
  }

  /**
   * Physics Integration Tick (Fixed delta time or variable delta time in seconds)
   */
  public update(deltaSec: number): void {
    // Clamp delta time to avoid physics tunneling during tab switches
    const dt = Math.min(deltaSec, 0.1);

    // 1. Angular Steering Integration
    let turnInput = 0;
    if (this.inputs.turnLeft) turnInput += 1;
    if (this.inputs.turnRight) turnInput -= 1;

    if (turnInput !== 0) {
      this.angularVelocity += turnInput * this.turnSpeed * dt;
      this.angularVelocity = THREE.MathUtils.clamp(
        this.angularVelocity,
        -this.maxTurnRate,
        this.maxTurnRate
      );
    } else {
      this.angularVelocity *= Math.pow(this.angularDrag, dt * 60);
      if (Math.abs(this.angularVelocity) < 0.001) this.angularVelocity = 0;
    }

    this.yaw += this.angularVelocity * dt;
    // Normalize yaw to [0, 2*PI)
    this.yaw = (this.yaw + Math.PI * 2) % (Math.PI * 2);

    // Forward Direction Vector on X/Z plane (0 rad = +Z)
    const forwardX = Math.sin(this.yaw);
    const forwardZ = Math.cos(this.yaw);

    // 2. Linear Thrust & Acceleration
    let targetThrottle = 0;
    if (this.inputs.forward) targetThrottle += 1;
    if (this.inputs.reverse) targetThrottle -= 0.6;

    // Smooth throttle interpolation
    this.currentThrottle = THREE.MathUtils.lerp(this.currentThrottle, targetThrottle, dt * 15);

    if (this.inputs.forward) {
      this.velocity.x += forwardX * this.acceleration * dt;
      this.velocity.z += forwardZ * this.acceleration * dt;
    } else if (this.inputs.reverse) {
      this.velocity.x -= forwardX * this.reverseAcceleration * dt;
      this.velocity.z -= forwardZ * this.reverseAcceleration * dt;
    }

    // 3. Emergency All-Stop Brake
    if (this.inputs.brake) {
      const brakeFactor = Math.pow(0.85, dt * 60);
      this.velocity.multiplyScalar(brakeFactor);
      if (this.velocity.lengthSq() < 0.01) this.velocity.set(0, 0, 0);
    }
    // 4. Inertia Dampeners (Flight Assist)
    else if (this.inertiaDampeners && !this.inputs.forward && !this.inputs.reverse) {
      const dampFactor = Math.pow(this.dampenerBrakeRate, dt * 60);
      this.velocity.multiplyScalar(dampFactor);
      if (this.velocity.lengthSq() < 0.005) this.velocity.set(0, 0, 0);
    } else {
      // Natural vacuum micro-friction
      this.velocity.multiplyScalar(Math.pow(this.linearFriction, dt * 60));
    }

    // 5. Cap Maximum Speed
    const currentSpeedSq = this.velocity.lengthSq();
    if (currentSpeedSq > this.maxSpeed * this.maxSpeed) {
      this.velocity.normalize().multiplyScalar(this.maxSpeed);
    }

    // 6. Integrate Position
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y = 0; // Locked to orbital plane
  }

  /**
   * Returns live telemetry readings
   */
  public getTelemetry(): FlightTelemetry {
    const speed = this.velocity.length();
    const headingDeg = Math.round((this.yaw * 180) / Math.PI) % 360;

    return {
      speed,
      maxSpeed: this.maxSpeed,
      throttle: this.currentThrottle,
      headingDeg,
      inertiaDampeners: this.inertiaDampeners,
      isThrusting: this.inputs.forward,
      isReversing: this.inputs.reverse,
      isTurningLeft: this.inputs.turnLeft,
      isTurningRight: this.inputs.turnRight,
    };
  }
}
