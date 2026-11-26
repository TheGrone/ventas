import { Clock, LogOut, Moon, RefreshCw, ShieldAlert, Sun } from 'lucide-react';
import type { Profile } from '../types/database';
import type { Theme } from '../hooks/useTheme';

interface PendingApprovalScreenProps {
  profile: Profile;
  theme: Theme;
  onToggleTheme: () => void;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function PendingApprovalScreen({
  profile,
  theme,
  onToggleTheme,
  onRefresh,
  onSignOut,
}: PendingApprovalScreenProps) {
  const isSuspended = profile.status === 'suspended';

  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-100 dark:bg-slate-950 px-4 relative">
      <button
        type="button"
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        className="fixed top-4 right-4 p-2.5 rounded-xl bg-emerald-50/90 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-emerald-800 dark:text-emerald-300 shadow-sm transition"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="max-w-md w-full bg-emerald-50/95 dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 text-center">
        <div
          className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4 ${
            isSuspended
              ? 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'
              : 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
          }`}
        >
          {isSuspended ? (
            <ShieldAlert className="w-7 h-7" />
          ) : (
            <Clock className="w-7 h-7" />
          )}
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {isSuspended ? 'Cuenta suspendida' : 'Esperando aprobación del administrador'}
        </h2>

        <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
          {isSuspended
            ? `Tu acceso al mercado del condominio fue suspendido temporalmente. Si crees que es un error, contacta a la administración.`
            : `Hola ${profile.full_name} (${profile.unit_number}). Para evitar suplantación de identidad, el administrador debe confirmar tu cuenta antes de que puedas ver o publicar anuncios.`}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          {!isSuspended && (
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition"
            >
              <RefreshCw className="w-4 h-4" />
              Verificar estado
            </button>
          )}
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-slate-700 hover:bg-emerald-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium transition"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
