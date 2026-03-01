// src/navigation/FlowFieldVisualizer.ts
import * as THREE from 'three';
import { FlowFieldCalculator } from './FlowFieldCalculator';

// Visualization constants
const ARROW_LENGTH = 0.8;
const MAX_DISTANCE_FOR_COLOR = 50;
const ARROW_Y_OFFSET = 0.2;
const ARROW_HEAD_LENGTH_RATIO = 0.3;
const ARROW_HEAD_WIDTH_RATIO = 0.2;

export class FlowFieldVisualizer {
  private readonly scene: THREE.Scene;
  private readonly arrowGroup: THREE.Group;
  private visible: boolean = false;

  // Scratch objects to avoid per-frame allocations
  private readonly scratchColor: THREE.Color = new THREE.Color();
  private readonly scratchOrigin: THREE.Vector3 = new THREE.Vector3();
  private readonly scratchDir: THREE.Vector3 = new THREE.Vector3();

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
      const t = Math.min(flowFieldData.distances[i] / MAX_DISTANCE_FOR_COLOR, 1);
      this.scratchColor.setHSL(0.3 - t * 0.3, 1, 0.3 + (1 - t) * 0.4);

      // 화살표 위치 (scratch vector 사용)
      this.scratchOrigin.copy(poly.center);
      this.scratchOrigin.y += ARROW_Y_OFFSET;

      // 방향 벡터 (scratch vector 사용)
      this.scratchDir.set(dx, dy, dz);

      // ArrowHelper 생성 (방향과 원점 복사본 필요)
      const arrow = new THREE.ArrowHelper(
        this.scratchDir.clone(),
        this.scratchOrigin.clone(),
        ARROW_LENGTH,
        this.scratchColor.getHex(),
        ARROW_LENGTH * ARROW_HEAD_LENGTH_RATIO,
        ARROW_LENGTH * ARROW_HEAD_WIDTH_RATIO
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
      if (!child) break;
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
