import {
  type PortfolioData,
  type PortfolioSettings,
  type Project,
  savePortfolioData,
  defaultSettings,
  defaultProjects,
  getGitHubConfig,
  saveGitHubConfig,
} from '../data/projects';
import { resetServerDeviceLock } from '../utils/deviceLock';

export interface AdminPanelCallbacks {
  onProjectsUpdated: (projects: Project[]) => void;
  onSettingsUpdated: (settings: PortfolioSettings) => void;
  onShaderSettingsChanged: (settings: {
    bendStrength?: number;
    rgbShiftStrength?: number;
    scrollEase?: number;
  }) => void;
  onResetDeviceLock?: () => void;
}

export class AdminPanel {
  private container: HTMLElement;
  private isOpen = false;
  private currentTab: 'projects' | 'site' | 'shaders' = 'projects';

  private data: PortfolioData;
  private callbacks: AdminPanelCallbacks;
  private toastTimeout: number | null = null;
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleHashChangeBound: () => void;

  constructor(initialData: PortfolioData, callbacks: AdminPanelCallbacks) {
    this.data = JSON.parse(JSON.stringify(initialData));
    this.callbacks = callbacks;

    this.container = document.createElement('div');
    this.container.id = 'admin-panel';
    this.container.setAttribute('data-ui-interactive', 'true');
    this.container.className =
      'fixed top-0 right-0 bottom-0 w-full max-w-[480px] z-50 transform translate-x-full transition-transform duration-500 ease-out flex flex-col text-white font-sans border-l border-white/10 shadow-2xl';
    this.container.style.background = 'rgba(14, 14, 14, 0.94)';
    this.container.style.backdropFilter = 'blur(20px)';

    // Prevent background canvas scroll / drag
    this.isolateEvents(this.container);

    document.body.appendChild(this.container);

    this.handleKeyDownBound = this.handleKeyDown.bind(this);
    this.handleHashChangeBound = this.handleHashChange.bind(this);

    this.render();
    this.initGlobalTriggers();
  }

  private isolateEvents(element: HTMLElement): void {
    const stopEvents = [
      'wheel',
      'pointerdown',
      'pointermove',
      'pointerup',
      'touchstart',
      'touchmove',
      'touchend',
      'mousedown',
      'mousemove',
      'mouseup',
      'click',
    ];
    stopEvents.forEach((evt) => {
      element.addEventListener(evt, (e) => {
        e.stopPropagation();
      });
    });
  }

  private initGlobalTriggers(): void {
    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('hashchange', this.handleHashChangeBound);

    // Check URL hash #admin
    if (window.location.hash === '#admin') {
      this.open();
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Shift + A toggles Admin Panel exclusively on authorized device
    if (e.shiftKey && (e.key === 'A' || e.key === 'a') && !e.altKey) {
      const target = e.target as HTMLElement;
      if (target && target.tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }
      e.preventDefault();
      this.toggle();
    } else if (e.key === 'Escape' && this.isOpen) {
      this.close();
    }
  }

  private handleHashChange(): void {
    if (window.location.hash === '#admin') {
      this.open();
    }
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public open(): void {
    this.isOpen = true;
    this.container.classList.remove('translate-x-full');
    this.container.classList.add('translate-x-0');
    window.location.hash = 'admin';
  }

  public close(): void {
    this.isOpen = false;
    this.container.classList.remove('translate-x-0');
    this.container.classList.add('translate-x-full');
    if (window.location.hash === '#admin') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  private showToast(message: string, isError = false): void {
    const toast = this.container.querySelector('#admin-toast') as HTMLElement | null;
    if (!toast) return;

    if (this.toastTimeout) window.clearTimeout(this.toastTimeout);
    toast.textContent = message;
    toast.className = `absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-mono tracking-wider transition-all duration-300 z-50 flex items-center gap-2 ${
      isError
        ? 'bg-rose-500/90 text-white shadow-lg shadow-rose-950/50'
        : 'bg-emerald-500/90 text-white shadow-lg shadow-emerald-950/50'
    }`;
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';

    this.toastTimeout = window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, -10px)';
    }, 2800);
  }

