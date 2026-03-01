# Flow Field 기반 군중 시뮬레이션 - 요구사항 정의서

## 1. 프로젝트 목표

Unity 구현 전 **Flow Field 기반 군중 시뮬레이션**을 웹에서 빠르게 프로토타이핑하고 검증하기 위한 테스트 프로젝트.

### 1.1 게임 컨텍스트

> **Vampire Survivors 스타일** 게임 엔진
>
> - **지형**: 디아블로, 스타크래프트 스타일의 대체로 평평한 지형 + 층(Floor) 개념
> - **에이전트**: 1000+ 적이 플레이어(들)를 향해 공격
> - **멀티플레이어**: 장기적으로 4~8인 협동 지원 (Flow Field 선택 이유)
> - **물리 상호작용**: 적을 날려서 물에 빠뜨리기, 벽에 부딪히기, 상층으로 날리기

### 1.2 핵심 스펙

| 항목 | 스펙 |
|------|------|
| 에이전트 수 | **1000개+** |
| 타겟 (플레이어) 수 | 1~10개 (멀티플레이어 4~8인 대응) |
| 타겟 형태 | 움직이는 플레이어 오브젝트 |
| 타겟 할당 | 가장 가까운 타겟 자동 선택 |
| **목표 FPS** | **240fps+ (데스크톱)** |

### 1.3 기존 시스템과의 차이

| 구분 | 기존 (Detour Crowd) | 목표 (Flow Field) |
|------|---------------------|-------------------|
| 경로 탐색 | 개별 에이전트 pathfinding | 타겟별 Flow Field 공유 |
| 계산 비용 | O(에이전트 수 × 경로 복잡도) | O(타겟 수 × 폴리곤 수) |
| 타겟 | 단일 (플레이어) | 다중 (멀티플레이어) |
| 확장성 | 에이전트 증가 시 성능 급락 | 타겟 수에만 비례 |

---

## 2. NavMesh 구조

### 2.1 단일 연속 폴리곤 메시

> **핵심 개념**: NavLink 방식이 아님. 빗면, 계단 등도 모두 **실제 폴리곤**으로 표현.
> Raycast, 경로 탐색 등이 자연스럽게 동작함.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  하나의 NavMesh가 모든 층을 폴리곤으로 완전히 커버               │
│                                                                  │
│        2F 폴리곤들 (height: 6m)                                 │
│        ┌─────────────┐                                          │
│        │ ▲ ▲ ▲ ▲ ▲ │                                          │
│        │ ▲ ▲ ▲ ▲ ▲ │                                          │
│        └─────╲──────┘                                          │
│               ╲                                                 │
│                ╲ ← 빗면 폴리곤들 (경사진 실제 지오메트리)       │
│                 ╲                                               │
│        1F 폴리곤들 (height: 3m)                                 │
│        ┌─────────╲────────────────────┐                        │
│        │ ▲ ▲ ▲ ▲ ╲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ │                        │
│        │ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ │                        │
│        │ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ │                        │
│        └──────────────────────────────┘                        │
│                                                                  │
│  ▲ = 개별 폴리곤 (모두 인접 관계로 연결됨)                      │
│  빗면도 폴리곤 → Raycast 자연스럽게 동작                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 층(Floor) 시스템

층은 **편집 시 작업 대상을 지정하는 용도**이며, NavMesh 자체는 단일 연속 메시.

```typescript
interface Floor {
  id: number;
  name: string;              // "1F", "2F", "B1" 등
  height: number;            // 이 층의 기준 Y 좌표 (예: 0, 3, 6)
  color: number;             // 시각화용 색상
  visible: boolean;          // 편집 시 표시 여부
}
```

### 2.3 폴리곤 속성

```typescript
type PolygonAttribute =
  | 'walkable'      // 기본 이동 가능
  | 'ramp'          // 빗면 (양방향 이동)
  | 'jump_down'     // 아래로 점프 가능 (단방향)
  | 'jump_up'       // 위로 점프 가능 (스킬 필요 등)
  | 'blocked'       // 이동 불가 (장애물/벽)
  | 'water'         // 물 (에이전트 즉사 또는 감속)
  | 'hazard';       // 위험 지역 (지속 대미지 등)
```

> **넉백 시스템과의 연계**: 에이전트가 `blocked`, `water`, `hazard` 영역으로 밀려나면 게임 로직에서 처리 (즉사, 대미지 등)

