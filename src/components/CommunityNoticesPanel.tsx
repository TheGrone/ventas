import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Calendar,
  Info,
  Megaphone,
  Pin,
  Plus,
  Trash2,
} from 'lucide-react';
import { formatDateTimeCL } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { CommunityNotice, NoticeType } from '../types/database';

interface CommunityNoticesPanelProps {
  notices: CommunityNotice[];
  canManage: boolean;
  authorId?: string;
  onChanged?: () => Promise<void>;
}

const NOTICE_STYLES: Record<
  NoticeType,
  { label: string; badge: string; border: string; icon: typeof Info }
> = {
  info: {
    label: 'Informativo',
    badge:
      'bg-emerald-200/80 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-slate-800',
    icon: Info,
  },
  importante: {
    label: 'Importante',
    badge: 'bg-amber-200/90 dark:bg-amber-950 text-amber-950 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-800/80',
    icon: AlertTriangle,
  },
  evento: {
    label: 'Evento / Actividad',
    badge: 'bg-sky-200/80 dark:bg-sky-950 text-sky-900 dark:text-sky-300',
    border: 'border-sky-300 dark:border-sky-800/80',
    icon: Calendar,
  },
};

export function CommunityNoticesPanel({
  notices,
  canManage,
  authorId,
  onChanged,
}: CommunityNoticesPanelProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noticeType, setNoticeType] = useState<NoticeType>('info');
  const [isPinned, setIsPinned] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 3 || content.trim().length < 3) {
      setError('Escribe un título y un mensaje para el aviso.');
      return;
    }

    setSaving(true);
    try {
      const { error: insErr } = await supabase.from('community_notices').insert({
        author_id: authorId ?? null,
        title: title.trim(),
        content: content.trim(),
        notice_type: noticeType,
        is_pinned: isPinned,
      });
      if (insErr) throw insErr;

      setTitle('');
      setContent('');
      setNoticeType('info');
      setIsPinned(true);
      if (onChanged) await onChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} (Asegúrate de ejecutar supabase/fix_permissions.sql en Supabase)`
          : 'No se pudo publicar el aviso.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (notice: CommunityNotice) => {
    const confirmed = window.confirm(`¿Eliminar el aviso "${notice.title}"?`);
    if (!confirmed) return;

    const { error: delErr } = await supabase
      .from('community_notices')
      .delete()
      .eq('id', notice.id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    if (onChanged) await onChanged();
  };

  const handleTogglePin = async (notice: CommunityNotice) => {
    const { error: updErr } = await supabase
      .from('community_notices')
      .update({ is_pinned: !notice.is_pinned })
      .eq('id', notice.id);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    if (onChanged) await onChanged();
  };

  return (
    <div className="space-y-5">
      {canManage && (
        <section className="bg-emerald-50/95 dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Publicar aviso para toda la comunidad
            </h2>
          </div>

          {error && (
            <div className="mb-3 rounded-xl bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 px-3.5 py-2.5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título (ej: Corte de agua / Feria vecinal)"
                className="sm:col-span-2 px-3.5 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <select
                value={noticeType}
                onChange={(e) => setNoticeType(e.target.value as NoticeType)}
                className="px-3 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="info">ℹ️ Informativo</option>
                <option value="importante">⚠️ Importante</option>
                <option value="evento">📅 Evento / Actividad</option>
              </select>
            </div>

            <textarea
              rows={3}
              required
              maxLength={2000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe el comunicado para los vecinos..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                />
                Fijar arriba en la portada del catálogo
              </label>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                {saving ? 'Publicando...' : 'Publicar aviso'}
              </button>
            </div>
          </form>
        </section>
      )}

      {notices.length === 0 ? (
        <div className="text-center py-12 px-4 bg-emerald-50/95 dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-slate-800">
          <Megaphone className="w-10 h-10 text-emerald-600/50 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-slate-700 dark:text-slate-300 font-bold text-base">
            No hay avisos de la comunidad por ahora.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => {
            const style = NOTICE_STYLES[n.notice_type] ?? NOTICE_STYLES.info;
            const Icon = style.icon;
            return (
              <article
                key={n.id}
                className={`bg-emerald-50/95 dark:bg-slate-900 rounded-3xl border-2 ${style.border} p-4 sm:p-5 shadow-sm`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${style.badge}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {style.label}
                    </span>
                    {n.is_pinned && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white">
                        <Pin className="w-3 h-3" />
                        Fijado
                      </span>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTimeCL(n.created_at)}
                    </span>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(n)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-slate-800"
                      >
                        <Pin className="w-3.5 h-3.5" />
                        {n.is_pinned ? 'Desfijar' : 'Fijar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(n)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {n.title}
                </h3>
                <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 mt-1.5 whitespace-pre-line leading-relaxed">
                  {n.content}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
