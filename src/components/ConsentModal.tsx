import { useState } from 'react';
import { CheckCircle2, FileCheck2, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { CONDO_NAME } from '../lib/supabase';

interface ConsentModalProps {
  mode: 'read' | 'mandatory';
  onAccept?: () => Promise<void>;
  onDecline?: () => Promise<void>;
  onClose?: () => void;
}

export function ConsentModal({
  mode,
  onAccept,
  onDecline,
  onClose,
}: ConsentModalProps) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!checked || !onAccept) return;
    setError(null);
    setSubmitting(true);
    try {
      await onAccept();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo registrar tu consentimiento. Intenta nuevamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-emerald-50 dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-slate-800 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Encabezado fijo */}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-7 pt-5 sm:pt-6 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                Consentimiento, Privacidad y Normas
              </h2>
              <p className="text-xs text-emerald-800 dark:text-emerald-400 font-medium">
                {CONDO_NAME} · Uso privado entre vecinos
              </p>
            </div>
          </div>
          {mode === 'read' && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-emerald-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Contenido con scroll interno limpio */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-2">
          <div className="space-y-3.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-emerald-100/60 dark:bg-slate-800/70 rounded-2xl p-4 border border-emerald-200 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              1. Consentimiento de datos personales (Ley 19.628 / Ley 21.719)
            </h3>
            <p className="mt-1">
              Al registrarte y aceptar este consentimiento, autorizas de forma libre y
              voluntaria que tu <strong>Nombre y número de WhatsApp</strong> sean visibles{' '}
              <strong>únicamente para otros vecinos aprobados del condominio</strong> con el
              único fin de coordinar compras o ventas. Si decides indicar tu{' '}
              <strong>Torre y Depto</strong> (opcional), ese dato será{' '}
              <strong>privado y visible únicamente para la Administración</strong> — nunca se
              muestra en tus publicaciones. Tus datos jamás se venden ni se entregan a
              terceros externos.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              2. Tus derechos sobre tus datos
            </h3>
            <p className="mt-1">
              En cualquier momento puedes <strong>corregir tus datos</strong> o{' '}
              <strong>revocar tu consentimiento eliminando tu cuenta y todos tus datos</strong>{' '}
              desde el botón <strong>Mi Perfil</strong>.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              3. Tablero vecinal sin intermediación
            </h3>
            <p className="mt-1">
              Esta aplicación es un tablero comunitario gratuito de avisos entre vecinos.
              No procesa pagos, no cobra comisiones y no actúa como intermediario ni
              garante. La calidad, precio, pago y entrega son responsabilidad directa del
              vendedor y comprador.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-amber-100/80 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200">
            <h3 className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              4. Contenido estrictamente prohibido
            </h3>
            <p className="mt-1 text-xs sm:text-sm">
              Está prohibido publicar artículos ilegales o peligrosos: medicamentos con
              receta, drogas, armas, alcohol a menores, productos robados, falsificaciones,
              estafas o contenido ofensivo. La administración puede ocultar o eliminar
              anuncios y suspender cuentas que infrinjan estas normas o el reglamento del
              condominio.
            </p>
          </div>
          </div>
        </div>

        {/* Pie fijo con casilla y botones siempre visibles */}
        <div className="px-5 sm:px-7 pt-3 pb-5 sm:pb-6 border-t border-emerald-200/80 dark:border-slate-800 shrink-0 bg-emerald-50/95 dark:bg-slate-900/95">
          {error && (
            <div className="mb-3 rounded-xl bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 px-3.5 py-2.5 text-sm font-medium">
              {error}
            </div>
          )}

          {mode === 'mandatory' ? (
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-100/90 dark:bg-slate-800 border-2 border-emerald-300 dark:border-emerald-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 shrink-0"
                />
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  He leído y doy mi consentimiento voluntario para mostrar mi Nombre y
                  WhatsApp solo a vecinos verificados del condominio (sin mostrar torre ni
                  depto en publicaciones), y acepto las normas de buen uso.
                </span>
              </label>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  disabled={!checked || submitting}
                  onClick={() => void handleConfirm()}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-base font-extrabold shadow-md transition"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{submitting ? 'Guardando...' : 'Acepto y continuar'}</span>
                </button>

                {onDecline && (
                  <button
                    type="button"
                    onClick={() => void onDecline()}
                    className="px-4 py-3 rounded-2xl border-2 border-emerald-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-emerald-100 dark:hover:bg-slate-800"
                  >
                    No acepto (Salir)
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold shadow-sm"
            >
              Entendido
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
