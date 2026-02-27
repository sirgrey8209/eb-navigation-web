import * as THREE from 'three';

export class Ground {
  public mesh: THREE.Mesh;
  public gridHelper: THREE.GridHelper;

  private size: number;

  constructor(size: number = 100, gridDivisions: number = 10) {
    this.size = size;

    // Ground plane
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshStandardMaterial({
      color: 0xe0e0e0,
      roughness: 0.8,
      metalness: 0.1,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    this.mesh.receiveShadow = true;
    this.mesh.name = 'ground';

    // Grid helper
    this.gridHelper = new THREE.GridHelper(
      size,
      gridDivisions,
      0x444444, // Center line color
      0x333333  // Grid line color
    );
  }

  public addToScene(scene: THREE.Scene): void {
    scene.add(this.mesh);
    scene.add(this.gridHelper);
  }

  public removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    scene.remove(this.gridHelper);
  }

  public getSize(): number {
    return this.size;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.gridHelper.dispose();
  }
}