### 2.4 정점 및 폴리곤 데이터 구조

```typescript
interface NavMeshVertex {
  id: number;
  position: Vector3;         // 3D 위치 (층 높이 포함)
  floorId: number;           // 편집 시 소속 층 (시각화/필터용)
  polygons: number[];        // 이 정점을 사용하는 폴리곤들
}

interface NavMeshPolygon {
  id: number;
  vertices: number[];        // 정점 인덱스 (CCW 순서, 비컨벡스 허용)
  neighbors: number[];       // 인접 폴리곤 ID들
  floorId: number;           // 소속 층 (편집/시각화용)
  attribute: PolygonAttribute;

  // 내부 처리용 (비컨벡스 → 컨벡스 분할 결과)
  convexParts?: number[][];  // 분할된 컨벡스 폴리곤들의 정점 인덱스
}
```

### 2.5 비컨벡스 폴리곤 처리

- 사용자는 비컨벡스 폴리곤을 자유롭게 그릴 수 있음
- 내부적으로 컨벡스 폴리곤들로 자동 분할 (ear clipping 등)
- NavMesh 쿼리 시에는 분할된 컨벡스 폴리곤 사용

---

## 3. 공간 쿼리 시스템

> **핵심**: 적을 날리거나, 스킬 범위 판정, 시야 판정 등을 위해 NavMesh 기반 공간 쿼리 필수.

### 3.1 Raycast

```typescript
interface RaycastResult {
  hit: boolean;
  point: Vector3;           // 충돌 지점
  polygon: NavMeshPolygon;  // 충돌한 폴리곤
  distance: number;         // 시작점으로부터 거리
  normal: Vector3;          // 충돌면 법선 (벽 반사 등에 활용)
}

// 용도 예시:
// - 플레이어 공격 방향으로 적이 있는지 확인
// - 넉백 시 벽에 부딪히는 지점 계산
// - 시야(Line of Sight) 판정
function raycast(
  origin: Vector3,
  direction: Vector3,
  maxDistance: number,
  filter?: PolygonAttribute[]  // 특정 속성만 검사
): RaycastResult;
```

### 3.2 Point Query

```typescript
interface PointQueryResult {
  valid: boolean;
  polygon: NavMeshPolygon | null;  // 해당 위치의 폴리곤
  floorId: number;                  // 소속 층
  height: number;                   // 해당 위치의 높이
  attribute: PolygonAttribute;      // 폴리곤 속성
}

// 용도 예시:
// - 에이전트가 밀려난 위치가 물인지 확인
// - 스킬 시전 위치가 유효한지 확인
// - 드롭 아이템 배치 가능 위치 확인
function queryPoint(position: Vector3): PointQueryResult;
```

### 3.3 범위 쿼리

```typescript
interface AreaQueryResult {
  polygons: NavMeshPolygon[];  // 범위 내 폴리곤들
  agents: number[];            // 범위 내 에이전트 ID들
}

// 용도 예시:
// - 범위 공격 대상 탐색
// - 폭발 범위 내 적 탐색
// - 버프/디버프 영역 효과
function queryArea(
  center: Vector3,
  radius: number,
  shape?: 'circle' | 'rectangle'
): AreaQueryResult;
```

### 3.4 높이 쿼리 (층 간 이동)

```typescript
// 넉백으로 위층으로 날아갔을 때, 해당 높이의 폴리곤 찾기
function findPolygonAtHeight(
  xz: Vector2,      // XZ 평면 좌표
  height: number    // 목표 높이
): NavMeshPolygon | null;

// 아래로 떨어질 때 착지 지점 찾기
function findGroundBelow(
  position: Vector3
): { polygon: NavMeshPolygon; point: Vector3 } | null;
```

---

## 4. Flow Field 시스템

### 4.1 전체 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                        런타임 루프                               │
├─────────────────────────────────────────────────────────────────┤
│  매 프레임:                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. 타겟 위치 업데이트 (이동)                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 2. Flow Field 업데이트 (일정 간격 또는 조건 충족 시)      │   │
│  │    - 타겟이 일정 거리 이상 이동했을 때                    │   │
│  │    - 설정된 업데이트 간격 도달 시                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 3. 에이전트 업데이트                                      │   │
│  │    a. 가장 가까운 타겟 선택                               │   │
│  │    b. 해당 타겟의 Flow Field에서 방향 벡터 획득           │   │
│  │    c. Local Avoidance (Detour RVO) 적용                  │   │
│  │    d. 최종 속도로 위치 업데이트                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 4. 렌더링 (GPU Instancing)                               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Flow Field 구조

