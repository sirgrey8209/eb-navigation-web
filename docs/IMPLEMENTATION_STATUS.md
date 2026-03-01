# Flow Field 군중 시뮬레이션 - 구현 현황

> 최종 업데이트: 2026-03-01

## 개요

`docs/FLOW_FIELD_SPEC.md` 스펙 문서를 기반으로 한 Flow Field 군중 시뮬레이션 시스템의 구현 현황입니다.

## 구현 상태 요약

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 1 | 기본 인프라 (Scene, Camera, Ground) | ✅ 완료 |
| Phase 2 | 오브젝트 배치 시스템 | ✅ 완료 |
| Phase 3 | NavMesh 생성 (recast-navigation) | ✅ 완료 |
| Phase 4 | Detour Crowd 시뮬레이션 | ✅ 완료 |
| Phase 5 | UI 개선 및 성능 프로파일링 | ✅ 완료 |
| **Phase 6** | **Flow Field 시스템** | ✅ **완료** |
| Phase 7 | NavMesh 폴리곤 에디터 | ❌ 미구현 |
| Phase 8 | 넉백 시스템 | ❌ 미구현 |

---

## Phase 6: Flow Field 시스템 (✅ 완료)

### 구현된 파일

| 파일 | 설명 |
|------|------|
| `src/types/flowfield.ts` | Flow Field 관련 타입 정의 |
| `src/utils/SpatialHash.ts` | O(n) 이웃 탐색을 위한 Spatial Hash Grid |
| `src/navigation/NavMeshExtractor.ts` | recast NavMesh에서 폴리곤 데이터 추출 |
| `src/navigation/FlowFieldCalculator.ts` | BFS 기반 Flow Field 계산 |
| `src/entities/FlowFieldAgentSystem.ts` | TypedArray 기반 에이전트 관리 |
| `src/entities/AgentRenderer.ts` | TypedArray 렌더링 메서드 추가 |
| `src/navigation/FlowFieldVisualizer.ts` | Flow Field 방향 화살표 시각화 |
| `src/main.ts` | Flow Field / Detour Crowd 듀얼 모드 통합 |
| `index.html` | UI 토글 추가 |

### 구현된 기능

#### 1. 타입 정의 (`src/types/flowfield.ts`)
- `PolygonAttribute`: walkable, ramp, jump_down, jump_up, blocked, water, hazard
- `CustomNavMeshPolygon`: 폴리곤 데이터 (정점, 중심, 이웃, 속성)
- `CustomNavMeshData`: NavMesh 전체 데이터
- `FlowFieldData`: 방향 및 거리 배열 (Float32Array)
- `AgentArrays`: TypedArray 기반 에이전트 데이터

#### 2. Spatial Hash Grid (`src/utils/SpatialHash.ts`)
- 그리드 기반 공간 분할
- O(n) 이웃 탐색
- `computeSeparation()`: 분리력 계산

#### 3. NavMesh 데이터 추출 (`src/navigation/NavMeshExtractor.ts`)
- recast-navigation NavMesh → CustomNavMeshData 변환
- 폴리곤 정점, 중심점, 이웃 관계 추출
- `findPolygonAtPoint()`: 위치 → 폴리곤 ID 조회

#### 4. Flow Field 계산 (`src/navigation/FlowFieldCalculator.ts`)
- BFS 기반 Flow Field 생성
- 타겟별 Flow Field 캐싱
- 거리 기반 재계산 트리거
- scratch vector 사용으로 할당 최소화

#### 5. 에이전트 시스템 (`src/entities/FlowFieldAgentSystem.ts`)
- TypedArray 기반 데이터 (Float32Array, Uint8Array, Int32Array)
- Swap-and-pop 에이전트 제거
- 다중 타겟 지원 (가장 가까운 타겟 자동 선택)
- Spatial Hash 기반 분리력 적용

#### 6. 렌더링 (`src/entities/AgentRenderer.ts`)
- `updateFromTypedArrays()`: TypedArray 직접 렌더링
- GPU Instancing (InstancedMesh)
- maxAgents: 1000

#### 7. 시각화 (`src/navigation/FlowFieldVisualizer.ts`)
- ArrowHelper 기반 방향 화살표
- 거리 기반 색상 (가까울수록 밝은 녹색)
- scratch object 사용으로 할당 최소화

