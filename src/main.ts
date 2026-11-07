import './style.css';
import { Sizes } from './utils/sizes';
import { Hud } from './components/Hud';
import { Navigation } from './components/Navigation';
import { AdminPanel } from './components/AdminPanel';
import { World } from './gl/World';
import { loadPortfolioData, type PortfolioSettings, type Project } from './data/projects';
import {
  isDeviceAuthorized,
  fetchServerDeviceLock,
  showClaimModal,
  showLockedToast,
} from './utils/deviceLock';

class App {
  private sizes: Sizes;
  private hud: Hud;
  private navigation: Navigation;
  private adminPanel: AdminPanel | null = null;
  private world: World;
  private currentProjects: Project[] = [];
  private currentSettings: PortfolioSettings;
  private isAuthorizedDevice = false;

  private rafId: number | null = null;
  private lastTime = 0;
  private pollIntervalId: number | null = null;
  private lastDataSnapshot = '';

  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleHashChangeBound: () => void;

  constructor(initialData: { settings: PortfolioSettings; projects: Project[] }) {
    this.sizes = new Sizes();
    this.currentProjects = initialData.projects;
    this.currentSettings = initialData.settings;
    this.lastDataSnapshot = JSON.stringify({
      settings: this.currentSettings,
      projects: this.currentProjects,
    });

    const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Canvas element #webgl-canvas not found.');
    }

    // 1. World & WebGL 3D Slider setup
    this.world = new World(canvas, this.sizes, this.currentProjects, this.currentSettings);

    // 2. HUD setup
    this.hud = new Hud({
      onCloseProject: () => {
        this.world.slider.collapse();
      },
      onOpenAdmin: () => {
        this.adminPanel?.open();
      },
    });
    this.hud.updateSettings(this.currentSettings);
    // Explicitly hide admin button until device auth verified
    this.hud.setAdminVisible(false);

    // 3. Navigation (Index & About) setup
    this.navigation = new Navigation(
      this.currentProjects,
      this.currentSettings,
      {
        onSelectProject: (index: number) => {
          this.world.slider.goToIndex(index);
        },
      }
    );

    // 4. Slider callbacks to HUD
    this.world.slider.setCallbacks({
      onIndexChange: (index, project) => {
        this.hud.updateActiveProject(project, index, this.currentProjects.length);
      },
      onExpand: (index, project) => {
        this.hud.showExpandedProject(project, index, this.currentProjects.length);
      },
      onCollapse: () => {
        this.hud.hideExpandedProject();
      },
    });

    // 5. Initial HUD sync
    if (this.currentProjects.length > 0) {
      this.hud.updateActiveProject(this.currentProjects[0], 0, this.currentProjects.length);
    }

    // 6. Device Lock & Admin verification
    this.checkDeviceAuthorization();

