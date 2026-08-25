import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import Navbar from '../components/Navbar.jsx';
import { Clock, CheckSquare, ChefHat, Volume2, Package, Sparkles } from 'lucide-react';

export default function KitchenDashboard() {
  const { apiFetch } = useAuth();
  const socket = useSocket();
  const [orders, setOrders] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Load orders that are active in the kitchen (received, preparing, ready)
  const loadOrders = async () => {
    try {
      const [ordersRes, deliveryRes] = await Promise.all([
        apiFetch('/api/orders?status=received,preparing,ready'),
        apiFetch('/api/delivery')
      ]);

      let combined = [];

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        combined.push(...data);
      }

      if (deliveryRes.ok) {
        const deliveryData = await deliveryRes.json();
        const activeDelivery = deliveryData
          .filter(o => o.status !== 'delivered' && o.status !== 'cancelled')
          .map(o => ({
            ...o,
            is_delivery: true,
            table_number: 'Delivery',
            items: o.items.map(it => ({ ...it, name: it.product_name }))
          }));
        combined.push(...activeDelivery);
      }

      setOrders(combined);
    } catch (err) {
      console.error('Erro ao buscar pedidos para cozinha:', err);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  // Synthesize double chime beep locally (works offline, zero external file dependency)
  const playChime = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playTone = (frequency, start, duration) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = frequency;
        
        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(0.3, start + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
        
        osc.start(start);
        osc.stop(start + duration);
      };

      // Play C5 (523Hz) followed by E5 (659Hz)
      playTone(523.25, ctx.currentTime, 0.4);
      playTone(659.25, ctx.currentTime + 0.15, 0.5);
      setAudioEnabled(true);
    } catch (e) {
      console.error('AudioContext chime failed:', e);
    }
  };

  // Bind Socket.io events
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (newOrder) => {
      setOrders((prevOrders) => {
        if (prevOrders.some(o => !o.is_delivery && o.id === newOrder.id)) return prevOrders;
        return [newOrder, ...prevOrders];
      });
      playChime();
    };

    const handleOrderStatusChanged = (updatedOrder) => {
      if (updatedOrder.status === 'delivered') {
        setOrders((prevOrders) => prevOrders.filter(o => !(!o.is_delivery && o.id === updatedOrder.id)));
      } else {
        setOrders((prevOrders) =>
          prevOrders.map((o) => (!o.is_delivery && o.id === updatedOrder.id ? { ...o, status: updatedOrder.status } : o))
        );
      }
    };

    const handleNewDelivery = (newOrder) => {
      if (newOrder.status === 'delivered' || newOrder.status === 'cancelled') return;
      setOrders((prev) => {
        if (prev.some(o => o.is_delivery && o.id === newOrder.id)) return prev;
        const mapped = {
          ...newOrder,
          is_delivery: true,
          table_number: 'Delivery',
          items: newOrder.items.map(it => ({ ...it, name: it.product_name }))
        };
        return [mapped, ...prev];
      });
      playChime();
    };

    const handleDeliveryUpdate = (updatedOrder) => {
      if (updatedOrder.status === 'delivered' || updatedOrder.status === 'cancelled') {
        setOrders((prev) => prev.filter(o => !(o.is_delivery && o.id === updatedOrder.id)));
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.is_delivery && o.id === updatedOrder.id ? {
            ...updatedOrder,
            is_delivery: true,
            table_number: 'Delivery',
            items: updatedOrder.items.map(it => ({ ...it, name: it.product_name }))
          } : o))
        );
      }
    };

    const handleDeliveryDelete = ({ id }) => {
      setOrders((prev) => prev.filter(o => !(o.is_delivery && o.id === id)));
    };

    socket.on('order_received', handleNewOrder);
    socket.on('order_status_changed', handleOrderStatusChanged);
    socket.on('delivery_order_created', handleNewDelivery);
    socket.on('delivery_order_updated', handleDeliveryUpdate);
    socket.on('delivery_order_deleted', handleDeliveryDelete);

    return () => {
      socket.off('order_received', handleNewOrder);
      socket.off('order_status_changed', handleOrderStatusChanged);
      socket.off('delivery_order_created', handleNewDelivery);
      socket.off('delivery_order_updated', handleDeliveryUpdate);
      socket.off('delivery_order_deleted', handleDeliveryDelete);
    };
  }, [socket]);

  // Update order status
  const handleUpdateStatus = async (orderId, newStatus, isDelivery = false) => {
    try {
      let res;
      if (isDelivery) {
        let deliveryStatus = newStatus;
        if (newStatus === 'ready') {
          deliveryStatus = 'dispatched';
        }
        res = await apiFetch(`/api/delivery/${orderId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: deliveryStatus })
        });
      } else {
        res = await apiFetch(`/api/orders/${orderId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        });
      }
      if (!res.ok) {
        alert('Erro ao atualizar status do pedido.');
      } else {
        loadOrders();
      }
    } catch (err) {
      console.error('Erro ao mudar status do pedido:', err);
    }
  };

  // Component to calculate and display elapsed time dynamically
  const OrderTimer = ({ createdAt }) => {
    const [minutes, setMinutes] = useState(0);

    useEffect(() => {
      const calculateElapsed = () => {
        const diff = Date.now() - new Date(createdAt).getTime();
        setMinutes(Math.floor(diff / 60000));
      };

      calculateElapsed();
      const interval = setInterval(calculateElapsed, 30000); // update every 30s
      return () => clearInterval(interval);
    }, [createdAt]);

    return (
      <span className={`flex items-center space-x-1 font-bold ${
        minutes >= 20 ? 'text-red-500 animate-pulse' : minutes >= 10 ? 'text-amber-500' : 'text-zinc-500 dark:text-dark-muted'
      }`}>
        <Clock className="h-4 w-4" />
        <span>{minutes} min</span>
      </span>
    );
  };

  // Group orders for the columns
  const receivedOrders = orders.filter(o => o.status === 'received' || (o.is_delivery && o.status === 'pending'));
  const preparingOrders = orders.filter(o => o.status === 'preparing' || (o.is_delivery && o.status === 'preparing'));
  const readyOrders = orders.filter(o => o.status === 'ready' || (o.is_delivery && o.status === 'dispatched'));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-200">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Kitchen Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center space-x-3">
            <div className="bg-brand-500 text-white p-3 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20">
              <ChefHat className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-dark-text">Monitor da Cozinha</h1>
              <p className="text-xs font-semibold text-zinc-500 dark:text-dark-muted">Pedidos de alimentos em tempo real</p>
            </div>
          </div>

          {/* Sound tester / Enabler */}
          <button
            onClick={playChime}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 border transition-all duration-200 ${
              audioEnabled
                ? 'bg-zinc-150 border-zinc-200 dark:bg-dark-element dark:border-dark-border text-zinc-700 dark:text-dark-text'
                : 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/10'
            }`}
          >
            <Volume2 className="h-4 w-4" />
            <span>{audioEnabled ? 'Sons Ativos (Testar)' : 'Ativar Alerta de Som'}</span>
          </button>
        </div>

        {/* 3 Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* 1. Recebidos (Received) */}
          <div className="space-y-4">
            <div className="bg-zinc-200/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-dark-border px-4 py-3 rounded-2xl flex justify-between items-center">
              <span className="font-extrabold text-sm text-zinc-700 dark:text-dark-text">Recebidos</span>
              <span className="bg-zinc-300 dark:bg-zinc-800 text-zinc-800 dark:text-dark-text text-xs px-2.5 py-1 rounded-full font-bold">
                {receivedOrders.length}
              </span>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {receivedOrders.map(order => (
                <div key={order.is_delivery ? `del-${order.id}` : `tab-${order.id}`} className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-2xl shadow-md p-5 space-y-4 relative border-l-4 border-l-brand-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-lg text-zinc-950 dark:text-dark-text">
                        {order.is_delivery ? 'DELIVERY' : `Mesa ${order.table_number}`}
                      </h4>
                      {order.client_name && (
                        <p className="text-xs text-zinc-400 dark:text-dark-muted font-medium mt-0.5">Cliente: {order.client_name}</p>
                      )}
                    </div>
                    <OrderTimer createdAt={order.created_at} />
                  </div>

                  {/* Items */}
                  <div className="border-t border-b border-dashed border-zinc-200 dark:border-dark-border/50 py-3 space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="flex justify-between font-bold text-zinc-800 dark:text-dark-text">
                          <span>{item.quantity}x {item.name}</span>
                        </div>
                        {item.notes && (
                          <div className="mt-1 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded border border-red-100 dark:border-red-900/30">
                            <strong>Obs:</strong> {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleUpdateStatus(order.id, 'preparing', order.is_delivery)}
                    className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center space-x-1.5"
                  >
                    <ChefHat className="h-4 w-4" />
                    <span>Preparar</span>
                  </button>
                </div>
              ))}
              {receivedOrders.length === 0 && <EmptyColumnState />}
            </div>
          </div>

          {/* 2. Preparando (Preparing) */}
          <div className="space-y-4">
            <div className="bg-amber-100/50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/20 px-4 py-3 rounded-2xl flex justify-between items-center">
              <span className="font-extrabold text-sm text-amber-700 dark:text-amber-400">Preparando</span>
              <span className="bg-amber-500 text-white text-xs px-2.5 py-1 rounded-full font-bold">
                {preparingOrders.length}
              </span>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {preparingOrders.map(order => (
                <div key={order.is_delivery ? `del-${order.id}` : `tab-${order.id}`} className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-2xl shadow-md p-5 space-y-4 relative border-l-4 border-l-amber-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-lg text-zinc-950 dark:text-dark-text">
                        {order.is_delivery ? 'DELIVERY' : `Mesa ${order.table_number}`}
                      </h4>
                      {order.client_name && (
                        <p className="text-xs text-zinc-400 dark:text-dark-muted font-medium mt-0.5">Cliente: {order.client_name}</p>
                      )}
                    </div>
                    <OrderTimer createdAt={order.created_at} />
                  </div>

                  {/* Items */}
                  <div className="border-t border-b border-dashed border-zinc-200 dark:border-dark-border/50 py-3 space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="flex justify-between font-bold text-zinc-800 dark:text-dark-text">
                          <span>{item.quantity}x {item.name}</span>
                        </div>
                        {item.notes && (
                          <div className="mt-1 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded border border-red-100 dark:border-red-900/30">
                            <strong>Obs:</strong> {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleUpdateStatus(order.id, 'ready', order.is_delivery)}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center space-x-1.5 animate-pulse"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span>Marcar Pronto</span>
                  </button>
                </div>
              ))}
              {preparingOrders.length === 0 && <EmptyColumnState />}
            </div>
          </div>

          {/* 3. Pronto para Entregar (Ready) */}
          <div className="space-y-4">
            <div className="bg-emerald-100/50 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900/20 px-4 py-3 rounded-2xl flex justify-between items-center">
              <span className="font-extrabold text-sm text-emerald-700 dark:text-emerald-400">Pronto (Entregar)</span>
              <span className="bg-emerald-500 text-white text-xs px-2.5 py-1 rounded-full font-bold">
                {readyOrders.length}
              </span>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {readyOrders.map(order => (
                <div key={order.is_delivery ? `del-${order.id}` : `tab-${order.id}`} className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-2xl shadow-md p-5 space-y-4 relative border-l-4 border-l-emerald-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-lg text-zinc-950 dark:text-dark-text">
                        {order.is_delivery ? 'DELIVERY' : `Mesa ${order.table_number}`}
                      </h4>
                      {order.client_name && (
                        <p className="text-xs text-zinc-400 dark:text-dark-muted font-medium mt-0.5">Cliente: {order.client_name}</p>
                      )}
                    </div>
                    <OrderTimer createdAt={order.created_at} />
                  </div>

                  {/* Items */}
                  <div className="border-t border-b border-dashed border-zinc-200 dark:border-dark-border/50 py-3 space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="flex justify-between font-bold text-zinc-800 dark:text-dark-text">
                          <span>{item.quantity}x {item.name}</span>
                        </div>
                        {item.notes && (
                          <div className="mt-1 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2 py-1 rounded border border-red-100 dark:border-red-900/30">
                            <strong>Obs:</strong> {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleUpdateStatus(order.id, 'delivered', order.is_delivery)}
                    className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-900 text-white font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center space-x-1.5"
                  >
                    <Package className="h-4 w-4" />
                    <span>{order.is_delivery ? 'Entregar / Despachar' : 'Entregue'}</span>
                  </button>
                </div>
              ))}
              {readyOrders.length === 0 && <EmptyColumnState />}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function EmptyColumnState() {
  return (
    <div className="text-center py-12 border-2 border-dashed border-zinc-200 dark:border-dark-border/40 rounded-2xl text-zinc-400">
      <Sparkles className="h-6 w-6 mx-auto mb-2 text-zinc-300 dark:text-dark-muted" />
      <span className="text-xs font-semibold">Sem pedidos nesta etapa</span>
    </div>
  );
}
