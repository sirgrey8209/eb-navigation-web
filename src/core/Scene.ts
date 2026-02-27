import * as THREE from 'three';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualitySettings {
  pixelRatio: number;
  shadowMapSize: number;
  shadowsEnabled: boolean;
  antialias: boolean;
}

const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  low: {
    pixelRatio: 1,
    shadowMapSize: 512,
    shadowsEnabled: false,
    antialias: false,
  },
  medium: {
    pixelRatio: 1.5,
    shadowMapSize: 1024,
    shadowsEnabled: true,
    antialias: true,
  },
  high: {
    pixelRatio: 2,
    shadowMapSize: 2048,
    shadowsEnabled: true,
    antialias: true,
  },
};

export class Scene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  private container: HTMLElement;
  private width: number;
  private height: number;
  private directionalLight: THREE.DirectionalLight | null = null;
  private currentQuality: QualityLevel = 'high';

  constructor(container: HTMLElement, quality?: QualityLevel) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    // Auto-detect quality based on device
    if (!quality) {
      quality = this.detectOptimalQuality();
    }
    this.currentQuality = quality;

    const settings = QUALITY_PRESETS[quality];

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
      antialias: settings.antialias,
      powerPreference: quality === 'low' ? 'low-power' : 'high-performance',
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatio));
    this.renderer.shadowMap.enabled = settings.shadowsEnabled;
    this.renderer.shadowMap.type = settings.shadowsEnabled
      ? THREE.PCFSoftShadowMap
      : THREE.BasicShadowMap;

    container.appendChild(this.renderer.domElement);

    // Lighting
    this.setupLights(settings);

    // Handle resize
    window.addEventListener('resize', this.onResize.bind(this));

    console.log(`Scene initialized with quality: ${quality}`);
  }

  /**
   * Auto-detect optimal quality based on device capabilities
   */
  private detectOptimalQuality(): QualityLevel {
    // Check for mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    // Check for touch device
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Check device pixel ratio
    const dpr = window.devicePixelRatio || 1;

    // Check hardware concurrency (CPU cores)
    const cores = navigator.hardwareConcurrency || 2;

    // Check available memory (if available)
    const memory = (navigator as any).deviceMemory || 4; // GB

    // Decision logic
    if (isMobile || isTouch) {
      if (cores <= 4 || memory <= 2 || dpr > 2) {
        return 'low';
      }
      return 'medium';
    }

    // Desktop
    if (cores >= 8 && memory >= 8) {
      return 'high';
    } else if (cores >= 4 && memory >= 4) {
      return 'medium';
    }

    return 'medium';
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

  private setupLights(settings: QualitySettings): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Directional light (sun)
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(50, 100, 50);
    this.directionalLight.castShadow = settings.shadowsEnabled;
    this.directionalLight.shadow.mapSize.width = settings.shadowMapSize;
    this.directionalLight.shadow.mapSize.height = settings.shadowMapSize;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 500;
    this.directionalLight.shadow.camera.left = -100;
    this.directionalLight.shadow.camera.right = 100;
    this.directionalLight.shadow.camera.top = 100;
    this.directionalLight.shadow.camera.bottom = -100;
    this.scene.add(this.directionalLight);

    // Hemisphere light for sky/ground color
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x362312, 0.3);
    this.scene.add(hemisphereLight);
  }

  /**
   * Change quality settings at runtime
   */
  public setQuality(quality: QualityLevel): void {
    if (quality === this.currentQuality) return;

    const settings = QUALITY_PRESETS[quality];
    this.currentQuality = quality;

    // Update renderer
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatio));
    this.renderer.shadowMap.enabled = settings.shadowsEnabled;

    // Update shadow map
    if (this.directionalLight) {
      this.directionalLight.castShadow = settings.shadowsEnabled;
      this.directionalLight.shadow.mapSize.width = settings.shadowMapSize;
      this.directionalLight.shadow.mapSize.height = settings.shadowMapSize;
      this.directionalLight.shadow.map?.dispose();
      this.directionalLight.shadow.map = null;
    }

    // Force resize to apply new pixel ratio
    this.onResize();

    console.log(`Quality changed to: ${quality}`);
  }

  /**
   * Get current quality level
   */
  public getQuality(): QualityLevel {
    return this.currentQuality;
  }

  /**
   * Get available quality levels
   */
  public getQualityLevels(): QualityLevel[] {
    return ['low', 'medium', 'high'];
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
