import * as THREE from 'three';
import { AgentData } from '../navigation/CrowdManager';

export interface AgentRendererConfig {
  maxAgents: number;
  agentRadius: number;
  agentHeight: number;
  agentColor: number;
}

const DEFAULT_CONFIG: AgentRendererConfig = {
  maxAgents: 1000,
  agentRadius: 0.5,
  agentHeight: 2.0,
  agentColor: 0xff4444,
};

export class AgentRenderer {
  private config: AgentRendererConfig;
  private instancedMesh: THREE.InstancedMesh | null = null;
  private dummyMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private dummyPosition: THREE.Vector3 = new THREE.Vector3();
  private dummyQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private dummyScale: THREE.Vector3 = new THREE.Vector3(1, 1, 1);
  private readonly yAxis: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  private scene: THREE.Scene | null = null;
  private activeCount: number = 0;

  constructor(config: Partial<AgentRendererConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public initialize(scene: THREE.Scene): void {
    this.scene = scene;

    // Create capsule-like geometry for agents (cylinder approximation)
    const geometry = new THREE.CylinderGeometry(
      this.config.agentRadius,
      this.config.agentRadius,
      this.config.agentHeight,
      8, // Reduced segments for performance
      1
    );

    // Shift geometry so bottom is at Y=0
    geometry.translate(0, this.config.agentHeight / 2, 0);

    // Create material with slight variation capability
    const material = new THREE.MeshStandardMaterial({
      color: this.config.agentColor,
      metalness: 0.2,
      roughness: 0.8,
    });

    // Create instanced mesh
    this.instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      this.config.maxAgents
    );
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = true;
    this.instancedMesh.frustumCulled = false; // Disable for instanced mesh
    this.instancedMesh.count = 0; // Start with no visible instances

    scene.add(this.instancedMesh);
    console.log(`AgentRenderer initialized with max ${this.config.maxAgents} instances`);
  }

  public update(agents: AgentData[]): void {
    if (!this.instancedMesh) return;

    this.activeCount = agents.length;
    this.instancedMesh.count = this.activeCount;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];

      // Set position
      this.dummyPosition.copy(agent.position);

      // Calculate rotation from velocity (face movement direction)
      if (agent.velocity.lengthSq() > 0.01) {
        const angle = Math.atan2(agent.velocity.x, agent.velocity.z);
        this.dummyQuaternion.setFromAxisAngle(this.yAxis, angle);
      }

      // Compose matrix
      this.dummyMatrix.compose(this.dummyPosition, this.dummyQuaternion, this.dummyScale);
      this.instancedMesh.setMatrixAt(i, this.dummyMatrix);
    }

    // Mark instance matrix as needing update
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  public updateFromPositions(positions: Float32Array, count: number): void {
    if (!this.instancedMesh) return;

    this.activeCount = count;
    this.instancedMesh.count = count;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      this.dummyPosition.set(positions[idx], positions[idx + 1], positions[idx + 2]);
      this.dummyMatrix.compose(this.dummyPosition, this.dummyQuaternion, this.dummyScale);
      this.instancedMesh.setMatrixAt(i, this.dummyMatrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

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
        this.dummyQuaternion.setFromAxisAngle(this.yAxis, angle);
      }

      // 매트릭스 구성
      this.dummyMatrix.compose(this.dummyPosition, this.dummyQuaternion, this.dummyScale);
      this.instancedMesh.setMatrixAt(i, this.dummyMatrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  public setColor(color: number): void {
    if (this.instancedMesh) {
      (this.instancedMesh.material as THREE.MeshStandardMaterial).color.setHex(color);
    }
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public setVisible(visible: boolean): void {
    if (this.instancedMesh) {
      this.instancedMesh.visible = visible;
    }
  }

  public dispose(): void {
    if (this.instancedMesh && this.scene) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }
  }
}
