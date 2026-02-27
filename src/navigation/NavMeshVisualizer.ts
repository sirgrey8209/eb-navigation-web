import * as THREE from 'three';
import { NavMesh, getNavMeshPositionsAndIndices } from 'recast-navigation';

export class NavMeshVisualizer {
  private scene: THREE.Scene;
  private meshGroup: THREE.Group;
  private visible: boolean = true;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.meshGroup = new THREE.Group();
    this.meshGroup.name = 'navmesh-visualization';
    this.scene.add(this.meshGroup);
  }

  public update(navMesh: NavMesh): void {
    this.clear();

    try {
      // Use the helper function to get positions and indices
      const [positions, indices] = getNavMeshPositionsAndIndices(navMesh);

      if (positions.length === 0) {
        console.warn('No NavMesh data to visualize');
        return;
      }

      console.log(`Visualizing NavMesh with ${positions.length / 3} vertices, ${indices.length / 3} triangles`);

      // Create geometry
      const geometry = new THREE.BufferGeometry();

      // Offset Y slightly to avoid z-fighting with ground
      const offsetPositions = new Float32Array(positions.length);
      for (let i = 0; i < positions.length; i += 3) {
        offsetPositions[i] = positions[i];         // x
        offsetPositions[i + 1] = positions[i + 1] + 0.05; // y (offset)
        offsetPositions[i + 2] = positions[i + 2]; // z
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(offsetPositions, 3));
      geometry.setIndex(Array.from(indices));
      geometry.computeVertexNormals();

      // NavMesh surface (semi-transparent green)
      const surfaceMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const surfaceMesh = new THREE.Mesh(geometry, surfaceMaterial);
      surfaceMesh.renderOrder = 1;
      this.meshGroup.add(surfaceMesh);

      // Edge lines (yellow)
      const edgeGeometry = new THREE.EdgesGeometry(geometry, 1);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8,
      });
      const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      edges.renderOrder = 2;
      this.meshGroup.add(edges);

      console.log('NavMesh visualization updated');
    } catch (error) {
      console.error('Failed to visualize NavMesh:', error);
    }
  }

  public clear(): void {
    while (this.meshGroup.children.length > 0) {
      const child = this.meshGroup.children[0];
      this.meshGroup.remove(child);

      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.meshGroup.visible = visible;
  }

  public toggle(): boolean {
    this.visible = !this.visible;
    this.meshGroup.visible = this.visible;
    return this.visible;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public dispose(): void {
    this.clear();
    this.scene.remove(this.meshGroup);
  }
}
