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
  private scratchDir: THREE.Vector3 = new THREE.Vector3();

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

    // BFS with index-based dequeue for efficiency
    const queue: number[] = [targetPolyId];
    let head = 0;
    distances[targetPolyId] = 0;
    // 타겟 폴리곤은 방향 (0, 0, 0)
    directions[targetPolyId * 3] = 0;
    directions[targetPolyId * 3 + 1] = 0;
    directions[targetPolyId * 3 + 2] = 0;

    while (head < queue.length) {
      const currentId = queue[head++];
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

        // 방향: 이웃 → 현재 (타겟 방향) - reuse scratch vector
        this.scratchDir
          .copy(currentPoly.center)
          .sub(neighborPoly.center)
          .normalize();
        directions[neighborId * 3] = this.scratchDir.x;
        directions[neighborId * 3 + 1] = this.scratchDir.y;
        directions[neighborId * 3 + 2] = this.scratchDir.z;

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
    if (idx >= flowField.directions.length) return null;
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
