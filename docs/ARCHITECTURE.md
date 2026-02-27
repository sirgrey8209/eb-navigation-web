# EB Navigation Web - Architecture Document

## 개요

**EB Navigation Web**은 Unity EB 프로젝트의 NavMesh + 군중 시뮬레이션을 웹에서 프로토타이핑하고 테스트하기 위한 도구입니다.

- **목적**: NavMesh 기반 경로 탐색 및 대규모 에이전트 시뮬레이션 검증
- **플랫폼**: 웹 브라우저 (데스크톱 + 모바일)
- **렌더링**: Three.js 기반 3D WebGL 렌더링
- **빌드**: Vite + TypeScript

---

## 기술 스택

| 분류 | 기술 | 버전 | 용도 |
|------|------|------|------|
| 언어 | TypeScript | 5.9.x | 타입 안전성 |
| 3D 렌더링 | Three.js | 0.183.x | WebGL 3D 그래픽 |
| NavMesh | recast-navigation | 0.43.0 | WASM 기반 NavMesh 생성/경로탐색 |
| 빌드 도구 | Vite | 5.4.x | 개발 서버 & 프로덕션 빌드 |
| 번들러 | esbuild | 0.27.x | 빠른 트랜스파일링 |

---

## 디렉토리 구조

```
eb-navigation-web/
├── index.html                 # 진입점 HTML
├── package.json               # 의존성 및 스크립트
├── tsconfig.json              # TypeScript 설정
├── vite.config.ts             # Vite 설정
├── ecosystem.config.cjs       # PM2 설정 (포트 3030)
│
├── docs/
│   ├── SPEC.md                # 기능 명세서
│   ├── IMPLEMENTATION.md      # 구현 계획 및 진행 상황
│   └── ARCHITECTURE.md        # 아키텍처 문서 (현재 파일)
│
├── src/
│   ├── main.ts                # 앱 진입점 및 메인 루프
│   ├── style.css              # 전역 스타일
│   │
│   ├── core/                  # 핵심 시스템
│   │   ├── Scene.ts           # Three.js 씬, 카메라, 렌더러, 퀄리티 설정
│   │   └── CameraController.ts # 쿼터뷰 카메라 컨트롤 (팬, 줌)
│   │
│   ├── objects/               # 3D 오브젝트
│   │   ├── Ground.ts          # 지면 메쉬
│   │   ├── ObjectManager.ts   # 오브젝트 배치/선택/삭제 관리
│   │   └── TransformHandles.ts # 크기 조절 핸들 (미사용)
│   │
│   ├── navigation/            # NavMesh 시스템
│   │   ├── NavMeshBuilder.ts  # recast-navigation NavMesh 생성
│   │   ├── NavMeshVisualizer.ts # NavMesh 시각화 (표면 + 엣지)
│   │   └── CrowdManager.ts    # 군중 시뮬레이션 관리
│   │
│   ├── entities/              # 게임 엔티티
│   │   ├── Player.ts          # 플레이어 (WASD/화살표/조이스틱 이동)
│   │   └── AgentRenderer.ts   # GPU Instancing 에이전트 렌더러
│   │
│   ├── ui/                    # UI 컴포넌트
│   │   └── VirtualJoystick.ts # 모바일 터치 조이스틱
│   │
│   ├── utils/                 # 유틸리티
│   │   └── Profiler.ts        # 성능 프로파일링 (FPS, 시스템별 시간)
│   │
│   └── types/                 # 타입 정의
│       └── index.ts           # 공유 인터페이스/타입
│
└── dist/                      # 빌드 출력 (gitignore)
```

---

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                           main.ts (App)                         │
│                        메인 루프 & 조율자                         │
└─────────────────────────────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      Core       │    │   Navigation    │    │    Entities     │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Scene           │◄───│ NavMeshBuilder  │    │ Player          │
│ CameraController│    │ NavMeshVisualizer│    │ AgentRenderer   │
│ (퀄리티 설정)    │    │ CrowdManager    │────►│ (GPU Instancing)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Objects     │    │  recast-wasm    │    │       UI        │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Ground          │    │ NavMesh (WASM)  │    │ VirtualJoystick │
│ ObjectManager   │    │ Crowd (WASM)    │    │ Profiler        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 핵심 컴포넌트

### 1. App (main.ts)

**역할**: 애플리케이션 진입점, 게임 루프 관리, 컴포넌트 조율

