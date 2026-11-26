import { useState, type FormEvent } from 'react';
import {
  Building2,
  KeyRound,
  Lock,
  Mail,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  User,
} from 'lucide-react';
import { CONDO_NAME } from '../lib/supabase';
import { isValidWhatsApp, normalizeWhatsApp } from '../lib/format';
import type { Theme } from '../hooks/useTheme';

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
  }) => Promise<void>;
}

const TOWERS = Array.from({ length: 11 }, (_, i) => i + 1);
const FLOORS = Array.from({ length: 7 }, (_, i) => i + 1);
const APTS = Array.from({ length: 4 }, (_, i) => i + 1);

export function AuthScreen({
  theme,
  onToggleTheme,
  onSignIn,
  onSignUp,
}: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [tower, setTower] = useState(1);
  const [floor, setFloor] = useState(1);
  const [apt, setApt] = useState(1);
  const [whatsapp, setWhatsapp] = useState('+569');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const formattedUnit = `Torre ${tower} - Depto ${floor}0${apt}`;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

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
        });
        setSuccessMsg(
          'Registro enviado. Si tu proyecto requiere confirmar correo, revisa tu bandeja; luego el administrador aprobará tu acceso.'
        );
        setMode('login');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
      if (msg.includes('Código de invitación')) {
        setError('El código de invitación del condominio es incorrecto.');
      } else if (msg.includes('Invalid login credentials')) {
        setError('Correo o contraseña incorrectos.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-emerald-100 via-emerald-50 to-teal-100 dark:from-slate-950 dark:via-emerald-950/40 dark:to-slate-900 px-4 py-8 relative">
      <button
        type="button"
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        className="fixed top-4 right-4 p-2.5 rounded-xl bg-emerald-50/90 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-emerald-800 dark:text-emerald-300 shadow-sm hover:bg-emerald-100 dark:hover:bg-slate-700 transition"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-md bg-emerald-50/90 dark:bg-slate-900/95 backdrop-blur rounded-2xl shadow-lg border border-emerald-200 dark:border-slate-800 p-5 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-sm">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {CONDO_NAME}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-800/80 dark:text-slate-400 mt-1">
            Mercado privado exclusivo para vecinos verificados
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-emerald-100/90 dark:bg-slate-800 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 text-sm font-medium rounded-lg transition ${
              mode === 'login'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-900/75 dark:text-slate-300 hover:text-emerald-950 dark:hover:text-white'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 text-sm font-medium rounded-lg transition ${
              mode === 'register'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-900/75 dark:text-slate-300 hover:text-emerald-950 dark:hover:text-white'
            }`}
          >
            Registrarme
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-100/90 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 px-4 py-3 text-sm">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                  Nombre y apellido
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-emerald-600 dark:text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej: María González"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                  Torre / Piso / Depto
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={tower}
                    onChange={(e) => setTower(Number(e.target.value))}
                    aria-label="Torre"
                    className="px-2.5 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="px-2.5 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="px-2.5 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {APTS.map((a) => (
                      <option key={a} value={a}>
                        Depto {floor}0{a}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                  Se registrará como: <strong>{formattedUnit}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                  WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-emerald-600 dark:text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+56912345678"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                  Código de invitación del condominio
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-emerald-600 dark:text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Solicítalo a la administración"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-emerald-600 dark:text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vecino@correo.cl"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm transition shadow-sm"
          >
            {submitting
              ? 'Procesando...'
              : mode === 'login'
                ? 'Entrar al mercado'
                : 'Crear cuenta de vecino'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-emerald-200/70 dark:border-slate-800 flex items-start gap-2.5 text-xs text-emerald-900/75 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p>
            Protegido contra suplantación: cada cuenta requiere código del condominio y
            aprobación del administrador antes de ver o publicar productos.
          </p>
        </div>
      </div>
    </div>
  );
}
