// EB Navigation Web - Main Entry Point
import { Scene } from './core/Scene';
import { CameraController } from './core/CameraController';
import { Ground } from './objects/Ground';
import { ObjectManager } from './objects/ObjectManager';
import { NavMeshBuilder } from './navigation/NavMeshBuilder';
import { NavMeshVisualizer } from './navigation/NavMeshVisualizer';
import { Profiler } from './utils/Profiler';
import { PlacedObject } from './types';

console.log('EB Navigation Web - Starting...');

class App {
  private scene: Scene | null = null;
  private cameraController: CameraController | null = null;
  private ground: Ground | null = null;
  private objectManager: ObjectManager | null = null;
  private navMeshBuilder: NavMeshBuilder | null = null;
  private navMeshVisualizer: NavMeshVisualizer | null = null;
  private profiler: Profiler | null = null;
  private _animationId: number = 0;

  private groundSize: number = 100;

  constructor() {
    console.log('App initialized');
    this.init();
  }

  private async init(): Promise<void> {
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
    this.ground = new Ground(this.groundSize, 10);
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

    // Initialize NavMesh Builder
    this.navMeshBuilder = new NavMeshBuilder();
    await this.navMeshBuilder.initialize();

    // Initialize NavMesh Visualizer
    this.navMeshVisualizer = new NavMeshVisualizer(this.scene.scene);

    // Initialize Profiler
    this.profiler = new Profiler();

    // Start render loop
    this.animate();

    // Setup UI
    this.setupUI();

    console.log('App initialization complete');
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

    // NavMesh Build button
    document.getElementById('btn-build')?.addEventListener('click', () => {
      this.buildNavMesh();
    });

    // Start/Stop/Reset buttons (placeholder for Phase 4)
    document.getElementById('btn-start')?.addEventListener('click', () => {
      this.startSimulation();
    });

    document.getElementById('btn-stop')?.addEventListener('click', () => {
      this.stopSimulation();
    });

    document.getElementById('btn-reset')?.addEventListener('click', () => {
      this.resetScene();
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

  private buildNavMesh(): void {
    if (!this.navMeshBuilder || !this.objectManager || !this.navMeshVisualizer) {
      console.error('NavMesh components not initialized');
      return;
    }

    const buildBtn = document.getElementById('btn-build');
    if (buildBtn) {
      buildBtn.textContent = 'Building...';
      buildBtn.setAttribute('disabled', 'true');
    }

    // Give UI time to update
    setTimeout(() => {
      const objects = this.objectManager!.getObjects();
      console.log(`Building NavMesh with ${objects.length} objects`);

      const success = this.navMeshBuilder!.build(this.groundSize, objects);

      if (success) {
        const navMesh = this.navMeshBuilder!.getNavMesh();
        if (navMesh) {
          this.navMeshVisualizer!.update(navMesh);
          console.log('NavMesh built and visualized');
        }
      } else {
        console.error('Failed to build NavMesh');
      }

      if (buildBtn) {
        buildBtn.textContent = 'Build NavMesh';
        buildBtn.removeAttribute('disabled');
      }
    }, 50);
  }

  private startSimulation(): void {
    console.log('Simulation started (Phase 4)');
    const startBtn = document.getElementById('btn-start');
    const stopBtn = document.getElementById('btn-stop');
    if (startBtn) startBtn.setAttribute('disabled', 'true');
    if (stopBtn) stopBtn.removeAttribute('disabled');
  }

  private stopSimulation(): void {
    console.log('Simulation stopped');
    const startBtn = document.getElementById('btn-start');
    const stopBtn = document.getElementById('btn-stop');
    if (startBtn) startBtn.removeAttribute('disabled');
    if (stopBtn) stopBtn.setAttribute('disabled', 'true');
  }

  private resetScene(): void {
    console.log('Scene reset');
    // Clear selection
    this.objectManager?.clearSelection();

    // Clear NavMesh visualization
    this.navMeshVisualizer?.clear();

    // Reset agent count
    const agentCount = document.getElementById('agent-count');
    if (agentCount) agentCount.textContent = '0';
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
    // Invalidate NavMesh when objects change
    this.navMeshVisualizer?.clear();
  }

  private onObjectDelete(id: string): void {
    console.log('Object deleted:', id);
    // Invalidate NavMesh when objects change
    this.navMeshVisualizer?.clear();
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
    this.navMeshVisualizer?.dispose();
    this.navMeshBuilder?.dispose();
    this.objectManager?.dispose();
    this.cameraController?.dispose();
    this.scene?.dispose();
  }
}

// Start the app
new App();
