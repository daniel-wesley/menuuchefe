import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getProductImageUrl } from '../lib/supabase.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import Navbar from '../components/Navbar.jsx';
import { 
  Coffee, Pizza, Beer, IceCream, Search, Plus, Minus, Trash2, 
  Check, Play, Receipt, AlertCircle, ShoppingCart, User, X, CreditCard, RefreshCw,
  ShieldAlert, AlertTriangle
} from 'lucide-react';

export default function WaiterDashboard() {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();
  const { 
    items: cartItems, 
    table: cartTable, 
    clientName, 
    setClientName, 
    addToCart, 
    removeFromCart, 
    updateQuantity, 
    clearCart, 
    selectTable,
    totalAmount
  } = useCart();

  const [tables, setTables] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null); // Table object clicked
  const [activeTab, setActiveTab] = useState('mesas'); // 'mesas' or 'pedidos'
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom notes state for the currently adding product
  const [noteText, setNoteText] = useState('');
  const [activeProductForNote, setActiveProductForNote] = useState(null);
  const [selectedObservations, setSelectedObservations] = useState([]);
  const [customObservation, setCustomObservation] = useState('');
  
  // Table active orders modal/view state
  const [viewingBillTable, setViewingBillTable] = useState(null);

  // Replace item flow state
  const [replacingItem, setReplacingItem] = useState(null); // item being replaced
  const [replaceSearchQuery, setReplaceSearchQuery] = useState('');
  const [replaceCategoryFilter, setReplaceCategoryFilter] = useState('');
  const [tableBillDetails, setTableBillDetails] = useState({ orders: [], total: 0 });
  const [licenseBlocked, setLicenseBlocked] = useState(false);

  // ── LICENSE STATUS CHECK ──────────────────────────────────────────────────
  const checkLicenseStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/license/status');
      if (res.ok) {
        const data = await res.json();
        setLicenseBlocked(data.bloqueado);
      }
    } catch (err) {
      console.error('Erro ao verificar licença:', err);
    }
  }, [apiFetch]);

  useEffect(() => { checkLicenseStatus(); }, [checkLicenseStatus]);

  // Load initial tables, products and categories + periodic table sync
  useEffect(() => {
    async function loadData() {
      try {
        const tablesRes = await apiFetch('/api/tables');
        if (tablesRes.ok) {
          const tablesData = await tablesRes.json();
          setTables(tablesData);
        }

        const productsRes = await apiFetch('/api/products');
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setProducts(productsData.filter(p => p.active !== 0));
        }

        const categoriesRes = await apiFetch('/api/categories');
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData);
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      }
    }
    loadData();

    // Auto-refresh tables every 4 seconds so all tablets see occupied/free tables in real time
    const interval = setInterval(async () => {
      try {
        const tablesRes = await apiFetch('/api/tables');
        if (tablesRes.ok) {
          const tablesData = await tablesRes.json();
          setTables(tablesData);
        }
      } catch (_) {}
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Listen to Socket.io events for real-time table status updates
  useEffect(() => {
    if (!socket) return;

    const handleTableStatusChanged = (updatedTable) => {
      setTables((prevTables) =>
        prevTables.map((t) => (t.id === updatedTable.id ? updatedTable : t))
      );
      
      // Update selected table reference if it's the one open
      setSelectedTable((prevSelected) => {
        if (prevSelected && prevSelected.id === updatedTable.id) {
          return updatedTable;
        }
        return prevSelected;
      });
    };

    socket.on('table_status_changed', handleTableStatusChanged);

    return () => {
      socket.off('table_status_changed', handleTableStatusChanged);
    };
  }, [socket]);

  // Open Table (Status -> occupied)
  const handleOpenTable = async (table) => {
    try {
      const res = await apiFetch(`/api/tables/${table.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'occupied' })
      });
      if (res.ok) {
        const updatedTable = await res.json();
        // Update locally
        setSelectedTable(updatedTable);
      }
    } catch (err) {
      console.error('Erro ao abrir mesa:', err);
    }
  };

  // Pedir conta (Status -> waiting_payment)
  const handleRequestBill = async (tableId) => {
    try {
      const res = await apiFetch(`/api/tables/${tableId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'waiting_payment' })
      });
      if (res.ok) {
        const updatedTable = await res.json();
        setSelectedTable(updatedTable);
        setViewingBillTable(null);
      }
    } catch (err) {
      console.error('Erro ao pedir conta:', err);
    }
  };

  // Reabrir mesa (Status -> occupied)
  const handleReopenTable = async (table) => {
    try {
      const res = await apiFetch(`/api/tables/${table.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'occupied' })
      });
      if (res.ok) {
        const updatedTable = await res.json();
        setSelectedTable(updatedTable);
        setViewingBillTable(null);
      } else {
        alert('Erro ao reabrir mesa.');
      }
    } catch (err) {
      console.error('Erro ao reabrir mesa:', err);
    }
  };

  // Liberar mesa sem consumo (Status -> free, token resetado)
  const handleReleaseEmptyTable = async (table) => {
    if (!confirm(`Deseja realmente fechar e liberar a Mesa ${table.number} sem consumo?`)) return;
    try {
      const res = await apiFetch(`/api/tables/${table.id}/reset`, {
        method: 'PUT'
      });
      if (res.ok) {
        setViewingBillTable(null);
        setSelectedTable(null);
        // Recarrega as mesas
        const tablesRes = await apiFetch('/api/tables');
        if (tablesRes.ok) {
          setTables(await tablesRes.json());
        }
        alert('Mesa liberada com sucesso!');
      } else {
        alert('Erro ao liberar mesa.');
      }
    } catch (err) {
      console.error('Erro ao liberar mesa:', err);
    }
  };

  // View Current Table Consumption
  const handleViewBill = async (table) => {
    try {
      const res = await apiFetch(`/api/orders/table/${table.number}/active`);
      if (res.ok) {
        const data = await res.json();
        setTableBillDetails(data);
        setViewingBillTable(table);
      }
    } catch (err) {
      console.error('Erro ao carregar conta da mesa:', err);
    }
  };

  // Handle replacing an item in the active bill
  const handleReplaceItem = async (oldItem, newProduct) => {
    if (!viewingBillTable) return;
    try {
      // 1. Cancel the old item
      const cancelRes = await apiFetch(`/api/orders/item/${oldItem.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ quantity: oldItem.quantity }),
      });
      if (!cancelRes.ok) {
        const err = await cancelRes.json();
        alert(err.message || 'Erro ao remover item antigo.');
        return;
      }

      // 2. Create a new order with the replacement product
      const orderBody = {
        table_id: viewingBillTable.id,
        client_name: null,
        items: [{
          product_id: newProduct.id,
          quantity: oldItem.quantity,
          notes: oldItem.notes || ''
        }]
      };
      const orderRes = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify(orderBody)
      });
      if (!orderRes.ok) {
        const err = await orderRes.json();
        alert(err.message || 'Erro ao inserir novo produto.');
        return;
      }

      // 3. Refresh the bill
      setReplacingItem(null);
      setReplaceSearchQuery('');
      setReplaceCategoryFilter('');
      handleViewBill(viewingBillTable);
      alert(`Produto trocado com sucesso! "${oldItem.name}" ➜ "${newProduct.name}"`);
    } catch (err) {
      console.error('Erro ao trocar produto:', err);
      alert('Falha na conexão ao trocar o produto.');
    }
  };

  // Filter products for the replacement modal
  const replaceFilteredProducts = products.filter((p) => {
    const matchesCategory = replaceCategoryFilter ? p.category === replaceCategoryFilter : true;
    const matchesSearch = replaceSearchQuery
      ? p.name.toLowerCase().includes(replaceSearchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(replaceSearchQuery.toLowerCase()))
      : true;
    return matchesCategory && matchesSearch;
  });

  // Submit order from Cart
  const handleSendOrder = async () => {
    if (!cartTable) return;
    if (!cartItems.length) return;

    try {
      const orderBody = {
        table_id: cartTable.id,
        client_name: clientName,
        items: cartItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          notes: item.notes
        }))
      };

      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify(orderBody)
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || 'Erro ao registrar pedido.');
        return;
      }

      // Atualiza o status da mesa localmente de imediato (sem aguardar socket/realtime)
      setTables((prevTables) =>
        prevTables.map((t) =>
          t.id === cartTable.id ? { ...t, status: 'occupied' } : t
        )
      );

      // Clear cart, navigate back to tables
      clearCart();
      setActiveTab('mesas');
      setSelectedTable(null);
      alert(`Pedido enviado com sucesso para a Mesa ${cartTable.number}!`);
    } catch (err) {
      console.error('Erro ao enviar pedido:', err);
      alert('Falha na conexão com o servidor.');
    }
  };

  // Filter products by search and category
  const filteredProducts = products.filter((p) => {
    const matchesCategory = categoryFilter ? p.category === categoryFilter : true;
    const matchesSearch = searchQuery
      ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    return matchesCategory && matchesSearch;
  });

  const getTableStatusStyle = (status) => {
    switch (status) {
      case 'free':
        return 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 hover:shadow-emerald-500/10';
      case 'occupied':
        return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 hover:shadow-amber-500/10';
      case 'waiting_payment':
        return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 animate-pulse hover:shadow-red-500/10';
      default:
        return 'bg-zinc-50 border-zinc-200 text-zinc-500';
    }
  };

  const getTableStatusLabel = (status) => {
    switch (status) {
      case 'free': return 'Livre';
      case 'occupied': return 'Ocupada';
      case 'waiting_payment': return 'Aguardando Pagamento';
      default: return status;
    }
  };

  // Build categories list with "Todos" option
  const allCategories = [
    { id: '', name: 'Todos', icon: null },
    ...categories.map(c => ({ id: c.name, name: c.name, icon: null }))
  ];

  const getCategoryIcon = (categoryName) => {
    switch (categoryName) {
      case 'pizzas': return Pizza;
      case 'bebidas': return Beer;
      case 'sobremesas': return IceCream;
      default: return Coffee;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-200 pb-20 sm:pb-0">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Navigation Tabs (Mobile optimized top tabs) */}
        <div className="flex border-b border-zinc-200 dark:border-dark-border mb-8">
          <button
            onClick={() => { setActiveTab('mesas'); setSelectedTable(null); }}
            className={`flex-1 py-4 text-center font-bold border-b-2 transition-all duration-200 ${
              activeTab === 'mesas'
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Mesas
          </button>
          <button
            onClick={() => {
              if (!cartTable) {
                alert('Selecione uma mesa ocupada primeiro para lançar pedidos.');
                setActiveTab('mesas');
                return;
              }
              setActiveTab('pedidos');
            }}
            className={`flex-1 py-4 text-center font-bold border-b-2 transition-all duration-200 flex items-center justify-center space-x-2 ${
              activeTab === 'pedidos'
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <span>Lançar Pedido</span>
            {cartItems.length > 0 && (
              <span className="bg-brand-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {cartItems.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Mesas Grid */}
        {activeTab === 'mesas' && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {tables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`flex flex-col items-center justify-center p-6 border-2 rounded-2xl transition-all duration-300 shadow-md ${getTableStatusStyle(table.status)}`}
                >
                  <span className="text-sm font-semibold uppercase tracking-widest opacity-60">Mesa</span>
                  <span className="text-4xl font-extrabold my-2">{table.number}</span>
                  <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-white/60 dark:bg-zinc-900/40">
                    {getTableStatusLabel(table.status)}
                  </span>
                </button>
              ))}
            </div>

            {/* Table Details Sidebar/Modal */}
            {selectedTable && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-md w-full rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                  {licenseBlocked ? (
                    <>
                      {/* CABEÇALHO VERMELHO - LICENÇA EXPIRADA */}
                      <div className="bg-gradient-to-r from-red-600 to-red-700 p-5 flex items-center justify-between animate-pulse-red">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-white/20 rounded-xl">
                            <ShieldAlert className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-white text-base">LICENÇA EXPIRADA</h3>
                            <p className="text-red-100 text-xs">Sistema bloqueado</p>
                          </div>
                        </div>
                        <button onClick={() => setSelectedTable(null)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* CONTEÚDO - MENSAGEM EXPLÍCITA */}
                      <div className="p-6 space-y-4">
                        <div className="flex justify-center">
                          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
                            <AlertTriangle className="h-12 w-12 text-red-600 dark:text-red-400" />
                          </div>
                        </div>

                        <div className="text-center space-y-2">
                          <h4 className="text-lg font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wide">
                            Atenção!
                          </h4>
                          <p className="text-zinc-700 dark:text-dark-text font-semibold">
                            A licença deste sistema <span className="text-red-600 dark:text-red-400 font-extrabold">EXPIROU</span>.
                          </p>
                          <p className="text-sm text-zinc-500 dark:text-dark-muted leading-relaxed">
                            O sistema está <strong className="text-red-600 dark:text-red-400">BLOQUEADO</strong> e não é possível abrir mesas ou lançar pedidos até que uma nova chave de licença seja ativada.
                          </p>
                        </div>

                        <div className="bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-800/40 rounded-xl p-4">
                          <p className="text-sm text-red-700 dark:text-red-300 font-bold text-center">
                            Entre em contato com o <span className="underline">administrador do sistema</span> para obter uma nova licença.
                          </p>
                        </div>

                        <button
                          onClick={() => setSelectedTable(null)}
                          className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-red-500/20"
                        >
                          Entendido
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-6 border-b border-zinc-100 dark:border-dark-border flex justify-between items-center bg-zinc-50 dark:bg-dark-element/50">
                        <div>
                          <h3 className="font-extrabold text-2xl text-zinc-900 dark:text-dark-text">Mesa {selectedTable.number}</h3>
                          <p className="text-xs font-semibold text-zinc-500 dark:text-dark-muted mt-0.5">
                            Status: <span className="text-brand-500 font-bold">{getTableStatusLabel(selectedTable.status)}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedTable(null)}
                          className="p-2 rounded-lg bg-zinc-150 hover:bg-zinc-200 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-500 transition duration-200"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="p-6 space-y-4">
                        {/* Free Table Actions */}
                        {selectedTable.status === 'free' && (
                          <button
                            onClick={() => handleOpenTable(selectedTable)}
                            className="w-full py-4 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-all duration-200"
                          >
                            <Play className="h-5 w-5" />
                            <span>Abrir Mesa</span>
                          </button>
                        )}

                        {/* Occupied Table Actions */}
                        {selectedTable.status !== 'free' && (
                          <div className="grid grid-cols-1 gap-3">
                            {selectedTable.status === 'waiting_payment' ? (
                              <button
                                onClick={() => handleReopenTable(selectedTable)}
                                className="w-full py-4 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 transition-all duration-200"
                              >
                                <span>Reabrir Mesa (Liberar novos pedidos)</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  selectTable(selectedTable.id, selectedTable.number);
                                  setActiveTab('pedidos');
                                  setSelectedTable(null);
                                }}
                                className="w-full py-4 px-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 flex items-center justify-center space-x-2 transition-all duration-200"
                              >
                                <Plus className="h-5 w-5" />
                                <span>Lançar Pedidos</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleViewBill(selectedTable)}
                              className="w-full py-4 px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-800 dark:text-dark-text font-bold rounded-xl flex items-center justify-center space-x-2 border border-zinc-200 dark:border-dark-border transition-all duration-200"
                            >
                              <Receipt className="h-5 w-5 text-brand-500" />
                              <span>Ver Consumo / Conta</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Lançar Pedidos Drawer / Screen */}
        {activeTab === 'pedidos' && cartTable && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Catalog (Left side - col 7) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Table Indicator & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-dark-card p-4 rounded-2xl border border-zinc-200 dark:border-dark-border">
                <div className="flex items-center space-x-2">
                  <span className="bg-brand-100 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 font-bold px-3 py-1.5 rounded-xl text-sm">
                    Mesa {cartTable.number}
                  </span>
                  <div className="flex items-center text-xs text-zinc-400 font-medium">
                    <User className="h-3.5 w-3.5 mr-1" />
                    <input
                      type="text"
                      placeholder="Nome do cliente (opcional)"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="bg-transparent border-b border-zinc-200 dark:border-dark-border focus:border-brand-500 focus:outline-none py-0.5 text-zinc-700 dark:text-dark-text"
                    />
                  </div>
                </div>
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Buscar prato..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-full sm:w-64"
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
                {allCategories.map((cat) => {
                  const Icon = cat.icon || getCategoryIcon(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`px-4 py-2.5 rounded-xl font-bold flex items-center space-x-1.5 text-xs whitespace-nowrap border transition-all duration-200 ${
                        categoryFilter === cat.id
                          ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/10'
                          : 'bg-white dark:bg-dark-card border-zinc-200 dark:border-dark-border text-zinc-500 dark:text-dark-muted hover:text-zinc-700 dark:hover:text-zinc-300'
                      }`}
                    >
                      {Icon && <Icon className="h-4 w-4" />}
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Product Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-2xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition duration-200"
                  >
                    {prod.image_url ? (
                      <img
                        src={getProductImageUrl(prod.image_url)}
                        alt={prod.name}
                        className="h-36 w-full object-cover"
                      />
                    ) : (
                      <div className="h-36 w-full bg-gradient-to-br from-brand-400 to-amber-600 flex items-center justify-center text-white">
                        <UtensilsIcon category={prod.category} />
                      </div>
                    )}
                    
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-extrabold text-zinc-900 dark:text-dark-text">{prod.name}</h4>
                          <span className="text-brand-500 dark:text-brand-400 font-extrabold">
                            R$ {prod.price.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-dark-muted mt-1.5 line-clamp-2">
                          {prod.description}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[10px] bg-zinc-100 dark:bg-dark-element text-zinc-500 px-2 py-0.5 rounded font-semibold">
                          {prod.track_stock === 1 ? `Estoque: ${prod.stock}` : 'Sem limite'}
                        </span>
                        
                        <button
                          onClick={() => {
                            setActiveProductForNote(prod);
                            setNoteText('');
                          }}
                          disabled={prod.track_stock === 1 && prod.stock <= 0}
                          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed text-white p-2 rounded-xl transition duration-200 shadow-md shadow-brand-500/10"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-12 bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-2xl">
                  <AlertCircle className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
                  <p className="text-zinc-500 dark:text-dark-muted font-bold">Nenhum produto cadastrado nesta categoria.</p>
                </div>
              )}
            </div>

            {/* Cart Drawer (Right side - col 5) */}
            <div className="lg:col-span-5 bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-2xl shadow-md p-6 h-fit sticky top-24">
              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-dark-border pb-4 mb-4">
                <div className="flex items-center space-x-2">
                  <ShoppingCart className="h-5 w-5 text-brand-500" />
                  <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text">Pedido Lançado</h3>
                </div>
                <button
                  onClick={clearCart}
                  className="text-xs font-bold text-red-500 hover:underline"
                >
                  Limpar Tudo
                </button>
              </div>

              {/* Cart Items List */}
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {cartItems.map((item, idx) => (
                  <div
                    key={`${item.product_id}-${idx}-${item.notes}`}
                    className="flex items-start justify-between bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border/50 p-3 rounded-xl"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-bold text-sm text-zinc-900 dark:text-dark-text truncate">{item.name}</p>
                      <p className="text-xs text-brand-500 dark:text-brand-400 font-extrabold">
                        R$ {item.price.toFixed(2)}
                      </p>
                      {item.notes && (
                        <p className="text-[10px] text-zinc-500 dark:text-dark-muted italic bg-white dark:bg-zinc-900/40 p-1.5 rounded mt-1 border border-zinc-150 dark:border-dark-border/40">
                          Obs: {item.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end space-y-2">
                      <div className="flex items-center space-x-2 bg-white dark:bg-zinc-900/60 p-1 border border-zinc-200 dark:border-dark-border rounded-lg scale-90">
                        <button
                          onClick={() => updateQuantity(item.product_id, item.notes, item.quantity - 1)}
                          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="font-bold text-xs px-1 text-zinc-700 dark:text-dark-text">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.notes, item.quantity + 1)}
                          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      
                      <button
                        onClick={() => removeFromCart(item.product_id, item.notes)}
                        className="text-red-500 hover:text-red-600 scale-90"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {cartItems.length === 0 && (
                  <div className="text-center py-8 text-zinc-400">
                    <p className="text-sm font-medium">Carrinho de pedidos vazio.</p>
                    <p className="text-xs mt-1">Clique no "+" nos produtos à esquerda.</p>
                  </div>
                )}
              </div>

              {/* Total & Submit */}
              {cartItems.length > 0 && (
                <div className="border-t border-zinc-100 dark:border-dark-border pt-4 mt-4 space-y-4">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-zinc-500 dark:text-dark-muted">Valor Total:</span>
                    <span className="text-xl text-zinc-900 dark:text-dark-text">R$ {totalAmount.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={handleSendOrder}
                    className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 transition duration-200 text-sm flex items-center justify-center space-x-2"
                  >
                    <Check className="h-5 w-5" />
                    <span>Enviar Pedido à Cozinha</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal for adding product custom observations/notes */}
        {activeProductForNote && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="p-4 bg-zinc-50 dark:bg-dark-element/50 border-b border-zinc-100 dark:border-dark-border flex justify-between items-center">
                <div>
                  <h4 className="font-extrabold text-zinc-900 dark:text-dark-text text-md">{activeProductForNote.name}</h4>
                  <p className="text-xs font-bold text-brand-500">R$ {activeProductForNote.price.toFixed(2)}</p>
                </div>
                <button
                  onClick={() => {
                    setActiveProductForNote(null);
                    setSelectedObservations([]);
                    setCustomObservation('');
                  }}
                  className="p-1 rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Opções e Observações Pré-definidas */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-dark-muted">
                    Opções e Observações
                  </label>
                  {activeProductForNote.observations && JSON.parse(activeProductForNote.observations).length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {JSON.parse(activeProductForNote.observations).map((obs, idx) => {
                        const isChecked = selectedObservations.includes(obs);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                setSelectedObservations(selectedObservations.filter(item => item !== obs));
                              } else {
                                setSelectedObservations([...selectedObservations, obs]);
                              }
                            }}
                            className={`p-3 text-left rounded-xl border text-xs font-semibold transition duration-150 flex items-center space-x-2 ${
                              isChecked
                                ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-500 text-brand-600 dark:text-brand-400'
                                : 'bg-zinc-50 dark:bg-dark-element border-zinc-200 dark:border-dark-border text-zinc-700 dark:text-dark-text hover:bg-zinc-100'
                            }`}
                          >
                            <div className={`h-4 w-4 rounded flex items-center justify-center border transition ${
                              isChecked ? 'bg-brand-500 border-brand-500 text-white' : 'border-zinc-300 dark:border-dark-border bg-white dark:bg-dark-card'
                            }`}>
                              {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                            <span className="truncate">{obs}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">Este produto não possui observações pré-definidas.</p>
                  )}
                </div>

                {/* Campo de Texto Livre */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-dark-muted">
                    Observação Adicional
                  </label>
                  <textarea
                    rows="2"
                    value={customObservation}
                    onChange={(e) => setCustomObservation(e.target.value)}
                    className="w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                    placeholder="Ex: ponto da carne, talheres, sem gelo..."
                  ></textarea>
                </div>

                <button
                  onClick={() => {
                    const todasObs = [...selectedObservations];
                    if (customObservation.trim()) {
                      todasObs.push(customObservation.trim());
                    }
                    addToCart(activeProductForNote, todasObs.join(', '));
                    setActiveProductForNote(null);
                    setSelectedObservations([]);
                    setCustomObservation('');
                    setNoteText('');
                  }}
                  className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-sm transition duration-200"
                >
                  Adicionar ao Pedido — R$ {activeProductForNote.price.toFixed(2)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal for viewing active table consumption/bill */}
        {viewingBillTable && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-zinc-100 dark:border-dark-border bg-zinc-50 dark:bg-dark-element/50 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-2xl text-zinc-900 dark:text-dark-text">Mesa {viewingBillTable.number} - Consumo</h3>
                  <p className="text-xs font-semibold text-zinc-400">Detalhamento dos pedidos enviados</p>
                </div>
                <button
                  onClick={() => setViewingBillTable(null)}
                  className="p-2 rounded-lg bg-zinc-150 hover:bg-zinc-200 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-500 transition duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[400px] overflow-y-auto">
                {tableBillDetails.orders.length > 0 ? (
                  <div className="space-y-6">
                    {tableBillDetails.orders.map((order, orderIdx) => (
                      <div key={order.id} className="border-b border-dashed border-zinc-200 dark:border-dark-border/50 pb-4 last:border-b-0 last:pb-0">
                        <div className="flex justify-between items-center text-xs mb-2">
                          <span className="font-bold text-zinc-500 dark:text-dark-muted">
                            Pedido #{order.id} {order.client_name ? `(${order.client_name})` : ''}
                          </span>
                          <span className="text-brand-500 font-semibold">
                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {order.items.map((item, itemIdx) => (
                            <div key={itemIdx} className="flex justify-between items-start text-sm">
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-zinc-700 dark:text-dark-text">{item.quantity}x</span>{' '}
                                <span className="text-zinc-600 dark:text-dark-muted">{item.name}</span>
                                {item.notes && (
                                  <span className="block text-[10px] text-zinc-400 italic">
                                    Nota: {item.notes}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 ml-2">
                                <span className="font-bold text-zinc-800 dark:text-dark-text whitespace-nowrap">
                                  R$ {(item.price * item.quantity).toFixed(2)}
                                </span>
                                <button
                                  onClick={() => setReplacingItem(item)}
                                  title="Trocar este item"
                                  className="p-1 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded-lg transition"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-400">
                    <p className="text-sm font-semibold">Nenhum consumo registrado ainda nesta mesa.</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-zinc-50 dark:bg-dark-element/50 border-t border-zinc-150 dark:border-dark-border flex flex-col space-y-4">
                {/* Subtotal, Gorjeta e Total Geral */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500 dark:text-dark-muted font-semibold">Subtotal:</span>
                    <span className="font-bold text-zinc-700 dark:text-dark-text">R$ {tableBillDetails.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Gorjeta (10%):</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">R$ {(tableBillDetails.total * 0.10).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-dashed border-zinc-200 dark:border-dark-border pt-1.5">
                    <span className="text-zinc-800 dark:text-dark-text font-extrabold">Total Geral:</span>
                    <span className="text-2xl text-zinc-950 dark:text-dark-text font-extrabold">R$ {(tableBillDetails.total * 1.10).toFixed(2)}</span>
                  </div>
                </div>

                {viewingBillTable.status === 'occupied' && tableBillDetails.total > 0 && (
                  <button
                    onClick={() => handleRequestBill(viewingBillTable.id)}
                    className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 flex items-center justify-center space-x-2 transition duration-200"
                  >
                    <Receipt className="h-5 w-5" />
                    <span>Solicitar Fechamento da Conta</span>
                  </button>
                )}

                {tableBillDetails.total === 0 && (
                  <button
                    onClick={() => handleReleaseEmptyTable(viewingBillTable)}
                    className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 transition duration-200"
                  >
                    <Receipt className="h-5 w-5" />
                    <span>Liberar Mesa sem Consumo</span>
                  </button>
                )}

                {viewingBillTable.status === 'waiting_payment' && tableBillDetails.total > 0 && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 p-3 rounded-xl text-center text-xs font-semibold">
                    Esta mesa já está solicitando pagamento no Caixa!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal for replacing an item — product selection */}
        {replacingItem && (
          <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
              <div className="p-5 border-b border-zinc-100 dark:border-dark-border bg-amber-50 dark:bg-amber-950/20 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text flex items-center space-x-2">
                    <RefreshCw className="h-5 w-5 text-amber-500" />
                    <span>Trocar Produto</span>
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-dark-muted mt-0.5">
                    Substituindo: <strong className="text-amber-600">{replacingItem.quantity}x {replacingItem.name}</strong>
                  </p>
                </div>
                <button
                  onClick={() => { setReplacingItem(null); setReplaceSearchQuery(''); setReplaceCategoryFilter(''); }}
                  className="p-2 rounded-lg bg-zinc-150 hover:bg-zinc-200 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-500 transition duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search and category filters */}
              <div className="p-4 border-b border-zinc-100 dark:border-dark-border space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Buscar novo produto..."
                    value={replaceSearchQuery}
                    onChange={(e) => setReplaceSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-full"
                  />
                </div>
                <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setReplaceCategoryFilter(cat.id)}
                        className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1 text-[10px] whitespace-nowrap border transition-all duration-200 ${
                          replaceCategoryFilter === cat.id
                            ? 'bg-brand-500 border-brand-500 text-white'
                            : 'bg-white dark:bg-dark-card border-zinc-200 dark:border-dark-border text-zinc-500'
                        }`}
                      >
                        {Icon && <Icon className="h-3 w-3" />}
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Products list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {replaceFilteredProducts.map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => {
                      if (confirm(`Confirmar troca?\n\nRemover: ${replacingItem.quantity}x ${replacingItem.name}\nAdicionar: ${replacingItem.quantity}x ${prod.name}\n\nPreço unitário: R$ ${prod.price.toFixed(2)}`)) {
                        handleReplaceItem(replacingItem, prod);
                      }
                    }}
                    disabled={prod.track_stock === 1 && prod.stock < replacingItem.quantity}
                    className="w-full flex items-center justify-between bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border/50 p-3 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-950/10 hover:border-brand-200 dark:hover:border-brand-800/40 transition duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {prod.image_url ? (
                        <img
                          src={getProductImageUrl(prod.image_url)}
                          alt={prod.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-400 to-amber-600 flex items-center justify-center text-white">
                          <UtensilsIcon category={prod.category} />
                        </div>
                      )}
                      <div className="text-left flex-1 min-w-0">
                        <p className="font-bold text-sm text-zinc-900 dark:text-dark-text truncate">{prod.name}</p>
                        <p className="text-[10px] text-zinc-400">{prod.category} · {prod.track_stock === 1 ? `Estoque: ${prod.stock}` : 'Sem limite'}</p>
                      </div>
                    </div>
                    <span className="text-brand-500 font-extrabold text-sm whitespace-nowrap ml-2">R$ {prod.price.toFixed(2)}</span>
                  </button>
                ))}
                {replaceFilteredProducts.length === 0 && (
                  <div className="text-center py-8 text-zinc-400">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm font-medium">Nenhum produto encontrado.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-dark-card border-t border-zinc-200 dark:border-dark-border flex">
        <button
          onClick={() => { setActiveTab('mesas'); setSelectedTable(null); }}
          className={`flex-1 flex flex-col items-center justify-center py-3 space-y-1 text-xs font-bold transition-colors ${
            activeTab === 'mesas' ? 'text-brand-500' : 'text-zinc-400'
          }`}
        >
          <ShoppingCart className="h-5 w-5" />
          <span>Mesas</span>
        </button>

        <button
          onClick={() => {
            if (!cartTable) { alert('Selecione uma mesa primeiro.'); return; }
            setActiveTab('pedidos');
          }}
          className={`flex-1 flex flex-col items-center justify-center py-3 space-y-1 text-xs font-bold transition-colors relative ${
            activeTab === 'pedidos' ? 'text-brand-500' : 'text-zinc-400'
          }`}
        >
          <Plus className="h-5 w-5" />
          {cartItems.length > 0 && (
            <span className="absolute top-2 right-[calc(50%-18px)] bg-brand-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
              {cartItems.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
          <span>Pedido</span>
        </button>

        <button
          onClick={() => navigate('/caixa')}
          className="flex-1 flex flex-col items-center justify-center py-3 space-y-1 text-xs font-bold text-zinc-400 hover:text-brand-500 transition-colors relative"
        >
          <CreditCard className="h-5 w-5" />
          {tables.filter(t => t.status === 'waiting_payment').length > 0 && (
            <span className="absolute top-2 right-[calc(50%-18px)] bg-red-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
              {tables.filter(t => t.status === 'waiting_payment').length}
            </span>
          )}
          <span>Caixa</span>
        </button>
      </nav>
    </div>
  );
}

// Category Icons Selector Component
function UtensilsIcon({ category }) {
  switch (category) {
    case 'pizzas':
      return <Pizza className="h-10 w-10" />;
    case 'bebidas':
      return <Beer className="h-10 w-10" />;
    case 'sobremesas':
      return <IceCream className="h-10 w-10" />;
    default:
      return <Coffee className="h-10 w-10" />;
  }
}
