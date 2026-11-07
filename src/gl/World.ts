import * as THREE from 'three';
import { Slider } from './Slider';
import { Sizes, type ViewportSizes } from '../utils/sizes';
import type { Project, PortfolioSettings } from '../data/projects';

export class World {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public slider: Slider;

  private canvas: HTMLCanvasElement;
  private sizes: Sizes;
  public readonly cameraZ = 600;

  constructor(
    canvas: HTMLCanvasElement,
    sizes: Sizes,
    initialProjects: Project[] = [],
    settings?: PortfolioSettings
  ) {
    this.canvas = canvas;
    this.sizes = sizes;

    this.scene = new THREE.Scene();

    // Perspective camera with exact FOV sync at z = 600
    const fov = 2 * Math.atan((this.sizes.height / 2) / this.cameraZ) * (180 / Math.PI);
    this.camera = new THREE.PerspectiveCamera(
      fov,
      this.sizes.aspectRatio,
      0.1,
      2000
    );
    this.camera.position.z = this.cameraZ;

    // WebGLRenderer with alpha: false, antialias: true, pixelRatio capped at 2
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x0e0e0e, 1.0);
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.slider = new Slider(initialProjects, settings);
    this.scene.add(this.slider.group);

    // Initial resize sync for slider
    this.slider.onResize(this.sizes.width, this.sizes.height);

    // Bind resize event
    this.sizes.on(this.onResize.bind(this));
  }

  private onResize(sizes: ViewportSizes): void {
    const fov = 2 * Math.atan((sizes.height / 2) / this.cameraZ) * (180 / Math.PI);
    this.camera.fov = fov;
    this.camera.aspect = sizes.aspectRatio;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(sizes.width, sizes.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.slider.onResize(sizes.width, sizes.height);
  }

  public render(deltaTime: number): void {
    this.slider.update(deltaTime);
    this.renderer.render(this.scene, this.camera);
  }

  public destroy(): void {
    this.slider.destroy();
    this.renderer.dispose();
  }
}
