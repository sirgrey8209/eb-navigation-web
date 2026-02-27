import * as THREE from 'three';
import { PlacedObject } from '../types';

export class TransformHandles {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private domElement: HTMLElement;

  private handles: THREE.Mesh[] = [];
  private activeHandle: THREE.Mesh | null = null;
  private targetObject: PlacedObject | null = null;

  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private isDragging: boolean = false;
  private dragStart: THREE.Vector3 = new THREE.Vector3();

  private onSizeChange: ((object: PlacedObject, newSize: THREE.Vector3) => void) | null = null;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    domElement: HTMLElement
  ) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.createHandles();
    this.setupEventListeners();
    this.hideHandles();
  }

  private createHandles(): void {
    const handleGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const colors = {
      x: 0xff0000, // Red
      y: 0x00ff00, // Green
      z: 0x0000ff, // Blue
    };

    // X handles (left/right)
    const xPosHandle = new THREE.Mesh(
      handleGeometry.clone(),
      new THREE.MeshBasicMaterial({ color: colors.x })
    );
    xPosHandle.userData.axis = 'x';
    xPosHandle.userData.direction = 1;
    this.handles.push(xPosHandle);

    const xNegHandle = new THREE.Mesh(
      handleGeometry.clone(),
      new THREE.MeshBasicMaterial({ color: colors.x })
    );
    xNegHandle.userData.axis = 'x';
    xNegHandle.userData.direction = -1;
    this.handles.push(xNegHandle);

    // Y handle (up - height)
    const yPosHandle = new THREE.Mesh(
      handleGeometry.clone(),
      new THREE.MeshBasicMaterial({ color: colors.y })
    );
    yPosHandle.userData.axis = 'y';
    yPosHandle.userData.direction = 1;
    this.handles.push(yPosHandle);

    // Z handles (front/back)
    const zPosHandle = new THREE.Mesh(
      handleGeometry.clone(),
      new THREE.MeshBasicMaterial({ color: colors.z })
    );
    zPosHandle.userData.axis = 'z';
    zPosHandle.userData.direction = 1;
    this.handles.push(zPosHandle);

    const zNegHandle = new THREE.Mesh(
      handleGeometry.clone(),
      new THREE.MeshBasicMaterial({ color: colors.z })
    );
    zNegHandle.userData.axis = 'z';
    zNegHandle.userData.direction = -1;
    this.handles.push(zNegHandle);

    // Add all handles to scene
    this.handles.forEach(h => this.scene.add(h));

    // Dispose the template geometry
    handleGeometry.dispose();
  }

  private setupEventListeners(): void {
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    this.domElement.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('mouseup', this.onMouseUp);
  }

  public attachTo(object: PlacedObject, onChange: (obj: PlacedObject, size: THREE.Vector3) => void): void {
    this.targetObject = object;
    this.onSizeChange = onChange;
    this.updateHandlePositions();
    this.showHandles();
  }

  public detach(): void {
    this.targetObject = null;
    this.onSizeChange = null;
    this.hideHandles();
  }

  private updateHandlePositions(): void {
    if (!this.targetObject) return;

    const pos = this.targetObject.mesh.position;
    const size = this.targetObject.size;
    const halfSize = size.clone().multiplyScalar(0.5);

    // X handles (left/right)
    this.handles[0].position.set(pos.x + halfSize.x + 0.3, pos.y, pos.z);
    this.handles[1].position.set(pos.x - halfSize.x - 0.3, pos.y, pos.z);

    // Y handle (top)
    this.handles[2].position.set(pos.x, pos.y + halfSize.y + 0.3, pos.z);

    // Z handles (front/back)
    this.handles[3].position.set(pos.x, pos.y, pos.z + halfSize.z + 0.3);
    this.handles[4].position.set(pos.x, pos.y, pos.z - halfSize.z - 0.3);
  }

  private showHandles(): void {
    this.handles.forEach(h => h.visible = true);
  }

  private hideHandles(): void {
    this.handles.forEach(h => h.visible = false);
  }

  private onMouseDown = (event: MouseEvent): void => {
    if (!this.targetObject) return;

    this.updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.handles);
    if (intersects.length > 0) {
      this.activeHandle = intersects[0].object as THREE.Mesh;
      this.isDragging = true;
      this.dragStart.copy(intersects[0].point);
      event.stopPropagation();
      event.preventDefault();
    }
  };

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.isDragging || !this.activeHandle || !this.targetObject) return;

    this.updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Project to appropriate plane based on axis
    const axis = this.activeHandle.userData.axis as string;
    const direction = this.activeHandle.userData.direction as number;

    const plane = this.getAxisPlane(axis);
    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(plane, intersection);

    if (hit) {
      const delta = intersection.clone().sub(this.dragStart);
      const axisDelta = this.getAxisComponent(delta, axis) * direction;

      if (Math.abs(axisDelta) > 0.05) {
        const newSize = this.targetObject.size.clone();
        const currentValue = this.getAxisComponent(newSize, axis);
        const newValue = Math.max(0.5, currentValue + axisDelta);
        this.setAxisComponent(newSize, axis, newValue);

        if (this.onSizeChange) {
          this.onSizeChange(this.targetObject, newSize);
        }

        this.dragStart.copy(intersection);
        this.updateHandlePositions();
      }
    }

    event.stopPropagation();
    event.preventDefault();
  };

  private onMouseUp = (): void => {
    this.isDragging = false;
    this.activeHandle = null;
  };

  private updateMouse(event: MouseEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private getAxisPlane(axis: string): THREE.Plane {
    const pos = this.targetObject?.mesh.position || new THREE.Vector3();
    switch (axis) {
      case 'x':
        return new THREE.Plane(new THREE.Vector3(0, 0, 1), -pos.z);
      case 'y':
        return new THREE.Plane(new THREE.Vector3(0, 0, 1), -pos.z);
      case 'z':
        return new THREE.Plane(new THREE.Vector3(1, 0, 0), -pos.x);
      default:
        return new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    }
  }

  private getAxisComponent(vec: THREE.Vector3, axis: string): number {
    switch (axis) {
      case 'x': return vec.x;
      case 'y': return vec.y;
      case 'z': return vec.z;
      default: return 0;
    }
  }

  private setAxisComponent(vec: THREE.Vector3, axis: string, value: number): void {
    switch (axis) {
      case 'x': vec.x = value; break;
      case 'y': vec.y = value; break;
      case 'z': vec.z = value; break;
    }
  }

  public isHandleDragging(): boolean {
    return this.isDragging;
  }

  public dispose(): void {
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('mouseup', this.onMouseUp);

    this.handles.forEach(h => {
      this.scene.remove(h);
      h.geometry.dispose();
      (h.material as THREE.Material).dispose();
    });
    this.handles = [];
  }
}
