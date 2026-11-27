import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  KeyRound,
  Lock,
  Mail,
  Moon,
  Phone,
  ShieldCheck,
  Store,
  Sun,
  User,
} from 'lucide-react';
import { CONDO_NAME } from '../lib/supabase';
import { isValidWhatsApp, normalizeWhatsApp } from '../lib/format';
import type { Theme } from '../hooks/useTheme';
import { ConsentModal } from './ConsentModal';

interface AuthScreenProps {
  theme: Theme;
  onToggleTheme: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (params: {
    email: string;
    password: string;
    fullName: string;
    unitNumber: string;
    whatsapp: string;
    inviteCode: string;
    termsAccepted: boolean;
  }) => Promise<void>;
  onRequestPasswordReset: (email: string) => Promise<void>;
}

const TOWERS = Array.from({ length: 11 }, (_, i) => i + 1);
const FLOORS = Array.from({ length: 7 }, (_, i) => i + 1);
const APTS = Array.from({ length: 4 }, (_, i) => i + 1);

export function AuthScreen({
  theme,
  onToggleTheme,
  onSignIn,
  onSignUp,
  onRequestPasswordReset,
}: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [tower, setTower] = useState(1);
  const [floor, setFloor] = useState(1);
  const [apt, setApt] = useState(1);
  const [whatsapp, setWhatsapp] = useState('+569');
  const [inviteCode, setInviteCode] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const formattedUnit = `Torre ${tower} - Depto ${floor}0${apt}`;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Escribe tu correo electrónico para recuperar tu contraseña.');
        return;
      }
      setSubmitting(true);
      try {
        await onRequestPasswordReset(email.trim());
        setSuccessMsg(
          'Te enviamos un enlace seguro a tu correo para crear una nueva contraseña. Revisa también tu carpeta de Spam.'
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo enviar el correo de recuperación. Intenta en unos minutos.'
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'register') {
      if (fullName.trim().length < 2) {
        setError('Ingresa tu nombre completo.');
        return;
      }
      if (!isValidWhatsApp(whatsapp)) {
        setError('Ingresa un número de WhatsApp válido (ej: +56912345678).');
        return;
      }
      if (!inviteCode.trim()) {
        setError('Debes ingresar el código de invitación del condominio.');
        return;
      }
      if (password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres.');
        return;
      }
      if (!termsAccepted) {
        setError(
          'Debes marcar la casilla de consentimiento de privacidad y normas del condominio para registrarte.'
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await onSignIn(email.trim(), password);
      } else {
        await onSignUp({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          unitNumber: formattedUnit,
          whatsapp: `+${normalizeWhatsApp(whatsapp)}`,
          inviteCode: inviteCode.trim(),
          termsAccepted,
        });
        setSuccessMsg(
          '¡Tu cuenta de vecino fue creada! Ya puedes iniciar sesión y el administrador aprobará tu acceso.'
        );
        setMode('login');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
      if (msg.includes('Código de invitación') || msg.includes('límite de usos')) {
        setError(msg);
      } else if (msg.includes('Invalid login credentials')) {
        setError('Correo o contraseña incorrectos. Revisa tus datos e intenta de nuevo.');
      } else if (msg.includes('User already registered')) {
        setError('Este correo ya está registrado. Cambia a "Entrar".');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-emerald-100 via-emerald-50 to-teal-100 dark:from-slate-950 dark:via-emerald-950/40 dark:to-slate-900 px-4 py-12 relative">
      <button
        type="button"
        onClick={onToggleTheme}
        className="fixed top-4 right-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/95 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-emerald-900 dark:text-emerald-300 text-xs font-bold shadow-sm hover:bg-emerald-100 dark:hover:bg-slate-700 transition"
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

      <div className="w-full max-w-md bg-emerald-50/95 dark:bg-slate-900/95 backdrop-blur rounded-3xl shadow-xl border-2 border-emerald-200 dark:border-slate-800 p-5 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center mb-3 shadow-md ring-4 ring-emerald-200 dark:ring-emerald-900/60">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {CONDO_NAME}
          </h1>
          <p className="text-sm sm:text-base text-emerald-900/80 dark:text-slate-300 mt-1 font-medium">
            {mode === 'forgot'
              ? 'Recuperar mi contraseña'
              : 'Tienda privada entre vecinos'}
          </p>
        </div>

        {mode !== 'forgot' ? (
          <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-emerald-100 dark:bg-slate-800 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`py-2.5 text-sm sm:text-base font-bold rounded-xl transition ${
                mode === 'login'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-950/75 dark:text-slate-300 hover:text-emerald-950 dark:hover:text-white'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`py-2.5 text-sm sm:text-base font-bold rounded-xl transition ${
                mode === 'register'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-950/75 dark:text-slate-300 hover:text-emerald-950 dark:hover:text-white'
              }`}
            >
              Soy nuevo
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setSuccessMsg(null);
            }}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-800 dark:text-emerald-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a iniciar sesión
          </button>
        )}

        {error && (
          <div className="mb-4 rounded-2xl bg-red-100/90 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 px-4 py-3 text-sm font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Nombre y apellido
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-emerald-600 dark:text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej: María González"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                  ¿En qué Torre y Depto vives?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={tower}
                    onChange={(e) => setTower(Number(e.target.value))}
                    aria-label="Torre"
                    className="px-2 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {TOWERS.map((t) => (
                      <option key={t} value={t}>
                        Torre {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={floor}
                    onChange={(e) => setFloor(Number(e.target.value))}
                    aria-label="Piso"
                    className="px-2 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {FLOORS.map((f) => (
                      <option key={f} value={f}>
                        Piso {f}
                      </option>
                    ))}
                  </select>
                  <select
                    value={apt}
                    onChange={(e) => setApt(Number(e.target.value))}
                    aria-label="Departamento"
                    className="px-2 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {APTS.map((a) => (
                      <option key={a} value={a}>
                        Depto {floor}0{a}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-400 mt-1">
                  Quedarás registrado como: <strong>{formattedUnit}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Tu número de WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 text-emerald-600 dark:text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+56912345678"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Código del condominio
                </label>
                <div className="relative">
                  <KeyRound className="w-5 h-5 text-emerald-600 dark:text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Pídelo al administrador"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-emerald-600 dark:text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vecino@correo.cl"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-emerald-600 dark:text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="p-3.5 rounded-2xl bg-emerald-100/80 dark:bg-slate-800/90 border border-emerald-300 dark:border-slate-700 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 shrink-0"
                />
                <span className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
                  Doy mi consentimiento para compartir mi Nombre, Torre/Depto y WhatsApp
                  solo con vecinos verificados del condominio y acepto las normas de buen
                  uso.
                </span>
              </label>
              <button
                type="button"
                onClick={() => setShowConsentModal(true)}
                className="text-xs font-bold text-emerald-800 dark:text-emerald-400 underline pl-7"
              >
                Leer Consentimiento, Privacidad y Normas completas
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-base transition shadow-md"
          >
            {submitting
              ? 'Procesando...'
              : mode === 'login'
                ? 'Entrar a la tienda'
                : mode === 'forgot'
                  ? 'Enviar enlace para recuperar contraseña'
                  : 'Crear mi cuenta de vecino'}
          </button>

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError(null);
                setSuccessMsg(null);
              }}
              className="w-full text-center text-sm font-bold text-emerald-800 dark:text-emerald-400 hover:underline pt-1"
            >
              ¿Olvidaste tu contraseña? Recuperar aquí
            </button>
          )}
        </form>

        <div className="mt-6 pt-4 border-t border-emerald-200/80 dark:border-slate-800 flex items-start gap-2.5 text-xs sm:text-sm text-emerald-950/80 dark:text-slate-300">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p>
            Sitio seguro solo para vecinos del condominio.{' '}
            <button
              type="button"
              onClick={() => setShowConsentModal(true)}
              className="font-bold text-emerald-800 dark:text-emerald-400 underline"
            >
              Ver Privacidad y Normas
            </button>
            .
          </p>
        </div>
      </div>

      {showConsentModal && (
        <ConsentModal mode="read" onClose={() => setShowConsentModal(false)} />
      )}
    </div>
  );
}
