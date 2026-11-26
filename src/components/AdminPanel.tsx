import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FolderPlus,
  KeyRound,
  Plus,
  Power,
  Shield,
  Sparkles,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Category, InviteCode, Profile } from '../types/database';

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
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [newCode, setNewCode] = useState('');
  const [newCodeLabel, setNewCodeLabel] = useState('');
  const [newCodeMaxUses, setNewCodeMaxUses] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const [{ data: profilesData, error: profErr }, { data: codesData, error: codeErr }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('invite_codes')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

    if (profErr) {
      setErrorMsg(`Error al cargar vecinos: ${profErr.message}`);
    } else if (profilesData) {
      setUsers(profilesData as Profile[]);
    }

    if (codeErr) {
      setErrorMsg(
        `No se pudieron cargar los códigos de invitación (${codeErr.message}). Asegúrate de ejecutar supabase/migration_v2.sql en Supabase.`
      );
    } else if (codesData) {
      setInviteCodes(codesData as InviteCode[]);
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
    setErrorMsg(null);
    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', user.id);

    if (error) {
      setErrorMsg(`No se pudo actualizar el estado: ${error.message}`);
      return;
    }

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
  };

  const handleGenerateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 5; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    setNewCode(`CONDO-${suffix}`);
  };

  const handleAddInviteCode = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);

    const cleanCode = newCode.trim().toUpperCase();
    if (cleanCode.length < 3) {
      setErrorMsg('El código debe tener al menos 3 caracteres.');
      return;
    }

    const parsedMax = newCodeMaxUses.trim()
      ? Number.parseInt(newCodeMaxUses.trim(), 10)
      : null;

    if (parsedMax !== null && (Number.isNaN(parsedMax) || parsedMax < 1)) {
      setErrorMsg('El límite de usos debe ser un número mayor a 0.');
      return;
    }

    const { error } = await supabase.from('invite_codes').insert({
      code: cleanCode,
      label: newCodeLabel.trim(),
      max_uses: parsedMax,
      is_active: true,
      created_by: adminId,
    });

    if (error) {
      setErrorMsg(`No se pudo crear el código: ${error.message}`);
      return;
    }

    setNewCode('');
    setNewCodeLabel('');
    setNewCodeMaxUses('');
    setFeedback(`Código "${cleanCode}" creado correctamente.`);
    await loadAdminData();
  };

  const handleToggleInviteCode = async (item: InviteCode) => {
    setErrorMsg(null);
    const { error } = await supabase
      .from('invite_codes')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);

    if (error) {
      setErrorMsg(`Error al cambiar estado del código: ${error.message}`);
      return;
    }
    setFeedback(
      `Código "${item.code}" ${!item.is_active ? 'activado' : 'desactivado'}.`
    );
    await loadAdminData();
  };

  const handleDeleteInviteCode = async (item: InviteCode) => {
    setErrorMsg(null);
    const { error } = await supabase
      .from('invite_codes')
      .delete()
      .eq('id', item.id);

    if (error) {
      setErrorMsg(`No se pudo eliminar el código: ${error.message}`);
      return;
    }
    setFeedback(`Código "${item.code}" eliminado.`);
    await loadAdminData();
  };

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);

    const trimmed = newCategoryName.trim();
    if (trimmed.length < 2) {
      setErrorMsg('El nombre de la sección debe tener al menos 2 caracteres.');
      return;
    }

    const { error } = await supabase.from('categories').insert({
      name: trimmed,
      sort_order: categories.length + 1,
    });

    if (error) {
      setErrorMsg(`No se pudo agregar la sección: ${error.message}`);
      return;
    }

    setNewCategoryName('');
    setFeedback(`Sección "${trimmed}" agregada.`);
    await onDataChanged();
  };

  const handleDeleteCategory = async (cat: Category) => {
    setErrorMsg(null);
    setFeedback(null);

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', cat.id);

    if (error) {
      setErrorMsg(
        `No se pudo eliminar "${cat.name}": ${
          error.message.includes('foreign key')
            ? 'tiene productos asociados.'
            : error.message
        }`
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
      {errorMsg && (
        <div className="rounded-xl bg-red-100 dark:bg-red-950/70 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 px-4 py-3 text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs underline shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

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

      {/* Códigos de invitación y Secciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-emerald-50/90 dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Códigos de invitación ({inviteCodes.length})
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
            Crea códigos por torre o por vecino y desactívalos o elimínalos si alguien
            hace mal uso.
          </p>

          <form onSubmit={handleAddInviteCode} className="space-y-2.5 mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="Ej: TORRE5-2026"
                className="flex-1 px-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleGenerateCode}
                title="Generar código aleatorio"
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-emerald-300 dark:border-slate-700 bg-emerald-100/70 dark:bg-slate-800 hover:bg-emerald-200/70 dark:hover:bg-slate-700 text-xs font-medium text-emerald-900 dark:text-emerald-300"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={newCodeLabel}
                onChange={(e) => setNewCodeLabel(e.target.value)}
                placeholder="Etiqueta (ej: Torre 5)"
                className="sm:col-span-2 px-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="number"
                min={1}
                value={newCodeMaxUses}
                onChange={(e) => setNewCodeMaxUses(e.target.value)}
                placeholder="Usos máx (opc.)"
                className="px-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Crear código de invitación
            </button>
          </form>

          <div className="divide-y divide-emerald-200/70 dark:divide-slate-800 max-h-60 overflow-y-auto">
            {inviteCodes.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                No hay códigos registrados.
              </p>
            ) : (
              inviteCodes.map((c) => (
                <div
                  key={c.id}
                  className="py-2.5 flex items-center justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-bold text-emerald-900 dark:text-emerald-300 bg-emerald-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-xs">
                        {c.code}
                      </code>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          c.is_active
                            ? 'bg-emerald-200/80 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {c.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                      {c.label ? `${c.label} · ` : ''}Usos: {c.uses_count}
                      {c.max_uses ? ` / ${c.max_uses}` : ' (ilimitado)'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleInviteCode(c)}
                      title={c.is_active ? 'Desactivar código' : 'Activar código'}
                      className="p-1.5 rounded-lg border border-emerald-200 dark:border-slate-700 hover:bg-emerald-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteInviteCode(c)}
                      title="Eliminar código"
                      className="p-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-emerald-50/90 dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FolderPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Catálogos / Secciones ({categories.length})
            </h2>
          </div>
          <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-2 mb-4">
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
            {categories.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No hay secciones todavía. Agrega una arriba o ejecuta{' '}
                <code>supabase/migration_v2.sql</code>.
              </p>
            ) : (
              categories.map((cat) => (
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
              ))
            )}
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
