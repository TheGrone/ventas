import { Clock, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import type { Profile } from '../types/database';

interface PendingApprovalScreenProps {
  profile: Profile;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function PendingApprovalScreen({
  profile,
  onRefresh,
  onSignOut,
}: PendingApprovalScreenProps) {
  const isSuspended = profile.status === 'suspended';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div
          className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4 ${
            isSuspended
              ? 'bg-red-100 text-red-600'
              : 'bg-amber-100 text-amber-600'
          }`}
        >
          {isSuspended ? (
            <ShieldAlert className="w-7 h-7" />
          ) : (
            <Clock className="w-7 h-7" />
          )}
        </div>

        <h2 className="text-xl font-bold text-slate-900">
          {isSuspended ? 'Cuenta suspendida' : 'Esperando aprobación del administrador'}
        </h2>

        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
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
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
