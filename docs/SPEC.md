# EB Navigation Web - 기획 문서

## 1. 프로젝트 개요

### 1.1 목적
EB 프로젝트의 내비게이션 시스템(Flow Field + 군중 시뮬레이션)을 웹 환경에서 프로토타이핑하고 테스트하기 위한 도구.

### 1.2 주요 목표
- 모바일 브라우저에서 실시간 테스트 가능
- NavMesh 생성 및 시각화
- 대규모 군중(500+ 에이전트) 성능 검증
- Unity 빌드 없이 빠른 이터레이션

### 1.3 기술 스택
| 항목 | 기술 |
|------|------|
| 언어 | TypeScript |
| 3D 렌더링 | Three.js |
| NavMesh | recast-navigation-js (WASM) |
| 빌드 | Vite |
| UI | HTML/CSS (반응형) |

---

## 2. 화면 구성

### 2.1 레이아웃

```
┌─────────────────────────────────────────────────────────────────┐
│                         Header Bar                               │
│  [Logo] EB Navigation Web              [Settings] [Fullscreen]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                                                                  │
│                                                                  │
│                      3D Viewport                                 │
│                    (Quarter View)                                │
│                                                                  │
│                                                                  │
│                                                                  │
├────────────────────────┬────────────────────────────────────────┤
│   Object Panel         │           Control Panel                 │
│  ┌─────────────────┐   │  ┌─────────────────────────────────┐   │
│  │ [Cube] [Ramp]   │   │  │ [Build NavMesh] [Start] [Stop]  │   │
│  │ [Cylinder]      │   │  │                                 │   │
│  │                 │   │  │ Spawn Rate: [====●====] 10/s    │   │
│  │ Selected:       │   │  │ Spawn Dist: [====●====] 30m     │   │
│  │ Cube_01         │   │  │ Agent Count: 0 / 500            │   │
│  │ Size: 2x2x2     │   │  │                                 │   │
│  └─────────────────┘   │  │ [Show NavMesh] [Show Flow]      │   │
│                        │  └─────────────────────────────────┘   │
├────────────────────────┴────────────────────────────────────────┤
│                      Performance Panel                           │
│  FPS: 60 | Agents: 237 | NavMesh: 1.2ms | Crowd: 3.4ms         │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 모바일 레이아웃

```
┌─────────────────────────┐
│      Header Bar         │
├─────────────────────────┤
│                         │
│                         │
│      3D Viewport        │
│                         │
│                         │
├─────────────────────────┤
│  [Cube][Ramp][Cylinder] │
├─────────────────────────┤
│  [Build] [Start] [Stop] │
├─────────────────────────┤
│ Spawn: [=====] 10/s     │
│ Dist:  [=====] 30m      │
├─────────────────────────┤
│ FPS:60 Agents:237       │
└─────────────────────────┘
```

---

## 3. 3D 뷰포트

### 3.1 카메라

#### 쿼터뷰 (Isometric-like)
```
        Camera
           \
            \  45°
             \
              ↘
    ┌─────────────────┐
    │                 │
    │     Ground      │
    │                 │
    └─────────────────┘
```

| 속성 | 값 |
|------|-----|
| 타입 | Orthographic 또는 Perspective (FOV 낮음) |
| 피치 | 45° ~ 60° (고정) |
| 요 | 45° (기본), 드래그로 회전 옵션 |
| 줌 범위 | 10m ~ 200m |

#### 카메라 조작

| 입력 | PC | 모바일 |
|------|-----|--------|
| 이동 | 마우스 드래그 (좌클릭) | 한 손가락 드래그 |
| 회전 | 마우스 드래그 (우클릭) | 두 손가락 회전 (옵션) |
| 줌 | 마우스 휠 | 두 손가락 핀치 |

### 3.2 지면 (Ground)

```
┌─────────────────────────────────────┐
│                                     │
│          100m x 100m                │
│                                     │
│    그리드 라인 (10m 간격)            │
│                                     │
└─────────────────────────────────────┘
```

| 속성 | 값 |
|------|-----|
| 크기 | 100m x 100m (기본) |
| 그리드 | 10m 간격 |
| 색상 | 밝은 회색 (#E0E0E0) |
| 테두리 | 진한 선으로 경계 표시 |

---

## 4. 오브젝트 시스템

### 4.1 오브젝트 종류

#### 4.1.1 큐브 (Cube)
```
    ┌─────────┐
   /│        /│
  / │       / │
 ┌─────────┐  │
 │  │      │  │
 │  └──────│──┘
 │ /       │ /
 └─────────┘
