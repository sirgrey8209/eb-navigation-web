/**
 * Virtual Joystick for mobile touch controls
 * Provides touch-based movement input for the player
 */

export interface JoystickInput {
  x: number;  // -1 to 1 (left to right)
  y: number;  // -1 to 1 (up to down)
  active: boolean;
}

export interface VirtualJoystickConfig {
  size: number;           // Base size in pixels
  innerSize: number;      // Inner stick size in pixels
  maxDistance: number;    // Max distance stick can move
  position: 'left' | 'right';
  opacity: number;
}

const DEFAULT_CONFIG: VirtualJoystickConfig = {
  size: 120,
  innerSize: 50,
  maxDistance: 40,
  position: 'left',
  opacity: 0.6,
};

export class VirtualJoystick {
  private container: HTMLElement;
  private base: HTMLElement;
  private stick: HTMLElement;
  private config: VirtualJoystickConfig;

  private active: boolean = false;
  private startX: number = 0;
  private startY: number = 0;
  private currentX: number = 0;
  private currentY: number = 0;
  private touchId: number | null = null;

  private input: JoystickInput = { x: 0, y: 0, active: false };
  private visible: boolean = false;

  constructor(container: HTMLElement, config: Partial<VirtualJoystickConfig> = {}) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.base = this.createBase();
    this.stick = this.createStick();
    this.base.appendChild(this.stick);
    this.container.appendChild(this.base);

    this.setupEventListeners();
    this.hide();

    // Check if mobile and show automatically
    if (this.isTouchDevice()) {
      this.show();
    }
  }

  private isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  private createBase(): HTMLElement {
    const base = document.createElement('div');
    base.id = 'virtual-joystick-base';
    base.style.cssText = `
      position: fixed;
      bottom: 100px;
      ${this.config.position}: 40px;
      width: ${this.config.size}px;
      height: ${this.config.size}px;
      background: rgba(255, 255, 255, ${this.config.opacity * 0.3});
      border: 2px solid rgba(255, 255, 255, ${this.config.opacity});
      border-radius: 50%;
      touch-action: none;
      user-select: none;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    return base;
  }

  private createStick(): HTMLElement {
    const stick = document.createElement('div');
    stick.id = 'virtual-joystick-stick';
    stick.style.cssText = `
      width: ${this.config.innerSize}px;
      height: ${this.config.innerSize}px;
      background: rgba(233, 69, 96, ${this.config.opacity});
      border-radius: 50%;
      position: absolute;
      transform: translate(0, 0);
      transition: background 0.1s;
    `;
    return stick;
  }

  private setupEventListeners(): void {
    // Touch events
    this.base.addEventListener('touchstart', this.onTouchStart, { passive: false });
    document.addEventListener('touchmove', this.onTouchMove, { passive: false });
    document.addEventListener('touchend', this.onTouchEnd);
    document.addEventListener('touchcancel', this.onTouchEnd);

    // Mouse events (for testing on desktop)
    this.base.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  private onTouchStart = (event: TouchEvent): void => {
    event.preventDefault();

    if (this.touchId !== null) return;

    const touch = event.changedTouches[0];
    this.touchId = touch.identifier;
    this.startDrag(touch.clientX, touch.clientY);
  };

  private onTouchMove = (event: TouchEvent): void => {
    if (this.touchId === null) return;

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (touch.identifier === this.touchId) {
        event.preventDefault();
        this.updateDrag(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  private onTouchEnd = (event: TouchEvent): void => {
    if (this.touchId === null) return;

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (touch.identifier === this.touchId) {
        this.endDrag();
        this.touchId = null;
        break;
      }
    }
  };

  private onMouseDown = (event: MouseEvent): void => {
    event.preventDefault();
    this.startDrag(event.clientX, event.clientY);
  };

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.active) return;
    this.updateDrag(event.clientX, event.clientY);
  };

  private onMouseUp = (): void => {
    if (!this.active) return;
    this.endDrag();
  };

  private startDrag(clientX: number, clientY: number): void {
    this.active = true;
    const rect = this.base.getBoundingClientRect();
    this.startX = rect.left + rect.width / 2;
    this.startY = rect.top + rect.height / 2;
    this.updateDrag(clientX, clientY);

    this.stick.style.background = `rgba(233, 69, 96, ${this.config.opacity + 0.2})`;
  }

  private updateDrag(clientX: number, clientY: number): void {
    const deltaX = clientX - this.startX;
    const deltaY = clientY - this.startY;

    // Calculate distance from center
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX);

    // Clamp to max distance
    const clampedDistance = Math.min(distance, this.config.maxDistance);

    // Calculate stick position
    this.currentX = Math.cos(angle) * clampedDistance;
    this.currentY = Math.sin(angle) * clampedDistance;

    // Update stick visual position
    this.stick.style.transform = `translate(${this.currentX}px, ${this.currentY}px)`;

    // Update input values (-1 to 1)
    this.input.x = this.currentX / this.config.maxDistance;
    this.input.y = this.currentY / this.config.maxDistance;
    this.input.active = true;
  }

  private endDrag(): void {
    this.active = false;
    this.currentX = 0;
    this.currentY = 0;

    // Reset stick position with animation
    this.stick.style.transform = 'translate(0, 0)';
    this.stick.style.background = `rgba(233, 69, 96, ${this.config.opacity})`;

    // Reset input
    this.input.x = 0;
    this.input.y = 0;
    this.input.active = false;
  }

  /**
   * Get current joystick input state
   */
  public getInput(): JoystickInput {
    return { ...this.input };
  }

  /**
   * Check if joystick is currently active
   */
  public isActive(): boolean {
    return this.active;
  }

  /**
   * Show the joystick
   */
  public show(): void {
    this.base.style.display = 'flex';
    this.visible = true;
  }

  /**
   * Hide the joystick
   */
  public hide(): void {
    this.base.style.display = 'none';
    this.visible = false;
    this.endDrag();
  }

  /**
   * Check if joystick is visible
   */
  public isVisible(): boolean {
    return this.visible;
  }

  /**
   * Toggle visibility
   */
  public toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Set joystick position
   */
  public setPosition(position: 'left' | 'right'): void {
    this.config.position = position;
    this.base.style.left = position === 'left' ? '40px' : 'auto';
    this.base.style.right = position === 'right' ? '40px' : 'auto';
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.base.removeEventListener('touchstart', this.onTouchStart);
    document.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
    document.removeEventListener('touchcancel', this.onTouchEnd);

    this.base.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);

    if (this.base.parentNode) {
      this.base.parentNode.removeChild(this.base);
    }
  }
}
