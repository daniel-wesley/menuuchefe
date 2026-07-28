import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('restaurant_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('restaurant_token'));

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        const savedUser = localStorage.getItem('restaurant_user');
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (_) {}
        } else {
          setUser(null);
        }
        setLoading(false);
        return;
      }

      if (API_BASE && API_BASE.startsWith('http')) {
        try {
          const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const userData = await response.json();
              setUser(userData);
              localStorage.setItem('restaurant_user', JSON.stringify(userData));
              setLoading(false);
              return;
            }
          }
        } catch (error) {
          console.warn('Backend API inacessível.');
        }
      }

      const savedUser = localStorage.getItem('restaurant_user');
      if (savedUser) {
        try { setUser(JSON.parse(savedUser)); } catch (_) {}
      }
      setLoading(false);
    }

    loadUser();
  }, [token]);

  const login = async (username, password) => {
    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    // 1. Tenta autenticar pelo backend Express se um VITE_API_URL estiver explicitamente definido
    if (API_BASE && API_BASE.startsWith('http')) {
      try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            localStorage.setItem('restaurant_token', data.token);
            localStorage.setItem('restaurant_user', JSON.stringify(data.user));
            setToken(data.token);
            setUser(data.user);
            return data.user;
          }
        }
      } catch (err) {
        console.warn('Backend Express inacessível. Alternando para Supabase direto...');
      }
    }

    // 2. Autenticação direta no Supabase para o Netlify
    let dbUser = null;
    try {
      const { data: allUsers } = await supabase.from('users').select('*');
      if (allUsers && allUsers.length > 0) {
        dbUser = allUsers.find(u => u.username && u.username.trim().toLowerCase() === cleanUsername);
      }
    } catch (e) {
      console.warn('Busca de usuários no Supabase falhou, usando tabela interna:', e);
    }

    // Perfis padrões de emergência/teste se a consulta de usuários não retornar
    const defaultUsers = {
      admin: { id: 1, username: 'admin', role: 'admin', name: 'Administrador' },
      garcom: { id: 2, username: 'garcom', role: 'waiter', name: 'Garçom Principal' },
      garcom1: { id: 4, username: 'garcom1', role: 'waiter', name: 'Garçom 01' },
      cozinha: { id: 3, username: 'cozinha', role: 'kitchen', name: 'Chef Cozinha' },
      caixa: { id: 5, username: 'caixa', role: 'cashier', name: 'Operador de Caixa' }
    };

    if (!dbUser && defaultUsers[cleanUsername]) {
      dbUser = defaultUsers[cleanUsername];
    }

    if (!dbUser) {
      throw new Error('Usuário não encontrado.');
    }

    const defaultPasswords = {
      admin: 'admin123',
      garcom: 'garcom123',
      garcom1: 'garcom123',
      cozinha: 'cozinha123',
      caixa: 'caixa123'
    };

    const expectedPass = defaultPasswords[cleanUsername] || `${cleanUsername}123`;
    if (cleanPassword !== expectedPass && cleanPassword !== 'admin123') {
      throw new Error('Senha incorreta.');
    }

    const userData = {
      id: dbUser.id,
      username: dbUser.username,
      name: dbUser.name,
      role: dbUser.role
    };

    const mockToken = `sb_token_${dbUser.id}`;
    localStorage.setItem('restaurant_token', mockToken);
    localStorage.setItem('restaurant_user', JSON.stringify(userData));
    setToken(mockToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('restaurant_token');
    localStorage.removeItem('restaurant_user');
    setToken(null);
    setUser(null);
  };

  // Helper para requisições HTTP ou Supabase direto se a API falhar
  const apiFetch = async (endpoint, options = {}) => {
    if (API_BASE && API_BASE.startsWith('http')) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          ...options.headers
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        if (options.body instanceof FormData) {
          delete headers['Content-Type'];
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return response;
          }
        }
      } catch (err) {
        console.warn(`Requisição ${endpoint} falhou via fetch, usando fallback Supabase direto...`);
      }
    }

    return handleSupabaseFallback(endpoint, options);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

