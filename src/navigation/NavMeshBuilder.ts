import { init, NavMesh, NavMeshQuery } from 'recast-navigation';
import { generateSoloNavMesh } from '@recast-navigation/generators';
import * as THREE from 'three';
import { PlacedObject } from '../types';

export interface NavMeshConfig {
  cellSize: number;
  cellHeight: number;
  agentRadius: number;
  agentHeight: number;
  agentMaxClimb: number;
  agentMaxSlope: number;
}

const DEFAULT_CONFIG: NavMeshConfig = {
  cellSize: 0.3,
  cellHeight: 0.2,
  agentRadius: 0.5,
  agentHeight: 2.0,
  agentMaxClimb: 0.4,
  agentMaxSlope: 45,
};

export class NavMeshBuilder {
  private navMesh: NavMesh | null = null;
  private navMeshQuery: NavMeshQuery | null = null;
  private config: NavMeshConfig;
  private initialized: boolean = false;

  constructor(config: Partial<NavMeshConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public async initialize(): Promise<void> {
    await init();
    this.initialized = true;
    console.log('Recast Navigation initialized');
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public build(groundSize: number, objects: PlacedObject[]): boolean {
    if (!this.initialized) {
      console.error('NavMeshBuilder not initialized');
      return false;
    }

    // Collect geometry
    const { positions, indices } = this.collectGeometry(groundSize, objects);

    console.log(`Building NavMesh with ${positions.length / 3} vertices, ${indices.length / 3} triangles`);

    // Generate NavMesh
    const result = generateSoloNavMesh(positions, indices, {
      cs: this.config.cellSize,
      ch: this.config.cellHeight,
      walkableRadius: Math.ceil(this.config.agentRadius / this.config.cellSize),
      walkableHeight: Math.ceil(this.config.agentHeight / this.config.cellHeight),
      walkableClimb: Math.ceil(this.config.agentMaxClimb / this.config.cellHeight),
      walkableSlopeAngle: this.config.agentMaxSlope,
    });

    if (result.success) {
      this.navMesh = result.navMesh;
      this.navMeshQuery = new NavMeshQuery(this.navMesh);
      console.log('NavMesh built successfully');
      return true;
    } else {
      console.error('Failed to build NavMesh:', result.error);
      return false;
    }
  }

  private collectGeometry(groundSize: number, objects: PlacedObject[]): {
    positions: Float32Array;
    indices: Uint32Array;
  } {
    const allPositions: number[] = [];
    const allIndices: number[] = [];
    let indexOffset = 0;

    // Ground plane
    const halfSize = groundSize / 2;
    allPositions.push(
      -halfSize, 0, -halfSize,
      halfSize, 0, -halfSize,
      halfSize, 0, halfSize,
      -halfSize, 0, halfSize
    );
    allIndices.push(0, 2, 1, 0, 3, 2);
    indexOffset = 4;

    // Add objects as obstacles (we need to add their top surfaces for walkable areas)
    for (const obj of objects) {
      const mesh = obj.mesh;
      const geometry = mesh.geometry;

      const posAttr = geometry.getAttribute('position');
      const indexAttr = geometry.getIndex();

      if (!posAttr) continue;

      // Transform positions to world space
      mesh.updateMatrixWorld();
      for (let i = 0; i < posAttr.count; i++) {
        const vertex = new THREE.Vector3(
          posAttr.getX(i),
          posAttr.getY(i),
          posAttr.getZ(i)
        );
        vertex.applyMatrix4(mesh.matrixWorld);
        allPositions.push(vertex.x, vertex.y, vertex.z);
      }

      // Add indices with offset
      if (indexAttr) {
        for (let i = 0; i < indexAttr.count; i++) {
          allIndices.push(indexAttr.getX(i) + indexOffset);
        }
      } else {
        // Non-indexed geometry: create indices
        for (let i = 0; i < posAttr.count; i += 3) {
          allIndices.push(indexOffset + i, indexOffset + i + 1, indexOffset + i + 2);
        }
      }

      indexOffset += posAttr.count;
    }

    return {
      positions: new Float32Array(allPositions),
      indices: new Uint32Array(allIndices),
    };
  }

  public getNavMesh(): NavMesh | null {
    return this.navMesh;
  }

  public getNavMeshQuery(): NavMeshQuery | null {
    return this.navMeshQuery;
  }

  public getConfig(): NavMeshConfig {
    return { ...this.config };
  }

  public setConfig(config: Partial<NavMeshConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public findPath(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] {
    if (!this.navMeshQuery) return [];

    const pathResult = this.navMeshQuery.computePath(
      { x: start.x, y: start.y, z: start.z },
      { x: end.x, y: end.y, z: end.z },
      {
        halfExtents: { x: 2, y: 4, z: 2 },
      }
    );

    if (!pathResult.success) {
      console.warn('Failed to compute path:', pathResult.error);
      return [];
    }

    return pathResult.path.map(p => new THREE.Vector3(p.x, p.y, p.z));
  }

  public findRandomPoint(): THREE.Vector3 | null {
    if (!this.navMeshQuery) return null;

    const result = this.navMeshQuery.findRandomPoint();
    if (!result.success) return null;

    return new THREE.Vector3(result.randomPoint.x, result.randomPoint.y, result.randomPoint.z);
  }

  public dispose(): void {
    if (this.navMesh) {
      this.navMesh.destroy();
      this.navMesh = null;
    }
    this.navMeshQuery = null;
  }
}