```typescript
interface FlowFieldCell {
  polyRef: number;           // NavMesh 폴리곤 참조
  center: Vector3;           // 폴리곤 중심점
  direction: Vector3;        // 타겟을 향한 방향 벡터
  distance: number;          // 타겟까지의 거리 (BFS depth)
  neighbors: number[];       // 인접 폴리곤 인덱스
}
```

### 4.3 Flow Field 알고리즘

```typescript
// BFS 기반 Flow Field 계산
function calculateFlowField(navMesh: NavMesh, targetPoly: number): Map<number, Vector3> {
  const directions = new Map<number, Vector3>();
  const distances = new Map<number, number>();
  const queue: number[] = [targetPoly];

  distances.set(targetPoly, 0);
  directions.set(targetPoly, new Vector3(0, 0, 0)); // 타겟 위치에서는 정지

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDist = distances.get(current)!;
    const currentCenter = getPolygonCenter(navMesh, current);

    for (const neighbor of getNeighbors(navMesh, current)) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, currentDist + 1);

        // 방향: 현재 폴리곤 → 이웃 폴리곤 (타겟 방향)
        const neighborCenter = getPolygonCenter(navMesh, neighbor);
        const direction = currentCenter.clone().sub(neighborCenter).normalize();
        directions.set(neighbor, direction);

        queue.push(neighbor);
      }
    }
  }

  return directions;
}
```

### 4.4 다중 타겟 관리

```typescript
interface FlowFieldManagerConfig {
  updateInterval: number;      // 업데이트 간격 (초)
  distanceThreshold: number;   // 재계산 트리거 거리
}
```

- 타겟별로 독립적인 Flow Field 생성
- 에이전트는 가장 가까운 타겟의 Flow Field를 참조
- 타겟 이동 시 해당 Flow Field만 재계산

---

## 5. 에이전트 시스템

### 5.1 에이전트 상태

```typescript
interface AgentState {
  id: number;
  position: Vector3;
  velocity: Vector3;
  targetId: string | null;     // 현재 추적 중인 타겟
  active: boolean;

  // 넉백 상태
  knockbackVelocity: Vector3;  // 외부 힘에 의한 속도
  isKnockedBack: boolean;      // 넉백 중인지 여부
}
```

### 5.2 충돌 회피

Detour Crowd의 Local Avoidance (RVO)를 활용:

```typescript
// Flow Field 방향으로 목표 속도 설정
const desiredVelocity = flowField.getDirection(agent.position).multiplyScalar(maxSpeed);
agent.requestMoveVelocity(desiredVelocity);

// Crowd.update() → RVO가 충돌 회피 속도 계산
crowd.update(deltaTime);

// 결과 속도 적용
const actualVelocity = agent.velocity();
```

### 5.3 넉백 (Knockback) 시스템

> **핵심**: 적을 물, 벽, 상층으로 날려보내는 기능

```typescript
interface KnockbackParams {
  direction: Vector3;    // 넉백 방향
  force: number;         // 넉백 세기
  duration: number;      // 넉백 지속 시간
}

// 넉백 적용 흐름
function applyKnockback(agent: AgentState, params: KnockbackParams): void {
  agent.knockbackVelocity = params.direction.multiplyScalar(params.force);
  agent.isKnockedBack = true;

  // 1. Raycast로 이동 경로 상의 장애물 확인
  const ray = raycast(agent.position, params.direction, params.force * params.duration);

  if (ray.hit) {
    // 2a. 벽에 부딪힘 → 벽에서 정지, 충돌 대미지
    if (ray.polygon.attribute === 'blocked') {
      agent.position = ray.point;
      onWallCollision(agent, ray);
    }
  } else {
    // 2b. 최종 위치 확인
    const finalPos = agent.position.add(agent.knockbackVelocity.multiplyScalar(params.duration));
    const ground = queryPoint(finalPos);

    if (!ground.valid) {
      // 맵 밖 → 즉사
      onFallOffMap(agent);
    } else if (ground.attribute === 'water') {
      // 물에 빠짐 → 익사
      onFallInWater(agent);
    } else if (ground.floorId !== agent.currentFloorId) {
      // 다른 층으로 이동 → 착지 처리
      onFloorChange(agent, ground);
    }
  }
}
```

