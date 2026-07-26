import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth, API_BASE } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    // Connect to Socket.io backend
    const newSocket = io(API_BASE);
    setSocket(newSocket);

    console.log('Socket.io tentando conexão com o backend...');

    return () => {
      newSocket.disconnect();
      console.log('Socket.io desconectado.');
    };
  }, []);

  useEffect(() => {
    if (socket && user) {
      // Automatically register user's role room for notifications
      socket.emit('join_room', { role: user.role });
      console.log(`Socket.io registrou sala para papel: ${user.role}`);
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