```
- 용도: 벽, 장애물
- 기본 크기: 2m x 2m x 2m
- 크기 범위: 0.5m ~ 20m (각 축)

#### 4.1.2 빗면 (Ramp)
```
         /│
        / │
       /  │
      /   │
     /    │
    ┌─────┘
```
- 용도: 경사로, 다리 연결
- 기본 크기: 4m x 2m x 2m (길이 x 너비 x 높이)
- 경사각: 자동 계산 (높이/길이)

#### 4.1.3 원통 (Cylinder)
```
      ___
    /     \
   │       │
   │       │
   │       │
    \_____/
```
- 용도: 기둥, 원형 장애물
- 기본 크기: 반지름 1m, 높이 2m
- 크기 범위: 반지름 0.25m ~ 10m

### 4.2 오브젝트 조작

#### 4.2.1 배치
1. 오브젝트 버튼 클릭
2. 지면 위 클릭하여 배치
3. 배치 후 자동 선택

#### 4.2.2 선택
- 클릭: 단일 선택
- 선택 시 아웃라인 표시 (노란색)
- Delete 키 또는 버튼으로 삭제

#### 4.2.3 크기 조절 핸들

```
              [Y+]
               │
               │
    [X-]───────●───────[X+]
               │
               │
              [Y-]

    (Z축은 높이 조절)

    ┌─────────[Z+]
    │         │
    │    ●────┘
    │
   [Ground]
```

| 핸들 | 색상 | 기능 |
|------|------|------|
| X축 | 빨강 | X 크기 조절 |
| Y축 | 초록 | Y 크기 조절 (깊이) |
| Z축 | 파랑 | Z 크기 조절 (높이) |
| 코너 | 흰색 | 비율 유지 스케일 |

#### 4.2.4 이동
- 선택된 오브젝트 드래그
- Shift 누르면서 드래그: 그리드 스냅 (1m 단위)

### 4.3 오브젝트 패널 UI

```
┌─────────────────────────────┐
│ Objects                     │
├─────────────────────────────┤
│ [🔲 Cube] [📐 Ramp] [⭕ Cyl]│
├─────────────────────────────┤
│ Selected: Cube_01           │
│                             │
│ Position                    │
│ X: [  5.0 ] Y: [  0.0 ]    │
│ Z: [  1.0 ]                 │
│                             │
│ Size                        │
│ W: [  2.0 ] D: [  2.0 ]    │
│ H: [  2.0 ]                 │
│                             │
│ [🗑️ Delete] [📋 Duplicate] │
└─────────────────────────────┘
```

---

## 5. NavMesh 시스템

### 5.1 빌드 프로세스

```
[Build NavMesh] 버튼 클릭
        │
        ▼
