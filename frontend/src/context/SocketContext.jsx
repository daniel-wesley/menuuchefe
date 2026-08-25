import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth, API_BASE } from './AuthContext.jsx';
import { supabase } from '../lib/supabase.js';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    let ioSocket = null;
    try {
      if (API_BASE) {
        ioSocket = io(API_BASE, { autoConnect: false, timeout: 3000 });
        ioSocket.connect();
      }
    } catch (_) {}

    // Configurar o Supabase Realtime para notificar pedidos e mesas em tempo real no Netlify
    const eventListeners = new Map();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async (payload) => {
          if (payload.new) {
            const callbacks = eventListeners.get('order_status_changed') || [];
            callbacks.forEach(cb => cb(payload.new));
          }

          if (payload.eventType === 'INSERT' && payload.new) {
            const orderRow = payload.new;
            try {
              const { data: items } = await supabase
                .from('order_items')
                .select('*, product:products(name, price)')
                .eq('order_id', orderRow.id);
              const { data: tableData } = await supabase
                .from('tables')
                .select('number')
                .eq('id', orderRow.table_id)
                .single();
              const enrichedOrder = {
                ...orderRow,
                table_number: tableData?.number || '?',
                items: (items || []).map(i => ({ ...i, name: i.product?.name || i.name || 'Item' }))
              };
              const newOrderCallbacks = eventListeners.get('order_received') || [];
              newOrderCallbacks.forEach(cb => cb(enrichedOrder));
            } catch (err) {
              const newOrderCallbacks = eventListeners.get('order_received') || [];
              newOrderCallbacks.forEach(cb => cb({ ...orderRow, table_number: '?', items: [] }));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        (payload) => {
          if (payload.new) {
            const callbacks = eventListeners.get('table_status_changed') || [];
            callbacks.forEach(cb => cb(payload.new));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_orders' },
        async (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const deliveryRow = payload.new;
            try {
              const { data: items } = await supabase
                .from('delivery_order_items')
                .select('*')
                .eq('delivery_order_id', deliveryRow.id);
              const enriched = {
                ...deliveryRow,
                is_delivery: true,
                table_number: 'Delivery',
                items: (items || []).map(it => ({ ...it, name: it.product_name || it.name || 'Item' }))
              };
              const cbs = eventListeners.get('delivery_order_created') || [];
              cbs.forEach(cb => cb(enriched));
            } catch (err) {
              const cbs = eventListeners.get('delivery_order_created') || [];
              cbs.forEach(cb => cb({ ...deliveryRow, is_delivery: true, table_number: 'Delivery', items: [] }));
            }
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const cbs = eventListeners.get('delivery_order_updated') || [];
            cbs.forEach(cb => cb({ ...payload.new, is_delivery: true, table_number: 'Delivery' }));
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const cbs = eventListeners.get('delivery_order_deleted') || [];
            cbs.forEach(cb => cb({ id: payload.old.id }));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Supabase Realtime conectado com sucesso!');
        }
      });

    const unifiedSocket = {
      emit: (event, data) => {
        if (ioSocket && ioSocket.connected) {
          ioSocket.emit(event, data);
        }
      },
      on: (event, callback) => {
        if (ioSocket) ioSocket.on(event, callback);
        if (!eventListeners.has(event)) eventListeners.set(event, []);
        eventListeners.get(event).push(callback);
      },
      off: (event, callback) => {
        if (ioSocket) ioSocket.off(event, callback);
        if (eventListeners.has(event)) {
          const list = eventListeners.get(event).filter(cb => cb !== callback);
          eventListeners.set(event, list);
        }
      }
    };

    setSocket(unifiedSocket);

    return () => {
      if (ioSocket) ioSocket.disconnect();
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (socket && user) {
      socket.emit('join_room', { role: user.role });
    }
  }, [socket, user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
