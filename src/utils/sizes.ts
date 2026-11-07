export interface ViewportSizes {
  width: number;
  height: number;
  aspectRatio: number;
  dpr: number;
}

export type ResizeCallback = (sizes: ViewportSizes) => void;

export class Sizes {
  public width = 0;
  public height = 0;
  public aspectRatio = 0;
  public dpr = 1;

  private callbacks: Set<ResizeCallback> = new Set();
  private resizeHandler: () => void;

  constructor() {
    this.resizeHandler = this.onResize.bind(this);
    this.update();
    window.addEventListener('resize', this.resizeHandler);
  }

  public on(callback: ResizeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private update(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.aspectRatio = this.width / Math.max(1, this.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
  }

  private onResize(): void {
    this.update();
    const sizes: ViewportSizes = {
      width: this.width,
      height: this.height,
      aspectRatio: this.aspectRatio,
      dpr: this.dpr,
    };
    this.callbacks.forEach((cb) => cb(sizes));
  }

  /**
   * Calculates perspective camera FOV so that 1 unit in Three.js = 1 CSS pixel at z = 0
   */
  public static calculateFov(viewportHeight: number, cameraZ: number): number {
    return 2 * Math.atan(viewportHeight / 2 / cameraZ) * (180 / Math.PI);
  }

  public destroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.callbacks.clear();
  }
}

