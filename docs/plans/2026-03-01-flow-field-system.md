# Flow Field 기반 군중 시뮬레이션 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 현재 Detour Crowd 기반 시스템을 Flow Field 기반으로 전환하여 1000+ 에이전트, 240fps+ 목표 달성

**Architecture:** BFS 기반 Flow Field를 폴리곤 단위로 계산하고, TypedArray + Spatial Hash로 에이전트를 관리. 기존 recast-navigation의 NavMesh 데이터를 활용하되, 경로 탐색은 Flow Field로 대체.

**Tech Stack:** TypeScript, Three.js, recast-navigation (NavMesh 생성만), TypedArray, Spatial Hash Grid

---

## 구현 단계 요약

| Phase | 내용 | 예상 시간 |
|-------|------|----------|
| 1 | 타입 정의 및 데이터 구조 | 30분 |
| 2 | Spatial Hash Grid | 30분 |
| 3 | Custom NavMesh 데이터 추출 | 45분 |
| 4 | Flow Field 계산기 | 45분 |
| 5 | Flow Field 기반 에이전트 시스템 | 60분 |
| 6 | 다중 타겟 시스템 | 30분 |
| 7 | 시각화 (Flow Field 화살표) | 30분 |
| 8 | 통합 및 성능 테스트 | 30분 |

---

## Task 1: 타입 정의

**Files:**
- Create: `src/types/flowfield.ts`
- Modify: `src/types/index.ts`

**Step 1: Flow Field 관련 타입 정의 파일 생성**

```typescript
// src/types/flowfield.ts
import * as THREE from 'three';

// ===========================
// Polygon Attributes
// ===========================
export type PolygonAttribute =
  | 'walkable'
  | 'ramp'
  | 'jump_down'
  | 'jump_up'
  | 'blocked'
  | 'water'
  | 'hazard';

// ===========================
// NavMesh Data (Extracted from recast)
// ===========================
export interface CustomNavMeshPolygon {
  id: number;
  vertices: THREE.Vector3[];      // 폴리곤 정점들 (월드 좌표)
  center: THREE.Vector3;          // 폴리곤 중심점
  neighbors: number[];            // 인접 폴리곤 ID들
  attribute: PolygonAttribute;
}

export interface CustomNavMeshData {
  polygons: CustomNavMeshPolygon[];
  polyCount: number;
}

// ===========================
// Flow Field
// ===========================
export interface FlowFieldConfig {
  updateInterval: number;          // 업데이트 간격 (초), 기본 0.2
  distanceThreshold: number;       // 재계산 트리거 거리, 기본 2.0
}

export interface FlowFieldData {
  targetId: number;
  directions: Float32Array;        // [dx, dy, dz, ...] polyCount * 3
  distances: Float32Array;         // polyCount
  lastTargetPosition: THREE.Vector3;
  dirty: boolean;
}

// ===========================
// Agent (TypedArray 기반)
// ===========================
export const AGENT_FLAG_ACTIVE = 1 << 0;
export const AGENT_FLAG_KNOCKBACK = 1 << 1;

export interface AgentConfig {
  maxAgents: number;               // 기본 1000
  maxSpeed: number;                // 기본 5.0
  radius: number;                  // 기본 0.5
  separationWeight: number;        // 기본 2.0
  arrivalDistance: number;         // 기본 1.0
}

// TypedArray 기반 에이전트 데이터
export interface AgentArrays {
  positions: Float32Array;         // [x, y, z, ...] maxAgents * 3
  velocities: Float32Array;        // [vx, vy, vz, ...] maxAgents * 3
  targetIds: Uint8Array;           // 타겟 ID (0-255)
  polyIds: Int32Array;             // 현재 폴리곤 ID (-1 = 없음)
  flags: Uint8Array;               // 비트 플래그
  count: number;                   // 활성 에이전트 수
}

// ===========================
// Target (Player)
// ===========================
export interface Target {
  id: number;
  position: THREE.Vector3;
  radius: number;
  color: number;
}

// ===========================
// Spatial Query Results
// ===========================
export interface PointQueryResult {
  valid: boolean;
  polyId: number;
  height: number;
  attribute: PolygonAttribute | null;
}

// ===========================
// Visualization Colors
// ===========================
export const POLYGON_COLORS: Record<PolygonAttribute, number> = {
  walkable: 0x44aa44,
  ramp: 0x44ff44,
  jump_down: 0xffaa44,
  jump_up: 0x44aaff,
  blocked: 0xff4444,
  water: 0x4444ff,
  hazard: 0xaa44ff,
};
```

**Step 2: types/index.ts에서 export 추가**

Modify `src/types/index.ts` - 파일 끝에 추가:
```typescript
export * from './flowfield';
```

**Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

**Step 4: Commit**

```bash
git add src/types/
git commit -m "feat: add Flow Field type definitions"
```

---

## Task 2: Spatial Hash Grid 구현

**Files:**
- Create: `src/utils/SpatialHash.ts`

**Step 1: SpatialHash 클래스 생성**

