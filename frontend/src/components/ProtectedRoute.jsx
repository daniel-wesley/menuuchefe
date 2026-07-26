import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import Login from '../pages/Login.jsx';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-dark-bg transition-colors duration-200">
        <RefreshCw className="h-8 w-8 text-brand-500 animate-spin" />
        <p className="mt-4 text-zinc-500 dark:text-dark-muted font-medium">Carregando sistema...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-dark-bg p-4 transition-colors duration-200">
        <div className="max-w-md w-full text-center bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-8 rounded-2xl shadow-xl">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 mb-6">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-dark-text tracking-tight mb-2">Acesso Negado</h1>
          <p className="text-zinc-600 dark:text-dark-muted mb-6">
            Sua conta atual ({user.name}) não possui permissão para acessar este painel.
          </p>
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => window.location.href = '/'}
              className="w-full py-3 px-4 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-500/20 duration-200"
            >
              Voltar ao Início
            </button>
            <button
              onClick={logout}
              className="w-full py-3 px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-700 dark:text-dark-text font-semibold rounded-xl transition-all duration-200"
            >
              Fazer Login com Outro Usuário
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