**넉백 시나리오:**

| 상황 | 처리 |
|------|------|
| 벽에 충돌 | 충돌 지점에서 정지, 스턴 또는 추가 대미지 |
| 물에 빠짐 | 즉사 또는 지속 대미지 |
| 상층으로 날아감 | 해당 층 NavMesh에 착지 |
| 하층으로 낙하 | 낙하 대미지, 해당 층에 착지 |
| 맵 밖으로 이탈 | 즉사 |

### 5.4 타겟 (플레이어)

```typescript
interface TargetConfig {
  id: string;
  color: number;
  radius: number;
  moveSpeed: number;
  playerId?: number;    // 멀티플레이어 시 플레이어 식별
}
```

- 플레이어와 유사한 구조
- WASD 또는 클릭으로 이동
- 이동 거리 추적 (Flow Field 업데이트 트리거용)
- **멀티플레이어**: 각 플레이어가 독립적인 타겟으로 동작

---

## 6. NavMesh 편집

### 6.1 편집 모드

```typescript
type EditMode = 'select' | 'vertex' | 'polygon' | 'edge';
```

### 6.2 편집 기능

**정점 편집:**
- 추가: 엣지 클릭으로 분할
- 이동: 드래그
- 삭제: Delete 키

**폴리곤 편집:**
- 생성: 3개+ 정점 선택 후 생성 (비컨벡스 허용)
- 삭제: 선택 후 Delete
- 분할: 두 정점 선택 → 엣지 추가
- 병합: 인접 폴리곤 선택 후 병합
- 속성 변경: Walkable, Ramp, Jump Down 등

**워크플로우:**
```
1. 오브젝트 배치 → Recast로 NavMesh 자동 생성
                         ↓
2. [Edit NavMesh] 버튼 클릭 → 편집 모드 진입
                         ↓
3. 정점/폴리곤 수동 편집
                         ↓
4. [Apply] 또는 [Cancel]
```

### 6.3 유효성 검사

- 모든 폴리곤이 연결되어 있는지
- 전체 공간이 폴리곤으로 덮여있는지 (갭 없음)
- Raycast 정상 동작 여부

### 6.4 저장/로드

```typescript
interface NavMeshFileFormat {
  version: string;
  metadata: {
    createdAt: string;
    groundSize: number;
    polyCount: number;
    vertexCount: number;
  };
  floors: Floor[];
  vertices: number[];        // [x, y, z, ...] flat array
  polygons: {
    vertexIndices: number[];
    neighbors: number[];
    floorId: number;
    attribute: PolygonAttribute;
  }[];
}
```

---

## 7. 연구 파라미터

UI에서 실시간 조절 가능한 파라미터들.

### 7.1 Flow Field 파라미터

| 파라미터 | 범위 | 기본값 | 설명 |
|----------|------|--------|------|
| `updateInterval` | 0.05s ~ 1.0s | 0.2s | Flow Field 재계산 간격 |
| `distanceThreshold` | 0.5m ~ 10m | 2m | 타겟 이동 시 재계산 트리거 거리 |

### 7.2 에이전트 파라미터

| 파라미터 | 범위 | 기본값 | 설명 |
|----------|------|--------|------|
| `maxSpeed` | 1 ~ 15 m/s | 5 m/s | 에이전트 최대 속도 |
| `separationWeight` | 0 ~ 5 | 2.0 | 분리력 강도 |
| `arrivalDistance` | 0.5m ~ 3m | 1m | 도착 판정 거리 |

### 7.3 시뮬레이션 파라미터

| 파라미터 | 범위 | 기본값 | 설명 |
|----------|------|--------|------|
| `spawnRate` | 1 ~ 200 /s | 50 /s | 에이전트 스폰 속도 |
| `maxAgents` | 100 ~ 2000 | 1000 | 최대 에이전트 수 |
| `targetCount` | 1 ~ 10 | 1 | 타겟 수 |

---

## 8. 시각화

