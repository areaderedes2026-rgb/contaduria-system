import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { AUTH_REQUIRED_EVENT } from '@/lib/session';

interface AuthState {
  token: string | null;
  user: User | null;
  /** true cuando zustand ya rehidrató localStorage */
  hasHydrated: boolean;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      hasHydrated: false,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      hasPermission: (permission) => {
        const { user } = get();
        return user?.permisos?.includes(permission) ?? false;
      },
    }),
    {
      name: 'contaduria-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state, _error) => {
        state?.setHasHydrated(true);
        // Por si el merge no expone el método en `state`
        useAuthStore.setState({ hasHydrated: true });
      },
    }
  )
);

// Por si la rehidratación ya terminó antes de registrar el listener
if (useAuthStore.persist.hasHydrated()) {
  useAuthStore.setState({ hasHydrated: true });
}
useAuthStore.persist.onFinishHydration(() => {
  useAuthStore.setState({ hasHydrated: true });
});

if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_REQUIRED_EVENT, () => {
    useAuthStore.getState().logout();
  });
}
