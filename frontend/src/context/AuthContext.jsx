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
    const { data: dbUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error || !dbUser) {
      throw new Error('Usuário ou senha incorretos.');
    }

    const defaultPasswords = {
      admin: 'admin123',
      garcom: 'garcom123',
      garcom1: 'garcom123',
      cozinha: 'cozinha123',
      caixa: 'caixa123'
    };

    const expectedPass = defaultPasswords[username];
    if (expectedPass && password !== expectedPass) {
      throw new Error('Usuário ou senha incorretos.');
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

// Handler de fallback para consultar Supabase diretamente
async function handleSupabaseFallback(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  let bodyData = null;
  if (options.body && typeof options.body === 'string') {
    try { bodyData = JSON.parse(options.body); } catch (_) {}
  }

  // GET /api/tables
  if (endpoint.startsWith('/api/tables') && method === 'GET') {
    const { data } = await supabase.from('tables').select('*').order('number');
    return new Response(JSON.stringify(data || []), { status: 200 });
  }

  // GET /api/products
  if (endpoint.startsWith('/api/products') && method === 'GET') {
    const { data } = await supabase.from('products').select('*');
    return new Response(JSON.stringify(data || []), { status: 200 });
  }

  // GET /api/categories
  if (endpoint.startsWith('/api/categories') && method === 'GET') {
    const { data } = await supabase.from('categories').select('*').order('sort_order');
    return new Response(JSON.stringify(data || []), { status: 200 });
  }

  // GET /api/orders
  if (endpoint.startsWith('/api/orders') && method === 'GET') {
    const { data: orders } = await supabase.from('orders').select('*').order('id', { ascending: false });
    if (orders) {
      for (const o of orders) {
        const { data: items } = await supabase.from('order_items').select('*, product:products(name, price)').eq('order_id', o.id);
        o.items = (items || []).map(i => ({ ...i, name: i.product?.name || 'Item' }));
      }
    }
    return new Response(JSON.stringify(orders || []), { status: 200 });
  }

  // POST /api/orders
  if (endpoint === '/api/orders' && method === 'POST' && bodyData) {
    const { table_id, client_name, items } = bodyData;
    const { data: order, error } = await supabase
      .from('orders')
      .insert([{ table_id, client_name, total_amount: 0, status: 'received' }])
      .select()
      .single();

    if (error || !order) {
      return new Response(JSON.stringify({ message: 'Erro ao criar pedido' }), { status: 400 });
    }

    let total = 0;
    if (items && items.length) {
      for (const item of items) {
        const { data: prod } = await supabase.from('products').select('price').eq('id', item.product_id).single();
        const price = prod ? prod.price : 0;
        total += price * item.quantity;
        await supabase.from('order_items').insert([{
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price,
          notes: item.notes
        }]);
      }
      await supabase.from('orders').update({ total_amount: total }).eq('id', order.id);
      order.total_amount = total;
    }

    await supabase.from('tables').update({ status: 'occupied' }).eq('id', table_id);
    order.items = items || [];
    return new Response(JSON.stringify(order), { status: 200 });
  }

  // PUT /api/orders/:id/status
  if (endpoint.includes('/api/orders/') && endpoint.includes('/status') && method === 'PUT') {
    const parts = endpoint.split('/');
    const orderId = parts[3];
    const { status } = bodyData || {};
    await supabase.from('orders').update({ status }).eq('id', orderId);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  // PUT /api/tables/:id/status
  if (endpoint.includes('/api/tables/') && endpoint.includes('/status') && method === 'PUT') {
    const parts = endpoint.split('/');
    const tableId = parts[3];
    const { status } = bodyData || {};
    await supabase.from('tables').update({ status }).eq('id', tableId);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  return new Response(JSON.stringify([]), { status: 200 });
}
