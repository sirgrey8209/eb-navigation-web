# Phase 1: 기본 구조 구현 계획

> **For Claude:** Use `.claude/skills/superpowers/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Vite + TypeScript + Three.js 프로젝트를 설정하고, 쿼터뷰 3D 뷰포트와 기본 UI 레이아웃을 구현한다.

**Architecture:** Three.js 기반 3D 렌더링 엔진을 사용하여 쿼터뷰 카메라와 그리드 지면을 구현. Vite로 빌드하고, 반응형 CSS로 PC/모바일 레이아웃을 지원한다.

**Tech Stack:** TypeScript, Three.js, Vite, HTML/CSS

---

## Task 1: 프로젝트 초기 설정

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `.gitignore` (update)

**Step 1: npm 프로젝트 초기화**

Run:
```bash
npm init -y
```
Expected: `package.json` 생성됨

**Step 2: 의존성 설치**

Run:
```bash
npm install three @types/three
npm install -D typescript vite
```
Expected: `node_modules/` 생성, `package.json`에 dependencies 추가됨

**Step 3: TypeScript 설정 생성**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

**Step 4: Vite 설정 생성**

Create `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 3000,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
});
```

**Step 5: package.json scripts 업데이트**

Modify `package.json` - scripts 섹션:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

**Step 6: .gitignore 업데이트**

Update `.gitignore`:
```
node_modules/
dist/
.DS_Store
*.local
```

**Step 7: 검증**

Run:
```bash
npx tsc --version
```
Expected: TypeScript 버전 출력

**Step 8: Commit**

```bash
git add package.json tsconfig.json vite.config.ts .gitignore package-lock.json
git commit -m "chore: initialize Vite + TypeScript project"
```

---

## Task 2: 기본 HTML 및 진입점 생성

**Files:**
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/style.css`

**Step 1: HTML 파일 생성**

Create `index.html`:
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>EB Navigation Web</title>
  <link rel="stylesheet" href="/src/style.css">
</head>
<body>
  <div id="app">
    <!-- Header -->
    <header id="header">
      <div class="logo">EB Navigation Web</div>
      <div class="header-actions">
        <button id="btn-settings" title="Settings">⚙️</button>
        <button id="btn-fullscreen" title="Fullscreen">⛶</button>
      </div>
    </header>

    <!-- Main Content -->
    <main id="main">
      <!-- 3D Viewport -->
      <div id="viewport"></div>

      <!-- Bottom Panels -->
      <div id="panels">
        <!-- Object Panel -->
        <div id="object-panel" class="panel">
          <h3>Objects</h3>
          <div class="object-buttons">
            <button id="btn-cube" class="object-btn">🔲 Cube</button>
            <button id="btn-ramp" class="object-btn">📐 Ramp</button>
            <button id="btn-cylinder" class="object-btn">⭕ Cylinder</button>
          </div>
          <div id="selected-info" class="selected-info">
            <p>Selected: None</p>
          </div>
        </div>

        <!-- Control Panel -->
        <div id="control-panel" class="panel">
          <h3>Controls</h3>
          <div class="control-buttons">
            <button id="btn-build">Build NavMesh</button>
            <button id="btn-start">Start</button>
            <button id="btn-stop" disabled>Stop</button>
            <button id="btn-reset">Reset</button>
          </div>
          <div class="sliders">
            <div class="slider-group">
              <label>Spawn Rate: <span id="spawn-rate-value">10</span>/s</label>
              <input type="range" id="spawn-rate" min="1" max="50" value="10">
            </div>
            <div class="slider-group">
              <label>Spawn Distance: <span id="spawn-dist-value">30</span>m</label>
              <input type="range" id="spawn-dist" min="10" max="50" value="30">
            </div>
          </div>
        </div>
      </div>

      <!-- Performance Panel -->
      <div id="performance-panel" class="panel">
        <span>FPS: <span id="fps">0</span></span>
        <span>Agents: <span id="agent-count">0</span></span>
        <span>Frame: <span id="frame-time">0</span>ms</span>
      </div>
    </main>
  </div>

  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

**Step 2: 기본 CSS 생성**

