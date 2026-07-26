import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import Navbar from '../components/Navbar.jsx';
import {
  Receipt, Landmark, Users, CreditCard, DollarSign, QrCode,
  Printer, CheckCircle, X, Archive, Plus, Trash2, AlertCircle,
  Ban, AlertTriangle, Lock, Unlock, LogIn, LogOut, ShieldAlert,
  TrendingUp, Clock, Wallet
} from 'lucide-react';

// Todos os métodos de pagamento disponíveis
const PAYMENT_OPTIONS = [
  { id: 'dinheiro',        label: 'Dinheiro',  emoji: '💵', icon: DollarSign,  color: 'emerald' },
  { id: 'credito',         label: 'Crédito',   emoji: '💳', icon: CreditCard,  color: 'blue'    },
  { id: 'debito',          label: 'Débito',    emoji: '💳', icon: CreditCard,  color: 'indigo'  },
  { id: 'pix',             label: 'Pix',       emoji: '📱', icon: QrCode,      color: 'brand'   },
  { id: 'voucher',         label: 'Voucher',   emoji: '🎟️', icon: Receipt,     color: 'amber'   },
];

const colorMap = {
  emerald: { active: 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/20', badge: 'bg-emerald-100 text-emerald-700' },
  blue:    { active: 'bg-blue-500 border-blue-500 text-white shadow-blue-500/20',           badge: 'bg-blue-100 text-blue-700'     },
  indigo:  { active: 'bg-indigo-500 border-indigo-500 text-white shadow-indigo-500/20',     badge: 'bg-indigo-100 text-indigo-700' },
  brand:   { active: 'bg-brand-500 border-brand-500 text-white shadow-brand-500/20',        badge: 'bg-brand-100 text-brand-700'   },
  amber:   { active: 'bg-amber-500 border-amber-500 text-white shadow-amber-500/20',        badge: 'bg-amber-100 text-amber-700'   },
};

export default function CashierDashboard() {
  const { apiFetch, user } = useAuth();
  const socket = useSocket();

  // ── CASH REGISTER STATE ──────────────────────────────────────────────────
  const [cashRegister, setCashRegister] = useState(null); // null = loading, false = closed, object = open session
  const [loadingRegister, setLoadingRegister] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingResult, setClosingResult] = useState(null); // summary after closing
  const [registerActionLoading, setRegisterActionLoading] = useState(false);

  // ── TABLES & BILLING STATE ───────────────────────────────────────────────
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [billingDetails, setBillingDetails] = useState({ table: null, orders: [], total: 0 });
  const [addServiceCharge, setAddServiceCharge] = useState(true);

  // ── MULTI-PAYMENT STATE ──────────────────────────────────────────────────
  const [payments, setPayments] = useState([]);
  const [addingMethod, setAddingMethod] = useState('dinheiro');
  const [addingAmount, setAddingAmount] = useState('');
  const [clientCpf, setClientCpf] = useState('');

  const [splitCount, setSplitCount] = useState(1);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [licenseBlocked, setLicenseBlocked] = useState(false);

  const [lojaInfo, setLojaInfo] = useState({
    nome_fantasia: '',
    telefone: '',
    cnpj: '',
    ie: '',
    endereco: ''
  });
  const [serverIp, setServerIp] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);

  // ── SANGRIA (WITHDRAWAL) STATE ─────────────────────────────────────────
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);

  const loadLojaInfo = async () => {
    try {
      const res = await apiFetch('/api/loja');
      if (res.ok) setLojaInfo(await res.json());
    } catch (err) {
      console.error('Erro ao carregar dados da loja:', err);
    }
  };
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [closureData, setClosureData] = useState({ transactions: [], summary: [], total_revenue: 0, transactions_count: 0 });

  // ── CANCEL STATE ─────────────────────────────────────────────────────────
  const [cancelItemModal, setCancelItemModal] = useState(null);
  const [cancellingItem, setCancellingItem] = useState(null);
  const [showCancelTableConfirm, setShowCancelTableConfirm] = useState(false);

  // ── DERIVED CALCULATIONS ─────────────────────────────────────────────────
  const subtotal = billingDetails.total || 0;
  const serviceCharge = addServiceCharge ? subtotal * 0.10 : 0;
  const total = subtotal + serviceCharge;
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(0, total - totalPaid);
  const isFullyPaid = totalPaid >= total && payments.length > 0;

  // ── CASH REGISTER FETCH ──────────────────────────────────────────────────
  const fetchRegisterStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/cash-register/status');
      if (res.ok) {
        const data = await res.json();
        setCashRegister(data.session || false);
      } else {
        setCashRegister(false);
      }
    } catch {
      setCashRegister(false);
    } finally {
      setLoadingRegister(false);
    }
  }, [apiFetch]);

  useEffect(() => { fetchRegisterStatus(); }, [fetchRegisterStatus]);

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

  // ── TABLES FETCH ─────────────────────────────────────────────────────────
  const loadTables = async () => {
    try {
      const res = await apiFetch('/api/tables');
      if (res.ok) setTables(await res.json());
    } catch (err) { console.error(err); }
  };

  const loadServerIp = async () => {
    try {
      const res = await apiFetch('/api/device-ip');
      if (res.ok) {
        const data = await res.json();
        setServerIp(data.ip);
      }
    } catch (err) {
      console.error('Erro ao obter IP do servidor:', err);
    }
  };

  useEffect(() => {
    loadTables();
    loadLojaInfo();
    loadServerIp();
  }, []);

  // ── LOAD WITHDRAWALS ────────────────────────────────────────────────
  const loadWithdrawals = async () => {
    try {
      const res = await apiFetch('/api/cash-register/withdrawals');
      if (res.ok) {
        const data = await res.json();
        setTotalWithdrawals(data.total || 0);
      }
    } catch (err) {
      console.error('Erro ao carregar sangrias:', err);
    }
  };

  useEffect(() => {
    if (cashRegister) loadWithdrawals();
  }, [cashRegister]);

  useEffect(() => {
    if (!socket) return;
    const handler = (updatedTable) => {
      setTables(prev => prev.map(t => t.id === updatedTable.id ? updatedTable : t));
      setSelectedTable(prev => {
        if (prev && prev.id === updatedTable.id) {
          if (updatedTable.status === 'free') return null;
          return updatedTable;
        }
        return prev;
      });
    };
    socket.on('table_status_changed', handler);
    return () => socket.off('table_status_changed', handler);
  }, [socket]);

  useEffect(() => {
    if (!selectedTable) {
      setBillingDetails({ table: null, orders: [], total: 0 });
      setPayments([]);
      setSplitCount(1);
      setAddServiceCharge(true);
      setClientCpf('');
      return;
    }
    loadBilling();
  }, [selectedTable]);

  useEffect(() => {
    const sub = billingDetails.total || 0;
    const tot = addServiceCharge ? sub * 1.10 : sub;
    setAddingAmount(tot.toFixed(2));
    setPayments([]);
  }, [addServiceCharge]);

  async function loadBilling() {
    if (!selectedTable) return;
    try {
      const res = await apiFetch(`/api/orders/table/${selectedTable.number}/active`);
      if (res.ok) {
        const data = await res.json();
        setBillingDetails(data);
        const sub = data.total || 0;
        const tot = addServiceCharge ? sub * 1.10 : sub;
        setAddingAmount(tot.toFixed(2));
        setPayments([]);
      }
    } catch (err) { console.error(err); }
  }

  // ── OPEN CASH REGISTER ────────────────────────────────────────────────────
  const handleOpenRegister = async () => {
    if (licenseBlocked) return;
    const amt = parseFloat(openingAmount);
    if (isNaN(amt) || amt < 0) {
      alert('Informe um valor válido para o fundo de caixa (pode ser R$ 0,00).');
      return;
    }
    setRegisterActionLoading(true);
    try {
      const res = await apiFetch('/api/cash-register/open', {
        method: 'POST',
        body: JSON.stringify({
          initial_amount: amt,
          operator_name: user?.name || user?.username || 'Operador'
        })
      });
      if (window.__LICENSE_BLOCKED__) {
        setLicenseBlocked(true);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setCashRegister(data.session);
        setShowOpenModal(false);
        setOpeningAmount('');
      } else {
        alert(data.message || 'Erro ao abrir o caixa.');
      }
    } catch {
      alert('Erro de conexão ao abrir o caixa.');
    } finally {
      setRegisterActionLoading(false);
    }
  };

  // ── CLOSE CASH REGISTER ───────────────────────────────────────────────────
  const handleCloseRegister = async () => {
    setRegisterActionLoading(true);
    try {
      const res = await apiFetch('/api/cash-register/close', { method: 'POST' });
      if (window.__LICENSE_BLOCKED__) {
        setLicenseBlocked(true);
        setShowCloseModal(false);
        setShowOpenModal(true);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setClosingResult(data.summary);
        setCashRegister(false);
        setSelectedTable(null);
        setShowCloseModal(false);
      } else {
        alert(data.message || 'Erro ao fechar o caixa.');
      }
    } catch {
      alert('Erro de conexão ao fechar o caixa.');
    } finally {
      setRegisterActionLoading(false);
    }
  };

  // ── PAYMENT HANDLERS ──────────────────────────────────────────────────────
  const handleAddPayment = () => {
    const val = parseFloat(addingAmount);
    if (!addingMethod || isNaN(val) || val <= 0) return;
    const capped = Math.min(val, remaining > 0 ? remaining : val);
    setPayments(prev => [...prev, { method: addingMethod, amount: capped }]);
    setAddingAmount(remaining - capped > 0 ? (remaining - capped).toFixed(2) : '');
  };

  const handleRemovePayment = (idx) => {
    setPayments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFillRemaining = () => {
    setAddingAmount(remaining.toFixed(2));
  };

  const handleProcessPayment = async () => {
    if (!selectedTable || !total || !isFullyPaid) return;
    try {
      const primaryMethod = payments[0]?.method || 'dinheiro';
      const checkoutBody = {
        table_id: selectedTable.id,
        payment_method: primaryMethod,
        payments_detail: payments,
        split_count: splitCount,
        total_amount: total,
        client_cpf: clientCpf.trim() || null,
      };
      const res = await apiFetch('/api/reports/checkout', {
        method: 'POST',
        body: JSON.stringify(checkoutBody),
      });
      if (res.ok) {
        const davRes = await apiFetch('/api/dav/next-number');
        const davData = davRes.ok ? await davRes.json() : { dav_number: '000000', dav_code: '001', period: '' };

        setReceiptData({
          table_number: selectedTable.number,
          orders: billingDetails.orders,
          subtotal: subtotal,
          service_charge: serviceCharge,
          total: total,
          payments,
          split_count: splitCount,
          client_cpf: clientCpf.trim() || null,
          date: new Date().toLocaleString('pt-BR'),
          dav_number: davData.dav_number,
          dav_code: davData.dav_code,
        });
        setSelectedTable(null);
        setShowReceiptModal(true);
        loadTables();
      } else {
        const err = await res.json();
        alert(err.message || 'Erro ao efetuar pagamento.');
      }
    } catch (error) {
      console.error(error);
      alert('Erro de conexão ao processar transação.');
    }
  };

  const handleReopenTable = async () => {
    if (!selectedTable) return;
    try {
      const res = await apiFetch(`/api/tables/${selectedTable.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'occupied' })
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedTable(updated);
        setTables(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        alert('Erro ao reabrir a mesa.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao reabrir mesa.');
    }
  };

  const handleReleaseEmptyTable = async () => {
    if (!selectedTable) return;
    if (!confirm(`Deseja realmente fechar e liberar a Mesa ${selectedTable.number} sem consumo?`)) return;
    try {
      const res = await apiFetch(`/api/tables/${selectedTable.id}/reset`, { method: 'PUT' });
      if (res.ok) {
        setSelectedTable(null);
        loadTables();
        alert('Mesa liberada com sucesso!');
      } else {
        const err = await res.json();
        alert(err.message || 'Erro ao liberar mesa.');
      }
    } catch (error) {
      console.error(error);
      alert('Erro de conexão ao liberar mesa.');
    }
  };

  const openCancelItemModal = (item) => {
    setCancelItemModal({ item, cancelQty: item.quantity });
  };

  const confirmCancelItem = async () => {
    if (!cancelItemModal) return;
    const { item, cancelQty } = cancelItemModal;
    setCancellingItem(item.id);
    setCancelItemModal(null);
    try {
      const res = await apiFetch(`/api/orders/item/${item.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ quantity: cancelQty }),
      });
      if (res.ok) {
        const billingRes = await apiFetch(`/api/orders/table/${selectedTable.number}/active`);
        if (billingRes.ok) {
          const newBilling = await billingRes.json();
          setBillingDetails(newBilling);
          setAddingAmount(newBilling.total?.toFixed(2) || '');
          setPayments([]);
        }
      } else {
        const err = await res.json();
        alert(err.message || 'Erro ao cancelar item.');
      }
    } catch (error) {
      console.error(error);
      alert('Erro de conexão ao cancelar item.');
    } finally {
      setCancellingItem(null);
    }
  };

  const handleCancelTableOrders = async () => {
    if (!selectedTable) return;
    setShowCancelTableConfirm(false);
    try {
      const res = await apiFetch(`/api/orders/table/${selectedTable.id}/cancel-all`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedTable(null);
        loadTables();
      } else {
        const err = await res.json();
        alert(err.message || 'Erro ao cancelar pedidos da mesa.');
      }
    } catch (error) {
      console.error(error);
      alert('Erro de conexão ao cancelar pedidos.');
    }
  };

  const handleOpenClosure = async () => {
    try {
      const res = await apiFetch('/api/reports/closure');
      if (res.ok) {
        setClosureData(await res.json());
        setShowClosureModal(true);
      }
    } catch (err) { console.error(err); }
  };

  // ── HANDLE WITHDRAWAL (SANGRIA) ─────────────────────────────────────
  const handleWithdraw = async () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Informe um valor válido para a sangria.');
      return;
    }
    if (!withdrawReason.trim()) {
      alert('Informe o motivo da sangria.');
      return;
    }
    setWithdrawLoading(true);
    try {
      const res = await apiFetch('/api/cash-register/withdrawal', {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          reason: withdrawReason.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTotalWithdrawals(data.total_withdrawals || 0);
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        setWithdrawReason('');
        alert('Sangria registrada com sucesso!');
      } else {
        alert(data.message || 'Erro ao registrar sangria.');
      }
    } catch {
      alert('Erro de conexão ao registrar sangria.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const getMethodLabel = (id) => PAYMENT_OPTIONS.find(p => p.id === id)?.label || id;
  const getMethodEmoji = (id) => PAYMENT_OPTIONS.find(p => p.id === id)?.emoji || '💰';
  const getMethodColor = (id) => colorMap[PAYMENT_OPTIONS.find(p => p.id === id)?.color || 'brand'];

  const getTableStatusStyle = (status) => {
    switch (status) {
      case 'free': return 'bg-zinc-100 border-zinc-200 dark:bg-dark-element dark:border-dark-border text-zinc-400 cursor-not-allowed opacity-60';
      case 'occupied': return 'bg-amber-50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 cursor-pointer hover:shadow-md';
      case 'waiting_payment': return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 cursor-pointer hover:shadow-md animate-pulse';
      default: return 'bg-zinc-50 border-zinc-200 text-zinc-500';
    }
  };

  // ── LOADING STATE ─────────────────────────────────────────────────────────
  if (loadingRegister) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-brand-500/10 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
              <Landmark className="h-7 w-7 text-brand-500" />
            </div>
            <p className="text-zinc-500 dark:text-dark-muted font-semibold text-sm">Verificando status do caixa...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── CLOSED REGISTER SCREEN ─────────────────────────────────────────────────
  if (!cashRegister) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full space-y-6">

            {/* Closing result summary — shown after register was just closed */}
            {closingResult && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-5 space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/40 rounded-xl">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-emerald-800 dark:text-emerald-300 text-sm">Caixa Fechado com Sucesso!</h3>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Resumo do fechamento</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white dark:bg-dark-card border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3">
                    <p className="text-zinc-400 font-semibold">Fundo de Caixa</p>
                    <p className="text-base font-extrabold text-zinc-800 dark:text-dark-text">R$ {closingResult.initial_amount?.toFixed(2)}</p>
                  </div>
                  <div className="bg-white dark:bg-dark-card border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3">
                    <p className="text-zinc-400 font-semibold">Receita do Dia</p>
                    <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">R$ {closingResult.total_revenue?.toFixed(2)}</p>
                  </div>
                  <div className="bg-white dark:bg-dark-card border border-red-100 dark:border-red-900/30 rounded-xl p-3">
                    <p className="text-red-400 font-semibold">Sangrias</p>
                    <p className="text-base font-extrabold text-red-600 dark:text-red-400">- R$ {(closingResult.total_withdrawals || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-white dark:bg-dark-card border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3">
                    <p className="text-zinc-400 font-semibold">Transações</p>
                    <p className="text-base font-extrabold text-zinc-800 dark:text-dark-text">{closingResult.total_transactions}</p>
                  </div>
                  <div className="col-span-2 bg-zinc-900 dark:bg-zinc-800 rounded-xl p-3">
                    <p className="text-zinc-400 font-semibold">Total em Caixa</p>
                    <p className="text-lg font-extrabold text-emerald-400">R$ {closingResult.final_amount?.toFixed(2)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setClosingResult(null)}
                  className="w-full text-xs text-emerald-600 hover:text-emerald-700 font-bold underline underline-offset-2"
                >
                  Fechar resumo
                </button>
              </div>
            )}

            {/* Locked cashier card */}
            <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-3xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-800 dark:to-zinc-900 p-8 text-center space-y-4">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto ring-4 ring-white/20">
                  <Lock className="h-9 w-9 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-white">Caixa Fechado</h2>
                  <p className="text-zinc-400 text-sm mt-1">Para operar, é necessário abrir o caixa e informar o fundo inicial.</p>
                </div>
              </div>

              <div className="p-6 space-y-3">
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl px-4 py-3 flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                    O caixa precisa ser aberto no início de cada turno. Registre o valor do fundo de caixa (troco disponível) para começar.
                  </p>
                </div>

                <button
                  onClick={() => setShowOpenModal(true)}
                  className="w-full py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/20 flex items-center justify-center space-x-2 transition text-sm"
                >
                  <LogIn className="h-5 w-5" />
                  <span>Abrir Caixa</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL: Abrir Caixa */}
        {showOpenModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-sm w-full rounded-2xl shadow-2xl overflow-hidden">
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
                    <button onClick={() => setShowOpenModal(false)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
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
                        O sistema está <strong className="text-red-600 dark:text-red-400">BLOQUEADO</strong> e não é possível abrir o caixa até que uma nova chave de licença seja ativada.
                      </p>
                    </div>

                    <div className="bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-800/40 rounded-xl p-4">
                      <p className="text-sm text-red-700 dark:text-red-300 font-bold text-center">
                        Entre em contato com o <span className="underline">administrador do sistema</span> para obter uma nova licença.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowOpenModal(false)}
                      className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-red-500/20"
                    >
                      Entendido
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* CABEÇALHO NORMAL - ABERTURA DE CAIXA */}
                  <div className="bg-gradient-to-r from-brand-500 to-brand-600 p-5 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-white/20 rounded-xl">
                        <Unlock className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-base">Abertura de Caixa</h3>
                        <p className="text-brand-100 text-xs">Informe o fundo de caixa inicial</p>
                      </div>
                    </div>
                    <button onClick={() => setShowOpenModal(false)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* FORMULÁRIO NORMAL */}
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted uppercase tracking-wider mb-2">
                        Operador
                      </label>
                      <div className="bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border rounded-xl px-4 py-3 text-sm font-bold text-zinc-700 dark:text-dark-text">
                        {user?.name || user?.username || 'Operador'}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted uppercase tracking-wider mb-2">
                        Fundo de Caixa (Troco Disponível)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={openingAmount}
                          onChange={e => setOpeningAmount(e.target.value)}
                          placeholder="0,00"
                          autoFocus
                          className="w-full pl-10 pr-4 py-3.5 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-lg font-extrabold text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                        />
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1.5">
                        Este valor é o troco que você tem disponível no início do turno. Pode ser R$ 0,00.
                      </p>
                    </div>

                    <div className="flex space-x-3 pt-1">
                      <button
                        onClick={handleOpenRegister}
                        disabled={registerActionLoading}
                        className="flex-1 py-3.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-brand-500/20"
                      >
                        {registerActionLoading ? (
                          <span>Abrindo...</span>
                        ) : (
                          <>
                            <LogIn className="h-4 w-4" />
                            <span>Abrir Caixa</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setShowOpenModal(false)}
                        className="flex-1 py-3.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-700 dark:text-dark-text font-bold rounded-xl text-sm transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── OPEN REGISTER — MAIN DASHBOARD ────────────────────────────────────────
  const sessionStart = cashRegister?.opened_at
    ? new Date(cashRegister.opened_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-200">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center space-x-3">
            <div className="bg-brand-500 text-white p-3 rounded-2xl shadow-lg shadow-brand-500/20">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-dark-text">Caixa Operacional</h1>
              <p className="text-xs font-semibold text-zinc-500 dark:text-dark-muted">Fechamento de contas · Múltiplos meios de pagamento</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 flex-wrap gap-2">
            {/* Cash register status badge */}
            <div className="flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 px-3 py-2 rounded-xl">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Caixa Aberto</span>
              <span className="text-[10px] text-emerald-500 font-semibold">desde {sessionStart}</span>
            </div>
            <button
              onClick={() => setShowQrModal(true)}
              className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-500/10 transition text-xs flex items-center space-x-2"
            >
              <QrCode className="h-4 w-4" />
              <span>Conectar Celular</span>
            </button>
            <button
              onClick={handleOpenClosure}
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl shadow-lg transition text-xs flex items-center space-x-2"
            >
              <Archive className="h-4 w-4" />
              <span>Resumo do Caixa</span>
            </button>
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 transition text-xs flex items-center space-x-2"
            >
              <Wallet className="h-4 w-4" />
              <span>Sangria</span>
            </button>
            <button
              onClick={() => setShowCloseModal(true)}
              className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition text-xs flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Fechar Caixa</span>
            </button>
          </div>
        </div>

        {/* Register Info Bar */}
        <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-2xl p-4 mb-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/20 rounded-xl">
              <Wallet className="h-4 w-4 text-brand-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Fundo de Caixa</p>
              <p className="text-sm font-extrabold text-zinc-800 dark:text-dark-text">R$ {cashRegister.initial_amount?.toFixed(2)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded-xl">
              <Users className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Operador</p>
              <p className="text-sm font-extrabold text-zinc-800 dark:text-dark-text">{cashRegister.operator_name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl">
              <Clock className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Abertura</p>
              <p className="text-sm font-extrabold text-zinc-800 dark:text-dark-text">{sessionStart}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded-xl">
              <Wallet className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Sangrias</p>
              <p className="text-sm font-extrabold text-red-600 dark:text-red-400">R$ {totalWithdrawals.toFixed(2)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-zinc-50 dark:bg-dark-element rounded-xl">
              <TrendingUp className="h-4 w-4 text-zinc-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Mesas Ativas</p>
              <p className="text-sm font-extrabold text-zinc-800 dark:text-dark-text">{tables.filter(t => t.status !== 'free').length}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Mesas (left) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-4 rounded-2xl">
              <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text mb-4">Mesas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {tables.map((table) => (
                  <button
                    key={table.id}
                    disabled={table.status === 'free'}
                    onClick={() => setSelectedTable(table)}
                    className={`flex flex-col items-center justify-center p-4 border-2 rounded-2xl transition duration-200 ${getTableStatusStyle(table.status)} ${selectedTable?.id === table.id ? 'ring-2 ring-brand-500 ring-offset-1' : ''}`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-60">Mesa</span>
                    <span className="text-3xl font-extrabold my-1">{table.number}</span>
                    <span className="text-[10px] font-bold uppercase">
                      {table.status === 'occupied' ? 'Em consumo' : table.status === 'waiting_payment' ? '⚠️ Pedindo Conta' : 'Livre'}
                    </span>
                  </button>
                ))}
              </div>
              {tables.filter(t => t.status !== 'free').length === 0 && (
                <p className="text-center py-10 text-zinc-400 font-semibold text-sm">Nenhuma mesa ocupada no momento.</p>
              )}
            </div>
          </div>

          {/* Painel de Pagamento (right) */}
          <div className="lg:col-span-6">
            {selectedTable ? (
              <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-2xl shadow-md p-6 space-y-5">

                {/* Cabeçalho */}
                <div className="flex justify-between items-center border-b border-zinc-100 dark:border-dark-border pb-4">
                  <div>
                    <div className="flex items-center flex-wrap gap-2">
                      <h3 className="font-extrabold text-xl text-zinc-900 dark:text-dark-text">Mesa {selectedTable.number}</h3>
                      {selectedTable.status === 'waiting_payment' && (
                        <button
                          onClick={handleReopenTable}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-sm transition"
                        >
                          Reabrir Mesa
                        </button>
                      )}
                      {billingDetails.orders.length > 0 && (
                        <button
                          onClick={() => setShowCancelTableConfirm(true)}
                          className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-sm transition flex items-center space-x-1"
                        >
                          <Ban className="h-3 w-3" />
                          <span>Cancelar Mesa</span>
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">Total: <span className="font-extrabold text-zinc-800 dark:text-dark-text text-base">R$ {billingDetails.total.toFixed(2)}</span></p>
                  </div>
                  <button onClick={() => setSelectedTable(null)} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Consumo com opção de cancelar itens */}
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Itens do Consumo</span>
                    <span className="text-[10px] text-zinc-400">🗑️ para cancelar item</span>
                  </div>
                  {billingDetails.orders.map((order) => (
                    <div key={order.id} className="space-y-1">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm bg-zinc-50 dark:bg-dark-element rounded-xl px-3 py-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <span className="font-bold text-zinc-800 dark:text-dark-text shrink-0">{item.quantity}x</span>
                            <span className="text-zinc-600 dark:text-dark-muted truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center space-x-2 ml-2">
                            <span className="font-bold text-zinc-800 dark:text-dark-text text-xs">R$ {(item.price * item.quantity).toFixed(2)}</span>
                            <button
                              onClick={() => openCancelItemModal(item)}
                              disabled={cancellingItem === item.id}
                              title="Cancelar este item"
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition disabled:opacity-40"
                            >
                              {cancellingItem === item.id
                                ? <span className="text-[10px] font-bold">...</span>
                                : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {billingDetails.orders.length === 0 && (
                    <p className="text-center py-4 text-zinc-400 text-xs">Nenhum item no consumo.</p>
                  )}
                </div>

                {billingDetails.total > 0 ? (
                  <>
                    {/* Divisão de conta */}
                    <div className="bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border p-3 rounded-xl flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs font-bold text-zinc-600 dark:text-dark-text">
                        <Users className="h-4 w-4 text-brand-500" />
                        <span>Dividir por:</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => setSplitCount(Math.max(1, splitCount - 1))} className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-300">-</button>
                        <span className="font-extrabold text-zinc-800 dark:text-dark-text w-6 text-center">{splitCount}</span>
                        <button onClick={() => setSplitCount(splitCount + 1)} className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-sm hover:bg-zinc-300">+</button>
                        {splitCount > 1 && (
                          <span className="text-xs font-bold text-brand-500 ml-1">= R$ {(billingDetails.total / splitCount).toFixed(2)}/pessoa</span>
                        )}
                      </div>
                    </div>

                    {/* ===== MÚLTIPLOS PAGAMENTOS ===== */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-zinc-500 dark:text-dark-muted uppercase tracking-wider">Meios de Pagamento</h4>
                        {remaining > 0 && (
                          <span className="text-xs font-bold text-red-500">Faltam R$ {remaining.toFixed(2)}</span>
                        )}
                        {isFullyPaid && (
                          <span className="text-xs font-bold text-emerald-500 flex items-center space-x-1">
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Pagamento completo</span>
                          </span>
                        )}
                      </div>

                      {payments.length > 0 && (
                        <div className="space-y-2">
                          {payments.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border rounded-xl px-3 py-2">
                              <div className="flex items-center space-x-2">
                                <span className="text-base">{getMethodEmoji(p.method)}</span>
                                <span className="text-sm font-bold text-zinc-700 dark:text-dark-text">{getMethodLabel(p.method)}</span>
                              </div>
                              <div className="flex items-center space-x-3">
                                <span className="font-extrabold text-zinc-900 dark:text-dark-text">R$ {Number(p.amount).toFixed(2)}</span>
                                <button onClick={() => handleRemovePayment(idx)} className="text-red-400 hover:text-red-600">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!isFullyPaid && (
                        <div className="border border-dashed border-zinc-300 dark:border-dark-border rounded-xl p-3 space-y-3">
                          <div className="grid grid-cols-5 gap-1.5">
                            {PAYMENT_OPTIONS.map((opt) => {
                              const Icon = opt.icon;
                              const isSelected = addingMethod === opt.id;
                              const colors = colorMap[opt.color];
                              return (
                                <button
                                  key={opt.id}
                                  onClick={() => setAddingMethod(opt.id)}
                                  className={`flex flex-col items-center py-2.5 rounded-xl border text-[10px] font-bold transition-all duration-200 space-y-1 ${
                                    isSelected ? `${colors.active} shadow-lg` : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-dark-border text-zinc-500 dark:text-dark-muted'
                                  }`}
                                >
                                  <Icon className="h-4 w-4" />
                                  <span>{opt.label}</span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center space-x-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">R$</span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={addingAmount}
                                onChange={(e) => setAddingAmount(e.target.value)}
                                placeholder="0,00"
                                className="w-full pl-9 pr-3 py-2.5 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm font-bold text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                              />
                            </div>
                            {remaining > 0 && (
                              <button
                                onClick={handleFillRemaining}
                                className="px-3 py-2.5 text-xs font-bold bg-zinc-100 dark:bg-dark-element hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-dark-muted rounded-xl border border-zinc-200 dark:border-dark-border whitespace-nowrap transition"
                              >
                                Resto
                              </button>
                            )}
                            <button
                              onClick={handleAddPayment}
                              disabled={!addingAmount || parseFloat(addingAmount) <= 0}
                              className="p-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white rounded-xl shadow-md shadow-brand-500/20 transition"
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Total e botão confirmar */}
                    <div className="border-t border-zinc-100 dark:border-dark-border pt-4 space-y-3">

                      {/* Checkbox de 10% */}
                      <div className="flex items-center justify-between bg-zinc-50 dark:bg-dark-element px-3 py-2 rounded-xl border border-zinc-200 dark:border-dark-border">
                        <label className="flex items-center space-x-2 cursor-pointer select-none text-xs font-bold text-zinc-600 dark:text-dark-text">
                          <input
                            type="checkbox"
                            checked={addServiceCharge}
                            onChange={(e) => setAddServiceCharge(e.target.checked)}
                            className="w-4 h-4 rounded text-brand-500 border-zinc-300 focus:ring-brand-500"
                          />
                          <span>Incluir taxa de serviço (10%)</span>
                        </label>
                        {addServiceCharge && (
                          <span className="text-xs font-extrabold text-zinc-800 dark:text-dark-text">R$ {serviceCharge.toFixed(2)}</span>
                        )}
                      </div>

                      {/* CPF opcional do cliente */}
                      <div className="flex items-center justify-between bg-zinc-50 dark:bg-dark-element px-3 py-2 rounded-xl border border-zinc-200 dark:border-dark-border">
                        <label className="text-xs font-bold text-zinc-600 dark:text-dark-text whitespace-nowrap mr-2">CPF na Nota:</label>
                        <input
                          type="text"
                          value={clientCpf}
                          onChange={(e) => {
                            // Format CPF as user types: 000.000.000-00
                            let v = e.target.value.replace(/\D/g, '').slice(0, 11);
                            if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
                            else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
                            else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
                            setClientCpf(v);
                          }}
                          placeholder="000.000.000-00 (opcional)"
                          className="flex-1 px-3 py-1.5 border border-zinc-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-sm font-bold text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-right"
                          maxLength={14}
                        />
                      </div>

                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between items-center text-zinc-500 dark:text-dark-muted font-bold text-xs">
                          <span>Subtotal Consumo:</span>
                          <span>R$ {subtotal.toFixed(2)}</span>
                        </div>
                        {addServiceCharge && (
                          <div className="flex justify-between items-center text-zinc-500 dark:text-dark-muted font-bold text-xs">
                            <span>Taxa de Serviço (10%):</span>
                            <span>R$ {serviceCharge.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center border-t border-dashed border-zinc-200 dark:border-dark-border pt-1.5">
                          <span className="font-bold text-zinc-800 dark:text-dark-text">Total Geral:</span>
                          <span className="text-2xl font-extrabold text-zinc-950 dark:text-dark-text">R$ {total.toFixed(2)}</span>
                        </div>
                      </div>

                      {totalPaid > total && (
                        <div className="flex justify-between items-center text-sm font-bold text-emerald-600">
                          <span>Troco:</span>
                          <span>R$ {(totalPaid - total).toFixed(2)}</span>
                        </div>
                      )}
                      <button
                        onClick={handleProcessPayment}
                        disabled={!isFullyPaid}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 text-sm flex items-center justify-center space-x-2 transition duration-200"
                      >
                        <CheckCircle className="h-5 w-5" />
                        <span>{isFullyPaid ? 'Concluir Venda e Liberar Mesa' : `Adicione R$ ${remaining.toFixed(2)} para continuar`}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-zinc-50 dark:bg-dark-element border-2 border-dashed border-zinc-200 dark:border-dark-border/60 rounded-2xl p-6 text-center space-y-4">
                    <div className="text-amber-500 flex justify-center">
                      <AlertCircle className="h-10 w-10 animate-bounce" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-800 dark:text-dark-text">Esta mesa não possui consumo ativo.</p>
                      <p className="text-xs text-zinc-400 mt-1">Nenhum pedido foi lançado para esta mesa ainda.</p>
                    </div>
                    <button
                      onClick={handleReleaseEmptyTable}
                      className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 text-xs flex items-center justify-center space-x-2 transition"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Fechar e Liberar Mesa sem Consumo</span>
                    </button>
                  </div>
                )}

              </div>
            ) : (
              <div className="bg-zinc-100 dark:bg-dark-card/30 border-2 border-dashed border-zinc-200 dark:border-dark-border/40 p-14 text-center rounded-2xl text-zinc-400">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-bold">Selecione uma mesa ativa</p>
                <p className="text-xs mt-1">As mesas piscando em vermelho estão pedindo a conta.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL: Fechar Caixa */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-sm w-full rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Lock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Fechar Caixa</h3>
                  <p className="text-red-100 text-xs">Esta ação encerrará o turno atual</p>
                </div>
              </div>
              <button onClick={() => setShowCloseModal(false)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {tables.filter(t => t.status !== 'free').length > 0 ? (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl p-4 space-y-2">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">Não é possível fechar o caixa</p>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Existem <strong>{tables.filter(t => t.status !== 'free').length} mesa(s)</strong> ainda abertas. Finalize ou cancele todos os atendimentos antes de fechar o caixa.
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tables.filter(t => t.status !== 'free').map(t => (
                      <span key={t.id} className="px-2 py-0.5 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-[10px] font-bold rounded-full">
                        Mesa {t.number}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500 font-semibold">Operador:</span>
                      <span className="font-bold text-zinc-800 dark:text-dark-text">{cashRegister.operator_name}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500 font-semibold">Abertura às:</span>
                      <span className="font-bold text-zinc-800 dark:text-dark-text">{sessionStart}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500 font-semibold">Fundo de Caixa:</span>
                      <span className="font-bold text-zinc-800 dark:text-dark-text">R$ {cashRegister.initial_amount?.toFixed(2)}</span>
                    </div>
                    {totalWithdrawals > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-red-500 font-semibold">Sangrias:</span>
                        <span className="font-bold text-red-600">- R$ {totalWithdrawals.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl px-4 py-3 flex items-start space-x-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      Ao fechar o caixa, o turno será encerrado e todas as transações serão consolidadas no relatório do dia.
                    </p>
                  </div>
                  <button
                    onClick={handleCloseRegister}
                    disabled={registerActionLoading}
                    className="w-full py-3.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-red-500/20"
                  >
                    {registerActionLoading ? (
                      <span>Fechando caixa...</span>
                    ) : (
                      <>
                        <LogOut className="h-4 w-4" />
                        <span>Confirmar Fechamento do Caixa</span>
                      </>
                    )}
                  </button>
                </>
              )}

              <button
                onClick={() => setShowCloseModal(false)}
                className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-700 dark:text-dark-text font-bold rounded-xl text-sm transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cupom */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col text-zinc-800 border">
            <div className="p-4 bg-zinc-50 border-b flex justify-between items-center">
              <span className="font-extrabold text-sm">DAV — Mesa {receiptData.table_number}</span>
              <button onClick={() => setShowReceiptModal(false)} className="p-1 rounded bg-zinc-200 hover:bg-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 bg-zinc-100 flex justify-center overflow-y-auto">
              <div id="receipt-print-area" className="w-[58mm] bg-white text-black p-4 font-mono shadow border text-[9px] leading-relaxed">
                <div className="text-center font-bold">
                  <p className="text-xs uppercase">{lojaInfo.nome_fantasia || '*** MENU CHEF ***'}</p>
                  {lojaInfo.cnpj && <p>CNPJ: {lojaInfo.cnpj}</p>}
                  {lojaInfo.ie && <p>IE: {lojaInfo.ie}</p>}
                  {lojaInfo.endereco && <p className="text-[8px]">{lojaInfo.endereco}</p>}
                  {lojaInfo.telefone && <p>TEL: {lojaInfo.telefone}</p>}
                </div>
                <p className="text-center font-bold mt-2">D A V</p>
                <p className="text-center font-bold text-[8px]">da Nota Fiscal de Consumidor Eletrônica</p>
                <div className="text-center my-2 border-t border-b border-dashed border-black py-1">
                  <p className="text-[8px] font-bold tracking-wider uppercase">Não tem valor fiscal</p>
                </div>
                <p className="flex justify-between"><span>DAV Nº:</span><span className="font-bold">{receiptData.dav_number}</span></p>
                <p className="flex justify-between text-[8px]"><span>Data/Hora:</span><span>{receiptData.date}</span></p>
                <p className="flex justify-between text-[8px]"><span>Terminal:</span><span>001</span></p>
                <p className="text-center">--------------------------------</p>
                <p className="font-bold flex justify-between text-[8px]">
                  <span>ITEM CÓD.   DESC.</span>
                  <span>QTD  VL.TOTAL</span>
                </p>
                <p className="text-center">--------------------------------</p>
                <div className="space-y-1">
                  {receiptData.orders.map((order) =>
                    order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[8px]">
                        <span className="truncate pr-1">{String(idx + 1).padStart(2, '0')} {item.name?.substring(0, 18)}</span>
                        <span className="flex-shrink-0 font-bold">{item.quantity}x R${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-center">--------------------------------</p>
                <p className="flex justify-between"><span>Valor Produtos:</span><span>R$ {receiptData.subtotal.toFixed(2)}</span></p>
                {receiptData.service_charge > 0 && (
                  <p className="flex justify-between"><span>Acréscimos:</span><span>R$ {receiptData.service_charge.toFixed(2)}</span></p>
                )}
                <p className="font-bold flex justify-between"><span>VALOR À PAGAR:</span><span>R$ {receiptData.total.toFixed(2)}</span></p>
                {receiptData.split_count > 1 && (
                  <p className="flex justify-between text-[8px]"><span>Por pessoa ({receiptData.split_count}x):</span><span>R$ {(receiptData.total / receiptData.split_count).toFixed(2)}</span></p>
                )}
                <p className="text-center">--------------------------------</p>
                <p className="font-bold">PAGAMENTO:</p>
                {receiptData.payments.map((p, i) => (
                  <p key={i} className="flex justify-between">
                    <span>{getMethodEmoji(p.method)} {getMethodLabel(p.method)}:</span>
                    <span>R$ {Number(p.amount).toFixed(2)}</span>
                  </p>
                ))}
                {receiptData.payments.reduce((s, p) => s + Number(p.amount), 0) > receiptData.total && (
                  <p className="flex justify-between font-bold">
                    <span>TROCO:</span>
                    <span>R$ {(receiptData.payments.reduce((s, p) => s + Number(p.amount), 0) - receiptData.total).toFixed(2)}</span>
                  </p>
                )}
                <p className="text-center">--------------------------------</p>
                <p className="text-center text-[8px]">Qtd Total de Itens: {receiptData.orders.reduce((acc, o) => acc + o.items.reduce((a, i) => a + i.quantity, 0), 0)}</p>
                <div className="text-center my-3 border-t border-b border-dashed border-black py-2">
                  <p className="text-[10px] font-black tracking-widest uppercase">
                    *** NÃO É VÁLIDO COMO CUPOM FISCAL ***
                  </p>
                </div>
                <p className="text-center font-bold text-[8px] uppercase">Obrigado pela preferência!</p>
                <p className="text-center font-bold text-[8px] uppercase">Volte Sempre!</p>
              </div>
            </div>
            <div className="p-4 border-t bg-zinc-50 flex space-x-2">
              <button onClick={() => window.print()} className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5">
                <Printer className="h-4 w-4" />
                <span>Imprimir DAV</span>
              </button>
              <button onClick={() => setShowReceiptModal(false)} className="flex-1 py-3 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold rounded-xl text-xs">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Resumo do Caixa Aberto */}
      {showClosureModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-zinc-150 dark:border-dark-border bg-zinc-50 dark:bg-dark-element/50 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-xl text-zinc-900 dark:text-dark-text flex items-center space-x-2">
                  <Archive className="h-5 w-5 text-brand-500" />
                  <span>Resumo do Caixa Aberto</span>
                </h3>
                <p className="text-xs font-semibold text-zinc-400 mt-0.5">Transações desde a abertura do caixa</p>
              </div>
              <button onClick={() => setShowClosureModal(false)} className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Faturamento do Caixa</span>
                  <span className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-400">R$ {closureData.total_revenue?.toFixed(2)}</span>
                </div>
                <div className="bg-red-50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-red-600 block">Sangrias</span>
                  <span className="text-2xl font-extrabold text-red-600 dark:text-red-400">- R$ {(closureData.total_withdrawals || 0).toFixed(2)}</span>
                </div>
                <div className="bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border p-4 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">Vendas</span>
                  <span className="text-2xl font-extrabold text-zinc-800 dark:text-dark-text">{closureData.transactions_count} vendas</span>
                </div>
                <div className="bg-brand-50 dark:bg-brand-950/10 border border-brand-100 dark:border-brand-900/30 p-4 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-brand-600 block">Ticket Médio</span>
                  <span className="text-2xl font-extrabold text-brand-800 dark:text-brand-400">
                    R$ {closureData.transactions_count > 0 ? (closureData.total_revenue / closureData.transactions_count).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>

              {/* Resumo Líquido */}
              <div className="bg-zinc-900 dark:bg-zinc-800 rounded-2xl p-5 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Receita Líquida</p>
                    <p className="text-xs text-zinc-400 mt-0.5">Faturamento - Sangrias</p>
                  </div>
                  <span className="text-2xl font-extrabold text-emerald-400">R$ {(closureData.net_revenue || closureData.total_revenue || 0).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-sm text-zinc-700 dark:text-dark-text mb-3 uppercase tracking-wide">Por Método de Pagamento</h4>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {PAYMENT_OPTIONS.map((opt) => {
                    const found = closureData.summary?.find(s => s.payment_method === opt.id) || { total: 0, count: 0 };
                    return (
                      <div key={opt.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-dark-border p-3 rounded-xl flex flex-col items-center text-center">
                        <span className="text-lg">{opt.emoji}</span>
                        <span className="text-[10px] font-bold text-zinc-400 mt-0.5">{opt.label}</span>
                        <span className="text-sm font-extrabold text-zinc-800 dark:text-dark-text mt-1">R$ {found.total?.toFixed(2) || '0.00'}</span>
                        <span className="text-[9px] text-zinc-400">{found.count || 0}x</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-sm text-zinc-700 dark:text-dark-text mb-3 uppercase tracking-wide">Histórico de Transações</h4>
                <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                    <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Mesa</th>
                        <th className="px-4 py-3">Horário</th>
                        <th className="px-4 py-3">Método</th>
                        <th className="px-4 py-3">Div.</th>
                        <th className="px-4 py-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-xs text-zinc-600 dark:text-dark-text">
                      {closureData.transactions?.map((tx) => (
                        <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-dark-element/50">
                          <td className="px-4 py-3 font-bold">Mesa {tx.table_number}</td>
                          <td className="px-4 py-3">{new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-4 py-3 capitalize">{getMethodEmoji(tx.payment_method)} {getMethodLabel(tx.payment_method)}</td>
                          <td className="px-4 py-3">{tx.split_count}x</td>
                          <td className="px-4 py-3 text-right font-bold text-zinc-800 dark:text-dark-text">R$ {tx.total_amount?.toFixed(2)}</td>
                        </tr>
                      ))}
                      {(!closureData.transactions || closureData.transactions.length === 0) && (
                        <tr><td colSpan="5" className="text-center py-6 text-zinc-400 font-medium">Nenhuma transação hoje.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Histórico de Sangrias */}
              {closureData.withdrawals && closureData.withdrawals.length > 0 && (
                <div>
                  <h4 className="font-extrabold text-sm text-red-600 dark:text-red-400 mb-3 uppercase tracking-wide flex items-center space-x-2">
                    <Wallet className="h-4 w-4" />
                    <span>Sangrias do Caixa</span>
                    <span className="text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                      {closureData.withdrawals.length} registro(s)
                    </span>
                  </h4>
                  <div className="border border-red-200 dark:border-red-900/40 rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-red-200 dark:divide-red-900/40 text-left">
                      <thead className="bg-red-50 dark:bg-red-950/20 text-red-600 text-[10px] font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Horário</th>
                          <th className="px-4 py-3">Operador</th>
                          <th className="px-4 py-3">Motivo</th>
                          <th className="px-4 py-3 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100 dark:divide-red-900/30 text-xs text-zinc-600 dark:text-dark-text">
                        {closureData.withdrawals.map((w) => (
                          <tr key={w.id} className="hover:bg-red-50 dark:hover:bg-red-950/10">
                            <td className="px-4 py-3">{new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="px-4 py-3 font-bold">{w.operator_name}</td>
                            <td className="px-4 py-3 max-w-[200px] truncate">{w.reason}</td>
                            <td className="px-4 py-3 text-right font-extrabold text-red-600 dark:text-red-400">- R$ {w.amount?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-zinc-50 dark:bg-dark-element/30 flex justify-end space-x-3">
              <button onClick={() => window.print()} className="px-5 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5">
                <Printer className="h-4 w-4" />
                <span>Imprimir</span>
              </button>
              <button onClick={() => setShowClosureModal(false)} className="px-5 py-3 bg-zinc-200 hover:bg-zinc-300 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-700 dark:text-dark-text font-bold rounded-xl text-xs">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmação de Cancelamento de Item */}
      {cancelItemModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-sm w-full rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-dark-border">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-red-100 dark:bg-red-950/30 rounded-xl">
                  <Trash2 className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-zinc-900 dark:text-dark-text">Cancelar Item</h3>
                  <p className="text-[11px] text-zinc-400">Confirme o cancelamento abaixo</p>
                </div>
              </div>
              <button
                onClick={() => setCancelItemModal(null)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border rounded-xl p-4">
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-1">Produto</p>
                <p className="font-extrabold text-zinc-900 dark:text-dark-text text-sm">{cancelItemModal.item.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Qtd. no pedido: <strong>{cancelItemModal.item.quantity}</strong> &nbsp;·&nbsp;
                  R$ {cancelItemModal.item.price.toFixed(2)} / un.
                </p>
              </div>

              {cancelItemModal.item.quantity > 1 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-zinc-500 dark:text-dark-muted uppercase tracking-wider">
                    Quantos deseja cancelar?
                  </p>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setCancelItemModal(prev => ({ ...prev, cancelQty: Math.max(1, prev.cancelQty - 1) }))}
                      className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold text-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
                    >−</button>
                    <span className="flex-1 text-center font-extrabold text-2xl text-zinc-900 dark:text-dark-text">
                      {cancelItemModal.cancelQty}
                    </span>
                    <button
                      onClick={() => setCancelItemModal(prev => ({ ...prev, cancelQty: Math.min(prev.item.quantity, prev.cancelQty + 1) }))}
                      className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold text-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
                    >+</button>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-zinc-500 px-1">
                    <span>Cancelar <strong className="text-red-500">{cancelItemModal.cancelQty}</strong> de {cancelItemModal.item.quantity}</span>
                    <span className="text-red-500">− R$ {(cancelItemModal.item.price * cancelItemModal.cancelQty).toFixed(2)}</span>
                  </div>
                  {cancelItemModal.cancelQty < cancelItemModal.item.quantity && (
                    <button
                      onClick={() => setCancelItemModal(prev => ({ ...prev, cancelQty: prev.item.quantity }))}
                      className="w-full text-[11px] font-bold text-red-400 hover:text-red-600 underline underline-offset-2 text-center transition"
                    >
                      Cancelar todos os {cancelItemModal.item.quantity} itens
                    </button>
                  )}
                </div>
              )}

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Tem certeza? Esta ação irá remover{' '}
                    <strong>{cancelItemModal.cancelQty}x {cancelItemModal.item.name}</strong> do consumo da mesa. Isso não pode ser desfeito.
                  </span>
                </p>
              </div>

              <div className="flex space-x-3 pt-1">
                <button
                  onClick={confirmCancelItem}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-red-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Confirmar Cancelamento</span>
                </button>
                <button
                  onClick={() => setCancelItemModal(null)}
                  className="flex-1 py-3 bg-zinc-200 hover:bg-zinc-300 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-700 dark:text-dark-text font-bold rounded-xl text-sm transition"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmação de Cancelamento da Mesa */}
      {showCancelTableConfirm && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card border border-red-200 dark:border-red-900/40 max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-red-100 dark:bg-red-950/30 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text">Cancelar Mesa {selectedTable.number}</h3>
                  <p className="text-xs text-zinc-400">Esta ação não pode ser desfeita.</p>
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl p-4">
                <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                  Todos os pedidos da Mesa <strong>{selectedTable.number}</strong> serão cancelados, o estoque será restaurado e a mesa será liberada imediatamente.
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelTableOrders}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-red-500/20"
                >
                  <Ban className="h-4 w-4" />
                  <span>Confirmar Cancelamento</span>
                </button>
                <button
                  onClick={() => setShowCancelTableConfirm(false)}
                  className="flex-1 py-3 bg-zinc-200 hover:bg-zinc-300 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-700 dark:text-dark-text font-bold rounded-xl text-sm transition"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QR Code de Conexão do Garçom */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-md w-full rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-brand-500 to-brand-600 p-6 flex items-center justify-between text-white">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-white/20 rounded-xl font-bold">
                  <QrCode className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg">Conexão do Garçom</h3>
                  <p className="text-brand-100 text-xs font-semibold">Acesse o sistema pelo celular</p>
                </div>
              </div>
              <button 
                onClick={() => setShowQrModal(false)} 
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex flex-col items-center">
              <div className="text-center">
                <p className="text-sm text-zinc-600 dark:text-dark-muted font-medium mb-1">
                  Escaneie o QR Code abaixo com a câmera do celular para abrir a tela de login.
                </p>
                <p className="text-xs text-amber-500 font-bold">
                  ⚠️ Certifique-se de que o celular está conectado na mesma rede Wi-Fi deste computador.
                </p>
              </div>

              {/* QR Code Container */}
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-inner flex flex-col items-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                    `http://${serverIp || window.location.hostname}:${window.location.port || '5173'}/`
                  )}`}
                  alt="QR Code de Conexão"
                  className="w-48 h-48"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://placehold.co/220?text=Erro+QR+Code';
                  }}
                />
              </div>

              {/* Endereço de Conexão Manual */}
              <div className="w-full bg-zinc-50 dark:bg-dark-element border border-zinc-200 dark:border-dark-border rounded-2xl p-4 text-center">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Endereço de Conexão Manual
                </span>
                <code className="text-sm font-extrabold text-zinc-800 dark:text-dark-text select-all">
                  http://{serverIp || window.location.hostname}:{window.location.port || '5173'}/
                </code>
              </div>

              <button
                onClick={() => setShowQrModal(false)}
                className="w-full py-3.5 bg-zinc-150 hover:bg-zinc-200 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-700 dark:text-dark-text font-bold rounded-xl text-sm transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Sangria (Withdrawal) */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-sm w-full rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Sangria de Caixa</h3>
                  <p className="text-amber-100 text-xs">Registrar retirada de dinheiro</p>
                </div>
              </div>
              <button onClick={() => setShowWithdrawModal(false)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl px-4 py-3 flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  A sangria será descontada do valor final do caixa no fechamento do turno.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted uppercase tracking-wider mb-2">
                  Valor da Sangria
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">R$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="0,00"
                    autoFocus
                    className="w-full pl-10 pr-4 py-3.5 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-lg font-extrabold text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted uppercase tracking-wider mb-2">
                  Motivo da Sangria
                </label>
                <textarea
                  value={withdrawReason}
                  onChange={e => setWithdrawReason(e.target.value)}
                  placeholder="Ex: Pagamento de fornecedor, troco para caixa,etc."
                  rows={3}
                  className="w-full px-4 py-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm font-semibold text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none"
                />
              </div>

              <div className="flex space-x-3 pt-1">
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawLoading || !withdrawAmount || !withdrawReason.trim()}
                  className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-amber-500/20"
                >
                  {withdrawLoading ? (
                    <span>Registrando...</span>
                  ) : (
                    <>
                      <Wallet className="h-4 w-4" />
                      <span>Confirmar Sangria</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setWithdrawAmount('');
                    setWithdrawReason('');
                  }}
                  className="flex-1 py-3.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-700 dark:text-dark-text font-bold rounded-xl text-sm transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
