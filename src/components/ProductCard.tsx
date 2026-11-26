import {
  BadgeCheck,
  Eye,
  EyeOff,
  MessageCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { buildWhatsAppUrl, formatCLP, isSafeImageUrl } from '../lib/format';
import type { Product, Profile } from '../types/database';

interface ProductCardProps {
  product: Product;
  currentUser: Profile;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onToggleHidden?: (product: Product) => void;
}

export function ProductCard({
  product,
  currentUser,
  onEdit,
  onDelete,
  onToggleHidden,
}: ProductCardProps) {
  const isOwner = product.seller_id === currentUser.id;
  const isAdmin = currentUser.role === 'admin';
  const sellerName = product.seller?.full_name || 'Vecino';
  const sellerUnit = product.seller?.unit_number || 'Torre / Depto';
  const sellerPhone = product.seller?.whatsapp || '';
  const hasImage = product.image_url && isSafeImageUrl(product.image_url);

  const whatsappHref = sellerPhone
    ? buildWhatsAppUrl(sellerPhone, product.title, product.price_clp, sellerName)
    : '#';

  return (
    <article
      className={`rounded-2xl border shadow-sm overflow-hidden flex flex-col transition hover:shadow-md ${
        product.is_hidden_by_admin
          ? 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/30'
          : 'border-emerald-200/90 dark:border-slate-800 bg-emerald-50/90 dark:bg-slate-900'
      }`}
    >
      <div className="relative aspect-4/3 bg-emerald-100/80 dark:bg-slate-800 overflow-hidden">
        {hasImage ? (
          <img
            src={product.image_url!}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-emerald-700/50 dark:text-slate-500 text-sm">
            Sin imagen
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {product.category?.name && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50/95 dark:bg-slate-900/90 text-emerald-950 dark:text-emerald-200 shadow-sm backdrop-blur">
              {product.category.name}
            </span>
          )}
          {!product.is_available && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white shadow-sm">
              Agotado / Pausado
            </span>
          )}
          {product.is_hidden_by_admin && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-600 text-white shadow-sm">
              Oculto por Admin
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base leading-snug line-clamp-2">
            {product.title}
          </h3>
          <span className="font-bold text-emerald-700 dark:text-emerald-400 text-lg shrink-0">
            {formatCLP(product.price_clp)}
          </span>
        </div>

        {product.description && (
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 line-clamp-3 whitespace-pre-line">
            {product.description}
          </p>
        )}

        {product.is_hidden_by_admin && product.moderation_note && (
          <div className="mt-3 p-2.5 rounded-xl bg-red-100/80 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
            <strong>Motivo de moderación:</strong> {product.moderation_note}
          </div>
        )}

        <div className="mt-auto pt-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 mb-3">
            <BadgeCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
              {sellerName}
            </span>
            <span>·</span>
            <span className="shrink-0 font-medium text-emerald-800 dark:text-emerald-300">
              {sellerUnit}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {sellerPhone && !isOwner && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition shadow-sm"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">Contactar por WhatsApp</span>
              </a>
            )}

            {isOwner && (
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 dark:border-slate-700 hover:bg-emerald-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-medium transition"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </button>
            )}

            {isAdmin && onToggleHidden && (
              <button
                type="button"
                onClick={() => onToggleHidden(product)}
                title={product.is_hidden_by_admin ? 'Mostrar anuncio' : 'Ocultar anuncio'}
                className="p-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300 transition"
              >
                {product.is_hidden_by_admin ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            )}

            {(isOwner || isAdmin) && (
              <button
                type="button"
                onClick={() => onDelete(product)}
                title="Eliminar anuncio"
                className="p-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