```typescript
// src/utils/SpatialHash.ts

export class SpatialHash {
  private cellSize: number;
  private invCellSize: number;
  private grid: Map<number, number[]>;
  private worldSize: number;
  private gridSize: number;

  constructor(cellSize: number = 2.0, worldSize: number = 100) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.worldSize = worldSize;
    this.gridSize = Math.ceil(worldSize / cellSize);
    this.grid = new Map();
  }

  /**
   * 월드 좌표를 셀 인덱스로 변환
   */
  private hash(x: number, z: number): number {
    const cx = Math.floor((x + this.worldSize / 2) * this.invCellSize);
    const cz = Math.floor((z + this.worldSize / 2) * this.invCellSize);
    return cz * this.gridSize + cx;
  }

  /**
   * 그리드 초기화
   */
  public clear(): void {
    this.grid.clear();
  }

  /**
   * positions 배열에서 그리드 구축
   * @param positions Float32Array [x, y, z, ...]
   * @param count 활성 에이전트 수
   */
  public build(positions: Float32Array, count: number): void {
    this.clear();

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const x = positions[idx];
      const z = positions[idx + 2];
      const hash = this.hash(x, z);

      let cell = this.grid.get(hash);
      if (!cell) {
        cell = [];
        this.grid.set(hash, cell);
      }
      cell.push(i);
    }
  }

  /**
   * 특정 위치 주변의 에이전트 인덱스 반환
   * @param x X 좌표
   * @param z Z 좌표
   * @param radius 검색 반경
   * @param exclude 제외할 인덱스 (-1이면 제외 없음)
   */
  public query(x: number, z: number, radius: number, exclude: number = -1): number[] {
    const result: number[] = [];
    const cellRadius = Math.ceil(radius * this.invCellSize);

    const cx = Math.floor((x + this.worldSize / 2) * this.invCellSize);
    const cz = Math.floor((z + this.worldSize / 2) * this.invCellSize);

    for (let dz = -cellRadius; dz <= cellRadius; dz++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const ncx = cx + dx;
        const ncz = cz + dz;

        if (ncx < 0 || ncx >= this.gridSize || ncz < 0 || ncz >= this.gridSize) {
          continue;
        }

        const hash = ncz * this.gridSize + ncx;
        const cell = this.grid.get(hash);
        if (cell) {
          for (const idx of cell) {
            if (idx !== exclude) {
              result.push(idx);
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * 특정 위치 주변의 에이전트와의 분리력 계산
   * @returns [fx, fz] 분리력 벡터
   */
  public computeSeparation(
    x: number,
    z: number,
    radius: number,
    selfIndex: number,
    positions: Float32Array,
    weight: number
  ): [number, number] {
    let fx = 0;
    let fz = 0;
    const neighbors = this.query(x, z, radius, selfIndex);
    const radiusSq = radius * radius;

    for (const idx of neighbors) {
      const ox = positions[idx * 3];
      const oz = positions[idx * 3 + 2];
      const dx = x - ox;
      const dz = z - oz;
      const distSq = dx * dx + dz * dz;

      if (distSq > 0 && distSq < radiusSq) {
        const dist = Math.sqrt(distSq);
        const factor = (radius - dist) / radius * weight;
        fx += (dx / dist) * factor;
        fz += (dz / dist) * factor;
      }
    }

    return [fx, fz];
  }
}
```

**Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

**Step 3: Commit**

```bash
git add src/utils/SpatialHash.ts
git commit -m "feat: add SpatialHash for O(n) neighbor queries"
```

---

## Task 3: NavMesh 데이터 추출기

**Files:**
- Create: `src/navigation/NavMeshExtractor.ts`

**Step 1: NavMeshExtractor 클래스 생성**

