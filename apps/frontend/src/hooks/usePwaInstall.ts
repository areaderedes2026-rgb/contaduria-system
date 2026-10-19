import { useSyncExternalStore } from 'react';
import {
  dismissPwaInstall,
  getPwaInstallSnapshot,
  promptPwaInstall,
  subscribePwaInstall,
} from '@/lib/pwaInstall';

export function usePwaInstall() {
  const state = useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallSnapshot,
    getPwaInstallSnapshot
  );

  return {
    ...state,
    install: promptPwaInstall,
    dismiss: dismissPwaInstall,
  };
}
