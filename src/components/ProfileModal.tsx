import { useState, type FormEvent } from 'react';
import { CheckCircle2, Lock, Phone, Trash2, User, X } from 'lucide-react';
import { isValidWhatsApp, normalizeWhatsApp, parseUnitNumber } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

interface ProfileModalProps {
  targetProfile: Profile;
  mode: 'self' | 'admin';
  adminId?: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const TOWERS = Array.from({ length: 11 }, (_, i) => i + 1);
const FLOORS = Array.from({ length: 7 }, (_, i) => i + 1);
const APTS = Array.from({ length: 4 }, (_, i) => i + 1);

export function ProfileModal({
  targetProfile,
  mode,
  adminId,
  onClose,
  onSaved,
}: ProfileModalProps) {
  const initialUnit = parseUnitNumber(targetProfile.unit_number);
  const isAdminAccount =
    targetProfile.role === 'super_admin' ||
    targetProfile.unit_number === 'Administración';

  const [fullName, setFullName] = useState(targetProfile.full_name);
  const [tower, setTower] = useState(initialUnit.tower);
  const [floor, setFloor] = useState(initialUnit.floor);
  const [apt, setApt] = useState(initialUnit.apt);
  const [whatsapp, setWhatsapp] = useState(targetProfile.whatsapp);

  // Cambio opcional de contraseña (solo en modo 'self')
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [deletingOwn, setDeletingOwn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDeleteOwnAccount = async () => {
    setError(null);
    const first = window.confirm(
      '¿Seguro que quieres eliminar tu cuenta y todos tus anuncios? Esta acción borra todos tus datos de forma permanente.'
    );
    if (!first) return;

    setDeletingOwn(true);
    try {
      const { error: delErr } = await supabase.rpc('delete_own_account');
      if (delErr) throw delErr;
      await supabase.auth.signOut();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar tu cuenta. Contacta a soporte.'
      );
      setDeletingOwn(false);
    }
  };

  const formattedUnit = isAdminAccount
    ? 'Administración'
    : `Torre ${tower} - Depto ${floor}0${apt}`;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (fullName.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    if (!isValidWhatsApp(whatsapp)) {
      setError('Ingresa un número de WhatsApp válido (ej: +56912345678).');
      return;
    }
    if (mode === 'self' && newPassword.trim()) {
      if (newPassword.length < 8) {
        setError('La nueva contraseña debe tener al menos 8 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Las dos contraseñas no coinciden.');
        return;
      }
    }

    setSaving(true);
    try {
      const normalizedWa = `+${normalizeWhatsApp(whatsapp)}`;
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          unit_number: formattedUnit,
          whatsapp: normalizedWa,
        })
        .eq('id', targetProfile.id);

      if (updateErr) throw updateErr;

      if (mode === 'admin' && adminId) {
        await supabase.from('moderation_logs').insert({
          admin_id: adminId,
          action: 'edit_user_profile',
          target_type: 'profile',
          target_id: targetProfile.id,
          details: `Actualizado a: ${fullName.trim()} (${formattedUnit}, ${normalizedWa})`,
        });
      }

      if (mode === 'self' && newPassword.trim()) {
        const { error: passErr } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (passErr) throw passErr;
        setNewPassword('');
        setConfirmPassword('');
      }

      await onSaved();
      setSuccess('¡Datos actualizados correctamente!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudieron guardar los cambios.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-emerald-50 dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-slate-800 shadow-xl w-full max-w-lg p-5 sm:p-6 my-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {mode === 'admin' ? 'Editar datos del vecino' : 'Editar mis datos'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Correo: {targetProfile.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-emerald-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-2xl bg-emerald-200/80 dark:bg-emerald-950/70 border border-emerald-400 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200 px-4 py-3 text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
              Nombre y apellido
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-emerald-600 dark:text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                maxLength={80}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {!isAdminAccount && (
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                Torre / Piso / Depto
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
                Ubicación seleccionada: <strong>{formattedUnit}</strong>
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
              WhatsApp
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

          {mode === 'self' && (
            <div className="pt-3 border-t border-emerald-200 dark:border-slate-800 space-y-3">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Cambiar contraseña (opcional)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nueva contraseña"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repetir contraseña"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold shadow-sm"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>

          {mode === 'self' && targetProfile.role !== 'super_admin' && (
            <div className="pt-4 mt-2 border-t border-emerald-200 dark:border-slate-800">
              <button
                type="button"
                disabled={deletingOwn}
                onClick={() => void handleDeleteOwnAccount()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900 text-red-700 dark:text-red-300 text-xs sm:text-sm font-bold transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  {deletingOwn
                    ? 'Eliminando cuenta...'
                    : 'Revocar consentimiento y eliminar mi cuenta'}
                </span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
