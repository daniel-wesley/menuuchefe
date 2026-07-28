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
        (payload) => {
          const callbacks = eventListeners.get('order_status_changed') || [];
          callbacks.forEach(cb => cb(payload.new));

          if (payload.eventType === 'INSERT') {
            const newOrderCallbacks = eventListeners.get('new_order') || [];
            newOrderCallbacks.forEach(cb => cb(payload.new));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        (payload) => {
          const callbacks = eventListeners.get('table_status_changed') || [];
          callbacks.forEach(cb => cb(payload.new));
        }
      )
      .subscribe();

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