Create `src/style.css`:
```css
/* Reset & Base */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e;
  color: #eee;
}

#app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

/* Header */
#header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #16213e;
  border-bottom: 1px solid #0f3460;
  height: 48px;
  flex-shrink: 0;
}

.logo {
  font-size: 18px;
  font-weight: bold;
  color: #e94560;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-actions button {
  background: transparent;
  border: 1px solid #0f3460;
  color: #eee;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.header-actions button:hover {
  background: #0f3460;
}

/* Main Content */
#main {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

/* Viewport */
#viewport {
  flex: 1;
  background: #0a0a15;
  position: relative;
}

#viewport canvas {
  display: block;
}

/* Panels Container */
#panels {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: #16213e;
  border-top: 1px solid #0f3460;
}

/* Panel Base */
.panel {
  background: #1a1a2e;
  border: 1px solid #0f3460;
  border-radius: 8px;
  padding: 12px;
}

.panel h3 {
  font-size: 14px;
  margin-bottom: 8px;
  color: #e94560;
}

/* Object Panel */
#object-panel {
  flex: 1;
}

.object-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.object-btn {
  background: #0f3460;
  border: none;
  color: #eee;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.object-btn:hover {
  background: #e94560;
}

.object-btn.active {
  background: #e94560;
}

.selected-info {
  margin-top: 8px;
  font-size: 12px;
  color: #888;
}

/* Control Panel */
#control-panel {
  flex: 1.5;
}

.control-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.control-buttons button {
  background: #0f3460;
  border: none;
  color: #eee;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.control-buttons button:hover:not(:disabled) {
  background: #e94560;
}

.control-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sliders {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slider-group label {
  font-size: 12px;
  color: #888;
}

.slider-group input[type="range"] {
  width: 100%;
  accent-color: #e94560;
}

/* Performance Panel */
#performance-panel {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  font-size: 12px;
  background: rgba(22, 33, 62, 0.9);
  border-radius: 4px;
  z-index: 10;
}

#performance-panel span {
  color: #888;
}

#fps, #agent-count, #frame-time {
  color: #4ecca3;
  font-weight: bold;
}

/* Responsive - Mobile */
@media (max-width: 768px) {
  #header {
    padding: 8px 12px;
    height: 44px;
  }

  .logo {
    font-size: 14px;
  }

  #panels {
    flex-direction: column;
    max-height: 45vh;
    overflow-y: auto;
  }

  .panel {
    padding: 8px;
  }

  .control-buttons {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }

  #performance-panel {
    position: fixed;
    bottom: auto;
    top: 52px;
    font-size: 10px;
    padding: 4px 8px;
  }
}
```

**Step 3: main.ts 진입점 생성**

Create `src/main.ts`:
```typescript
// EB Navigation Web - Main Entry Point

console.log('EB Navigation Web - Starting...');

// App initialization will be added here
class App {
  constructor() {
    console.log('App initialized');
    this.init();
  }

  private init(): void {
    // Placeholder - Three.js scene will be initialized here
    const viewport = document.getElementById('viewport');
    if (viewport) {
      viewport.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;">3D Viewport (Three.js will be initialized here)</div>';
    }

    // Update slider values display
    this.setupSliders();
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

**Step 4: 개발 서버 실행 테스트**

Run:
```bash
npm run dev
```
Expected: Vite 개발 서버 시작, `http://localhost:3000`에서 접근 가능

**Step 5: 브라우저에서 확인**

확인 사항:
- 헤더가 표시됨
- Object Panel, Control Panel이 보임
- Performance Panel이 하단에 표시됨
- 슬라이더 값이 변경됨

**Step 6: Commit**

```bash
git add index.html src/
git commit -m "feat: add basic HTML structure and CSS layout"
```

---

## Task 3: Three.js 씬 설정

**Files:**
- Create: `src/core/Scene.ts`
- Modify: `src/main.ts`

**Step 1: Scene 클래스 생성**

