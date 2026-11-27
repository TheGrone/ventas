import { useEffect, useState } from 'react';
import { HelpCircle, MessageCircle, X } from 'lucide-react';
import { buildSupportWhatsAppUrl } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { Profile, SupportContact } from '../types/database';

interface SupportModalProps {
  currentUser: Profile;
  onClose: () => void;
}

export function SupportModal({ currentUser, onClose }: SupportModalProps) {
  const [contacts, setContacts] = useState<SupportContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.rpc('get_support_contacts').then(({ data }) => {
      if (active && Array.isArray(data)) {
        setContacts(data as SupportContact[]);
      }
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-emerald-50 dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-slate-800 shadow-xl w-full max-w-md p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Ayuda y Soporte del Condominio
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-emerald-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
          ¿Tienes algún problema con un anuncio, tu cuenta o necesitas ayuda? Escribe por
          WhatsApp a cualquiera de nuestros contactos de soporte:
        </p>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
            Cargando contactos de soporte...
          </p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400 py-4 text-center">
            Aún no hay números de soporte configurados por la administración.
          </p>
        ) : (
          <div className="space-y-2.5">
            {contacts.map((c, idx) => (
              <a
                key={`${c.whatsapp}-${idx}`}
                href={buildSupportWhatsAppUrl(
                  c.whatsapp,
                  c.label || 'Soporte',
                  currentUser.full_name,
                  currentUser.unit_number
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
              >
                <div className="min-w-0 text-left">
                  <p className="font-bold text-base truncate">
                    {c.label || `Soporte ${idx + 1}`}
                  </p>
                  <p className="text-xs text-emerald-100">{c.whatsapp}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 text-xs font-bold shrink-0">
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </span>
              </a>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-2xl border border-emerald-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-emerald-100 dark:hover:bg-slate-800"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