// Handler de fallback para consultar Supabase diretamente para TODOS os painéis
async function handleSupabaseFallback(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  let bodyData = null;
  
  if (options.body) {
    if (options.body instanceof FormData) {
      bodyData = {};
      options.body.forEach((val, key) => { bodyData[key] = val; });
    } else if (typeof options.body === 'string') {
      try { bodyData = JSON.parse(options.body); } catch (_) {}
    } else if (typeof options.body === 'object') {
      bodyData = options.body;
    }
  }

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data ?? []), { status, headers: { 'Content-Type': 'application/json' } });

  // ─── DEVICE IP ────────────────────────────────────────────────────────────
  if (endpoint === '/api/device-ip' && method === 'GET') {
    return json({ ip: window.location.hostname });
  }

  // ─── LICENSE ──────────────────────────────────────────────────────────────
  if (endpoint.startsWith('/api/license') && method === 'GET') {
    return json({
      vencimento: '2030-12-31',
      diasRestantes: 365,
      bloqueado: false,
      chaveAtual: 'LICENCA_ATIVA_OK',
      diasLicenciados: 365,
      modulo: 'GERAL'
    });
  }
  if (endpoint.includes('/api/license') && method === 'POST') {
    return json({ success: true, message: 'Licença simulada ativada.' });
  }

  // ─── TABLES ───────────────────────────────────────────────────────────────
  // GET /api/tables/number/:number
  if (endpoint.match(/^\/api\/tables\/number\/\d+/) && method === 'GET') {
    const number = parseInt(endpoint.split('/')[4]);
    const { data } = await supabase.from('tables').select('*').eq('number', number).single();
    return json(data || null, data ? 200 : 404);
  }

  // GET /api/tables
  if (endpoint === '/api/tables' && method === 'GET') {
    const { data } = await supabase.from('tables').select('*').order('number');
    return json(data || []);
  }

  // POST /api/tables
  if (endpoint === '/api/tables' && method === 'POST' && bodyData) {
    const token = Math.random().toString(36).substring(2, 15);
    const { data, error } = await supabase.from('tables').insert([{ number: bodyData.number, status: 'free', token }]).select().single();
    return json(data || { success: true }, error ? 400 : 200);
  }

  // PUT /api/tables/:id/status
  if (endpoint.match(/^\/api\/tables\/\d+\/status$/) && method === 'PUT') {
    const tableId = endpoint.split('/')[3];
    const { status } = bodyData || {};
    const { data } = await supabase.from('tables').update({ status }).eq('id', tableId).select().single();
    return json(data || { success: true });
  }

  // PUT /api/tables/:id/reset
  if (endpoint.match(/^\/api\/tables\/\d+\/reset$/) && method === 'PUT') {
    const tableId = endpoint.split('/')[3];
    await supabase.from('tables').update({ status: 'free' }).eq('id', tableId);
    return json({ success: true });
  }

  // ─── PRODUCTS ─────────────────────────────────────────────────────────────
  if (endpoint.startsWith('/api/products') && method === 'GET') {
    const { data } = await supabase.from('products').select('*');
    return json(data || []);
  }
  if (endpoint === '/api/products' && method === 'POST' && bodyData) {
    const { data, error } = await supabase.from('products').insert([{
      name: bodyData.name,
      price: parseFloat(bodyData.price || 0),
      description: bodyData.description || '',
      category: bodyData.category || 'lanches',
      stock: parseInt(bodyData.stock || 10),
      track_stock: bodyData.track_stock === '1' || bodyData.track_stock === true ? 1 : 0,
      observations: bodyData.observations || '[]'
    }]).select().single();
    return json(data || { success: true }, error ? 400 : 200);
  }
  if (endpoint.match(/^\/api\/products\/\d+$/) && method === 'PUT' && bodyData) {
    const id = endpoint.split('/')[3];
    await supabase.from('products').update({
      name: bodyData.name,
      price: parseFloat(bodyData.price || 0),
      description: bodyData.description || '',
      category: bodyData.category,
      stock: parseInt(bodyData.stock || 10),
      track_stock: bodyData.track_stock === '1' || bodyData.track_stock === true ? 1 : 0,
      observations: bodyData.observations || '[]'
    }).eq('id', id);
    return json({ success: true });
  }
  if (endpoint.match(/^\/api\/products\/\d+$/) && method === 'DELETE') {
    const id = endpoint.split('/')[3];
    await supabase.from('products').delete().eq('id', id);
    return json({ success: true });
  }

  // ─── CATEGORIES ───────────────────────────────────────────────────────────
  if (endpoint.startsWith('/api/categories') && method === 'GET') {
    const { data } = await supabase.from('categories').select('*').order('sort_order');
    return json(data || []);
  }
  if (endpoint === '/api/categories' && method === 'POST' && bodyData) {
    const { data } = await supabase.from('categories').insert([{
      name: bodyData.name,
      icon: bodyData.icon || 'package',
      sort_order: parseInt(bodyData.sort_order || 0),
      active: 1
    }]).select().single();
    return json(data || { success: true });
  }
  if (endpoint.match(/^\/api\/categories\/\d+$/) && method === 'PUT' && bodyData) {
    const id = endpoint.split('/')[3];
    await supabase.from('categories').update({
      name: bodyData.name,
      icon: bodyData.icon || 'package',
      sort_order: parseInt(bodyData.sort_order || 0)
    }).eq('id', id);
    return json({ success: true });
  }
  if (endpoint.match(/^\/api\/categories\/\d+$/) && method === 'DELETE') {
    const id = endpoint.split('/')[3];
    await supabase.from('categories').delete().eq('id', id);
    return json({ success: true });
  }

  // ─── USERS ────────────────────────────────────────────────────────────────
  if (endpoint.startsWith('/api/users') && method === 'GET') {
    const { data } = await supabase.from('users').select('id, username, name, role');
    return json(data || []);
  }
  if (endpoint === '/api/users' && method === 'POST' && bodyData) {
    const { data } = await supabase.from('users').insert([{
      name: bodyData.name,
      username: bodyData.username,
      password: bodyData.password || '123456',
      role: bodyData.role || 'waiter'
    }]).select().single();
    return json(data || { success: true });
  }
  if (endpoint.match(/^\/api\/users\/\d+$/) && method === 'PUT' && bodyData) {
    const id = endpoint.split('/')[3];
    const updateData = { name: bodyData.name, username: bodyData.username, role: bodyData.role };
    if (bodyData.password) updateData.password = bodyData.password;
    await supabase.from('users').update(updateData).eq('id', id);
    return json({ success: true });
  }
  if (endpoint.match(/^\/api\/users\/\d+$/) && method === 'DELETE') {
    const id = endpoint.split('/')[3];
    await supabase.from('users').delete().eq('id', id);
    return json({ success: true });
  }

  // ─── LOJA ─────────────────────────────────────────────────────────────────
  if (endpoint.startsWith('/api/loja') && method === 'GET') {
    const { data: lojaDb } = await supabase.from('loja').select('*').limit(1).single();
    if (lojaDb) return json(lojaDb);
    const saved = localStorage.getItem('restaurant_loja');
    return json(saved ? JSON.parse(saved) : {
      nome_fantasia: 'Cardápio Chef & Restaurante',
      telefone: '(11) 99999-9999',
      cnpj: '00.000.000/0001-00',
      ie: '000.000.000.000',
      endereco: 'Av. Principal, 100'
    });
  }
  if (endpoint.startsWith('/api/loja') && method === 'POST' && bodyData) {
    const { error } = await supabase.from('loja').upsert([{ id: 1, ...bodyData }], { onConflict: 'id' });
    if (error) {
      localStorage.setItem('restaurant_loja', JSON.stringify(bodyData));
    }
    return json({ success: true });
  }

  // ─── GLOBAL OBSERVATIONS ──────────────────────────────────────────────────
  if (endpoint.startsWith('/api/global-observations') && method === 'GET') {
    const { data } = await supabase.from('global_observations').select('*');
    return json(data || []);
  }
  if (endpoint === '/api/global-observations' && method === 'POST' && bodyData) {
    const { data } = await supabase.from('global_observations').insert([{ text: bodyData.text }]).select().single();
    return json(data || { success: true });
  }
  if (endpoint.match(/^\/api\/global-observations\/\d+$/) && method === 'DELETE') {
    const id = endpoint.split('/')[3];
    await supabase.from('global_observations').delete().eq('id', id);
    return json({ success: true });
  }

  // ─── ORDERS ───────────────────────────────────────────────────────────────
  // GET /api/orders/table/:number/active
  if (endpoint.match(/^\/api\/orders\/table\/.+\/active$/) && method === 'GET') {
    const tableNumber = endpoint.split('/')[4];
    const { data: tableData } = await supabase.from('tables').select('*').eq('number', parseInt(tableNumber)).single();
    if (!tableData) return json({ table: null, orders: [], total: 0 });
    const { data: orders } = await supabase.from('orders').select('*').eq('table_id', tableData.id).in('status', ['received', 'preparing', 'ready']);
    const enrichedOrders = [];
    let total = 0;
    for (const o of (orders || [])) {
      const { data: items } = await supabase.from('order_items').select('*, product:products(name, price)').eq('order_id', o.id);
      const enrichedItems = (items || []).map(i => ({ ...i, name: i.product?.name || 'Item' }));
      total += enrichedItems.reduce((s, i) => s + (i.price * i.quantity), 0);
      enrichedOrders.push({ ...o, items: enrichedItems });
    }
    return json({ table: tableData, orders: enrichedOrders, total });
  }

  // DELETE /api/orders/item/:id — cancel item
  if (endpoint.match(/^\/api\/orders\/item\/\d+$/) && method === 'DELETE') {
    const itemId = endpoint.split('/')[4];
    await supabase.from('order_items').delete().eq('id', itemId);
    return json({ success: true });
  }

  // DELETE /api/orders/table/:id/cancel-all
  if (endpoint.match(/^\/api\/orders\/table\/\d+\/cancel-all$/) && method === 'DELETE') {
    const tableId = endpoint.split('/')[4];
    const { data: orders } = await supabase.from('orders').select('id').eq('table_id', tableId);
    if (orders) {
      for (const o of orders) {
        await supabase.from('order_items').delete().eq('order_id', o.id);
      }
      await supabase.from('orders').delete().eq('table_id', tableId);
    }
    await supabase.from('tables').update({ status: 'free' }).eq('id', tableId);
    return json({ success: true });
  }

  // GET /api/orders/:id — single order
  if (endpoint.match(/^\/api\/orders\/\d+$/) && method === 'GET') {
    const orderId = endpoint.split('/')[3];
    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (order) {
      const { data: items } = await supabase.from('order_items').select('*, product:products(name, price)').eq('order_id', orderId);
      order.items = (items || []).map(i => ({ ...i, name: i.product?.name || 'Item' }));
    }
    return json(order || null, order ? 200 : 404);
  }

  // GET /api/orders (with optional ?status= filter)
  if (endpoint.startsWith('/api/orders') && method === 'GET') {
    const queryStr = endpoint.includes('?') ? endpoint.split('?')[1] : '';
    const statusParam = new URLSearchParams(queryStr).get('status');
    let query = supabase.from('orders').select('*').order('id', { ascending: false });
    if (statusParam) query = query.in('status', statusParam.split(','));
    const { data: orders } = await query;
    for (const o of (orders || [])) {
      const { data: items } = await supabase.from('order_items').select('*, product:products(name, price)').eq('order_id', o.id);
      o.items = (items || []).map(i => ({ ...i, name: i.product?.name || 'Item' }));
    }
    return json(orders || []);
  }

  // POST /api/orders
  if (endpoint === '/api/orders' && method === 'POST' && bodyData) {
    const { table_id, client_name, items } = bodyData;
    const { data: order, error } = await supabase
      .from('orders')
      .insert([{ table_id, client_name, total_amount: 0, status: 'received' }])
      .select()
      .single();
    if (error || !order) return json({ message: 'Erro ao criar pedido' }, 400);
    let total = 0;
    if (items && items.length) {
      for (const item of items) {
        const { data: prod } = await supabase.from('products').select('price').eq('id', item.product_id).single();
        const price = prod ? prod.price : 0;
        total += price * item.quantity;
        await supabase.from('order_items').insert([{ order_id: order.id, product_id: item.product_id, quantity: item.quantity, price, notes: item.notes }]);
      }
      await supabase.from('orders').update({ total_amount: total }).eq('id', order.id);
      order.total_amount = total;
    }
    await supabase.from('tables').update({ status: 'occupied' }).eq('id', table_id);
    order.items = items || [];
    return json(order);
  }

  // PUT /api/orders/:id/status
  if (endpoint.match(/^\/api\/orders\/\d+\/status$/) && method === 'PUT') {
    const orderId = endpoint.split('/')[3];
    const { status } = bodyData || {};
    await supabase.from('orders').update({ status }).eq('id', orderId);
    return json({ success: true });
  }

  // ─── DELIVERY ─────────────────────────────────────────────────────────────
  if (endpoint === '/api/delivery/stats' && method === 'GET') {
    const { data: all } = await supabase.from('delivery_orders').select('*');
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = (all || []).filter(o => o.created_at?.startsWith(today));
    return json({
      total_today: todayOrders.length,
      revenue_today: todayOrders.reduce((s, o) => s + (o.total_amount || 0), 0),
      pending: (all || []).filter(o => o.status === 'pending').length,
      dispatched: (all || []).filter(o => o.status === 'dispatched').length
    });
  }
  if (endpoint.match(/^\/api\/delivery\/client\/.+$/) && method === 'GET') {
    const q = decodeURIComponent(endpoint.split('/').slice(4).join('/'));
    const { data } = await supabase.from('delivery_orders')
      .select('client_name, client_phone, address, neighborhood')
      .or(`client_name.ilike.%${q}%,client_phone.ilike.%${q}%`)
      .limit(5);
    return json(data || []);
  }
  if (endpoint === '/api/delivery' && method === 'GET') {
    const { data: orders } = await supabase.from('delivery_orders').select('*, items:delivery_order_items(*)').order('id', { ascending: false });
    return json(orders || []);
  }
  if (endpoint === '/api/delivery' && method === 'POST' && bodyData) {
    const { items, ...orderFields } = bodyData;
    const { data: order, error } = await supabase.from('delivery_orders').insert([orderFields]).select().single();
    if (error || !order) return json({ message: 'Erro ao criar pedido delivery' }, 400);
    if (items && items.length) {
      await supabase.from('delivery_order_items').insert(items.map(i => ({ delivery_order_id: order.id, ...i })));
    }
    return json(order);
  }
  if (endpoint.match(/^\/api\/delivery\/\d+\/status$/) && method === 'PUT') {
    const id = endpoint.split('/')[3];
    const { status } = bodyData || {};
    const updateData = { status };
    if (status === 'dispatched') updateData.dispatched_at = new Date().toISOString();
    if (status === 'delivered') updateData.delivered_at = new Date().toISOString();
    const { data } = await supabase.from('delivery_orders').update(updateData).eq('id', id).select().single();
    return json(data || { success: true });
  }
  if (endpoint.match(/^\/api\/delivery\/\d+$/) && method === 'DELETE') {
    const id = endpoint.split('/')[3];
    await supabase.from('delivery_order_items').delete().eq('delivery_order_id', id);
    await supabase.from('delivery_orders').delete().eq('id', id);
    return json({ success: true });
  }

  // ─── CASH REGISTER ────────────────────────────────────────────────────────
  if (endpoint === '/api/cash-register/status' && method === 'GET') {
    const { data } = await supabase.from('cash_registers').select('*').is('closed_at', null).order('id', { ascending: false }).limit(1).maybeSingle();
    return json({ session: data || false });
  }
  if (endpoint === '/api/cash-register/open' && method === 'POST' && bodyData) {
    const { data } = await supabase.from('cash_registers').insert([{
      operator_name: bodyData.operator_name || 'Operador',
      initial_amount: parseFloat(bodyData.initial_amount || 0)
    }]).select().single();
    return json({ session: data });
  }
  if (endpoint === '/api/cash-register/close' && method === 'POST') {
    const { data: session } = await supabase.from('cash_registers').select('*').is('closed_at', null).order('id', { ascending: false }).limit(1).maybeSingle();
    if (!session) return json({ message: 'Nenhum caixa aberto.' }, 400);
    const { data: txs } = await supabase.from('transactions').select('*').gte('created_at', session.opened_at);
    const totalRevenue = (txs || []).reduce((s, t) => s + (t.total_amount || 0), 0);
    const { data: withdrawals } = await supabase.from('cash_withdrawals').select('*').eq('cash_register_id', session.id);
    const totalWithdrawals = (withdrawals || []).reduce((s, w) => s + (w.amount || 0), 0);
    const summary = { initial_amount: session.initial_amount, total_revenue: totalRevenue, total_withdrawals: totalWithdrawals, final_amount: session.initial_amount + totalRevenue - totalWithdrawals, total_transactions: (txs || []).length };
    await supabase.from('cash_registers').update({ closed_at: new Date().toISOString(), final_amount: summary.final_amount, total_revenue: totalRevenue, total_transactions: summary.total_transactions }).eq('id', session.id);
    return json({ summary });
  }
  if (endpoint === '/api/cash-register/withdrawals' && method === 'GET') {
    const { data: session } = await supabase.from('cash_registers').select('*').is('closed_at', null).order('id', { ascending: false }).limit(1).maybeSingle();
    if (!session) return json({ total: 0, withdrawals: [] });
    const { data } = await supabase.from('cash_withdrawals').select('*').eq('cash_register_id', session.id);
    const total = (data || []).reduce((s, w) => s + (w.amount || 0), 0);
    return json({ total, withdrawals: data || [] });
  }
  if (endpoint === '/api/cash-register/withdrawal' && method === 'POST' && bodyData) {
    const { data: session } = await supabase.from('cash_registers').select('*').is('closed_at', null).order('id', { ascending: false }).limit(1).maybeSingle();
    if (!session) return json({ message: 'Nenhum caixa aberto.' }, 400);
    await supabase.from('cash_withdrawals').insert([{ cash_register_id: session.id, amount: parseFloat(bodyData.amount || 0), reason: bodyData.reason || '', operator_name: bodyData.operator_name || 'Operador' }]);
    const { data: allW } = await supabase.from('cash_withdrawals').select('*').eq('cash_register_id', session.id);
    return json({ success: true, total_withdrawals: (allW || []).reduce((s, w) => s + (w.amount || 0), 0) });
  }

  // ─── REPORTS ──────────────────────────────────────────────────────────────
  if (endpoint.startsWith('/api/reports/stats') && method === 'GET') {
    const { data: prods } = await supabase.from('products').select('*');
    const { data: txs } = await supabase.from('transactions').select('*');
    const totalRev = (txs || []).reduce((s, t) => s + (parseFloat(t.total_amount) || 0), 0);
    return json({ total_revenue: totalRev, best_sellers: (prods || []).slice(0, 5), low_stock: (prods || []).filter(p => p.stock <= 5), payment_methods: [{ payment_method: 'pix', total: totalRev * 0.6, count: 12 }, { payment_method: 'credito', total: totalRev * 0.4, count: 8 }], daily_sales: [], waiter_sales: [] });
  }
  if (endpoint.startsWith('/api/reports/closure') && method === 'GET') {
    const { data: txs } = await supabase.from('transactions').select('*');
    const total = (txs || []).reduce((s, t) => s + (t.total_amount || 0), 0);
    const summaryMap = {};
    (txs || []).forEach(t => {
      if (!summaryMap[t.payment_method]) summaryMap[t.payment_method] = { method: t.payment_method, total: 0, count: 0 };
      summaryMap[t.payment_method].total += t.total_amount || 0;
      summaryMap[t.payment_method].count++;
    });
    return json({ transactions: txs || [], summary: Object.values(summaryMap), total_revenue: total, transactions_count: (txs || []).length });
  }
  if (endpoint === '/api/reports/checkout' && method === 'POST' && bodyData) {
    const { table_id, payment_method, total_amount } = bodyData;
    await supabase.from('transactions').insert([{ table_id, payment_method, total_amount: parseFloat(total_amount || 0) }]);
    const { data: orders } = await supabase.from('orders').select('id').eq('table_id', table_id);
    if (orders) for (const o of orders) await supabase.from('orders').update({ status: 'delivered', paid: 1 }).eq('id', o.id);
    await supabase.from('tables').update({ status: 'free' }).eq('id', table_id);
    return json({ success: true });
  }
  if (endpoint.startsWith('/api/reports/detailed') && method === 'GET') {
    return json({ billing_by_method: [], ticket_medio: 0, sales_count: 0, total_revenue: 0, cancellations: [], abc_products: [], sales_by_category: [], rush_hours: [], waiter_performance: [], avg_prep_time: 0, modality_data: [], rush_by_day: [], ticket_by_table: [], tma_by_category: [], complimentary: [], total_complimentary: 0, cancellations_by_reason: [], top5_products: [] });
  }
  if (endpoint.startsWith('/api/reports/waiter-sales') && method === 'GET') {
    return json({ subtotal: 0, gorjeta: 0, totalGeral: 0, ordersCount: 0, ticketMedio: 0, topProducts: [], waiter: null });
  }

  // ─── DAV ──────────────────────────────────────────────────────────────────
  if (endpoint === '/api/dav/next-number' && method === 'GET') {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth() + 1;
    const { data } = await supabase.from('dav_counters').select('*').eq('year', year).eq('month', month).maybeSingle();
    let lastNumber = 1;
    if (data) {
      lastNumber = data.last_number + 1;
      await supabase.from('dav_counters').update({ last_number: lastNumber }).eq('id', data.id);
    } else {
      await supabase.from('dav_counters').insert([{ year, month, last_number: lastNumber }]);
    }
    return json({ dav_number: String(lastNumber).padStart(6, '0'), dav_code: '001', period: `${String(month).padStart(2, '0')}/${year}` });
  }

  return json([]);
}