Create `src/core/Scene.ts`:
```typescript
import * as THREE from 'three';

export class Scene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  private container: HTMLElement;
  private width: number;
  private height: number;

  constructor(container: HTMLElement) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Camera (Perspective for quarter view)
    this.camera = new THREE.PerspectiveCamera(
      35, // Low FOV for isometric-like feel
      this.width / this.height,
      0.1,
      1000
    );
    this.setupCamera();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // Lighting
    this.setupLights();

    // Handle resize
    window.addEventListener('resize', this.onResize.bind(this));
  }

  private setupCamera(): void {
    // Quarter view position: 45° yaw, 45-60° pitch
    const distance = 80;
    const angle = Math.PI / 4; // 45°
    const pitch = Math.PI / 4; // 45°

    this.camera.position.set(
      Math.cos(angle) * Math.cos(pitch) * distance,
      Math.sin(pitch) * distance,
      Math.sin(angle) * Math.cos(pitch) * distance
    );
    this.camera.lookAt(0, 0, 0);
  }

  private setupLights(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);

    // Hemisphere light for sky/ground color
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x362312, 0.3);
    this.scene.add(hemisphereLight);
  }

  private onResize(): void {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResize.bind(this));
    this.renderer.dispose();
  }
}
```

**Step 2: main.ts에서 Scene 사용**

Modify `src/main.ts`:
```typescript
// EB Navigation Web - Main Entry Point
import { Scene } from './core/Scene';

console.log('EB Navigation Web - Starting...');

class App {
  private scene: Scene | null = null;
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

    // Start render loop
    this.animate();

    // Setup UI
    this.setupSliders();
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.scene) {
      this.scene.render();
    }
  };

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

**Step 3: 검증**

Run:
```bash
npm run dev
```
Expected: 뷰포트에 어두운 배경색이 보이고, 개발자 콘솔에 에러 없음

**Step 4: Commit**

```bash
git add src/core/
git commit -m "feat: add Three.js scene with camera and lighting"
```

---

## Task 4: Ground (지면) 구현

**Files:**
- Create: `src/objects/Ground.ts`
- Modify: `src/main.ts`

**Step 1: Ground 클래스 생성**

Create `src/objects/Ground.ts`:
```typescript
import * as THREE from 'three';

export class Ground {
  public mesh: THREE.Mesh;
  public gridHelper: THREE.GridHelper;

  private size: number;
  private gridDivisions: number;

  constructor(size: number = 100, gridDivisions: number = 10) {
    this.size = size;
    this.gridDivisions = gridDivisions;

    // Ground plane
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshStandardMaterial({
      color: 0xe0e0e0,
      roughness: 0.8,
      metalness: 0.1,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    this.mesh.receiveShadow = true;
    this.mesh.name = 'ground';

    // Grid helper
    this.gridHelper = new THREE.GridHelper(
      size,
      gridDivisions,
      0x444444, // Center line color
      0x333333  // Grid line color
    );
  }

  public addToScene(scene: THREE.Scene): void {
    scene.add(this.mesh);
    scene.add(this.gridHelper);
  }

  public removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    scene.remove(this.gridHelper);
  }

  public getSize(): number {
    return this.size;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.gridHelper.dispose();
  }
}
```

**Step 2: main.ts에서 Ground 추가**

Modify `src/main.ts`:
```typescript
// EB Navigation Web - Main Entry Point
import { Scene } from './core/Scene';
import { Ground } from './objects/Ground';

console.log('EB Navigation Web - Starting...');

class App {
  private scene: Scene | null = null;
  private ground: Ground | null = null;
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

    // Add ground
    this.ground = new Ground(100, 10);
    this.ground.addToScene(this.scene.scene);

    // Start render loop
    this.animate();

    // Setup UI
    this.setupSliders();
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.scene) {
      this.scene.render();
    }
  };

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

**Step 3: 검증**

Run:
```bash
npm run dev
```
Expected: 뷰포트에 회색 지면과 그리드가 쿼터뷰로 보임

**Step 4: Commit**

```bash
git add src/objects/
git commit -m "feat: add ground plane with grid"
```

---

## Task 5: 카메라 컨트롤 구현

**Files:**
- Create: `src/core/CameraController.ts`
- Modify: `src/main.ts`

**Step 1: CameraController 클래스 생성**

Create `src/core/CameraController.ts`:
```typescript
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
```

**Step 2: main.ts에서 CameraController 사용**

