import { useState, type FormEvent } from 'react';
import { CheckCircle2, KeyRound, Lock } from 'lucide-react';

interface ResetPasswordScreenProps {
  onUpdatePassword: (newPassword: string) => Promise<void>;
  onCancel: () => void;
}

export function ResetPasswordScreen({
  onUpdatePassword,
  onCancel,
}: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las dos contraseñas no coinciden. Escríbelas igual.');
      return;
    }

    setSaving(true);
    try {
      await onUpdatePassword(password);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cambiar la contraseña. Pide un nuevo enlace.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-100 dark:bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md bg-emerald-50/95 dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-slate-800 shadow-xl p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-md">
            {done ? <CheckCircle2 className="w-8 h-8" /> : <KeyRound className="w-8 h-8" />}
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {done ? '¡Contraseña actualizada!' : 'Crear nueva contraseña'}
          </h1>
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
            {done
              ? 'Ya puedes entrar normalmente con tu nueva contraseña.'
              : 'Escribe una contraseña nueva fácil de recordar (mínimo 8 caracteres).'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        {done ? (
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-md"
          >
            Ir a la tienda
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                Nueva contraseña
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

            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                Repite la nueva contraseña
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-emerald-600 dark:text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Escríbela otra vez"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-base shadow-md"
            >
              {saving ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 rounded-2xl border border-emerald-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-emerald-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
