import gsap from 'gsap';
import SplitType from 'split-type';
import type { Project, PortfolioSettings } from '../data/projects';

export interface HudOptions {
  onCloseProject?: () => void;
  onOpenAdmin?: () => void;
}

export class Hud {
  private counterElement: HTMLElement | null;
  private activeTitleElement: HTMLElement | null;
  private activeClientElement: HTMLElement | null;
  private hudElement: HTMLElement | null;
  private brandNameElement: HTMLElement | null;
  private brandRoleElement: HTMLElement | null;
  private openAdminBtn: HTMLElement | null;

  // Expanded project DOM elements
  private overlayElement: HTMLElement | null;
  private expandedNumber: HTMLElement | null;
  private expandedRole: HTMLElement | null;
  private expandedTitle: HTMLElement | null;
  private expandedDescription: HTMLElement | null;
  private expandedClient: HTMLElement | null;
  private expandedYear: HTMLElement | null;
  private closeProjectBtn: HTMLElement | null;

  private titleSplit: SplitType | null = null;
  private descSplit: SplitType | null = null;

  private onCloseProject?: () => void;
  private onOpenAdmin?: () => void;

  constructor(options: HudOptions = {}) {
    this.onCloseProject = options.onCloseProject;
    this.onOpenAdmin = options.onOpenAdmin;

    this.counterElement = document.getElementById('project-counter');
    this.activeTitleElement = document.getElementById('active-title');
    this.activeClientElement = document.getElementById('active-client');
    this.hudElement = document.getElementById('hud');
    this.brandNameElement = document.getElementById('brand-name');
    this.brandRoleElement = document.getElementById('brand-role');
    this.openAdminBtn = document.getElementById('btn-open-admin');

    this.overlayElement = document.getElementById('project-overlay');
    this.expandedNumber = document.getElementById('expanded-number');
    this.expandedRole = document.getElementById('expanded-role');
    this.expandedTitle = document.getElementById('expanded-title');
    this.expandedDescription = document.getElementById('expanded-description');
    this.expandedClient = document.getElementById('expanded-client');
    this.expandedYear = document.getElementById('expanded-year');
    this.closeProjectBtn = document.getElementById('btn-close-project');

    this.initEvents();
  }

  private isolateInteractiveElement(el: HTMLElement | null): void {
    if (!el) return;
    const stopEvents = [
      'pointerdown',
      'pointerup',
      'mousedown',
      'mouseup',
      'click',
      'touchstart',
      'touchend',
    ];
    stopEvents.forEach((evt) => {
      el.addEventListener(evt, (e) => {
        e.stopPropagation();
      });
    });
  }

  private initEvents(): void {
    if (this.closeProjectBtn) {
      this.isolateInteractiveElement(this.closeProjectBtn);
      this.closeProjectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onCloseProject?.();
      });
    }

    if (this.openAdminBtn) {
      this.isolateInteractiveElement(this.openAdminBtn);
      this.openAdminBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onOpenAdmin?.();
      });
    }
  }

  public updateSettings(settings: PortfolioSettings): void {
    if (this.brandNameElement) {
      this.brandNameElement.textContent = settings.brandName;
    }
    if (this.brandRoleElement) {
      this.brandRoleElement.textContent = settings.brandRole;
    }
  }

  public setAdminVisible(visible: boolean): void {
    if (this.openAdminBtn) {
      if (visible) {
        this.openAdminBtn.classList.remove('hidden');
      } else {
        this.openAdminBtn.classList.add('hidden');
      }
    }
  }

  public updateActiveProject(project: Project, index: number, total: number): void {
    const currentStr = String(index + 1).padStart(2, '0');
    const totalStr = String(total).padStart(2, '0');

    if (this.counterElement) {
      this.counterElement.textContent = `${currentStr} — ${totalStr}`;
    }

    if (this.activeTitleElement && this.activeClientElement) {
      gsap.to([this.activeTitleElement, this.activeClientElement], {
        opacity: 0,
        y: -4,
        duration: 0.18,
        onComplete: () => {
          if (this.activeTitleElement) this.activeTitleElement.textContent = project.title;
          if (this.activeClientElement) this.activeClientElement.textContent = project.client;
          gsap.to([this.activeTitleElement, this.activeClientElement], {
            opacity: 1,
            y: 0,
            duration: 0.28,
          });
        },
      });
    }
  }

  public showExpandedProject(project: Project, index: number, total: number): void {
    if (!this.overlayElement) return;

    const currentStr = String(index + 1).padStart(2, '0');
    const totalStr = String(total).padStart(2, '0');

    if (this.expandedNumber) this.expandedNumber.textContent = `${currentStr} / ${totalStr}`;
    if (this.expandedRole) this.expandedRole.textContent = project.role;
    if (this.expandedTitle) this.expandedTitle.textContent = project.title;
    if (this.expandedDescription) this.expandedDescription.textContent = project.description;
    if (this.expandedClient) this.expandedClient.textContent = project.client;
    if (this.expandedYear) this.expandedYear.textContent = project.year;

    this.titleSplit?.revert();
    this.descSplit?.revert();

    if (this.hudElement) {
      gsap.to(this.hudElement, { opacity: 0, duration: 0.4 });
    }

    // Keep wrapper pointer-events: none so clicks pass through to window
    this.overlayElement.style.pointerEvents = 'none';

    gsap.killTweensOf(this.overlayElement);
    gsap.to(this.overlayElement, {
      opacity: 1,
      duration: 0.8,
      delay: 0.15,
      ease: 'power2.out',
      onComplete: () => {
        if (this.expandedTitle) {
          this.titleSplit = new SplitType(this.expandedTitle, { types: 'words,chars' });
          if (this.titleSplit.chars) {
            gsap.from(this.titleSplit.chars, {
              opacity: 0,
              y: 40,
              stagger: 0.02,
              duration: 0.8,
              ease: 'expo.out',
            });
          }
        }

        if (this.expandedDescription) {
          this.descSplit = new SplitType(this.expandedDescription, { types: 'lines' });
          if (this.descSplit.lines) {
            gsap.from(this.descSplit.lines, {
              opacity: 0,
              y: 20,
              stagger: 0.06,
              duration: 0.8,
              delay: 0.15,
              ease: 'expo.out',
            });
          }
        }
      },
    });
  }

  public hideExpandedProject(): void {
    if (!this.overlayElement) return;

    this.overlayElement.style.pointerEvents = 'none';

    gsap.killTweensOf(this.overlayElement);
    gsap.to(this.overlayElement, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => {
        this.titleSplit?.revert();
        this.descSplit?.revert();
      },
    });

    if (this.hudElement) {
      gsap.to(this.hudElement, {
        opacity: 1,
        duration: 0.5,
        delay: 0.2,
      });
    }
  }

  public destroy(): void {
    this.titleSplit?.revert();
    this.descSplit?.revert();
  }
}