```typescript
// src/navigation/NavMeshExtractor.ts
import type { NavMesh } from 'recast-navigation';
import * as THREE from 'three';
import { CustomNavMeshData, CustomNavMeshPolygon, PolygonAttribute } from '../types/flowfield';

export class NavMeshExtractor {
  /**
   * recast-navigation NavMesh에서 커스텀 데이터 추출
   */
  public static extract(navMesh: NavMesh): CustomNavMeshData {
    const polygons: CustomNavMeshPolygon[] = [];

    // NavMesh의 폴리곤 데이터 가져오기
    const polyCount = navMesh.getPolyCount();
    const maxTiles = navMesh.getMaxTiles();

    let polyId = 0;

    // 모든 타일 순회
    for (let tileIdx = 0; tileIdx < maxTiles; tileIdx++) {
      const tile = navMesh.getTile(tileIdx);
      if (!tile || !tile.header) continue;

      const tilePolyCount = tile.header.polyCount;
      const tileVerts = tile.verts;

      for (let polyIdx = 0; polyIdx < tilePolyCount; polyIdx++) {
        const poly = tile.polys[polyIdx];
        if (!poly) continue;

        // 폴리곤 정점 추출
        const vertices: THREE.Vector3[] = [];
        const vertCount = poly.vertCount;

        for (let v = 0; v < vertCount; v++) {
          const vertIdx = poly.verts[v];
          const x = tileVerts[vertIdx * 3];
          const y = tileVerts[vertIdx * 3 + 1];
          const z = tileVerts[vertIdx * 3 + 2];
          vertices.push(new THREE.Vector3(x, y, z));
        }

        // 폴리곤 중심 계산
        const center = new THREE.Vector3();
        for (const v of vertices) {
          center.add(v);
        }
        center.divideScalar(vertices.length);

        // 인접 폴리곤 추출
        const neighbors: number[] = [];
        for (let n = 0; n < vertCount; n++) {
          const neiRef = poly.neis[n];
          if (neiRef !== 0) {
            // 내부 타일 이웃
            if (neiRef <= tilePolyCount) {
              neighbors.push(neiRef - 1 + polyId - polyIdx);
            }
            // 외부 타일 연결은 별도 처리 필요 (현재는 단순화)
          }
        }

        polygons.push({
          id: polyId,
          vertices,
          center: center.clone(),
          neighbors,
          attribute: 'walkable' as PolygonAttribute,
        });

        polyId++;
      }
    }

    // 이웃 관계 재계산 (더 정확한 방법)
    NavMeshExtractor.rebuildNeighbors(polygons);

    return {
      polygons,
      polyCount: polygons.length,
    };
  }

  /**
   * 폴리곤 간 이웃 관계 재계산 (공유 엣지 기반)
   */
  private static rebuildNeighbors(polygons: CustomNavMeshPolygon[]): void {
    const EPSILON = 0.01;

    for (let i = 0; i < polygons.length; i++) {
      polygons[i].neighbors = [];
    }

    for (let i = 0; i < polygons.length; i++) {
      const polyA = polygons[i];

      for (let j = i + 1; j < polygons.length; j++) {
        const polyB = polygons[j];

        // 공유 정점 수 계산
        let sharedCount = 0;
        for (const va of polyA.vertices) {
          for (const vb of polyB.vertices) {
            if (va.distanceTo(vb) < EPSILON) {
              sharedCount++;
              if (sharedCount >= 2) break;
            }
          }
          if (sharedCount >= 2) break;
        }

        // 2개 이상의 정점을 공유하면 이웃
        if (sharedCount >= 2) {
          polyA.neighbors.push(j);
          polyB.neighbors.push(i);
        }
      }
    }
  }

  /**
   * 주어진 위치가 속한 폴리곤 ID 찾기
   */
  public static findPolygonAtPoint(
    navMeshData: CustomNavMeshData,
    x: number,
    z: number
  ): number {
    // 간단한 점-폴리곤 테스트 (XZ 평면)
    for (const poly of navMeshData.polygons) {
      if (NavMeshExtractor.pointInPolygonXZ(x, z, poly.vertices)) {
        return poly.id;
      }
    }
    return -1;
  }

  /**
   * XZ 평면에서 점이 폴리곤 내부인지 확인 (ray casting)
   */
  private static pointInPolygonXZ(
    x: number,
    z: number,
    vertices: THREE.Vector3[]
  ): boolean {
    let inside = false;
    const n = vertices.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = vertices[i].x, zi = vertices[i].z;
      const xj = vertices[j].x, zj = vertices[j].z;

      if (((zi > z) !== (zj > z)) &&
          (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }
}
```

**Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

**Step 3: Commit**

```bash
git add src/navigation/NavMeshExtractor.ts
git commit -m "feat: add NavMeshExtractor to convert recast data"
```

---

## Task 4: Flow Field 계산기

**Files:**
- Create: `src/navigation/FlowFieldCalculator.ts`

**Step 1: FlowFieldCalculator 클래스 생성**

