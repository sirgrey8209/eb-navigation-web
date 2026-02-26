// EB Navigation Web - Main Entry Point
import { Scene } from './core/Scene';

console.log('EB Navigation Web - Starting...');

class App {
  private scene: Scene | null = null;
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

    // Start render loop
    this.animate();

    // Setup UI
    this.setupSliders();
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.scene) {
      this.scene.render();
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
