import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

// In production, use VITE_API_URL env var if set. Otherwise fallback to current origin in PROD or local server in DEV.
export const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : `http://${window.location.hostname}:3001`);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('restaurant_token'));

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          // Token expired or invalid
          logout();
        }
      } catch (error) {
        console.error('Erro ao autenticar sessão ativa:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [token]);

  const login = async (username, password) => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao efetuar login.');
    }

    localStorage.setItem('restaurant_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('restaurant_token');
    setToken(null);
    setUser(null);
  };

  // Helper for performing authenticated HTTP requests
  const apiFetch = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Allow multipart/form-data for file uploads (Multer)
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401 || response.status === 403) {
      // Auto-logout if session is terminated
      logout();
    }

    // Expose license block info for callers to handle
    if (response.status === 402) {
      const clonedResponse = response.clone();
      try {
        const data = await clonedResponse.json();
        if (data.bloqueado) {
          window.__LICENSE_BLOCKED__ = true;
        }
      } catch (_) {}
    } else {
      window.__LICENSE_BLOCKED__ = false;
    }

    return response;
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
