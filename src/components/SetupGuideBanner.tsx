import { Database, ShieldCheck } from 'lucide-react';

export function SetupGuideBanner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-100 dark:bg-slate-950 p-4">
      <div className="max-w-xl w-full bg-emerald-50/95 dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-slate-800 shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Falta conectar tu base de datos Supabase
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Configuración necesaria para activar login, seguridad y anuncios
            </p>
          </div>
        </div>

        <ol className="space-y-3 text-sm text-slate-700 dark:text-slate-300 list-decimal list-inside bg-emerald-100/60 dark:bg-slate-800/80 rounded-xl p-4 border border-emerald-200 dark:border-slate-700">
          <li>
            Crea un proyecto gratuito en <strong>supabase.com</strong>.
          </li>
          <li>
            Abre el <strong>SQL Editor</strong> en Supabase y ejecuta el contenido del
            archivo <code className="bg-emerald-200/70 dark:bg-slate-700 px-1.5 py-0.5 rounded">supabase/schema.sql</code>.
          </li>
          <li>
            Copia <code className="bg-emerald-200/70 dark:bg-slate-700 px-1.5 py-0.5 rounded">.env.example</code> a{' '}
            <code className="bg-emerald-200/70 dark:bg-slate-700 px-1.5 py-0.5 rounded">.env.local</code> y pega tu{' '}
            <code className="bg-emerald-200/70 dark:bg-slate-700 px-1.5 py-0.5 rounded">VITE_SUPABASE_URL</code> y{' '}
            <code className="bg-emerald-200/70 dark:bg-slate-700 px-1.5 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code>.
          </li>
          <li>
            Para GitHub Pages, agrega esas mismas variables en{' '}
            <strong>Settings → Secrets and variables → Actions</strong> de tu repositorio.
          </li>
        </ol>

        <div className="mt-4 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            La clave <code>ANON_KEY</code> es pública por diseño; la seguridad real vive en
            las políticas RLS de PostgreSQL.
          </span>
        </div>
      </div>
    </div>
  );
}
