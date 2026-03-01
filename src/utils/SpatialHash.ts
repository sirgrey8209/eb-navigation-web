// src/utils/SpatialHash.ts

export class SpatialHash {
  private readonly _cellSize: number;
  private readonly invCellSize: number;
  private grid: Map<number, number[]>;
  private readonly worldSize: number;
  private readonly gridSize: number;

  constructor(cellSize: number = 2.0, worldSize: number = 100) {
    this._cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.worldSize = worldSize;
    this.gridSize = Math.ceil(worldSize / cellSize);
    this.grid = new Map();
  }

  /**
   * 셀 크기 반환
   */
  public get cellSize(): number {
    return this._cellSize;
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

    const halfWorld = this.worldSize / 2;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const x = positions[idx];
      const z = positions[idx + 2];

      // 월드 경계 체크 - 범위 밖 에이전트는 스킵
      if (x < -halfWorld || x >= halfWorld || z < -halfWorld || z >= halfWorld) {
        continue;
      }

      const cx = Math.floor((x + halfWorld) * this.invCellSize);
      const cz = Math.floor((z + halfWorld) * this.invCellSize);

      // 그리드 경계 체크 (부동소수점 오차 방지)
      if (cx < 0 || cx >= this.gridSize || cz < 0 || cz >= this.gridSize) {
        continue;
      }

      const hash = cz * this.gridSize + cx;

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
