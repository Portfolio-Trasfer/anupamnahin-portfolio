import * as THREE from 'three';
import gsap from 'gsap';
import { MediaPlane } from './MediaPlane';
import type { Project, PortfolioSettings } from '../data/projects';
import { lerp, clamp } from '../utils/math';

export interface SliderCallbacks {
  onIndexChange?: (index: number, project: Project) => void;
  onExpand?: (index: number, project: Project) => void;
  onCollapse?: () => void;
}

export class Slider {
  public group: THREE.Group;
  public planes: MediaPlane[] = [];
  public currentScroll = 0;
  public targetScroll = 0;
  public velocity = 0;
  public isExpanded = false;
  public isTransitioning = false;
  public activeIndex = 0;

  private currentProjects: Project[] = [];
  private sharedGeometry: THREE.PlaneGeometry;
  private stripWidth = 220;
  private stripHeight = 480;
  private gap = 48;
  private step = 268;
  private maxScroll = 0;

  public scrollEase = 0.075;
  public bendStrength = 1.8;
  public rgbShiftStrength = 0.0015;

  // Pointer tracking
  private isPointerDown = false;
  private pointerDownPos = { x: 0, y: 0 };
  private scrollOnPointerDown = 0;

  private callbacks: SliderCallbacks = {};

  // Bound event handlers for cleanup
  private handleWheelBound: (e: WheelEvent) => void;
  private handlePointerDownBound: (e: PointerEvent) => void;
  private handlePointerMoveBound: (e: PointerEvent) => void;
  private handlePointerUpBound: (e: PointerEvent) => void;
  private handleKeyDownBound: (e: KeyboardEvent) => void;

  constructor(
    initialProjects: Project[] = [],
    settings?: PortfolioSettings,
    callbacks: SliderCallbacks = {}
  ) {
    this.currentProjects = [...initialProjects];
    this.callbacks = callbacks;
    this.group = new THREE.Group();

    if (settings) {
      this.scrollEase = settings.scrollEase ?? 0.075;
      this.bendStrength = settings.bendStrength ?? 1.8;
      this.rgbShiftStrength = settings.rgbShiftStrength ?? 0.0015;
    }

    // Single shared geometry
    this.sharedGeometry = new THREE.PlaneGeometry(1, 1, 64, 64);

    this.handleWheelBound = this.handleWheel.bind(this);
    this.handlePointerDownBound = this.handlePointerDown.bind(this);
    this.handlePointerMoveBound = this.handlePointerMove.bind(this);
    this.handlePointerUpBound = this.handlePointerUp.bind(this);
    this.handleKeyDownBound = this.handleKeyDown.bind(this);

    this.initPlanes();
    this.initEvents();
  }

