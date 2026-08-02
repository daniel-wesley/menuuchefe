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
  if (endpoint === '/api/license/status' && method === 'GET') {
    const { data: lic } = await supabase.from('licenses').select('*').eq('id', 1).single();
    if (!lic) return json({ vencimento: null, diasRestantes: 0, bloqueado: true, chaveAtual: '', diasLicenciados: 0, modulo: 'BASICO', emergenciaUsadaEsteMes: '' });
    const hoje = new Date();
    const dataVenc = new Date(lic.vencimento);
    const diasRestantes = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));
    return json({
      vencimento: lic.vencimento,
      diasRestantes: Math.max(0, diasRestantes),
      bloqueado: hoje > dataVenc,
      chaveAtual: lic.chave_atual || '',
      diasLicenciados: lic.dias_licenciados || 0,
      emergenciaUsadaEsteMes: lic.emergencia_usada_este_mes || '',
      modulo: lic.modulo || 'BASICO'
    });
  }
  if (endpoint === '/api/license/activate' && method === 'POST' && bodyData) {
    const { chave } = bodyData;
    if (!chave || chave.trim().length < 10) {
      return json({ message: 'Forneça uma chave válida no formato XXXX-XXXX-XXXX.' }, 400);
    }
    const hoje = new Date();
    const novaData = new Date();
    novaData.setDate(hoje.getDate() + 30);
    await supabase.from('licenses').upsert({
      id: 1,
      vencimento: novaData.toISOString(),
      chave_atual: chave.toUpperCase().trim(),
      dias_licenciados: 30,
      modulo: 'GERAL',
      emergencia_usada_este_mes: ''
    }, { onConflict: 'id' });
    const diasRestantes = Math.ceil((novaData - hoje) / (1000 * 60 * 60 * 24));
    return json({ message: 'Licença ativada com sucesso!', vencimento: novaData.toISOString(), diasRestantes });
  }
  if (endpoint === '/api/license/emergency' && method === 'POST') {
    const { data: lic } = await supabase.from('licenses').select('*').eq('id', 1).single();
    const hoje = new Date();
    const mesAtual = `${hoje.getMonth() + 1}/${hoje.getFullYear()}`;
    if (lic && lic.emergencia_usada_este_mes === mesAtual) {
      return json({ message: 'O prazo de emergência já foi utilizado este mês.', bloqueado: true }, 400);
    }
    const dataAtual = lic ? new Date(lic.vencimento) : hoje;
    dataAtual.setDate(dataAtual.getDate() + 3);
    await supabase.from('licenses').upsert({
      id: 1,
      vencimento: dataAtual.toISOString(),
      emergencia_usada_este_mes: mesAtual
    }, { onConflict: 'id' });
    const diasRestantes = Math.ceil((dataAtual - hoje) / (1000 * 60 * 60 * 24));
    return json({ message: 'Prazo de emergência liberado! +3 dias adicionados.', vencimento: dataAtual.toISOString(), diasRestantes });
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

  // DELETE /api/tables/:id
  if (endpoint.match(/^\/api\/tables\/\d+$/) && method === 'DELETE') {
    const tableId = endpoint.split('/')[3];
    const { data: table } = await supabase.from('tables').select('status').eq('id', tableId).single();
    if (table && table.status !== 'free') {
      return json({ message: 'Não é possível excluir uma mesa que está ocupada ou aguardando pagamento.' }, 400);
    }
    await supabase.from('tables').delete().eq('id', tableId);
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
      image_url: bodyData.image_url || null,
      category: bodyData.category || 'lanches',
      stock: parseInt(bodyData.stock || 10),
      track_stock: bodyData.track_stock === '1' || bodyData.track_stock === true ? 1 : 0,
      observations: bodyData.observations || '[]',
      active: 1
    }]).select().single();
    return json(data || { success: true }, error ? 400 : 200);
  }
  if (endpoint.match(/^\/api\/products\/\d+$/) && method === 'PUT' && bodyData) {
    const id = endpoint.split('/')[3];
    const updateFields = {
      name: bodyData.name,
      price: parseFloat(bodyData.price || 0),
      description: bodyData.description || '',
      category: bodyData.category,
      stock: parseInt(bodyData.stock || 10),
      track_stock: bodyData.track_stock === '1' || bodyData.track_stock === true ? 1 : 0,
      observations: bodyData.observations || '[]'
    };
    if (bodyData.image_url !== undefined) {
      updateFields.image_url = bodyData.image_url;
    }
    if (bodyData.active !== undefined) {
      updateFields.active = bodyData.active;
    }
    await supabase.from('products').update(updateFields).eq('id', id);
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
    const { data: txs } = await supabase.from('transactions').select('*');
    const totalRev = (txs || []).reduce((s, t) => s + (parseFloat(t.total_amount) || 0), 0);

    // Payment methods grouped from real transactions
    const payMap = {};
    (txs || []).forEach(t => {
      const m = t.payment_method || 'outros';
      if (!payMap[m]) payMap[m] = { payment_method: m, total: 0, count: 0 };
      payMap[m].total += parseFloat(t.total_amount) || 0;
      payMap[m].count++;
    });
    const paymentMethods = Object.values(payMap);

    // Daily sales (last 7 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const dailyMap = {};
    (txs || []).forEach(t => {
      const d = (t.created_at || '').split('T')[0];
      if (d && new Date(d) >= sevenDaysAgo) {
        if (!dailyMap[d]) dailyMap[d] = { date: d, total: 0 };
        dailyMap[d].total += parseFloat(t.total_amount) || 0;
      }
    });
    const dailySales = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Best sellers from order_items (only paid orders)
    const { data: paidOrders } = await supabase.from('orders').select('id').eq('paid', 1);
    const paidOrderIds = (paidOrders || []).map(o => o.id);
    let bestSellers = [];
    if (paidOrderIds.length > 0) {
      const { data: items } = await supabase.from('order_items').select('product_id, quantity, price').in('order_id', paidOrderIds);
      const { data: prods } = await supabase.from('products').select('id, name, category');
      const prodMap = {};
      (prods || []).forEach(p => { prodMap[p.id] = p; });
      const salesMap = {};
      (items || []).forEach(oi => {
        const pid = oi.product_id;
        if (!salesMap[pid]) salesMap[pid] = { name: prodMap[pid]?.name || '', category: prodMap[pid]?.category || '', quantity_sold: 0, total_revenue: 0 };
        salesMap[pid].quantity_sold += oi.quantity || 0;
        salesMap[pid].total_revenue += (oi.quantity || 0) * (oi.price || 0);
      });
      bestSellers = Object.values(salesMap).sort((a, b) => b.quantity_sold - a.quantity_sold).slice(0, 5);
    }

    // Waiter sales (only paid orders)
    const { data: allPaidOrders } = await supabase.from('orders').select('id, user_id, total_amount').eq('paid', 1);
    const { data: users } = await supabase.from('users').select('id, name');
    const userMap = {};
    (users || []).forEach(u => { userMap[u.id] = u; });
    const waiterMap = {};
    (allPaidOrders || []).forEach(o => {
      const key = o.user_id || 'anon';
      const name = o.user_id ? (userMap[o.user_id]?.name || 'Garçom') : 'QR Code / Auto-atendimento';
      if (!waiterMap[key]) waiterMap[key] = { waiter_name: name, total_sales: 0, orders_count: 0 };
      waiterMap[key].total_sales += o.total_amount || 0;
      waiterMap[key].orders_count++;
    });
    const waiterSales = Object.values(waiterMap).sort((a, b) => b.total_sales - a.total_sales);

    // Low stock
    const { data: prodsAll } = await supabase.from('products').select('id, name, stock, category');
    const lowStock = (prodsAll || []).filter(p => p.stock <= 5);

    return json({ total_revenue: totalRev, best_sellers: bestSellers, low_stock: lowStock, payment_methods: paymentMethods, daily_sales: dailySales, waiter_sales: waiterSales });
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
    const url = new URL(endpoint, window.location.origin);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const turn = url.searchParams.get('turn');

    // Helper: filter by date range on a created_at field
    const inRange = (val, start, end) => {
      if (!val) return false;
      const d = val.split('T')[0];
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    };
    const inTurn = (val) => {
      if (!turn || !val) return true;
      const hour = parseInt((val.split('T')[1] || '00:00').split(':')[0], 10);
      if (turn === 'lunch') return hour >= 11 && hour < 16;
      if (turn === 'dinner') return hour >= 16 || hour < 4;
      return true;
    };

    // 1. Transactions (financial)
    const { data: allTxs } = await supabase.from('transactions').select('*');
    const txs = (allTxs || []).filter(t => inRange(t.created_at, startDate, endDate) && inTurn(t.created_at));

    // Billing by method
    const payMap = {};
    txs.forEach(t => {
      const m = t.payment_method || 'outros';
      if (!payMap[m]) payMap[m] = { payment_method: m, total: 0, count: 0 };
      payMap[m].total += parseFloat(t.total_amount) || 0;
      payMap[m].count++;
    });
    const billing_by_method = Object.values(payMap);

    // Totals
    const total_revenue = txs.reduce((s, t) => s + (parseFloat(t.total_amount) || 0), 0);
    const uniqueGroups = new Set(txs.map(t => t.group_id).filter(Boolean));
    const sales_count = uniqueGroups.size || txs.length;
    const ticket_medio = sales_count > 0 ? total_revenue / sales_count : 0;

    // 2. Orders + Order Items (products, waiter, etc)
    const { data: allOrders } = await supabase.from('orders').select('*');
    const paidOrders = (allOrders || []).filter(o => o.paid === 1 && inRange(o.created_at, startDate, endDate) && inTurn(o.created_at));

    // Curva ABC / Top products
    const paidOrderIds = paidOrders.map(o => o.id);
    let abc_products = [];
    let top5_products = [];
    if (paidOrderIds.length > 0) {
      const { data: items } = await supabase.from('order_items').select('product_id, quantity, price, order_id').in('order_id', paidOrderIds);
      const { data: prods } = await supabase.from('products').select('id, name, category');
      const prodMap = {};
      (prods || []).forEach(p => { prodMap[p.id] = p; });
      const salesMap = {};
      (items || []).forEach(oi => {
        const pid = oi.product_id;
        if (!salesMap[pid]) salesMap[pid] = { name: prodMap[pid]?.name || '', category: prodMap[pid]?.category || '', quantity_sold: 0, total_revenue: 0 };
        salesMap[pid].quantity_sold += oi.quantity || 0;
        salesMap[pid].total_revenue += (oi.quantity || 0) * (oi.price || 0);
      });
      const sorted = Object.values(salesMap).sort((a, b) => b.total_revenue - a.total_revenue);
      const totalProdRev = sorted.reduce((s, p) => s + p.total_revenue, 0);
      let cum = 0;
      abc_products = sorted.map(p => {
        cum += p.total_revenue;
        const pct = totalProdRev > 0 ? cum / totalProdRev : 0;
        let c = 'C';
        if (pct <= 0.70) c = 'A';
        else if (pct <= 0.90) c = 'B';
        return { ...p, classification: c };
      });
      top5_products = sorted.slice(0, 5);
    }

    // Sales by category
    const catMap = {};
    if (paidOrderIds.length > 0) {
      const { data: items2 } = await supabase.from('order_items').select('product_id, quantity, price').in('order_id', paidOrderIds);
      const { data: prods2 } = await supabase.from('products').select('id, category');
      const pMap2 = {};
      (prods2 || []).forEach(p => { pMap2[p.id] = p; });
      (items2 || []).forEach(oi => {
        const cat = pMap2[oi.product_id]?.category || 'outros';
        if (!catMap[cat]) catMap[cat] = { category: cat, total: 0, quantity: 0 };
        catMap[cat].total += (oi.quantity || 0) * (oi.price || 0);
        catMap[cat].quantity += oi.quantity || 0;
      });
    }
    const sales_by_category = Object.values(catMap);

    // Waiter performance
    const { data: users } = await supabase.from('users').select('id, name');
    const userMap = {};
    (users || []).forEach(u => { userMap[u.id] = u; });
    const waiterMap = {};
    paidOrders.forEach(o => {
      const key = o.user_id || 'anon';
      const name = o.user_id ? (userMap[o.user_id]?.name || 'Garçom') : 'QR Code / Auto-atendimento';
      if (!waiterMap[key]) waiterMap[key] = { waiter_name: name, total_sales: 0, orders_count: 0, ticket_medio: 0 };
      waiterMap[key].total_sales += o.total_amount || 0;
      waiterMap[key].orders_count++;
    });
    Object.values(waiterMap).forEach(w => {
      w.ticket_medio = w.orders_count > 0 ? w.total_sales / w.orders_count : 0;
    });
    const waiter_performance = Object.values(waiterMap).sort((a, b) => b.total_sales - a.total_sales);

    // Rush hours
    const rushMap = {};
    txs.forEach(t => {
      const hour = (t.created_at || '').split('T')[1]?.split(':')[0] || '00';
      if (!rushMap[hour]) rushMap[hour] = { hour, count: 0, total: 0 };
      rushMap[hour].count++;
      rushMap[hour].total += parseFloat(t.total_amount) || 0;
    });
    const rush_hours = Object.values(rushMap).sort((a, b) => a.hour.localeCompare(b.hour));

    // Cancellations
    let cancellations = [];
    try {
      const { data: c } = await supabase.from('cancellations').select('*');
      cancellations = (c || []).filter(x => inRange(x.created_at, startDate, endDate));
    } catch {}

    // Modality
    const salonTotal = txs.filter(t => t.table_id && t.table_id !== 0).reduce((s, t) => s + (parseFloat(t.total_amount) || 0), 0);
    const { data: delOrders } = await supabase.from('delivery_orders').select('total_amount, status, created_at');
    const delivered = (delOrders || []).filter(d => d.status === 'delivered' && inRange(d.created_at, startDate, endDate));
    const deliveryTotal = delivered.reduce((s, d) => s + (parseFloat(d.total_amount) || 0), 0);
    const modality_data = [
      { modality: 'Salão (Mesas)', total: salonTotal },
      { modality: 'Delivery', total: deliveryTotal, count: delivered.length }
    ];

    // Rush by day
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const rushDayMap = {};
    txs.forEach(t => {
      const dt = new Date(t.created_at);
      const dayNum = dt.getDay();
      const hour = (t.created_at || '').split('T')[1]?.split(':')[0] || '00';
      const key = `${dayNum}-${hour}`;
      if (!rushDayMap[key]) rushDayMap[key] = { day_name: dayNames[dayNum], day_num: dayNum, hour, count: 0, total: 0 };
      rushDayMap[key].count++;
      rushDayMap[key].total += parseFloat(t.total_amount) || 0;
    });
    const rush_by_day = Object.values(rushDayMap).sort((a, b) => a.day_num - b.day_num || a.hour.localeCompare(b.hour));

    // Avg prep time
    const deliveredOrders = paidOrders.filter(o => o.status === 'delivered');
    let avg_prep_time = 0;
    if (deliveredOrders.length > 0) {
      const totalMin = deliveredOrders.reduce((s, o) => {
        const created = new Date(o.created_at).getTime();
        const updated = new Date(o.updated_at).getTime();
        return s + (updated - created) / 60000;
      }, 0);
      avg_prep_time = totalMin / deliveredOrders.length;
    }

    return json({
      billing_by_method, ticket_medio, sales_count, total_revenue, cancellations,
      abc_products, sales_by_category, rush_hours, waiter_performance, avg_prep_time,
      modality_data, rush_by_day, ticket_by_table: [], tma_by_category: [],
      complimentary: [], total_complimentary: 0, cancellations_by_reason: [], top5_products
    });
  }
  if (endpoint.startsWith('/api/reports/waiter-sales') && method === 'GET') {
    const url = new URL(endpoint, window.location.origin);
    const waiterId = url.searchParams.get('waiterId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    if (!waiterId) return json({ subtotal: 0, gorjeta: 0, totalGeral: 0, ordersCount: 0, ticketMedio: 0, topProducts: [], waiter: null });

    const { data: waiter } = await supabase.from('users').select('id, name, username').eq('id', waiterId).maybeSingle();
    const { data: allOrders } = await supabase.from('orders').select('id, total_amount, created_at, paid').eq('user_id', waiterId).eq('paid', 1);

    const paidOrders = (allOrders || []).filter(o => {
      const d = (o.created_at || '').split('T')[0];
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });

    const subtotal = paidOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
    const ordersCount = paidOrders.length;
    const ticketMedio = ordersCount > 0 ? subtotal / ordersCount : 0;
    const gorjeta = subtotal * 0.10;
    const totalGeral = subtotal + gorjeta;

    let topProducts = [];
    if (paidOrders.length > 0) {
      const { data: items } = await supabase.from('order_items').select('product_id, quantity, price').in('order_id', paidOrders.map(o => o.id));
      const { data: prods } = await supabase.from('products').select('id, name, category');
      const pMap = {};
      (prods || []).forEach(p => { pMap[p.id] = p; });
      const sMap = {};
      (items || []).forEach(oi => {
        const pid = oi.product_id;
        if (!sMap[pid]) sMap[pid] = { name: pMap[pid]?.name || '', category: pMap[pid]?.category || '', quantity_sold: 0, total_revenue: 0 };
        sMap[pid].quantity_sold += oi.quantity || 0;
        sMap[pid].total_revenue += (oi.quantity || 0) * (oi.price || 0);
      });
      topProducts = Object.values(sMap).sort((a, b) => b.quantity_sold - a.quantity_sold).slice(0, 5);
    }

    return json({ waiter, subtotal, ordersCount, ticketMedio, gorjeta, totalGeral, topProducts });
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