  private render(): void {
    this.container.innerHTML = `
      <div id="admin-toast" class="opacity-0 pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-mono tracking-wider transition-all duration-300 z-50"></div>

      <!-- Drawer Header -->
      <div class="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
        <div class="flex items-center gap-3">
          <div class="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
          <div>
            <h2 class="text-sm font-bold tracking-[0.2em] uppercase">Portfolio CMS</h2>
            <p class="text-[10px] text-white/40 tracking-wider font-mono">Visual Admin & Shader Studio</p>
          </div>
        </div>
        <button id="btn-admin-close" data-ui-interactive="true" class="text-white/40 hover:text-white p-2 text-base transition-colors hover:bg-white/5 rounded-full cursor-pointer">
          ✕
        </button>
      </div>

      <!-- Tab Navigation -->
      <div class="flex border-b border-white/10 text-xs font-mono tracking-wider uppercase bg-white/[0.01]">
        <button id="tab-btn-projects" data-ui-interactive="true" class="flex-1 py-3 text-center border-b-2 cursor-pointer ${
          this.currentTab === 'projects'
            ? 'border-indigo-500 text-white font-semibold'
            : 'border-transparent text-white/40 hover:text-white/80'
        } transition-colors">
          Projects (${this.data.projects.length})
        </button>
        <button id="tab-btn-site" data-ui-interactive="true" class="flex-1 py-3 text-center border-b-2 cursor-pointer ${
          this.currentTab === 'site'
            ? 'border-indigo-500 text-white font-semibold'
            : 'border-transparent text-white/40 hover:text-white/80'
        } transition-colors">
          Site & Bio
        </button>
        <button id="tab-btn-shaders" data-ui-interactive="true" class="flex-1 py-3 text-center border-b-2 cursor-pointer ${
          this.currentTab === 'shaders'
            ? 'border-indigo-500 text-white font-semibold'
            : 'border-transparent text-white/40 hover:text-white/80'
        } transition-colors">
          Shaders & Physics
        </button>
      </div>

      <!-- Tab Body (Scrollable) -->
      <div id="admin-tab-content" class="flex-1 overflow-y-auto p-6 space-y-6">
        <!-- Injected via renderCurrentTab -->
      </div>

      <!-- Drawer Footer Action Bar -->
      <div class="p-6 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <button id="btn-export-json" data-ui-interactive="true" class="text-[11px] font-mono tracking-wider uppercase text-white/60 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded border border-white/10 transition-colors cursor-pointer" title="Export portfolio.json">
            Export JSON
          </button>
          <button id="btn-reset-defaults" data-ui-interactive="true" class="text-[11px] font-mono tracking-wider uppercase text-white/40 hover:text-rose-400 bg-white/5 hover:bg-white/10 px-3 py-2 rounded border border-white/10 transition-colors cursor-pointer" title="Reset to defaults">
            Reset
          </button>
        </div>
        <button id="btn-save-cms" data-ui-interactive="true" class="flex-1 max-w-[180px] py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-[0.15em] uppercase rounded-md shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all flex items-center justify-center gap-2 cursor-pointer">
          <span>Save Changes</span>
        </button>
      </div>
    `;

    this.bindHeaderFooterEvents();
    this.renderCurrentTab();
  }

  private bindHeaderFooterEvents(): void {
    const closeBtn = this.container.querySelector('#btn-admin-close');
    closeBtn?.addEventListener('click', () => this.close());

    const tabProjects = this.container.querySelector('#tab-btn-projects');
    tabProjects?.addEventListener('click', () => {
      this.currentTab = 'projects';
      this.render();
    });

    const tabSite = this.container.querySelector('#tab-btn-site');
    tabSite?.addEventListener('click', () => {
      this.currentTab = 'site';
      this.render();
    });

    const tabShaders = this.container.querySelector('#tab-btn-shaders');
    tabShaders?.addEventListener('click', () => {
      this.currentTab = 'shaders';
      this.render();
    });

    const saveBtn = this.container.querySelector('#btn-save-cms');
    saveBtn?.addEventListener('click', () => this.handleSave());

    const exportBtn = this.container.querySelector('#btn-export-json');
    exportBtn?.addEventListener('click', () => this.handleExport());

    const resetBtn = this.container.querySelector('#btn-reset-defaults');
    resetBtn?.addEventListener('click', () => this.handleReset());
  }

