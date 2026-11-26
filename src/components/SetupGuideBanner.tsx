import { Database, ShieldCheck } from 'lucide-react';

export function SetupGuideBanner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-xl w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Falta conectar tu base de datos Supabase
            </h1>
            <p className="text-sm text-slate-500">
              Configuración necesaria para activar login, seguridad y anuncios
            </p>
          </div>
        </div>

        <ol className="space-y-3 text-sm text-slate-700 list-decimal list-inside bg-slate-50 rounded-xl p-4 border border-slate-200">
          <li>
            Crea un proyecto gratuito en <strong>supabase.com</strong>.
          </li>
          <li>
            Abre el <strong>SQL Editor</strong> en Supabase y ejecuta el contenido del
            archivo <code className="bg-slate-200 px-1.5 py-0.5 rounded">supabase/schema.sql</code>.
          </li>
          <li>
            Copia <code className="bg-slate-200 px-1.5 py-0.5 rounded">.env.example</code> a{' '}
            <code className="bg-slate-200 px-1.5 py-0.5 rounded">.env.local</code> y pega tu{' '}
            <code className="bg-slate-200 px-1.5 py-0.5 rounded">VITE_SUPABASE_URL</code> y{' '}
            <code className="bg-slate-200 px-1.5 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code>.
          </li>
          <li>
            Para GitHub Pages, agrega esas mismas variables en{' '}
            <strong>Settings → Secrets and variables → Actions</strong> de tu repositorio.
          </li>
        </ol>

        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            La clave <code>ANON_KEY</code> es pública por diseño; la seguridad real vive en
            las políticas RLS de PostgreSQL.
          </span>
        </div>
      </div>
    </div>
  );
}