Modify `src/main.ts`:
```typescript
// EB Navigation Web - Main Entry Point
import { Scene } from './core/Scene';
import { CameraController } from './core/CameraController';
import { Ground } from './objects/Ground';

console.log('EB Navigation Web - Starting...');

class App {
  private scene: Scene | null = null;
  private cameraController: CameraController | null = null;
  private ground: Ground | null = null;
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

    // Start render loop
    this.animate();

    // Setup UI
    this.setupSliders();
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.cameraController) {
      this.cameraController.update();
    }

    if (this.scene) {
      this.scene.render();
    }
  };

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

**Step 3: 검증**

Run:
```bash
npm run dev
```
Expected:
- 마우스 드래그로 카메라 패닝 가능
- 마우스 휠로 줌 인/아웃 가능
- 터치 디바이스에서 한 손가락 드래그로 패닝, 두 손가락 핀치로 줌 가능

**Step 4: Commit**

```bash
git add src/core/CameraController.ts src/main.ts
git commit -m "feat: add camera controller with pan and zoom"
```

---

## Task 6: 성능 측정 (FPS Counter)

**Files:**
- Create: `src/utils/Profiler.ts`
- Modify: `src/main.ts`

**Step 1: Profiler 클래스 생성**

Create `src/utils/Profiler.ts`:
```typescript
export class Profiler {
  private fpsElement: HTMLElement | null;
  private frameTimeElement: HTMLElement | null;
  private agentCountElement: HTMLElement | null;

  private frameCount: number = 0;
  private lastTime: number = performance.now();
  private fps: number = 0;
  private frameTime: number = 0;

  constructor() {
    this.fpsElement = document.getElementById('fps');
    this.frameTimeElement = document.getElementById('frame-time');
    this.agentCountElement = document.getElementById('agent-count');
  }

  public beginFrame(): void {
    this.frameCount++;
  }

  public endFrame(): void {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;

    if (deltaTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameTime = Math.round(deltaTime / this.frameCount * 100) / 100;

      this.updateDisplay();

      this.frameCount = 0;
      this.lastTime = currentTime;
    }
  }

  public setAgentCount(count: number): void {
    if (this.agentCountElement) {
      this.agentCountElement.textContent = count.toString();
    }
  }

  private updateDisplay(): void {
    if (this.fpsElement) {
      this.fpsElement.textContent = this.fps.toString();

      // Color based on performance
      if (this.fps >= 55) {
        this.fpsElement.style.color = '#4ecca3'; // Green
      } else if (this.fps >= 30) {
        this.fpsElement.style.color = '#f9ed69'; // Yellow
      } else {
        this.fpsElement.style.color = '#f38181'; // Red
      }
    }

    if (this.frameTimeElement) {
      this.frameTimeElement.textContent = this.frameTime.toFixed(1);
    }
  }

  public getFPS(): number {
    return this.fps;
  }

  public getFrameTime(): number {
    return this.frameTime;
  }
}
```

**Step 2: main.ts에서 Profiler 사용**

Modify `src/main.ts`:
```typescript
// EB Navigation Web - Main Entry Point
import { Scene } from './core/Scene';
import { CameraController } from './core/CameraController';
import { Ground } from './objects/Ground';
import { Profiler } from './utils/Profiler';

console.log('EB Navigation Web - Starting...');

class App {
  private scene: Scene | null = null;
  private cameraController: CameraController | null = null;
  private ground: Ground | null = null;
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

    // Initialize Profiler
    this.profiler = new Profiler();

    // Start render loop
    this.animate();

    // Setup UI
    this.setupSliders();
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

**Step 3: 검증**

Run:
```bash
npm run dev
```
Expected:
- Performance Panel에 FPS 값이 실시간으로 표시됨
- FPS가 55 이상이면 초록색, 30-55는 노란색, 30 미만은 빨간색

**Step 4: Commit**

```bash
git add src/utils/
git commit -m "feat: add FPS profiler and performance display"
```

---

## Summary

Phase 1 완료 후 결과물:
- ✅ Vite + TypeScript 프로젝트 설정
- ✅ 기본 HTML/CSS 레이아웃 (반응형)
- ✅ Three.js 씬 (카메라, 조명)
- ✅ 지면 (Ground) + 그리드
- ✅ 카메라 컨트롤 (패닝, 줌)
- ✅ FPS 프로파일러

**다음 Phase:** Phase 2 - 오브젝트 시스템 (Cube, Ramp, Cylinder 배치 및 편집)
