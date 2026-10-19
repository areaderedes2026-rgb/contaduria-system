import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { login as loginApi } from '@/services/auth.service';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ApiClientError } from '@/services/api';
import { consumeAuthLoginMessage, resetLogoutRedirectLock } from '@/lib/session';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [sessionMsg, setSessionMsg] = useState<string | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const mutation = useMutation({
    mutationFn: () => loginApi(username.trim(), password),
    onSuccess: (data) => {
      resetLogoutRedirectLock();
      setSessionMsg(null);
      setAuth(data.token, data.user);
      navigate('/');
    },
  });

  const { isError, isPending, error, reset } = mutation;

  useEffect(() => {
    usernameRef.current?.focus();
    resetLogoutRedirectLock();
  }, []);

  useEffect(() => {
    const fromStorage = consumeAuthLoginMessage();
    const fromQuery = searchParams.get('reason');
    if (fromStorage === 'expired' || fromQuery === 'expired' || fromQuery === 'unauthorized') {
      setSessionMsg('Su sesión expiró o ya no es válida. Inicie sesión nuevamente.');
      if (fromQuery) {
        const next = new URLSearchParams(searchParams);
        next.delete('reason');
        setSearchParams(next, { replace: true });
      }
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const response = await fetch(`${API_URL}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!cancelled) {
          if (!response.ok) {
            setServerStatus('offline');
            return;
          }
          const data = await response.json().catch(() => null);
          setServerStatus(data?.database === 'connected' ? 'online' : 'offline');
        }
      } catch {
        if (!cancelled) setServerStatus('offline');
      }
    }

    checkHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    reset();
  }, [username, password, reset]);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate();
  };

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <div className="flex flex-col items-center justify-center bg-primary-950 px-6 py-10 text-center lg:w-[42%] lg:px-12 lg:py-0 lg:text-left">
        <div className="max-w-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600 lg:mx-0">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
            Contaduría Municipal
          </h1>
          <p className="mt-2 text-primary-200">Municipalidad de Trancas</p>
          <p className="mt-6 hidden text-sm leading-relaxed text-primary-300 lg:block">
            Sistema de gestión contable para el personal autorizado del Departamento de Contaduría.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-slate-800">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ingrese sus credenciales para acceder al sistema
            </p>
          </div>

          {serverStatus === 'checking' && (
            <div className="mb-5">
              <Alert type="info">Comprobando conexión con el servidor…</Alert>
            </div>
          )}

          {serverStatus === 'offline' && (
            <div className="mb-5">
              <Alert type="error">
                El servidor no está disponible. Inicie Docker Desktop, luego ejecute{' '}
                <code className="rounded bg-red-100 px-1 py-0.5 text-xs">npm run db:up</code> y{' '}
                <code className="rounded bg-red-100 px-1 py-0.5 text-xs">npm run dev</code> desde la
                raíz del proyecto.
              </Alert>
            </div>
          )}

          {sessionMsg && (
            <div className="mb-5">
              <Alert type="warning">{sessionMsg}</Alert>
            </div>
          )}

          {isError && (
            <div className="mb-5">
              <Alert type="error">
                {error instanceof ApiClientError
                  ? error.message
                  : 'Usuario o contraseña incorrectos'}
              </Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              ref={usernameRef}
              label="Usuario"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Su nombre de usuario"
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
              className="py-2.5"
            />

            <PasswordInput
              label="Contraseña"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Su contraseña"
              autoComplete="current-password"
              required
            />

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={isPending}
              disabled={!canSubmit || serverStatus === 'offline'}
            >
              Ingresar
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400 lg:text-left">
            Uso exclusivo del personal autorizado
          </p>
        </div>
      </div>
    </div>
  );
}