  private renderCurrentTab(): void {
    const content = this.container.querySelector('#admin-tab-content');
    if (!content) return;

    if (this.currentTab === 'projects') {
      this.renderProjectsTab(content as HTMLElement);
    } else if (this.currentTab === 'site') {
      this.renderSiteTab(content as HTMLElement);
    } else if (this.currentTab === 'shaders') {
      this.renderShadersTab(content as HTMLElement);
    }
  }

  // ==========================================
  // TAB 1: PROJECTS TAB (CRUD + IMAGE UPLOAD)
  // ==========================================
  private renderProjectsTab(container: HTMLElement): void {
    container.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <span class="text-xs uppercase tracking-wider text-white/50 font-mono">Project Catalog</span>
        <button id="btn-add-project" data-ui-interactive="true" class="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded flex items-center gap-1.5 font-medium transition-colors shadow cursor-pointer">
          <span>+ Add Project</span>
        </button>
      </div>

      <div id="projects-list" class="space-y-4">
        <!-- Rendered items -->
      </div>
    `;

    const addBtn = container.querySelector('#btn-add-project');
    addBtn?.addEventListener('click', () => this.addNewProject());

    const list = container.querySelector('#projects-list') as HTMLElement;
    if (!list) return;

    this.data.projects.forEach((proj, index) => {
      const card = document.createElement('div');
      card.className =
        'bg-white/[0.03] border border-white/10 rounded-lg p-4 space-y-3 hover:border-white/20 transition-colors';
      card.innerHTML = `
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="font-mono text-xs text-indigo-400 font-bold">${proj.id}</span>
            <div class="w-10 h-10 rounded bg-white/5 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center relative group">
              ${
                proj.textureUrl
                  ? `<img src="${proj.textureUrl}" alt="${proj.title}" class="w-full h-full object-cover">`
                  : `<span class="text-[9px] text-white/40 font-mono">CANVAS</span>`
              }
            </div>
            <div>
              <h4 class="text-xs font-semibold uppercase text-white tracking-wide truncate max-w-[150px]">${
                proj.title || 'Untitled'
              }</h4>
              <p class="text-[10px] text-white/40 uppercase tracking-wider font-mono">${proj.client || 'N/A'} • ${
                proj.year || '2025'
              }</p>
            </div>
          </div>

          <div class="flex items-center gap-1">
            <button class="btn-move-up p-1.5 text-white/40 hover:text-white transition-colors disabled:opacity-20 cursor-pointer" data-ui-interactive="true" ${
              index === 0 ? 'disabled' : ''
            } title="Move Up">▲</button>
            <button class="btn-move-down p-1.5 text-white/40 hover:text-white transition-colors disabled:opacity-20 cursor-pointer" data-ui-interactive="true" ${
              index === this.data.projects.length - 1 ? 'disabled' : ''
            } title="Move Down">▼</button>
            <button class="btn-delete-proj p-1.5 text-white/40 hover:text-rose-400 transition-colors cursor-pointer" data-ui-interactive="true" title="Delete Project">✕</button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5">
          <div>
            <label class="text-[10px] uppercase tracking-wider text-white/40 block mb-1 font-mono">Title</label>
            <input type="text" class="input-title w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500" value="${
              proj.title
            }">
          </div>
          <div>
            <label class="text-[10px] uppercase tracking-wider text-white/40 block mb-1 font-mono">Client</label>
            <input type="text" class="input-client w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500" value="${
              proj.client
            }">
          </div>
          <div>
            <label class="text-[10px] uppercase tracking-wider text-white/40 block mb-1 font-mono">Role</label>
            <input type="text" class="input-role w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500" value="${
              proj.role
            }">
          </div>
          <div>
            <label class="text-[10px] uppercase tracking-wider text-white/40 block mb-1 font-mono">Year</label>
            <input type="text" class="input-year w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500" value="${
              proj.year
            }">
          </div>
          <div class="col-span-2">
            <label class="text-[10px] uppercase tracking-wider text-white/40 block mb-1 font-mono">Description</label>
            <textarea rows="2" class="input-desc w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 text-xs">${
              proj.description
            }</textarea>
          </div>
        </div>

        <div class="pt-2">
          <label class="text-[10px] uppercase tracking-wider text-white/40 block mb-1 font-mono">Strip Texture (.jpg, .png, .webp)</label>
          <div class="dropzone border border-dashed border-white/20 hover:border-indigo-500/80 rounded-lg p-3 text-center cursor-pointer transition-colors bg-white/[0.01] hover:bg-white/[0.03]">
            <input type="file" accept="image/jpeg,image/png,image/webp" class="file-input hidden">
            <div class="text-[11px] text-white/60">
              <span class="text-indigo-400 font-medium">Click to upload</span> or drag and drop
            </div>
            <div class="text-[9px] text-white/40 font-mono mt-0.5 truncate dropzone-filename">
              ${proj.textureUrl || 'Using procedural canvas'}
            </div>
          </div>
        </div>
      `;

      const inputTitle = card.querySelector('.input-title') as HTMLInputElement;
      inputTitle?.addEventListener('input', (e) => {
        proj.title = (e.target as HTMLInputElement).value;
        this.callbacks.onProjectsUpdated(this.data.projects);
      });

      const inputClient = card.querySelector('.input-client') as HTMLInputElement;
      inputClient?.addEventListener('input', (e) => {
        proj.client = (e.target as HTMLInputElement).value;
        this.callbacks.onProjectsUpdated(this.data.projects);
      });

      const inputRole = card.querySelector('.input-role') as HTMLInputElement;
      inputRole?.addEventListener('input', (e) => {
        proj.role = (e.target as HTMLInputElement).value;
        this.callbacks.onProjectsUpdated(this.data.projects);
      });

      const inputYear = card.querySelector('.input-year') as HTMLInputElement;
      inputYear?.addEventListener('input', (e) => {
        proj.year = (e.target as HTMLInputElement).value;
        this.callbacks.onProjectsUpdated(this.data.projects);
      });

      const inputDesc = card.querySelector('.input-desc') as HTMLTextAreaElement;
      inputDesc?.addEventListener('input', (e) => {
        proj.description = (e.target as HTMLTextAreaElement).value;
        this.callbacks.onProjectsUpdated(this.data.projects);
      });

      const btnUp = card.querySelector('.btn-move-up');
      btnUp?.addEventListener('click', () => this.moveProject(index, -1));

      const btnDown = card.querySelector('.btn-move-down');
      btnDown?.addEventListener('click', () => this.moveProject(index, 1));

      const btnDel = card.querySelector('.btn-delete-proj');
      btnDel?.addEventListener('click', () => this.deleteProject(index));

      const dropzone = card.querySelector('.dropzone') as HTMLElement;
      const fileInput = card.querySelector('.file-input') as HTMLInputElement;
      const filenameLabel = card.querySelector('.dropzone-filename') as HTMLElement;

      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-indigo-500');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-indigo-500');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-indigo-500');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.processImageFile(e.dataTransfer.files[0], proj, filenameLabel);
        }
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
          this.processImageFile(fileInput.files[0], proj, filenameLabel);
        }
      });

      list.appendChild(card);
    });
  }

  private addNewProject(): void {
    const newId = String(this.data.projects.length + 1).padStart(2, '0');
    const newProj: Project = {
      id: newId,
      title: 'New Exhibition',
      client: 'Studio Studio',
      role: 'Creative Developer',
      year: '2025',
      description: 'Interactive computational space and experimental WebGL installation.',
      textureUrl: '',
      imageWidth: 1920,
      imageHeight: 1280,
      accentColor: '#6366f1',
    };

    this.data.projects.push(newProj);
    this.renumberProjects();
    this.callbacks.onProjectsUpdated(this.data.projects);
    this.render();
    this.showToast(`Added Project ${newId}`);
  }

  private moveProject(index: number, direction: number): void {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= this.data.projects.length) return;

    const temp = this.data.projects[index];
    this.data.projects[index] = this.data.projects[targetIdx];
    this.data.projects[targetIdx] = temp;

    this.renumberProjects();
    this.callbacks.onProjectsUpdated(this.data.projects);
    this.render();
  }

  private deleteProject(index: number): void {
    if (this.data.projects.length <= 1) {
      this.showToast('At least one project is required', true);
      return;
    }

    const removed = this.data.projects.splice(index, 1);
    this.renumberProjects();
    this.callbacks.onProjectsUpdated(this.data.projects);
    this.render();
    this.showToast(`Deleted ${removed[0]?.title || 'project'}`);
  }

  private renumberProjects(): void {
    this.data.projects.forEach((p, idx) => {
      p.id = String(idx + 1).padStart(2, '0');
    });
  }

  private processImageFile(file: File, project: Project, label: HTMLElement): void {
    if (!file.type.startsWith('image/')) {
      this.showToast('Please select a valid image file', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      if (!base64Data) return;

      const img = new Image();
      img.onload = async () => {
        project.imageWidth = img.naturalWidth || 1920;
        project.imageHeight = img.naturalHeight || 1280;

        try {
          const gh = getGitHubConfig();
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (gh.token && gh.owner && gh.repo) {
            headers['x-github-token'] = gh.token;
            headers['x-github-owner'] = gh.owner;
            headers['x-github-repo'] = gh.repo;
            headers['x-github-branch'] = gh.branch || 'main';
          }

          const res = await fetch('/api/cms/upload', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              filename: file.name,
              base64Data,
              githubConfig: gh,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            project.textureUrl = data.url;
            label.textContent = `${data.filename} (${project.imageWidth}x${project.imageHeight})`;
            this.showToast(data.githubSynced ? `Uploaded & Committed ${data.filename}` : `Uploaded ${data.filename}`);
          } else {
            project.textureUrl = base64Data;
            label.textContent = `${file.name} (Local Data URI)`;
            this.showToast('Loaded local texture preview');
          }
        } catch {
          project.textureUrl = base64Data;
          label.textContent = `${file.name} (Local Data URI)`;
          this.showToast('Loaded local texture preview');
        }

        this.callbacks.onProjectsUpdated(this.data.projects);
      };
      img.src = base64Data;
    };
    reader.readAsDataURL(file);
  }

  // ==========================================
  // TAB 2: SITE & ABOUT TAB
  // ==========================================
  private renderSiteTab(container: HTMLElement): void {
    const s = this.data.settings;
    const gh = getGitHubConfig();
    const isGhActive = Boolean(gh.token && gh.owner && gh.repo);

    container.innerHTML = `
      <div class="space-y-4 text-xs">
        <div>
          <label class="text-[10px] uppercase tracking-wider text-white/40 block mb-1 font-mono">Brand Name / Designer</label>
          <input id="input-brand-name" type="text" class="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500" value="${
            s.brandName
          }">
        </div>

        <div>
          <label class="text-[10px] uppercase tracking-wider text-white/40 block mb-1 font-mono">Role / Subtitle</label>
          <input id="input-brand-role" type="text" class="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500" value="${
            s.brandRole || 'Creative Developer • WebGL'
          }">
        </div>

        <div>
          <label class="text-[10px] uppercase tracking-wider text-white/40 block mb-1 font-mono">Contact Email</label>
          <input id="input-contact-email" type="email" class="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500" value="${
            s.contactEmail
          }">
        </div>

        <div>
          <label class="text-[10px] uppercase tracking-wider text-white/40 block mb-1 font-mono">About Biography</label>
          <textarea id="input-about-bio" rows="5" class="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500 leading-relaxed font-light">${
            s.aboutBio
          }</textarea>
        </div>

        <!-- GitHub Auto-Commit Global Sync Section -->
        <div class="pt-4 border-t border-white/10 space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-[10px] uppercase tracking-wider text-white/40 block font-mono">GitHub Auto-Commit Sync</label>
            <span id="gh-sync-badge" class="text-[9px] font-mono px-2 py-0.5 rounded transition-colors ${
              isGhActive
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/5 text-white/40 border border-white/10'
            }">
              ${isGhActive ? 'Sync Active' : 'Unconfigured'}
            </span>
          </div>

          <!-- Warning Banner (displayed if token is missing) -->
          <div id="gh-token-warning" class="bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] p-3 rounded-lg flex items-center gap-2.5 ${
            gh.token ? 'hidden' : ''
          }">
            <span class="text-amber-400 text-sm flex-shrink-0">⚠️</span>
            <span class="font-sans leading-tight">No GitHub token configured for remote sync.</span>
          </div>

          <p class="text-[10px] text-white/50 leading-relaxed font-light">
            Auto-commits CMS changes directly to your GitHub repo so edits persist permanently and sync across all devices in real time.
          </p>

          <div class="space-y-3">
            <div>
              <label class="text-[9px] uppercase tracking-wider text-white/40 block mb-1 font-mono">GitHub Personal Access Token</label>
              <input id="input-gh-token" type="password" placeholder="ghp_... or github_pat_..." class="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono" value="${
                gh.token
              }">
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[9px] uppercase tracking-wider text-white/40 block mb-1 font-mono">GitHub Repository Owner / Username</label>
                <input id="input-gh-owner" type="text" placeholder="e.g. anupamnahin" class="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono" value="${
                  gh.owner
                }">
              </div>
              <div>
                <label class="text-[9px] uppercase tracking-wider text-white/40 block mb-1 font-mono">GitHub Repository Name</label>
                <input id="input-gh-repo" type="text" placeholder="e.g. website" class="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono" value="${
                  gh.repo
                }">
              </div>
            </div>
          </div>
        </div>

        <!-- Primary Device Lock Status & Reset -->
        <div class="pt-4 border-t border-white/10 space-y-2">
          <label class="text-[10px] uppercase tracking-wider text-white/40 block font-mono">Primary Device Lock</label>
          <div class="bg-white/[0.02] border border-white/5 p-3.5 rounded-lg flex items-center justify-between gap-3">
            <div>
              <div class="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5 font-semibold">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Authorized Primary Device</span>
              </div>
              <div class="text-[9px] text-white/40 font-mono mt-0.5">Admin controls are hidden on all other devices</div>
            </div>
            <button id="btn-reset-device-lock" data-ui-interactive="true" class="text-[10px] font-mono uppercase tracking-wider text-rose-400 hover:text-white hover:bg-rose-600/80 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded transition-all cursor-pointer flex-shrink-0">
              Reset Lock
            </button>
          </div>
        </div>
      </div>
    `;

    const nameInput = container.querySelector('#input-brand-name') as HTMLInputElement;
    nameInput?.addEventListener('input', (e) => {
      s.brandName = (e.target as HTMLInputElement).value;
      this.callbacks.onSettingsUpdated(s);
    });

    const roleInput = container.querySelector('#input-brand-role') as HTMLInputElement;
    roleInput?.addEventListener('input', (e) => {
      s.brandRole = (e.target as HTMLInputElement).value;
      this.callbacks.onSettingsUpdated(s);
    });

    const emailInput = container.querySelector('#input-contact-email') as HTMLInputElement;
    emailInput?.addEventListener('input', (e) => {
      s.contactEmail = (e.target as HTMLInputElement).value;
      this.callbacks.onSettingsUpdated(s);
    });

    const bioInput = container.querySelector('#input-about-bio') as HTMLTextAreaElement;
    bioInput?.addEventListener('input', (e) => {
      s.aboutBio = (e.target as HTMLTextAreaElement).value;
      this.callbacks.onSettingsUpdated(s);
    });

    // GitHub config listeners
    const ghOwnerInput = container.querySelector('#input-gh-owner') as HTMLInputElement;
    const ghRepoInput = container.querySelector('#input-gh-repo') as HTMLInputElement;
    const ghTokenInput = container.querySelector('#input-gh-token') as HTMLInputElement;
    const ghBadge = container.querySelector('#gh-sync-badge');
    const warningEl = container.querySelector('#gh-token-warning');

    const updateGhConfig = () => {
      gh.token = ghTokenInput?.value.trim() || '';
      gh.owner = ghOwnerInput?.value.trim() || '';
      gh.repo = ghRepoInput?.value.trim() || '';
      gh.branch = gh.branch || 'main';

      // Save credentials securely to localStorage
      try {
        localStorage.setItem('portfolio_github_token', gh.token);
        localStorage.setItem('portfolio_github_owner', gh.owner);
        localStorage.setItem('portfolio_github_repo', gh.repo);
      } catch {}

      saveGitHubConfig(gh);

      const active = Boolean(gh.token && gh.owner && gh.repo);
      if (ghBadge) {
        ghBadge.className = `text-[9px] font-mono px-2 py-0.5 rounded transition-colors ${
          active
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-white/5 text-white/40 border border-white/10'
        }`;
        ghBadge.textContent = active ? 'Sync Active' : 'Unconfigured';
      }

      if (warningEl) {
        if (gh.token) {
          warningEl.classList.add('hidden');
        } else {
          warningEl.classList.remove('hidden');
        }
      }
    };

    ghOwnerInput?.addEventListener('input', updateGhConfig);
    ghRepoInput?.addEventListener('input', updateGhConfig);
    ghTokenInput?.addEventListener('input', updateGhConfig);

    const resetLockBtn = container.querySelector('#btn-reset-device-lock');
    resetLockBtn?.addEventListener('click', async () => {
      if (confirm('Reset device lock? This will unbind this device and hide the Admin panel until reclaimed.')) {
        await resetServerDeviceLock();
        this.close();
        this.destroy();
        this.callbacks.onResetDeviceLock?.();
      }
    });
  }

  // ==========================================
  // TAB 3: SHADERS & WEBGL PHYSICS TAB
  // ==========================================
  private renderShadersTab(container: HTMLElement): void {
    const s = this.data.settings;
    container.innerHTML = `
      <div class="space-y-6 text-xs">
        <div class="space-y-2 bg-white/[0.02] border border-white/5 p-4 rounded-lg">
          <div class="flex justify-between items-center">
            <label class="text-[10px] uppercase tracking-wider text-white/60 font-mono">Wave Bend Strength</label>
            <span id="val-bend" class="text-indigo-400 font-mono font-semibold">${s.bendStrength.toFixed(2)}</span>
          </div>
          <input id="slider-bend" type="range" min="0.0" max="4.0" step="0.1" value="${s.bendStrength}" class="w-full accent-indigo-500 cursor-pointer">
          <p class="text-[10px] text-white/30">Controls vertex sine wave curvature on X/Z axes during velocity scrolling.</p>
        </div>

        <div class="space-y-2 bg-white/[0.02] border border-white/5 p-4 rounded-lg">
          <div class="flex justify-between items-center">
            <label class="text-[10px] uppercase tracking-wider text-white/60 font-mono">RGB Shift Intensity</label>
            <span id="val-rgb" class="text-indigo-400 font-mono font-semibold">${s.rgbShiftStrength.toFixed(4)}</span>
          </div>
          <input id="slider-rgb" type="range" min="0.0" max="0.03" step="0.0005" value="${s.rgbShiftStrength}" class="w-full accent-indigo-500 cursor-pointer">
          <p class="text-[10px] text-white/30">Chromatic aberration offset applied horizontally proportional to velocity.</p>
        </div>

        <div class="space-y-2 bg-white/[0.02] border border-white/5 p-4 rounded-lg">
          <div class="flex justify-between items-center">
            <label class="text-[10px] uppercase tracking-wider text-white/60 font-mono">Scroll Inertia Ease</label>
            <span id="val-ease" class="text-indigo-400 font-mono font-semibold">${s.scrollEase.toFixed(3)}</span>
          </div>
          <input id="slider-ease" type="range" min="0.03" max="0.15" step="0.005" value="${s.scrollEase}" class="w-full accent-indigo-500 cursor-pointer">
          <p class="text-[10px] text-white/30">Interpolation factor between currentScroll and targetScroll per RAF frame.</p>
        </div>
      </div>
    `;

    const sliderBend = container.querySelector('#slider-bend') as HTMLInputElement;
    const valBend = container.querySelector('#val-bend') as HTMLElement;
    sliderBend?.addEventListener('input', () => {
      const v = parseFloat(sliderBend.value);
      s.bendStrength = v;
      if (valBend) valBend.textContent = v.toFixed(2);
      this.callbacks.onShaderSettingsChanged({ bendStrength: v });
    });

    const sliderRgb = container.querySelector('#slider-rgb') as HTMLInputElement;
    const valRgb = container.querySelector('#val-rgb') as HTMLElement;
    sliderRgb?.addEventListener('input', () => {
      const v = parseFloat(sliderRgb.value);
      s.rgbShiftStrength = v;
      if (valRgb) valRgb.textContent = v.toFixed(4);
      this.callbacks.onShaderSettingsChanged({ rgbShiftStrength: v });
    });

    const sliderEase = container.querySelector('#slider-ease') as HTMLInputElement;
    const valEase = container.querySelector('#val-ease') as HTMLElement;
    sliderEase?.addEventListener('input', () => {
      const v = parseFloat(sliderEase.value);
      s.scrollEase = v;
      if (valEase) valEase.textContent = v.toFixed(3);
      this.callbacks.onShaderSettingsChanged({ scrollEase: v });
    });
  }

  private async handleSave(): Promise<void> {
    const gh = getGitHubConfig();
    const isGhConfigured = Boolean(gh.token && gh.owner && gh.repo);

    const saveBtn = this.container.querySelector('#btn-save-cms') as HTMLButtonElement | null;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = isGhConfigured
        ? `<span>Saving to GitHub & Syncing...</span>`
        : `<span>Saving Changes...</span>`;
    }

    const result = await savePortfolioData(this.data, gh);

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<span>Save Changes</span>`;
    }

    const warningEl = this.container.querySelector('#gh-token-warning');
    if (warningEl) {
      if (gh.token) {
        warningEl.classList.add('hidden');
      } else {
        warningEl.classList.remove('hidden');
      }
    }

    if (result.githubSynced) {
      this.showToast('Changes Live! Committed to GitHub & Redeploying...');
    } else if (result.warning) {
      this.showToast(result.warning);
    } else if (result.success) {
      this.showToast(result.message || 'Saved successfully');
    } else {
      this.showToast(result.message || 'Save error');
    }

    this.callbacks.onProjectsUpdated(this.data.projects);
    this.callbacks.onSettingsUpdated(this.data.settings);
    this.callbacks.onShaderSettingsChanged({
      bendStrength: this.data.settings.bendStrength,
      rgbShiftStrength: this.data.settings.rgbShiftStrength,
      scrollEase: this.data.settings.scrollEase,
    });
  }

  public updateExternalData(data: PortfolioData): void {
    this.data = JSON.parse(JSON.stringify(data));
    if (!this.isOpen) {
      this.render();
    }
  }

  private handleExport(): void {
    const jsonStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Exported portfolio.json');
  }

  private handleReset(): void {
    if (!confirm('Reset all CMS content and shader parameters to original defaults?')) {
      return;
    }

    this.data = {
      settings: JSON.parse(JSON.stringify(defaultSettings)),
      projects: JSON.parse(JSON.stringify(defaultProjects)),
    };
    savePortfolioData(this.data);
    this.callbacks.onProjectsUpdated(this.data.projects);
    this.callbacks.onSettingsUpdated(this.data.settings);
    this.callbacks.onShaderSettingsChanged({
      bendStrength: this.data.settings.bendStrength,
      rgbShiftStrength: this.data.settings.rgbShiftStrength,
      scrollEase: this.data.settings.scrollEase,
    });
    this.render();
    this.showToast('Reset to defaults');
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('hashchange', this.handleHashChangeBound);
    this.container.remove();
  }
}