┌─────────────────────────────────────┐
│  1. 지오메트리 수집                  │
│     - Ground plane                  │
│     - 모든 오브젝트                  │
├─────────────────────────────────────┤
│  2. Recast 처리                     │
│     - Voxelization                  │
│     - Region Building               │
│     - Contour Generation            │
│     - Polygon Mesh                  │
├─────────────────────────────────────┤
│  3. Detour NavMesh 생성             │
│     - 타일 구성                     │
│     - 쿼리 객체 생성                │
├─────────────────────────────────────┤
│  4. 시각화 업데이트                  │
│     - NavMesh 메시 렌더링           │
└─────────────────────────────────────┘
```

### 5.2 빌드 설정

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| Cell Size | 0.3m | 복셀 해상도 (작을수록 정밀) |
| Cell Height | 0.2m | 높이 해상도 |
| Agent Radius | 0.5m | 에이전트 반지름 |
| Agent Height | 2.0m | 에이전트 높이 |
| Max Slope | 45° | 이동 가능 최대 경사 |
| Step Height | 0.4m | 올라갈 수 있는 단차 |

### 5.3 단계별 시각화

#### 5.3.1 시각화 토글

```
┌─────────────────────────────────┐
│ Visualization                   │
├─────────────────────────────────┤
│ [✓] NavMesh Polygons           │
│ [✓] NavMesh Edges              │
│ [ ] Voxels (Debug)             │
│ [ ] Regions (Debug)            │
│ [ ] Contours (Debug)           │
│ [✓] Agent Paths                │
└─────────────────────────────────┘
```

#### 5.3.2 NavMesh 시각화 스타일

```
NavMesh Polygons:
┌─────────────────────────────────┐
│  반투명 초록색 (알파 0.3)        │
│  폴리곤 면적에 따라 색상 그라데이션│
│  - 넓음: 밝은 초록                │
│  - 좁음: 진한 초록                │
└─────────────────────────────────┘

NavMesh Edges:
┌─────────────────────────────────┐
│  노란색 라인                     │
│  - 내부 엣지: 얇은 선            │
│  - 경계 엣지: 두꺼운 선          │
└─────────────────────────────────┘
```

---

## 6. 플레이어 & 몬스터 시스템

### 6.1 플레이어

```
      ●     ← 머리 (파란색 구)
     /│\
      │     ← 몸통 (파란색 원통)
     / \
```

| 속성 | 값 |
|------|-----|
| 표시 | 파란색 캡슐 또는 캐릭터 형태 |
| 위치 | 지면 중앙 (0, 0) 시작 |
| 조작 | WASD / 화살표 / 화면 터치 |
| 이동 속도 | 5 m/s |
| 반지름 | 0.5m |

#### 플레이어 조작

| 입력 | PC | 모바일 |
|------|-----|--------|
| 이동 | WASD 또는 화살표 | 가상 조이스틱 |
| 대시 | Shift | 대시 버튼 |

### 6.2 몬스터

```
      ●     ← 머리 (빨간색 구)
     /│\
      │     ← 몸통 (빨간색 원통)
     / \
```

| 속성 | 값 |
|------|-----|
| 표시 | 빨간색 캡슐 (GPU Instancing) |
| 반지름 | 0.5m |
| 이동 속도 | 3 ~ 5 m/s (랜덤) |
| 도착 거리 | 1m (플레이어와의 거리) |
| 최대 수 | 500 (설정 가능) |

### 6.3 스폰 시스템

```
                    30m
            ←─────────────────→

                 스폰 영역
            ·  ·  ·  ·  ·  ·  ·
          ·                      ·
        ·                          ·
       ·                            ·
      ·            ●                 ·   ← 플레이어 중심
       ·          Player            ·
        ·                          ·
          ·                      ·
            ·  ·  ·  ·  ·  ·  ·

        스폰 불가 영역 (플레이어 근처 5m)
