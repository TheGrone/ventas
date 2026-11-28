import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Phone,
  Trash2,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  getErrorMessage,
  isSafeImageUrl,
  isValidWhatsApp,
  normalizeWhatsApp,
} from '../lib/format';
import type { Category, Product } from '../types/database';

interface ProductModalProps {
  categories: Category[];
  sellerId: string;
  isAdmin: boolean;
  editingProduct: Product | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB por imagen (límite del bucket)
const MAX_DIMENSION = 1400;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const LAST_CAT_KEY = 'condomarket-last-category';

/**
 * Comprime fotos grandes tomadas con celular (ej: 5-10 MB) para que suban rápido
 * y nunca fallen por el límite de 2 MB en Supabase Storage.
 */
async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.size <= 900 * 1024 && ALLOWED_TYPES.includes(file.type)) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, '');
          resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.82
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

function getInitialImages(product: Product | null): string[] {
  if (!product) return [];
  if (product.images && product.images.length > 0) {
    return product.images.filter((u) => isSafeImageUrl(u)).slice(0, MAX_IMAGES);
  }
  if (product.image_url && isSafeImageUrl(product.image_url)) {
    return [product.image_url];
  }
  return [];
}

function getDefaultCategoryId(
  editingProduct: Product | null,
  categories: Category[]
): string {
  if (editingProduct?.category_id) return editingProduct.category_id;
  const saved = localStorage.getItem(LAST_CAT_KEY);
  if (saved && categories.some((c) => c.id === saved)) return saved;
  return categories[0]?.id ?? '';
}

