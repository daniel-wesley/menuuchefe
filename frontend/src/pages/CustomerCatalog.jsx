import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getProductImageUrl } from '../lib/supabase.js';
import { Search, X, Flame, Utensils, Beef, Beer, IceCreamCone, Eye } from 'lucide-react';

export default function CustomerCatalog() {
  const { apiFetch } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [prodsRes, catsRes] = await Promise.all([
          apiFetch('/api/products'),
          apiFetch('/api/categories')
        ]);
        const prods = prodsRes.ok ? await prodsRes.json() : [];
        const cats = catsRes.ok ? await catsRes.json() : [];
        setProducts(prods.filter(p => p.active !== 0));
        setCategories(cats.filter(c => c.active !== 0).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
      } catch (err) {
        console.error('Erro ao carregar cardápio:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const categoryIcons = {
    lanches: Beef,
    pizzas: Utensils,
   bebidas: Beer,
    sobremesas: IceCreamCone,
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    const matchesSearch = !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedProducts = {};
  filteredProducts.forEach(p => {
    const cat = p.category || 'outros';
    if (!groupedProducts[cat]) groupedProducts[cat] = [];
    groupedProducts[cat].push(p);
  });

  const getCategoryLabel = (catName) => {
    const cat = categories.find(c => c.name === catName);
    return cat ? cat.name : catName;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-stone-400 text-sm font-medium">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans antialiased selection:bg-brand-500 selection:text-white pb-12">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-stone-950/90 backdrop-blur-xl border-b border-stone-800/80">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-red-700 flex items-center justify-center shadow-lg shadow-brand-500/20 ring-2 ring-brand-500/30">
              <Flame className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-wide text-white">
                Cardápio Digital
              </h1>
              <p className="text-xs text-stone-400 mt-0.5">Consulte preços e opções</p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero & Search */}
      <section className="max-w-4xl mx-auto px-4 pt-4 pb-2">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 p-6 border border-stone-800 shadow-2xl">
          <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <span className="text-[11px] uppercase font-bold tracking-widest text-brand-500 bg-brand-500/10 px-2.5 py-1 rounded-md border border-brand-500/20">
              Cardápio Informativo
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 leading-tight">
              Escolha suas opções
            </h2>
            <p className="text-stone-400 text-xs sm:text-sm mt-1 max-w-lg">
              Consulte nossos produtos, porções e preços. Para fazer o pedido, informe ao garçom!
            </p>
            <div className="mt-4 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full bg-stone-900/90 border border-stone-700/80 text-white placeholder-stone-400 text-sm rounded-2xl pl-10 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Categories Nav */}
      <nav className="sticky top-[61px] z-20 bg-stone-950/90 backdrop-blur-xl py-3 border-b border-stone-800/80">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
            <button
              onClick={() => setActiveCategory('all')}
              className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeCategory === 'all'
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30 scale-105 ring-1 ring-brand-400'
                  : 'bg-stone-900 text-stone-400 hover:bg-stone-800 hover:text-white border border-stone-800'
              }`}
            >
              <Flame className={`h-3.5 w-3.5 ${activeCategory === 'all' ? 'text-white' : 'text-brand-500'}`} />
              <span>Todos</span>
            </button>
            {categories.map((cat) => {
              const Icon = categoryIcons[cat.name] || Utensils;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.name)}
                  className={`whitespace-nowrap px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activeCategory === cat.name
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30 scale-105 ring-1 ring-brand-400'
                      : 'bg-stone-900 text-stone-400 hover:bg-stone-800 hover:text-white border border-stone-800'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${activeCategory === cat.name ? 'text-white' : 'text-brand-500'}`} />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Products */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-8">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center mx-auto text-stone-500 text-2xl">
              <Search className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-bold text-stone-300">Nenhum item encontrado</h4>
            <p className="text-xs text-stone-500 max-w-xs mx-auto">
              Tente buscar por outro termo ou navegue pelas categorias acima.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
              className="mt-2 text-xs font-bold text-brand-500 hover:underline"
            >
              Ver todo o cardápio
            </button>
          </div>
        ) : activeCategory === 'all' && !searchQuery ? (
          Object.entries(groupedProducts).map(([catName, items]) => (
            <section key={catName} className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-stone-800/80">
                <h3 className="font-extrabold text-xl text-white tracking-wide">
                  {getCategoryLabel(catName)}
                </h3>
                <span className="text-xs font-semibold text-stone-500 ml-auto">
                  ({items.length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.map((item) => (
                  <ProductCard key={item.id} item={item} onClick={() => setSelectedProduct(item)} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredProducts.map((item) => (
              <ProductCard key={item.id} item={item} onClick={() => setSelectedProduct(item)} />
            ))}
          </div>
        )}
      </main>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl">
            <div className="relative">
              {selectedProduct.image_url ? (
                <img
                  src={getProductImageUrl(selectedProduct.image_url)}
                  alt={selectedProduct.name}
                  className="w-full h-64 sm:h-72 object-cover bg-stone-800"
                  onError={(e) => { e.target.src = 'https://placehold.co/800x400/292524/78716c?text=Sem+Imagem'; }}
                />
              ) : (
                <div className="w-full h-64 sm:h-72 bg-stone-800 flex items-center justify-center text-stone-600 text-4xl">
                  <Utensils className="h-16 w-16" />
                </div>
              )}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition backdrop-blur-md"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-3 bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                {getCategoryLabel(selectedProduct.category)}
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedProduct.name}</h3>
                {selectedProduct.description && (
                  <p className="text-sm text-stone-300 mt-2 leading-relaxed">{selectedProduct.description}</p>
                )}
              </div>
              <div className="pt-4 border-t border-stone-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-stone-400 block uppercase font-semibold">Preço</span>
                  <div className="text-3xl font-extrabold text-brand-500 mt-0.5">
                    R$ {Number(selectedProduct.price).toFixed(2)}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold px-4 py-3 rounded-xl transition flex items-center gap-2"
                >
                  <X className="h-4 w-4" /> Voltar ao Cardápio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function ProductCard({ item, onClick }) {
  const imageUrl = getProductImageUrl(item.image_url);

  return (
    <div
      onClick={onClick}
      className="bg-stone-900/75 backdrop-blur-sm border border-stone-800/80 rounded-2xl p-3.5 flex gap-3.5 hover:border-brand-500/50 cursor-pointer transition duration-300 group"
    >
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden shrink-0 bg-stone-800">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            loading="lazy"
            onError={(e) => { e.target.src = 'https://placehold.co/400x400/292524/78716c?text=Sem+Imagem'; }}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-600">
            <Utensils className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex flex-col justify-between flex-1 py-0.5">
        <div>
          <h4 className="font-bold text-white text-base group-hover:text-brand-500 transition leading-snug">
            {item.name}
          </h4>
          {item.description && (
            <p className="text-xs text-stone-400 mt-1 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-800/60">
          <span className="text-lg font-extrabold text-brand-500">
            R$ {Number(item.price).toFixed(2)}
          </span>
          <span className="text-[11px] font-medium text-stone-400 group-hover:text-white transition flex items-center gap-1">
            <Eye className="h-3.5 w-3.5 text-brand-500" /> Ver Detalhes
          </span>
        </div>
      </div>
    </div>
  );
}
