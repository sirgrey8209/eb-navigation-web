// EB Navigation Web - Main Entry Point
import { Scene } from './core/Scene';
import { CameraController } from './core/CameraController';
import { Ground } from './objects/Ground';
import { ObjectManager } from './objects/ObjectManager';
import { Profiler } from './utils/Profiler';
import { PlacedObject } from './types';

console.log('EB Navigation Web - Starting...');

class App {
  private scene: Scene | null = null;
  private cameraController: CameraController | null = null;
  private ground: Ground | null = null;
  private objectManager: ObjectManager | null = null;
  private profiler: Profiler | null = null;
  private _animationId: number = 0;

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

    // Initialize Object Manager
    this.objectManager = new ObjectManager(
      this.scene.scene,
      this.scene.camera,
      viewport,
      {
        onSelect: this.onObjectSelect.bind(this),
        onPlace: this.onObjectPlace.bind(this),
        onDelete: this.onObjectDelete.bind(this),
      }
    );

    // Initialize Profiler
    this.profiler = new Profiler();

    // Start render loop
    this.animate();

    // Setup UI
    this.setupUI();
  }

  private animate = (): void => {
    this._animationId = requestAnimationFrame(this.animate);

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

  private setupUI(): void {
    // Object buttons
    document.getElementById('btn-cube')?.addEventListener('click', () => {
      this.objectManager?.startPlacement('cube');
      this.setActiveButton('btn-cube');
    });

    document.getElementById('btn-ramp')?.addEventListener('click', () => {
      this.objectManager?.startPlacement('ramp');
      this.setActiveButton('btn-ramp');
    });

    document.getElementById('btn-cylinder')?.addEventListener('click', () => {
      this.objectManager?.startPlacement('cylinder');
      this.setActiveButton('btn-cylinder');
    });

    // Sliders
    this.setupSliders();
  }

  private setActiveButton(activeId: string): void {
    ['btn-cube', 'btn-ramp', 'btn-cylinder'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.classList.toggle('active', id === activeId);
      }
    });
  }

  private onObjectSelect(object: PlacedObject | null): void {
    const info = document.getElementById('selected-info');
    if (info) {
      if (object) {
        info.innerHTML = `
          <p>Selected: ${object.id}</p>
          <p>Type: ${object.type}</p>
          <p>Position: (${object.position.x.toFixed(1)}, ${object.position.z.toFixed(1)})</p>
        `;
      } else {
        info.innerHTML = '<p>Selected: None</p>';
      }
    }
  }

  private onObjectPlace(object: PlacedObject): void {
    console.log('Object placed:', object.id);
  }

  private onObjectDelete(id: string): void {
    console.log('Object deleted:', id);
  }

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

  public dispose(): void {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
    }
    this.objectManager?.dispose();
    this.cameraController?.dispose();
    this.scene?.dispose();
  }
}

// Start the app
new App();
