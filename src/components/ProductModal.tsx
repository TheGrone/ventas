import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, ChevronDown, ChevronUp, Trash2, X, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isSafeImageUrl } from '../lib/format';
import type { Category, Product } from '../types/database';

interface ProductModalProps {
  categories: Category[];
  sellerId: string;
  editingProduct: Product | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB por imagen
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const LAST_CAT_KEY = 'condomarket-last-category';

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

    for (const file of selected) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError('Solo se permiten imágenes JPG, PNG o WebP.');
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError('Cada imagen debe pesar como máximo 2 MB.');
        return;
      }
    }

    setUploadingImage(true);
    try {
      // Subida en paralelo para máxima velocidad
      const uploadedUrls = await Promise.all(
        selected.map(async (file) => {
          const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
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
      setError(
        err instanceof Error ? err.message : 'No se pudo subir la imagen.'
      );
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

    const safeImages = images.filter((u) => isSafeImageUrl(u)).slice(0, MAX_IMAGES);

    setSaving(true);
    try {
      localStorage.setItem(LAST_CAT_KEY, categoryId);

      const payload = {
        seller_id: sellerId,
        category_id: categoryId,
        title: title.trim(),
        description: description.trim(),
        price_clp: parsedPrice,
        image_url: safeImages[0] ?? null,
        images: safeImages,
        is_available: isAvailable,
      };

      if (editingProduct) {
        const { error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('products')
          .insert(payload);
        if (insertError) throw insertError;
      }

      await onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar el anuncio.'
      );
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
          {/* 1. Fotos primero (tocar y listo) */}
          <div>
            {images.length < MAX_IMAGES && (
              <label className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl border-2 border-dashed border-emerald-400 dark:border-emerald-700 bg-emerald-100/70 dark:bg-slate-800/80 hover:bg-emerald-200/60 dark:hover:bg-slate-800 text-emerald-900 dark:text-emerald-300 text-sm font-bold cursor-pointer transition">
                <Camera className="w-5 h-5 shrink-0" />
                <span>
                  {uploadingImage
                    ? 'Subiendo fotos...'
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
              ¿Qué vendes?
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

          {/* 3. Precio y Sección en la misma fila */}
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

          {/* 4. Detalles opcionales colapsables para no alargar el formulario */}
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

          {/* Botón grande directo para publicar */}
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
