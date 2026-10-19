import { isStandaloneDisplay } from '@/lib/displayMode';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Listener = () => void;

export interface PwaInstallSnapshot {
  canInstall: boolean;
  showIosBanner: boolean;
  /** Listo para mostrar UI (tras engagement mínimo). */
  readyToPrompt: boolean;
  visible: boolean;
  installed: boolean;
  dismissed: boolean;
  installing: boolean;
}

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_DAYS = 21;
/** Espera breve para no interrumpir el login ni la primera pantalla. */
const ENGAGEMENT_MS = 2800;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
let dismissed = false;
let iosHint = false;
let readyToPrompt = false;
let installing = false;
let bootstrapped = false;
let engagementTimer: number | null = null;

let snapshot: PwaInstallSnapshot = {
  canInstall: false,
  showIosBanner: false,
  readyToPrompt: false,
  visible: false,
  installed: false,
  dismissed: false,
  installing: false,
};

const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

function rebuildSnapshot() {
  const canInstall = Boolean(deferredPrompt) && !installed;
  const showIosBanner = iosHint && !installed && !deferredPrompt;
  const next: PwaInstallSnapshot = {
    canInstall,
    showIosBanner,
    readyToPrompt,
    visible: readyToPrompt && (canInstall || showIosBanner) && !dismissed && !installing,
    installed,
    dismissed,
    installing,
  };

  if (
    next.canInstall === snapshot.canInstall &&
    next.showIosBanner === snapshot.showIosBanner &&
    next.readyToPrompt === snapshot.readyToPrompt &&
    next.visible === snapshot.visible &&
    next.installed === snapshot.installed &&
    next.dismissed === snapshot.dismissed &&
    next.installing === snapshot.installing
  ) {
    return;
  }

  snapshot = next;
  emit();
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function scheduleEngagement() {
  if (engagementTimer !== null || readyToPrompt || installed) return;
  engagementTimer = window.setTimeout(() => {
    engagementTimer = null;
    readyToPrompt = true;
    rebuildSnapshot();
  }, ENGAGEMENT_MS);
}

/** Inicializa listeners globales una sola vez (sirve a banner + header). */
export function bootstrapPwaInstall() {
  if (bootstrapped || typeof window === 'undefined') return;
  bootstrapped = true;

  installed = isStandaloneDisplay();
  dismissed = wasDismissedRecently();
  iosHint = isIosDevice() && !installed;
  rebuildSnapshot();

  if (!installed) {
    scheduleEngagement();
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    rebuildSnapshot();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    iosHint = false;
    installing = false;
    rebuildSnapshot();
  });
}

export function subscribePwaInstall(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPwaInstallSnapshot(): PwaInstallSnapshot {
  return snapshot;
}

export async function promptPwaInstall(): Promise<boolean> {
  if (!deferredPrompt || installing) return false;
  installing = true;
  rebuildSnapshot();
  try {
    const promptEvent = deferredPrompt;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    deferredPrompt = null;
    if (outcome === 'accepted') {
      installed = true;
    }
    return outcome === 'accepted';
  } catch {
    return false;
  } finally {
    installing = false;
    rebuildSnapshot();
  }
}

export function dismissPwaInstall() {
  dismissed = true;
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  rebuildSnapshot();
}
