import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import Navbar from '../components/Navbar.jsx';
import {
  Bike, Plus, Search, X, ChevronRight, Clock, MapPin, Phone,
  DollarSign, CreditCard, QrCode, Receipt, User, Package,
  CheckCircle, AlertCircle, ChefHat, Send, Trash2, RefreshCw,
  ExternalLink, Inbox, TrendingUp, Timer, ShoppingBag, Flame,
  Truck, BadgeCheck, SlidersHorizontal, Volume2, VolumeX
} from 'lucide-react';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STATUSES = [
  {
    id: 'pending',
    label: 'Novos',
    icon: Inbox,
    color: 'red',
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800/40',
    headerBg: 'bg-red-500',
    badge: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400',
    nextAction: { label: 'Aceitar → Cozinha', nextStatus: 'preparing', icon: ChefHat },
  },
  {
    id: 'preparing',
    label: 'Em Preparo',
    icon: Flame,
    color: 'amber',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800/40',
    headerBg: 'bg-amber-500',
    badge: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400',
    nextAction: { label: 'Despachar → Motoboy', nextStatus: 'dispatched', icon: Truck },
  },
  {
    id: 'dispatched',
    label: 'Despachado',
    icon: Truck,
    color: 'blue',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-800/40',
    headerBg: 'bg-blue-500',
    badge: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400',
    nextAction: { label: 'Confirmar Entrega', nextStatus: 'delivered', icon: BadgeCheck },
  },
  {
    id: 'delivered',
    label: 'Entregues',
    icon: BadgeCheck,
    color: 'emerald',
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    headerBg: 'bg-emerald-500',
    badge: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400',
    nextAction: null,
  },
];

const CHANNELS = [
  { id: 'proprio', label: 'Próprio', color: 'bg-brand-500', textColor: 'text-white' },
  { id: 'ifood', label: 'iFood', color: 'bg-red-500', textColor: 'text-white' },
  { id: 'whatsapp', label: 'WhatsApp', color: 'bg-emerald-500', textColor: 'text-white' },
  { id: 'rappi', label: 'Rappi', color: 'bg-orange-500', textColor: 'text-white' },
];

const PAYMENT_METHODS = [
  { id: 'dinheiro', label: 'Dinheiro', emoji: '💵' },
  { id: 'pix', label: 'Pix', emoji: '📱' },
  { id: 'credito', label: 'Crédito', emoji: '💳' },
  { id: 'debito', label: 'Débito', emoji: '💳' },
  { id: 'voucher', label: 'Voucher', emoji: '🎟️' },
  { id: 'na_entrega', label: 'Maquininha', emoji: '🖥️' },
];

const getChannel = (id) => CHANNELS.find(c => c.id === id) || CHANNELS[0];
const getPayment = (id) => PAYMENT_METHODS.find(p => p.id === id) || PAYMENT_METHODS[0];

// Elapsed time display (e.g. "há 5 min")
function useElapsedTime(dateStr) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const update = () => {
      if (!dateStr) return setElapsed('');
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
      if (diff < 1) setElapsed('agora');
      else if (diff === 1) setElapsed('há 1 min');
      else setElapsed(`há ${diff} min`);
    };
    update();
    const t = setInterval(update, 30000);
    return () => clearInterval(t);
  }, [dateStr]);
  return elapsed;
}

// Empty sound beep via Web Audio API
function useNewOrderSound() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtx = useRef(null);

  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx.current;
      const playTone = (freq, start, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      playTone(880, 0, 0.15);
      playTone(1100, 0.2, 0.15);
      playTone(880, 0.4, 0.25);
    } catch { /* silent fail */ }
  }, [soundEnabled]);

  return { soundEnabled, setSoundEnabled, playBeep };
}

