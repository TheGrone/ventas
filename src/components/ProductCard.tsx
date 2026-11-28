import { useState } from 'react';
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
  Lock,
  MessageCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  buildReportProductWhatsAppUrl,
  buildWhatsAppUrl,
  formatCLP,
  isPrivateUnit,
  isSafeImageUrl,
} from '../lib/format';
import type { Product, Profile } from '../types/database';

interface ProductCardProps {
  product: Product;
  currentUser: Profile;
  supportPhone?: string;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onToggleHidden?: (product: Product) => void;
}

export function ProductCard({
  product,
  currentUser,
  supportPhone,
  onEdit,
  onDelete,
  onToggleHidden,
}: ProductCardProps) {
  const [imgIndex, setImgIndex] = useState(0);

  const isOwner = product.seller_id === currentUser.id;
  const isViewer =
    currentUser.role === 'viewer' ||
    currentUser.email?.toLowerCase().trim() === 'vecino@condominio.cl' ||
    currentUser.unit_number === 'Cuenta Comunitaria';
  const isAdmin =
    currentUser.role === 'admin' || currentUser.role === 'super_admin';
  const isProxyListing = Boolean(product.contact_whatsapp);

  // Privacidad: nunca mostrar torre ni depto a otros vecinos (solo Nombre + WhatsApp)
  const displayName =
    product.contact_name?.trim() || product.seller?.full_name || 'Vecino';
  const displayPhone =
    product.contact_whatsapp?.trim() || product.seller?.whatsapp || '';

  // Torre/Depto solo visible para Admin (nunca para vecinos normales)
  const adminOnlyUnit =
    isAdmin && !isProxyListing && !isPrivateUnit(product.seller?.unit_number)
      ? product.seller?.unit_number
      : null;

  const gallery = (() => {
    if (product.images && product.images.length > 0) {
      return product.images.filter((u) => isSafeImageUrl(u));
    }
    if (product.image_url && isSafeImageUrl(product.image_url)) {
      return [product.image_url];
    }
    return [];
  })();

  const safeIndex = gallery.length > 0 ? imgIndex % gallery.length : 0;

  const whatsappHref = displayPhone
    ? buildWhatsAppUrl(
        displayPhone,
        product.title,
        product.price_clp,
        displayName,
        currentUser.full_name,
        isViewer
      )
    : '#';

  const showWhatsAppButton = Boolean(
    displayPhone && (isViewer || !isOwner || isProxyListing)
  );

  return (
    <article
      className={`rounded-3xl border-2 shadow-sm overflow-hidden flex flex-col transition hover:shadow-md ${
        product.is_hidden_by_admin
          ? 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/30'
          : 'border-emerald-200/90 dark:border-slate-800 bg-emerald-50/95 dark:bg-slate-900'
      }`}
    >
      <div className="relative aspect-4/3 bg-emerald-100/80 dark:bg-slate-800 overflow-hidden">
        {gallery.length > 0 ? (
          <>
            <img
              src={gallery[safeIndex]}
              alt={`${product.title} - foto ${safeIndex + 1}`}
              loading="lazy"
              className="w-full h-full object-cover"
            />
            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setImgIndex((prev) => (prev - 1 + gallery.length) % gallery.length)
                  }
                  aria-label="Foto anterior"
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/70 hover:bg-slate-900/90 text-white shadow-sm transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setImgIndex((prev) => (prev + 1) % gallery.length)}
                  aria-label="Foto siguiente"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/70 hover:bg-slate-900/90 text-white shadow-sm transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900/75 text-white">
                  Foto {safeIndex + 1} de {gallery.length}
                </span>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-emerald-800/50 dark:text-slate-500 text-sm font-medium">
            Sin foto
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {product.category?.name && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50/95 dark:bg-slate-900/90 text-emerald-950 dark:text-emerald-200 shadow-sm backdrop-blur">
              {product.category.name}
            </span>
          )}
          {!product.is_available && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm">
              Agotado / Pausado
            </span>
          )}
          {product.is_hidden_by_admin && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-600 text-white shadow-sm">
              Oculto por Admin
            </span>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg leading-snug line-clamp-2">
            {product.title}
          </h3>
          <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-xl shrink-0">
            {formatCLP(product.price_clp)}
          </span>
        </div>

        {product.description && (
          <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 mt-2 line-clamp-3 whitespace-pre-line">
            {product.description}
          </p>
        )}

        {product.is_hidden_by_admin && product.moderation_note && (
          <div className="mt-3 p-3 rounded-xl bg-red-100/80 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs sm:text-sm text-red-800 dark:text-red-200">
            <strong>Motivo de moderación:</strong> {product.moderation_note}
          </div>
        )}

        <div className="mt-auto pt-4 space-y-3">
          {/* Solo Nombre del vecino (nunca torre/depto para vecinos normales) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300 bg-emerald-100/70 dark:bg-slate-800/80 px-3 py-2 rounded-xl">
              <div className="flex items-center gap-1.5 min-w-0">
                <BadgeCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                  {displayName}
                </span>
              </div>
              {isProxyListing && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 shrink-0">
                  Vía Admin
                </span>
              )}
            </div>

            {adminOnlyUnit && (
              <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-800 dark:text-purple-300 px-2">
                <Lock className="w-3 h-3 shrink-0" />
                <span>Solo Admin ve: {adminOnlyUnit}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showWhatsAppButton && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold transition shadow-sm"
              >
                <MessageCircle className="w-5 h-5 shrink-0" />
                <span>Escribir por WhatsApp</span>
              </a>
            )}

            {!isOwner && !isAdmin && supportPhone && (
              <a
                href={buildReportProductWhatsAppUrl(
                  supportPhone,
                  product.title,
                  displayName,
                  'Condominio',
                  currentUser.full_name,
                  currentUser.unit_number
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Reportar anuncio inapropiado</span>
              </a>
            )}

            {!isViewer && (isOwner || (isAdmin && isProxyListing)) && (
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl border-2 border-emerald-300 dark:border-slate-700 hover:bg-emerald-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-bold transition"
              >
                <Pencil className="w-4 h-4" />
                <span>Editar</span>
              </button>
            )}

            {isAdmin && onToggleHidden && (
              <button
                type="button"
                onClick={() => onToggleHidden(product)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-300 text-sm font-bold transition"
              >
                {product.is_hidden_by_admin ? (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>Mostrar</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span>Ocultar</span>
                  </>
                )}
              </button>
            )}

            {!isViewer && (isOwner || isAdmin) && (
              <button
                type="button"
                onClick={() => onDelete(product)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900 text-red-700 dark:text-red-300 text-sm font-bold transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