  public setCallbacks(callbacks: SliderCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private initPlanes(): void {
    this.currentProjects.forEach((project, index) => {
      const plane = new MediaPlane({
        project,
        index,
        geometry: this.sharedGeometry,
        bendStrength: this.bendStrength,
        rgbShiftStrength: this.rgbShiftStrength,
      });
      this.planes.push(plane);
      this.group.add(plane.mesh);
    });
  }

  public rebuild(projectsData: Project[], settingsData?: PortfolioSettings): void {
    if (this.isExpanded) {
      this.collapse();
    }

    if (settingsData) {
      this.updateShaderSettings(settingsData);
    }

    this.planes.forEach((plane) => {
      this.group.remove(plane.mesh);
      plane.destroy();
    });
    this.planes = [];

    this.currentProjects = [...projectsData];
    this.initPlanes();

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.onResize(vw, vh);

    if (this.activeIndex >= this.currentProjects.length) {
      this.activeIndex = Math.max(0, this.currentProjects.length - 1);
    }

    if (this.currentProjects.length > 0) {
      this.callbacks.onIndexChange?.(this.activeIndex, this.currentProjects[this.activeIndex]);
    }
  }

  public updateShaderSettings(settings: {
    bendStrength?: number;
    rgbShiftStrength?: number;
    scrollEase?: number;
  }): void {
    if (typeof settings.bendStrength === 'number') {
      this.bendStrength = settings.bendStrength;
      this.planes.forEach((plane) => plane.setBendStrength(this.bendStrength));
    }
    if (typeof settings.rgbShiftStrength === 'number') {
      this.rgbShiftStrength = settings.rgbShiftStrength;
      this.planes.forEach((plane) => plane.setRgbShiftStrength(this.rgbShiftStrength));
    }
    if (typeof settings.scrollEase === 'number') {
      this.scrollEase = settings.scrollEase;
    }
  }

  public onResize(viewportWidth: number, viewportHeight: number): void {
    this.stripWidth = Math.min(viewportWidth * 0.16, 220);
    this.stripHeight = Math.min(viewportHeight * 0.58, 480);
    this.gap = Math.min(viewportWidth * 0.035, 48);
    this.step = this.stripWidth + this.gap;
    this.maxScroll = Math.max(0, (this.currentProjects.length - 1) * this.step);

    this.planes.forEach((plane) => {
      plane.setPlaneSize(this.stripWidth, this.stripHeight);
      plane.setViewportSize(viewportWidth, viewportHeight);
    });

    if (!this.isExpanded) {
      this.targetScroll = clamp(this.targetScroll, 0, this.maxScroll);
    }
  }

  private initEvents(): void {
    window.addEventListener('wheel', this.handleWheelBound, { passive: false });
    window.addEventListener('pointerdown', this.handlePointerDownBound);
    window.addEventListener('pointermove', this.handlePointerMoveBound);
    window.addEventListener('pointerup', this.handlePointerUpBound);
    window.addEventListener('pointercancel', this.handlePointerUpBound);
    window.addEventListener('keydown', this.handleKeyDownBound);
  }

  private isInteractive(el: HTMLElement | null): boolean {
    if (!el) return false;
    return Boolean(el.closest('[data-ui-interactive="true"]'));
  }

  private handleWheel(event: WheelEvent): void {
    if (this.isExpanded || this.isTransitioning) return;
    event.preventDefault();

    const delta = event.deltaY + event.deltaX;
    this.targetScroll += delta * 0.85;
    this.targetScroll = clamp(this.targetScroll, 0, this.maxScroll);
  }

  private handlePointerDown(event: PointerEvent): void {
    if (this.isInteractive(event.target as HTMLElement)) {
      return;
    }

    this.isPointerDown = true;
    this.pointerDownPos = { x: event.clientX, y: event.clientY };
    this.scrollOnPointerDown = this.targetScroll;
  }

  private handlePointerMove(event: PointerEvent): void {
    // 1. Visual hover indicator: show pointer cursor when hovering a clickable strip
    if (!this.isExpanded) {
      const worldX = event.clientX - window.innerWidth * 0.5;
      const worldY = -(event.clientY - window.innerHeight * 0.5);
      const halfW = this.stripWidth * 0.5;
      const halfH = this.stripHeight * 0.5;

      let isOverStrip = false;
      for (let i = 0; i < this.planes.length; i++) {
        const planeX = i * this.step - this.currentScroll;
        if (Math.abs(worldX - planeX) <= halfW && Math.abs(worldY) <= halfH) {
          isOverStrip = true;
          break;
        }
      }
      document.body.style.cursor = isOverStrip ? 'pointer' : 'default';
    } else {
      document.body.style.cursor = 'default';
    }

    if (!this.isPointerDown || this.isTransitioning) return;

    const deltaX = event.clientX - this.pointerDownPos.x;

    if (!this.isExpanded) {
      this.targetScroll = this.scrollOnPointerDown - deltaX * 1.3;
      this.targetScroll = clamp(this.targetScroll, 0, this.maxScroll);
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;

    if (this.isInteractive(event.target as HTMLElement)) {
      return;
    }

    // Explicit 2D hit-testing: dist < 12 treats as click
    const dist = Math.hypot(
      event.clientX - this.pointerDownPos.x,
      event.clientY - this.pointerDownPos.y
    );

    if (dist < 12) {
      if (this.isExpanded) {
        // Clicking backdrop closes expanded view
        this.collapse();
        return;
      }

      const worldX = event.clientX - window.innerWidth * 0.5;
      const worldY = -(event.clientY - window.innerHeight * 0.5);
      const halfW = this.stripWidth * 0.5;
      const halfH = this.stripHeight * 0.5;

      for (let i = 0; i < this.planes.length; i++) {
        const planeX = i * this.step - this.currentScroll;
        if (Math.abs(worldX - planeX) <= halfW && Math.abs(worldY) <= halfH) {
          this.expandPlane(i);
          break;
        }
      }
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isExpanded) {
      this.collapse();
    }
  }

  public expandPlane(index: number): void {
    if (this.isExpanded || !this.currentProjects[index]) return;

    this.isTransitioning = true;
    this.isExpanded = true;
    this.activeIndex = index;

    // Safety unlock so transition flag never deadlocks
    gsap.delayedCall(0.6, () => {
      this.isTransitioning = false;
    });

    // Kill competing tweens
    gsap.killTweensOf(this);
    this.planes.forEach((plane) => {
      gsap.killTweensOf(plane.uniforms.uProgress);
      gsap.killTweensOf(plane.uniforms.uAdjacentOffset);
    });

    const targetPos = index * this.step;
    this.targetScroll = targetPos;
    this.currentScroll = targetPos;
    this.velocity = 0;
    this.planes.forEach((p) => p.setVelocity(0));

    gsap.to(this, {
      targetScroll: targetPos,
      currentScroll: targetPos,
      duration: 1.25,
      ease: 'expo.inOut',
    });

    this.planes.forEach((plane, i) => {
      if (i === index) {
        gsap.to(plane.uniforms.uProgress, {
          value: 1.0,
          duration: 1.25,
          ease: 'expo.inOut',
        });
        gsap.to(plane.uniforms.uAdjacentOffset, {
          value: 0.0,
          duration: 1.25,
          ease: 'expo.inOut',
        });
      } else {
        const offsetDirection = Math.sign(i - index);
        const targetOffset = offsetDirection * window.innerWidth * 0.85;

        gsap.to(plane.uniforms.uProgress, {
          value: 0.0,
          duration: 1.25,
          ease: 'expo.inOut',
        });
        gsap.to(plane.uniforms.uAdjacentOffset, {
          value: targetOffset,
          duration: 1.25,
          ease: 'expo.inOut',
        });
      }
    });

    this.callbacks.onExpand?.(index, this.currentProjects[index]);
  }

  // Alias expand to expandPlane for external callers
  public expand(index: number): void {
    this.expandPlane(index);
  }

  public collapse(): void {
    if (!this.isExpanded) return;

    this.isTransitioning = true;

    // Safety unlock so transition flag never deadlocks
    gsap.delayedCall(0.6, () => {
      this.isTransitioning = false;
      this.isExpanded = false;
    });

    // Kill competing tweens
    gsap.killTweensOf(this);
    this.planes.forEach((plane) => {
      gsap.killTweensOf(plane.uniforms.uProgress);
      gsap.killTweensOf(plane.uniforms.uAdjacentOffset);
    });

    const centerPos = this.activeIndex * this.step;
    this.targetScroll = centerPos;
    this.currentScroll = centerPos;
    this.velocity = 0;
    this.planes.forEach((p) => p.setVelocity(0));

    this.callbacks.onCollapse?.();

    this.planes.forEach((plane) => {
      gsap.to(plane.uniforms.uProgress, {
        value: 0.0,
        duration: 1.25,
        ease: 'expo.inOut',
        onComplete: () => {
          this.isExpanded = false;
          this.isTransitioning = false;
          this.velocity = 0;
        },
      });
      gsap.to(plane.uniforms.uAdjacentOffset, {
        value: 0.0,
        duration: 1.25,
        ease: 'expo.inOut',
      });
    });
  }

  public goToIndex(index: number): void {
    if (this.isExpanded) {
      this.collapse();
    }
    const clampedIndex = clamp(index, 0, this.currentProjects.length - 1);
    gsap.killTweensOf(this);
    gsap.to(this, {
      targetScroll: clampedIndex * this.step,
      duration: 1.1,
      ease: 'expo.out',
    });
  }

  public update(deltaTime: number): void {
    void deltaTime;

    if (this.isExpanded) {
      this.targetScroll = this.activeIndex * this.step;
      this.currentScroll = this.activeIndex * this.step;
      this.velocity = 0;
      this.planes.forEach((plane) => plane.setVelocity(0));
    } else {
      this.currentScroll = lerp(this.currentScroll, this.targetScroll, this.scrollEase);
      this.velocity = (this.targetScroll - this.currentScroll) * 0.05;
    }

    const viewportWidth = window.innerWidth;
    const prevActive = this.activeIndex;
    const computedActive = clamp(
      Math.round(this.currentScroll / this.step),
      0,
      Math.max(0, this.currentProjects.length - 1)
    );

    if (computedActive !== prevActive && !this.isExpanded) {
      this.activeIndex = computedActive;
      if (this.currentProjects[this.activeIndex]) {
        this.callbacks.onIndexChange?.(this.activeIndex, this.currentProjects[this.activeIndex]);
      }
    }

    this.planes.forEach((plane, i) => {
      const planeX = i * this.step - this.currentScroll;
      plane.setPlanePosition(planeX, 0);

      const parallax = clamp(planeX / (viewportWidth * 0.65), -0.22, 0.22);
      plane.setParallax(parallax);
      plane.setVelocity(this.isExpanded ? 0 : this.velocity);
      plane.update();
    });
  }

  public destroy(): void {
    window.removeEventListener('wheel', this.handleWheelBound);
    window.removeEventListener('pointerdown', this.handlePointerDownBound);
    window.removeEventListener('pointermove', this.handlePointerMoveBound);
    window.removeEventListener('pointerup', this.handlePointerUpBound);
    window.removeEventListener('pointercancel', this.handlePointerUpBound);
    window.removeEventListener('keydown', this.handleKeyDownBound);

    this.planes.forEach((plane) => plane.destroy());
    this.sharedGeometry.dispose();
    this.group.clear();
    document.body.style.cursor = 'default';
  }
}
