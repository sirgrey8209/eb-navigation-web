import * as THREE from 'three';

export class Scene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  private container: HTMLElement;
  private width: number;
  private height: number;

  constructor(container: HTMLElement) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Camera (Perspective for quarter view)
    this.camera = new THREE.PerspectiveCamera(
      35, // Low FOV for isometric-like feel
      this.width / this.height,
      0.1,
      1000
    );
    this.setupCamera();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // Lighting
    this.setupLights();

    // Handle resize
    window.addEventListener('resize', this.onResize.bind(this));
  }

  private setupCamera(): void {
    // Quarter view position: 45° yaw, 45-60° pitch
    const distance = 80;
    const angle = Math.PI / 4; // 45°
    const pitch = Math.PI / 4; // 45°

    this.camera.position.set(
      Math.cos(angle) * Math.cos(pitch) * distance,
      Math.sin(pitch) * distance,
      Math.sin(angle) * Math.cos(pitch) * distance
    );
    this.camera.lookAt(0, 0, 0);
  }

  private setupLights(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);

    // Hemisphere light for sky/ground color
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x362312, 0.3);
    this.scene.add(hemisphereLight);
  }

  private onResize(): void {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResize.bind(this));
    this.renderer.dispose();
  }
}
