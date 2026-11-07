import { loadPortfolioData, savePortfolioData } from '../data/projects';

const DEVICE_TOKEN_KEY = 'portfolio_admin_device_token';
const DEFAULT_SETUP_PIN = '2026';

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getLocalDeviceToken(): string | null {
  try {
    return localStorage.getItem(DEVICE_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function isDeviceAuthorized(claimedHash?: string | null): Promise<boolean> {
  if (!claimedHash) return false;
  const token = getLocalDeviceToken();
  if (!token) return false;
  const tokenHash = await sha256(token);
  return tokenHash === claimedHash;
}

export async function fetchServerDeviceLock(): Promise<string | null> {
  try {
    const res = await fetch(`/api/device-lock?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      return data.claimedDeviceHash || null;
    }
  } catch {
    // Fallback to portfolio.json if endpoint is unavailable
  }

  try {
    const data = await loadPortfolioData();
    return data.settings.claimedDeviceHash || null;
  } catch {
    return null;
  }
}

export async function registerDeviceClaim(pin: string): Promise<{ success: boolean; message: string; hash?: string }> {
  if (pin.trim() !== DEFAULT_SETUP_PIN) {
    return { success: false, message: 'Invalid Setup PIN' };
  }

  // 1. Verify that server has not already been claimed
  const existingHash = await fetchServerDeviceLock();
  if (existingHash) {
    return { success: false, message: 'Admin is locked to the primary device' };
  }

  // 2. Generate unique token on this device
  const token = crypto.randomUUID ? crypto.randomUUID() : `token_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const hash = await sha256(token);

  try {
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  } catch {
    return { success: false, message: 'Storage not accessible' };
  }

  // 3. Post to /api/device-lock and /api/cms/save
  try {
    await fetch('/api/device-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimedDeviceHash: hash }),
    });
  } catch (err) {
    console.warn('Could not post to /api/device-lock:', err);
  }

  // Also update portfolio data
  const data = await loadPortfolioData();
  data.settings.claimedDeviceHash = hash;
  await savePortfolioData(data);

  return { success: true, message: 'Device successfully authorized as Primary Admin!', hash };
}

export async function resetServerDeviceLock(): Promise<boolean> {
  try {
    localStorage.removeItem(DEVICE_TOKEN_KEY);
  } catch {
    // Ignore
  }

  try {
    await fetch('/api/device-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', claimedDeviceHash: null }),
    });
  } catch {
    // Ignore
  }

  const data = await loadPortfolioData();
  data.settings.claimedDeviceHash = null;
  await savePortfolioData(data);

  return true;
}

/**
 * Creates and renders the secret "Claim Admin" modal
 */
export function showClaimModal(onSuccess: () => void): void {
  const existingModal = document.getElementById('claim-device-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'claim-device-modal';
  modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl transition-opacity animate-in fade-in duration-300';
  modal.innerHTML = `
    <div class="max-w-md w-full bg-[#121214] border border-white/15 rounded-xl p-8 shadow-2xl relative text-white font-sans" data-ui-interactive="true">
      <button id="btn-close-claim" class="absolute top-5 right-5 text-white/40 hover:text-white p-2 transition-colors cursor-pointer text-sm">✕</button>

      <div class="flex items-center gap-3 mb-4">
        <div class="w-3 h-3 rounded-full bg-indigo-500 animate-pulse"></div>
        <h3 class="text-sm font-bold uppercase tracking-[0.2em]">First-Device Admin Claim</h3>
      </div>

      <p class="text-xs text-white/70 leading-relaxed mb-6 font-light">
        Bind Admin access exclusively to this device. Once claimed, the Admin button and shortcuts are completely invisible on all other devices.
      </p>

      <div class="space-y-4">
        <div>
          <label class="text-[10px] font-mono uppercase tracking-widest text-white/50 block mb-1.5">One-Time Setup PIN</label>
          <input id="claim-pin-input" type="password" placeholder="Enter PIN (Default: 2026)" class="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono">
        </div>

        <div id="claim-status" class="text-xs font-mono min-h-[1.25rem]"></div>

        <button id="btn-submit-claim" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold uppercase tracking-[0.15em] transition-all shadow-lg shadow-indigo-600/30 cursor-pointer">
          Claim Admin on This Device
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#btn-close-claim');
  const submitBtn = modal.querySelector('#btn-submit-claim');
  const pinInput = modal.querySelector('#claim-pin-input') as HTMLInputElement;
  const statusEl = modal.querySelector('#claim-status') as HTMLElement;

  const removeModal = () => {
    modal.remove();
    if (window.location.hash === '#admin-login') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  closeBtn?.addEventListener('click', removeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) removeModal();
  });

  const handleSubmit = async () => {
    const pin = pinInput.value;
    if (!pin) {
      statusEl.textContent = 'Please enter the Setup PIN';
      statusEl.className = 'text-xs font-mono text-rose-400';
      return;
    }

    statusEl.textContent = 'Verifying and binding device...';
    statusEl.className = 'text-xs font-mono text-indigo-400';

    const result = await registerDeviceClaim(pin);
    if (result.success) {
      statusEl.textContent = result.message;
      statusEl.className = 'text-xs font-mono text-emerald-400';
      setTimeout(() => {
        removeModal();
        onSuccess();
      }, 1000);
    } else {
      statusEl.textContent = result.message;
      statusEl.className = 'text-xs font-mono text-rose-400';
    }
  };

  submitBtn?.addEventListener('click', handleSubmit);
  pinInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });

  pinInput.focus();
}

export function showLockedToast(message: string): void {
  const existing = document.getElementById('device-locked-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'device-locked-toast';
  toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-rose-600/90 text-white text-xs font-mono tracking-wider shadow-2xl z-[100] transition-all backdrop-blur-md border border-rose-400/30';
  toast.textContent = message;
  document.body.appendChild(toast);

  if (window.location.hash === '#admin-login') {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

