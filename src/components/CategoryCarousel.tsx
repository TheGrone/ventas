import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Category } from '../types/database';

interface CategoryCarouselProps {
  categories: Category[];
  selectedCategory: string;
  onSelect: (categoryId: string) => void;
}

function getCategoryEmoji(name: string, icon?: string): string {
  const lower = `${name} ${icon ?? ''}`.toLowerCase();
  if (lower.includes('aliment') || lower.includes('comida') || lower.includes('utensils')) {
    return '🍽️';
  }
  if (lower.includes('postre') || lower.includes('pan') || lower.includes('cake')) {
    return '🍰';
  }
  if (lower.includes('ropa') || lower.includes('accesor') || lower.includes('shirt')) {
    return '👕';
  }
  if (lower.includes('hogar') || lower.includes('decora') || lower.includes('home')) {
    return '🏠';
  }
  if (lower.includes('tecnolog') || lower.includes('celu') || lower.includes('smartphone')) {
    return '📱';
  }
  if (lower.includes('servici') || lower.includes('clase') || lower.includes('wrench')) {
    return '🔧';
  }
  if (lower.includes('mascot') || lower.includes('perro') || lower.includes('gato')) {
    return '🐾';
  }
  if (lower.includes('planta') || lower.includes('jard')) {
    return '🌿';
  }
  if (lower.includes('deport') || lower.includes('bici')) {
    return '🚲';
  }
  if (lower.includes('juguete') || lower.includes('niñ') || lower.includes('beb')) {
    return '🧸';
  }
  if (lower.includes('salud') || lower.includes('belleza')) {
    return '💚';
  }
  return '📦';
}

export function CategoryCarousel({
  categories,
  selectedCategory,
  onSelect,
}: CategoryCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, [categories, updateScrollState]);

  const scrollByAmount = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = Math.max(200, el.clientWidth * 0.7);
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-900/75 dark:text-emerald-300/80">
          Secciones del catálogo
        </span>
        {(canScrollLeft || canScrollRight) && (
          <span className="text-xs text-emerald-800/75 dark:text-slate-400">
            Desliza o usa las flechas →
          </span>
        )}
      </div>

      <div className="relative flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => scrollByAmount('left')}
          disabled={!canScrollLeft}
          aria-label="Ver secciones anteriores"
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border transition shadow-xs ${
            canScrollLeft
              ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white cursor-pointer'
              : 'bg-emerald-50/70 dark:bg-slate-900/60 border-emerald-200 dark:border-slate-800 text-emerald-300 dark:text-slate-700 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex-1 flex gap-2.5 overflow-x-auto scroll-smooth snap-x snap-mandatory touch-pan-x no-scrollbar py-1"
        >
          <button
            type="button"
            onClick={() => onSelect('all')}
            className={`snap-start shrink-0 inline-flex items-center gap-2 min-h-11 px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap transition shadow-xs ${
              selectedCategory === 'all'
                ? 'bg-emerald-700 text-white ring-2 ring-emerald-500/40'
                : 'bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-emerald-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <span className="text-lg leading-none" aria-hidden="true">
              🛍️
            </span>
            <span>Todos</span>
          </button>

          {categories.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelect(cat.id)}
                className={`snap-start shrink-0 inline-flex items-center gap-2 min-h-11 px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap transition shadow-xs ${
                  active
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/40'
                    : 'bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-emerald-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  {getCategoryEmoji(cat.name, cat.icon)}
                </span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollByAmount('right')}
          disabled={!canScrollRight}
          aria-label="Ver más secciones"
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border transition shadow-xs ${
            canScrollRight
              ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white cursor-pointer'
              : 'bg-emerald-50/70 dark:bg-slate-900/60 border-emerald-200 dark:border-slate-800 text-emerald-300 dark:text-slate-700 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
