import gsap from 'gsap';
import type { Project, PortfolioSettings } from '../data/projects';

export interface NavigationOptions {
  onSelectProject?: (index: number) => void;
}

export class Navigation {
  private navIndexBtn: HTMLElement | null;
  private navAboutBtn: HTMLElement | null;

  private aboutOverlay: HTMLElement | null;
  private closeAboutBtn: HTMLElement | null;
  private aboutBrandName: HTMLElement | null;
  private aboutBio: HTMLElement | null;
  private aboutEmail: HTMLAnchorElement | null;
  private aboutSocials: HTMLElement | null;

  private indexOverlay: HTMLElement | null;
  private closeIndexBtn: HTMLElement | null;
  private indexList: HTMLElement | null;

  private isAboutOpen = false;
  private isIndexOpen = false;

  private currentProjects: Project[] = [];
  private onSelectProject?: (index: number) => void;

  private handleKeyDownBound: (e: KeyboardEvent) => void;

  constructor(
    initialProjects: Project[] = [],
    settings?: PortfolioSettings,
    options: NavigationOptions = {}
  ) {
    this.currentProjects = [...initialProjects];
    this.onSelectProject = options.onSelectProject;

    this.navIndexBtn = document.getElementById('nav-index');
    this.navAboutBtn = document.getElementById('nav-about');

    this.aboutOverlay = document.getElementById('about-overlay');
    this.closeAboutBtn = document.getElementById('btn-close-about');
    this.aboutBrandName = document.getElementById('about-brand-name');
    this.aboutBio = document.getElementById('about-bio');
    this.aboutEmail = document.getElementById('about-email') as HTMLAnchorElement | null;
    this.aboutSocials = document.getElementById('about-socials');

    this.indexOverlay = document.getElementById('index-overlay');
    this.closeIndexBtn = document.getElementById('btn-close-index');
    this.indexList = document.getElementById('index-list');

    this.handleKeyDownBound = this.handleKeyDown.bind(this);

    if (settings) {
      this.updateSettings(settings);
    }
    this.renderIndexList();
    this.initEvents();
  }

  public updateData(settings: PortfolioSettings, projectsData: Project[]): void {
    this.currentProjects = [...projectsData];
    this.updateSettings(settings);
    this.renderIndexList();
  }

  public updateSettings(settings: PortfolioSettings): void {
    if (this.aboutBrandName) {
      this.aboutBrandName.textContent = settings.brandName;
    }
    if (this.aboutBio) {
      this.aboutBio.textContent = settings.aboutBio;
    }
    if (this.aboutEmail) {
      this.aboutEmail.textContent = settings.contactEmail;
      this.aboutEmail.href = `mailto:${settings.contactEmail}`;
    }
    if (this.aboutSocials && Array.isArray(settings.socials)) {
      this.aboutSocials.innerHTML = '';
      settings.socials.forEach((item) => {
        const a = document.createElement('a');
        a.href = item.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'hover:text-white transition-colors underline underline-offset-4';
        a.textContent = item.name;
        this.aboutSocials?.appendChild(a);
      });
    }
  }

  private renderIndexList(): void {
    if (!this.indexList) return;
    this.indexList.innerHTML = '';

    this.currentProjects.forEach((proj, index) => {
      const li = document.createElement('li');
      li.setAttribute('data-ui-interactive', 'true');
      li.className = 'py-4 group cursor-pointer flex justify-between items-center transition-colors pointer-events-auto';
      li.innerHTML = `
        <div class="flex items-center gap-6">
          <span class="font-mono text-xs text-white/40 group-hover:text-indigo-400 transition-colors">${proj.id}</span>
          <span class="text-lg sm:text-xl font-semibold uppercase text-white/80 group-hover:text-white group-hover:translate-x-2 transition-all duration-300">${proj.title}</span>
        </div>
        <div class="text-xs uppercase tracking-widest text-white/40 group-hover:text-white/80 transition-colors hidden sm:block">
          ${proj.client} • ${proj.year}
        </div>
      `;

      li.addEventListener('click', () => {
        this.closeIndex();
        this.onSelectProject?.(index);
      });

      this.indexList?.appendChild(li);
    });
  }

  private initEvents(): void {
    this.navAboutBtn?.addEventListener('click', () => this.toggleAbout());
    this.closeAboutBtn?.addEventListener('click', () => this.closeAbout());

    this.navIndexBtn?.addEventListener('click', () => this.toggleIndex());
    this.closeIndexBtn?.addEventListener('click', () => this.closeIndex());

    this.aboutOverlay?.addEventListener('click', (e) => {
      if (e.target === this.aboutOverlay) this.closeAbout();
    });
    this.indexOverlay?.addEventListener('click', (e) => {
      if (e.target === this.indexOverlay) this.closeIndex();
    });

    window.addEventListener('keydown', this.handleKeyDownBound);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.isAboutOpen) this.closeAbout();
      if (this.isIndexOpen) this.closeIndex();
    }
  }

  public toggleAbout(): void {
    if (this.isAboutOpen) {
      this.closeAbout();
    } else {
      this.openAbout();
    }
  }

  public openAbout(): void {
    if (this.isIndexOpen) this.closeIndex();
    this.isAboutOpen = true;
    if (this.aboutOverlay) {
      this.aboutOverlay.style.pointerEvents = 'auto';
      gsap.to(this.aboutOverlay, { opacity: 1, duration: 0.4, ease: 'power2.out' });
    }
  }

  public closeAbout(): void {
    this.isAboutOpen = false;
    if (this.aboutOverlay) {
      this.aboutOverlay.style.pointerEvents = 'none';
      gsap.to(this.aboutOverlay, { opacity: 0, duration: 0.3, ease: 'power2.in' });
    }
  }

  public toggleIndex(): void {
    if (this.isIndexOpen) {
      this.closeIndex();
    } else {
      this.openIndex();
    }
  }

  public openIndex(): void {
    if (this.isAboutOpen) this.closeAbout();
    this.isIndexOpen = true;
    if (this.indexOverlay) {
      this.indexOverlay.style.pointerEvents = 'auto';
      gsap.to(this.indexOverlay, { opacity: 1, duration: 0.4, ease: 'power2.out' });
    }
  }

  public closeIndex(): void {
    this.isIndexOpen = false;
    if (this.indexOverlay) {
      this.indexOverlay.style.pointerEvents = 'none';
      gsap.to(this.indexOverlay, { opacity: 0, duration: 0.3, ease: 'power2.in' });
    }
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDownBound);
  }
}
