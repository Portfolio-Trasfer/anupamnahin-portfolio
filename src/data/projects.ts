import * as THREE from 'three';

export interface SocialLink {
  name: string;
  url: string;
}

export interface PortfolioSettings {
  brandName: string;
  brandRole: string;
  aboutBio: string;
  contactEmail: string;
  socials: SocialLink[];
  bendStrength: number;
  rgbShiftStrength: number;
  scrollEase: number;
  claimedDeviceHash?: string | null;
}

export interface Project {
  id: string;
  title: string;
  client: string;
  role: string;
  year: string;
  description: string;
  textureUrl: string;
  imageWidth: number;
  imageHeight: number;
  accentColor: string;
}

export interface PortfolioData {
  settings: PortfolioSettings;
  projects: Project[];
}

export const defaultSettings: PortfolioSettings = {
  brandName: 'Aristide Benoist',
  brandRole: 'Creative Developer • WebGL',
  aboutBio: 'Independent creative developer focused on crafting fluid interactive WebGL experiences, generative motion design, and high-performance digital typography. Specializing in Three.js, custom GLSL shader pipelines, virtual inertial physics, and cinematic UI choreographies for international brands and design ateliers.',
  contactEmail: 'contact@aristidebenoist.com',
  socials: [
    { name: 'Website', url: 'https://aristidebenoist.com' },
    { name: 'Twitter', url: 'https://twitter.com' },
    { name: 'GitHub', url: 'https://github.com' },
  ],
  bendStrength: 1.8,
  rgbShiftStrength: 0.0015,
  scrollEase: 0.075,
  claimedDeviceHash: null,
};

export const defaultProjects: Project[] = [
  {
    id: '01',
    title: 'Aura Sanctum',
    client: 'Atelier Minimal',
    role: 'Art Direction & WebGL',
    year: '2025',
    imageWidth: 1920,
    imageHeight: 1280,
    textureUrl: '/textures/project-01.jpg',
    description: 'Spatial architectural visualization, dynamic perspective lighting, and kinetic identity systems for contemporary museum installations.',
    accentColor: '#4f46e5',
  },
  {
    id: '02',
    title: 'Monolith Void',
    client: 'Studio Kanso',
    role: 'Creative Development',
    year: '2025',
    imageWidth: 1920,
    imageHeight: 1280,
    textureUrl: '/textures/project-02.jpg',
    description: 'Monochromatic exploration of light, brutalist monolithic structures, and real-time volumetric shadow simulations.',
    accentColor: '#38bdf8',
  },
  {
    id: '03',
    title: 'Elysian Pulse',
    client: 'Vesper Media',
    role: 'Shader Programming',
    year: '2024',
    imageWidth: 1920,
    imageHeight: 1280,
    textureUrl: '/textures/project-03.jpg',
    description: 'Dynamic typography deformation and audio-reactive procedural textures created for an interactive sound laboratory.',
    accentColor: '#f43f5e',
  },
  {
    id: '04',
    title: 'Chronos Rift',
    client: 'Neo Dimension',
    role: 'Interactive Direction',
    year: '2024',
    imageWidth: 1920,
    imageHeight: 1280,
    textureUrl: '/textures/project-04.jpg',
    description: 'Experimental temporal transitions, spatial velocity waves, and custom GLSL vertex distortion mechanisms.',
    accentColor: '#10b981',
  },
  {
    id: '05',
    title: 'Silent Form',
    client: 'Galerie Blanche',
    role: 'WebGL Experience',
    year: '2023',
    imageWidth: 1920,
    imageHeight: 1280,
    textureUrl: '/textures/project-05.jpg',
    description: 'Curated digital sculptures and virtual exhibition halls featuring ultra-smooth inertial drag mechanics and cover UV scaling.',
    accentColor: '#a1a1aa',
  },
];

export interface GitHubSyncConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

export interface SaveResult {
  success: boolean;
  message: string;
  githubSynced?: boolean;
  commitUrl?: string;
  warning?: string;
}

export function getGitHubConfig(): GitHubSyncConfig {
  let token = '';
  let owner = '';
  let repo = '';
  let branch = 'main';

  try {
    token = localStorage.getItem('portfolio_github_token') || '';
    owner = localStorage.getItem('portfolio_github_owner') || '';
    repo = localStorage.getItem('portfolio_github_repo') || '';

    const raw = localStorage.getItem('portfolio_github_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!token && parsed.token) token = parsed.token;
      if (!owner && parsed.owner) owner = parsed.owner;
      if (!repo && parsed.repo) repo = parsed.repo;
      if (parsed.branch) branch = parsed.branch;
    }
  } catch {}

  return {
    owner,
    repo,
    branch,
    token,
  };
}

export function saveGitHubConfig(config: GitHubSyncConfig): void {
  try {
    localStorage.setItem('portfolio_github_token', config.token);
    localStorage.setItem('portfolio_github_owner', config.owner);
    localStorage.setItem('portfolio_github_repo', config.repo);
    localStorage.setItem('portfolio_github_config', JSON.stringify(config));
  } catch {}
}

export let projects: Project[] = [...defaultProjects];

