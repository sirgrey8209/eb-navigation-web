import { Crowd, CrowdAgent } from 'recast-navigation';
import type { NavMesh } from 'recast-navigation';
import * as THREE from 'three';

export interface AgentData {
  id: number;
  crowdAgent: CrowdAgent;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetPosition: THREE.Vector3 | null;
  active: boolean;
}

export interface CrowdConfig {
  maxAgents: number;
  agentRadius: number;
  agentHeight: number;
  maxAgentSpeed: number;
  separationWeight: number;
}

const DEFAULT_CONFIG: CrowdConfig = {
  maxAgents: 500,
  agentRadius: 0.5,
  agentHeight: 2.0,
  maxAgentSpeed: 5.0,
  separationWeight: 2.0,
};

export class CrowdManager {
  private crowd: Crowd | null = null;
  private agents: Map<number, AgentData> = new Map();
  private config: CrowdConfig;
  private agentIdCounter: number = 0;

  constructor(config: Partial<CrowdConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public initialize(navMesh: NavMesh): boolean {
    if (!navMesh) {
      console.error('NavMesh is required to initialize CrowdManager');
      return false;
    }

    // Create crowd
    this.crowd = new Crowd(navMesh, {
      maxAgents: this.config.maxAgents,
      maxAgentRadius: this.config.agentRadius * 2,
    });

    console.log(`CrowdManager initialized with max ${this.config.maxAgents} agents`);
    return true;
  }

  public addAgent(position: THREE.Vector3, targetPosition?: THREE.Vector3): AgentData | null {
    if (!this.crowd) {
      console.error('CrowdManager not initialized');
      return null;
    }

    if (this.agents.size >= this.config.maxAgents) {
      console.warn('Max agent limit reached');
      return null;
    }

    // Add agent to crowd
    const crowdAgent = this.crowd.addAgent(
      { x: position.x, y: position.y, z: position.z },
      {
        radius: this.config.agentRadius,
        height: this.config.agentHeight,
        maxSpeed: this.config.maxAgentSpeed,
        maxAcceleration: 8.0,
        collisionQueryRange: this.config.agentRadius * 12,
        pathOptimizationRange: this.config.agentRadius * 30,
        separationWeight: this.config.separationWeight,
      }
    );

    if (!crowdAgent) {
      console.warn('Failed to add agent to crowd');
      return null;
    }

    const agentData: AgentData = {
      id: this.agentIdCounter++,
      crowdAgent,
      position: position.clone(),
      velocity: new THREE.Vector3(),
      targetPosition: targetPosition?.clone() || null,
      active: true,
    };

    // Set initial target if provided
    if (targetPosition) {
      crowdAgent.requestMoveTarget({ x: targetPosition.x, y: targetPosition.y, z: targetPosition.z });
    }

    this.agents.set(agentData.id, agentData);
    return agentData;
  }

  public removeAgent(id: number): boolean {
    const agentData = this.agents.get(id);
    if (!agentData || !this.crowd) return false;

    this.crowd.removeAgent(agentData.crowdAgent);
    this.agents.delete(id);
    return true;
  }

  public setAgentTarget(id: number, target: THREE.Vector3): boolean {
    const agentData = this.agents.get(id);
    if (!agentData) return false;

    agentData.crowdAgent.requestMoveTarget({ x: target.x, y: target.y, z: target.z });
    agentData.targetPosition = target.clone();
    return true;
  }

  public setAllAgentsTarget(target: THREE.Vector3): void {
    this.agents.forEach(agent => {
      agent.crowdAgent.requestMoveTarget({ x: target.x, y: target.y, z: target.z });
      agent.targetPosition = target.clone();
    });
  }

  public update(deltaTime: number): void {
    if (!this.crowd) return;

    // Update crowd simulation
    this.crowd.update(deltaTime);

    // Update agent data from crowd
    this.agents.forEach(agent => {
      const pos = agent.crowdAgent.position();
      const vel = agent.crowdAgent.velocity();

      agent.position.set(pos.x, pos.y, pos.z);
      agent.velocity.set(vel.x, vel.y, vel.z);
    });
  }

  /**
   * Remove agents that are within a certain distance of a target point
   * @param target The target position to check against
   * @param radius The distance threshold for removal
   * @returns Number of agents removed
   */
  public removeAgentsNearTarget(target: THREE.Vector3, radius: number): number {
    if (!this.crowd) return 0;

    const toRemove: number[] = [];

    this.agents.forEach(agent => {
      const dx = agent.position.x - target.x;
      const dz = agent.position.z - target.z;
      const distanceSq = dx * dx + dz * dz;

      if (distanceSq <= radius * radius) {
        toRemove.push(agent.id);
      }
    });

    toRemove.forEach(id => this.removeAgent(id));

    return toRemove.length;
  }

  public getAgents(): AgentData[] {
    return Array.from(this.agents.values());
  }

  public getAgentCount(): number {
    return this.agents.size;
  }

  public getAgent(id: number): AgentData | undefined {
    return this.agents.get(id);
  }

  public getAgentPositions(): Float32Array {
    const positions = new Float32Array(this.agents.size * 3);
    let i = 0;
    this.agents.forEach(agent => {
      positions[i++] = agent.position.x;
      positions[i++] = agent.position.y;
      positions[i++] = agent.position.z;
    });
    return positions;
  }

  public clearAllAgents(): void {
    if (!this.crowd) return;

    this.agents.forEach(agent => {
      this.crowd!.removeAgent(agent.crowdAgent);
    });
    this.agents.clear();
  }

  public spawnAgentsAroundPoint(
    center: THREE.Vector3,
    count: number,
    minDistance: number,
    maxDistance: number,
    target?: THREE.Vector3
  ): number {
    let spawned = 0;

    for (let i = 0; i < count; i++) {
      // Random angle and distance
      const angle = Math.random() * Math.PI * 2;
      const distance = minDistance + Math.random() * (maxDistance - minDistance);

      const spawnPos = new THREE.Vector3(
        center.x + Math.cos(angle) * distance,
        0,
        center.z + Math.sin(angle) * distance
      );

      const agent = this.addAgent(spawnPos, target || center);
      if (agent) spawned++;
    }

    return spawned;
  }

  public dispose(): void {
    this.clearAllAgents();
    this.crowd = null;
    this.agents.clear();
  }
}
