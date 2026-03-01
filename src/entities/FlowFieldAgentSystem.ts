// src/entities/FlowFieldAgentSystem.ts
import {
  AgentConfig,
  AgentArrays,
  AGENT_FLAG_ACTIVE,
  Target,
  CustomNavMeshData,
} from '../types/flowfield';
import { SpatialHash } from '../utils/SpatialHash';
import { FlowFieldCalculator } from '../navigation/FlowFieldCalculator';

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
      // y is not used in 2D pathfinding but kept in positions array for 3D rendering
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
