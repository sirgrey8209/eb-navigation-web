import * as THREE from 'three';
import { JoystickInput } from '../ui/VirtualJoystick';

export interface PlayerConfig {
  moveSpeed: number;
  radius: number;
  height: number;
  color: number;
}

const DEFAULT_CONFIG: PlayerConfig = {
  moveSpeed: 10,
  radius: 0.5,
  height: 2,
  color: 0x00aaff,
};

export class Player {
  private mesh: THREE.Mesh;
  private config: PlayerConfig;
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private inputState: { forward: boolean; backward: boolean; left: boolean; right: boolean } = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };
  private groundBounds: { min: number; max: number } = { min: -50, max: 50 };
  private joystickInput: JoystickInput | null = null;

  constructor(config: Partial<PlayerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create player mesh (capsule-like shape: cylinder + spheres)
    const geometry = new THREE.CylinderGeometry(
      this.config.radius,
      this.config.radius,
      this.config.height - this.config.radius * 2,
      16
    );
    const material = new THREE.MeshStandardMaterial({
      color: this.config.color,
      metalness: 0.3,
      roughness: 0.7,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Add sphere caps
    const sphereGeom = new THREE.SphereGeometry(this.config.radius, 16, 8);
    const topCap = new THREE.Mesh(sphereGeom, material);
    topCap.position.y = (this.config.height - this.config.radius * 2) / 2;
    this.mesh.add(topCap);

    const bottomCap = new THREE.Mesh(sphereGeom, material);
    bottomCap.position.y = -(this.config.height - this.config.radius * 2) / 2;
    this.mesh.add(bottomCap);

    // Position at center, on ground
    this.mesh.position.set(0, this.config.height / 2, 0);

    // Setup input listeners
    this.setupInputListeners();
  }

  private setupInputListeners(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    // Ignore if typing in input field
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'w':
      case 'arrowup':
        this.inputState.forward = true;
        break;
      case 's':
      case 'arrowdown':
        this.inputState.backward = true;
        break;
      case 'a':
      case 'arrowleft':
        this.inputState.left = true;
        break;
      case 'd':
      case 'arrowright':
        this.inputState.right = true;
        break;
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    switch (event.key.toLowerCase()) {
      case 'w':
      case 'arrowup':
        this.inputState.forward = false;
        break;
      case 's':
      case 'arrowdown':
        this.inputState.backward = false;
        break;
      case 'a':
      case 'arrowleft':
        this.inputState.left = false;
        break;
      case 'd':
      case 'arrowright':
        this.inputState.right = false;
        break;
    }
  };

  /**
   * Set joystick input for mobile controls
   */
  public setJoystickInput(input: JoystickInput | null): void {
    this.joystickInput = input;
  }

  public update(deltaTime: number): void {
    // Calculate movement direction
    this.velocity.set(0, 0, 0);

    // Check joystick input first (mobile)
    if (this.joystickInput && this.joystickInput.active) {
      this.velocity.x = this.joystickInput.x;
      this.velocity.z = this.joystickInput.y;
    } else {
      // Keyboard input (desktop)
      if (this.inputState.forward) this.velocity.z -= 1;
      if (this.inputState.backward) this.velocity.z += 1;
      if (this.inputState.left) this.velocity.x -= 1;
      if (this.inputState.right) this.velocity.x += 1;
    }

    // Normalize and apply speed
    if (this.velocity.length() > 0) {
      // Only normalize for keyboard (joystick already provides magnitude)
      if (!this.joystickInput || !this.joystickInput.active) {
        this.velocity.normalize();
      }
      this.velocity.multiplyScalar(this.config.moveSpeed * deltaTime);

      // Apply movement
      this.mesh.position.x += this.velocity.x;
      this.mesh.position.z += this.velocity.z;

      // Clamp to ground bounds
      this.mesh.position.x = Math.max(
        this.groundBounds.min + this.config.radius,
        Math.min(this.groundBounds.max - this.config.radius, this.mesh.position.x)
      );
      this.mesh.position.z = Math.max(
        this.groundBounds.min + this.config.radius,
        Math.min(this.groundBounds.max - this.config.radius, this.mesh.position.z)
      );
    }
  }

  public setGroundBounds(size: number): void {
    this.groundBounds = { min: -size / 2, max: size / 2 };
  }

  public getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  public getGroundPosition(): THREE.Vector3 {
    return new THREE.Vector3(this.mesh.position.x, 0, this.mesh.position.z);
  }

  public getMesh(): THREE.Mesh {
    return this.mesh;
  }

  public getRadius(): number {
    return this.config.radius;
  }

  public addToScene(scene: THREE.Scene): void {
    scene.add(this.mesh);
  }

  public removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.mesh);
  }

  public setPosition(x: number, z: number): void {
    this.mesh.position.x = x;
    this.mesh.position.z = z;
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
  }
}