export function ProductModal({
  categories,
  sellerId,
  isAdmin,
  editingProduct,
  onClose,
  onSaved,
}: ProductModalProps) {
  const [title, setTitle] = useState(editingProduct?.title ?? '');
  const [priceClp, setPriceClp] = useState(
    editingProduct ? String(editingProduct.price_clp) : ''
  );
  const [categoryId, setCategoryId] = useState(() =>
    getDefaultCategoryId(editingProduct, categories)
  );
  const [description, setDescription] = useState(editingProduct?.description ?? '');
  const [showDetails, setShowDetails] = useState(
    Boolean(editingProduct?.description)
  );
  const [isAvailable, setIsAvailable] = useState(editingProduct?.is_available ?? true);
  const [images, setImages] = useState<string[]>(() =>
    getInitialImages(editingProduct)
  );

  // Publicar a nombre de un vecino (solo Admin, ej: anuncios sacados del grupo de WhatsApp)
  const [publishOnBehalf, setPublishOnBehalf] = useState(
    Boolean(editingProduct?.contact_whatsapp || editingProduct?.contact_name)
  );
  const [contactName, setContactName] = useState(editingProduct?.contact_name ?? '');
  const [contactWhatsapp, setContactWhatsapp] = useState(
    editingProduct?.contact_whatsapp ?? '+569'
  );

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFilesUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setError(null);

    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setError(`Máximo ${MAX_IMAGES} fotos por anuncio.`);
      return;
    }

    const selected = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setError(
        `Se subirán ${remainingSlots} foto(s) para respetar el máximo de ${MAX_IMAGES}.`
      );
    }

    setUploadingImage(true);
    try {
      const uploadedUrls = await Promise.all(
        selected.map(async (rawFile) => {
          const file = await compressImageIfNeeded(rawFile);
          if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error('Solo se permiten imágenes JPG, PNG o WebP.');
          }
          if (file.size > MAX_IMAGE_BYTES) {
            throw new Error('Una foto sigue superando 2 MB. Intenta con otra más liviana.');
          }

          const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
          const filePath = `${sellerId}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file, { upsert: false });

          if (uploadError) throw uploadError;

          const { data } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);
          return data.publicUrl;
        })
      );

      setImages((prev) => [...prev, ...uploadedUrls].slice(0, MAX_IMAGES));
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo subir la imagen.'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedPrice = Number.parseInt(priceClp.replace(/\D/g, ''), 10);
    if (title.trim().length < 3) {
      setError('Escribe qué vendes (mínimo 3 letras).');
      return;
    }
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Ingresa un precio válido en CLP.');
      return;
    }
    if (!categoryId) {
      setError('Selecciona una categoría.');
      return;
    }

    if (isAdmin && publishOnBehalf) {
      if (contactName.trim().length < 2) {
        setError('Escribe el nombre del vecino vendedor.');
        return;
      }
      if (!isValidWhatsApp(contactWhatsapp)) {
        setError('Ingresa un WhatsApp válido del vendedor (ej: +56912345678).');
        return;
      }
    }

    const safeImages = images.filter((u) => isSafeImageUrl(u)).slice(0, MAX_IMAGES);

    setSaving(true);
    try {
      localStorage.setItem(LAST_CAT_KEY, categoryId);

      // Solo enviar columnas proxy cuando el Admin publica o edita a nombre de otro vecino
      const basePayload: Record<string, unknown> = {
        seller_id: editingProduct?.seller_id ?? sellerId,
        category_id: categoryId,
        title: title.trim(),
        description: description.trim(),
        price_clp: parsedPrice,
        image_url: safeImages[0] ?? null,
        images: safeImages,
        is_available: isAvailable,
      };

      if (isAdmin && (publishOnBehalf || editingProduct?.contact_whatsapp)) {
        basePayload.contact_name = publishOnBehalf ? contactName.trim() : null;
        basePayload.contact_whatsapp = publishOnBehalf
          ? `+${normalizeWhatsApp(contactWhatsapp)}`
          : null;
      }

      const saveOnce = async (payloadToSend: Record<string, unknown>) => {
        if (editingProduct) {
          const { error: updateError } = await supabase
            .from('products')
            .update(payloadToSend)
            .eq('id', editingProduct.id);
          return updateError;
        }
        const { error: insertError } = await supabase
          .from('products')
          .insert(payloadToSend);
        return insertError;
      };

      let saveError = await saveOnce(basePayload);

      // Respaldo: si aún no existe alguna columna nueva en el esquema remoto, reintentar solo con columnas base
      if (
        saveError &&
        (saveError.message.includes('schema cache') ||
          saveError.message.includes('does not exist'))
      ) {
        const fallbackPayload = {
          seller_id: editingProduct?.seller_id ?? sellerId,
          category_id: categoryId,
          title: title.trim(),
          description: description.trim(),
          price_clp: parsedPrice,
          image_url: safeImages[0] ?? null,
          is_available: isAvailable,
        };
        saveError = await saveOnce(fallbackPayload);
      }

      if (saveError) throw saveError;

      await onSaved();
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err, 'No se pudo guardar el anuncio.');
      if (msg.includes('row-level security')) {
        setError(
          'Tu cuenta no tiene permiso para publicar en este momento. Recarga la página o consulta con Administración.'
        );
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-emerald-50 dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border-t-2 sm:border-2 border-emerald-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {editingProduct ? 'Editar anuncio' : 'Publicación rápida'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-emerald-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-2xl bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 px-3.5 py-2.5 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Opción exclusiva de Admin: publicar a nombre de un vecino (del grupo de WSP) */}
          {isAdmin && (
            <div className="p-3.5 rounded-2xl bg-purple-100/70 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publishOnBehalf}
                  onChange={(e) => setPublishOnBehalf(e.target.checked)}
                  className="w-4 h-4 rounded border-purple-400 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-xs sm:text-sm font-bold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                  <Users className="w-4 h-4 shrink-0" />
                  Publicar por un vecino (poner su WhatsApp)
                </span>
              </label>

              {publishOnBehalf && (
                <div className="space-y-2 pt-1">
                  <div className="relative">
                    <User className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Nombre del vecino (ej: Sra. Carmen)"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900 border border-purple-300 dark:border-purple-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      value={contactWhatsapp}
                      onChange={(e) => setContactWhatsapp(e.target.value)}
                      placeholder="WhatsApp del vecino (+56912345678)"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900 border border-purple-300 dark:border-purple-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <p className="text-[11px] text-purple-900/80 dark:text-purple-300">
                    El botón de WhatsApp del anuncio enviará directamente al número de
                    este vecino, sin mostrar torre ni depto.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 1. Fotos primero (con compresión automática para celulares) */}
          <div>
            {images.length < MAX_IMAGES && (
              <label className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl border-2 border-dashed border-emerald-400 dark:border-emerald-700 bg-emerald-100/70 dark:bg-slate-800/80 hover:bg-emerald-200/60 dark:hover:bg-slate-800 text-emerald-900 dark:text-emerald-300 text-sm font-bold cursor-pointer transition">
                <Camera className="w-5 h-5 shrink-0" />
                <span>
                  {uploadingImage
                    ? 'Optimizando y subiendo fotos...'
                    : images.length === 0
                      ? 'Agregar fotos (opcional, hasta 6)'
                      : `Agregar más fotos (${images.length}/${MAX_IMAGES})`}
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFilesUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>
            )}

            {images.length > 0 && (
              <div className="mt-2.5 flex gap-2 overflow-x-auto no-scrollbar py-0.5">
                {images.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="relative shrink-0 w-18 h-18 rounded-xl overflow-hidden border-2 border-emerald-300 dark:border-slate-700 bg-emerald-100 dark:bg-slate-800"
                  >
                    <img
                      src={url}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      title="Quitar foto"
                      className="absolute top-0.5 right-0.5 p-1 rounded-lg bg-red-600/90 text-white"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Qué vendes */}
          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
              ¿Qué se vende?
            </label>
            <input
              type="text"
              required
              autoFocus
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Empanadas de pino, Pan amasado..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 3. Precio y Sección */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                Precio ($ CLP)
              </label>
              <input
                type="number"
                inputMode="numeric"
                required
                min={0}
                max={100000000}
                value={priceClp}
                onChange={(e) => setPriceClp(e.target.value)}
                placeholder="3500"
                className="w-full px-3 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                Sección
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-2.5 py-2.5 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {categories.length === 0 ? (
                  <option value="">Sin categorías</option>
                ) : (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* 4. Detalles opcionales */}
          <div>
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-400 hover:underline"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Ocultar detalles
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  + Agregar descripción o horario (opcional)
                </>
              )}
            </button>

            {showDetails && (
              <textarea
                rows={2}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Horario de entrega, sabores, estado..."
                className="mt-2 w-full px-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>

          {editingProduct && (
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="rounded border-emerald-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
              />
              Disponible (desmarcar si está agotado)
            </label>
          )}

          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
            Por privacidad, en tu publicación solo aparece tu nombre y botón de WhatsApp
            (nunca tu torre ni depto).
          </p>

          <button
            type="submit"
            disabled={saving || uploadingImage}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-base font-extrabold shadow-md transition"
          >
            {saving
              ? 'Publicando...'
              : editingProduct
                ? 'Guardar cambios'
                : 'Publicar ahora'}
          </button>
        </form>
      </div>
    </div>
  );
}
