import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { uploadProductImage, getProductImageUrl, migrateBackendImage } from '../lib/supabase.js';
import Navbar from '../components/Navbar.jsx';
import { 
  BarChart3, Plus, Edit, Trash2, Users, ShieldAlert, Package, 
  Settings, Grid, FileSpreadsheet, DollarSign, ShoppingBag, 
  TrendingUp, RefreshCw, Upload, Image, Check, X, AlertTriangle,
  Eye, Key, Shield, Clock, ChevronDown, MessageSquare, Tags
} from 'lucide-react';

export default function AdminDashboard() {
  const { apiFetch } = useAuth();
  
  const [activeSubTab, setActiveSubTab] = useState('reports'); // 'reports', 'detailed_reports', 'products', 'users', 'qrcodes', 'observations'
  const [lojaDropdownOpen, setLojaDropdownOpen] = useState(false);
  const lojaDropdownRef = useRef(null);
  const [cardapioDropdownOpen, setCardapioDropdownOpen] = useState(false);
  const cardapioDropdownRef = useRef(null);
  const [globalObservations, setGlobalObservations] = useState([]);
  const [newGlobalObs, setNewGlobalObs] = useState('');

  useEffect(() => {
    function handleClickOutside(e) {
      if (lojaDropdownRef.current && !lojaDropdownRef.current.contains(e.target)) {
        setLojaDropdownOpen(false);
      }
      if (cardapioDropdownRef.current && !cardapioDropdownRef.current.contains(e.target)) {
        setCardapioDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [stats, setStats] = useState({
    total_revenue: 0,
    best_sellers: [],
    low_stock: [],
    payment_methods: [],
    daily_sales: [],
    waiter_sales: []
  });
  
  // Detailed reports state & filters
  const [detailedReports, setDetailedReports] = useState({
    billing_by_method: [],
    ticket_medio: 0,
    sales_count: 0,
    total_revenue: 0,
    cancellations: [],
    abc_products: [],
    sales_by_category: [],
    rush_hours: [],
    waiter_performance: [],
    avg_prep_time: 0,
    modality_data: [],
    rush_by_day: [],
    ticket_by_table: [],
    tma_by_category: [],
    complimentary: [],
    total_complimentary: 0,
    cancellations_by_reason: [],
    top5_products: []
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [turnFilter, setTurnFilter] = useState(''); // '', 'lunch', 'dinner'
  const [activeReportTab, setActiveReportTab] = useState('financeiro'); // 'financeiro', 'vendas', 'operacional', 'cancelamentos', 'garcom', 'modalidade', 'auditoria'

  // Waiter filter state
  const [selectedWaiter, setSelectedWaiter] = useState('');
  const [waiterStats, setWaiterStats] = useState({ subtotal: 0, gorjeta: 0, totalGeral: 0, ordersCount: 0, ticketMedio: 0, topProducts: [], waiter: null });
  const [loadingWaiter, setLoadingWaiter] = useState(false);

  // Loading states for reports fetching
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingDetailed, setLoadingDetailed] = useState(false);

  // Data lists
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);

  // Category CRUD states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', icon: 'package', sort_order: 0 });

  // CRUD Modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // Product object if editing
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    description: '',
    category: 'lanches',
    stock: '10',
    track_stock: true,
    image: null,
    observations: []
  });

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // User object if editing
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'waiter'
  });

  // Estado para controlar o modal de adicionar mesa
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [addingTable, setAddingTable] = useState(false);

  const handleAddTable = async (e) => {
    e.preventDefault();
    const number = parseInt(newTableNumber);
    if (isNaN(number) || number <= 0) {
      alert('Por favor, insira um número de mesa válido.');
      return;
    }
    setAddingTable(true);
    try {
      const res = await apiFetch('/api/tables', {
        method: 'POST',
        body: JSON.stringify({ number })
      });
      if (res.ok) {
        setShowAddTableModal(false);
        setNewTableNumber('');
        loadTables();
      } else {
        const data = await res.json();
        alert(data.message || 'Erro ao adicionar mesa.');
      }
    } catch (err) {
      console.error('Erro ao adicionar mesa:', err);
      alert('Erro de conexão ao adicionar mesa.');
    } finally {
      setAddingTable(false);
    }
  };

  const [lojaForm, setLojaForm] = useState({
    nome_fantasia: '',
    telefone: '',
    cnpj: '',
    ie: '',
    endereco: ''
  });

  const loadLoja = async () => {
    try {
      const res = await apiFetch('/api/loja');
      if (res.ok) {
        const data = await res.json();
        setLojaForm({
          nome_fantasia: data.nome_fantasia || '',
          telefone: data.telefone || '',
          cnpj: data.cnpj || '',
          ie: data.ie || '',
          endereco: data.endereco || ''
        });
      }
    } catch (err) {
      console.error('Erro ao carregar dados da empresa:', err);
    }
  };

  const handleLojaSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch('/api/loja', {
        method: 'POST',
        body: JSON.stringify(lojaForm)
      });
      if (res.ok) {
        alert('Dados da empresa salvos com sucesso!');
      } else {
        const data = await res.json();
        alert(data.message || 'Erro ao salvar dados da empresa.');
      }
    } catch (err) {
      console.error('Erro ao salvar dados da empresa:', err);
      alert('Erro de conexão ao salvar.');
    } finally {
      setLoading(false);
    }
  };

  // License state
  const [licenseStatus, setLicenseStatus] = useState({
    vencimento: '',
    diasRestantes: 0,
    bloqueado: false,
    chaveAtual: '',
    diasLicenciados: 0,
    emergenciaUsadaEsteMes: '',
    modulo: 'BASICO'
  });
  const [licenseKey, setLicenseKey] = useState('');
  const [activatingLicense, setActivatingLicense] = useState(false);
  const [usingEmergency, setUsingEmergency] = useState(false);

  const loadLicenseStatus = async () => {
    try {
      const res = await apiFetch('/api/license/status');
      if (res.ok) {
        const data = await res.json();
        setLicenseStatus(data);
      }
    } catch (err) {
      console.error('Erro ao carregar status da licença:', err);
    }
  };

  const handleActivateLicense = async (e) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;
    setActivatingLicense(true);
    try {
      const res = await apiFetch('/api/license/activate', {
        method: 'POST',
        body: JSON.stringify({ chave: licenseKey.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setLicenseKey('');
        loadLicenseStatus();
      } else {
        alert(data.message || 'Erro ao ativar licença.');
      }
    } catch (err) {
      console.error('Erro ao ativar licença:', err);
      alert('Erro de conexão ao ativar licença.');
    } finally {
      setActivatingLicense(false);
    }
  };

  const handleEmergencyExtension = async () => {
    if (!confirm('Deseja liberar o prazo de emergência? Isso adiciona +5 dias e só pode ser usado uma vez por mês.')) return;
    setUsingEmergency(true);
    try {
      const res = await apiFetch('/api/license/emergency', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        loadLicenseStatus();
      } else {
        alert(data.message || 'Erro ao liberar emergência.');
      }
    } catch (err) {
      console.error('Erro ao liberar emergência:', err);
      alert('Erro de conexão.');
    } finally {
      setUsingEmergency(false);
    }
  };

  // Fetch initial dashboard stats & listings
  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const res = await apiFetch('/api/reports/stats');
      if (res.ok) {
        const data = await res.json();
        setStats({
          total_revenue: data?.total_revenue || 0,
          best_sellers: data?.best_sellers || [],
          low_stock: data?.low_stock || [],
          payment_methods: data?.payment_methods || [],
          daily_sales: data?.daily_sales || [],
          waiter_sales: data?.waiter_sales || []
        });
      }
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadDetailedReports = async () => {
    setLoadingDetailed(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (turnFilter) params.append('turn', turnFilter);
      
      const res = await apiFetch(`/api/reports/detailed?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDetailedReports({
          billing_by_method: data?.billing_by_method || [],
          ticket_medio: data?.ticket_medio || 0,
          sales_count: data?.sales_count || 0,
          total_revenue: data?.total_revenue || 0,
          cancellations: data?.cancellations || [],
          abc_products: data?.abc_products || [],
          sales_by_category: data?.sales_by_category || [],
          rush_hours: data?.rush_hours || [],
          waiter_performance: data?.waiter_performance || [],
          avg_prep_time: data?.avg_prep_time || 0
        });
      }
    } catch (err) {
      console.error('Erro ao carregar relatórios detalhados:', err);
    } finally {
      setLoadingDetailed(false);
    }
  };

  const loadWaiterStats = async (waiterId) => {
    if (!waiterId) return;
    setLoadingWaiter(true);
    try {
      const params = new URLSearchParams({ waiterId });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await apiFetch(`/api/reports/waiter-sales?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setWaiterStats({
          subtotal: data.subtotal || 0,
          gorjeta: data.gorjeta || 0,
          totalGeral: data.totalGeral || 0,
          ordersCount: data.ordersCount || 0,
          ticketMedio: data.ticketMedio || 0,
          topProducts: data.topProducts || [],
          waiter: data.waiter || null
        });
      }
    } catch (err) {
      console.error('Erro ao carregar stats do garçom:', err);
    } finally {
      setLoadingWaiter(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await apiFetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Erro ao carregar cardápio:', err);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await apiFetch('/api/categories/all');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await apiFetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err);
    }
  };

  const loadTables = async () => {
    try {
      const res = await apiFetch('/api/tables');
      if (res.ok) {
        const data = await res.json();
        setTables(data);
      }
    } catch (err) {
      console.error('Erro ao carregar mesas:', err);
    }
  };

  const loadGlobalObservations = async () => {
    try {
      const res = await apiFetch('/api/global-observations');
      if (res.ok) {
        const data = await res.json();
        setGlobalObservations(data.map(obs => obs.text));
      }
    } catch (err) {
      console.error('Erro ao carregar observações:', err);
    }
  };

  const handleAddGlobalObs = async () => {
    if (!newGlobalObs.trim()) return;
    try {
      const res = await apiFetch('/api/global-observations', {
        method: 'POST',
        body: JSON.stringify({ text: newGlobalObs.trim() })
      });
      if (res.ok) {
        setNewGlobalObs('');
        loadGlobalObservations();
      } else {
        const data = await res.json();
        alert(data.message || 'Erro ao cadastrar observação.');
      }
    } catch (err) {
      console.error('Erro ao cadastrar observação:', err);
    }
  };

  const handleDeleteGlobalObs = async (obsText) => {
    try {
      const res = await apiFetch('/api/global-observations');
      if (res.ok) {
        const data = await res.json();
        const obsToDelete = data.find(o => o.text === obsText);
        if (obsToDelete) {
          const delRes = await apiFetch(`/api/global-observations/${obsToDelete.id}`, {
            method: 'DELETE'
          });
          if (delRes.ok) {
            loadGlobalObservations();
          }
        }
      }
    } catch (err) {
      console.error('Erro ao remover observação:', err);
    }
  };

  useEffect(() => {
    loadStats();
    loadProducts();
    loadCategories();
    loadUsers();
    loadTables();
    loadLoja();
    loadLicenseStatus();
    loadGlobalObservations();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'detailed_reports') {
      loadDetailedReports();
    }
  }, [activeSubTab, startDate, endDate, turnFilter]);

  useEffect(() => {
    if (selectedWaiter) {
      loadWaiterStats(selectedWaiter);
    }
  }, [selectedWaiter, startDate, endDate]);

  const exportToCSV = (reportType) => {
    let headers = [];
    let rows = [];
    let filename = `relatorio_${reportType}`;

    if (reportType === 'financeiro') {
      headers = ['Forma de Pagamento', 'Total Vendido (R$)', 'Quantidade de Transações'];
      rows = (detailedReports.billing_by_method || []).map(item => [
        (item?.payment_method || '').toUpperCase(),
        Number(item?.total || 0).toFixed(2),
        item?.count || 0
      ]);
      rows.push(['TICKET MEDIO GERAL', Number(detailedReports.ticket_medio || 0).toFixed(2), '']);
      rows.push(['FATURAMENTO TOTAL', Number(detailedReports.total_revenue || 0).toFixed(2), '']);
    } else if (reportType === 'vendas') {
      headers = ['Classificacao (ABC)', 'Produto', 'Categoria', 'Quantidade Vendida', 'Faturamento (R$)'];
      rows = (detailedReports.abc_products || []).map(item => [
        item?.classification || 'C',
        item?.name || '',
        (item?.category || '').toUpperCase(),
        item?.quantity_sold || 0,
        Number(item?.total_revenue || 0).toFixed(2)
      ]);
    } else if (reportType === 'operacional') {
      headers = ['Garcom / Canal', 'Pedidos Atendidos', 'Total Vendido (R$)', 'Ticket Medio (R$)'];
      rows = (detailedReports.waiter_performance || []).map(item => [
        item?.waiter_name || '',
        item?.orders_count || 0,
        Number(item?.total_sales || 0).toFixed(2),
        Number(item?.ticket_medio || 0).toFixed(2)
      ]);
    } else if (reportType === 'cancelamentos') {
      headers = ['Data/Hora', 'Produto/Item', 'Quantidade', 'Preco Unit. (R$)', 'Motivo', 'Mesa', 'Funcionario'];
      rows = (detailedReports.cancellations || []).map(item => [
        item?.created_at ? new Date(item.created_at).toLocaleString() : '',
        item?.item_name || '',
        item?.quantity || 0,
        Number(item?.price || 0).toFixed(2),
        item?.reason || '',
        item?.table_number || 'N/A',
        item?.employee_name || ''
      ]);
    } else if (reportType === 'modalidade') {
      headers = ['Modalidade', 'Total (R$)', 'Quantidade Pedidos'];
      rows = (detailedReports.modality_data || []).map(item => [
        item?.modality || '',
        Number(item?.total || 0).toFixed(2),
        item?.count || ''
      ]);
    } else if (reportType === 'auditoria') {
      headers = ['Data/Hora', 'Item', 'Quantidade', 'Tipo', 'Motivo', 'Autorizado por', 'Valor (R$)'];
      rows = (detailedReports.complimentary || []).map(item => [
        item?.created_at ? new Date(item.created_at).toLocaleString() : '',
        item?.product_name || '',
        item?.quantity || 0,
        item?.discount_type || '',
        item?.reason || '',
        item?.authorized_by || '',
        Number((item?.unit_price || 0) * (item?.quantity || 0)).toFixed(2)
      ]);
    }

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PRODUCT CRUD ACTIONS
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let imageUrl = editingProduct?.image_url || null;

      if (productForm.image) {
        const uploadedUrl = await uploadProductImage(productForm.image);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const productData = {
        name: productForm.name,
        price: productForm.price,
        description: productForm.description,
        category: productForm.category,
        stock: productForm.stock,
        track_stock: productForm.track_stock ? '1' : '0',
        observations: JSON.stringify(productForm.observations || []),
        image_url: imageUrl,
      };

      let res;
      if (editingProduct) {
        res = await apiFetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData)
        });
      } else {
        res = await apiFetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData)
        });
      }

      if (res.ok) {
        setShowProductModal(false);
        setEditingProduct(null);
        setProductForm({
          name: '',
          price: '',
          description: '',
          category: 'lanches',
          stock: '10',
          track_stock: true,
          image: null,
          observations: []
        });
        loadProducts();
        loadStats();
      } else {
        const data = await res.json();
        alert(data.message || 'Erro ao salvar produto.');
      }
    } catch (err) {
      console.error('Erro ao registrar produto:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (prod) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      price: prod.price.toString(),
      description: prod.description || '',
      category: prod.category,
      stock: prod.stock.toString(),
      track_stock: prod.track_stock === 1,
      image: null,
      observations: prod.observations ? JSON.parse(prod.observations) : []
    });
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Deseja realmente excluir este produto do cardápio?')) return;

    try {
      const res = await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadProducts();
        loadStats();
      } else {
        alert('Erro ao excluir produto.');
      }
    } catch (err) {
      console.error('Erro ao excluir produto:', err);
    }
  };

  const handleMigrateImages = async () => {
    const backendUrl = `http://${window.location.hostname}:3001`;
    const oldImageProducts = products.filter(p => p.image_url && p.image_url.startsWith('/uploads/'));
    if (oldImageProducts.length === 0) {
      alert('Nenhuma imagem antiga para migrar.');
      return;
    }
    if (!confirm(`Migrar ${oldImageProducts.length} imagem(ns) do backend para Supabase Storage?\n\nAs imagens antigas funcionarão no Netlify depois da migração.`)) return;

    setLoading(true);
    let migrated = 0;
    for (const prod of oldImageProducts) {
      const newUrl = await migrateBackendImage(backendUrl, prod.image_url);
      if (newUrl) {
        await apiFetch(`/api/products/${prod.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...prod, image_url: newUrl })
        });
        migrated++;
      }
    }
    setLoading(false);
    loadProducts();
    alert(`Migração concluída! ${migrated}/${oldImageProducts.length} imagens migradas com sucesso.`);
  };

  // CATEGORY CRUD ACTIONS
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let res;
      if (editingCategory) {
        res = await apiFetch(`/api/categories/${editingCategory.id}`, {
          method: 'PUT',
          body: JSON.stringify(categoryForm)
        });
      } else {
        res = await apiFetch('/api/categories', {
          method: 'POST',
          body: JSON.stringify(categoryForm)
        });
      }

      if (res.ok) {
        setShowCategoryModal(false);
        setEditingCategory(null);
        setCategoryForm({ name: '', icon: 'package', sort_order: 0 });
        loadCategories();
      } else {
        const data = await res.json();
        alert(data.message || 'Erro ao salvar categoria.');
      }
    } catch (err) {
      console.error('Erro ao salvar categoria:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      icon: cat.icon || 'package',
      sort_order: cat.sort_order || 0
    });
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('Deseja realmente excluir esta categoria?')) return;

    try {
      const res = await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadCategories();
      } else {
        const data = await res.json();
        alert(data.message || 'Erro ao excluir categoria.');
      }
    } catch (err) {
      console.error('Erro ao excluir categoria:', err);
    }
  };

  // USER CRUD ACTIONS
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let res;
      if (editingUser) {
        res = await apiFetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: userForm.name,
            username: userForm.username,
            role: userForm.role,
            password: userForm.password // optional
          })
        });
      } else {
        res = await apiFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify(userForm)
        });
      }

      if (res.ok) {
        setShowUserModal(false);
        setEditingUser(null);
        setUserForm({ name: '', username: '', password: '', role: 'waiter' });
        loadUsers();
      } else {
        const data = await res.json();
        alert(data.message || 'Erro ao registrar funcionário.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (usr) => {
    setEditingUser(usr);
    setUserForm({
      name: usr.name,
      username: usr.username,
      password: '', // reset password field
      role: usr.role
    });
    setShowUserModal(true);
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('Deseja remover este funcionário do sistema?')) return;

    try {
      const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadUsers();
      } else {
        const err = await res.json();
        alert(err.message || 'Erro ao remover funcionário.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'waiter': return 'Garçom';
      case 'kitchen': return 'Cozinha';
      case 'cashier': return 'Operador de Caixa';
      default: return role;
    }
  };

  // NATIVE SVG CHARTS PLOTTING
  // 1. Line Chart for Daily Sales
  const renderDailySalesChart = () => {
    const data = stats.daily_sales || [];
    if (data.length === 0) {
      return <div className="text-center py-10 text-zinc-400 text-xs">Aguardando dados de faturamento...</div>;
    }

    const width = 500;
    const height = 180;
    const padding = 30;

    const maxVal = Math.max(...data.map(d => Number(d?.total) || 0), 100);
    
    // Compute line coordinates
    const points = data.map((d, index) => {
      const total = Number(d?.total) || 0;
      const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
      const y = height - padding - (total / maxVal) * (height - padding * 2);
      return { x, y, label: d?.date || '', total };
    });

    const pathD = points.length > 0 
      ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') 
      : '';

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#E4E4E7" strokeDasharray="3,3" className="dark:stroke-zinc-800" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#E4E4E7" strokeDasharray="3,3" className="dark:stroke-zinc-800" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#D4D4D8" className="dark:stroke-zinc-700" />

        {/* Path Line */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="#f97316"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Circles & Labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" className="fill-brand-500 stroke-white dark:stroke-dark-card stroke-2" />
            
            {/* Tooltip total */}
            <text x={p.x} y={p.y - 10} textAnchor="middle" className="text-[9px] font-extrabold fill-brand-600 dark:fill-brand-400">
              R${p.total.toFixed(0)}
            </text>

            {/* Date label */}
            <text x={p.x} y={height - 10} textAnchor="middle" className="text-[8px] font-semibold fill-zinc-400 dark:fill-dark-muted">
              {p.label ? p.label.split('-').slice(1).reverse().join('/') : ''}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  // 2. Bar Chart for Payment Methods
  const renderPaymentMethodsChart = () => {
    const data = stats.payment_methods || [];
    if (data.length === 0) {
      return <div className="text-center py-10 text-zinc-400 text-xs">Aguardando transações...</div>;
    }

    const width = 300;
    const height = 180;
    const padding = 30;

    const maxVal = Math.max(...data.map(d => Number(d?.total) || 0), 10);
    const chartHeight = height - padding * 2;
    const barWidth = 35;
    const spacing = 45;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#D4D4D8" className="dark:stroke-zinc-700" />

        {data.map((d, index) => {
          const total = Number(d?.total) || 0;
          const x = padding + index * (barWidth + spacing) + 15;
          const barH = (total / maxVal) * chartHeight;
          const y = height - padding - barH;

          return (
            <g key={index}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx="6"
                className="fill-brand-500/80 hover:fill-brand-500 transition duration-200"
              />
              
              {/* Value on top */}
              <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" className="text-[9px] font-extrabold fill-zinc-700 dark:fill-dark-text">
                R${total.toFixed(0)}
              </text>

              {/* Label */}
              <text x={x + barWidth / 2} y={height - 12} textAnchor="middle" className="text-[9px] font-bold fill-zinc-400 dark:fill-dark-muted capitalize">
                {d?.payment_method || ''}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dark-bg transition-colors duration-200">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Tab Selection */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-dark-border pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-dark-text">Painel Administrativo</h1>
            <p className="text-xs font-semibold text-zinc-500 dark:text-dark-muted">Gerencie relatórios, cardápio, funcionários e mesas</p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'reports', label: 'Estatísticas', icon: BarChart3 },
                { id: 'detailed_reports', label: 'Relatórios', icon: FileSpreadsheet },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id)}
                    className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition duration-200 border whitespace-nowrap ${
                      activeSubTab === tab.id
                        ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/10'
                        : 'bg-white dark:bg-dark-card border-zinc-200 dark:border-dark-border text-zinc-500 dark:text-dark-muted hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative" ref={cardapioDropdownRef}>
              <button
                onClick={() => setCardapioDropdownOpen(!cardapioDropdownOpen)}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition duration-200 border whitespace-nowrap ${
                  activeSubTab === 'products' || activeSubTab === 'observations' || activeSubTab === 'categories'
                    ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/10'
                    : 'bg-white dark:bg-dark-card border-zinc-200 dark:border-dark-border text-zinc-500 dark:text-dark-muted hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <Package className="h-4 w-4" />
                <span>Cardápio</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${cardapioDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {cardapioDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-xl shadow-lg z-50 min-w-[190px] py-1">
                  <button
                    onClick={() => { setActiveSubTab('products'); setCardapioDropdownOpen(false); }}
                    className={`w-full px-4 py-2 text-xs font-bold flex items-center space-x-2 transition duration-150 ${
                      activeSubTab === 'products'
                        ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                        : 'text-zinc-600 dark:text-dark-muted hover:bg-zinc-50 dark:hover:bg-dark-border'
                    }`}
                  >
                    <Package className="h-4 w-4" />
                    <span>Cadastro de Produtos</span>
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('categories'); setCardapioDropdownOpen(false); }}
                    className={`w-full px-4 py-2 text-xs font-bold flex items-center space-x-2 transition duration-150 ${
                      activeSubTab === 'categories'
                        ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                        : 'text-zinc-600 dark:text-dark-muted hover:bg-zinc-50 dark:hover:bg-dark-border'
                    }`}
                  >
                    <Tags className="h-4 w-4" />
                    <span>Categorias</span>
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('observations'); setCardapioDropdownOpen(false); }}
                    className={`w-full px-4 py-2 text-xs font-bold flex items-center space-x-2 transition duration-150 ${
                      activeSubTab === 'observations'
                        ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                        : 'text-zinc-600 dark:text-dark-muted hover:bg-zinc-50 dark:hover:bg-dark-border'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>Observações</span>
                  </button>
                </div>
              )}
            </div>

            <div className="relative" ref={lojaDropdownRef}>
              <button
                onClick={() => setLojaDropdownOpen(!lojaDropdownOpen)}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition duration-200 border whitespace-nowrap ${
                  activeSubTab === 'loja' || activeSubTab === 'tables' || activeSubTab === 'license' || activeSubTab === 'users'
                    ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/10'
                    : 'bg-white dark:bg-dark-card border-zinc-200 dark:border-dark-border text-zinc-500 dark:text-dark-muted hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Loja</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${lojaDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {lojaDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border rounded-xl shadow-lg z-50 min-w-[160px] py-1">
                  <button
                    onClick={() => { setActiveSubTab('loja'); setLojaDropdownOpen(false); }}
                    className={`w-full px-4 py-2 text-xs font-bold flex items-center space-x-2 transition duration-150 ${
                      activeSubTab === 'loja'
                        ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                        : 'text-zinc-600 dark:text-dark-muted hover:bg-zinc-50 dark:hover:bg-dark-border'
                    }`}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>Cadastro de Loja</span>
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('tables'); setLojaDropdownOpen(false); }}
                    className={`w-full px-4 py-2 text-xs font-bold flex items-center space-x-2 transition duration-150 ${
                      activeSubTab === 'tables'
                        ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                        : 'text-zinc-600 dark:text-dark-muted hover:bg-zinc-50 dark:hover:bg-dark-border'
                    }`}
                  >
                    <Grid className="h-4 w-4" />
                    <span>Mesas</span>
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('license'); setLojaDropdownOpen(false); }}
                    className={`w-full px-4 py-2 text-xs font-bold flex items-center space-x-2 transition duration-150 ${
                      activeSubTab === 'license'
                        ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                        : 'text-zinc-600 dark:text-dark-muted hover:bg-zinc-50 dark:hover:bg-dark-border'
                    }`}
                  >
                    <Key className="h-4 w-4" />
                    <span>Licença</span>
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('users'); setLojaDropdownOpen(false); }}
                    className={`w-full px-4 py-2 text-xs font-bold flex items-center space-x-2 transition duration-150 ${
                      activeSubTab === 'users'
                        ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                        : 'text-zinc-600 dark:text-dark-muted hover:bg-zinc-50 dark:hover:bg-dark-border'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    <span>Funcionários</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Content 1: Reports & Metrics */}
        {activeSubTab === 'reports' && (
          loadingStats ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-550 dark:text-dark-muted font-bold text-sm bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm">
              <RefreshCw className="h-6 w-6 animate-spin mb-3 text-brand-500" />
              <span>Carregando estatísticas do painel...</span>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-200">
              {/* Sales Highlights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-zinc-400 dark:text-dark-muted uppercase tracking-wider block">Faturamento Total</span>
                    <span className="text-3xl font-extrabold text-zinc-950 dark:text-dark-text">R$ {Number(stats.total_revenue || 0).toFixed(2)}</span>
                  </div>
                  <div className="bg-emerald-100 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl shadow-inner">
                    <DollarSign className="h-6 w-6" />
                  </div>
                </div>

                <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-zinc-400 dark:text-dark-muted uppercase tracking-wider block">Produtos no Cardápio</span>
                    <span className="text-3xl font-extrabold text-zinc-950 dark:text-dark-text">{(products || []).length} itens</span>
                  </div>
                  <div className="bg-brand-100 dark:bg-brand-950/20 text-brand-500 dark:text-brand-400 p-4 rounded-xl shadow-inner">
                    <Package className="h-6 w-6" />
                  </div>
                </div>

                <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-zinc-400 dark:text-dark-muted uppercase tracking-wider block">Estoque Crítico (Alerta)</span>
                    <span className={`text-3xl font-extrabold ${(stats.low_stock || []).length > 0 ? 'text-red-500 animate-pulse' : 'text-zinc-900 dark:text-dark-text'}`}>
                      {(stats.low_stock || []).length} itens
                    </span>
                  </div>
                  <div className={`p-4 rounded-xl shadow-inner ${(stats.low_stock || []).length > 0 ? 'bg-red-100 dark:bg-red-950/20 text-red-550' : 'bg-zinc-100 dark:bg-dark-element text-zinc-550'}`}>
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                </div>

              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Daily Sales Chart (col 7) */}
                <div className="lg:col-span-8 bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-brand-500" />
                      <span>Faturamento nos Últimos 7 Dias</span>
                    </h3>
                  </div>
                  {renderDailySalesChart()}
                </div>

                {/* Payment Methods Chart (col 4) */}
                <div className="lg:col-span-4 bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm">
                  <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text mb-6">Métodos de Pagamento</h3>
                  {renderPaymentMethodsChart()}
                </div>

              </div>

              {/* Bottom Tables: Best Sellers, Waiter Sales & Stock Warnings */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Best Sellers */}
                <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm">
                  <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text mb-4">Pratos Mais Vendidos</h3>
                  
                  <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                      <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Produto</th>
                          <th className="px-4 py-3">Qtd Vendida</th>
                          <th className="px-4 py-3 text-right">Faturamento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-xs text-zinc-650 dark:text-dark-text">
                        {(stats.best_sellers || []).map((item, idx) => (
                          <tr key={idx} className="hover:bg-zinc-55 dark:hover:bg-dark-element/30">
                            <td className="px-4 py-3 font-semibold">{item.name || ''}</td>
                            <td className="px-4 py-3 font-bold text-brand-500">{item.quantity_sold || 0} un</td>
                            <td className="px-4 py-3 text-right font-extrabold text-zinc-800 dark:text-dark-text">R$ {Number(item.total_revenue || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                        {(!stats.best_sellers || stats.best_sellers.length === 0) && (
                          <tr>
                            <td colSpan="3" className="text-center py-6 text-zinc-400 text-xs font-semibold">Sem registros de vendas ainda.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Waiter Sales */}
                <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm">
                  <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text mb-4">Vendas por Garçom</h3>
                  
                  <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                      <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Garçom</th>
                          <th className="px-4 py-3">Pedidos</th>
                          <th className="px-4 py-3 text-right">Faturamento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-xs text-zinc-650 dark:text-dark-text">
                        {(stats.waiter_sales || []).map((item, idx) => (
                          <tr key={idx} className="hover:bg-zinc-55 dark:hover:bg-dark-element/30">
                            <td className="px-4 py-3 font-semibold">{item.waiter_name || ''}</td>
                            <td className="px-4 py-3 font-bold text-brand-500">{item.orders_count || 0} ped</td>
                            <td className="px-4 py-3 text-right font-extrabold text-zinc-800 dark:text-dark-text">R$ {Number(item.total_sales || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                        {(!stats.waiter_sales || stats.waiter_sales.length === 0) && (
                          <tr>
                            <td colSpan="3" className="text-center py-6 text-zinc-400 text-xs font-semibold">Sem faturamento registrado.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Low Stock Warnings */}
                <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm">
                  <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text mb-4">Alertas de Estoque Baixo</h3>
                  
                  <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                      <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Produto</th>
                          <th className="px-4 py-3">Categoria</th>
                          <th className="px-4 py-3 text-right">Estoque Restante</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-xs text-zinc-650 dark:text-dark-text">
                        {(stats.low_stock || []).map((item, idx) => (
                          <tr key={idx} className="hover:bg-zinc-55 dark:hover:bg-dark-element/30 bg-red-50/20 dark:bg-red-950/5">
                            <td className="px-4 py-3 font-semibold text-red-650 dark:text-red-400">{item.name || ''}</td>
                            <td className="px-4 py-3 capitalize">{item.category || ''}</td>
                            <td className="px-4 py-3 text-right font-bold text-red-500 animate-pulse">{item.stock || 0} un</td>
                          </tr>
                        ))}
                        {(!stats.low_stock || stats.low_stock.length === 0) && (
                          <tr>
                            <td colSpan="3" className="text-center py-6 text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center justify-center space-x-1.5">
                                <Check className="h-4 w-4" />
                                <span>Todos os estoques sob controle.</span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          )
        )}

        {/* Tab Content 1.5: Detailed Analytics Reports */}
        {activeSubTab === 'detailed_reports' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Filters Bar */}
            <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-5 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-end justify-between">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto flex-1">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Data Início</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Data Fim</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Turno</label>
                  <select
                    value={turnFilter}
                    onChange={(e) => setTurnFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    <option value="">Todos os Turnos</option>
                    <option value="lunch">Almoço (11h - 16h)</option>
                    <option value="dinner">Jantar (16h - 04h)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2 w-full md:w-auto">
                <button
                  onClick={() => exportToCSV(activeReportTab)}
                  className="flex-1 md:flex-initial px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Exportar Excel</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 md:flex-initial px-4 py-2 bg-zinc-800 hover:bg-black text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition"
                >
                  <Eye className="h-4 w-4" />
                  <span>Visualizar PDF / Imprimir</span>
                </button>
              </div>
            </div>

            {/* Reports Categories Navbar */}
            <div className="flex border-b border-zinc-200 dark:border-dark-border overflow-x-auto">
              {[
                { id: 'financeiro', label: 'Financeiro' },
                { id: 'vendas', label: 'Cardápio / Vendas' },
                { id: 'modalidade', label: 'Modalidade' },
                { id: 'operacional', label: 'Operacional' },
                { id: 'cancelamentos', label: 'Cancelamentos' },
                { id: 'auditoria', label: 'Auditoria' },
                { id: 'garcom', label: 'Garçom' }
              ].map((reportTab) => (
                <button
                  key={reportTab.id}
                  onClick={() => setActiveReportTab(reportTab.id)}
                  className={`px-5 py-3 font-bold text-xs border-b-2 transition duration-200 -mb-[2px] whitespace-nowrap ${
                    activeReportTab === reportTab.id
                      ? 'border-brand-500 text-brand-500'
                      : 'border-transparent text-zinc-400 hover:text-zinc-650'
                  }`}
                >
                  {reportTab.label}
                </button>
              ))}
            </div>

            {/* Report Content Panels */}
            <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm min-h-[40vh]">
              
              {loadingDetailed ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-550 dark:text-dark-muted font-bold text-sm">
                  <RefreshCw className="h-6 w-6 animate-spin mb-3 text-brand-500" />
                  <span>Carregando dados detalhados...</span>
                </div>
              ) : (
                <>
                  {/* 1. FINANCIERO REPORT */}
                  {activeReportTab === 'financeiro' && (
                    <div className="space-y-6">
                      {/* Summary Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-zinc-50 dark:bg-dark-element p-4 rounded-xl">
                          <span className="text-[10px] font-bold text-zinc-400 block uppercase">Faturamento Líquido</span>
                          <span className="text-xl font-extrabold text-zinc-850 dark:text-dark-text mt-1 block">R$ {Number(detailedReports.total_revenue || 0).toFixed(2)}</span>
                        </div>
                        <div className="bg-zinc-50 dark:bg-dark-element p-4 rounded-xl">
                          <span className="text-[10px] font-bold text-zinc-400 block uppercase">Ticket Médio</span>
                          <span className="text-xl font-extrabold text-zinc-850 dark:text-dark-text mt-1 block">R$ {Number(detailedReports.ticket_medio || 0).toFixed(2)}</span>
                        </div>
                        <div className="bg-zinc-50 dark:bg-dark-element p-4 rounded-xl">
                          <span className="text-[10px] font-bold text-zinc-400 block uppercase">Total Transações</span>
                          <span className="text-xl font-extrabold text-zinc-850 dark:text-dark-text mt-1 block">{detailedReports.sales_count || 0} vendas</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-xs text-zinc-450 uppercase tracking-wider mb-3">Faturamento por Forma de Pagamento</h4>
                        
                        {/* Gráfico de Pizza SVG */}
                        <div className="bg-zinc-50 dark:bg-dark-element p-4 rounded-xl mb-4">
                          <div className="flex items-center justify-center">
                            {(() => {
                              const total = (detailedReports.billing_by_method || []).reduce((s, m) => s + m.total, 0);
                              if (total === 0) return <p className="text-zinc-400 text-sm">Sem dados de pagamento.</p>;
                              
                              const colors = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#6b7280'];
                              const labels = { dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Crédito', debito: 'Débito', cartao: 'Cartão', voucher: 'Voucher' };
                              let cumulativePercent = 0;
                              
                              return (
                                <div className="flex items-center space-x-8">
                                  <svg width="180" height="180" viewBox="0 0 180 180">
                                    {(detailedReports.billing_by_method || []).map((item, idx) => {
                                      const percent = total > 0 ? (item.total / total) * 100 : 0;
                                      const startAngle = (cumulativePercent / 100) * 360;
                                      const endAngle = ((cumulativePercent + percent) / 100) * 360;
                                      cumulativePercent += percent;
                                      
                                      const startRad = (startAngle - 90) * Math.PI / 180;
                                      const endRad = (endAngle - 90) * Math.PI / 180;
                                      const x1 = 90 + 70 * Math.cos(startRad);
                                      const y1 = 90 + 70 * Math.sin(startRad);
                                      const x2 = 90 + 70 * Math.cos(endRad);
                                      const y2 = 90 + 70 * Math.sin(endRad);
                                      const largeArc = percent > 50 ? 1 : 0;
                                      
                                      return (
                                        <path
                                          key={idx}
                                          d={`M 90 90 L ${x1} ${y1} A 70 70 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                          fill={colors[idx % colors.length]}
                                        />
                                      );
                                    })}
                                  </svg>
                                  <div className="space-y-2">
                                    {(detailedReports.billing_by_method || []).map((item, idx) => (
                                      <div key={idx} className="flex items-center space-x-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }}></div>
                                        <span className="text-xs font-semibold">{labels[item.payment_method] || item.payment_method}</span>
                                        <span className="text-xs text-zinc-400">({total > 0 ? ((item.total / total) * 100).toFixed(1) : 0}%)</span>
                                        <span className="text-xs font-extrabold">R$ {(item.total || 0).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                          <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                            <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Forma de Pagamento</th>
                                <th className="px-4 py-3">Transações</th>
                                <th className="px-4 py-3 text-right">Total Arrecadado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-xs text-zinc-650 dark:text-dark-text">
                              {(detailedReports.billing_by_method || []).map((item, idx) => (
                                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-dark-element/30">
                                  <td className="px-4 py-3 font-semibold capitalize">{item.payment_method || ''}</td>
                                  <td className="px-4 py-3 font-bold">{item.count || 0}x</td>
                                  <td className="px-4 py-3 text-right font-extrabold text-zinc-850 dark:text-dark-text">R$ {Number(item.total || 0).toFixed(2)}</td>
                                </tr>
                              ))}
                              {(!detailedReports.billing_by_method || detailedReports.billing_by_method.length === 0) && (
                                <tr><td colSpan="3" className="text-center py-6 text-zinc-400">Sem faturamento registrado para os filtros selecionados.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. VENDAS & CURVA ABC REPORT */}
                  {activeReportTab === 'vendas' && (
                    <div className="space-y-6">
                      {/* Curva ABC Explanation */}
                      <div className="bg-brand-50 dark:bg-brand-950/10 border border-brand-100 dark:border-brand-900/30 p-3 rounded-xl flex items-start space-x-2">
                        <TrendingUp className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-brand-700 dark:text-brand-400 font-medium">
                          <strong>Análise Curva ABC:</strong> Classe A representa os produtos que geram até 70% do faturamento acumulado (mais vendidos/lucrativos). Classe B representa os próximos 20% (médio giro). Classe C representa os últimos 10% (baixo giro/descartáveis).
                        </p>
                      </div>

                      {/* Resumo Curva ABC */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-xl">
                          <span className="text-[10px] font-bold text-emerald-600 block uppercase">Classe A (Até 70%)</span>
                          <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 block">
                            {(detailedReports.abc_products || []).filter(p => p.classification === 'A').length} produtos
                          </span>
                          <span className="text-xs text-zinc-400 mt-1 block">
                            R$ {(detailedReports.abc_products || []).filter(p => p.classification === 'A').reduce((s, p) => s + p.total_revenue, 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 p-4 rounded-xl">
                          <span className="text-[10px] font-bold text-amber-600 block uppercase">Classe B (70% - 90%)</span>
                          <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 mt-1 block">
                            {(detailedReports.abc_products || []).filter(p => p.classification === 'B').length} produtos
                          </span>
                          <span className="text-xs text-zinc-400 mt-1 block">
                            R$ {(detailedReports.abc_products || []).filter(p => p.classification === 'B').reduce((s, p) => s + p.total_revenue, 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4 rounded-xl">
                          <span className="text-[10px] font-bold text-zinc-500 block uppercase">Classe C (Acima 90%)</span>
                          <span className="text-2xl font-extrabold text-zinc-600 dark:text-zinc-400 mt-1 block">
                            {(detailedReports.abc_products || []).filter(p => p.classification === 'C').length} produtos
                          </span>
                          <span className="text-xs text-zinc-400 mt-1 block">
                            R$ {(detailedReports.abc_products || []).filter(p => p.classification === 'C').reduce((s, p) => s + p.total_revenue, 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Top 5 Produtos - Gráfico de Barras */}
                      {detailedReports.top5_products && detailedReports.top5_products.length > 0 && (
                        <div className="bg-zinc-50 dark:bg-dark-element p-4 rounded-xl">
                          <h4 className="font-extrabold text-xs text-zinc-450 uppercase tracking-wider mb-4">Top 5 Produtos Mais Vendidos</h4>
                          <div className="space-y-3">
                            {detailedReports.top5_products.map((item, idx) => {
                              const maxQty = Math.max(...detailedReports.top5_products.map(p => p.quantity_sold || 0), 1);
                              const barWidth = ((item.quantity_sold || 0) / maxQty) * 100;
                              return (
                                <div key={idx} className="flex items-center space-x-3">
                                  <span className="text-xs font-bold text-zinc-400 w-4">{idx + 1}°</span>
                                  <div className="flex-1">
                                    <div className="flex justify-between mb-1">
                                      <span className="text-xs font-semibold text-zinc-700 dark:text-dark-text">{item.name}</span>
                                      <span className="text-xs font-extrabold text-brand-500">{item.quantity_sold}x</span>
                                    </div>
                                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                                      <div 
                                        className="bg-brand-500 h-2 rounded-full transition-all duration-500" 
                                        style={{ width: `${barWidth}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                  <span className="text-xs font-extrabold text-zinc-600 dark:text-dark-text w-20 text-right">R$ {(item.total_revenue || 0).toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* TMA por Categoria */}
                      {detailedReports.tma_by_category && detailedReports.tma_by_category.length > 0 && (
                        <div>
                          <h4 className="font-extrabold text-xs text-zinc-450 uppercase tracking-wider mb-3">Tempo Médio de Preparo por Categoria</h4>
                          <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                            <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                              <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                                <tr>
                                  <th className="px-4 py-3">Categoria</th>
                                  <th className="px-4 py-3">Pedidos</th>
                                  <th className="px-4 py-3 text-right">Tempo Médio</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-xs text-zinc-650 dark:text-dark-text">
                                {detailedReports.tma_by_category.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-dark-element/30">
                                    <td className="px-4 py-3 font-semibold capitalize">{item.category || 'Sem categoria'}</td>
                                    <td className="px-4 py-3 font-bold">{item.order_count || 0}x</td>
                                    <td className="px-4 py-3 text-right font-extrabold text-zinc-850 dark:text-dark-text">
                                      {Number(item.avg_prep_time || 0).toFixed(1)} min
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="font-extrabold text-xs text-zinc-450 uppercase tracking-wider mb-3">Ranking de Produtos (Curva ABC)</h4>
                        <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                          <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                            <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Classe</th>
                                <th className="px-4 py-3">Produto</th>
                                <th className="px-4 py-3">Categoria</th>
                                <th className="px-4 py-3">Qtd Vendida</th>
                                <th className="px-4 py-3 text-right">Faturamento Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-xs text-zinc-650 dark:text-dark-text">
                              {(detailedReports.abc_products || []).map((item, idx) => (
                                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-dark-element/30">
                                  <td className="px-4 py-3">
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                      item.classification === 'A'
                                        ? 'bg-emerald-500 text-white'
                                        : item.classification === 'B'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-650 dark:text-dark-muted'
                                    }`}>
                                      Classe {item.classification || 'C'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-semibold">{item.name || ''}</td>
                                  <td className="px-4 py-3 capitalize">{item.category || ''}</td>
                                  <td className="px-4 py-3 font-bold">{item.quantity_sold || 0} un</td>
                                  <td className="px-4 py-3 text-right font-extrabold text-zinc-850 dark:text-dark-text">R$ {Number(item.total_revenue || 0).toFixed(2)}</td>
                                </tr>
                              ))}
                              {(!detailedReports.abc_products || detailedReports.abc_products.length === 0) && (
                                <tr><td colSpan="5" className="text-center py-6 text-zinc-400">Nenhum produto vendido no período.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. OPERACIONAL REPORT */}
                  {activeReportTab === 'operacional' && (
                    <div className="space-y-6">
                      {/* Preparation Speed & Performance Overview */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="bg-zinc-50 dark:bg-dark-element p-4 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">Tempo Médio de Entrega</span>
                            <span className="text-xl font-extrabold text-zinc-850 dark:text-dark-text block mt-1">{Number(detailedReports.avg_prep_time || 0).toFixed(1)} min</span>
                          </div>
                          <div className="text-xs text-zinc-400">Recebimento até entrega</div>
                        </div>
                        <div className="bg-zinc-50 dark:bg-dark-element p-4 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">Turno de Maior Faturamento</span>
                            <span className="text-xl font-extrabold text-zinc-850 dark:text-dark-text block mt-1">Jantar (J)</span>
                          </div>
                          <div className="text-xs text-zinc-400">Pico histórico das 19h às 22h</div>
                        </div>
                      </div>

                      {/* Waiter Performance */}
                      <div>
                        <h4 className="font-extrabold text-xs text-zinc-450 uppercase tracking-wider mb-3">Vendas e Desempenho por Garçom</h4>
                        <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                          <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                            <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Funcionário</th>
                                <th className="px-4 py-3">Pedidos Atendidos</th>
                                <th className="px-4 py-3">Ticket Médio (R$)</th>
                                <th className="px-4 py-3 text-right">Total Vendido (R$)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-xs text-zinc-650 dark:text-dark-text">
                              {(detailedReports.waiter_performance || []).map((item, idx) => (
                                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-dark-element/30">
                                  <td className="px-4 py-3 font-semibold">{item.waiter_name || ''}</td>
                                  <td className="px-4 py-3 font-bold">{item.orders_count || 0}x</td>
                                  <td className="px-4 py-3 font-bold">R$ {Number(item.ticket_medio || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-right font-extrabold text-zinc-850 dark:text-dark-text">R$ {Number(item.total_sales || 0).toFixed(2)}</td>
                                </tr>
                              ))}
                              {(!detailedReports.waiter_performance || detailedReports.waiter_performance.length === 0) && (
                                <tr><td colSpan="4" className="text-center py-6 text-zinc-400">Nenhum pedido de garçom registrado.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Heatmap/Rush Hours by Day of Week */}
                      {detailedReports.rush_by_day && detailedReports.rush_by_day.length > 0 && (
                        <div>
                          <h4 className="font-extrabold text-xs text-zinc-450 uppercase tracking-wider mb-3">Mapa de Calor por Dia e Horário</h4>
                          <div className="bg-zinc-50 dark:bg-dark-element p-4 rounded-xl overflow-x-auto">
                            <div className="min-w-[600px]">
                              {/* Header - Horas */}
                              <div className="flex mb-2">
                                <div className="w-20 text-[9px] font-bold text-zinc-400">Dia/Hora</div>
                                {Array.from({ length: 24 }, (_, i) => (
                                  <div key={i} className="flex-1 text-center text-[8px] font-bold text-zinc-400">{i.toString().padStart(2, '0')}</div>
                                ))}
                              </div>
                              {/* Grid */}
                              {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((day, dayIdx) => (
                                <div key={day} className="flex items-center mb-1">
                                  <div className="w-20 text-[9px] font-bold text-zinc-500 truncate">{day}</div>
                                  {Array.from({ length: 24 }, (_, hour) => {
                                    const data = detailedReports.rush_by_day.find(d => d.day_num == dayIdx && d.hour == hour.toString().padStart(2, '0'));
                                    const count = data ? data.count : 0;
                                    const maxCount = Math.max(...detailedReports.rush_by_day.map(d => d.count || 0), 1);
                                    const intensity = count / maxCount;
                                    const bgColor = count === 0 
                                      ? 'bg-zinc-100 dark:bg-zinc-800' 
                                      : intensity < 0.33 
                                        ? 'bg-emerald-200 dark:bg-emerald-900/50' 
                                        : intensity < 0.66 
                                          ? 'bg-amber-300 dark:bg-amber-700/50' 
                                          : 'bg-red-500 dark:bg-red-700/70';
                                    return (
                                      <div 
                                        key={hour} 
                                        className={`flex-1 h-6 ${bgColor} border border-white dark:border-dark-card flex items-center justify-center`}
                                        title={`${day} ${hour}:00 - ${count} pedidos`}
                                      >
                                        {count > 0 && <span className="text-[7px] font-bold text-zinc-700 dark:text-white">{count}</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                              {/* Legenda */}
                              <div className="flex items-center justify-end mt-3 space-x-2">
                                <span className="text-[9px] text-zinc-400">Menos</span>
                                <div className="w-4 h-4 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200"></div>
                                <div className="w-4 h-4 bg-emerald-200 dark:bg-emerald-900/50"></div>
                                <div className="w-4 h-4 bg-amber-300 dark:bg-amber-700/50"></div>
                                <div className="w-4 h-4 bg-red-500 dark:bg-red-700/70"></div>
                                <span className="text-[9px] text-zinc-400">Mais</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Heatmap/Rush Hours Table */}
                      <div>
                        <h4 className="font-extrabold text-xs text-zinc-450 uppercase tracking-wider mb-3">Horários de Pico ("Rush")</h4>
                        <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                          <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                            <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Hora do Dia</th>
                                <th className="px-4 py-3">Total de Pedidos</th>
                                <th className="px-4 py-3 text-right">Faturamento Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-xs text-zinc-650 dark:text-dark-text">
                              {(detailedReports.rush_hours || []).map((item, idx) => (
                                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-dark-element/30">
                                  <td className="px-4 py-3 font-bold">{item.hour || '00'}:00h</td>
                                  <td className="px-4 py-3 font-semibold text-brand-500">{item.count || 0}x</td>
                                  <td className="px-4 py-3 text-right font-extrabold text-zinc-850 dark:text-dark-text">R$ {Number(item.total || 0).toFixed(2)}</td>
                                </tr>
                              ))}
                              {(!detailedReports.rush_hours || detailedReports.rush_hours.length === 0) && (
                                <tr><td colSpan="3" className="text-center py-6 text-zinc-400">Nenhum pico registrado no período.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. AUDIT CANCELLATIONS REPORT */}
                  {activeReportTab === 'cancelamentos' && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-extrabold text-xs text-zinc-450 uppercase tracking-wider mb-3">Auditoria de Cancelamentos e Estornos</h4>
                        <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                          <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                            <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Data/Hora</th>
                                <th className="px-4 py-3">Item/Prato</th>
                                <th className="px-4 py-3 text-center">Qtd</th>
                                <th className="px-4 py-3">Mesa</th>
                                <th className="px-4 py-3">Motivo/Explicação</th>
                                <th className="px-4 py-3">Autorizado por</th>
                                <th className="px-4 py-3 text-right">Prejuízo (R$)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-xs text-zinc-650 dark:text-dark-text">
                              {(detailedReports.cancellations || []).map((item, idx) => (
                                <tr key={idx} className="hover:bg-zinc-55 dark:hover:bg-dark-element/30 bg-red-50/10 dark:bg-red-950/5">
                                  <td className="px-4 py-3 whitespace-nowrap font-mono">{item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : ''}</td>
                                  <td className="px-4 py-3 font-semibold text-red-650 dark:text-red-400">{item.item_name || ''}</td>
                                  <td className="px-4 py-3 text-center font-bold">{item.quantity || 0}x</td>
                                  <td className="px-4 py-3 font-semibold">Mesa {item.table_number || 'N/A'}</td>
                                  <td className="px-4 py-3 text-zinc-500 dark:text-dark-muted max-w-xs truncate" title={item.reason || ''}>{item.reason || ''}</td>
                                  <td className="px-4 py-3 font-semibold">{item.employee_name || ''}</td>
                                  <td className="px-4 py-3 text-right font-extrabold text-red-500">- R$ {((item.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                                </tr>
                              ))}
                              {(!detailedReports.cancellations || detailedReports.cancellations.length === 0) && (
                                <tr><td colSpan="7" className="text-center py-6 text-zinc-400">Nenhum cancelamento registrado para auditoria.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4.5 MODALIDADE REPORT (Salão vs Delivery) */}
                  {activeReportTab === 'modalidade' && (
                    <div className="space-y-6">
                      {/* Resumo de Modalidades */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(detailedReports.modality_data || []).map((item, idx) => (
                          <div key={idx} className={`p-4 rounded-xl border ${
                            item.modality.includes('Salão') 
                              ? 'bg-brand-50 dark:bg-brand-950/10 border-brand-100 dark:border-brand-900/30' 
                              : 'bg-emerald-50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30'
                          }`}>
                            <span className="text-[10px] font-bold text-zinc-500 dark:text-dark-muted block uppercase">{item.modality}</span>
                            <span className={`text-2xl font-extrabold mt-1 block ${
                              item.modality.includes('Salão') 
                                ? 'text-brand-700 dark:text-brand-400' 
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}>R$ {(item.total || 0).toFixed(2)}</span>
                            {item.count !== undefined && (
                              <span className="text-xs text-zinc-400 mt-1 block">{item.count || 0} pedidos</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Gráfico de Pizza SVG - Modalidade */}
                      <div className="bg-zinc-50 dark:bg-dark-element p-4 rounded-xl">
                        <h4 className="font-extrabold text-xs text-zinc-450 uppercase tracking-wider mb-4">Composição por Modalidade</h4>
                        <div className="flex items-center justify-center">
                          {(() => {
                            const total = (detailedReports.modality_data || []).reduce((s, m) => s + m.total, 0);
                            if (total === 0) return <p className="text-zinc-400 text-sm">Sem dados de modalidade.</p>;
                            
                            const colors = ['#8b5cf6', '#10b981', '#f59e0b'];
                            let cumulativePercent = 0;
                            
                            return (
                              <div className="flex items-center space-x-8">
                                <svg width="200" height="200" viewBox="0 0 200 200">
                                  {(detailedReports.modality_data || []).map((item, idx) => {
                                    const percent = total > 0 ? (item.total / total) * 100 : 0;
                                    const startAngle = (cumulativePercent / 100) * 360;
                                    const endAngle = ((cumulativePercent + percent) / 100) * 360;
                                    cumulativePercent += percent;
                                    
                                    const startRad = (startAngle - 90) * Math.PI / 180;
                                    const endRad = (endAngle - 90) * Math.PI / 180;
                                    const x1 = 100 + 80 * Math.cos(startRad);
                                    const y1 = 100 + 80 * Math.sin(startRad);
                                    const x2 = 100 + 80 * Math.cos(endRad);
                                    const y2 = 100 + 80 * Math.sin(endRad);
                                    const largeArc = percent > 50 ? 1 : 0;
                                    
                                    return (
                                      <path
                                        key={idx}
                                        d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                        fill={colors[idx % colors.length]}
                                      />
                                    );
                                  })}
                                </svg>
                                <div className="space-y-2">
                                  {(detailedReports.modality_data || []).map((item, idx) => (
                                    <div key={idx} className="flex items-center space-x-2">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }}></div>
                                      <span className="text-xs font-semibold">{item.modality}</span>
                                      <span className="text-xs text-zinc-400">({total > 0 ? ((item.total / total) * 100).toFixed(1) : 0}%)</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Ticket Médio por Mesa */}
                      {detailedReports.ticket_by_table && detailedReports.ticket_by_table.length > 0 && (
                        <div>
                          <h4 className="font-extrabold text-xs text-zinc-450 uppercase tracking-wider mb-3">Ticket Médio por Mesa</h4>
                          <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                            <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                              <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                                <tr>
                                  <th className="px-4 py-3">Mesa</th>
                                  <th className="px-4 py-3">Vendas</th>
                                  <th className="px-4 py-3 text-right">Ticket Médio</th>
                                  <th className="px-4 py-3 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-xs text-zinc-650 dark:text-dark-text">
                                {detailedReports.ticket_by_table.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-dark-element/30">
                                    <td className="px-4 py-3 font-semibold">Mesa {item.table_number || item.table_id}</td>
                                    <td className="px-4 py-3 font-bold">{item.sales_count || 0}x</td>
                                    <td className="px-4 py-3 text-right font-extrabold">R$ {(item.avg_ticket || 0).toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right font-extrabold text-zinc-850 dark:text-dark-text">R$ {(item.total || 0).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 5. WAITER PERFORMANCE REPORT */}
                  {activeReportTab === 'garcom' && (
                    <div className="space-y-6">
                      {/* Seletor de Garçom */}
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-2 uppercase tracking-wider">Selecione o Garçom</label>
                        <select
                          value={selectedWaiter}
                          onChange={(e) => setSelectedWaiter(e.target.value)}
                          className="w-full max-w-sm px-4 py-2.5 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                        >
                          <option value="">-- Selecione um Garçom --</option>
                          {users.filter(u => u.role === 'waiter').map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Resultado */}
                      {loadingWaiter ? (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-550 dark:text-dark-muted font-bold text-sm">
                          <RefreshCw className="h-6 w-6 animate-spin mb-3 text-brand-500" />
                          <span>Carregando dados do garçom...</span>
                        </div>
                      ) : selectedWaiter ? (
                        <div className="space-y-6 animate-in fade-in duration-200">
                          {/* Cards de Resumo */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-zinc-50 dark:bg-dark-element p-4 rounded-xl">
                              <span className="text-[10px] font-bold text-zinc-400 dark:text-dark-muted block uppercase tracking-wider">Vendas (Subtotal)</span>
                              <span className="text-xl font-extrabold text-zinc-900 dark:text-dark-text mt-1 block">R$ {Number(waiterStats.subtotal).toFixed(2)}</span>
                            </div>
                            <div className="bg-zinc-50 dark:bg-dark-element p-4 rounded-xl">
                              <span className="text-[10px] font-bold text-zinc-400 dark:text-dark-muted block uppercase tracking-wider">Gorjetas (10%)</span>
                              <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">R$ {Number(waiterStats.gorjeta).toFixed(2)}</span>
                            </div>
                            <div className="bg-zinc-50 dark:bg-dark-element p-4 rounded-xl">
                              <span className="text-[10px] font-bold text-zinc-400 dark:text-dark-muted block uppercase tracking-wider">Total + Gorjeta</span>
                              <span className="text-xl font-extrabold text-brand-600 dark:text-brand-400 mt-1 block">R$ {Number(waiterStats.totalGeral).toFixed(2)}</span>
                            </div>
                            <div className="bg-zinc-50 dark:bg-dark-element p-4 rounded-xl">
                              <span className="text-[10px] font-bold text-zinc-400 dark:text-dark-muted block uppercase tracking-wider">Pedidos / Ticket Médio</span>
                              <span className="text-xl font-extrabold text-zinc-900 dark:text-dark-text mt-1 block">{waiterStats.ordersCount}x / R$ {Number(waiterStats.ticketMedio).toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Top Produtos do Garçom */}
                          {waiterStats.topProducts.length > 0 && (
                            <div>
                              <h4 className="font-extrabold text-xs text-zinc-450 dark:text-dark-muted uppercase tracking-wider mb-3">Top Produtos Vendidos por Este Garçom</h4>
                              <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                                <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                                  <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                                    <tr>
                                      <th className="px-4 py-3">Produto</th>
                                      <th className="px-4 py-3">Categoria</th>
                                      <th className="px-4 py-3 text-center">Qtd Vendida</th>
                                      <th className="px-4 py-3 text-right">Faturamento (R$)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-xs text-zinc-650 dark:text-dark-text">
                                    {waiterStats.topProducts.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-dark-element/30">
                                        <td className="px-4 py-3 font-semibold">{item.name}</td>
                                        <td className="px-4 py-3 capitalize">{item.category}</td>
                                        <td className="px-4 py-3 text-center font-bold text-brand-500">{item.quantity_sold}x</td>
                                        <td className="px-4 py-3 text-right font-extrabold text-zinc-850 dark:text-dark-text">R$ {Number(item.total_revenue).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-zinc-400 dark:text-dark-muted text-sm font-semibold">
                          Selecione um garçom acima para ver o desempenho dele.
                        </div>
                      )}
                    </div>
                  )}

                  {/* 6. AUDITORIA & SEGURANÇA REPORT */}
                  {activeReportTab === 'auditoria' && (
                    <div className="space-y-6">
                      {/* Resumo de Cortesias */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 p-4 rounded-xl">
                          <span className="text-[10px] font-bold text-amber-600 block uppercase">Total Cortesias/Descontos</span>
                          <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 mt-1 block">R$ {(detailedReports.total_complimentary || 0).toFixed(2)}</span>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 p-4 rounded-xl">
                          <span className="text-[10px] font-bold text-red-600 block uppercase">Total Prejuízo Cancelamentos</span>
                          <span className="text-2xl font-extrabold text-red-600 dark:text-red-400 mt-1 block">R$ {(detailedReports.cancellations || []).reduce((s, c) => s + ((c.price || 0) * (c.quantity || 0)), 0).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Auditoria de Cortesias e Descontos */}
                      <div>
                        <h4 className="font-extrabold text-xs text-zinc-450 uppercase tracking-wider mb-3">Cortesias e Descontos Autorizados</h4>
                        <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                          <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                            <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Data/Hora</th>
                                <th className="px-4 py-3">Item</th>
                                <th className="px-4 py-3 text-center">Qtd</th>
                                <th className="px-4 py-3">Tipo</th>
                                <th className="px-4 py-3">Motivo</th>
                                <th className="px-4 py-3">Autorizado por</th>
                                <th className="px-4 py-3 text-right">Valor (R$)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-xs text-zinc-650 dark:text-dark-text">
                              {(detailedReports.complimentary || []).map((item, idx) => (
                                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-dark-element/30 bg-amber-50/10 dark:bg-amber-950/5">
                                  <td className="px-4 py-3 whitespace-nowrap font-mono">{item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : ''}</td>
                                  <td className="px-4 py-3 font-semibold text-amber-650 dark:text-amber-400">{item.product_name || ''}</td>
                                  <td className="px-4 py-3 text-center font-bold">{item.quantity || 0}x</td>
                                  <td className="px-4 py-3 capitalize">{item.discount_type || 'cortesia'}</td>
                                  <td className="px-4 py-3 text-zinc-500 dark:text-dark-muted max-w-xs truncate" title={item.reason || ''}>{item.reason || ''}</td>
                                  <td className="px-4 py-3 font-semibold">{item.authorized_by || ''}</td>
                                  <td className="px-4 py-3 text-right font-extrabold text-amber-500">- R$ {((item.unit_price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                                </tr>
                              ))}
                              {(!detailedReports.complimentary || detailedReports.complimentary.length === 0) && (
                                <tr><td colSpan="7" className="text-center py-6 text-zinc-400">Nenhuma cortesia ou desconto registrado.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Auditoria de Cancelamentos por Motivo */}
                      <div>
                        <h4 className="font-extrabold text-xs text-zinc-450 uppercase tracking-wider mb-3">Cancelamentos por Motivo</h4>
                        <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                          <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                            <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                              <tr>
                                <th className="px-4 py-3">Motivo</th>
                                <th className="px-4 py-3 text-center">Ocorrências</th>
                                <th className="px-4 py-3 text-right">Prejuízo Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-xs text-zinc-650 dark:text-dark-text">
                              {(detailedReports.cancellations_by_reason || []).map((item, idx) => (
                                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-dark-element/30">
                                  <td className="px-4 py-3 font-semibold">{item.reason || 'Sem motivo'}</td>
                                  <td className="px-4 py-3 text-center font-bold text-brand-500">{item.count || 0}x</td>
                                  <td className="px-4 py-3 text-right font-extrabold text-red-500">- R$ {(item.total_loss || 0).toFixed(2)}</td>
                                </tr>
                              ))}
                              {(!detailedReports.cancellations_by_reason || detailedReports.cancellations_by_reason.length === 0) && (
                                <tr><td colSpan="3" className="text-center py-6 text-zinc-400">Nenhum cancelamento registrado.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        )}

        {/* PRINTABLE DEDICATED LAYOUT */}
        <div id="detailed-report-print" className="hidden p-8 font-serif leading-relaxed text-black bg-white">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-2xl font-bold uppercase">{lojaForm.nome_fantasia || 'MENU CHEF'} - RELATÓRIO OPERACIONAL</h2>
            {lojaForm.cnpj && <p className="text-xs">CNPJ: {lojaForm.cnpj}</p>}
            {lojaForm.ie && <p className="text-xs">IE: {lojaForm.ie}</p>}
            {lojaForm.telefone && <p className="text-xs">Telefone: {lojaForm.telefone}</p>}
            {lojaForm.endereco && <p className="text-xs">Endereço: {lojaForm.endereco}</p>}
            <p className="text-sm font-semibold">Filtros: {startDate || 'Início'} até {endDate || 'Hoje'} | Turno: {turnFilter === 'lunch' ? 'Almoço' : turnFilter === 'dinner' ? 'Jantar' : 'Todos'}</p>
            <p className="text-xs">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
          </div>

          <hr className="border-black mb-6" />

          {activeReportTab === 'financeiro' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold">Relatório Financeiro e Faturamento</h3>
              <p>Faturamento Líquido: <strong>R$ {Number(detailedReports.total_revenue || 0).toFixed(2)}</strong></p>
              <p>Ticket Médio Geral: <strong>R$ {Number(detailedReports.ticket_medio || 0).toFixed(2)}</strong></p>
              <p>Transações Processadas: <strong>{detailedReports.sales_count || 0} vendas</strong></p>
              
              <h4 className="font-bold mt-4">Detalhamento de Entradas</h4>
              <table className="w-full text-left mt-2 border-collapse">
                <thead>
                  <tr className="border-b border-black text-xs uppercase">
                    <th className="py-2">Forma</th>
                    <th className="py-2">Transações</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailedReports.billing_by_method || []).map((item, idx) => (
                    <tr key={idx} className="border-b border-zinc-200">
                      <td className="py-2 capitalize">{item.payment_method || ''}</td>
                      <td className="py-2">{item.count || 0}x</td>
                      <td className="py-2 text-right">R$ {Number(item.total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeReportTab === 'vendas' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold">Curva ABC de Produtos</h3>
              <table className="w-full text-left mt-2 border-collapse">
                <thead>
                  <tr className="border-b border-black text-xs uppercase">
                    <th className="py-2">Classe</th>
                    <th className="py-2">Produto</th>
                    <th className="py-2">Categoria</th>
                    <th className="py-2">Qtd</th>
                    <th className="py-2 text-right">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailedReports.abc_products || []).map((item, idx) => (
                    <tr key={idx} className="border-b border-zinc-200">
                      <td className="py-2 font-bold">Classe {item.classification || 'C'}</td>
                      <td className="py-2">{item.name || ''}</td>
                      <td className="py-2 capitalize">{item.category || ''}</td>
                      <td className="py-2">{item.quantity_sold || 0} un</td>
                      <td className="py-2 text-right">R$ {Number(item.total_revenue || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeReportTab === 'operacional' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold">Estatísticas Operacionais</h3>
              <p>Tempo Médio de Preparo/Entrega: <strong>{Number(detailedReports.avg_prep_time || 0).toFixed(1)} minutos</strong></p>
              
              <h4 className="font-bold mt-4">Vendas por Garçom</h4>
              <table className="w-full text-left mt-2 border-collapse">
                <thead>
                  <tr className="border-b border-black text-xs uppercase">
                    <th className="py-2">Garçom</th>
                    <th className="py-2">Pedidos</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailedReports.waiter_performance || []).map((item, idx) => (
                    <tr key={idx} className="border-b border-zinc-200">
                      <td className="py-2">{item.waiter_name || ''}</td>
                      <td className="py-2">{item.orders_count || 0}x</td>
                      <td className="py-2 text-right">R$ {Number(item.total_sales || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h4 className="font-bold mt-4">Horários de Pico ("Rush")</h4>
              <table className="w-full text-left mt-2 border-collapse">
                <thead>
                  <tr className="border-b border-black text-xs uppercase">
                    <th className="py-2">Hora</th>
                    <th className="py-2">Pedidos</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailedReports.rush_hours || []).map((item, idx) => (
                    <tr key={idx} className="border-b border-zinc-200">
                      <td className="py-2">{item.hour || '00'}:00h</td>
                      <td className="py-2">{item.count || 0}x</td>
                      <td className="py-2 text-right">R$ {Number(item.total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeReportTab === 'cancelamentos' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold">Relatório de Auditoria de Cancelamentos</h3>
              <table className="w-full text-left mt-2 border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black uppercase">
                    <th className="py-2">Data</th>
                    <th className="py-2">Produto</th>
                    <th className="py-2">Qtd</th>
                    <th className="py-2">Mesa</th>
                    <th className="py-2">Motivo</th>
                    <th className="py-2">Funcionário</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailedReports.cancellations || []).map((item, idx) => (
                    <tr key={idx} className="border-b border-zinc-200">
                      <td className="py-2">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</td>
                      <td className="py-2">{item.item_name || ''}</td>
                      <td className="py-2">{item.quantity || 0}x</td>
                      <td className="py-2">Mesa {item.table_number || 'N/A'}</td>
                      <td className="py-2">{item.reason || ''}</td>
                      <td className="py-2">{item.employee_name || ''}</td>
                      <td className="py-2 text-right">- R$ {((item.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeReportTab === 'modalidade' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold">Relatório por Modalidade</h3>
              <p><strong>Salão (Mesas):</strong> R$ {(detailedReports.modality_data || []).find(m => m.modality.includes('Salão'))?.total?.toFixed(2) || '0.00'}</p>
              <p><strong>Delivery:</strong> R$ {(detailedReports.modality_data || []).find(m => m.modality.includes('Delivery'))?.total?.toFixed(2) || '0.00'}</p>
              
              {detailedReports.ticket_by_table && detailedReports.ticket_by_table.length > 0 && (
                <>
                  <h4 className="font-bold mt-4">Ticket Médio por Mesa</h4>
                  <table className="w-full text-left mt-2 border-collapse">
                    <thead>
                      <tr className="border-b border-black text-xs uppercase">
                        <th className="py-2">Mesa</th>
                        <th className="py-2">Vendas</th>
                        <th className="py-2 text-right">Ticket Médio</th>
                        <th className="py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailedReports.ticket_by_table.map((item, idx) => (
                        <tr key={idx} className="border-b border-zinc-200">
                          <td className="py-2">Mesa {item.table_number || item.table_id}</td>
                          <td className="py-2">{item.sales_count || 0}x</td>
                          <td className="py-2 text-right">R$ {(item.avg_ticket || 0).toFixed(2)}</td>
                          <td className="py-2 text-right">R$ {(item.total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {activeReportTab === 'auditoria' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold">Relatório de Auditoria e Segurança</h3>
              <p>Total Cortesias/Descontos: <strong>- R$ {(detailedReports.total_complimentary || 0).toFixed(2)}</strong></p>
              <p>Total Prejuízo Cancelamentos: <strong>- R$ {(detailedReports.cancellations || []).reduce((s, c) => s + ((c.price || 0) * (c.quantity || 0)), 0).toFixed(2)}</strong></p>
              
              {detailedReports.cancellations_by_reason && detailedReports.cancellations_by_reason.length > 0 && (
                <>
                  <h4 className="font-bold mt-4">Cancelamentos por Motivo</h4>
                  <table className="w-full text-left mt-2 border-collapse">
                    <thead>
                      <tr className="border-b border-black text-xs uppercase">
                        <th className="py-2">Motivo</th>
                        <th className="py-2">Ocorrências</th>
                        <th className="py-2 text-right">Prejuízo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailedReports.cancellations_by_reason.map((item, idx) => (
                        <tr key={idx} className="border-b border-zinc-200">
                          <td className="py-2">{item.reason || 'Sem motivo'}</td>
                          <td className="py-2">{item.count || 0}x</td>
                          <td className="py-2 text-right">- R$ {(item.total_loss || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </div>

        {/* Tab Content 2: Products Catalogue (CRUD) */}
        {activeSubTab === 'products' && (
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text">Pratos do Cardápio</h3>
              <div className="flex items-center space-x-2">
                {products.some(p => p.image_url && p.image_url.startsWith('/uploads/')) && (
                  <button
                    onClick={handleMigrateImages}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition duration-200 shadow-md"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Migrar Imagens</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setProductForm({ name: '', price: '', description: '', category: 'lanches', stock: '10', track_stock: true, image: null, observations: [] });
                    setShowProductModal(true);
                  }}
                  className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition duration-200 shadow-md shadow-brand-500/10"
                >
                  <Plus className="h-4 w-4" />
                  <span>Cadastrar Produto</span>
                </button>
              </div>
            </div>

            <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Imagem</th>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Preço</th>
                    <th className="px-4 py-3">Estoque</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-sm text-zinc-700 dark:text-dark-text">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-dark-element/50">
                      <td className="px-4 py-3">
                        {p.image_url ? (
                          <img
                            src={getProductImageUrl(p.image_url)}
                            alt={p.name}
                            className="h-10 w-10 object-cover rounded-lg border dark:border-dark-border"
                          />
                        ) : (
                          <div className="h-10 w-10 bg-brand-100 dark:bg-brand-950/20 text-brand-500 rounded-lg flex items-center justify-center font-bold text-xs uppercase">
                            Card
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold">{p.name}</td>
                      <td className="px-4 py-3 capitalize">{p.category}</td>
                      <td className="px-4 py-3 font-bold text-zinc-900 dark:text-dark-text">R$ {p.price.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        {p.track_stock === 1 ? (
                          <span className={`font-semibold text-xs px-2.5 py-1 rounded-full ${
                            p.stock <= 5 ? 'bg-red-50 dark:bg-red-950/20 text-red-550' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500'
                          }`}>
                            {p.stock} un
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400 font-medium">Sem limite</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => handleEditProduct(p)}
                          className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-dark-text hover:bg-zinc-100 dark:hover:bg-dark-element rounded-lg transition"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Categorias */}
        {activeSubTab === 'categories' && (
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text">Categorias do Cardápio</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Gerencie as categorias que aparecem no garçom e cliente</p>
              </div>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryForm({ name: '', icon: 'package', sort_order: categories.length });
                  setShowCategoryModal(true);
                }}
                className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition duration-200 shadow-md shadow-brand-500/10"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Categoria</span>
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="text-center py-16 text-zinc-400">
                <Tags className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold text-sm">Nenhuma categoria cadastrada</p>
                <p className="text-xs mt-1">Clique em "Nova Categoria" para começar.</p>
              </div>
            ) : (
              <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                  <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Ordem</th>
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-sm text-zinc-700 dark:text-dark-text">
                    {categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-zinc-50 dark:hover:bg-dark-element/50">
                        <td className="px-4 py-3 font-bold text-zinc-400">{cat.sort_order}</td>
                        <td className="px-4 py-3 font-semibold capitalize">{cat.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            cat.active
                              ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                          }`}>
                            {cat.active ? 'Ativa' : 'Inativa'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => handleEditCategory(cat)}
                            className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-dark-text hover:bg-zinc-100 dark:hover:bg-dark-element rounded-lg transition"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Observações Globais */}
        {activeSubTab === 'observations' && (
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm animate-in fade-in duration-200 max-w-2xl">
            <div className="mb-6">
              <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text">Banco de Observações</h3>
              <p className="text-sm text-zinc-500">Cadastre opções como "Sem cebola", "Bem passado" para vincular aos produtos depois.</p>
            </div>

            <div className="flex space-x-3 mb-6">
              <input
                type="text"
                placeholder="Digite uma nova observação..."
                value={newGlobalObs}
                onChange={(e) => setNewGlobalObs(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newGlobalObs.trim()) {
                    handleAddGlobalObs();
                  }
                }}
                className="flex-1 border border-zinc-300 dark:border-dark-border p-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-dark-element text-zinc-800 dark:text-dark-text focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={handleAddGlobalObs}
                className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs transition duration-200 shadow-md shadow-brand-500/10 flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Cadastrar</span>
              </button>
            </div>

            <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden divide-y divide-zinc-200 dark:divide-dark-border">
              {globalObservations.length === 0 ? (
                <div className="p-6 text-center text-zinc-400 text-sm">Nenhuma observação cadastrada no sistema.</div>
              ) : (
                globalObservations.map((obs, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-white dark:bg-dark-card hover:bg-zinc-50 dark:hover:bg-dark-element/50 transition">
                    <span className="text-sm font-semibold text-zinc-700 dark:text-dark-text">{obs}</span>
                    <button
                      onClick={() => handleDeleteGlobalObs(obs)}
                      className="text-zinc-400 hover:text-red-500 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab Content 3: Employee Management (CRUD) */}
        {activeSubTab === 'users' && (
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text">Funcionários Cadastrados</h3>
              <button
                onClick={() => {
                  setEditingUser(null);
                  setUserForm({ name: '', username: '', password: '', role: 'waiter' });
                  setShowUserModal(true);
                }}
                className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition duration-200 shadow-md shadow-brand-500/10"
              >
                <Plus className="h-4 w-4" />
                <span>Adicionar Funcionário</span>
              </button>
            </div>

            <div className="border border-zinc-200 dark:border-dark-border rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-dark-border text-left">
                <thead className="bg-zinc-50 dark:bg-dark-element text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Usuário de Acesso</th>
                    <th className="px-4 py-3">Cargo/Acesso</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-dark-border text-sm text-zinc-700 dark:text-dark-text">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-dark-element/50">
                      <td className="px-4 py-3 font-semibold">{u.name}</td>
                      <td className="px-4 py-3 font-mono text-zinc-550 dark:text-dark-muted">{u.username}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          u.role === 'admin'
                            ? 'bg-red-50 dark:bg-red-950/20 text-red-500'
                            : u.role === 'kitchen'
                            ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600'
                            : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600'
                        }`}>
                          {getRoleLabel(u.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => handleEditUser(u)}
                          className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-dark-text hover:bg-zinc-100 dark:hover:bg-dark-element rounded-lg transition"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-2 text-red-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content 4: Gerenciamento de Mesas */}
        {activeSubTab === 'tables' && (
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text">Gerenciamento de Mesas</h3>
                <p className="text-xs font-semibold text-zinc-400 mt-0.5">{tables.length} {tables.length === 1 ? 'mesa cadastrada' : 'mesas cadastradas'} no restaurante</p>
              </div>
              <button
                onClick={() => {
                  const nextNumber = tables.length > 0 ? Math.max(...tables.map(t => t.number)) + 1 : 1;
                  setNewTableNumber(String(nextNumber));
                  setShowAddTableModal(true);
                }}
                className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition duration-200 shadow-md shadow-brand-500/10 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>Adicionar Mesa</span>
              </button>
            </div>

            {tables.length === 0 ? (
              <div className="text-center py-16 text-zinc-400">
                <Grid className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold text-sm">Nenhuma mesa cadastrada</p>
                <p className="text-xs mt-1">Clique em "Adicionar Mesa" para começar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {tables.map((table) => (
                  <div
                    key={table.id}
                    className={`border p-5 rounded-2xl text-center flex flex-col items-center justify-center space-y-3 transition ${
                      table.status === 'occupied'
                        ? 'bg-amber-50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/40'
                        : table.status === 'waiting_payment'
                        ? 'bg-red-50 dark:bg-red-950/10 border-red-200 dark:border-red-900/40'
                        : 'bg-zinc-50 dark:bg-dark-element/40 border-zinc-200 dark:border-dark-border'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-xl shadow-md ${
                      table.status === 'occupied'
                        ? 'bg-amber-500 text-white'
                        : table.status === 'waiting_payment'
                        ? 'bg-red-500 text-white'
                        : 'bg-brand-500 text-white'
                    }`}>
                      {table.number}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-zinc-800 dark:text-dark-text">Mesa {table.number}</p>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 uppercase ${
                        table.status === 'occupied'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                          : table.status === 'waiting_payment'
                          ? 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                      }`}>
                        {table.status === 'occupied' ? 'Em consumo' : table.status === 'waiting_payment' ? 'Pedindo conta' : 'Livre'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content 5: Loja Settings */}
        {activeSubTab === 'loja' && (
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm animate-in fade-in duration-200">
            <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text mb-2">Dados da Loja / Empresa</h3>
            <p className="text-xs font-semibold text-zinc-400 mb-6">Cadastre as informações da sua empresa. Elas serão exibidas nos cabeçalhos de todos os relatórios e cupons fiscais/pedidos.</p>

            <form onSubmit={handleLojaSubmit} className="max-w-xl space-y-5">
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Nome Fantasia</label>
                <input
                  type="text"
                  required
                  value={lojaForm.nome_fantasia}
                  onChange={(e) => setLojaForm({ ...lojaForm, nome_fantasia: e.target.value })}
                  className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                  placeholder="Ex: Pizzaria Mamma Mia"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={lojaForm.telefone}
                    onChange={(e) => setLojaForm({ ...lojaForm, telefone: e.target.value })}
                    className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                    placeholder="Ex: (11) 99999-9999"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">CNPJ</label>
                  <input
                    type="text"
                    required
                    value={lojaForm.cnpj}
                    onChange={(e) => setLojaForm({ ...lojaForm, cnpj: e.target.value })}
                    className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                    placeholder="Ex: 00.000.000/0001-00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Inscrição Estadual (IE)</label>
                  <input
                    type="text"
                    value={lojaForm.ie}
                    onChange={(e) => setLojaForm({ ...lojaForm, ie: e.target.value })}
                    className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                    placeholder="Ex: 000.000.000.000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Endereço</label>
                <input
                  type="text"
                  required
                  value={lojaForm.endereco}
                  onChange={(e) => setLojaForm({ ...lojaForm, endereco: e.target.value })}
                  className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                  placeholder="Ex: Av. Paulista, 1000 - São Paulo, SP"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition duration-200 shadow-md shadow-brand-500/10 disabled:opacity-50"
              >
                <span>{loading ? 'Salvando...' : 'Salvar Dados da Loja'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab Content 6: Licença */}
        {activeSubTab === 'license' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Status Card */}
            <div className={`bg-white dark:bg-dark-card border p-6 rounded-2xl shadow-sm ${
              licenseStatus.bloqueado 
                ? 'border-red-300 dark:border-red-800' 
                : licenseStatus.diasRestantes <= 7 
                  ? 'border-amber-300 dark:border-amber-800' 
                  : 'border-emerald-300 dark:border-emerald-800'
            }`}>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Shield className={`h-5 w-5 ${
                      licenseStatus.bloqueado ? 'text-red-500' : licenseStatus.diasRestantes <= 7 ? 'text-amber-500' : 'text-emerald-500'
                    }`} />
                    <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text">Status da Licença</h3>
                  </div>
                  <p className={`text-sm font-bold ${
                    licenseStatus.bloqueado ? 'text-red-600 dark:text-red-400' : licenseStatus.diasRestantes <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {licenseStatus.bloqueado 
                      ? 'SISTEMA BLOQUEADO - Licença expirada!' 
                      : licenseStatus.diasRestantes <= 7 
                        ? `Atenção: ${licenseStatus.diasRestantes} dia(s) restante(s)`
                        : `Ativa - ${licenseStatus.diasRestantes} dia(s) restante(s)`
                    }
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider ${
                  licenseStatus.bloqueado 
                    ? 'bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400' 
                    : licenseStatus.diasRestantes <= 7 
                      ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {licenseStatus.bloqueado ? 'Expirado' : 'Ativo'}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-zinc-50 dark:bg-dark-element rounded-xl p-3">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-dark-muted uppercase tracking-wider block mb-1">Vencimento</span>
                  <span className="text-sm font-extrabold text-zinc-900 dark:text-dark-text">
                    {licenseStatus.vencimento ? new Date(licenseStatus.vencimento).toLocaleDateString('pt-BR') : 'Não definido'}
                  </span>
                </div>
                <div className="bg-zinc-50 dark:bg-dark-element rounded-xl p-3">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-dark-muted uppercase tracking-wider block mb-1">Chave Utilizada</span>
                  <span className="text-sm font-extrabold text-zinc-900 dark:text-dark-text font-mono">
                    {licenseStatus.chaveAtual || 'Nenhuma'}
                  </span>
                </div>
                <div className="bg-zinc-50 dark:bg-dark-element rounded-xl p-3">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-dark-muted uppercase tracking-wider block mb-1">Plano Contratado</span>
                  <span className="text-sm font-extrabold text-zinc-900 dark:text-dark-text">
                    {licenseStatus.diasLicenciados ? `${licenseStatus.diasLicenciados} dias` : 'Não definido'}
                  </span>
                </div>
                <div className="bg-zinc-50 dark:bg-dark-element rounded-xl p-3">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-dark-muted uppercase tracking-wider block mb-1">Emergência</span>
                  <span className="text-sm font-extrabold text-zinc-900 dark:text-dark-text">
                    {licenseStatus.emergenciaUsadaEsteMes 
                      ? `Usada em ${licenseStatus.emergenciaUsadaEsteMes}`
                      : 'Disponível'
                    }
                  </span>
                </div>
                <div className="bg-zinc-50 dark:bg-dark-element rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-dark-muted uppercase tracking-wider block mb-1">Módulo Ativo</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold w-fit ${
                    (licenseStatus.modulo || 'BASICO').toUpperCase() === 'GERAL'
                      ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                      : 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      (licenseStatus.modulo || 'BASICO').toUpperCase() === 'GERAL'
                        ? 'bg-emerald-500'
                        : 'bg-blue-500'
                    }`} />
                    {(licenseStatus.modulo || 'BASICO').toUpperCase() === 'GERAL' ? 'Geral (Delivery incl.)' : 'Básico'}
                  </span>
                </div>
              </div>
            </div>

            {/* Activate Key Form */}
            <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm">
              <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text mb-2">Ativar Nova Chave</h3>
              <p className="text-xs font-semibold text-zinc-400 mb-4">Insira a chave de 12 dígitos no formato XXXX-XXXX-XXXX para liberar o sistema.</p>
              
              <form onSubmit={handleActivateLicense} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm font-mono font-bold tracking-[0.2em] text-center text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition uppercase"
                  placeholder="XXXX-XXXX-XXXX"
                  maxLength={14}
                />
                <button
                  type="submit"
                  disabled={activatingLicense || !licenseKey.trim()}
                  className="px-8 py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-brand-500/20"
                >
                  {activatingLicense ? (
                    <span>Ativando...</span>
                  ) : (
                    <>
                      <Key className="h-4 w-4" />
                      <span>Ativar</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Emergency Button */}
            <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-6 rounded-2xl shadow-sm">
              <h3 className="font-extrabold text-lg text-zinc-900 dark:text-dark-text mb-2">Prazo de Emergência</h3>
              <p className="text-xs font-semibold text-zinc-400 mb-4">
                Se o sistema venceu no meio do expediente, libere +3 dias de forma emergencial. 
                Pode ser usado apenas <span className="font-bold text-amber-500">uma vez por mês</span>.
              </p>
              <button
                onClick={handleEmergencyExtension}
                disabled={usingEmergency || (licenseStatus.emergenciaUsadaEsteMes === `${new Date().getMonth() + 1}/${new Date().getFullYear()}`)}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm flex items-center space-x-2 transition shadow-lg shadow-amber-500/20"
              >
                {usingEmergency ? (
                  <span>Liberando...</span>
                ) : (
                  <>
                    <Clock className="h-4 w-4" />
                    <span>Liberar Prazo de Emergência (+3 dias)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: Product Form (Create / Edit) */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-205">
            <div className="p-6 border-b border-zinc-150 dark:border-dark-border bg-zinc-50 dark:bg-dark-element/50 flex justify-between items-center">
              <h3 className="font-extrabold text-xl text-zinc-900 dark:text-dark-text">
                {editingProduct ? 'Editar Produto' : 'Cadastrar Produto'}
              </h3>
              <button onClick={() => setShowProductModal(false)} className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              
              {/* Product name */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Nome do Prato</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                  placeholder="Ex: Hambúrguer de Bacon"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Price */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Preço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                    placeholder="29.90"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Categoria</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                  >
                    {categories.filter(c => c.active).length === 0 ? (
                      <option value="">Nenhuma categoria cadastrada</option>
                    ) : (
                      categories.filter(c => c.active).map((cat) => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Descrição / Ingredientes</label>
                <textarea
                  rows="3"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                  placeholder="Escreva sobre o prato..."
                ></textarea>
              </div>

              {/* Stock controls */}
              <div className="bg-zinc-50 dark:bg-dark-element/50 border dark:border-dark-border p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-650 dark:text-dark-text">Controlar estoque para este produto?</span>
                  <input
                    type="checkbox"
                    checked={productForm.track_stock}
                    onChange={(e) => setProductForm({ ...productForm, track_stock: e.target.checked })}
                    className="h-4.5 w-4.5 accent-brand-500 text-white cursor-pointer rounded"
                  />
                </div>

                {productForm.track_stock && (
                  <div className="animate-in slide-in-from-top-2 duration-150">
                    <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Estoque Inicial</label>
                    <input
                      type="number"
                      required
                      value={productForm.stock}
                      onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                      className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                      placeholder="10"
                    />
                  </div>
                )}
              </div>

              {/* Product Image File Input */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Upload de Imagem</label>
                {editingProduct?.image_url && !productForm.image && (
                  <div className="mb-3">
                    <img
                      src={getProductImageUrl(editingProduct.image_url)}
                      alt={editingProduct.name}
                      className="h-24 w-24 object-cover rounded-xl border dark:border-dark-border"
                    />
                    <p className="text-[10px] text-zinc-400 mt-1">Imagem atual. Selecione uma nova para substituir.</p>
                  </div>
                )}
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-zinc-200 dark:border-dark-border rounded-2xl bg-zinc-50 dark:bg-dark-element/50 hover:bg-zinc-100 transition duration-200 relative">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-8 w-8 text-zinc-400" />
                    <div className="flex text-xs text-zinc-600 dark:text-dark-muted">
                      <label className="relative cursor-pointer font-bold text-brand-500 hover:text-brand-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-brand-500">
                        <span>Carregar arquivo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setProductForm({ ...productForm, image: e.target.files[0] })}
                          className="sr-only"
                        />
                      </label>
                    </div>
                    <p className="text-[10px] text-zinc-400">PNG, JPG, WEBP até 5MB</p>
                    {productForm.image && (
                      <p className="text-xs font-bold text-emerald-600 mt-2 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                        Selecionada: {productForm.image.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Vinculação de Observações no Modal de Produto */}
              <div className="pt-2 border-t border-zinc-200 dark:border-dark-border mt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-dark-muted mb-3">
                  Anexar Observações a este Produto
                </label>
                
                {globalObservations.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">Nenhuma observação cadastrada no menu "Observações".</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {globalObservations.map((obs, idx) => {
                      const isLinked = productForm.observations?.includes(obs) || false;
                      return (
                        <label key={idx} className={`flex items-center space-x-3 p-2 border rounded-lg cursor-pointer transition ${
                          isLinked ? 'bg-brand-50 border-brand-500' : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100'
                        }`}>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={isLinked}
                            onChange={(e) => {
                              const currentObs = productForm.observations || [];
                              if (e.target.checked) {
                                setProductForm({ ...productForm, observations: [...currentObs, obs] });
                              } else {
                                setProductForm({ ...productForm, observations: currentObs.filter(item => item !== obs) });
                              }
                            }}
                          />
                          <div className={`h-4 w-4 rounded flex items-center justify-center border transition ${
                            isLinked ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white border-zinc-300'
                          }`}>
                            {isLinked && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <span className={`text-sm font-semibold ${isLinked ? 'text-brand-700' : 'text-zinc-600'}`}>
                            {obs}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t dark:border-dark-border">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-1.5 shadow-lg shadow-brand-500/10 transition"
                >
                  {loading ? 'Processando...' : 'Salvar Produto'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 py-3.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-700 dark:text-dark-text font-bold rounded-xl text-sm transition"
                >
                  Cancelar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: Category Form (Create / Edit) */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-150 dark:border-dark-border bg-zinc-50 dark:bg-dark-element/50 flex justify-between items-center">
              <h3 className="font-extrabold text-xl text-zinc-900 dark:text-dark-text">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button onClick={() => setShowCategoryModal(false)} className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Nome da Categoria</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                  placeholder="Ex: Lanches, Pizzas, Bebidas..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Ícone</label>
                  <select
                    value={categoryForm.icon}
                    onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                    className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                  >
                    <option value="coffee">Café / Lanches</option>
                    <option value="pizza">Pizza</option>
                    <option value="beer">Bebida / Cerveja</option>
                    <option value="icecream">Sobremesa</option>
                    <option value="utensils">Talheres / Pratos</option>
                    <option value="package">Padrão</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Ordem Exibição</label>
                  <input
                    type="number"
                    min="0"
                    value={categoryForm.sort_order}
                    onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) || 0 })}
                    className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t dark:border-dark-border">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-1.5 shadow-lg shadow-brand-500/10 transition"
                >
                  {loading ? 'Processando...' : 'Salvar Categoria'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 py-3.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-700 dark:text-dark-text font-bold rounded-xl text-sm transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: User Form (Create / Edit) */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-150 dark:border-dark-border bg-zinc-50 dark:bg-dark-element/50 flex justify-between items-center">
              <h3 className="font-extrabold text-xl text-zinc-900 dark:text-dark-text">
                {editingUser ? 'Editar Funcionário' : 'Adicionar Funcionário'}
              </h3>
              <button onClick={() => setShowUserModal(false)} className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
              
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                  placeholder="Ex: João da Silva"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Usuário de Acesso</label>
                <input
                  type="text"
                  required
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                  placeholder="Ex: joao.silva"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">
                  {editingUser ? 'Senha (em branco para manter)' : 'Senha de Acesso'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                  placeholder="••••••••"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted mb-1.5 uppercase">Cargo / Acesso</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="block w-full p-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-zinc-900 dark:text-dark-text"
                >
                  <option value="waiter">Garçom</option>
                  <option value="kitchen">Cozinha</option>
                  <option value="cashier">Operador de Caixa</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t dark:border-dark-border">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-sm flex items-center justify-center transition"
                >
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 py-3 bg-zinc-200 hover:bg-zinc-300 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-700 dark:text-dark-text font-bold rounded-xl text-sm transition"
                >
                  Cancelar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar Nova Mesa */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border max-w-sm w-full rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-brand-500 to-brand-600 p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Grid className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Nova Mesa</h3>
                  <p className="text-brand-100 text-xs">Informe o número da mesa a adicionar</p>
                </div>
              </div>
              <button
                onClick={() => { setShowAddTableModal(false); setNewTableNumber(''); }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddTable} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-dark-muted uppercase tracking-wider mb-2">
                  Número da Mesa
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  autoFocus
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="w-full px-4 py-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-2xl font-extrabold text-center text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                  placeholder="Ex: 10"
                />
                <p className="text-[11px] text-zinc-400 mt-1.5">
                  A mesa será criada com status <span className="font-bold text-emerald-600">Livre</span> e ficará disponível imediatamente para o caixa e garçons.
                </p>
              </div>

              <div className="flex space-x-3 pt-1">
                <button
                  type="submit"
                  disabled={addingTable}
                  className="flex-1 py-3.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-brand-500/20"
                >
                  {addingTable ? (
                    <span>Adicionando...</span>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span>Adicionar Mesa</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddTableModal(false); setNewTableNumber(''); }}
                  className="flex-1 py-3.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-700 dark:text-dark-text font-bold rounded-xl text-sm transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
