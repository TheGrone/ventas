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
  const sellerUnit = product.seller?.unit_number || 'Condominio';
  const sellerPhone = product.seller?.whatsapp || '';
  const hasImage = product.image_url && isSafeImageUrl(product.image_url);

  const whatsappHref = sellerPhone
    ? buildWhatsAppUrl(sellerPhone, product.title, product.price_clp, sellerName)
    : '#';

  return (
    <article
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition hover:shadow-md ${
        product.is_hidden_by_admin
          ? 'border-red-300 bg-red-50/30'
          : 'border-slate-200'
      }`}
    >
      <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
        {hasImage ? (
          <img
            src={product.image_url!}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
            Sin imagen
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {product.category?.name && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/95 text-slate-800 shadow-sm backdrop-blur">
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
          <h3 className="font-semibold text-slate-900 text-base leading-snug line-clamp-2">
            {product.title}
          </h3>
          <span className="font-bold text-emerald-700 text-lg shrink-0">
            {formatCLP(product.price_clp)}
          </span>
        </div>

        {product.description && (
          <p className="text-sm text-slate-600 mt-2 line-clamp-3 whitespace-pre-line">
            {product.description}
          </p>
        )}

        {product.is_hidden_by_admin && product.moderation_note && (
          <div className="mt-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            <strong>Motivo de moderación:</strong> {product.moderation_note}
          </div>
        )}

        <div className="mt-auto pt-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
            <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium text-slate-700 truncate">{sellerName}</span>
            <span>·</span>
            <span className="shrink-0">{sellerUnit}</span>
          </div>

          <div className="flex items-center gap-2">
            {sellerPhone && !isOwner && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Contactar por WhatsApp
              </a>
            )}

            {isOwner && (
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition"
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
                className="p-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 transition"
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
                className="p-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition"
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