#### 8. 통합 (`src/main.ts`)
- Flow Field / Detour Crowd 듀얼 모드
- UI 토글 (Flow Field Mode, Show Flow Field)
- cachedTarget, scratchSpawnPos로 per-frame 할당 방지

### 성능 최적화

| 최적화 | 위치 | 효과 |
|--------|------|------|
| TypedArray | FlowFieldAgentSystem | 메모리 연속성, GC 감소 |
| Scratch vectors | FlowFieldCalculator, FlowFieldVisualizer, main.ts | per-frame 할당 제거 |
| Index-based BFS queue | FlowFieldCalculator | O(1) dequeue (shift() 대신) |
| Swap-and-pop removal | FlowFieldAgentSystem | O(1) 에이전트 제거 |
| Spatial Hash Grid | SpatialHash | O(n) 이웃 탐색 |
| GPU Instancing | AgentRenderer | 1000+ 에이전트 렌더링 |

---

## Phase 7: NavMesh 폴리곤 에디터 (❌ 미구현)

### 미구현 기능

| 기능 | 설명 |
|------|------|
| 폴리곤 선택 UI | 클릭으로 폴리곤 선택 |
| 속성 변경 | walkable → blocked, water, hazard 등 |
| 속성별 시각화 | 색상으로 구분 |
| 저장/불러오기 | 편집된 NavMesh 저장 |

### 현재 상태

모든 폴리곤이 `'walkable'`로 고정:
```typescript
// NavMeshExtractor.ts
polygons.push({
  // ...
  attribute: 'walkable' as PolygonAttribute,  // 항상 walkable
});
```

---

## Phase 8: 넉백 시스템 (❌ 미구현)

### 미구현 기능

| 기능 | 설명 |
|------|------|
| 넉백 플래그 | `AGENT_FLAG_KNOCKBACK` |
| 넉백 속도 | 외부에서 주입 |
| 폴리곤 속성 반응 | water → 즉사, hazard → 대미지 등 |

---

## 테스트 방법

1. http://5.223.72.58:3002/ 접속
2. **Build NavMesh** 클릭
3. **Start** 클릭
4. WASD/화살표/조이스틱으로 플레이어 이동
5. **Flow Field Mode** 체크박스로 모드 전환
6. **Show Flow Field** 체크박스로 시각화 ON/OFF

### 성능 목표

| 항목 | 목표 | 현재 |
|------|------|------|
| 에이전트 수 | 1000+ | ✅ 지원 |
| FPS | 240fps+ | 테스트 필요 |
| Flow Field 계산 | <50ms | 테스트 필요 |

---

## 파일 구조

```
src/
├── core/
│   ├── Scene.ts
│   └── CameraController.ts
├── entities/
│   ├── Player.ts
│   ├── AgentRenderer.ts          # TypedArray 렌더링 추가
│   └── FlowFieldAgentSystem.ts   # 신규
├── navigation/
│   ├── NavMeshBuilder.ts
│   ├── NavMeshVisualizer.ts
│   ├── CrowdManager.ts
│   ├── NavMeshExtractor.ts       # 신규
│   ├── FlowFieldCalculator.ts    # 신규
│   └── FlowFieldVisualizer.ts    # 신규
├── objects/
│   ├── Ground.ts
│   ├── ObjectManager.ts
│   └── TransformHandles.ts
├── types/
│   ├── index.ts
│   └── flowfield.ts              # 신규
├── ui/
│   └── VirtualJoystick.ts
├── utils/
│   ├── Profiler.ts
│   └── SpatialHash.ts            # 신규
└── main.ts                       # Flow Field 통합
```

---

## 다음 단계

1. **Phase 7**: NavMesh 폴리곤 에디터
   - 폴리곤 선택/편집 UI
   - 속성 변경 (blocked, water, hazard)
   - 속성별 이동 비용

2. **Phase 8**: 넉백 시스템
   - 넉백 플래그 및 속도 처리
   - 폴리곤 속성과 연동 (water → 즉사)

3. **성능 프로파일링**
   - 실제 1000 에이전트 FPS 측정
   - 병목 지점 분석 및 최적화
