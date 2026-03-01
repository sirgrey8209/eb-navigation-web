import * as THREE from 'three';

export type ObjectType = 'cube' | 'ramp' | 'cylinder';

export interface PlacedObject {
  id: string;
  type: ObjectType;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  size: THREE.Vector3;
  rotation: THREE.Euler;
}

export interface ObjectManagerEvents {
  onSelect: (object: PlacedObject | null) => void;
  onPlace: (object: PlacedObject) => void;
  onDelete: (id: string) => void;
}

export * from './flowfield';
