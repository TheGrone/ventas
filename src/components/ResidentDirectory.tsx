import { useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCheck2,
  LayoutList,
  MessageCircle,
  Pencil,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { formatDateTimeCL, normalizeWhatsApp } from '../lib/format';
import type { Profile } from '../types/database';

interface ResidentDirectoryProps {
  users: Profile[];
  adminId: string;
  isSuperAdmin: boolean;
  onEditUser: (user: Profile) => void;
  onToggleStatus: (user: Profile, status: 'approved' | 'suspended') => void;
  onDemoteAdmin?: (user: Profile) => void;
  onDeleteUser: (user: Profile) => void;
}

const PAGE_SIZE = 15;

function getTowerKey(unitNumber: string): string {
  const match = unitNumber.match(/Torre\s*(\d+)/i);
  if (match) return `Torre ${Number(match[1])}`;
  if (unitNumber.toLowerCase().includes('administr')) return 'Administración';
  return 'Sin torre (Privado)';
}

function getTowerSortOrder(key: string): number {
  const match = key.match(/Torre\s*(\d+)/i);
  if (match) return Number(match[1]);
  if (key === 'Administración') return 0;
  return 99;
}

function getDeptoSortNumber(unitNumber: string): number {
  const match = unitNumber.match(/Depto\s*(\d+)/i);
  return match ? Number(match[1]) : 9999;
}

export function ResidentDirectory({
  users,
  adminId,
  isSuperAdmin,
  onEditUser,
  onToggleStatus,
  onDemoteAdmin,
  onDeleteUser,
}: ResidentDirectoryProps) {
  const [search, setSearch] = useState('');
  const [towerFilter, setTowerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'suspended'>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [collapsedTowers, setCollapsedTowers] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);

  // Conteo de vecinos por torre (sin filtros, para el selector)
  const towerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) {
      const key = getTowerKey(u.unit_number);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => {
        if (statusFilter !== 'all' && u.status !== statusFilter) return false;
        if (towerFilter !== 'all' && getTowerKey(u.unit_number) !== towerFilter) {
          return false;
        }
        if (q) {
          const hay =
            `${u.full_name} ${u.unit_number} ${u.email} ${u.whatsapp}`.toLowerCase();
          return hay.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        const tDiff =
          getTowerSortOrder(getTowerKey(a.unit_number)) -
          getTowerSortOrder(getTowerKey(b.unit_number));
        if (tDiff !== 0) return tDiff;
        const dDiff =
          getDeptoSortNumber(a.unit_number) - getDeptoSortNumber(b.unit_number);
        if (dDiff !== 0) return dDiff;
        return a.full_name.localeCompare(b.full_name, 'es');
      });
  }, [users, search, towerFilter, statusFilter]);

  const groupedByTower = useMemo(() => {
    const map = new Map<string, Profile[]>();
    for (const u of filteredUsers) {
      const key = getTowerKey(u.unit_number);
      const list = map.get(key) ?? [];
      list.push(u);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(
      ([keyA], [keyB]) => getTowerSortOrder(keyA) - getTowerSortOrder(keyB)
    );
  }, [filteredUsers]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, safePage]);

  const toggleTowerCollapse = (key: string) => {
    setCollapsedTowers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllCollapsed = (collapsed: boolean) => {
    const next: Record<string, boolean> = {};
    for (const [key] of groupedByTower) {
      next[key] = collapsed;
    }
    setCollapsedTowers(next);
  };

  const handleExportConsentCsv = () => {
    const escapeCell = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const headers = [
      'Nombre Completo',
      'Torre / Depto',
      'Correo',
      'WhatsApp',
      'Rol',
      'Estado Cuenta',
      'Consentimiento Aceptado',
      'Fecha y Hora Aceptacion',
      'ID Usuario',
    ];

    const rows = filteredUsers.map((u) => [
      u.full_name,
      u.unit_number,
      u.email,
      u.whatsapp,
      u.role,
      u.status,
      u.terms_accepted_at ? 'SI' : 'PENDIENTE',
      u.terms_accepted_at ? formatDateTimeCL(u.terms_accepted_at) : '-',
      u.id,
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) => row.map((cell) => escapeCell(String(cell))).join(';'))
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `comprobante-consentimientos-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderResidentRow = (u: Profile) => {
    const waLink = `https://wa.me/${normalizeWhatsApp(u.whatsapp)}`;
    return (
      <div
        key={u.id}
        className="py-3 px-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-emerald-100/50 dark:hover:bg-slate-800/60 transition"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
              {u.full_name}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 text-xs font-bold">
              {u.unit_number}
            </span>
            {u.role === 'super_admin' && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                Super Admin
              </span>
            )}
            {u.role === 'admin' && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                Admin
              </span>
            )}
            {u.role === 'viewer' && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                Solo Comprador
              </span>
            )}
            {u.status === 'suspended' && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                Suspendido
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 break-all">
            {u.email} · {u.whatsapp}
          </p>
          <div className="mt-1">
            {u.terms_accepted_at ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100/90 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold">
                <FileCheck2 className="w-3 h-3 shrink-0" />
                Términos aceptados: {formatDateTimeCL(u.terms_accepted_at)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                Pendiente de aceptar términos
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            title="Escribir por WhatsApp"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-300 text-xs font-bold"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WSP
          </a>

          {isSuperAdmin && u.role === 'admin' && u.id !== adminId && onDemoteAdmin && (
            <button
              type="button"
              onClick={() => onDemoteAdmin(u)}
              className="px-2.5 py-1.5 rounded-xl border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-800 dark:text-purple-300 text-xs font-bold"
            >
              Pasar a Vecino
            </button>
          )}

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => onEditUser(u)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-300 dark:border-slate-700 hover:bg-emerald-100 dark:hover:bg-slate-800 text-emerald-900 dark:text-emerald-300 text-xs font-bold"
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
                  onToggleStatus(
                    u,
                    u.status === 'approved' ? 'suspended' : 'approved'
                  )
                }
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold"
              >
                {u.status === 'approved' ? 'Suspender' : 'Reactivar'}
              </button>
              <button
                type="button"
                onClick={() => onDeleteUser(u)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 text-xs font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="bg-emerald-50/95 dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Directorio de vecinos ({filteredUsers.length} de {users.length})
          </h2>
        </div>

        {/* Acciones de vista y descarga de comprobante */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportConsentCsv}
            title="Descargar planilla Excel/CSV con fecha y hora de consentimiento de cada vecino"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white text-xs font-bold shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            Comprobante (Excel/CSV)
          </button>

          <div className="inline-flex p-1 rounded-xl bg-emerald-100 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setViewMode('grouped')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'grouped'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Por Torre
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('list');
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'list'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" />
            Lista
          </button>
        </div>
        </div>
      </div>

      {/* Buscador + Filtros por Torre y Estado */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
        <div className="relative md:col-span-6">
          <Search className="w-4 h-4 text-emerald-600 dark:text-slate-400 absolute left-3.5 top-3" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre, depto (ej: 401), correo o WhatsApp..."
            className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-emerald-100/60 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <select
          value={towerFilter}
          onChange={(e) => {
            setTowerFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar vecinos por torre"
          className="md:col-span-3 px-3 py-2.5 rounded-xl bg-emerald-100/60 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">🏢 Todas las torres ({users.length})</option>
          {Array.from({ length: 11 }, (_, i) => `Torre ${i + 1}`).map((t) => (
            <option key={t} value={t}>
              🏢 {t} ({towerCounts[t] ?? 0})
            </option>
          ))}
          {(towerCounts['Sin torre (Privado)'] ?? 0) > 0 && (
            <option value="Sin torre (Privado)">
              🔒 Sin torre / Privado ({towerCounts['Sin torre (Privado)']})
            </option>
          )}
          {(towerCounts['Administración'] ?? 0) > 0 && (
            <option value="Administración">
              🛡️ Administración ({towerCounts['Administración']})
            </option>
          )}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as 'all' | 'approved' | 'suspended');
            setPage(1);
          }}
          aria-label="Filtrar vecinos por estado"
          className="md:col-span-3 px-3 py-2.5 rounded-xl bg-emerald-100/60 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">Todos los estados</option>
          <option value="approved">Solo activos</option>
          <option value="suspended">Solo suspendidos</option>
        </select>
      </div>

      {/* Resultados */}
      {filteredUsers.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-600 dark:text-slate-400 bg-emerald-100/40 dark:bg-slate-800/40 rounded-2xl border border-emerald-200/70 dark:border-slate-800">
          No se encontraron vecinos con esos filtros.
        </div>
      ) : viewMode === 'grouped' ? (
        <div className="space-y-3">
          {groupedByTower.length > 1 && (
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setAllCollapsed(false)}
                className="font-bold text-emerald-800 dark:text-emerald-400 hover:underline"
              >
                Expandir todas
              </button>
              <span className="text-slate-400">·</span>
              <button
                type="button"
                onClick={() => setAllCollapsed(true)}
                className="font-bold text-slate-600 dark:text-slate-400 hover:underline"
              >
                Contraer todas
              </button>
            </div>
          )}

          {groupedByTower.map(([towerKey, list]) => {
            const isCollapsed = Boolean(collapsedTowers[towerKey]);
            return (
              <div
                key={towerKey}
                className="rounded-2xl border border-emerald-200 dark:border-slate-800 overflow-hidden bg-emerald-50/70 dark:bg-slate-900/70"
              >
                <button
                  type="button"
                  onClick={() => toggleTowerCollapse(towerKey)}
                  className="w-full px-4 py-3 bg-emerald-100/80 dark:bg-slate-800/90 hover:bg-emerald-200/60 dark:hover:bg-slate-800 flex items-center justify-between gap-2 text-left transition"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                      {towerKey}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white">
                      {list.length} {list.length === 1 ? 'vecino' : 'vecinos'}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-600 dark:text-slate-400 transition-transform ${
                      isCollapsed ? '-rotate-90' : ''
                    }`}
                  />
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-emerald-200/70 dark:divide-slate-800">
                    {list.map(renderResidentRow)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-emerald-200 dark:border-slate-800 overflow-hidden divide-y divide-emerald-200/70 dark:divide-slate-800">
            {paginatedUsers.map(renderResidentRow)}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
              <span className="text-slate-600 dark:text-slate-400">
                Página <strong>{safePage}</strong> de <strong>{totalPages}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-slate-700 disabled:opacity-40 font-bold text-slate-800 dark:text-slate-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-slate-700 disabled:opacity-40 font-bold text-slate-800 dark:text-slate-200"
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