```typescript
// src/navigation/FlowFieldCalculator.ts
import * as THREE from 'three';
import { CustomNavMeshData, FlowFieldData, FlowFieldConfig } from '../types/flowfield';
import { NavMeshExtractor } from './NavMeshExtractor';

const DEFAULT_CONFIG: FlowFieldConfig = {
  updateInterval: 0.2,
  distanceThreshold: 2.0,
};

export class FlowFieldCalculator {
  private navMeshData: CustomNavMeshData | null = null;
  private flowFields: Map<number, FlowFieldData> = new Map();
  private config: FlowFieldConfig;

  constructor(config: Partial<FlowFieldConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * NavMesh 데이터 설정
   */
  public setNavMeshData(data: CustomNavMeshData): void {
    this.navMeshData = data;
    this.flowFields.clear();
  }

  /**
   * 특정 타겟에 대한 Flow Field 생성 또는 업데이트
   */
  public updateFlowField(targetId: number, targetPosition: THREE.Vector3): FlowFieldData | null {
    if (!this.navMeshData) return null;

    let flowField = this.flowFields.get(targetId);

    // 기존 Flow Field가 있고, 타겟이 충분히 이동하지 않았으면 스킵
    if (flowField && !flowField.dirty) {
      const dist = flowField.lastTargetPosition.distanceTo(targetPosition);
      if (dist < this.config.distanceThreshold) {
        return flowField;
      }
    }

    // 타겟이 위치한 폴리곤 찾기
    const targetPolyId = NavMeshExtractor.findPolygonAtPoint(
      this.navMeshData,
      targetPosition.x,
      targetPosition.z
    );

    if (targetPolyId < 0) {
      console.warn('Target not on NavMesh');
      return flowField || null;
    }

    // Flow Field 계산 (BFS)
    const polyCount = this.navMeshData.polyCount;
    const directions = new Float32Array(polyCount * 3);
    const distances = new Float32Array(polyCount);

    // 초기화: 모든 거리를 무한대로
    distances.fill(Infinity);

    // BFS
    const queue: number[] = [targetPolyId];
    distances[targetPolyId] = 0;
    // 타겟 폴리곤은 방향 (0, 0, 0)
    directions[targetPolyId * 3] = 0;
    directions[targetPolyId * 3 + 1] = 0;
    directions[targetPolyId * 3 + 2] = 0;

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentPoly = this.navMeshData.polygons[currentId];
      const currentDist = distances[currentId];

      for (const neighborId of currentPoly.neighbors) {
        if (neighborId < 0 || neighborId >= polyCount) continue;
        if (distances[neighborId] !== Infinity) continue;

        const neighborPoly = this.navMeshData.polygons[neighborId];

        // 블록된 폴리곤은 스킵
        if (neighborPoly.attribute === 'blocked') continue;

        // 거리 설정
        distances[neighborId] = currentDist + 1;

        // 방향: 이웃 → 현재 (타겟 방향)
        const dir = currentPoly.center.clone().sub(neighborPoly.center).normalize();
        directions[neighborId * 3] = dir.x;
        directions[neighborId * 3 + 1] = dir.y;
        directions[neighborId * 3 + 2] = dir.z;

        queue.push(neighborId);
      }
    }

    // Flow Field 저장
    flowField = {
      targetId,
      directions,
      distances,
      lastTargetPosition: targetPosition.clone(),
      dirty: false,
    };

    this.flowFields.set(targetId, flowField);
    return flowField;
  }

  /**
   * 특정 폴리곤에서의 방향 벡터 조회
   */
  public getDirection(targetId: number, polyId: number): THREE.Vector3 | null {
    const flowField = this.flowFields.get(targetId);
    if (!flowField || polyId < 0) return null;

    const idx = polyId * 3;
    return new THREE.Vector3(
      flowField.directions[idx],
      flowField.directions[idx + 1],
      flowField.directions[idx + 2]
    );
  }

  /**
   * 특정 위치에서의 방향 벡터 조회 (폴리곤 자동 탐색)
   */
  public getDirectionAtPosition(
    targetId: number,
    x: number,
    z: number
  ): THREE.Vector3 | null {
    if (!this.navMeshData) return null;

    const polyId = NavMeshExtractor.findPolygonAtPoint(this.navMeshData, x, z);
    return this.getDirection(targetId, polyId);
  }

  /**
   * 특정 타겟의 Flow Field를 dirty로 표시
   */
  public markDirty(targetId: number): void {
    const flowField = this.flowFields.get(targetId);
    if (flowField) {
      flowField.dirty = true;
    }
  }

  /**
   * 모든 Flow Field를 dirty로 표시 (NavMesh 변경 시)
   */
  public markAllDirty(): void {
    for (const flowField of this.flowFields.values()) {
      flowField.dirty = true;
    }
  }

  /**
   * Flow Field 데이터 조회 (시각화용)
   */
  public getFlowFieldData(targetId: number): FlowFieldData | null {
    return this.flowFields.get(targetId) || null;
  }

  /**
   * NavMesh 데이터 조회
   */
  public getNavMeshData(): CustomNavMeshData | null {
    return this.navMeshData;
  }

  /**
   * 설정 변경
   */
  public setConfig(config: Partial<FlowFieldConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 리소스 해제
   */
  public dispose(): void {
    this.flowFields.clear();
    this.navMeshData = null;
  }
}
```

**Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

**Step 3: Commit**

```bash
git add src/navigation/FlowFieldCalculator.ts
git commit -m "feat: add BFS-based FlowFieldCalculator"
```

---

## Task 5: Flow Field 기반 에이전트 시스템

**Files:**
- Create: `src/entities/FlowFieldAgentSystem.ts`

**Step 1: FlowFieldAgentSystem 클래스 생성**