    // 7. Secret login listeners (#admin-login and Shift + Alt + A)
    this.handleKeyDownBound = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        this.handleSecretAdminTrigger();
      }
    };
    this.handleHashChangeBound = () => {
      if (window.location.hash === '#admin-login') {
        this.handleSecretAdminTrigger();
      }
    };

    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('hashchange', this.handleHashChangeBound);

    if (window.location.hash === '#admin-login') {
      this.handleSecretAdminTrigger();
    }

    // 8. Background Polling (Global Multi-Device Sync)
    this.initPolling();

    // 9. Master RAF loop
    this.animate = this.animate.bind(this);
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.animate);
  }

  private initPolling(): void {
    // Poll every 60 seconds for global CMS updates from GitHub or other authorized sessions
    this.pollIntervalId = window.setInterval(async () => {
      try {
        const res = await fetch(`/data/portfolio.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.settings || !Array.isArray(data?.projects)) return;

        const newSnapshot = JSON.stringify({
          settings: data.settings,
          projects: data.projects,
        });

        if (newSnapshot !== this.lastDataSnapshot) {
          this.lastDataSnapshot = newSnapshot;
          this.currentSettings = { ...data.settings };
          this.currentProjects = [...data.projects];

          // Hot update 3D WebGL scene, HUD, and navigation
          this.world.slider.rebuild(this.currentProjects, this.currentSettings);
          this.hud.updateSettings(this.currentSettings);
          this.navigation.updateData(this.currentSettings, this.currentProjects);

          if (this.currentProjects.length > 0) {
            const activeIdx = Math.min(
              this.world.slider.activeIndex || 0,
              this.currentProjects.length - 1
            );
            this.hud.updateActiveProject(
              this.currentProjects[activeIdx],
              activeIdx,
              this.currentProjects.length
            );
          }

          if (this.adminPanel) {
            this.adminPanel.updateExternalData(data);
          }

          if (data.settings.claimedDeviceHash !== undefined) {
            this.checkDeviceAuthorization();
          }
        }
      } catch {
        // Silently ignore background polling network errors
      }
    }, 60000);
  }

  private async checkDeviceAuthorization(): Promise<void> {
    const serverHash = await fetchServerDeviceLock();
    if (serverHash) {
      this.currentSettings.claimedDeviceHash = serverHash;
    }
    const isAuth = await isDeviceAuthorized(serverHash);
    this.isAuthorizedDevice = isAuth;

    if (isAuth) {
      this.hud.setAdminVisible(true);
      this.initAdminPanel();
    } else {
      this.hud.setAdminVisible(false);
      if (this.adminPanel) {
        this.adminPanel.destroy();
        this.adminPanel = null;
      }
    }
  }

  private initAdminPanel(): void {
    if (this.adminPanel) return;

    this.adminPanel = new AdminPanel(
      {
        settings: this.currentSettings,
        projects: this.currentProjects,
      },
      {
        onProjectsUpdated: (updatedProjects) => {
          this.currentProjects = [...updatedProjects];
          this.world.slider.rebuild(this.currentProjects, this.currentSettings);
          this.navigation.updateData(this.currentSettings, this.currentProjects);
        },
        onSettingsUpdated: (updatedSettings) => {
          this.currentSettings = { ...updatedSettings };
          this.hud.updateSettings(this.currentSettings);
          this.navigation.updateSettings(this.currentSettings);
          this.world.slider.updateShaderSettings(this.currentSettings);
        },
        onShaderSettingsChanged: (shaderSettings) => {
          this.world.slider.updateShaderSettings(shaderSettings);
        },
        onResetDeviceLock: () => {
          this.isAuthorizedDevice = false;
          this.currentSettings.claimedDeviceHash = null;
          this.hud.setAdminVisible(false);
          if (this.adminPanel) {
            this.adminPanel.destroy();
            this.adminPanel = null;
          }
        },
      }
    );
  }

  private async handleSecretAdminTrigger(): Promise<void> {
    const serverHash = await fetchServerDeviceLock();
    const isAuth = await isDeviceAuthorized(serverHash);

    if (isAuth) {
      this.isAuthorizedDevice = true;
      this.hud.setAdminVisible(true);
      if (!this.adminPanel) {
        this.initAdminPanel();
      }
      this.adminPanel?.open();
      if (window.location.hash === '#admin-login') {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      return;
    }

    if (serverHash) {
      // Already claimed on another primary device
      showLockedToast('Admin is locked to the primary device');
      return;
    }

    // Unclaimed: show setup claim modal
    showClaimModal(async () => {
      const newHash = await fetchServerDeviceLock();
      this.currentSettings.claimedDeviceHash = newHash;
      this.isAuthorizedDevice = true;
      this.hud.setAdminVisible(true);
      this.initAdminPanel();
      this.adminPanel?.open();
    });
  }

  public get isAuthorized(): boolean {
    return this.isAuthorizedDevice;
  }

  private animate(time: number): void {
    const deltaTime = Math.min((time - this.lastTime) * 0.001, 0.1);
    this.lastTime = time;

    this.world.render(deltaTime);

    this.rafId = requestAnimationFrame(this.animate);
  }

  public destroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.pollIntervalId) clearInterval(this.pollIntervalId);
    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('hashchange', this.handleHashChangeBound);
    this.world.destroy();
    this.sizes.destroy();
    this.hud.destroy();
    this.navigation.destroy();
    this.adminPanel?.destroy();
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const data = await loadPortfolioData();
  new App(data);
});
