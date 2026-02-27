// EB Navigation Web - Main Entry Point
import { Scene } from './core/Scene';
import { CameraController } from './core/CameraController';
import { Ground } from './objects/Ground';
import { Profiler } from './utils/Profiler';

console.log('EB Navigation Web - Starting...');

class App {
  private scene: Scene | null = null;
  private cameraController: CameraController | null = null;
  private ground: Ground | null = null;
  private profiler: Profiler | null = null;
  private animationId: number = 0;

  constructor() {
    console.log('App initialized');
    this.init();
  }

  private init(): void {
    const viewport = document.getElementById('viewport');
    if (!viewport) {
      console.error('Viewport element not found');
      return;
    }

    // Initialize Three.js Scene
    this.scene = new Scene(viewport);

    // Initialize Camera Controller
    this.cameraController = new CameraController(
      this.scene.camera,
      viewport,
      {
        minZoom: 10,
        maxZoom: 200,
        panSpeed: 1,
        zoomSpeed: 0.1,
      }
    );

    // Add ground
    this.ground = new Ground(100, 10);
    this.ground.addToScene(this.scene.scene);

    // Initialize Profiler
    this.profiler = new Profiler();

    // Start render loop
    this.animate();

    // Setup UI
    this.setupSliders();
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.profiler) {
      this.profiler.beginFrame();
    }

    if (this.cameraController) {
      this.cameraController.update();
    }

    if (this.scene) {
      this.scene.render();
    }

    if (this.profiler) {
      this.profiler.endFrame();
    }
  };

  private setupSliders(): void {
    const spawnRate = document.getElementById('spawn-rate') as HTMLInputElement;
    const spawnRateValue = document.getElementById('spawn-rate-value');
    const spawnDist = document.getElementById('spawn-dist') as HTMLInputElement;
    const spawnDistValue = document.getElementById('spawn-dist-value');

    if (spawnRate && spawnRateValue) {
      spawnRate.addEventListener('input', () => {
        spawnRateValue.textContent = spawnRate.value;
      });
    }

    if (spawnDist && spawnDistValue) {
      spawnDist.addEventListener('input', () => {
        spawnDistValue.textContent = spawnDist.value;
      });
    }
  }
}

// Start the app
new App();
