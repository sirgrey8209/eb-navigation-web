// EB Navigation Web - Main Entry Point
import * as THREE from 'three';
import { Scene } from './core/Scene';
import { CameraController } from './core/CameraController';
import { Ground } from './objects/Ground';
import { ObjectManager } from './objects/ObjectManager';
import { NavMeshBuilder } from './navigation/NavMeshBuilder';
import { NavMeshVisualizer } from './navigation/NavMeshVisualizer';
import { CrowdManager } from './navigation/CrowdManager';
import { Player } from './entities/Player';
import { AgentRenderer } from './entities/AgentRenderer';
import { VirtualJoystick } from './ui/VirtualJoystick';
import { Profiler } from './utils/Profiler';
import { PlacedObject } from './types';
import { FlowFieldAgentSystem } from './entities/FlowFieldAgentSystem';
import { NavMeshExtractor } from './navigation/NavMeshExtractor';
import { FlowFieldVisualizer } from './navigation/FlowFieldVisualizer';
import { Target } from './types/flowfield';

console.log('EB Navigation Web - Starting...');

class App {
  private scene: Scene | null = null;
  private cameraController: CameraController | null = null;
  private ground: Ground | null = null;
  private objectManager: ObjectManager | null = null;
  private navMeshBuilder: NavMeshBuilder | null = null;
  private navMeshVisualizer: NavMeshVisualizer | null = null;
  private crowdManager: CrowdManager | null = null;
  private player: Player | null = null;
  private agentRenderer: AgentRenderer | null = null;
  private virtualJoystick: VirtualJoystick | null = null;
  private profiler: Profiler | null = null;
  private flowFieldAgentSystem: FlowFieldAgentSystem | null = null;
  private flowFieldVisualizer: FlowFieldVisualizer | null = null;
  private useFlowField: boolean = true; // Flow Field 사용 여부
  private _animationId: number = 0;

  private groundSize: number = 100;
  private isSimulationRunning: boolean = false;
  private lastTime: number = 0;
  private spawnTimer: number = 0;
  private spawnRate: number = 10; // agents per second
  private spawnDistance: number = 30;

  // Cached target object to avoid per-frame allocation
  private readonly cachedTarget: Target = {
    id: 0,
    position: new THREE.Vector3(),
    radius: 0.5,
    color: 0x00aaff,
  };

  // Scratch vector for spawn position to avoid per-spawn allocation
  private readonly scratchSpawnPos: THREE.Vector3 = new THREE.Vector3();

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

    // Initialize Crowd Manager
    this.crowdManager = new CrowdManager({
      maxAgents: 500,
      agentRadius: 0.5,
      agentHeight: 2.0,
      maxAgentSpeed: 5.0,
    });

    // Initialize Player
    this.player = new Player({
      moveSpeed: 10,
      radius: 0.5,
      height: 2,
      color: 0x00aaff,
    });
    this.player.setGroundBounds(this.groundSize);
    this.player.addToScene(this.scene.scene);

    // Initialize Agent Renderer
    this.agentRenderer = new AgentRenderer({
      maxAgents: 1000,
      agentRadius: 0.5,
      agentHeight: 2.0,
      agentColor: 0xff4444,
    });
    this.agentRenderer.initialize(this.scene.scene);

    // Initialize Flow Field Agent System
    this.flowFieldAgentSystem = new FlowFieldAgentSystem({
      maxAgents: 1000,
      maxSpeed: 5.0,
      radius: 0.5,
      separationWeight: 2.0,
    });

    // Initialize Flow Field Visualizer
    this.flowFieldVisualizer = new FlowFieldVisualizer(this.scene.scene);

    // Initialize Virtual Joystick for mobile
    this.virtualJoystick = new VirtualJoystick(document.body, {
      size: 120,
      innerSize: 50,
      maxDistance: 40,
      position: 'left',
      opacity: 0.6,
    });

    // Initialize Profiler
    this.profiler = new Profiler();

    // Setup UI
    this.setupUI();

    // Start render loop
    this.lastTime = performance.now();
    this.animate();