### 8.1 Flow Field 시각화

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│    각 폴리곤 중심에서 방향 벡터를 화살표로 표시                    │
│                                                                  │
│         →  →  →  ↗                                               │
│       →  →  →  ↗  ↑                                              │
│     →  →  →  ↗  ↑  ↑        ● Target                            │
│       →  →  ↗  ↑  ↑                                              │
│         →  ↗  ↑  ↑                                               │
│                                                                  │
│    색상: 거리에 따른 그라데이션 (가까울수록 밝음)                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 층 & 폴리곤 속성 시각화

```
폴리곤 속성별 색상:
- Walkable: 층 색상 (기본)
- Ramp: 초록색
- Jump Down: 주황색
- Jump Up: 하늘색
- Blocked: 빨간색 (줄무늬)
- Water: 파란색 (물결 패턴)
- Hazard: 보라색 (위험 표시)

편집 모드:
- 활성 층: 불투명 (100%)
- 비활성 층: 반투명 (30%)
```

### 8.3 편집 모드 시각화

```
- 정점: 흰색 (기본), 노란색 (선택), 빨간색 (삭제 예정)
- 엣지: 파란색 (기본), 노란색 (선택)
- 폴리곤: 층 색상 (기본), 노란색 (선택), 빨간색 (삭제 예정)
```

---

## 9. 성능 목표

### 9.1 목표 스펙

| 항목 | 목표 |
|------|------|
| **에이전트 수** | **1000개** |
| **FPS (데스크톱)** | **240fps+** |
| FPS (모바일) | 60fps 이상 |
| Flow Field 계산 | 50ms 이하 (타겟 1개당) |
| 에이전트 업데이트 | 1ms 이하 (1000개 기준) |
| 메모리 사용량 | 50MB 이하 |

### 9.2 벤치마크 시나리오

| 시나리오 | 에이전트 | 타겟 | 목표 FPS |
|----------|----------|------|----------|
| Stress Test | 1000 | 10 | 240+ |
| Normal | 500 | 5 | 300+ |
| Light | 200 | 2 | 400+ |
| Mobile | 300 | 3 | 60+ |

### 9.3 프레임 버짓 (240fps = 4.16ms/frame)

| 단계 | 목표 시간 | 비고 |
|------|-----------|------|
| Flow Field 조회 | 0.3ms | Spatial lookup |
| 에이전트 업데이트 | 1.0ms | TypedArray 순회 |
| Separation 계산 | 1.0ms | Spatial Hash |
| GPU Instancing | 1.5ms | Matrix 업데이트 |
| 여유 | 0.36ms | |
| **합계** | **4.16ms** | |

### 9.4 최적화 전략

**데이터 구조:**
```typescript
// TypedArray (연속 메모리, SIMD 친화적)
const positions = new Float32Array(MAX_AGENTS * 3);
const velocities = new Float32Array(MAX_AGENTS * 3);
const targetIds = new Uint8Array(MAX_AGENTS);
```

**근접 탐색:**
```typescript
// Spatial Hash Grid O(n)
class SpatialHash {
  private cellSize: number = 2.0;
  private grid: Map<number, number[]>;
  query(x: number, z: number, radius: number): number[] { ... }
}
```

**병렬 처리:**
```
Main Thread: 렌더링, 입력 처리, 에이전트 이동
Web Worker: Flow Field 계산, Spatial Hash 업데이트
→ SharedArrayBuffer로 데이터 공유
```

---

## 변경 이력

| 버전 | 날짜 | 작성자 | 내용 |
|------|------|--------|------|
| 0.1 | 2025-03-01 | Claude | 초안 작성 |
| 0.2 | 2025-03-01 | Claude | 성능 목표 상향 (240fps, 1000 에이전트) |
| 0.3 | 2025-03-01 | Claude | NavMesh 폴리곤 편집 기능 추가 |
| 0.4 | 2025-03-01 | Claude | 층(Floor) 시스템 추가 |
| 0.5 | 2025-03-01 | Claude | NavLink 방식 제거 → 단일 연속 NavMesh. 비컨벡스 분할 추가. |
| 0.6 | 2025-03-01 | Claude | 구현 계획 제거, 스펙 문서로 정리 |
| 0.7 | 2025-03-01 | Claude | 게임 컨텍스트 추가 (Vampire Survivors), 공간 쿼리 시스템 (Raycast/Point Query), 넉백 시스템, Water/Hazard 속성 추가 |
