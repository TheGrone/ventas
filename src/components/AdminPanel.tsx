import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  DoorOpen,
  FolderPlus,
  KeyRound,
  Lock,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Power,
  Shield,
  Sparkles,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { isValidWhatsApp, normalizeWhatsApp } from '../lib/format';
import { supabase } from '../lib/supabase';
import type {
  Category,
  CondoSettings,
  InviteCode,
  Profile,
  UserRole,
} from '../types/database';
import { ProfileModal } from './ProfileModal';

interface AdminPanelProps {
  adminId: string;
  adminRole: UserRole;
  categories: Category[];
  onDataChanged: () => Promise<void>;
}

export function AdminPanel({
  adminId,
  adminRole,
  categories,
  onDataChanged,
}: AdminPanelProps) {
  const isSuperAdmin = adminRole === 'super_admin';
  const [users, setUsers] = useState<Profile[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [adminWhatsapp, setAdminWhatsapp] = useState('');
  const [openAccessUntil, setOpenAccessUntil] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newCodeLabel, setNewCodeLabel] = useState('');
  const [newCodeMaxUses, setNewCodeMaxUses] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const [
      { data: profilesData, error: profErr },
      { data: codesData, error: codeErr },
      { data: settingsData },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('invite_codes')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('condo_settings').select('*').eq('id', 1).single(),
    ]);

    if (profErr) {
      setErrorMsg(`Error al cargar vecinos: ${profErr.message}`);
    } else if (profilesData) {
      setUsers(profilesData as Profile[]);
    }

    if (codeErr) {
      setErrorMsg(
        `No se pudieron cargar los códigos de invitación (${codeErr.message}). Ejecuta supabase/fix_permissions.sql en Supabase.`
      );
    } else if (codesData) {
      setInviteCodes(codesData as InviteCode[]);
    }

    if (settingsData) {
      const s = settingsData as CondoSettings;
      setAdminWhatsapp(s.admin_whatsapp ?? '');
      setOpenAccessUntil(s.open_access_until ?? null);
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
    await Promise.all([loadAdminData(), onDataChanged()]);
  };

  const handleDeleteUser = async (user: Profile) => {
    setErrorMsg(null);
    setFeedback(null);

    const confirmed = window.confirm(
      `¿Eliminar permanentemente la cuenta de "${user.full_name}" (${user.unit_number}) y todos sus anuncios? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    const { error } = await supabase.rpc('admin_delete_user', {
      target_user_id: user.id,
    });

    if (error) {
      setErrorMsg(
        `No se pudo eliminar la cuenta (${error.message}). Asegúrate de ejecutar supabase/fix_permissions.sql en Supabase.`
      );
      return;
    }

    setFeedback(`Cuenta de ${user.full_name} eliminada permanentemente.`);
    await Promise.all([loadAdminData(), onDataChanged()]);
  };

  const handleSaveAdminWhatsapp = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);

    const trimmed = adminWhatsapp.trim();
    if (trimmed && !isValidWhatsApp(trimmed)) {
      setErrorMsg('Ingresa un número de WhatsApp válido (ej: +56912345678).');
      return;
    }

    const formatted = trimmed ? `+${normalizeWhatsApp(trimmed)}` : '';
    const { error } = await supabase
      .from('condo_settings')
      .update({ admin_whatsapp: formatted })
      .eq('id', 1);

    if (error) {
      setErrorMsg(`No se pudo guardar el WhatsApp del administrador: ${error.message}`);
      return;
    }

    setAdminWhatsapp(formatted);
    setFeedback('WhatsApp del administrador guardado. Los nuevos vecinos te avisarán ahí.');
  };

  const isOpenAccessActive = Boolean(
    openAccessUntil && new Date(openAccessUntil).getTime() > Date.now()
  );

  const handleSetOpenAccess = async (mode: 'today' | '24h' | 'off') => {
    setErrorMsg(null);
    setFeedback(null);

    let nextUntil: string | null = null;
    if (mode === 'today') {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      nextUntil = endOfToday.toISOString();
    } else if (mode === '24h') {
      nextUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    const { error } = await supabase
      .from('condo_settings')
      .update({ open_access_until: nextUntil })
      .eq('id', 1);

    if (error) {
      setErrorMsg(
        `No se pudo cambiar el Acceso Libre (${error.message}). Ejecuta supabase/fix_permissions.sql en Supabase.`
      );
      return;
    }

    setOpenAccessUntil(nextUntil);
    setFeedback(
      mode === 'off'
        ? 'Acceso libre desactivado. Ahora todos los nuevos vecinos requieren tu aprobación.'
        : mode === 'today'
          ? 'Acceso libre activado por el resto del día (hasta las 23:59). Aún requiere código del condominio.'
          : 'Acceso libre activado por 24 horas. Aún requiere código del condominio.'
    );
  };

  const handleApproveAllPending = async () => {
    setErrorMsg(null);
    setFeedback(null);
    if (pendingUsers.length === 0) return;

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'approved' })
      .eq('status', 'pending');

    if (error) {
      setErrorMsg(`No se pudieron aprobar los pendientes: ${error.message}`);
      return;
    }

    setFeedback(`Se aprobaron ${pendingUsers.length} vecino(s) pendiente(s).`);
    await Promise.all([loadAdminData(), onDataChanged()]);
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
        <div className="rounded-2xl bg-red-100 dark:bg-red-950/70 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 px-4 py-3 text-sm flex items-center justify-between gap-2">
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
        <div className="rounded-2xl bg-emerald-200/70 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 px-4 py-3 text-sm flex items-center justify-between gap-2">
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

      {/* Modo Acceso Libre por el día */}
      <section
        className={`rounded-3xl border-2 p-4 sm:p-5 shadow-sm transition ${
          isOpenAccessActive
            ? 'bg-emerald-100/90 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700'
            : 'bg-emerald-50/95 dark:bg-slate-900 border-emerald-200 dark:border-slate-800'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {isOpenAccessActive ? (
              <DoorOpen className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            ) : (
              <Lock className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            )}
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Modo Acceso Libre (sin esperar tu aprobación)
            </h2>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-extrabold ${
              isOpenAccessActive
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {isOpenAccessActive ? 'ABIERTO AHORA' : 'CON APROBACIÓN MANUAL'}
          </span>
        </div>

        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mb-3">
          {isOpenAccessActive && openAccessUntil
            ? `Activo hasta el ${new Date(openAccessUntil).toLocaleString('es-CL', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}. Quienes tengan el código del condominio entran automáticamente y luego vuelve a cerrarse solo.`
            : 'Si hoy no puedes estar pendiente para aprobar vecinos, actívalo por el día. Igual seguirá pidiendo el código del condominio para evitar personas externas.'}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSetOpenAccess('today')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs"
          >
            <DoorOpen className="w-4 h-4" />
            Abrir solo por hoy (hasta 23:59)
          </button>

          <button
            type="button"
            onClick={() => handleSetOpenAccess('24h')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-200/70 dark:hover:bg-slate-700 text-emerald-900 dark:text-emerald-300 text-xs sm:text-sm font-bold"
          >
            Abrir por 24 horas
          </button>

          {isOpenAccessActive && (
            <button
              type="button"
              onClick={() => handleSetOpenAccess('off')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold"
            >
              <Lock className="w-4 h-4" />
              Cerrar y pedir aprobación
            </button>
          )}
        </div>
      </section>

      {/* Aprobación de vecinos */}
      <section className="bg-emerald-50/95 dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Solicitudes pendientes ({pendingUsers.length})
            </h2>
          </div>

          {pendingUsers.length > 1 && (
            <button
              type="button"
              onClick={handleApproveAllPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              <UserCheck className="w-4 h-4" />
              Aprobar todos ({pendingUsers.length})
            </button>
          )}
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
            {pendingUsers.map((u) => {
              const verifyWa = `https://wa.me/${normalizeWhatsApp(
                u.whatsapp
              )}?text=${encodeURIComponent(
                `Hola ${u.full_name}, te escribe el Administrador del Mercado del Condominio para confirmar tu registro en ${u.unit_number}.`
              )}`;
              return (
                <div
                  key={u.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-base">
                      {u.full_name}{' '}
                      <span className="text-emerald-700 dark:text-emerald-400">
                        ({u.unit_number})
                      </span>
                    </p>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-all">
                      {u.email} · WhatsApp: {u.whatsapp}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => setEditingUser(u)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 dark:border-slate-700 bg-emerald-100/70 dark:bg-slate-800 hover:bg-emerald-200/70 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Corregir datos
                      </button>
                    )}
                    <a
                      href={verifyWa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-300 text-xs font-bold"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Verificar WSP
                    </a>
                    <button
                      type="button"
                      onClick={() => handleUserStatus(u, 'approved')}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                    >
                      <UserCheck className="w-4 h-4" />
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUserStatus(u, 'suspended')}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300 text-xs font-bold"
                    >
                      <UserX className="w-4 h-4" />
                      Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(u)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900 text-red-700 dark:text-red-300 text-xs font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* WhatsApp de avisos del Administrador */}
      <section className="bg-emerald-50/95 dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            WhatsApp para recibir solicitudes de autorización
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-3">
          Cuando un vecino se registre, le aparecerá un botón grande para avisarte por
          WhatsApp con su Nombre y Torre/Depto. Si lo dejas vacío, usará tu propio número
          registrado.
        </p>
        <form
          onSubmit={handleSaveAdminWhatsapp}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="tel"
            value={adminWhatsapp}
            onChange={(e) => setAdminWhatsapp(e.target.value)}
            placeholder="Ej: +56912345678"
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
          >
            Guardar número
          </button>
        </form>
      </section>

      {/* Códigos de invitación y Secciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-emerald-50/95 dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
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
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-emerald-300 dark:border-slate-700 bg-emerald-100/70 dark:bg-slate-800 hover:bg-emerald-200/70 dark:hover:bg-slate-700 text-xs font-bold text-emerald-900 dark:text-emerald-300"
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
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
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
                      className="p-2 rounded-lg border border-emerald-200 dark:border-slate-700 hover:bg-emerald-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteInviteCode(c)}
                      title="Eliminar código"
                      className="p-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-emerald-50/95 dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
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
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
            >
              Agregar
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            {categories.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No hay secciones todavía. Agrega una arriba o ejecuta{' '}
                <code>supabase/fix_permissions.sql</code>.
              </p>
            ) : (
              categories.map((cat) => (
                <span
                  key={cat.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-slate-800 text-emerald-900 dark:text-slate-200 text-xs font-bold"
                >
                  {cat.name}
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat)}
                    title="Eliminar sección"
                    className="text-emerald-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Lista de vecinos activos / suspendidos */}
      <section className="bg-emerald-50/95 dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
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
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {u.full_name}
                </span>{' '}
                <span className="text-emerald-800 dark:text-emerald-400 text-xs sm:text-sm">
                  ({u.unit_number})
                </span>
                {u.role === 'super_admin' && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    Super Admin
                  </span>
                )}
                {u.role === 'admin' && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                    Admin
                  </span>
                )}
                {u.status === 'suspended' && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                    Suspendido
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setEditingUser(u)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-400 hover:underline"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Corregir
                  </button>
                )}
                {u.id !== adminId && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        handleUserStatus(
                          u,
                          u.status === 'approved' ? 'suspended' : 'approved'
                        )
                      }
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white underline"
                    >
                      {u.status === 'approved' ? 'Suspender' : 'Reactivar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(u)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {editingUser && (
        <ProfileModal
          targetProfile={editingUser}
          mode="admin"
          adminId={adminId}
          onClose={() => setEditingUser(null)}
          onSaved={async () => {
            setFeedback(`Datos de ${editingUser.full_name} actualizados.`);
            await Promise.all([loadAdminData(), onDataChanged()]);
          }}
        />
      )}
    </div>
  );
}