```typescript
class App {
  // 주요 멤버
  - scene: Scene                    // 3D 씬
  - cameraController: CameraController
  - objectManager: ObjectManager    // 오브젝트 배치
  - navMeshBuilder: NavMeshBuilder  // NavMesh 생성
  - crowdManager: CrowdManager      // 군중 시뮬레이션
  - player: Player                  // 플레이어
  - agentRenderer: AgentRenderer    // 에이전트 렌더링
  - virtualJoystick: VirtualJoystick // 모바일 입력
  - profiler: Profiler              // 성능 측정

  // 게임 루프
  animate() {
    1. profiler.beginFrame()
    2. cameraController.update()
    3. player.update(deltaTime)
    4. updateSimulation(deltaTime)  // Crowd 업데이트
    5. scene.render()
    6. profiler.endFrame()
  }
}
```

### 2. Scene (core/Scene.ts)

**역할**: Three.js 씬, 카메라, 렌더러, 조명, 퀄리티 설정

```typescript
class Scene {
  // 퀄리티 프리셋
  - low: 그림자 없음, AA 없음, 픽셀비율 1x
  - medium: 1024 그림자맵, AA, 픽셀비율 1.5x
  - high: 2048 그림자맵, AA, 픽셀비율 2x

  // 자동 감지
  - 모바일/터치 디바이스 → low/medium
  - 데스크톱 고사양 → high
}
```

### 3. NavMeshBuilder (navigation/NavMeshBuilder.ts)

**역할**: recast-navigation WASM으로 NavMesh 생성

```typescript
class NavMeshBuilder {
  // 설정
  - cellSize: 0.3          // 복셀 크기
  - agentRadius: 0.5       // 에이전트 반경
  - agentHeight: 2.0       // 에이전트 높이
  - agentMaxClimb: 0.4     // 최대 등반 높이
  - agentMaxSlope: 45      // 최대 경사각

  // 메서드
  - initialize(): WASM 초기화
  - build(groundSize, objects[]): NavMesh 생성
  - getNavMesh(): NavMesh 반환
}
```

### 4. CrowdManager (navigation/CrowdManager.ts)

**역할**: 대규모 에이전트 군중 시뮬레이션

```typescript
class CrowdManager {
  // 설정
  - maxAgents: 500         // 최대 에이전트 수
  - maxAgentSpeed: 5.0     // 최대 속도
  - separationWeight: 2.0  // 분리 가중치

  // 핵심 메서드
  - addAgent(position, target): 에이전트 추가
  - removeAgent(id): 에이전트 제거
  - setAllAgentsTarget(target): 전체 타겟 설정
  - update(deltaTime): 시뮬레이션 업데이트
  - removeAgentsNearTarget(target, radius): 근접 에이전트 제거
}
```

### 5. AgentRenderer (entities/AgentRenderer.ts)

**역할**: GPU Instancing으로 대량 에이전트 효율적 렌더링

```typescript
class AgentRenderer {
  // GPU Instancing
  - InstancedMesh: 단일 드로우콜로 500개 에이전트 렌더링
  - 각 에이전트의 위치/회전을 Matrix4로 전달

  // 성능 최적화
  - 8각형 실린더 (저폴리곤)
  - frustumCulled: false (인스턴싱 최적화)
  - 동적 count 조절
}
```

### 6. Player (entities/Player.ts)

**역할**: 플레이어 캐릭터 및 입력 처리

```typescript
class Player {
  // 입력 방식
  - 키보드: WASD / 화살표
  - 터치: VirtualJoystick

  // 이동
  - moveSpeed: 10
  - 지면 바운드 클램핑
}
```

### 7. VirtualJoystick (ui/VirtualJoystick.ts)

**역할**: 모바일 터치 조이스틱

```typescript
class VirtualJoystick {
  // 자동 감지
  - 터치 디바이스에서만 표시

  // 출력
  - x: -1 ~ 1 (좌우)
  - y: -1 ~ 1 (상하)
  - active: boolean
}
```

---

## 데이터 흐름

### 시뮬레이션 업데이트 사이클

```
매 프레임:
┌──────────────────────────────────────────────────────────┐
│ 1. 스폰 타이머 체크 → spawnAgent()                        │
│    └─ CrowdManager.addAgent(position, playerPos)         │
│                                                          │
│ 2. 타겟 업데이트                                          │
│    └─ CrowdManager.setAllAgentsTarget(playerPos)         │
│                                                          │
│ 3. 군중 시뮬레이션                                        │
│    └─ CrowdManager.update(deltaTime)                     │
│       └─ recast Crowd.update() (WASM)                    │
│                                                          │
│ 4. 근접 에이전트 제거                                     │
│    └─ CrowdManager.removeAgentsNearTarget(playerPos, r)  │
│                                                          │
│ 5. 렌더링 업데이트                                        │
│    └─ AgentRenderer.update(agents[])                     │
│       └─ InstancedMesh.setMatrixAt() × N                 │
└──────────────────────────────────────────────────────────┘
```

