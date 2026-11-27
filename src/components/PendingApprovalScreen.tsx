import { useEffect, useState } from 'react';
import {
  Clock,
  LogOut,
  MessageCircle,
  Moon,
  Pencil,
  RefreshCw,
  ShieldAlert,
  Sun,
} from 'lucide-react';
import { buildAdminApprovalWhatsAppUrl } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { Profile, SupportContact } from '../types/database';
import type { Theme } from '../hooks/useTheme';
import { ProfileModal } from './ProfileModal';

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
  const [supportContacts, setSupportContacts] = useState<SupportContact[]>([]);
  const [checking, setChecking] = useState(false);
  const [editingSelf, setEditingSelf] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.rpc('get_support_contacts').then(async ({ data, error }) => {
      if (!active) return;
      if (!error && Array.isArray(data) && data.length > 0) {
        setSupportContacts(data as SupportContact[]);
        return;
      }
      // Respaldo si aún no se ejecuta get_support_contacts()
      const { data: singlePhone } = await supabase.rpc('get_admin_whatsapp');
      if (active && typeof singlePhone === 'string' && singlePhone.trim()) {
        setSupportContacts([{ label: 'Administrador', whatsapp: singlePhone }]);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleRefresh = async () => {
    setChecking(true);
    await onRefresh();
    setChecking(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-100 dark:bg-slate-950 px-4 py-8 relative">
      <button
        type="button"
        onClick={onToggleTheme}
        className="fixed top-4 right-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/90 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-emerald-900 dark:text-emerald-300 text-xs font-bold shadow-sm transition"
      >
        {theme === 'dark' ? (
          <>
            <Sun className="w-4 h-4" />
            <span>Modo claro</span>
          </>
        ) : (
          <>
            <Moon className="w-4 h-4" />
            <span>Modo oscuro</span>
          </>
        )}
      </button>

      <div className="max-w-md w-full bg-emerald-50/95 dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-slate-800 shadow-lg p-6 sm:p-8 text-center">
        <div
          className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-sm ${
            isSuspended
              ? 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'
              : 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
          }`}
        >
          {isSuspended ? (
            <ShieldAlert className="w-9 h-9" />
          ) : (
            <Clock className="w-9 h-9" />
          )}
        </div>

        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          {isSuspended
            ? 'Cuenta suspendida'
            : '¡Registro recibido! Falta solo un paso'}
        </h2>

        <p className="text-base text-slate-700 dark:text-slate-300 mt-3 leading-relaxed">
          {isSuspended
            ? 'Tu acceso al mercado del condominio fue suspendido temporalmente. Si crees que es un error, escríbele a soporte.'
            : `Hola ${profile.full_name} (${profile.unit_number}). Para cuidar la seguridad de todos los vecinos, la administración debe aprobar tu ingreso.`}
        </p>

        {supportContacts.length > 0 && (
          <div className="mt-5 p-4 rounded-2xl bg-emerald-100/90 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 space-y-2.5">
            <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">
              {isSuspended
                ? 'Contacta a soporte por WhatsApp:'
                : 'Presiona un botón verde para avisar por WhatsApp que ya te registraste:'}
            </p>
            {supportContacts.map((c, idx) => (
              <a
                key={`${c.whatsapp}-${idx}`}
                href={buildAdminApprovalWhatsAppUrl(
                  c.whatsapp,
                  profile.full_name,
                  profile.unit_number,
                  profile.whatsapp
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold shadow-md transition"
              >
                <MessageCircle className="w-5 h-5 shrink-0" />
                <span>Avisar a {c.label || `Soporte ${idx + 1}`}</span>
              </a>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {!isSuspended && (
            <>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={checking}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white text-base font-bold transition"
              >
                <RefreshCw className={`w-5 h-5 ${checking ? 'animate-spin' : ''}`} />
                <span>{checking ? 'Revisando...' : 'Ya me aprobaron — Entrar'}</span>
              </button>

              <button
                type="button"
                onClick={() => setEditingSelf(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-emerald-300 dark:border-slate-700 hover:bg-emerald-100 dark:hover:bg-slate-800 text-emerald-900 dark:text-emerald-300 text-sm font-bold transition"
              >
                <Pencil className="w-4 h-4" />
                <span>¿Te equivocaste en tu nombre o depto? Corregir datos</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => void onSignOut()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-emerald-300 dark:border-slate-700 hover:bg-emerald-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-base font-semibold transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>

      {editingSelf && (
        <ProfileModal
          targetProfile={profile}
          mode="self"
          onClose={() => setEditingSelf(false)}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}
