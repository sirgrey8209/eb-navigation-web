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
    const maxTiles = navMesh.getMaxTiles();

    let polyId = 0;

    // 모든 타일 순회
    for (let tileIdx = 0; tileIdx < maxTiles; tileIdx++) {
      const tile = navMesh.getTile(tileIdx);
      const header = tile?.header();
      if (!tile || !header) continue;

      const tilePolyCount = header.polyCount();

      for (let polyIdx = 0; polyIdx < tilePolyCount; polyIdx++) {
        const poly = tile.polys(polyIdx);
        if (!poly) continue;

        // 폴리곤 정점 추출
        const vertices: THREE.Vector3[] = [];
        const vertCount = poly.vertCount();

        for (let v = 0; v < vertCount; v++) {
          const vertIdx = poly.verts(v);
          const x = tile.verts(vertIdx * 3);
          const y = tile.verts(vertIdx * 3 + 1);
          const z = tile.verts(vertIdx * 3 + 2);
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
          const neiRef = poly.neis(n);
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
