import * as THREE from 'three';

interface CameraControllerOptions {
  minZoom: number;
  maxZoom: number;
  panSpeed: number;
  zoomSpeed: number;
  enableRotation: boolean;
}

const DEFAULT_OPTIONS: CameraControllerOptions = {
  minZoom: 20,
  maxZoom: 200,
  panSpeed: 1,
  zoomSpeed: 0.1,
  enableRotation: false,
};

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private options: CameraControllerOptions;

  // Camera state
  private target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private spherical: THREE.Spherical = new THREE.Spherical();
  private distance: number = 80;

  // Input state
  private isPointerDown: boolean = false;
  private pointerStart: THREE.Vector2 = new THREE.Vector2();
  private pointerDelta: THREE.Vector2 = new THREE.Vector2();
  private lastPointerPosition: THREE.Vector2 = new THREE.Vector2();

  // Touch state for pinch zoom
  private initialPinchDistance: number = 0;
  private initialDistance: number = 0;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    options: Partial<CameraControllerOptions> = {}
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Initialize spherical coordinates from camera position
    this.spherical.setFromVector3(
      camera.position.clone().sub(this.target)
    );
    this.distance = this.spherical.radius;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Mouse events
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    this.domElement.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('mouseup', this.onMouseUp);
    this.domElement.addEventListener('mouseleave', this.onMouseUp);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });

    // Touch events
    this.domElement.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.domElement.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.domElement.addEventListener('touchend', this.onTouchEnd);

    // Prevent context menu
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) { // Left click - pan
      this.isPointerDown = true;
      this.pointerStart.set(event.clientX, event.clientY);
      this.lastPointerPosition.set(event.clientX, event.clientY);
    }
  };

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.isPointerDown) return;

    this.pointerDelta.set(
      event.clientX - this.lastPointerPosition.x,
      event.clientY - this.lastPointerPosition.y
    );

    this.pan(this.pointerDelta.x, this.pointerDelta.y);

    this.lastPointerPosition.set(event.clientX, event.clientY);
  };

  private onMouseUp = (): void => {
    this.isPointerDown = false;
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();

    const delta = event.deltaY > 0 ? 1 : -1;
    this.zoom(delta);
  };

  private onTouchStart = (event: TouchEvent): void => {
    event.preventDefault();

    if (event.touches.length === 1) {
      // Single touch - pan
      this.isPointerDown = true;
      this.pointerStart.set(event.touches[0].clientX, event.touches[0].clientY);
      this.lastPointerPosition.set(event.touches[0].clientX, event.touches[0].clientY);
    } else if (event.touches.length === 2) {
      // Two touches - pinch zoom
      this.isPointerDown = false;
      this.initialPinchDistance = this.getPinchDistance(event.touches);
      this.initialDistance = this.distance;
    }
  };

  private onTouchMove = (event: TouchEvent): void => {
    event.preventDefault();

    if (event.touches.length === 1 && this.isPointerDown) {
      // Single touch - pan
      this.pointerDelta.set(
        event.touches[0].clientX - this.lastPointerPosition.x,
        event.touches[0].clientY - this.lastPointerPosition.y
      );

      this.pan(this.pointerDelta.x, this.pointerDelta.y);

      this.lastPointerPosition.set(event.touches[0].clientX, event.touches[0].clientY);
    } else if (event.touches.length === 2) {
      // Pinch zoom
      const currentPinchDistance = this.getPinchDistance(event.touches);
      const ratio = this.initialPinchDistance / currentPinchDistance;
      this.distance = THREE.MathUtils.clamp(
        this.initialDistance * ratio,
        this.options.minZoom,
        this.options.maxZoom
      );
      this.updateCameraPosition();
    }
  };

  private onTouchEnd = (): void => {
    this.isPointerDown = false;
  };

  private getPinchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private pan(deltaX: number, deltaY: number): void {
    // Calculate pan direction based on camera orientation
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const panOffset = new THREE.Vector3();
    panOffset.addScaledVector(right, -deltaX * this.options.panSpeed * this.distance * 0.002);
    panOffset.addScaledVector(forward, deltaY * this.options.panSpeed * this.distance * 0.002);

    this.target.add(panOffset);
    this.updateCameraPosition();
  }

  private zoom(delta: number): void {
    const zoomFactor = 1 + delta * this.options.zoomSpeed;
    this.distance = THREE.MathUtils.clamp(
      this.distance * zoomFactor,
      this.options.minZoom,
      this.options.maxZoom
    );
    this.updateCameraPosition();
  }

  private updateCameraPosition(): void {
    const offset = new THREE.Vector3();
    offset.setFromSpherical(this.spherical);
    offset.normalize().multiplyScalar(this.distance);

    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  public update(): void {
    // Called every frame if needed for smooth transitions
  }

  public dispose(): void {
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('mouseup', this.onMouseUp);
    this.domElement.removeEventListener('mouseleave', this.onMouseUp);
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.domElement.removeEventListener('touchstart', this.onTouchStart);
    this.domElement.removeEventListener('touchmove', this.onTouchMove);
    this.domElement.removeEventListener('touchend', this.onTouchEnd);
  }
}
