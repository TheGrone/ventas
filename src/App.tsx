import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  LogOut,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Sun,
  UserCheck,
} from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { AuthScreen } from './components/AuthScreen';
import { PendingApprovalScreen } from './components/PendingApprovalScreen';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { SetupGuideBanner } from './components/SetupGuideBanner';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { CONDO_NAME, isSupabaseConfigured, supabase } from './lib/supabase';
import type { Category, Product } from './types/database';

type ActiveTab = 'catalog' | 'mine' | 'admin';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { session, profile, loading, signIn, signUp, signOut, refreshProfile } =
    useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTower, setSelectedTower] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const loadMarketData = useCallback(async () => {
    if (!profile || profile.status !== 'approved') return;
    setDataLoading(true);

    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }),
      supabase
        .from('products')
        .select(
          `
          *,
          seller:profiles!seller_id(id, full_name, unit_number, whatsapp),
          category:categories!category_id(id, name, icon)
        `
        )
        .order('created_at', { ascending: false }),
    ]);

    if (cats) setCategories(cats as Category[]);
    if (prods) setProducts(prods as Product[]);
    setDataLoading(false);
  }, [profile]);

  useEffect(() => {
    void loadMarketData();
  }, [loadMarketData]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeTab === 'mine' && p.seller_id !== profile?.id) return false;
      if (selectedCategory !== 'all' && p.category_id !== selectedCategory) {
        return false;
      }
      if (selectedTower !== 'all') {
        const unit = p.seller?.unit_number || '';
        if (!unit.startsWith(`Torre ${selectedTower} `)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        const matchesSeller = p.seller?.full_name.toLowerCase().includes(q);
        const matchesUnit = p.seller?.unit_number.toLowerCase().includes(q);
        return matchesTitle || matchesDesc || matchesSeller || matchesUnit;
      }
      return true;
    });
  }, [products, activeTab, profile?.id, selectedCategory, selectedTower, searchQuery]);

  const handleDeleteProduct = async (product: Product) => {
    const confirmed = window.confirm(
      `¿Eliminar el anuncio "${product.title}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (!error) {
      if (profile?.role === 'admin' && product.seller_id !== profile.id) {
        await supabase.from('moderation_logs').insert({
          admin_id: profile.id,
          action: 'delete_product',
          target_type: 'product',
          target_id: product.id,
          details: `Eliminado: ${product.title}`,
        });
      }
      await loadMarketData();
    }
  };

  const handleToggleHidden = async (product: Product) => {
    if (profile?.role !== 'admin') return;
    const nextHidden = !product.is_hidden_by_admin;
    let note: string | null = null;

    if (nextHidden) {
      note = window.prompt(
        'Motivo para ocultar este anuncio (visible para el vendedor):',
        'No cumple las normas del condominio.'
      );
      if (note === null) return;
    }

    const { error } = await supabase
      .from('products')
      .update({
        is_hidden_by_admin: nextHidden,
        moderation_note: nextHidden ? note : null,
      })
      .eq('id', product.id);

    if (!error) {
      await supabase.from('moderation_logs').insert({
        admin_id: profile.id,
        action: nextHidden ? 'hide_product' : 'unhide_product',
        target_type: 'product',
        target_id: product.id,
        details: note || product.title,
      });
      await loadMarketData();
    }
  };

  if (!isSupabaseConfigured) {
    return <SetupGuideBanner />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-100 dark:bg-slate-950 text-emerald-900 dark:text-slate-300 text-sm">
        Cargando mercado del condominio...
      </div>
    );
  }

  if (!session || !profile) {
    return (
      <AuthScreen
        theme={theme}
        onToggleTheme={toggleTheme}
        onSignIn={signIn}
        onSignUp={signUp}
      />
    );
  }

  if (profile.status !== 'approved') {
    return (
      <PendingApprovalScreen
        profile={profile}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefresh={refreshProfile}
        onSignOut={signOut}
      />
    );
  }

  return (
    <div className="min-h-screen bg-emerald-100 dark:bg-slate-950 flex flex-col transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-emerald-50/95 dark:bg-slate-900/95 backdrop-blur border-b border-emerald-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-900 dark:text-white leading-tight truncate text-sm sm:text-base">
                {CONDO_NAME}
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-900/75 dark:text-slate-400 flex items-center gap-1 truncate">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">
                  {profile.full_name} · {profile.unit_number}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Publicar</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              className="p-2 rounded-xl border border-emerald-200 dark:border-slate-700 bg-emerald-100/60 dark:bg-slate-800 hover:bg-emerald-200/70 dark:hover:bg-slate-700 text-emerald-800 dark:text-emerald-300 transition"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void signOut()}
              title="Cerrar sesión"
              className="p-2 rounded-xl border border-emerald-200 dark:border-slate-700 hover:bg-emerald-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-3 sm:px-4 flex gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'catalog'
                ? 'border-emerald-600 text-emerald-800 dark:text-emerald-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Store className="w-4 h-4" />
            Catálogo
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mine')}
            className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'mine'
                ? 'border-emerald-600 text-emerald-800 dark:text-emerald-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Mis anuncios
          </button>

          {profile.role === 'admin' && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === 'admin'
                  ? 'border-purple-600 text-purple-700 dark:text-purple-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Administración
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-5 sm:py-6">
        {activeTab === 'admin' && profile.role === 'admin' ? (
          <AdminPanel
            adminId={profile.id}
            categories={categories}
            onDataChanged={loadMarketData}
          />
        ) : (
          <>
            {/* Search, Tower & Category Filters */}
            <div className="space-y-3 sm:space-y-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-emerald-600 dark:text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar productos, servicios, vecino o torre..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-emerald-50/90 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <select
                  value={selectedTower}
                  onChange={(e) => setSelectedTower(e.target.value)}
                  aria-label="Filtrar por torre"
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-50/90 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">Todas las torres (1-11)</option>
                  {Array.from({ length: 11 }, (_, i) => i + 1).map((t) => (
                    <option key={t} value={String(t)}>
                      Torre {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === 'all'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-50/90 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  Todos
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50/90 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-200/60 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {dataLoading ? (
              <div className="text-center py-12 text-emerald-900/70 dark:text-slate-400 text-sm">
                Cargando anuncios...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-14 sm:py-16 px-4 bg-emerald-50/90 dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-slate-800">
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  {activeTab === 'mine'
                    ? 'Aún no has publicado ningún anuncio.'
                    : 'No hay productos en esta sección todavía.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setModalOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Publicar el primero
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    currentUser={profile}
                    onEdit={(p) => {
                      setEditingProduct(p);
                      setModalOpen(true);
                    }}
                    onDelete={handleDeleteProduct}
                    onToggleHidden={handleToggleHidden}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {modalOpen && (
        <ProductModal
          categories={categories}
          sellerId={profile.id}
          editingProduct={editingProduct}
          onClose={() => setModalOpen(false)}
          onSaved={loadMarketData}
        />
      )}
    </div>
  );
}
