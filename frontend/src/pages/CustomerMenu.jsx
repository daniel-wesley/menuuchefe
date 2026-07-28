import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getProductImageUrl } from '../lib/supabase.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import Navbar from '../components/Navbar.jsx';
import { 
  Coffee, Pizza, Beer, IceCream, Search, Plus, Minus, Trash2, 
  Check, Play, Receipt, AlertCircle, ShoppingCart, User, X, 
  Sparkles, CheckCircle2, Clock, ChefHat, HeartHandshake 
} from 'lucide-react';

export default function CustomerMenu() {
  const { number } = useParams(); // table number
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token'); // table token from QR

  const { apiFetch } = useAuth();
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

  const [tableData, setTableData] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom notes state
  const [noteText, setNoteText] = useState('');
  const [activeProductForNote, setActiveProductForNote] = useState(null);
  const [selectedObservations, setSelectedObservations] = useState([]);
  const [customObservation, setCustomObservation] = useState('');

  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [mySubmittedOrders, setMySubmittedOrders] = useState(() => {
    const saved = localStorage.getItem(`submitted_orders_table_${number}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Verify table token and load menu
  useEffect(() => {
    async function loadInitialData() {
      if (!number || !token) {
        setErrorMsg('Parâmetros de mesa inválidos. Por favor, escaneie o QR Code na mesa física.');
        setLoading(false);
        return;
      }

      try {
        // Load table — apiFetch handles both backend and Supabase fallback
        const tableRes = await apiFetch(`/api/tables/number/${number}?token=${token}`);
        let tableJson = null;
        if (tableRes.ok) {
          tableJson = await tableRes.json();
        }

        if (!tableJson) {
          setErrorMsg('Mesa não encontrada ou QR Code expirado. Chame o garçom para verificar a mesa.');
          setLoading(false);
          return;
        }

        setTableData(tableJson);
        selectTable(tableJson.id, tableJson.number);

        // Load products
        const productsRes = await apiFetch('/api/products');
        const prods = productsRes.ok ? await productsRes.json() : [];
        setProducts(prods);

        // Load categories
        const categoriesRes = await apiFetch('/api/categories');
        const cats = categoriesRes.ok ? await categoriesRes.json() : [];
        setCategories(cats);
      } catch (err) {
        console.error(err);
        setErrorMsg('Erro de conexão ao validar mesa.');
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [number, token]);

  // Load latest order status checks from database
  useEffect(() => {
    if (!mySubmittedOrders.length) return;

    async function checkOrderStatus() {
      try {
        const updatedOrders = [];
        for (const localOrder of mySubmittedOrders) {
          if (localOrder.status === 'delivered') {
            updatedOrders.push(localOrder);
            continue;
          }
          const res = await apiFetch(`/api/orders/${localOrder.id}`);
          if (res.ok) {
            const data = await res.json();
            updatedOrders.push(data);
          } else {
            updatedOrders.push(localOrder);
          }
        }
        setMySubmittedOrders(updatedOrders);
        localStorage.setItem(`submitted_orders_table_${number}`, JSON.stringify(updatedOrders));
      } catch (e) {
        console.error('Error refreshing client orders:', e);
      }
    }

    checkOrderStatus();
  }, [number]);

  // Listen to Socket.io events for status updates in real-time
  useEffect(() => {
    if (!socket) return;

    const handleOrderStatusChanged = (updatedOrder) => {
      // Check if this updated order belongs to the customer's submitted list
      setMySubmittedOrders((prevOrders) => {
        if (prevOrders.some(o => o.id === updatedOrder.id)) {
          const newOrders = prevOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
          localStorage.setItem(`submitted_orders_table_${number}`, JSON.stringify(newOrders));
          return newOrders;
        }
        return prevOrders;
      });
    };

    socket.emit('join_room', { tableNumber: parseInt(number) });
    socket.on('order_status_changed', handleOrderStatusChanged);

    return () => {
      socket.off('order_status_changed', handleOrderStatusChanged);
    };
  }, [socket, number]);

  // Submit Order from Customer
  const handleSendOrder = async () => {
    if (!tableData) return;
    if (!cartItems.length) return;

    try {
      const orderBody = {
        table_id: tableData.id,
        client_name: clientName ? `Cliente: ${clientName}` : 'Cliente (Mesa)',
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

      // Add to local submitted orders tracker
      const newSubmitted = [data, ...mySubmittedOrders];
      setMySubmittedOrders(newSubmitted);
      localStorage.setItem(`submitted_orders_table_${number}`, JSON.stringify(newSubmitted));

      // Reset cart
      clearCart();
      setShowCartDrawer(false);
      alert('Pedido enviado à cozinha com sucesso! Acompanhe o status nesta tela.');
    } catch (err) {
      console.error('Erro ao enviar pedido:', err);
      alert('Erro de conexão ao enviar pedido.');
    }
  };

  const getOrderStatusBadge = (status) => {
    switch (status) {
      case 'received':
        return (
          <span className="inline-flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded-full border dark:border-zinc-700">
            <Clock className="h-3 w-3 text-zinc-400" />
            <span>Recebido na Cozinha</span>
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center space-x-1 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/30">
            <ChefHat className="h-3 w-3 text-amber-500 animate-bounce" />
            <span>Sendo Preparado</span>
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center space-x-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/30 animate-pulse">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span>Pronto! Garçom a caminho</span>
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center space-x-1 bg-zinc-100 text-zinc-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
            <span>Entregue</span>
          </span>
        );
      default:
        return status;
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-dark-bg">
        <Sparkles className="h-10 w-10 text-brand-500 animate-spin" />
        <p className="mt-4 text-zinc-500 dark:text-dark-muted font-bold">Validando mesa...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-dark-bg p-4">
        <div className="max-w-md w-full text-center bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-8 rounded-2xl shadow-xl">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/20 text-red-650 dark:text-red-400 mb-6">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-950 dark:text-dark-text tracking-tight mb-2">QR Code Inválido</h1>
          <p className="text-zinc-650 dark:text-dark-muted text-sm mb-6">{errorMsg}</p>
          <div className="bg-zinc-50 dark:bg-dark-element border dark:border-dark-border p-4 rounded-xl text-left flex items-start space-x-3 text-xs">
            <HeartHandshake className="h-5 w-5 text-brand-500 flex-shrink-0 mt-0.5" />
            <p className="text-zinc-500 dark:text-dark-muted">
              Caso já esteja sentado na mesa, chame o garçom para liberar a mesa e gerar um novo QR Code de acesso para você.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-200 pb-28">
      {/* Dynamic Header */}
      <header className="sticky top-0 z-45 bg-white/80 dark:bg-dark-card/85 backdrop-blur-md border-b border-zinc-200 dark:border-dark-border py-4">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-brand-500 text-white p-2 rounded-xl">
              <Coffee className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-lg text-zinc-900 dark:text-dark-text">MenuChef</span>
          </div>

          <div className="bg-brand-100 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 font-extrabold px-3.5 py-1.5 rounded-xl text-sm">
            Mesa {number}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-brand-500 to-amber-600 p-6 rounded-3xl text-white shadow-xl shadow-brand-500/10">
          <h2 className="text-2xl font-extrabold tracking-tight">Faça seu Pedido</h2>
          <p className="text-xs text-white/85 mt-1 font-medium">Cardápio digital em tempo real. Peça pelo celular e receba direto na mesa!</p>
          
          <div className="mt-4 flex items-center space-x-2 bg-white/10 p-2.5 rounded-xl text-xs font-semibold">
            <User className="h-4 w-4" />
            <input
              type="text"
              placeholder="Digite seu nome (Opcional)"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="bg-transparent border-none placeholder-white/60 text-white focus:outline-none flex-1 font-medium"
            />
          </div>
        </div>

        {/* Real-time Order Trackers */}
        {mySubmittedOrders.filter(o => o.status !== 'delivered').length > 0 && (
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-5 rounded-2xl shadow-sm space-y-3.5">
            <h3 className="font-extrabold text-sm text-zinc-800 dark:text-dark-text uppercase tracking-wide">Acompanhe seus Pedidos</h3>
            <div className="space-y-3">
              {mySubmittedOrders.filter(o => o.status !== 'delivered').map((order) => (
                <div key={order.id} className="flex justify-between items-center bg-zinc-50 dark:bg-dark-element/50 border border-zinc-200 dark:border-dark-border p-3.5 rounded-xl text-xs">
                  <div>
                    <span className="font-bold text-zinc-800 dark:text-dark-text">Pedido #{order.id}</span>
                    <span className="text-zinc-400 block mt-0.5">
                      {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                    </span>
                  </div>
                  {getOrderStatusBadge(order.status)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search & Categories */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Pesquisar prato..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-white dark:bg-dark-card focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm text-zinc-950 dark:text-dark-text"
            />
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
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
        </div>

        {/* Product Menu Cards */}
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
                  <UtensilsCategoryIcon category={prod.category} />
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
                  <span className="text-[10px] text-zinc-400 font-medium">
                    {prod.track_stock === 1 && prod.stock <= 0 ? 'Indisponível' : ''}
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
          <div className="text-center py-12 bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-2xl text-zinc-400">
            <AlertCircle className="h-10 w-10 mx-auto mb-3" />
            <p className="text-sm font-bold">Nenhum produto cadastrado.</p>
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-dark-card/95 border-t border-zinc-200 dark:border-dark-border py-4 px-6 flex justify-between items-center max-w-3xl mx-auto shadow-2xl rounded-t-3xl backdrop-blur-md">
          <div>
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Seu carrinho</p>
            <p className="text-lg font-extrabold text-zinc-900 dark:text-dark-text">R$ {totalAmount.toFixed(2)}</p>
          </div>

          <button
            onClick={() => setShowCartDrawer(true)}
            className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-sm flex items-center space-x-2 shadow-lg shadow-brand-500/20 transition-all duration-200"
          >
            <ShoppingCart className="h-4.5 w-4.5" />
            <span>Ver Sacola</span>
            <span className="bg-white text-brand-500 text-xs px-2 py-0.5 rounded-full font-bold">
              {cartItems.reduce((s, i) => s + i.quantity, 0)}
            </span>
          </button>
        </div>
      )}

      {/* MODAL: Customer Cart Drawer */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-250">
            
            <div className="p-5 border-b border-zinc-150 dark:border-dark-border bg-zinc-50 dark:bg-dark-element/50 flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text flex items-center space-x-1.5">
                <ShoppingCart className="h-5 w-5 text-brand-500" />
                <span>Minha Sacola</span>
              </h3>
              <button
                onClick={() => setShowCartDrawer(false)}
                className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cart Items list */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {cartItems.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border/40 p-3 rounded-xl">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="font-bold text-sm text-zinc-900 dark:text-dark-text truncate">{item.name}</p>
                    <p className="text-xs text-brand-500 font-extrabold">R$ {item.price.toFixed(2)}</p>
                    {item.notes && (
                      <p className="text-[10px] text-zinc-500 dark:text-dark-muted italic mt-1 bg-white dark:bg-zinc-900/60 p-1.5 rounded border border-zinc-150 dark:border-dark-border/40">
                        Obs: {item.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end space-y-2">
                    <div className="flex items-center space-x-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-dark-border p-1 rounded-lg scale-90">
                      <button
                        onClick={() => updateQuantity(item.product_id, item.notes, item.quantity - 1)}
                        className="p-1 text-zinc-400 hover:bg-zinc-100 rounded"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="font-bold text-xs px-1 text-zinc-700 dark:text-dark-text">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product_id, item.notes, item.quantity + 1)}
                        className="p-1 text-zinc-400 hover:bg-zinc-100 rounded"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.product_id, item.notes)}
                      className="text-red-500 hover:text-red-650 scale-90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total & Place order */}
            <div className="p-5 border-t dark:border-dark-border bg-zinc-50 dark:bg-dark-element/35 space-y-4">
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-zinc-550 dark:text-dark-muted">Total a Pagar:</span>
                <span className="text-2xl text-zinc-950 dark:text-dark-text">R$ {totalAmount.toFixed(2)}</span>
              </div>

              <button
                onClick={handleSendOrder}
                className="w-full py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-1.5 shadow-lg shadow-brand-500/20 transition duration-200"
              >
                <Check className="h-5 w-5" />
                <span>Confirmar e Enviar Pedido</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Add Observations */}
      {activeProductForNote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-zinc-50 dark:bg-dark-element/50 border-b border-zinc-150 dark:border-dark-border flex justify-between items-center">
              <div>
                <h4 className="font-extrabold text-zinc-950 dark:text-dark-text text-sm">{activeProductForNote.name}</h4>
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
                className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-sm transition"
              >
                Adicionar ao Carrinho — R$ {activeProductForNote.price.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function UtensilsCategoryIcon({ category }) {
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