```typescript
// src/entities/FlowFieldAgentSystem.ts
import * as THREE from 'three';
import {
  AgentConfig,
  AgentArrays,
  AGENT_FLAG_ACTIVE,
  Target,
  CustomNavMeshData,
} from '../types/flowfield';
import { SpatialHash } from '../utils/SpatialHash';
import { FlowFieldCalculator } from '../navigation/FlowFieldCalculator';
import { NavMeshExtractor } from '../navigation/NavMeshExtractor';

const DEFAULT_CONFIG: AgentConfig = {
  maxAgents: 1000,
  maxSpeed: 5.0,
  radius: 0.5,
  separationWeight: 2.0,
  arrivalDistance: 1.0,
};

export class FlowFieldAgentSystem {
  private config: AgentConfig;
  private agents: AgentArrays;
  private spatialHash: SpatialHash;
  private flowFieldCalculator: FlowFieldCalculator;
  private targets: Map<number, Target> = new Map();
  private navMeshData: CustomNavMeshData | null = null;

  // 재사용 벡터 (GC 방지)
  private tempVec = new THREE.Vector3();

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // TypedArray 할당
    this.agents = {
      positions: new Float32Array(this.config.maxAgents * 3),
      velocities: new Float32Array(this.config.maxAgents * 3),
      targetIds: new Uint8Array(this.config.maxAgents),
      polyIds: new Int32Array(this.config.maxAgents).fill(-1),
      flags: new Uint8Array(this.config.maxAgents),
      count: 0,
    };

    this.spatialHash = new SpatialHash(2.0, 100);
    this.flowFieldCalculator = new FlowFieldCalculator();
  }

  /**
   * NavMesh 데이터 설정
   */
  public setNavMeshData(data: CustomNavMeshData): void {
    this.navMeshData = data;
    this.flowFieldCalculator.setNavMeshData(data);
  }

  /**
   * 타겟 추가/업데이트
   */
  public setTarget(target: Target): void {
    this.targets.set(target.id, target);
  }

  /**
   * 타겟 제거
   */
  public removeTarget(targetId: number): void {
    this.targets.delete(targetId);
  }

  /**
   * 에이전트 추가
   * @returns 에이전트 인덱스 (-1이면 실패)
   */
  public addAgent(x: number, y: number, z: number): number {
    if (this.agents.count >= this.config.maxAgents) {
      return -1;
    }

    const idx = this.agents.count;
    const posIdx = idx * 3;

    this.agents.positions[posIdx] = x;
    this.agents.positions[posIdx + 1] = y;
    this.agents.positions[posIdx + 2] = z;

    this.agents.velocities[posIdx] = 0;
    this.agents.velocities[posIdx + 1] = 0;
    this.agents.velocities[posIdx + 2] = 0;

    this.agents.flags[idx] = AGENT_FLAG_ACTIVE;
    this.agents.targetIds[idx] = 0;
    this.agents.polyIds[idx] = -1;

    this.agents.count++;
    return idx;
  }

  /**
   * 에이전트 제거 (swap-and-pop)
   */
  public removeAgent(index: number): boolean {
    if (index < 0 || index >= this.agents.count) return false;

    const lastIdx = this.agents.count - 1;

    if (index !== lastIdx) {
      // 마지막 에이전트를 현재 위치로 이동
      const srcIdx = lastIdx * 3;
      const dstIdx = index * 3;

      this.agents.positions[dstIdx] = this.agents.positions[srcIdx];
      this.agents.positions[dstIdx + 1] = this.agents.positions[srcIdx + 1];
      this.agents.positions[dstIdx + 2] = this.agents.positions[srcIdx + 2];

      this.agents.velocities[dstIdx] = this.agents.velocities[srcIdx];
      this.agents.velocities[dstIdx + 1] = this.agents.velocities[srcIdx + 1];
      this.agents.velocities[dstIdx + 2] = this.agents.velocities[srcIdx + 2];

      this.agents.flags[index] = this.agents.flags[lastIdx];
      this.agents.targetIds[index] = this.agents.targetIds[lastIdx];
      this.agents.polyIds[index] = this.agents.polyIds[lastIdx];
    }

    this.agents.count--;
    return true;
  }

  /**
   * 타겟 근처의 에이전트 제거
   */
  public removeAgentsNearTarget(targetId: number, radius: number): number {
    const target = this.targets.get(targetId);
    if (!target) return 0;

    const radiusSq = radius * radius;
    const toRemove: number[] = [];

    for (let i = 0; i < this.agents.count; i++) {
      const posIdx = i * 3;
      const dx = this.agents.positions[posIdx] - target.position.x;
      const dz = this.agents.positions[posIdx + 2] - target.position.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < radiusSq) {
        toRemove.push(i);
      }
    }

    // 역순으로 제거 (swap-and-pop 때문)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.removeAgent(toRemove[i]);
    }

    return toRemove.length;
  }

  /**
   * 시뮬레이션 업데이트
   */
  public update(deltaTime: number): void {
    if (!this.navMeshData || this.agents.count === 0) return;

    // 1. Flow Field 업데이트
    for (const target of this.targets.values()) {
      this.flowFieldCalculator.updateFlowField(target.id, target.position);
    }

    // 2. Spatial Hash 재구축
    this.spatialHash.build(this.agents.positions, this.agents.count);

    // 3. 각 에이전트에 대해 가장 가까운 타겟 찾기 및 속도 계산
    for (let i = 0; i < this.agents.count; i++) {
      if (!(this.agents.flags[i] & AGENT_FLAG_ACTIVE)) continue;

      const posIdx = i * 3;
      const x = this.agents.positions[posIdx];
      const y = this.agents.positions[posIdx + 1];
      const z = this.agents.positions[posIdx + 2];

      // 가장 가까운 타겟 찾기
      let closestTarget: Target | null = null;
      let closestDistSq = Infinity;

      for (const target of this.targets.values()) {
        const dx = target.position.x - x;
        const dz = target.position.z - z;
        const distSq = dx * dx + dz * dz;

        if (distSq < closestDistSq) {
          closestDistSq = distSq;
          closestTarget = target;
        }
      }

      if (!closestTarget) continue;

      this.agents.targetIds[i] = closestTarget.id;

      // Flow Field에서 방향 조회
      const direction = this.flowFieldCalculator.getDirectionAtPosition(
        closestTarget.id,
        x,
        z
      );

      let vx = 0, vz = 0;

      if (direction) {
        vx = direction.x * this.config.maxSpeed;
        vz = direction.z * this.config.maxSpeed;
      } else {
        // Flow Field가 없으면 직접 타겟으로
        const dx = closestTarget.position.x - x;
        const dz = closestTarget.position.z - z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.01) {
          vx = (dx / dist) * this.config.maxSpeed;
          vz = (dz / dist) * this.config.maxSpeed;
        }
      }

      // 분리력 적용
      const [sepX, sepZ] = this.spatialHash.computeSeparation(
        x, z,
        this.config.radius * 4,
        i,
        this.agents.positions,
        this.config.separationWeight
      );

      vx += sepX;
      vz += sepZ;

      // 속도 저장
      this.agents.velocities[posIdx] = vx;
      this.agents.velocities[posIdx + 1] = 0;
      this.agents.velocities[posIdx + 2] = vz;
    }

    // 4. 위치 업데이트
    for (let i = 0; i < this.agents.count; i++) {
      if (!(this.agents.flags[i] & AGENT_FLAG_ACTIVE)) continue;

      const posIdx = i * 3;
      this.agents.positions[posIdx] += this.agents.velocities[posIdx] * deltaTime;
      this.agents.positions[posIdx + 1] += this.agents.velocities[posIdx + 1] * deltaTime;
      this.agents.positions[posIdx + 2] += this.agents.velocities[posIdx + 2] * deltaTime;
    }
  }

  /**
   * 에이전트 데이터 조회 (렌더링용)
   */
  public getAgentData(): AgentArrays {
    return this.agents;
  }

  /**
   * 에이전트 수 조회
   */
  public getAgentCount(): number {
    return this.agents.count;
  }

  /**
   * 전체 에이전트 제거
   */
  public clearAgents(): void {
    this.agents.count = 0;
  }

  /**
   * FlowFieldCalculator 조회 (시각화용)
   */
  public getFlowFieldCalculator(): FlowFieldCalculator {
    return this.flowFieldCalculator;
  }

  /**
   * 설정 변경
   */
  public setConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 리소스 해제
   */
  public dispose(): void {
    this.flowFieldCalculator.dispose();
    this.targets.clear();
  }
}
```

**Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

**Step 3: Commit**

```bash
git add src/entities/FlowFieldAgentSystem.ts
git commit -m "feat: add TypedArray-based FlowFieldAgentSystem"
```

---

## Task 6: AgentRenderer 업데이트

**Files:**
- Modify: `src/entities/AgentRenderer.ts`

**Step 1: TypedArray 기반 렌더링 메서드 추가**

기존 `AgentRenderer.ts`에 `updateFromTypedArrays` 메서드 추가:

```typescript
// src/entities/AgentRenderer.ts 에 추가할 메서드

/**
 * TypedArray로부터 에이전트 렌더링 업데이트
 * @param positions Float32Array [x, y, z, ...]
 * @param velocities Float32Array [vx, vy, vz, ...] (방향 계산용)
 * @param count 활성 에이전트 수
 */
public updateFromTypedArrays(
  positions: Float32Array,
  velocities: Float32Array,
  count: number
): void {
  if (!this.instancedMesh) return;

  this.activeCount = count;
  this.instancedMesh.count = count;

  for (let i = 0; i < count; i++) {
    const idx = i * 3;

    // 위치 설정
    this.dummyPosition.set(
      positions[idx],
      positions[idx + 1],
      positions[idx + 2]
    );

    // 속도로부터 회전 계산
    const vx = velocities[idx];
    const vz = velocities[idx + 2];
    if (vx * vx + vz * vz > 0.01) {
      const angle = Math.atan2(vx, vz);
      this.dummyQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    }

    // 매트릭스 구성
    this.dummyMatrix.compose(this.dummyPosition, this.dummyQuaternion, this.dummyScale);
    this.instancedMesh.setMatrixAt(i, this.dummyMatrix);
  }

  this.instancedMesh.instanceMatrix.needsUpdate = true;
}
```

**Step 2: maxAgents 증가**

`AgentRenderer.ts`의 `DEFAULT_CONFIG` 수정:

```typescript
const DEFAULT_CONFIG: AgentRendererConfig = {
  maxAgents: 1000,  // 500 → 1000
  agentRadius: 0.5,
  agentHeight: 2.0,
  agentColor: 0xff4444,
};
```

**Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

**Step 4: Commit**

```bash
git add src/entities/AgentRenderer.ts
git commit -m "feat: add TypedArray rendering support to AgentRenderer"
```

---

## Task 7: Flow Field 시각화

**Files:**
- Create: `src/navigation/FlowFieldVisualizer.ts`

**Step 1: FlowFieldVisualizer 클래스 생성**

