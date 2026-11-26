import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ImagePlus, Trash2, X } from 'lucide-react';
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

export function ProductModal({
  categories,
  sellerId,
  editingProduct,
  onClose,
  onSaved,
}: ProductModalProps) {
  const [title, setTitle] = useState(editingProduct?.title ?? '');
  const [description, setDescription] = useState(editingProduct?.description ?? '');
  const [priceClp, setPriceClp] = useState(
    editingProduct ? String(editingProduct.price_clp) : ''
  );
  const [categoryId, setCategoryId] = useState(
    editingProduct?.category_id ?? categories[0]?.id ?? ''
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
      setError(`Máximo ${MAX_IMAGES} imágenes por anuncio.`);
      return;
    }

    const selected = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setError(
        `Solo se subirán ${remainingSlots} imagen(es) para respetar el máximo de ${MAX_IMAGES}.`
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
      const uploadedUrls: string[] = [];
      for (const file of selected) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const filePath = `${sellerId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file, { upsert: false });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        uploadedUrls.push(data.publicUrl);
      }

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
      setError('El título debe tener al menos 3 caracteres.');
      return;
    }
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Ingresa un precio válido en CLP.');
      return;
    }
    if (!categoryId) {
      setError('Selecciona una categoría (si no hay ninguna, crea una en Administración).');
      return;
    }

    const safeImages = images.filter((u) => isSafeImageUrl(u)).slice(0, MAX_IMAGES);

    setSaving(true);
    try {
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
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-emerald-50 dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-slate-800 shadow-xl w-full max-w-lg p-5 sm:p-6 my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {editingProduct ? 'Editar anuncio' : 'Publicar producto o servicio'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-emerald-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 px-3 py-2.5 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
              Título del producto
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Pan amasado recién horneado (6 unid.)"
              className="w-full px-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                Precio (CLP)
              </label>
              <input
                type="number"
                required
                min={0}
                max={100000000}
                value={priceClp}
                onChange={(e) => setPriceClp(e.target.value)}
                placeholder="Ej: 3500"
                className="w-full px-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                Catálogo / Sección
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {categories.length === 0 ? (
                  <option value="">Sin categorías disponibles</option>
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

          <div>
            <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
              Descripción y detalles
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Horario de entrega, sabores, estado, etc."
              className="w-full px-3 py-2 rounded-xl bg-emerald-100/50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                Fotos del producto ({images.length}/{MAX_IMAGES}, máx 2 MB c/u)
              </label>
            </div>

            {images.length < MAX_IMAGES && (
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-300 dark:border-slate-700 bg-emerald-100/60 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
                <ImagePlus className="w-4 h-4" />
                {uploadingImage ? 'Subiendo...' : 'Subir fotos (hasta 6)'}
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
              <div className="mt-3 grid grid-cols-3 gap-2">
                {images.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-emerald-200 dark:border-slate-700 bg-emerald-100/50 dark:bg-slate-800"
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
                      className="absolute top-1 right-1 p-1 rounded-lg bg-red-600/90 hover:bg-red-700 text-white shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {editingProduct && (
            <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="rounded border-emerald-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
              />
              Producto disponible (desmarcar si está agotado o pausado)
            </label>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-emerald-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploadingImage}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold"
            >
              {saving ? 'Guardando...' : editingProduct ? 'Guardar cambios' : 'Publicar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