### NavMesh 빌드 프로세스

```
Build NavMesh 버튼 클릭:
┌──────────────────────────────────────────────────────────┐
│ 1. ObjectManager.getObjects() → PlacedObject[]           │
│                                                          │
│ 2. NavMeshBuilder.build(groundSize, objects)             │
│    ├─ collectGeometry() - 지면 + 오브젝트 버텍스 수집      │
│    └─ generateSoloNavMesh() (WASM)                       │
│                                                          │
│ 3. NavMeshVisualizer.update(navMesh)                     │
│    ├─ 반투명 초록 표면 렌더링                              │
│    └─ 노란색 엣지 라인 렌더링                              │
│                                                          │
│ 4. CrowdManager 재초기화 (새 NavMesh 적용)                │
└──────────────────────────────────────────────────────────┘
```

---

## 성능 최적화

### 1. GPU Instancing
- **문제**: 500개 에이전트를 개별 Mesh로 렌더링 시 500 드로우콜
- **해결**: `THREE.InstancedMesh`로 단일 드로우콜
- **결과**: ~10x 렌더링 성능 향상

### 2. WASM NavMesh
- **문제**: JavaScript로 NavMesh 계산 시 성능 저하
- **해결**: `recast-navigation` WASM 바인딩 사용
- **결과**: 네이티브에 근접한 NavMesh 생성/경로탐색 속도

### 3. 퀄리티 설정
- **Low**: 그림자 비활성화, AA 없음 → 저사양 모바일
- **Medium**: 1024 그림자맵 → 중간 사양
- **High**: 2048 그림자맵, 풀 AA → 고사양 데스크톱

### 4. 동적 에이전트 관리
- 플레이어 도달 시 에이전트 즉시 제거
- 최대 500개 제한으로 메모리/성능 관리

---

## 이벤트 흐름

### UI → 시스템

```
버튼 클릭 이벤트:
├─ btn-cube/ramp/cylinder → ObjectManager.startPlacement()
├─ btn-build             → NavMeshBuilder.build()
├─ btn-start             → isSimulationRunning = true
├─ btn-stop              → isSimulationRunning = false
├─ btn-reset             → CrowdManager.clearAllAgents()
└─ quality-low/med/high  → Scene.setQuality()

슬라이더:
├─ spawn-rate  → spawnRate (1-50/초)
└─ spawn-dist  → spawnDistance (10-50m)
```

### 키보드/터치 → Player

```
입력 이벤트:
├─ keydown/keyup (WASD/Arrow) → Player.inputState
└─ touchstart/move/end        → VirtualJoystick.input
                                └─ Player.setJoystickInput()
```

---

## 타입 정의

### PlacedObject (types/index.ts)

```typescript
interface PlacedObject {
  id: string;
  type: 'cube' | 'ramp' | 'cylinder';
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  size: THREE.Vector3;
  rotation: THREE.Euler;
}
```

### AgentData (navigation/CrowdManager.ts)

```typescript
interface AgentData {
  id: number;
  crowdAgent: CrowdAgent;    // recast-navigation
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetPosition: THREE.Vector3 | null;
  active: boolean;
}
```

### JoystickInput (ui/VirtualJoystick.ts)

```typescript
interface JoystickInput {
  x: number;      // -1 ~ 1
  y: number;      // -1 ~ 1
  active: boolean;
}
```

---

## 실행 환경

### 개발 서버

```bash
# PM2로 실행 (포트 3030)
pm2 start ecosystem.config.cjs

# 또는 직접 실행
npm run dev
```

### 프로덕션 빌드

```bash
npm run build    # dist/ 폴더에 출력
npm run preview  # 프로덕션 빌드 미리보기
```

### 브라우저 지원

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- 모바일: iOS Safari, Android Chrome

---

## 확장 포인트

### 새로운 오브젝트 타입 추가

1. `types/index.ts`에 `ObjectType` 확장
2. `ObjectManager.getGeometry()`에 지오메트리 추가
3. `index.html`에 버튼 추가

### 에이전트 행동 변경

1. `CrowdManager`의 에이전트 파라미터 수정
2. 또는 새로운 타겟 로직 추가

### 새로운 UI 컴포넌트

1. `src/ui/`에 컴포넌트 생성
2. `main.ts`에서 인스턴스화 및 연결

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-02-27 | 1.0 | 초기 아키텍처 문서 작성 |
