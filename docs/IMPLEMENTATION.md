# EB Navigation Web - 구현 계획서

> **For Claude:** Use `.claude/skills/superpowers/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.
>
> **실행 방법:**
> 1. "Superpowers 스킬로 구현 계획을 실행해줘" 라고 말하면 됩니다
> 2. 각 Phase별로 3개 Task씩 배치로 실행됩니다
> 3. 배치 완료 시 "Ready for feedback" 메시지가 표시됩니다
> 4. 피드백 후 다음 배치를 계속 진행합니다

**Goal:** EB 프로젝트의 NavMesh + 군중 시뮬레이션을 웹에서 프로토타이핑하고 테스트하는 도구 구현

**Architecture:** Three.js 기반 3D 렌더링, recast-navigation-js(WASM)로 NavMesh 생성, Vite 빌드, 반응형 UI

**Tech Stack:** TypeScript, Three.js, recast-navigation-js, Vite, HTML/CSS

---

## 진행 상황

| Phase | 설명 | 상태 |
|-------|------|------|
| Phase 1 | 기본 구조 | ✅ 완료 |
| Phase 2 | 오브젝트 시스템 | ✅ 완료 |
| Phase 3 | NavMesh | ✅ 완료 |
| Phase 4 | 군중 시뮬레이션 | ⏳ 대기 |
| Phase 5 | 최적화 & 완성 | ⏳ 대기 |

---

## Phase 1: 기본 구조 ✅ 완료

### 완료된 Task 목록

| Task | 설명 | 상태 | 커밋 |
|------|------|------|------|
| Task 1 | 프로젝트 초기 설정 (Vite + TypeScript) | ✅ | `c26397f` |
| Task 2 | 기본 HTML 및 진입점 생성 | ✅ | `8071d29` |
| Task 3 | Three.js 씬 설정 | ✅ | `dec66f8` |
| Task 4 | Ground (지면) 구현 | ✅ | `07ccebd` |
| Task 5 | 카메라 컨트롤 구현 | ✅ | `b99733d` |
| Task 6 | 성능 측정 (FPS Counter) | ✅ | `115c95a` |

### 구현된 파일 구조

```
eb-navigation-web/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts
│   ├── style.css
│   ├── core/
│   │   ├── Scene.ts
│   │   └── CameraController.ts
│   ├── objects/
│   │   └── Ground.ts
│   └── utils/
│       └── Profiler.ts
└── docs/
    ├── SPEC.md
    └── IMPLEMENTATION.md
```

### 실행 방법

```bash
cd C:\WorkSpace\eb-navigation-web
npm run dev
# http://localhost:3000 또는 3001에서 확인
```

---

## Phase 2: 오브젝트 시스템 ✅ 완료

### 완료된 Task 목록

| Task | 설명 | 상태 | 커밋 |
|------|------|------|------|
| Task 7 | ObjectManager 기본 구조 | ✅ | `867a7bf` |
| Task 8 | main.ts에 ObjectManager 통합 | ✅ | `867a7bf` |
| Task 9 | TransformHandles 크기 조절 핸들 | ✅ | `867a7bf` |

### 구현된 파일

- `src/types/index.ts` - 타입 정의 (ObjectType, PlacedObject, ObjectManagerEvents)
- `src/objects/ObjectManager.ts` - 오브젝트 배치/선택/삭제 관리
- `src/objects/TransformHandles.ts` - 크기 조절 핸들 (추후 통합 예정)

### 기능

- Cube, Ramp, Cylinder 버튼으로 배치 모드 진입
- 지면 클릭 시 오브젝트 배치
- 오브젝트 클릭 시 선택 (하이라이트)
- Delete 키로 선택된 오브젝트 삭제
- ESC 키로 배치 모드 취소

---

### Task 7: ObjectManager 기본 구조 (상세)

**Files:**
- Create: `src/objects/ObjectManager.ts`
- Create: `src/types/index.ts`

**Step 1: 타입 정의**

Create `src/types/index.ts`:
```typescript
import * as THREE from 'three';

export type ObjectType = 'cube' | 'ramp' | 'cylinder';

