import * as THREE from 'three';
import vertexShader from '../shaders/slider.vert';
import fragmentShader from '../shaders/slider.frag';
import { createProceduralProjectTexture, type Project } from '../data/projects';

export interface MediaPlaneOptions {
  project: Project;
  index: number;
  geometry?: THREE.PlaneGeometry;
  bendStrength?: number;
  rgbShiftStrength?: number;
}

export interface SliderUniforms {
  uPlaneSize: { value: THREE.Vector2 };
  uPlanePosition: { value: THREE.Vector2 };
  uViewportSize: { value: THREE.Vector2 };
  uProgress: { value: number };
  uVelocity: { value: number };
  uAdjacentOffset: { value: number };
  uBendStrength: { value: number };
  uTexture: { value: THREE.Texture | null };
  uImageSize: { value: THREE.Vector2 };
  uParallax: { value: number };
  uOpacity: { value: number };
  uRgbShiftStrength: { value: number };
  [uniform: string]: THREE.IUniform;
}

const textureLoader = new THREE.TextureLoader();

export class MediaPlane {
  public mesh: THREE.Mesh;
  public material: THREE.ShaderMaterial;
  public geometry: THREE.PlaneGeometry;
  public uniforms: SliderUniforms;
  public project: Project;
  public index: number;

  private ownsGeometry: boolean;
  private proceduralFallbackTexture: THREE.CanvasTexture | null = null;
  private currentLoadedTexture: THREE.Texture | null = null;

  constructor(options: MediaPlaneOptions) {
    this.project = options.project;
    this.index = options.index;

    if (options.geometry) {
      this.geometry = options.geometry;
      this.ownsGeometry = false;
    } else {
      this.geometry = new THREE.PlaneGeometry(1, 1, 64, 64);
      this.ownsGeometry = true;
    }

    // Default to procedural texture immediately so strip is never blank
    this.proceduralFallbackTexture = createProceduralProjectTexture(this.project);

    this.uniforms = {
      uPlaneSize: { value: new THREE.Vector2(220, 480) },
      uPlanePosition: { value: new THREE.Vector2(0, 0) },
      uViewportSize: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uProgress: { value: 0.0 },
      uVelocity: { value: 0.0 },
      uAdjacentOffset: { value: 0.0 },
      uBendStrength: { value: options.bendStrength ?? 1.8 },
      uTexture: { value: this.proceduralFallbackTexture },
      uImageSize: { value: new THREE.Vector2(this.project.imageWidth || 1920, this.project.imageHeight || 1280) },
      uParallax: { value: 0.0 },
      uOpacity: { value: 1.0 },
      uRgbShiftStrength: { value: options.rgbShiftStrength ?? 0.0015 },
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;

    if (this.project.textureUrl) {
      this.loadTexture(this.project.textureUrl);
    }
  }

  public loadTexture(url: string, targetWidth?: number, targetHeight?: number): void {
    if (targetWidth && targetHeight) {
      this.uniforms.uImageSize.value.set(targetWidth, targetHeight);
    }

    textureLoader.load(
      url,
      (texture) => {
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;

        if (this.currentLoadedTexture && this.currentLoadedTexture !== this.proceduralFallbackTexture) {
          this.currentLoadedTexture.dispose();
        }

        this.currentLoadedTexture = texture;
        this.uniforms.uTexture.value = texture;

        const img = texture.image as HTMLImageElement;
        if (img && img.naturalWidth && img.naturalHeight) {
          this.uniforms.uImageSize.value.set(img.naturalWidth, img.naturalHeight);
        }
      },
      undefined,
      (err) => {
        console.warn(`Falling back to procedural texture for ${this.project.title}:`, err);
        if (this.proceduralFallbackTexture) {
          this.uniforms.uTexture.value = this.proceduralFallbackTexture;
        }
      }
    );
  }

  public updateProject(project: Project): void {
    const oldTextureUrl = this.project.textureUrl;
    this.project = project;

    if (project.textureUrl && project.textureUrl !== oldTextureUrl) {
      this.loadTexture(project.textureUrl, project.imageWidth, project.imageHeight);
    } else {
      // Re-generate procedural fallback if texture is blank
      if (!project.textureUrl) {
        if (this.proceduralFallbackTexture) {
          this.proceduralFallbackTexture.dispose();
        }
        this.proceduralFallbackTexture = createProceduralProjectTexture(this.project);
        this.uniforms.uTexture.value = this.proceduralFallbackTexture;
      }
    }
  }

  public setBendStrength(value: number): void {
    this.uniforms.uBendStrength.value = value;
  }

  public setRgbShiftStrength(value: number): void {
    this.uniforms.uRgbShiftStrength.value = value;
  }

  public setProgress(value: number): void {
    this.uniforms.uProgress.value = value;
  }

  public setVelocity(value: number): void {
    this.uniforms.uVelocity.value = value;
  }

  public setAdjacentOffset(value: number): void {
    this.uniforms.uAdjacentOffset.value = value;
  }

  public setParallax(value: number): void {
    this.uniforms.uParallax.value = value;
  }

  public setOpacity(value: number): void {
    this.uniforms.uOpacity.value = value;
  }

  public setPlanePosition(x: number, y: number): void {
    this.uniforms.uPlanePosition.value.set(x, y);
  }

  public setPlaneSize(width: number, height: number): void {
    this.uniforms.uPlaneSize.value.set(width, height);
  }

  public setViewportSize(width: number, height: number): void {
    this.uniforms.uViewportSize.value.set(width, height);
  }

  public update(): void {
    // Reserved for per-frame plane logic if needed
  }

  public destroy(): void {
    if (this.ownsGeometry) {
      this.geometry.dispose();
    }
    if (this.proceduralFallbackTexture) {
      this.proceduralFallbackTexture.dispose();
    }
    if (this.currentLoadedTexture) {
      this.currentLoadedTexture.dispose();
    }
    this.material.dispose();
  }
}
