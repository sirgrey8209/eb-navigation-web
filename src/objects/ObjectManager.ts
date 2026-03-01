import * as THREE from 'three';
import { ObjectType, PlacedObject, ObjectManagerEvents } from '../types';

export class ObjectManager {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  private objects: Map<string, PlacedObject> = new Map();
  private selectedObject: PlacedObject | null = null;
  private placementMode: ObjectType | null = null;
  private previewMesh: THREE.Mesh | null = null;

  private events: ObjectManagerEvents;
  private objectIdCounter: number = 0;

  // Drag placement state
  private dragStartPos: THREE.Vector2 = new THREE.Vector2();
  private onCancelPlacementCallback: (() => void) | null = null;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    domElement: HTMLElement,
    events: ObjectManagerEvents
  ) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.events = events;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    this.domElement.addEventListener('mouseup', this.onMouseUp);
    this.domElement.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
  }

  public startPlacement(type: ObjectType, onCancel?: () => void): void {
    this.placementMode = type;
    this.onCancelPlacementCallback = onCancel || null;
    this.clearSelection();
    this.createPreviewMesh(type);
  }

  public cancelPlacement(): void {
    if (this.placementMode) {
      this.placementMode = null;
      if (this.previewMesh) {
        this.scene.remove(this.previewMesh);
        this.previewMesh.geometry.dispose();
        (this.previewMesh.material as THREE.Material).dispose();
        this.previewMesh = null;
      }
      // Notify callback (to reset button state)
      if (this.onCancelPlacementCallback) {
        this.onCancelPlacementCallback();
        this.onCancelPlacementCallback = null;
      }
    }
  }

  private createPreviewMesh(type: ObjectType): void {
    const geometry = this.getGeometry(type);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4ecca3,
      transparent: true,
      opacity: 0.5,
    });
    this.previewMesh = new THREE.Mesh(geometry, material);
    this.previewMesh.castShadow = true;
    this.scene.add(this.previewMesh);
  }

  private getGeometry(type: ObjectType, size?: THREE.Vector3): THREE.BufferGeometry {
    const s = size || new THREE.Vector3(2, 2, 2);
    switch (type) {
      case 'cube':
        return new THREE.BoxGeometry(s.x, s.y, s.z);
      case 'ramp':
        return this.createRampGeometry(s.x, s.y, s.z);
      case 'cylinder':
        return new THREE.CylinderGeometry(s.x / 2, s.x / 2, s.y, 16);
      default:
        return new THREE.BoxGeometry(s.x, s.y, s.z);
    }
  }

  private createRampGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    // Wedge shape vertices
    const hw = width / 2;
    const hd = depth / 2;

    const vertices = new Float32Array([
      // Bottom face (y = 0)
      -hw, 0, -hd,  // 0: back-left
       hw, 0, -hd,  // 1: back-right
       hw, 0,  hd,  // 2: front-right
      -hw, 0,  hd,  // 3: front-left
      // Top edge (y = height, z = front)
      -hw, height, hd,  // 4: top-front-left
       hw, height, hd,  // 5: top-front-right
    ]);

    const indices = new Uint16Array([
      // Bottom face
      0, 2, 1,
      0, 3, 2,
      // Front face (tall vertical side)
      3, 5, 4,
      3, 2, 5,
      // Back face (at ground level, triangle)
      0, 1, 5,
      0, 5, 4,
      // Left side (triangle)
      0, 4, 3,
      // Right side (triangle)
      1, 2, 5,
      // Slope (top surface)
      4, 5, 2,
      4, 2, 3,
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    return geometry;
  }

  private onMouseDown = (event: MouseEvent): void => {
    // Only handle left click
    if (event.button !== 0) return;

    // Ignore if clicking on UI elements
    if ((event.target as HTMLElement).closest('#panels, #header, #performance-panel')) {
      return;
    }

    this.dragStartPos.set(event.clientX, event.clientY);
  };

  private onMouseUp = (event: MouseEvent): void => {
    // Only handle left click
    if (event.button !== 0) return;

    // Ignore if clicking on UI elements
    if ((event.target as HTMLElement).closest('#panels, #header, #performance-panel')) {
      return;
    }

    // Check if it was a drag (moved more than 5px)
    const dx = event.clientX - this.dragStartPos.x;
    const dy = event.clientY - this.dragStartPos.y;
    const wasDrag = Math.sqrt(dx * dx + dy * dy) > 5;

    this.updateMouse(event);

    if (this.placementMode && this.previewMesh) {
      // In placement mode: place on click OR drag release
      this.placeObject();
    } else if (!wasDrag) {
      // Not in placement mode: select only on click (not drag)
      this.trySelect();
    }
  };

  private onContextMenu = (event: MouseEvent): void => {
    // Prevent default context menu
    event.preventDefault();

    // Cancel placement mode on right-click
    if (this.placementMode) {
      this.cancelPlacement();
    }
  };

  private onMouseMove = (event: MouseEvent): void => {
    this.updateMouse(event);

    if (this.placementMode && this.previewMesh) {
      this.updatePreviewPosition();
    }
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.deleteSelected();
    } else if (event.key === 'Escape') {
      this.cancelPlacement();
      this.clearSelection();
    }
  };

  private updateMouse(event: MouseEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private getGroundIntersection(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    const result = this.raycaster.ray.intersectPlane(groundPlane, intersection);
    return result ? intersection : null;
  }

  private updatePreviewPosition(): void {
    const pos = this.getGroundIntersection();
    if (pos && this.previewMesh) {
      this.previewMesh.position.set(pos.x, 1, pos.z);
    }
  }

  private placeObject(): void {
    if (!this.placementMode || !this.previewMesh) return;

    const id = `${this.placementMode}_${++this.objectIdCounter}`;
    const size = new THREE.Vector3(2, 2, 2);

    const geometry = this.getGeometry(this.placementMode, size);
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(this.previewMesh.position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.objectId = id;

    this.scene.add(mesh);

    const placedObject: PlacedObject = {
      id,
      type: this.placementMode,
      mesh,
      position: mesh.position.clone(),
      size,
      rotation: mesh.rotation.clone(),
    };

    this.objects.set(id, placedObject);
    this.events.onPlace(placedObject);
  }

  private trySelect(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const meshes = Array.from(this.objects.values()).map(o => o.mesh);
    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      const id = mesh.userData.objectId;
      const obj = this.objects.get(id);
      if (obj) {
        this.selectObject(obj);
      }
    } else {
      this.clearSelection();
    }
  }

  private selectObject(obj: PlacedObject): void {
    this.clearSelection();
    this.selectedObject = obj;

    // Highlight selected object
    const material = obj.mesh.material as THREE.MeshStandardMaterial;
    material.emissive.setHex(0x444400);

    this.events.onSelect(obj);
  }

  public clearSelection(): void {
    if (this.selectedObject) {
      const material = this.selectedObject.mesh.material as THREE.MeshStandardMaterial;
      material.emissive.setHex(0x000000);
    }
    this.selectedObject = null;
    this.events.onSelect(null);
  }

  public deleteSelected(): void {
    if (!this.selectedObject) return;

    const id = this.selectedObject.id;
    this.scene.remove(this.selectedObject.mesh);
    this.selectedObject.mesh.geometry.dispose();
    (this.selectedObject.mesh.material as THREE.Material).dispose();
    this.objects.delete(id);
    this.events.onDelete(id);
    this.selectedObject = null;
    this.events.onSelect(null);
  }

  public getObjects(): PlacedObject[] {
    return Array.from(this.objects.values());
  }

  public getSelectedObject(): PlacedObject | null {
    return this.selectedObject;
  }

  public isPlacementMode(): boolean {
    return this.placementMode !== null;
  }

  public dispose(): void {
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('mouseup', this.onMouseUp);
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);

    // Clean up preview mesh
    this.cancelPlacement();

    // Clean up all placed objects
    this.objects.forEach(obj => {
      this.scene.remove(obj.mesh);
      obj.mesh.geometry.dispose();
      (obj.mesh.material as THREE.Material).dispose();
    });
    this.objects.clear();
  }
}
