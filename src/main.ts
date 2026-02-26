// EB Navigation Web - Main Entry Point

console.log('EB Navigation Web - Starting...');

// App initialization will be added here
class App {
  constructor() {
    console.log('App initialized');
    this.init();
  }

  private init(): void {
    // Placeholder - Three.js scene will be initialized here
    const viewport = document.getElementById('viewport');
    if (viewport) {
      viewport.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;">3D Viewport (Three.js will be initialized here)</div>';
    }

    // Update slider values display
    this.setupSliders();
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
}

// Start the app
new App();
