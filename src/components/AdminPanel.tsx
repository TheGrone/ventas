import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  FolderPlus,
  KeyRound,
  Shield,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Category, CondoSettings, Profile } from '../types/database';

interface AdminPanelProps {
  adminId: string;
  categories: Category[];
  onDataChanged: () => Promise<void>;
}

export function AdminPanel({
  adminId,
  categories,
  onDataChanged,
}: AdminPanelProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<CondoSettings | null>(null);
  const [newInviteCode, setNewInviteCode] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    const [{ data: profilesData }, { data: settingsData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('condo_settings').select('*').eq('id', 1).single(),
    ]);

    if (profilesData) setUsers(profilesData as Profile[]);
    if (settingsData) {
      const s = settingsData as CondoSettings;
      setSettings(s);
      setNewInviteCode(s.invite_code);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const logAction = async (
    action: string,
    targetType: string,
    targetId: string,
    details: string
  ) => {
    await supabase.from('moderation_logs').insert({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    });
  };

  const handleUserStatus = async (
    user: Profile,
    status: 'approved' | 'suspended'
  ) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', user.id);

    if (!error) {
      await logAction(
        status === 'approved' ? 'approve_user' : 'suspend_user',
        'profile',
        user.id,
        `${user.full_name} (${user.unit_number})`
      );
      setFeedback(
        status === 'approved'
          ? `Vecino ${user.full_name} aprobado.`
          : `Cuenta de ${user.full_name} suspendida.`
      );
      await loadAdminData();
    }
  };

  const handleSaveInviteCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!newInviteCode.trim() || !settings) return;

    const { error } = await supabase
      .from('condo_settings')
      .update({ invite_code: newInviteCode.trim() })
      .eq('id', 1);

    if (!error) {
      setFeedback('Código de invitación actualizado correctamente.');
      await loadAdminData();
    }
  };

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (trimmed.length < 2) return;

    const { error } = await supabase.from('categories').insert({
      name: trimmed,
      sort_order: categories.length + 1,
    });

    if (!error) {
      setNewCategoryName('');
      setFeedback(`Sección "${trimmed}" agregada.`);
      await onDataChanged();
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', cat.id);

    if (error) {
      setFeedback(
        `No se puede eliminar "${cat.name}" porque tiene productos asociados.`
      );
      return;
    }
    setFeedback(`Sección "${cat.name}" eliminada.`);
    await onDataChanged();
  };

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const activeUsers = users.filter((u) => u.status !== 'pending');

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="rounded-xl bg-emerald-200/70 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 px-4 py-3 text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {feedback}
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Aprobación de vecinos */}
      <section className="bg-emerald-50/90 dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Solicitudes pendientes ({pendingUsers.length})
          </h2>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Cargando vecinos...
          </p>
        ) : pendingUsers.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No hay solicitudes pendientes por aprobar.
          </p>
        ) : (
          <div className="divide-y divide-emerald-200/70 dark:divide-slate-800">
            {pendingUsers.map((u) => (
              <div
                key={u.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    {u.full_name}{' '}
                    <span className="text-emerald-700 dark:text-emerald-400">
                      ({u.unit_number})
                    </span>
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 break-all">
                    {u.email} · WhatsApp: {u.whatsapp}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUserStatus(u, 'approved')}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Aprobar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUserStatus(u, 'suspended')}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900 text-red-700 dark:text-red-300 text-xs font-semibold"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Código de invitación y Secciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-emerald-50/90 dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Código de invitación del condominio
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
            Solo quienes conozcan este código pueden crear una cuenta. Cámbialo si se
            filtra fuera del condominio.
          </p>
          <form onSubmit={handleSaveInviteCode} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              value={newInviteCode}
              onChange={(e) => setNewInviteCode(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white text-sm font-medium"
            >
              Guardar
            </button>
          </form>
        </section>

        <section className="bg-emerald-50/90 dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FolderPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Catálogos / Secciones
            </h2>
          </div>
          <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nueva sección (ej: Mascotas)"
              className="flex-1 px-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
            >
              Agregar
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-slate-800 text-emerald-900 dark:text-slate-200 text-xs font-medium"
              >
                {cat.name}
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat)}
                  title="Eliminar sección"
                  className="text-emerald-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* Lista de vecinos activos / suspendidos */}
      <section className="bg-emerald-50/90 dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">
          Vecinos registrados ({activeUsers.length})
        </h2>
        <div className="divide-y divide-emerald-200/70 dark:divide-slate-800 max-h-80 overflow-y-auto">
          {activeUsers.map((u) => (
            <div
              key={u.id}
              className="py-2.5 flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {u.full_name}
                </span>{' '}
                <span className="text-emerald-800 dark:text-emerald-400 text-xs sm:text-sm">
                  ({u.unit_number})
                </span>
                {u.role === 'admin' && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                    Admin
                  </span>
                )}
                {u.status === 'suspended' && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                    Suspendido
                  </span>
                )}
              </div>
              {u.id !== adminId && (
                <button
                  type="button"
                  onClick={() =>
                    handleUserStatus(
                      u,
                      u.status === 'approved' ? 'suspended' : 'approved'
                    )
                  }
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white underline shrink-0"
                >
                  {u.status === 'approved' ? 'Suspender' : 'Reactivar'}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
