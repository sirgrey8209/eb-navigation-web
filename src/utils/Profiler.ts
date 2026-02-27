/**
 * Performance profiler with detailed timing breakdown
 * Tracks FPS, frame time, and individual system times (Crowd, Render)
 */
export interface ProfileTimings {
  crowd: number;
  render: number;
  total: number;
}

export class Profiler {
  private fpsElement: HTMLElement | null;
  private frameTimeElement: HTMLElement | null;
  private agentCountElement: HTMLElement | null;
  private crowdTimeElement: HTMLElement | null;
  private renderTimeElement: HTMLElement | null;

  private frameCount: number = 0;
  private lastTime: number = performance.now();
  private fps: number = 0;
  private frameTime: number = 0;

  // Per-frame timing
  private frameStartTime: number = 0;
  private crowdStartTime: number = 0;
  private renderStartTime: number = 0;

  // Accumulated timings for averaging
  private crowdTimeAccum: number = 0;
  private renderTimeAccum: number = 0;
  private totalTimeAccum: number = 0;

  // Current averaged timings
  private crowdTime: number = 0;
  private renderTime: number = 0;

  // History for sparkline/graph (last 60 frames)
  private fpsHistory: number[] = [];
  private readonly historySize: number = 60;

  constructor() {
    this.fpsElement = document.getElementById('fps');
    this.frameTimeElement = document.getElementById('frame-time');
    this.agentCountElement = document.getElementById('agent-count');
    this.crowdTimeElement = document.getElementById('crowd-time');
    this.renderTimeElement = document.getElementById('render-time');
  }

  /**
   * Call at the start of each frame
   */
  public beginFrame(): void {
    this.frameStartTime = performance.now();
    this.frameCount++;
  }

  /**
   * Call before crowd simulation update
   */
  public beginCrowd(): void {
    this.crowdStartTime = performance.now();
  }

  /**
   * Call after crowd simulation update
   */
  public endCrowd(): void {
    const elapsed = performance.now() - this.crowdStartTime;
    this.crowdTimeAccum += elapsed;
  }

  /**
   * Call before rendering
   */
  public beginRender(): void {
    this.renderStartTime = performance.now();
  }

  /**
   * Call after rendering
   */
  public endRender(): void {
    const elapsed = performance.now() - this.renderStartTime;
    this.renderTimeAccum += elapsed;
  }

  /**
   * Call at the end of each frame
   */
  public endFrame(): void {
    const currentTime = performance.now();
    const frameElapsed = currentTime - this.frameStartTime;
    this.totalTimeAccum += frameElapsed;

    const deltaTime = currentTime - this.lastTime;

    // Update every second
    if (deltaTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameTime = Math.round(deltaTime / this.frameCount * 100) / 100;

      // Calculate average timings
      this.crowdTime = this.crowdTimeAccum / this.frameCount;
      this.renderTime = this.renderTimeAccum / this.frameCount;

      // Update FPS history
      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > this.historySize) {
        this.fpsHistory.shift();
      }

      this.updateDisplay();

      // Reset accumulators
      this.frameCount = 0;
      this.crowdTimeAccum = 0;
      this.renderTimeAccum = 0;
      this.totalTimeAccum = 0;
      this.lastTime = currentTime;
    }
  }

  /**
   * Set agent count for display
   */
  public setAgentCount(count: number): void {
    if (this.agentCountElement) {
      this.agentCountElement.textContent = count.toString();
    }
  }

  /**
   * Update the performance display
   */
  private updateDisplay(): void {
    // FPS display with color coding
    if (this.fpsElement) {
      this.fpsElement.textContent = this.fps.toString();

      if (this.fps >= 55) {
        this.fpsElement.style.color = '#4ecca3'; // Green
      } else if (this.fps >= 30) {
        this.fpsElement.style.color = '#f9ed69'; // Yellow
      } else {
        this.fpsElement.style.color = '#f38181'; // Red
      }
    }

    // Frame time
    if (this.frameTimeElement) {
      this.frameTimeElement.textContent = this.frameTime.toFixed(1);
    }

    // Crowd time
    if (this.crowdTimeElement) {
      this.crowdTimeElement.textContent = this.crowdTime.toFixed(2);
      this.colorCodeTiming(this.crowdTimeElement, this.crowdTime, 5, 10);
    }

    // Render time
    if (this.renderTimeElement) {
      this.renderTimeElement.textContent = this.renderTime.toFixed(2);
      this.colorCodeTiming(this.renderTimeElement, this.renderTime, 8, 16);
    }
  }

  /**
   * Color code timing values based on thresholds
   */
  private colorCodeTiming(element: HTMLElement, value: number, warnThreshold: number, criticalThreshold: number): void {
    if (value < warnThreshold) {
      element.style.color = '#4ecca3'; // Green
    } else if (value < criticalThreshold) {
      element.style.color = '#f9ed69'; // Yellow
    } else {
      element.style.color = '#f38181'; // Red
    }
  }

  /**
   * Get current FPS
   */
  public getFPS(): number {
    return this.fps;
  }

  /**
   * Get current frame time in ms
   */
  public getFrameTime(): number {
    return this.frameTime;
  }

  /**
   * Get detailed timing breakdown
   */
  public getTimings(): ProfileTimings {
    return {
      crowd: this.crowdTime,
      render: this.renderTime,
      total: this.frameTime,
    };
  }

  /**
   * Get FPS history for graphing
   */
  public getFPSHistory(): number[] {
    return [...this.fpsHistory];
  }

  /**
   * Get performance summary string
   */
  public getSummary(): string {
    return `FPS: ${this.fps} | Frame: ${this.frameTime.toFixed(1)}ms | Crowd: ${this.crowdTime.toFixed(2)}ms | Render: ${this.renderTime.toFixed(2)}ms`;
  }
}