export async function loadPortfolioData(): Promise<PortfolioData> {
  // 1. Fetch live public/data/portfolio.json with cache-busting so all devices stay in sync
  try {
    const res = await fetch(`/data/portfolio.json?t=${Date.now()}`);
    if (res.ok) {
      const data = (await res.json()) as PortfolioData;
      if (data.settings && Array.isArray(data.projects)) {
        projects = data.projects;
        try {
          localStorage.setItem('portfolio_cms_override', JSON.stringify(data));
        } catch {}
        return data;
      }
    }
  } catch (err) {
    console.warn('Could not load live /data/portfolio.json, checking localStorage fallback:', err);
  }

  // 2. Offline fallback: localStorage
  const localOverride = localStorage.getItem('portfolio_cms_override');
  if (localOverride) {
    try {
      const parsed = JSON.parse(localOverride) as PortfolioData;
      if (parsed.settings && Array.isArray(parsed.projects)) {
        projects = parsed.projects;
        return parsed;
      }
    } catch {}
  }

  return {
    settings: { ...defaultSettings },
    projects: [...defaultProjects],
  };
}

export async function savePortfolioData(
  data: PortfolioData,
  customGhConfig?: GitHubSyncConfig
): Promise<SaveResult> {
  // Always update localStorage fallback
  try {
    localStorage.setItem('portfolio_cms_override', JSON.stringify(data));
  } catch {}
  projects = data.projects;

  const gh = customGhConfig || getGitHubConfig();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (gh.token && gh.owner && gh.repo) {
    headers['Authorization'] = `Bearer ${gh.token}`;
    headers['x-github-token'] = gh.token;
    headers['x-github-owner'] = gh.owner;
    headers['x-github-repo'] = gh.repo;
    headers['x-github-branch'] = gh.branch || 'main';
  }

  try {
    const res = await fetch('/api/cms/save', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...data,
        githubToken: gh.token,
        owner: gh.owner,
        repo: gh.repo,
        branch: gh.branch || 'main',
        githubConfig: gh,
      }),
    });

    if (res.ok) {
      const resJson = await res.json();
      return {
        success: true,
        message: resJson.message || 'Saved successfully',
        githubSynced: resJson.githubSynced,
        commitUrl: resJson.commitUrl,
        warning: resJson.warning,
      };
    } else {
      const errText = await res.text();
      return {
        success: false,
        message: `Server returned error (${res.status}): ${errText}`,
      };
    }
  } catch (err) {
    console.warn('Save to /api/cms/save failed, relying on localStorage:', err);
    return {
      success: true,
      message: 'Saved to local browser cache (offline mode)',
      githubSynced: false,
    };
  }
}

/**
 * Procedural canvas texture generator fallback.
 */
export function createProceduralProjectTexture(project: Project): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = project.imageWidth || 1920;
  canvas.height = project.imageHeight || 1280;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    const dummyCanvas = document.createElement('canvas');
    dummyCanvas.width = 16;
    dummyCanvas.height = 16;
    return new THREE.CanvasTexture(dummyCanvas);
  }

  const { width, height } = canvas;

  // 1. High-contrast architectural gradient background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0a0a0c');
  gradient.addColorStop(0.5, '#141418');
  gradient.addColorStop(1, '#08080a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 2. Subtle geometric architectural grid & accent lights
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  const gridSize = 120;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Accent glow
  const glow = ctx.createRadialGradient(
    width * 0.7,
    height * 0.35,
    50,
    width * 0.7,
    height * 0.35,
    width * 0.55
  );
  glow.addColorStop(0, `${project.accentColor || '#6366f1'}33`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Corner marks
  const markSize = 40;
  const pad = 80;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(pad - markSize, pad);
  ctx.lineTo(pad + markSize, pad);
  ctx.moveTo(pad, pad - markSize);
  ctx.lineTo(pad, pad + markSize);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(width - pad - markSize, height - pad);
  ctx.lineTo(width - pad + markSize, height - pad);
  ctx.moveTo(width - pad, height - pad - markSize);
  ctx.lineTo(width - pad, height - pad + markSize);
  ctx.stroke();

  // Giant numeral
  ctx.font = '900 480px "Inter", "Helvetica Neue", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillText(project.id, width - 120, height * 0.52);

  // Typography
  ctx.font = '600 24px "Inter", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = project.accentColor || '#6366f1';
  ctx.fillText(`PROJECT — ${project.id}`, 120, 120);

  ctx.font = '800 110px "Inter", "Helvetica Neue", sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText((project.title || 'UNTITLED').toUpperCase(), 120, 180);

  ctx.font = '500 28px "Inter", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillText(`CLIENT: ${project.client || 'INDEPENDENT'}`, 120, 340);
  ctx.fillText(`ROLE: ${project.role || 'CREATIVE'}`, 120, 390);
  ctx.fillText(`YEAR: ${project.year || '2025'}`, 120, 440);

  ctx.font = '400 20px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillText(`SPECS: 1920x1280 • 60 FPS • THREE.JS GLSL • ARISTIDE BENOIST`, 120, height - 140);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}