    console.log('App initialization complete');
  }

  private animate = (): void => {
    this._animationId = requestAnimationFrame(this.animate);

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = currentTime;

    if (this.profiler) {
      this.profiler.beginFrame();
    }

    // Update camera
    if (this.cameraController) {
      this.cameraController.update();
    }

    // Update player with joystick input
    if (this.player) {
      if (this.virtualJoystick) {
        this.player.setJoystickInput(this.virtualJoystick.getInput());
      }
      this.player.update(deltaTime);
    }

    // Update simulation with profiling
    if (this.isSimulationRunning) {
      if (this.profiler) this.profiler.beginCrowd();
      this.updateSimulation(deltaTime);
      if (this.profiler) this.profiler.endCrowd();
    }

    // Render with profiling
    if (this.profiler) this.profiler.beginRender();
    if (this.scene) {
      this.scene.render();
    }
    if (this.profiler) this.profiler.endRender();

    if (this.profiler) {
      this.profiler.endFrame();
    }

    // Update agent count display
    this.updateAgentCountDisplay();
  };

  private updateSimulation(deltaTime: number): void {
    if (!this.player || !this.agentRenderer) return;

    const playerPos = this.player.getGroundPosition();

    if (this.useFlowField && this.flowFieldAgentSystem) {
      // Flow Field 기반 시뮬레이션 (cachedTarget 사용하여 할당 방지)
      this.cachedTarget.position.copy(playerPos);
      this.cachedTarget.radius = this.player.getRadius();
      this.flowFieldAgentSystem.setTarget(this.cachedTarget);

      // 스폰
      this.spawnTimer += deltaTime;
      const spawnInterval = 1 / this.spawnRate;
      while (this.spawnTimer >= spawnInterval) {
        this.spawnTimer -= spawnInterval;
        this.spawnAgentFlowField();
      }

      // 업데이트
      this.flowFieldAgentSystem.update(deltaTime);

      // 플레이어 근처 에이전트 제거
      const catchRadius = this.player.getRadius() + 1.0;
      this.flowFieldAgentSystem.removeAgentsNearTarget(0, catchRadius);

      // 렌더링
      const agentData = this.flowFieldAgentSystem.getAgentData();
      this.agentRenderer.updateFromTypedArrays(
        agentData.positions,
        agentData.velocities,
        agentData.count
      );
    } else {
      // 기존 Detour Crowd 시뮬레이션
      if (!this.crowdManager) return;

      // Spawn new agents based on spawn rate
      this.spawnTimer += deltaTime;
      const spawnInterval = 1 / this.spawnRate;

      while (this.spawnTimer >= spawnInterval) {
        this.spawnTimer -= spawnInterval;
        this.spawnAgent();
      }

      // Update agent targets to follow player
      this.crowdManager.setAllAgentsTarget(playerPos);

      // Update crowd simulation
      this.crowdManager.update(deltaTime);

      // Remove agents that reached the player
      const catchRadius = this.player.getRadius() + 1.0;
      this.crowdManager.removeAgentsNearTarget(playerPos, catchRadius);

      // Update agent rendering
      const agents = this.crowdManager.getAgents();
      this.agentRenderer.update(agents);
    }
  }

  private spawnAgent(): void {
    if (!this.crowdManager || !this.player || !this.navMeshBuilder) return;

    const navMesh = this.navMeshBuilder.getNavMesh();
    if (!navMesh) return;

    // Initialize crowd if not already done
    if (this.crowdManager.getAgentCount() === 0) {
      // First agent - initialize crowd with NavMesh
      const initialized = this.crowdManager.initialize(navMesh);
      if (!initialized) {
        console.error('Failed to initialize CrowdManager');
        return;
      }
    }

    const playerPos = this.player.getGroundPosition();

    // Spawn at random position around player at spawn distance (using scratch vector)
    const angle = Math.random() * Math.PI * 2;
    const x = playerPos.x + Math.cos(angle) * this.spawnDistance;
    const z = playerPos.z + Math.sin(angle) * this.spawnDistance;

    // Clamp to ground bounds
    const halfGround = this.groundSize / 2 - 1;
    this.scratchSpawnPos.set(
      Math.max(-halfGround, Math.min(halfGround, x)),
      0,
      Math.max(-halfGround, Math.min(halfGround, z))
    );

    this.crowdManager.addAgent(this.scratchSpawnPos, playerPos);
  }

  private spawnAgentFlowField(): void {
    if (!this.flowFieldAgentSystem || !this.player) return;

    const playerPos = this.player.getGroundPosition();
    const angle = Math.random() * Math.PI * 2;
    const x = playerPos.x + Math.cos(angle) * this.spawnDistance;
    const z = playerPos.z + Math.sin(angle) * this.spawnDistance;

    // 경계 제한
    const halfGround = this.groundSize / 2 - 1;
    const clampedX = Math.max(-halfGround, Math.min(halfGround, x));
    const clampedZ = Math.max(-halfGround, Math.min(halfGround, z));

    this.flowFieldAgentSystem.addAgent(clampedX, 0, clampedZ);
  }

  private updateAgentCountDisplay(): void {
    const agentCountEl = document.getElementById('agent-count');
    if (agentCountEl) {
      if (this.useFlowField && this.flowFieldAgentSystem) {
        agentCountEl.textContent = this.flowFieldAgentSystem.getAgentCount().toString();
      } else if (this.crowdManager) {
        agentCountEl.textContent = this.crowdManager.getAgentCount().toString();
      }
    }
  }

  private clearObjectButtons(): void {
    ['btn-cube', 'btn-ramp', 'btn-cylinder'].forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });
  }

  private setupUI(): void {
    // Object buttons with cancel callback
    document.getElementById('btn-cube')?.addEventListener('click', () => {
      this.objectManager?.startPlacement('cube', () => this.clearObjectButtons());
      this.setActiveButton('btn-cube');
    });

    document.getElementById('btn-ramp')?.addEventListener('click', () => {
      this.objectManager?.startPlacement('ramp', () => this.clearObjectButtons());
      this.setActiveButton('btn-ramp');
    });

    document.getElementById('btn-cylinder')?.addEventListener('click', () => {
      this.objectManager?.startPlacement('cylinder', () => this.clearObjectButtons());
      this.setActiveButton('btn-cylinder');
    });

    // NavMesh Build button
    document.getElementById('btn-build')?.addEventListener('click', () => {
      this.buildNavMesh();
    });

    // Start/Stop/Reset buttons
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

    // Quality buttons
    this.setupQualityButtons();
  }

  private setupQualityButtons(): void {
    const qualityButtons = ['quality-low', 'quality-medium', 'quality-high'];
    const qualityLevels = ['low', 'medium', 'high'] as const;

    qualityButtons.forEach((btnId, index) => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        // Update button states
        qualityButtons.forEach(id => {
          document.getElementById(id)?.classList.remove('active');
        });
        document.getElementById(btnId)?.classList.add('active');

        // Apply quality setting
        this.scene?.setQuality(qualityLevels[index]);
      });
    });

    // Set initial active state based on detected quality
    if (this.scene) {
      const currentQuality = this.scene.getQuality();
      qualityButtons.forEach(id => {
        document.getElementById(id)?.classList.remove('active');
      });
      const index = qualityLevels.indexOf(currentQuality);
      if (index >= 0) {
        document.getElementById(qualityButtons[index])?.classList.add('active');
      }
    }
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

    // Stop simulation if running
    if (this.isSimulationRunning) {
      this.stopSimulation();
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

          // Flow Field 시스템에 NavMesh 데이터 전달
          if (this.flowFieldAgentSystem) {
            const navMeshData = NavMeshExtractor.extract(navMesh);
            this.flowFieldAgentSystem.setNavMeshData(navMeshData);
            console.log(`NavMesh extracted: ${navMeshData.polyCount} polygons`);
          }

          // Re-initialize crowd manager with new NavMesh
          if (this.crowdManager) {
            this.crowdManager.dispose();
            this.crowdManager = new CrowdManager({
              maxAgents: 500,
              agentRadius: 0.5,
              agentHeight: 2.0,
              maxAgentSpeed: 5.0,
            });
          }
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
    if (!this.navMeshBuilder?.getNavMesh()) {
      console.warn('Please build NavMesh first');
      alert('Please build NavMesh first before starting simulation');
      return;
    }

    this.isSimulationRunning = true;
    this.spawnTimer = 0;

    console.log('Simulation started');
    const startBtn = document.getElementById('btn-start');
    const stopBtn = document.getElementById('btn-stop');
    if (startBtn) startBtn.setAttribute('disabled', 'true');
    if (stopBtn) stopBtn.removeAttribute('disabled');
  }

  private stopSimulation(): void {
    this.isSimulationRunning = false;

    console.log('Simulation stopped');
    const startBtn = document.getElementById('btn-start');
    const stopBtn = document.getElementById('btn-stop');
    if (startBtn) startBtn.removeAttribute('disabled');
    if (stopBtn) stopBtn.setAttribute('disabled', 'true');
  }

  private resetScene(): void {
    console.log('Scene reset');

    // Stop simulation
    this.stopSimulation();

    // Clear agents
    this.crowdManager?.clearAllAgents();
    this.flowFieldAgentSystem?.clearAgents();

    // Clear agent renderer
    if (this.agentRenderer) {
      this.agentRenderer.update([]);
    }

    // Reset player position
    this.player?.setPosition(0, 0);

    // Clear selection
    this.objectManager?.clearSelection();

    // Clear NavMesh visualization
    this.navMeshVisualizer?.clear();
    this.flowFieldVisualizer?.clear();

    // Reset agent count display
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
    const spawnRateSlider = document.getElementById('spawn-rate') as HTMLInputElement;
    const spawnRateValue = document.getElementById('spawn-rate-value');
    const spawnDistSlider = document.getElementById('spawn-dist') as HTMLInputElement;
    const spawnDistValue = document.getElementById('spawn-dist-value');

    if (spawnRateSlider && spawnRateValue) {
      spawnRateSlider.addEventListener('input', () => {
        this.spawnRate = parseInt(spawnRateSlider.value, 10);
        spawnRateValue.textContent = spawnRateSlider.value;
      });
    }

    if (spawnDistSlider && spawnDistValue) {
      spawnDistSlider.addEventListener('input', () => {
        this.spawnDistance = parseInt(spawnDistSlider.value, 10);
        spawnDistValue.textContent = spawnDistSlider.value;
      });
    }
  }

  public dispose(): void {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
    }
    this.virtualJoystick?.dispose();
    this.agentRenderer?.dispose();
    this.flowFieldVisualizer?.dispose();
    this.flowFieldAgentSystem?.dispose();
    this.crowdManager?.dispose();
    this.player?.dispose();
    this.navMeshVisualizer?.dispose();
    this.navMeshBuilder?.dispose();
    this.objectManager?.dispose();
    this.cameraController?.dispose();
    this.scene?.dispose();
  }
}

// Start the app
new App();