export interface PlacedObject {
  id: string;
  type: ObjectType;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  size: THREE.Vector3;
  rotation: THREE.Euler;
}

export interface ObjectManagerEvents {
  onSelect: (object: PlacedObject | null) => void;
  onPlace: (object: PlacedObject) => void;
  onDelete: (id: string) => void;
}
```

**Step 2: ObjectManager 클래스 생성**

Create `src/objects/ObjectManager.ts`:
```typescript
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
    this.domElement.addEventListener('click', this.onClick);
    this.domElement.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('keydown', this.onKeyDown);
  }

  public startPlacement(type: ObjectType): void {
    this.placementMode = type;
    this.clearSelection();
    this.createPreviewMesh(type);
  }

  public cancelPlacement(): void {
    this.placementMode = null;
    if (this.previewMesh) {
      this.scene.remove(this.previewMesh);
      this.previewMesh = null;
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
        // Ramp: custom geometry (wedge shape)
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
    const vertices = new Float32Array([
      // Bottom face
      -width/2, 0, -depth/2,
      width/2, 0, -depth/2,
      width/2, 0, depth/2,
      -width/2, 0, depth/2,
      // Top edge (front)
      -width/2, height, depth/2,
      width/2, height, depth/2,
    ]);

    const indices = [
      // Bottom
      0, 2, 1, 0, 3, 2,
      // Front (tall side)
      3, 5, 4, 3, 2, 5,
      // Back (ground level)
      0, 1, 2, 0, 2, 3,
      // Left side
      0, 4, 3, 0, 4, 0,
      // Right side
      1, 2, 5, 1, 5, 1,
      // Slope
      4, 5, 2, 4, 2, 3,
    ];

    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  private onClick = (event: MouseEvent): void => {
    this.updateMouse(event);

    if (this.placementMode && this.previewMesh) {
      this.placeObject();
    } else {
      this.trySelect();
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
    this.raycaster.ray.intersectPlane(groundPlane, intersection);
    return intersection;
  }

  private updatePreviewPosition(): void {
    const pos = this.getGroundIntersection();
    if (pos && this.previewMesh) {
      this.previewMesh.position.set(pos.x, 1, pos.z); // Offset Y by half height
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

    // Continue placement mode for multiple objects
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

  public dispose(): void {
    this.domElement.removeEventListener('click', this.onClick);
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
```

**Step 3: Commit**

```bash
git add src/types/ src/objects/ObjectManager.ts
git commit -m "feat: add ObjectManager for placing and selecting objects"
```

---

### Task 8: main.ts에 ObjectManager 통합

**Files:**
- Modify: `src/main.ts`
- Modify: `index.html` (이미 버튼 존재)

**Step 1: main.ts 수정**

Modify `src/main.ts` - ObjectManager 통합:
```typescript
// EB Navigation Web - Main Entry Point
import { Scene } from './core/Scene';
import { CameraController } from './core/CameraController';
import { Ground } from './objects/Ground';
import { ObjectManager } from './objects/ObjectManager';
import { Profiler } from './utils/Profiler';
import { PlacedObject } from './types';

console.log('EB Navigation Web - Starting...');

class App {
  private scene: Scene | null = null;
  private cameraController: CameraController | null = null;
  private ground: Ground | null = null;
  private objectManager: ObjectManager | null = null;
  private profiler: Profiler | null = null;
  private animationId: number = 0;

  constructor() {
    console.log('App initialized');
    this.init();
  }

  private init(): void {
    const viewport = document.getElementById('viewport');
    if (!viewport) {
      console.error('Viewport element not found');
      return;
    }

    // Initialize Three.js Scene
    this.scene = new Scene(viewport);

    // Initialize Camera Controller
    this.cameraController = new CameraController(
      this.scene.camera,
      viewport,
      {
        minZoom: 10,
        maxZoom: 200,
        panSpeed: 1,
        zoomSpeed: 0.1,
      }
    );

    // Add ground
    this.ground = new Ground(100, 10);
    this.ground.addToScene(this.scene.scene);

    // Initialize Object Manager
    this.objectManager = new ObjectManager(
      this.scene.scene,
      this.scene.camera,
      viewport,
      {
        onSelect: this.onObjectSelect.bind(this),
        onPlace: this.onObjectPlace.bind(this),
        onDelete: this.onObjectDelete.bind(this),
      }
    );

    // Initialize Profiler
    this.profiler = new Profiler();

    // Start render loop
    this.animate();

    // Setup UI
    this.setupUI();
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.profiler) {
      this.profiler.beginFrame();
    }

    if (this.cameraController) {
      this.cameraController.update();
    }

    if (this.scene) {
      this.scene.render();
    }

    if (this.profiler) {
      this.profiler.endFrame();
    }
  };

  private setupUI(): void {
    // Object buttons
    document.getElementById('btn-cube')?.addEventListener('click', () => {
      this.objectManager?.startPlacement('cube');
      this.setActiveButton('btn-cube');
    });

    document.getElementById('btn-ramp')?.addEventListener('click', () => {
      this.objectManager?.startPlacement('ramp');
      this.setActiveButton('btn-ramp');
    });

    document.getElementById('btn-cylinder')?.addEventListener('click', () => {
      this.objectManager?.startPlacement('cylinder');
      this.setActiveButton('btn-cylinder');
    });

    // Sliders
    this.setupSliders();
  }

  private setActiveButton(activeId: string): void {
    ['btn-cube', 'btn-ramp', 'btn-cylinder'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.toggle('active', id === activeId);
      }
    });
  }

  private onObjectSelect(object: PlacedObject | null): void {
    const info = document.getElementById('selected-info');
    if (info) {
      if (object) {
        info.innerHTML = `
          <p>Selected: ${object.id}</p>
          <p>Type: ${object.type}</p>
          <p>Position: (${object.position.x.toFixed(1)}, ${object.position.z.toFixed(1)})</p>
        `;
      } else {
        info.innerHTML = '<p>Selected: None</p>';
      }
    }
  }

  private onObjectPlace(object: PlacedObject): void {
    console.log('Object placed:', object.id);
  }

  private onObjectDelete(id: string): void {
    console.log('Object deleted:', id);
  }

  private setupSliders(): void {
    const spawnRate = document.getElementById('spawn-rate') as HTMLInputElement;
    const spawnRateValue = document.getElementById('spawn-rate-value');
    const spawnDist = document.getElementById('spawn-dist') as HTMLInputElement;
    const spawnDistValue = document.getElementById('spawn-dist-value');

    if (spawnRate && spawnRateValue) {
      spawnRate.addEventListener('input', () => {
        spawnRateValue.textContent = spawnRate.value;
      });
    }

    if (spawnDist && spawnDistValue) {
      spawnDist.addEventListener('input', () => {
        spawnDistValue.textContent = spawnDist.value;
      });
    }
  }
}

// Start the app
new App();
```

**Step 2: 검증**

Run:
```bash
npm run dev
```
Expected:
- Cube, Ramp, Cylinder 버튼 클릭 시 배치 모드 진입
- 지면 클릭 시 오브젝트 배치
- 오브젝트 클릭 시 선택 (하이라이트)
- Delete 키로 삭제

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: integrate ObjectManager with UI buttons"
```

---

### Task 9: 오브젝트 크기 조절 핸들

**Files:**
- Create: `src/objects/TransformHandles.ts`
- Modify: `src/objects/ObjectManager.ts`

**Step 1: TransformHandles 클래스**

Create `src/objects/TransformHandles.ts`:
```typescript
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
      handleGeometry,
      new THREE.MeshBasicMaterial({ color: colors.x })
    );
    xPosHandle.userData.axis = 'x';
    xPosHandle.userData.direction = 1;
    this.handles.push(xPosHandle);

    const xNegHandle = new THREE.Mesh(
      handleGeometry,
      new THREE.MeshBasicMaterial({ color: colors.x })
    );
    xNegHandle.userData.axis = 'x';
    xNegHandle.userData.direction = -1;
    this.handles.push(xNegHandle);

    // Y handles (up/down - height)
    const yPosHandle = new THREE.Mesh(
      handleGeometry,
      new THREE.MeshBasicMaterial({ color: colors.y })
    );
    yPosHandle.userData.axis = 'y';
    yPosHandle.userData.direction = 1;
    this.handles.push(yPosHandle);

    // Z handles (front/back)
    const zPosHandle = new THREE.Mesh(
      handleGeometry,
      new THREE.MeshBasicMaterial({ color: colors.z })
    );
    zPosHandle.userData.axis = 'z';
    zPosHandle.userData.direction = 1;
    this.handles.push(zPosHandle);

    const zNegHandle = new THREE.Mesh(
      handleGeometry,
      new THREE.MeshBasicMaterial({ color: colors.z })
    );
    zNegHandle.userData.axis = 'z';
    zNegHandle.userData.direction = -1;
    this.handles.push(zNegHandle);

    this.handles.forEach(h => this.scene.add(h));
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

    const pos = this.targetObject.position;
    const size = this.targetObject.size;
    const halfSize = size.clone().multiplyScalar(0.5);

    // X handles
    this.handles[0].position.set(pos.x + halfSize.x + 0.3, pos.y, pos.z);
    this.handles[1].position.set(pos.x - halfSize.x - 0.3, pos.y, pos.z);

    // Y handle (top)
    this.handles[2].position.set(pos.x, pos.y + halfSize.y + 0.3, pos.z);

    // Z handles
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
    this.raycaster.ray.intersectPlane(plane, intersection);

    if (intersection) {
      const delta = intersection.clone().sub(this.dragStart);
      const axisDelta = this.getAxisComponent(delta, axis) * direction;

      if (Math.abs(axisDelta) > 0.1) {
        const newSize = this.targetObject.size.clone();
        this.setAxisComponent(newSize, axis, Math.max(0.5, newSize[axis as keyof THREE.Vector3] as number + axisDelta));

        if (this.onSizeChange) {
          this.onSizeChange(this.targetObject, newSize);
        }

        this.dragStart.copy(intersection);
        this.updateHandlePositions();
      }
    }

    event.stopPropagation();
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
    const pos = this.targetObject?.position || new THREE.Vector3();
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
    return vec[axis as keyof THREE.Vector3] as number;
  }

  private setAxisComponent(vec: THREE.Vector3, axis: string, value: number): void {
    (vec as any)[axis] = value;
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
  }
}
```

**Step 2: Commit**

```bash
git add src/objects/TransformHandles.ts
git commit -m "feat: add transform handles for resizing objects"
```

---

## Phase 3: NavMesh ✅ 완료

### 완료된 Task 목록

| Task | 설명 | 상태 | 커밋 |
|------|------|------|------|
| Task 10 | recast-navigation-js 설치 및 NavMeshBuilder | ✅ | `6eacb8b` |
| Task 11 | NavMesh 시각화 (NavMeshVisualizer) | ✅ | `6eacb8b` |
| Task 12 | NavMesh UI 통합 | ✅ | `6eacb8b` |

### 구현된 파일

- `src/navigation/NavMeshBuilder.ts` - NavMesh 생성 및 경로 탐색
- `src/navigation/NavMeshVisualizer.ts` - NavMesh 시각화

### 기능

- Build NavMesh 버튼으로 NavMesh 생성
- 반투명 초록색 표면 + 노란색 엣지 라인으로 시각화
- 오브젝트 배치/삭제 시 NavMesh 자동 클리어 (재빌드 필요)
- `findPath()` 메서드로 경로 탐색 가능

---

### Task 10: recast-navigation-js 설치 및 초기화 (상세)

**Files:**
- Modify: `package.json`
- Create: `src/navigation/NavMeshBuilder.ts`

**Step 1: 의존성 설치**

```bash
npm install @recast-navigation/core @recast-navigation/generators recast-navigation
```

**Step 2: NavMeshBuilder 클래스**

Create `src/navigation/NavMeshBuilder.ts`:
```typescript
import { init, NavMesh, NavMeshQuery } from 'recast-navigation';
import { generateSoloNavMesh } from '@recast-navigation/generators';
import * as THREE from 'three';
import { PlacedObject } from '../types';

export interface NavMeshConfig {
  cellSize: number;
  cellHeight: number;
  agentRadius: number;
  agentHeight: number;
  agentMaxClimb: number;
  agentMaxSlope: number;
}

const DEFAULT_CONFIG: NavMeshConfig = {
  cellSize: 0.3,
  cellHeight: 0.2,
  agentRadius: 0.5,
  agentHeight: 2.0,
  agentMaxClimb: 0.4,
  agentMaxSlope: 45,
};

export class NavMeshBuilder {
  private navMesh: NavMesh | null = null;
  private navMeshQuery: NavMeshQuery | null = null;
  private config: NavMeshConfig;
  private initialized: boolean = false;

  constructor(config: Partial<NavMeshConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public async initialize(): Promise<void> {
    await init();
    this.initialized = true;
    console.log('Recast Navigation initialized');
  }

  public build(groundSize: number, objects: PlacedObject[]): void {
    if (!this.initialized) {
      console.error('NavMeshBuilder not initialized');
      return;
    }

    // Collect geometry
    const { positions, indices } = this.collectGeometry(groundSize, objects);

    // Generate NavMesh
    const result = generateSoloNavMesh(positions, indices, {
      cs: this.config.cellSize,
      ch: this.config.cellHeight,
      walkableRadius: Math.ceil(this.config.agentRadius / this.config.cellSize),
      walkableHeight: Math.ceil(this.config.agentHeight / this.config.cellHeight),
      walkableClimb: Math.ceil(this.config.agentMaxClimb / this.config.cellHeight),
      walkableSlopeAngle: this.config.agentMaxSlope,
    });

    if (result.success) {
      this.navMesh = result.navMesh;
      this.navMeshQuery = new NavMeshQuery(this.navMesh);
      console.log('NavMesh built successfully');
    } else {
      console.error('Failed to build NavMesh');
    }
  }

  private collectGeometry(groundSize: number, objects: PlacedObject[]): {
    positions: Float32Array;
    indices: Uint32Array;
  } {
    const allPositions: number[] = [];
    const allIndices: number[] = [];
    let indexOffset = 0;

    // Ground plane
    const halfSize = groundSize / 2;
    allPositions.push(
      -halfSize, 0, -halfSize,
      halfSize, 0, -halfSize,
      halfSize, 0, halfSize,
      -halfSize, 0, halfSize
    );
    allIndices.push(0, 2, 1, 0, 3, 2);
    indexOffset = 4;

    // Add objects
    for (const obj of objects) {
      const mesh = obj.mesh;
      const geometry = mesh.geometry;

      const posAttr = geometry.getAttribute('position');
      const indexAttr = geometry.getIndex();

      // Transform positions to world space
      mesh.updateMatrixWorld();
      for (let i = 0; i < posAttr.count; i++) {
        const vertex = new THREE.Vector3(
          posAttr.getX(i),
          posAttr.getY(i),
          posAttr.getZ(i)
        );
        vertex.applyMatrix4(mesh.matrixWorld);
        allPositions.push(vertex.x, vertex.y, vertex.z);
      }

      // Add indices with offset
      if (indexAttr) {
        for (let i = 0; i < indexAttr.count; i++) {
          allIndices.push(indexAttr.getX(i) + indexOffset);
        }
      }

      indexOffset += posAttr.count;
    }

    return {
      positions: new Float32Array(allPositions),
      indices: new Uint32Array(allIndices),
    };
  }

  public getNavMesh(): NavMesh | null {
    return this.navMesh;
  }

  public getNavMeshQuery(): NavMeshQuery | null {
    return this.navMeshQuery;
  }

  public findPath(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] {
    if (!this.navMeshQuery) return [];

    const startRef = this.navMeshQuery.findNearestPoly(start);
    const endRef = this.navMeshQuery.findNearestPoly(end);

    if (!startRef.success || !endRef.success) return [];

    const path = this.navMeshQuery.computePath(startRef.polyRef, endRef.polyRef, start, end);

    if (!path.success) return [];

    return path.path.map(p => new THREE.Vector3(p.x, p.y, p.z));
  }
}
```

**Step 3: Commit**

```bash
git add src/navigation/
git commit -m "feat: add NavMeshBuilder with recast-navigation-js"
```

---

### Task 11: NavMesh 시각화

**Files:**
- Create: `src/navigation/NavMeshVisualizer.ts`

**Step 1: NavMeshVisualizer 클래스**

Create `src/navigation/NavMeshVisualizer.ts`:
```typescript
import * as THREE from 'three';
import { NavMesh } from 'recast-navigation';

export class NavMeshVisualizer {
  private scene: THREE.Scene;
  private meshGroup: THREE.Group;
  private visible: boolean = true;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.meshGroup = new THREE.Group();
    this.meshGroup.name = 'navmesh-visualization';
    this.scene.add(this.meshGroup);
  }

  public update(navMesh: NavMesh): void {
    this.clear();

    const debugDrawer = navMesh.getDebugNavMesh();

    // Create geometry from debug data
    const positions: number[] = [];
    const indices: number[] = [];

    const triangleCount = debugDrawer.triangleCount();
    for (let i = 0; i < triangleCount; i++) {
      const tri = debugDrawer.getTriangle(i);
      const baseIndex = positions.length / 3;

      positions.push(tri.a.x, tri.a.y + 0.05, tri.a.z);
      positions.push(tri.b.x, tri.b.y + 0.05, tri.b.z);
      positions.push(tri.c.x, tri.c.y + 0.05, tri.c.z);

      indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // NavMesh surface (semi-transparent green)
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.meshGroup.add(mesh);

    // Edge lines
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    this.meshGroup.add(edges);
  }

  public clear(): void {
    while (this.meshGroup.children.length > 0) {
      const child = this.meshGroup.children[0];
      this.meshGroup.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.meshGroup.visible = visible;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public dispose(): void {
    this.clear();
    this.scene.remove(this.meshGroup);
  }
}
```

**Step 2: Commit**

```bash
git add src/navigation/NavMeshVisualizer.ts
git commit -m "feat: add NavMesh visualization"
```

---

### Task 12: NavMesh UI 통합

**Files:**
- Modify: `src/main.ts`

**Step 1: main.ts에 NavMesh 기능 추가**

Build NavMesh 버튼과 연동하여 NavMesh 빌드 및 시각화

**Step 2: Commit**

```bash
git add src/main.ts
git commit -m "feat: integrate NavMesh with Build button"
```

---

## Phase 4: 군중 시뮬레이션

### Task 13: Player 구현

**Files:**
- Create: `src/entities/Player.ts`

플레이어 이동 (WASD/화살표), 모바일 조이스틱

### Task 14: Monster & Crowd 시스템

**Files:**
- Create: `src/entities/Monster.ts`
- Create: `src/navigation/CrowdManager.ts`

몬스터 스폰, Crowd 시뮬레이션 연동

### Task 15: GPU Instancing 렌더러

**Files:**
- Create: `src/entities/AgentRenderer.ts`

대량 에이전트 렌더링 최적화

---

## Phase 5: 최적화 & 완성

### Task 16: 성능 프로파일링 개선

**Files:**
- Modify: `src/utils/Profiler.ts`

상세 프로파일링 (Crowd, Render 시간 분리)

### Task 17: 모바일 최적화

**Files:**
- Create: `src/ui/VirtualJoystick.ts`
- Modify: `src/style.css`

터치 조이스틱, 저사양 모드

### Task 18: 최종 테스트 및 빌드

**Step 1: 빌드 검증**

```bash
npm run build
npm run preview
```

**Step 2: 테스트 시나리오**

- 500 에이전트 성능 테스트
- 모바일 브라우저 테스트

---

## 변경 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2025-02-27 | 0.1 | 초안 작성 |
| 2025-02-27 | 0.2 | Phase 1 완료, Phase 2-5 계획 추가 |
| 2026-02-27 | 0.3 | Phase 3 완료 (NavMesh) |
