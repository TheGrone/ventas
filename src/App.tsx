import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Store,
  UserCheck,
} from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { AuthScreen } from './components/AuthScreen';
import { PendingApprovalScreen } from './components/PendingApprovalScreen';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { SetupGuideBanner } from './components/SetupGuideBanner';
import { useAuth } from './hooks/useAuth';
import { CONDO_NAME, isSupabaseConfigured, supabase } from './lib/supabase';
import type { Category, Product } from './types/database';

type ActiveTab = 'catalog' | 'mine' | 'admin';

export default function App() {
  const { session, profile, loading, signIn, signUp, signOut, refreshProfile } =
    useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
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
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        const matchesSeller = p.seller?.full_name.toLowerCase().includes(q);
        return matchesTitle || matchesDesc || matchesSeller;
      }
      return true;
    });
  }, [products, activeTab, profile?.id, selectedCategory, searchQuery]);

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Cargando mercado del condominio...
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />;
  }

  if (profile.status !== 'approved') {
    return (
      <PendingApprovalScreen
        profile={profile}
        onRefresh={refreshProfile}
        onSignOut={signOut}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">
                {CONDO_NAME}
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                {profile.full_name} · {profile.unit_number}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Publicar
            </button>

            <button
              type="button"
              onClick={() => void signOut()}
              title="Cerrar sesión"
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'catalog'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-4 h-4" />
            Catálogo
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mine')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'mine'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Mis anuncios
          </button>

          {profile.role === 'admin' && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === 'admin'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Administración
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {activeTab === 'admin' && profile.role === 'admin' ? (
          <AdminPanel
            adminId={profile.id}
            categories={categories}
            onDataChanged={loadMarketData}
          />
        ) : (
          <>
            {/* Search & Category Filters */}
            <div className="space-y-4 mb-6">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar productos, servicios o vecino..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
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
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {dataLoading ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                Cargando anuncios...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <p className="text-slate-600 font-medium">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