```typescript
// src/navigation/FlowFieldVisualizer.ts
import * as THREE from 'three';
import { FlowFieldCalculator } from './FlowFieldCalculator';
import { CustomNavMeshData } from '../types/flowfield';

export class FlowFieldVisualizer {
  private scene: THREE.Scene;
  private arrowGroup: THREE.Group;
  private visible: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.arrowGroup = new THREE.Group();
    this.arrowGroup.name = 'flowFieldVisualizer';
    this.scene.add(this.arrowGroup);
  }

  /**
   * Flow Field 시각화 업데이트
   */
  public update(
    flowFieldCalculator: FlowFieldCalculator,
    targetId: number
  ): void {
    // 기존 화살표 제거
    this.clear();

    if (!this.visible) return;

    const navMeshData = flowFieldCalculator.getNavMeshData();
    const flowFieldData = flowFieldCalculator.getFlowFieldData(targetId);

    if (!navMeshData || !flowFieldData) return;

    const arrowLength = 0.8;
    const arrowColor = 0x00ff00;

    for (let i = 0; i < navMeshData.polyCount; i++) {
      const poly = navMeshData.polygons[i];
      const dirIdx = i * 3;

      const dx = flowFieldData.directions[dirIdx];
      const dy = flowFieldData.directions[dirIdx + 1];
      const dz = flowFieldData.directions[dirIdx + 2];

      // 방향이 0이면 스킵 (타겟 폴리곤)
      if (dx === 0 && dy === 0 && dz === 0) continue;

      // 도달 불가능한 폴리곤 스킵
      if (flowFieldData.distances[i] === Infinity) continue;

      // 거리에 따른 색상 (가까울수록 밝음)
      const maxDist = 50;
      const t = Math.min(flowFieldData.distances[i] / maxDist, 1);
      const color = new THREE.Color().setHSL(0.3 - t * 0.3, 1, 0.3 + (1 - t) * 0.4);

      // 화살표 생성
      const origin = poly.center.clone();
      origin.y += 0.2; // 지면 위로 살짝

      const dir = new THREE.Vector3(dx, dy, dz);
      const arrow = new THREE.ArrowHelper(
        dir,
        origin,
        arrowLength,
        color.getHex(),
        arrowLength * 0.3,
        arrowLength * 0.2
      );

      this.arrowGroup.add(arrow);
    }
  }

  /**
   * 시각화 토글
   */
  public toggle(): void {
    this.visible = !this.visible;
    this.arrowGroup.visible = this.visible;
  }

  /**
   * 시각화 표시 설정
   */
  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.arrowGroup.visible = visible;
  }

  /**
   * 화살표 제거
   */
  public clear(): void {
    while (this.arrowGroup.children.length > 0) {
      const child = this.arrowGroup.children[0];
      this.arrowGroup.remove(child);
      if (child instanceof THREE.ArrowHelper) {
        child.dispose();
      }
    }
  }

  /**
   * 리소스 해제
   */
  public dispose(): void {
    this.clear();
    this.scene.remove(this.arrowGroup);
  }
}
```

**Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

**Step 3: Commit**

```bash
git add src/navigation/FlowFieldVisualizer.ts
git commit -m "feat: add FlowFieldVisualizer with directional arrows"
```

---

## Task 8: main.ts 통합

**Files:**
- Modify: `src/main.ts`

**Step 1: Flow Field 시스템 통합**

`main.ts`의 주요 변경 사항:

1. 새로운 import 추가
2. FlowFieldAgentSystem 인스턴스 생성
3. NavMesh 빌드 후 데이터 추출
4. 시뮬레이션 루프에서 FlowFieldAgentSystem.update() 사용
5. AgentRenderer.updateFromTypedArrays() 사용