```

#### 스폰 로직

```typescript
function spawnMonster() {
    // 1. 랜덤 각도
    const angle = Math.random() * Math.PI * 2;

    // 2. 스폰 거리 (설정값)
    const distance = spawnDistance; // 기본 30m

    // 3. 위치 계산
    const x = player.x + Math.cos(angle) * distance;
    const z = player.z + Math.sin(angle) * distance;

    // 4. NavMesh 위 유효 위치 찾기
    const validPos = navMeshQuery.findNearestPoly(x, z);

    // 5. 에이전트 생성
    crowd.addAgent(validPos);
}
```

#### 스폰 설정 UI

```
┌─────────────────────────────────┐
│ Spawn Settings                  │
├─────────────────────────────────┤
│ Spawn Rate                      │
│ [==========●=====] 10/sec       │
│ (1 ~ 50)                        │
│                                 │
│ Spawn Distance                  │
│ [==========●=====] 30m          │
│ (10m ~ 50m)                     │
│                                 │
│ Max Agents                      │
│ [==========●=====] 500          │
│ (100 ~ 1000)                    │
│                                 │
│ Agent Speed                     │
│ [==========●=====] 4 m/s        │
│ (1 ~ 10)                        │
└─────────────────────────────────┘
```

### 6.4 몬스터 행동

```
┌─────────────────────────────────────┐
│            Monster Lifecycle         │
├─────────────────────────────────────┤
│                                      │
│  [Spawn] ──→ [Move to Player] ──→ [Despawn]
│     │              │                  │
│     │              ▼                  │
│     │     Crowd.requestMoveTarget    │
│     │     (player.position)          │
│     │              │                  │
│     │              ▼                  │
│     │     NavMesh Path Following     │
│     │              │                  │
│     │              ▼                  │
│     │     distance < 1m? ────────────┘
│     │              │
│     │              ▼
│     │         [Respawn]
│     │              │
│     └──────────────┘
│                                      │
└─────────────────────────────────────┘
```

---

## 7. 성능 프로파일링

### 7.1 측정 항목

| 항목 | 설명 | 목표 |
|------|------|------|
| FPS | 초당 프레임 수 | 60fps |
| Frame Time | 프레임당 시간 | < 16.67ms |
| NavMesh Build | NavMesh 생성 시간 | < 500ms |
| Crowd Update | 군중 업데이트 시간 | < 5ms |
| Render Time | 렌더링 시간 | < 8ms |
| Memory | 메모리 사용량 | < 100MB |

### 7.2 프로파일링 패널

```
┌─────────────────────────────────────────────────────────────────┐
│ Performance                                               [📊]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FPS: 60 ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅ (avg: 58)          │
│                                                                  │
│  Frame Breakdown:                                                │
│  ├─ Crowd Update:  3.2ms  [████████░░░░░░░░░░░░]  19%          │
│  ├─ Render:        6.1ms  [███████████████░░░░░]  37%          │
│  ├─ NavMesh Query: 0.8ms  [████░░░░░░░░░░░░░░░░]   5%          │
│  └─ Other:         6.5ms  [████████████████░░░░]  39%          │
│                                                                  │
│  Agents: 237 / 500                                               │
│  NavMesh Polys: 1,234                                           │
│  Memory: 45.2 MB                                                 │
│                                                                  │
│  [Export CSV] [Reset Stats]                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 성능 경고

```
⚠️ 성능 경고 조건:

- FPS < 30: "Low FPS Warning"
- Crowd Update > 10ms: "Crowd Update Slow"
- Memory > 200MB: "High Memory Usage"
- Agent Count > 400 && FPS < 45: "Consider reducing agents"
```

---

## 8. 반응형 디자인

### 8.1 브레이크포인트

| 디바이스 | 너비 | 레이아웃 |
|----------|------|----------|
| Mobile Portrait | < 480px | 단일 컬럼, 최소 UI |
| Mobile Landscape | < 768px | 단일 컬럼, 확장 UI |
| Tablet | 768px ~ 1024px | 2컬럼 |
| Desktop | > 1024px | 전체 레이아웃 |

### 8.2 모바일 최적화

```
┌─────────────────────────────────────┐
│ 모바일 최적화 항목                   │
├─────────────────────────────────────┤
│ ✓ 터치 이벤트 처리                  │
│ ✓ 가상 조이스틱                     │
│ ✓ 핀치 줌                           │
│ ✓ GPU Instancing (에이전트 렌더링)  │
│ ✓ LOD (멀리 있는 에이전트 간소화)   │
│ ✓ 저사양 모드 자동 감지             │
└─────────────────────────────────────┘
```

### 8.3 저사양 모드

```
저사양 모드 트리거:
- FPS < 30 for 5 seconds
- 모바일 기기 감지

저사양 모드 설정:
- Max Agents: 200 (자동 제한)
- Shadow: Off
- Anti-aliasing: Off
- NavMesh visualization: Simplified
```

---

## 9. 컨트롤 패널

### 9.1 메인 컨트롤

