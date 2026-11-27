import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HelpCircle,
  LogOut,
  Moon,
  Package,
  PlusCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Sun,
  UserCheck,
  UserCog,
} from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { AuthScreen } from './components/AuthScreen';
import { CategoryCarousel } from './components/CategoryCarousel';
import { ConsentModal } from './components/ConsentModal';
import { PendingApprovalScreen } from './components/PendingApprovalScreen';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { ProfileModal } from './components/ProfileModal';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';
import { SetupGuideBanner } from './components/SetupGuideBanner';
import { SupportModal } from './components/SupportModal';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { CONDO_NAME, isSupabaseConfigured, supabase } from './lib/supabase';
import type { Category, Product, SupportContact } from './types/database';

type ActiveTab = 'catalog' | 'mine' | 'admin';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    session,
    profile,
    loading,
    isPasswordRecovery,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    clearPasswordRecovery,
    signOut,
    refreshProfile,
  } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTower, setSelectedTower] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [primarySupportPhone, setPrimarySupportPhone] = useState('');

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

    const { data: supportData } = await supabase.rpc('get_support_contacts');
    if (Array.isArray(supportData) && supportData.length > 0) {
      const first = supportData[0] as SupportContact;
      setPrimarySupportPhone(first.whatsapp || '');
    }

    if (profile.role === 'admin' || profile.role === 'super_admin') {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingCount(count ?? 0);
    }

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

  const isAdminUser =
    profile?.role === 'admin' || profile?.role === 'super_admin';

  const handleDeleteProduct = async (product: Product) => {
    const confirmed = window.confirm(
      `¿Eliminar el anuncio "${product.title}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (!error) {
      if (isAdminUser && profile && product.seller_id !== profile.id) {
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
    if (!isAdminUser || !profile) return;
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
      <div className="min-h-screen flex items-center justify-center bg-emerald-100 dark:bg-slate-950 text-emerald-900 dark:text-slate-300 text-base font-medium">
        Cargando tienda del condominio...
      </div>
    );
  }

  if (isPasswordRecovery) {
    return (
      <ResetPasswordScreen
        onUpdatePassword={updatePassword}
        onCancel={clearPasswordRecovery}
      />
    );
  }

  if (!session || !profile) {
    return (
      <AuthScreen
        theme={theme}
        onToggleTheme={toggleTheme}
        onSignIn={signIn}
        onSignUp={signUp}
        onRequestPasswordReset={requestPasswordReset}
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

  // Si la columna terms_accepted_at existe y es null, solicitar consentimiento explícito una sola vez
  if (profile.terms_accepted_at === null) {
    return (
      <ConsentModal
        mode="mandatory"
        onAccept={async () => {
          const { error } = await supabase.rpc('accept_terms');
          if (error) throw error;
          await refreshProfile();
        }}
        onDecline={signOut}
      />
    );
  }

  return (
    <div className="min-h-screen bg-emerald-100 dark:bg-slate-950 flex flex-col transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-emerald-50/95 dark:bg-slate-900/95 backdrop-blur border-b-2 border-emerald-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm ring-2 ring-emerald-200 dark:ring-emerald-900">
              <Store className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-slate-900 dark:text-white leading-tight truncate text-base sm:text-lg">
                {CONDO_NAME}
              </h1>
              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                title="Editar mis datos"
                className="text-xs sm:text-sm text-emerald-900/80 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-1 truncate font-medium"
              >
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate underline decoration-dotted">
                  {profile.full_name} · {profile.unit_number}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Vender</span>
            </button>

            <button
              type="button"
              onClick={() => setSupportModalOpen(true)}
              title="Ayuda y soporte del condominio"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border border-emerald-300 dark:border-slate-700 bg-emerald-100/70 dark:bg-slate-800 hover:bg-emerald-200/70 dark:hover:bg-slate-700 text-emerald-900 dark:text-emerald-300 text-xs sm:text-sm font-bold transition"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Ayuda</span>
            </button>

            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              title="Editar mis datos o contraseña"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border border-emerald-300 dark:border-slate-700 bg-emerald-100/70 dark:bg-slate-800 hover:bg-emerald-200/70 dark:hover:bg-slate-700 text-emerald-900 dark:text-emerald-300 text-xs sm:text-sm font-bold transition"
            >
              <UserCog className="w-4 h-4" />
              <span className="hidden sm:inline">Mi Perfil</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border border-emerald-300 dark:border-slate-700 bg-emerald-100/70 dark:bg-slate-800 hover:bg-emerald-200/70 dark:hover:bg-slate-700 text-emerald-900 dark:text-emerald-300 text-xs sm:text-sm font-bold transition"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4" />
                  <span className="hidden md:inline">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  <span className="hidden md:inline">Oscuro</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void signOut()}
              title="Cerrar sesión"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border border-emerald-300 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/50 text-slate-800 dark:text-slate-200 hover:text-red-700 dark:hover:text-red-300 text-xs sm:text-sm font-bold transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-3 sm:px-4 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm sm:text-base font-bold rounded-t-xl border-b-3 transition whitespace-nowrap ${
              activeTab === 'catalog'
                ? 'border-emerald-600 text-emerald-900 dark:text-emerald-400 bg-emerald-100/60 dark:bg-slate-800/70'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span>Ver Productos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mine')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm sm:text-base font-bold rounded-t-xl border-b-3 transition whitespace-nowrap ${
              activeTab === 'mine'
                ? 'border-emerald-600 text-emerald-900 dark:text-emerald-400 bg-emerald-100/60 dark:bg-slate-800/70'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Package className="w-5 h-5" />
            <span>Mis Anuncios</span>
          </button>

          {isAdminUser && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm sm:text-base font-bold rounded-t-xl border-b-3 transition whitespace-nowrap ${
                activeTab === 'admin'
                  ? 'border-purple-600 text-purple-800 dark:text-purple-400 bg-purple-100/60 dark:bg-slate-800/70'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              <span>
                {profile.role === 'super_admin' ? 'Super Admin' : 'Administración'}
              </span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-red-600 text-white shadow-xs">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-5 sm:py-6">
        {activeTab === 'admin' && isAdminUser ? (
          <AdminPanel
            adminId={profile.id}
            adminRole={profile.role}
            categories={categories}
            onDataChanged={loadMarketData}
          />
        ) : (
          <>
            {/* Search, Tower & Category Carousel */}
            <div className="space-y-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-emerald-600 dark:text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar producto, comida, vecino o torre..."
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-emerald-50/95 dark:bg-slate-900 border-2 border-emerald-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <select
                  value={selectedTower}
                  onChange={(e) => setSelectedTower(e.target.value)}
                  aria-label="Filtrar por torre"
                  className="px-4 py-3 rounded-2xl bg-emerald-50/95 dark:bg-slate-900 border-2 border-emerald-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">🏢 Todas las torres (1-11)</option>
                  {Array.from({ length: 11 }, (_, i) => i + 1).map((t) => (
                    <option key={t} value={String(t)}>
                      🏢 Torre {t}
                    </option>
                  ))}
                </select>
              </div>

              <CategoryCarousel
                categories={categories}
                selectedCategory={selectedCategory}
                onSelect={setSelectedCategory}
              />
            </div>

            {dataLoading ? (
              <div className="text-center py-12 text-emerald-900/75 dark:text-slate-400 text-base font-medium">
                Cargando anuncios...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-14 sm:py-16 px-4 bg-emerald-50/95 dark:bg-slate-900 rounded-3xl border-2 border-emerald-200 dark:border-slate-800">
                <p className="text-slate-800 dark:text-slate-200 font-bold text-base">
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
                  className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold shadow-sm"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>Publicar mi producto</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    currentUser={profile}
                    supportPhone={primarySupportPhone}
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

      <footer className="border-t border-emerald-200 dark:border-slate-800 bg-emerald-50/80 dark:bg-slate-900/80 py-4 px-4 text-center text-xs text-slate-600 dark:text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            {CONDO_NAME} · Tablero vecinal gratuito (sin intermediación de pagos ni
            entregas).
          </span>
          <button
            type="button"
            onClick={() => setLegalModalOpen(true)}
            className="font-bold text-emerald-800 dark:text-emerald-400 hover:underline"
          >
            Consentimiento, Privacidad y Normas
          </button>
        </div>
      </footer>

      {modalOpen && (
        <ProductModal
          categories={categories}
          sellerId={profile.id}
          editingProduct={editingProduct}
          onClose={() => setModalOpen(false)}
          onSaved={loadMarketData}
        />
      )}

      {/* Botón flotante rápido en móvil para publicar en 1 toque */}
      {activeTab !== 'admin' && !modalOpen && !profileModalOpen && (
        <button
          type="button"
          onClick={() => {
            setEditingProduct(null);
            setModalOpen(true);
          }}
          className="fixed bottom-5 right-5 sm:hidden z-40 inline-flex items-center gap-2 px-5 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-base font-extrabold shadow-xl ring-4 ring-emerald-200/80 dark:ring-emerald-900/70 transition"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Publicar</span>
        </button>
      )}

      {profileModalOpen && (
        <ProfileModal
          targetProfile={profile}
          mode="self"
          onClose={() => setProfileModalOpen(false)}
          onSaved={async () => {
            await refreshProfile();
            await loadMarketData();
          }}
        />
      )}

      {supportModalOpen && (
        <SupportModal
          currentUser={profile}
          onClose={() => setSupportModalOpen(false)}
        />
      )}

      {legalModalOpen && (
        <ConsentModal mode="read" onClose={() => setLegalModalOpen(false)} />
      )}
    </div>
  );
}