// ─── ORDER CARD ────────────────────────────────────────────────────────────────
function OrderCard({ order, statusConfig, onAdvance, onClick, isDragging, onDragStart, onDragEnd }) {
  const elapsed = useElapsedTime(order.created_at);
  const channel = getChannel(order.channel);
  const payment = getPayment(order.payment_method);
  const isPending = order.status === 'pending';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, order)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(order)}
      className={`
        relative bg-white dark:bg-dark-card border rounded-2xl shadow-sm cursor-grab active:cursor-grabbing
        transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
        ${isPending ? 'border-red-300 dark:border-red-700 animate-pulse ring-2 ring-red-300 dark:ring-red-700/50' : 'border-zinc-200 dark:border-dark-border'}
        ${isDragging ? 'opacity-40 scale-95' : ''}
      `}
    >
      {/* Channel tag */}
      <div className="absolute top-3 right-3">
        <span className={`${channel.color} ${channel.textColor} text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full`}>
          {channel.label}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Top: ID + time */}
        <div className="flex items-start justify-between pr-16">
          <div>
            <p className="text-xs font-extrabold text-brand-500">#{String(order.id).padStart(4, '0')}</p>
            <p className="text-[10px] text-zinc-400 font-semibold">{elapsed}</p>
          </div>
        </div>

        {/* Middle: client + neighborhood */}
        <div>
          <p className="font-extrabold text-zinc-900 dark:text-dark-text text-sm leading-tight">{order.client_name}</p>
          {order.neighborhood && (
            <p className="text-xs text-zinc-500 dark:text-dark-muted mt-0.5 flex items-center space-x-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{order.neighborhood}</span>
            </p>
          )}
          {order.status === 'dispatched' && order.deliverer_name && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 flex items-center space-x-1 font-semibold">
              <Bike className="h-3 w-3 shrink-0" />
              <span className="truncate">{order.deliverer_name}</span>
            </p>
          )}
        </div>

        {/* Footer: total + payment + action */}
        <div className="flex items-center justify-between border-t border-zinc-100 dark:border-dark-border pt-2.5">
          <div className="flex items-center space-x-1.5">
            <span className="text-base">{payment.emoji}</span>
            <span className="font-extrabold text-zinc-900 dark:text-dark-text text-sm">
              R$ {Number(order.total_amount).toFixed(2)}
            </span>
          </div>
          {statusConfig.nextAction && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdvance(order, statusConfig.nextAction.nextStatus); }}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                isPending
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20'
                  : 'bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-700 text-white'
              }`}
            >
              {React.createElement(statusConfig.nextAction.icon, { className: 'h-3 w-3' })}
              <span className="hidden sm:inline">{isPending ? 'Aceitar' : statusConfig.nextAction.nextStatus === 'dispatched' ? 'Despachar' : 'Entregue'}</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KANBAN COLUMN ─────────────────────────────────────────────────────────────
function KanbanColumn({ statusConfig, orders, onAdvance, onCardClick, onDrop, draggingId }) {
  const Icon = statusConfig.icon;
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); setIsOver(true); };
  const handleDragLeave = () => setIsOver(false);
  const handleDrop = (e) => { e.preventDefault(); setIsOver(false); onDrop(e, statusConfig.id); };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col min-h-[500px] rounded-2xl transition-all duration-200 ${statusConfig.bg} ${statusConfig.border} border-2 ${isOver ? 'ring-2 ring-brand-500 scale-[1.01]' : ''}`}
    >
      {/* Column Header */}
      <div className={`${statusConfig.headerBg} rounded-t-xl px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center space-x-2">
          <Icon className="h-4 w-4 text-white" />
          <span className="font-extrabold text-white text-sm">{statusConfig.label}</span>
        </div>
        <span className="bg-white/30 text-white text-xs font-extrabold px-2 py-0.5 rounded-full">
          {orders.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[70vh]">
        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
            <Icon className="h-8 w-8 text-zinc-400 mb-2" />
            <p className="text-xs font-semibold text-zinc-400">Nenhum pedido aqui</p>
          </div>
        )}
        {orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            statusConfig={statusConfig}
            onAdvance={onAdvance}
            onClick={onCardClick}
            isDragging={draggingId === order.id}
            onDragStart={(e, o) => { e.dataTransfer.setData('orderId', o.id); }}
            onDragEnd={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

// ─── ORDER DRAWER ──────────────────────────────────────────────────────────────
function OrderDrawer({ order, onClose, onAdvance, onDelete }) {
  const statusConfig = STATUSES.find(s => s.id === order.status);
  const channel = getChannel(order.channel);
  const payment = getPayment(order.payment_method);
  const elapsed = useElapsedTime(order.created_at);

  const mapsUrl = order.address
    ? `https://maps.google.com/?q=${encodeURIComponent(order.address + ', ' + (order.neighborhood || ''))}`
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white dark:bg-dark-card shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-element/50">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-extrabold text-zinc-900 dark:text-dark-text">
                Pedido #{String(order.id).padStart(4, '0')}
              </span>
              <span className={`${channel.color} ${channel.textColor} text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full`}>
                {channel.label}
              </span>
              {statusConfig && (
                <span className={`${statusConfig.badge} text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full`}>
                  {statusConfig.label}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">{elapsed}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Client info */}
          <div className="bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Cliente</h4>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-950/30 flex items-center justify-center">
                <User className="h-5 w-5 text-brand-500" />
              </div>
              <div>
                <p className="font-extrabold text-zinc-900 dark:text-dark-text">{order.client_name}</p>
                {order.client_phone && (
                  <a href={`tel:${order.client_phone}`} className="text-xs text-brand-500 hover:underline flex items-center space-x-1">
                    <Phone className="h-3 w-3" />
                    <span>{order.client_phone}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Address */}
          {order.address && (
            <div className="bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Endereço</h4>
              <p className="text-sm font-semibold text-zinc-800 dark:text-dark-text">{order.address}</p>
              {order.neighborhood && (
                <p className="text-xs text-zinc-500">{order.neighborhood}</p>
              )}
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-brand-500 hover:underline mt-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Abrir no Google Maps</span>
                </a>
              )}
            </div>
          )}

          {/* Items */}
          <div className="bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Itens do Pedido</h4>
            <div className="space-y-2">
              {(order.items || []).map((item, idx) => (
                <div key={idx} className="flex items-start justify-between">
                  <div className="flex items-start space-x-2 flex-1 min-w-0">
                    <span className="font-extrabold text-brand-500 text-sm shrink-0">{item.quantity}x</span>
                    <div>
                      <p className="text-sm font-semibold text-zinc-800 dark:text-dark-text">{item.product_name}</p>
                      {item.notes && <p className="text-xs text-zinc-400 italic">{item.notes}</p>}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-zinc-700 dark:text-dark-text shrink-0 ml-2">
                    R$ {(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            {order.notes && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl px-3 py-2">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">📝 {order.notes}</p>
              </div>
            )}
          </div>

          {/* Payment + Total */}
          <div className="bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border rounded-2xl p-4 space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Pagamento</h4>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xl">{payment.emoji}</span>
                <span className="font-bold text-zinc-700 dark:text-dark-text text-sm">{payment.label}</span>
              </div>
              <span className="text-xl font-extrabold text-zinc-900 dark:text-dark-text">
                R$ {Number(order.total_amount).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Deliverer */}
          {order.deliverer_name && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-blue-400 mb-2">Entregador</h4>
              <div className="flex items-center space-x-2">
                <Bike className="h-4 w-4 text-blue-500" />
                <span className="font-bold text-blue-800 dark:text-blue-300">{order.deliverer_name}</span>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border rounded-2xl p-4 space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Histórico</h4>
            <div className="space-y-1.5">
              {[
                { label: 'Pedido recebido', time: order.created_at },
                { label: 'Em preparo', time: order.status !== 'pending' ? order.updated_at : null },
                { label: 'Despachado', time: order.dispatched_at },
                { label: 'Entregue', time: order.delivered_at },
              ].map((ev, idx) => (
                <div key={idx} className={`flex items-center space-x-2 text-xs ${ev.time ? 'text-zinc-700 dark:text-dark-text' : 'text-zinc-300 dark:text-zinc-600'}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${ev.time ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                  <span className="font-semibold">{ev.label}</span>
                  {ev.time && (
                    <span className="text-zinc-400 ml-auto">
                      {new Date(ev.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-element/50 space-y-2">
          {statusConfig?.nextAction && (
            <button
              onClick={() => { onAdvance(order, statusConfig.nextAction.nextStatus); onClose(); }}
              className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-brand-500/20"
            >
              {React.createElement(statusConfig.nextAction.icon, { className: 'h-4 w-4' })}
              <span>{statusConfig.nextAction.label}</span>
            </button>
          )}
          <button
            onClick={() => { if (confirm('Cancelar este pedido?')) { onDelete(order.id); onClose(); } }}
            className="w-full py-2.5 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-bold rounded-xl text-sm flex items-center justify-center space-x-2 transition border border-red-200 dark:border-red-800/40"
          >
            <Trash2 className="h-4 w-4" />
            <span>Cancelar Pedido</span>
          </button>
        </div>
      </div>
    </>
  );
}

// ─── NEW ORDER MODAL ───────────────────────────────────────────────────────────
const EMPTY_ITEM = { product_name: '', quantity: 1, price: '', notes: '' };

function NewOrderModal({ onClose, onSubmit }) {
  const { apiFetch } = useAuth();
  const [form, setForm] = useState({
    client_name: '', client_phone: '', address: '', neighborhood: '',
    channel: 'proprio', payment_method: 'dinheiro', notes: '',
  });
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [loading, setLoading] = useState(false);
  const [dbProducts, setDbProducts] = useState([]);

  // Fetch registered products
  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await apiFetch('/api/products');
        if (res.ok) {
          setDbProducts(await res.json());
        }
      } catch (err) {
        console.error('Erro ao carregar produtos:', err);
      }
    }
    loadProducts();
  }, [apiFetch]);

  const total = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 0), 0);

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setItem = (idx, k, v) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  // Phone lookup handler
  const handlePhoneChange = async (val) => {
    setField('client_phone', val);
    const clean = val.replace(/\D/g, '');
    if (clean.length >= 8) {
      try {
        const res = await apiFetch(`/api/delivery/client/${encodeURIComponent(val)}`);
        if (res.ok) {
          const clientData = await res.json();
          if (clientData && clientData.client_name) {
            setForm(prev => ({
              ...prev,
              client_name: clientData.client_name,
              address: clientData.address || '',
              neighborhood: clientData.neighborhood || ''
            }));
          }
        }
      } catch (e) {
        // silent catch
      }
    }
  };

  const handleSubmit = async () => {
    if (!form.client_name.trim()) return alert('Informe o nome do cliente.');
    if (items.some(i => !i.product_name.trim())) return alert('Preencha o nome de todos os itens.');
    setLoading(true);
    try {
      await onSubmit({ ...form, total_amount: total, items: items.map(i => ({ ...i, price: parseFloat(i.price) || 0, quantity: parseInt(i.quantity) || 1 })) });
      onClose();
    } catch (e) {
      alert('Erro ao criar pedido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-dark-border bg-brand-500">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Novo Pedido Delivery</h3>
                <p className="text-brand-100 text-xs">Preencha os dados do cliente</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"><X className="h-4 w-4" /></button>
          </div>

          {/* Scrollable form */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Cliente */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Cliente</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Nome *</label>
                  <input value={form.client_name} onChange={e => setField('client_name', e.target.value)} className="w-full px-3 py-2.5 border border-zinc-200 dark:border-dark-border rounded-xl text-sm bg-zinc-50 dark:bg-dark-element text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Nome completo" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Telefone</label>
                  <input value={form.client_phone} onChange={e => handlePhoneChange(e.target.value)} className="w-full px-3 py-2.5 border border-zinc-200 dark:border-dark-border rounded-xl text-sm bg-zinc-50 dark:bg-dark-element text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="(11) 99999-9999" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Bairro</label>
                  <input value={form.neighborhood} onChange={e => setField('neighborhood', e.target.value)} className="w-full px-3 py-2.5 border border-zinc-200 dark:border-dark-border rounded-xl text-sm bg-zinc-50 dark:bg-dark-element text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Bairro" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Endereço</label>
                  <input value={form.address} onChange={e => setField('address', e.target.value)} className="w-full px-3 py-2.5 border border-zinc-200 dark:border-dark-border rounded-xl text-sm bg-zinc-50 dark:bg-dark-element text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Rua, número, complemento" />
                </div>
              </div>
            </div>

            {/* Canal + Pagamento */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-2">Canal</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CHANNELS.map(ch => (
                    <button key={ch.id} type="button" onClick={() => setField('channel', ch.id)}
                      className={`py-2 px-2 rounded-xl text-[10px] font-bold border transition ${form.channel === ch.id ? `${ch.color} text-white border-transparent shadow-md` : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-dark-border text-zinc-500 dark:text-dark-muted'}`}
                    >{ch.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-2">Pagamento</label>
                <select value={form.payment_method} onChange={e => setField('payment_method', e.target.value)}
                  className="w-full px-3 py-2.5 border border-zinc-200 dark:border-dark-border rounded-xl text-sm bg-zinc-50 dark:bg-dark-element text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500">
                  {PAYMENT_METHODS.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.label}</option>)}
                </select>
              </div>
            </div>

            {/* Itens */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Itens do Pedido</h4>
                <button type="button" onClick={addItem} className="flex items-center space-x-1 text-xs font-bold text-brand-500 hover:text-brand-600 transition">
                  <Plus className="h-3.5 w-3.5" /><span>Adicionar</span>
                </button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center space-x-2">
                    <select
                      value={item.product_name}
                      onChange={e => {
                        const selectedName = e.target.value;
                        const prod = dbProducts.find(p => p.name === selectedName);
                        setItem(idx, 'product_name', selectedName);
                        if (prod) {
                          setItem(idx, 'price', prod.price);
                        }
                      }}
                      className="flex-1 px-3 py-2.5 border border-zinc-200 dark:border-dark-border rounded-xl text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    >
                      <option value="">Selecione um produto...</option>
                      {dbProducts.map(p => (
                        <option key={p.id} value={p.name}>{p.name} - R$ {p.price.toFixed(2)}</option>
                      ))}
                    </select>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1">Qtd.</label>
                      <input type="number" min="1" value={item.quantity} onChange={e => setItem(idx, 'quantity', e.target.value)}
                        className="w-full px-2 py-1.5 border border-zinc-200 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-center font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1">Preço (un.)</label>
                      <input type="number" min="0" step="0.01" value={item.price} onChange={e => setItem(idx, 'price', e.target.value)}
                        className="w-full px-2 py-1.5 border border-zinc-200 dark:border-dark-border rounded-lg text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                        placeholder="0,00" />
                    </div>
                    <div className="flex flex-col justify-end">
                      <span className="text-[10px] font-bold text-zinc-400 mb-1">Subtotal</span>
                      <span className="text-sm font-extrabold text-zinc-800 dark:text-dark-text py-1.5">
                        R$ {((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <input value={item.notes} onChange={e => setItem(idx, 'notes', e.target.value)}
                    className="w-full px-3 py-1.5 border border-zinc-200 dark:border-dark-border rounded-xl text-xs bg-white dark:bg-zinc-900 text-zinc-500 dark:text-dark-muted focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    placeholder="Observações (ex: sem cebola)" />
                </div>
              ))}
            </div>

            {/* Observações gerais */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">Observações Gerais</label>
              <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2}
                className="w-full px-3 py-2.5 border border-zinc-200 dark:border-dark-border rounded-xl text-sm bg-zinc-50 dark:bg-dark-element text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
                placeholder="Ex: tocar campainha 2x, apartamento..." />
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-200 dark:border-dark-border bg-zinc-50 dark:bg-dark-element/50 space-y-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-zinc-500">Total do Pedido:</span>
              <span className="text-xl font-extrabold text-zinc-900 dark:text-dark-text">R$ {total.toFixed(2)}</span>
            </div>
            <button onClick={handleSubmit} disabled={loading}
              className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-brand-500/20">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
              <span>{loading ? 'Salvando...' : 'Criar Pedido'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── DESPATCH MODAL (nome entregador) ──────────────────────────────────────────
function DispatchModal({ order, onConfirm, onClose }) {
  const [delivererName, setDelivererName] = useState('');
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-sm w-full rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-blue-500 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Truck className="h-5 w-5 text-white" />
            <span className="font-extrabold text-white">Despachar Pedido</span>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-zinc-600 dark:text-dark-muted">Informe o nome do entregador para o pedido <strong>#{String(order.id).padStart(4,'0')}</strong> de <strong>{order.client_name}</strong>.</p>
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1.5">Nome do Entregador</label>
            <input value={delivererName} onChange={e => setDelivererName(e.target.value)} autoFocus
              className="w-full px-3 py-2.5 border border-zinc-200 dark:border-dark-border rounded-xl text-sm bg-zinc-50 dark:bg-dark-element text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="Ex: João da Silva" />
          </div>
          <div className="flex space-x-3">
            <button onClick={() => onConfirm(delivererName)} className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 transition">
              <Send className="h-4 w-4" /><span>Despachar</span>
            </button>
            <button onClick={onClose} className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-700 dark:text-dark-text font-bold rounded-xl text-sm transition">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ────────────────────────────────────────────────────────────
export default function DeliveryDashboard() {
  const { apiFetch } = useAuth();
  const socket = useSocket();

  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total_orders: 0, total_revenue: 0, avg_delivery_minutes: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [drawerOrder, setDrawerOrder] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [dispatchModal, setDispatchModal] = useState(null); // { order, targetStatus }
  const [draggingId, setDraggingId] = useState(null);
  const { soundEnabled, setSoundEnabled, playBeep } = useNewOrderSound();

  const fetchOrders = useCallback(async () => {
    try {
      const [ordersRes, statsRes] = await Promise.all([
        apiFetch('/api/delivery'),
        apiFetch('/api/delivery/stats'),
      ]);
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Real-time socket listeners
  useEffect(() => {
    if (!socket) return;
    const onCreate = (order) => {
      setOrders(prev => [order, ...prev]);
      setStats(prev => ({ ...prev, total_orders: prev.total_orders + 1, total_revenue: prev.total_revenue + order.total_amount }));
      playBeep();
    };
    const onUpdate = (order) => {
      setOrders(prev => prev.map(o => o.id === order.id ? order : o));
      // Also update drawer if open
      setDrawerOrder(prev => prev?.id === order.id ? order : prev);
    };
    const onDelete = ({ id }) => {
      setOrders(prev => prev.filter(o => o.id !== id));
      setDrawerOrder(prev => prev?.id === id ? null : prev);
    };
    socket.on('delivery_order_created', onCreate);
    socket.on('delivery_order_updated', onUpdate);
    socket.on('delivery_order_deleted', onDelete);
    return () => {
      socket.off('delivery_order_created', onCreate);
      socket.off('delivery_order_updated', onUpdate);
      socket.off('delivery_order_deleted', onDelete);
    };
  }, [socket, playBeep]);

  // Advance status handler
  const handleAdvance = async (order, targetStatus) => {
    // If dispatching, show deliverer modal
    if (targetStatus === 'dispatched') {
      setDispatchModal({ order, targetStatus });
      return;
    }
    try {
      const res = await apiFetch(`/api/delivery/${order.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'Erro ao atualizar pedido.');
      }
      // Socket will handle local state update
    } catch (e) { alert('Erro de conexão.'); }
  };

  const handleDispatchConfirm = async (delivererName) => {
    if (!dispatchModal) return;
    try {
      const res = await apiFetch(`/api/delivery/${dispatchModal.order.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'dispatched', deliverer_name: delivererName }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'Erro ao despachar pedido.');
      }
    } catch (e) { alert('Erro de conexão.'); }
    finally { setDispatchModal(null); }
  };

  const handleCreateOrder = async (data) => {
    const res = await apiFetch('/api/delivery', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message);
    }
    // Socket handles state update
  };

  const handleDeleteOrder = async (id) => {
    try {
      await apiFetch(`/api/delivery/${id}`, { method: 'DELETE' });
    } catch (e) { alert('Erro ao cancelar pedido.'); }
  };

  // Drag & drop handlers
  const handleDragStart = (e, order) => {
    e.dataTransfer.setData('orderId', order.id);
    setDraggingId(order.id);
  };
  const handleDragEnd = () => setDraggingId(null);
  const handleDrop = async (e, targetStatus) => {
    const orderId = parseInt(e.dataTransfer.getData('orderId'));
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status === targetStatus) return;
    await handleAdvance(order, targetStatus);
  };

  // Filter
  const filteredOrders = orders.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      o.client_name?.toLowerCase().includes(q) ||
      o.client_phone?.toLowerCase().includes(q) ||
      String(o.id).includes(q);
    const matchChannel = channelFilter === 'all' || o.channel === channelFilter;
    return matchSearch && matchChannel;
  });

  const getColumnOrders = (statusId) => filteredOrders.filter(o => o.status === statusId);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-brand-500/10 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
              <Bike className="h-7 w-7 text-brand-500" />
            </div>
            <p className="text-zinc-500 font-semibold text-sm">Carregando pedidos de delivery...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-200">
      <Navbar />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── HEADER ── */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="bg-brand-500 text-white p-3 rounded-2xl shadow-lg shadow-brand-500/20">
                <Bike className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-dark-text">Delivery</h1>
                <p className="text-xs font-semibold text-zinc-500 dark:text-dark-muted">Painel Kanban · Pedidos em Tempo Real</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-wrap gap-2">
              {/* Sound toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? 'Silenciar alertas' : 'Ativar alertas sonoros'}
                className={`p-2.5 rounded-xl border transition ${soundEnabled ? 'bg-brand-50 dark:bg-brand-950/20 border-brand-200 dark:border-brand-800/40 text-brand-500' : 'bg-zinc-100 dark:bg-dark-element border-zinc-200 dark:border-dark-border text-zinc-400'}`}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>

              <button
                onClick={fetchOrders}
                className="p-2.5 rounded-xl border border-zinc-200 dark:border-dark-border bg-white dark:bg-dark-card text-zinc-500 hover:text-zinc-700 transition"
                title="Atualizar"
              >
                <RefreshCw className="h-4 w-4" />
              </button>

              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center space-x-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 transition text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Pedido</span>
              </button>
            </div>
          </div>

          {/* ── STATS CARDS ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-2xl p-4 flex items-center space-x-3">
              <div className="p-2.5 bg-brand-50 dark:bg-brand-950/20 rounded-xl">
                <ShoppingBag className="h-5 w-5 text-brand-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Pedidos Hoje</p>
                <p className="text-2xl font-extrabold text-zinc-900 dark:text-dark-text">{stats.total_orders}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-2xl p-4 flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Faturamento</p>
                <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">R$ {Number(stats.total_revenue).toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-2xl p-4 flex items-center space-x-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-xl">
                <Timer className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tempo Médio</p>
                <p className="text-2xl font-extrabold text-zinc-900 dark:text-dark-text">
                  {Math.round(stats.avg_delivery_minutes) || '—'}<span className="text-sm font-semibold text-zinc-400 ml-1">min</span>
                </p>
              </div>
            </div>
          </div>

          {/* ── FILTERS ── */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por cliente, pedido ou telefone..."
                className="w-full pl-9 pr-3 py-2.5 border border-zinc-200 dark:border-dark-border rounded-xl text-sm bg-white dark:bg-dark-card text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-zinc-400 hover:text-zinc-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Channel filter */}
            <div className="flex items-center space-x-1.5 bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-xl p-1">
              <button
                onClick={() => setChannelFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${channelFilter === 'all' ? 'bg-brand-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-700 dark:text-dark-muted'}`}
              >
                Todos
              </button>
              {CHANNELS.map(ch => (
                <button key={ch.id}
                  onClick={() => setChannelFilter(ch.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${channelFilter === ch.id ? `${ch.color} text-white shadow-md` : 'text-zinc-500 hover:text-zinc-700 dark:text-dark-muted'}`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── KANBAN BOARD ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUSES.map(statusConfig => (
            <KanbanColumn
              key={statusConfig.id}
              statusConfig={statusConfig}
              orders={getColumnOrders(statusConfig.id)}
              onAdvance={handleAdvance}
              onCardClick={setDrawerOrder}
              onDrop={handleDrop}
              draggingId={draggingId}
            />
          ))}
        </div>
      </main>

      {/* ── DRAWER ── */}
      {drawerOrder && (
        <OrderDrawer
          order={drawerOrder}
          onClose={() => setDrawerOrder(null)}
          onAdvance={handleAdvance}
          onDelete={handleDeleteOrder}
        />
      )}

      {/* ── NEW ORDER MODAL ── */}
      {showNewModal && (
        <NewOrderModal
          onClose={() => setShowNewModal(false)}
          onSubmit={handleCreateOrder}
        />
      )}

      {/* ── DISPATCH MODAL ── */}
      {dispatchModal && (
        <DispatchModal
          order={dispatchModal.order}
          onConfirm={handleDispatchConfirm}
          onClose={() => setDispatchModal(null)}
        />
      )}
    </div>
  );
}