```
┌─────────────────────────────────────┐
│ Controls                            │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────┐  ┌─────────┐          │
│  │  Build  │  │  Start  │          │
│  │ NavMesh │  │         │          │
│  └─────────┘  └─────────┘          │
│                                     │
│  ┌─────────┐  ┌─────────┐          │
│  │  Stop   │  │  Reset  │          │
│  │         │  │         │          │
│  └─────────┘  └─────────┘          │
│                                     │
└─────────────────────────────────────┘
```

### 9.2 버튼 동작

| 버튼 | 기능 | 단축키 |
|------|------|--------|
| Build NavMesh | NavMesh 재생성 | B |
| Start | 몬스터 스폰 시작 | Space |
| Stop | 몬스터 스폰 중지 | Space |
| Reset | 모든 몬스터 제거 + 플레이어 초기화 | R |

### 9.3 설정 패널

```
┌─────────────────────────────────────┐
│ Settings                      [⚙️]  │
├─────────────────────────────────────┤
│                                     │
│ NavMesh                             │
│ ├─ Cell Size: [0.3] m              │
│ ├─ Agent Radius: [0.5] m           │
│ └─ Max Slope: [45] °               │
│                                     │
│ Simulation                          │
│ ├─ Fixed Timestep: [✓]             │
│ └─ Timestep: [0.016] s             │
│                                     │
│ Graphics                            │
│ ├─ Shadows: [✓]                    │
│ ├─ Anti-aliasing: [✓]              │
│ └─ Low Quality Mode: [ ]           │
│                                     │
│ [Apply] [Reset to Default]          │
└─────────────────────────────────────┘
```

---

## 10. 파일 구조

```
eb-navigation-web/
├── docs/
│   └── SPEC.md                    # 이 문서
├── src/
│   ├── index.html                 # 메인 HTML
│   ├── main.ts                    # 앱 진입점
│   ├── style.css                  # 전역 스타일
│   │
│   ├── core/
│   │   ├── App.ts                 # 메인 앱 클래스
│   │   ├── Scene.ts               # Three.js 씬 관리
│   │   └── InputManager.ts        # 입력 처리
│   │
│   ├── navigation/
│   │   ├── NavMeshBuilder.ts      # NavMesh 생성
│   │   ├── NavMeshVisualizer.ts   # NavMesh 시각화
│   │   ├── CrowdManager.ts        # 군중 시뮬레이션
│   │   └── FlowField.ts           # Flow Field (커스텀)
│   │
│   ├── objects/
│   │   ├── Ground.ts              # 지면
│   │   ├── Cube.ts                # 큐브 오브젝트
│   │   ├── Ramp.ts                # 빗면 오브젝트
│   │   ├── Cylinder.ts            # 원통 오브젝트
│   │   └── ObjectManager.ts       # 오브젝트 관리
│   │
│   ├── entities/
│   │   ├── Player.ts              # 플레이어
│   │   ├── Monster.ts             # 몬스터
│   │   └── AgentRenderer.ts       # GPU Instancing 렌더러
│   │
│   ├── ui/
│   │   ├── ControlPanel.ts        # 컨트롤 패널
│   │   ├── ObjectPanel.ts         # 오브젝트 패널
│   │   ├── PerformancePanel.ts    # 성능 패널
│   │   ├── SettingsPanel.ts       # 설정 패널
│   │   └── VirtualJoystick.ts     # 모바일 조이스틱
│   │
│   ├── utils/
│   │   ├── Profiler.ts            # 성능 측정
│   │   ├── ResponsiveManager.ts   # 반응형 관리
│   │   └── MathUtils.ts           # 수학 유틸
│   │
│   └── types/
│       └── index.ts               # 타입 정의
│
├── public/
│   └── assets/                    # 정적 에셋
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 11. 구현 우선순위

### Phase 1: 기본 구조 (1주)
```
[ ] 프로젝트 셋업 (Vite + TypeScript + Three.js)
[ ] 3D 뷰포트 (카메라, 조명, 지면)
[ ] 카메라 컨트롤 (드래그, 줌)
[ ] 기본 UI 레이아웃
```

### Phase 2: 오브젝트 시스템 (1주)
```
[ ] 오브젝트 배치 (Cube, Ramp, Cylinder)
[ ] 오브젝트 선택
[ ] 크기 조절 핸들
[ ] 오브젝트 삭제
```

### Phase 3: NavMesh (1주)
```
[ ] recast-navigation-js 통합
[ ] NavMesh 빌드
[ ] NavMesh 시각화
[ ] 빌드 설정 UI
```

### Phase 4: 군중 시뮬레이션 (1주)
```
[ ] 플레이어 구현
[ ] 몬스터 스폰 시스템
[ ] Crowd 시뮬레이션 연동
[ ] GPU Instancing 렌더링
```

### Phase 5: 최적화 & 완성 (1주)
```
[ ] 성능 프로파일링
[ ] 모바일 최적화
[ ] 반응형 UI
[ ] 테스트 & 버그 수정
```

---

## 12. 기술적 고려사항

### 12.1 Three.js 설정

```typescript
// 렌더러 설정
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

