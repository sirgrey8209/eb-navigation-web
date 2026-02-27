export class Profiler {
  private fpsElement: HTMLElement | null;
  private frameTimeElement: HTMLElement | null;
  private agentCountElement: HTMLElement | null;

  private frameCount: number = 0;
  private lastTime: number = performance.now();
  private fps: number = 0;
  private frameTime: number = 0;

  constructor() {
    this.fpsElement = document.getElementById('fps');
    this.frameTimeElement = document.getElementById('frame-time');
    this.agentCountElement = document.getElementById('agent-count');
  }

  public beginFrame(): void {
    this.frameCount++;
  }

  public endFrame(): void {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;

    if (deltaTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameTime = Math.round(deltaTime / this.frameCount * 100) / 100;

      this.updateDisplay();

      this.frameCount = 0;
      this.lastTime = currentTime;
    }
  }

  public setAgentCount(count: number): void {
    if (this.agentCountElement) {
      this.agentCountElement.textContent = count.toString();
    }
  }

  private updateDisplay(): void {
    if (this.fpsElement) {
      this.fpsElement.textContent = this.fps.toString();

      // Color based on performance
      if (this.fps >= 55) {
        this.fpsElement.style.color = '#4ecca3'; // Green
      } else if (this.fps >= 30) {
        this.fpsElement.style.color = '#f9ed69'; // Yellow
      } else {
        this.fpsElement.style.color = '#f38181'; // Red
      }
    }

    if (this.frameTimeElement) {
      this.frameTimeElement.textContent = this.frameTime.toFixed(1);
    }
  }

  public getFPS(): number {
    return this.fps;
  }

  public getFrameTime(): number {
    return this.frameTime;
  }
}
