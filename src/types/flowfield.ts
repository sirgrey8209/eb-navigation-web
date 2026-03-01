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