### 12.2 GPU Instancing

```typescript
// 몬스터 대량 렌더링
const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const instancedMesh = new THREE.InstancedMesh(geometry, material, MAX_AGENTS);

// 매 프레임 업데이트
for (let i = 0; i < activeAgents; i++) {
    matrix.setPosition(agents[i].position);
    instancedMesh.setMatrixAt(i, matrix);
}
instancedMesh.instanceMatrix.needsUpdate = true;
```

### 12.3 recast-navigation-js 설정

```typescript
import { init } from 'recast-navigation';
import { generateSoloNavMesh } from '@recast-navigation/generators';
import { Crowd } from '@recast-navigation/core';

// 초기화
await init();

// NavMesh 생성
const { navMesh } = generateSoloNavMesh(positions, indices, {
    cs: 0.3,
    ch: 0.2,
    walkableRadius: 0.5,
    walkableHeight: 2,
    walkableClimb: 0.4,
    walkableSlopeAngle: 45,
});

// Crowd 생성
const crowd = new Crowd(navMesh, {
    maxAgents: 500,
    maxAgentRadius: 0.5,
});
```

---

## 13. 테스트 시나리오

### 13.1 기능 테스트

| ID | 시나리오 | 예상 결과 |
|----|----------|-----------|
| F01 | 큐브 배치 | 지면에 큐브 생성 |
| F02 | 큐브 크기 조절 | X/Y/Z 핸들로 크기 변경 |
| F03 | NavMesh 빌드 | 장애물 주변 NavMesh 생성 |
| F04 | 몬스터 스폰 | 30m 거리에서 스폰 |
| F05 | 몬스터 이동 | 플레이어 방향으로 이동 |
| F06 | 몬스터 소멸 | 1m 도달 시 소멸 |

### 13.2 성능 테스트

| ID | 시나리오 | 목표 |
|----|----------|------|
| P01 | 100 에이전트 | 60fps 유지 |
| P02 | 300 에이전트 | 45fps 이상 |
| P03 | 500 에이전트 | 30fps 이상 |
| P04 | 모바일 200 에이전트 | 30fps 이상 |

### 13.3 호환성 테스트

| 환경 | 브라우저 |
|------|----------|
| Desktop | Chrome, Firefox, Safari, Edge |
| Android | Chrome |
| iOS | Safari |

---

## 14. 향후 확장 계획

### 14.1 단기 (완료 후)
- [ ] 씬 저장/로드 (JSON)
- [ ] 복수 플레이어 (테스트용)
- [ ] 경로 시각화 옵션

### 14.2 중기
- [ ] 커스텀 Flow Field 구현
- [ ] 분리력 시각화
- [ ] 폴리곤 수동 편집 (Unity 버전과 연동)

### 14.3 장기
- [ ] Unity 익스포트 (NavMesh 데이터)
- [ ] 멀티플레이어 테스트
- [ ] AI 행동 패턴 추가

---

## 변경 이력

| 버전 | 날짜 | 작성자 | 내용 |
|------|------|--------|------|
| 0.1 | 2025-02-27 | Claude | 초안 작성 |