```typescript
// main.ts 상단에 import 추가
import { FlowFieldAgentSystem } from './entities/FlowFieldAgentSystem';
import { NavMeshExtractor } from './navigation/NavMeshExtractor';
import { FlowFieldVisualizer } from './navigation/FlowFieldVisualizer';
import { Target } from './types/flowfield';

// App 클래스 멤버 추가
private flowFieldAgentSystem: FlowFieldAgentSystem | null = null;
private flowFieldVisualizer: FlowFieldVisualizer | null = null;
private useFlowField: boolean = true; // Flow Field 사용 여부

// init() 에서 초기화 추가
this.flowFieldAgentSystem = new FlowFieldAgentSystem({
  maxAgents: 1000,
  maxSpeed: 5.0,
  radius: 0.5,
  separationWeight: 2.0,
});
this.flowFieldVisualizer = new FlowFieldVisualizer(this.scene.scene);

// buildNavMesh() 에서 데이터 추출 추가
if (success) {
  const navMesh = this.navMeshBuilder!.getNavMesh();
  if (navMesh) {
    // 기존 시각화
    this.navMeshVisualizer!.update(navMesh);

    // Flow Field 시스템에 NavMesh 데이터 전달
    if (this.flowFieldAgentSystem) {
      const navMeshData = NavMeshExtractor.extract(navMesh);
      this.flowFieldAgentSystem.setNavMeshData(navMeshData);
      console.log(`NavMesh extracted: ${navMeshData.polyCount} polygons`);
    }
  }
}

// updateSimulation() 수정
private updateSimulation(deltaTime: number): void {
  if (!this.player || !this.agentRenderer) return;

  const playerPos = this.player.getGroundPosition();

  if (this.useFlowField && this.flowFieldAgentSystem) {
    // Flow Field 기반 시뮬레이션
    const target: Target = {
      id: 0,
      position: playerPos,
      radius: this.player.getRadius(),
      color: 0x00aaff,
    };
    this.flowFieldAgentSystem.setTarget(target);

    // 스폰
    this.spawnTimer += deltaTime;
    const spawnInterval = 1 / this.spawnRate;
    while (this.spawnTimer >= spawnInterval) {
      this.spawnTimer -= spawnInterval;
      this.spawnAgentFlowField();
    }

    // 업데이트
    this.flowFieldAgentSystem.update(deltaTime);

    // 플레이어 근처 에이전트 제거
    const catchRadius = this.player.getRadius() + 1.0;
    this.flowFieldAgentSystem.removeAgentsNearTarget(0, catchRadius);

    // 렌더링
    const agentData = this.flowFieldAgentSystem.getAgentData();
    this.agentRenderer.updateFromTypedArrays(
      agentData.positions,
      agentData.velocities,
      agentData.count
    );
  } else {
    // 기존 Detour Crowd 시뮬레이션
    // ... (기존 코드)
  }
}

// 새로운 스폰 메서드
private spawnAgentFlowField(): void {
  if (!this.flowFieldAgentSystem || !this.player) return;

  const playerPos = this.player.getGroundPosition();
  const angle = Math.random() * Math.PI * 2;
  const x = playerPos.x + Math.cos(angle) * this.spawnDistance;
  const z = playerPos.z + Math.sin(angle) * this.spawnDistance;

  // 경계 제한
  const halfGround = this.groundSize / 2 - 1;
  const clampedX = Math.max(-halfGround, Math.min(halfGround, x));
  const clampedZ = Math.max(-halfGround, Math.min(halfGround, z));

  this.flowFieldAgentSystem.addAgent(clampedX, 0, clampedZ);
}
```

**Step 2: 타입 체크 및 빌드**

Run: `npx tsc --noEmit && npm run build`
Expected: 에러 없음

**Step 3: 테스트**

Run: `npm run dev`
Expected:
- NavMesh 빌드 후 Flow Field 시스템 활성화
- 1000개 에이전트가 플레이어를 향해 이동
- 240fps+ 유지

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: integrate FlowFieldAgentSystem into main app"
```

---

## Task 9: UI 토글 및 파라미터

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`

**Step 1: UI에 Flow Field 토글 추가**

`index.html`의 control-panel에 추가:

```html
<div class="toggle-group">
  <label>
    <input type="checkbox" id="toggle-flowfield" checked>
    Flow Field Mode
  </label>
</div>
<div class="toggle-group">
  <label>
    <input type="checkbox" id="toggle-flowfield-viz">
    Show Flow Field
  </label>
</div>
```

**Step 2: 이벤트 핸들러 추가**

`main.ts`의 `setupUI()`에 추가:

```typescript
// Flow Field 토글
document.getElementById('toggle-flowfield')?.addEventListener('change', (e) => {
  this.useFlowField = (e.target as HTMLInputElement).checked;
  console.log(`Flow Field mode: ${this.useFlowField}`);
});

// Flow Field 시각화 토글
document.getElementById('toggle-flowfield-viz')?.addEventListener('change', (e) => {
  if (this.flowFieldVisualizer) {
    this.flowFieldVisualizer.setVisible((e.target as HTMLInputElement).checked);
    if ((e.target as HTMLInputElement).checked) {
      this.flowFieldVisualizer.update(
        this.flowFieldAgentSystem!.getFlowFieldCalculator(),
        0
      );
    }
  }
});
```

**Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

**Step 4: Commit**

```bash
git add index.html src/main.ts
git commit -m "feat: add UI toggles for Flow Field mode and visualization"
```

---

## Task 10: 성능 테스트 및 최종 검증

**Step 1: 성능 테스트**

1. 브라우저에서 `http://localhost:3000` 접속
2. Build NavMesh 클릭
3. Start 클릭
4. Spawn Rate를 50으로 설정
5. 1000 에이전트 도달 시 FPS 확인

**Expected Results:**
- 1000 에이전트: 240fps+ (데스크톱)
- Flow Field 시각화 ON: 약간의 FPS 감소 허용

**Step 2: 콘솔 로그 확인**

Expected logs:
```
NavMesh built successfully
NavMesh extracted: XX polygons
Flow Field mode: true
```

**Step 3: 최종 커밋**

```bash
git add -A
git commit -m "feat: complete Flow Field crowd simulation system"
```

---

## Summary

구현 완료 후 결과물:
- ✅ TypedArray 기반 에이전트 시스템 (1000+)
- ✅ Spatial Hash Grid (O(n) 이웃 탐색)
- ✅ BFS 기반 Flow Field 계산
- ✅ 다중 타겟 지원 구조
- ✅ Flow Field 시각화
- ✅ 기존 Detour Crowd와 토글 가능

**성능 목표:**
- 1000 에이전트, 240fps+ (데스크톱)
- Flow Field 계산: 50ms 이하

**다음 단계 (Phase 2):**
- NavMesh 편집 시스템
- 폴리곤 속성 (water, hazard 등)
- 넉백 시스템
- Web Worker 병렬화
