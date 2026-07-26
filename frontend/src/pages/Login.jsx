import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LogIn, User, Lock, AlertCircle, Utensils } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      const user = await login(username, password);
      // Redireciona para o painel correto baseado no cargo
      switch (user.role) {
        case 'admin': navigate('/admin'); break;
        case 'waiter': navigate('/garcom'); break;
        case 'kitchen': navigate('/cozinha'); break;
        case 'cashier': navigate('/caixa'); break;
        default: navigate('/');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Falha na autenticação. Verifique seu usuário e senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-dark-bg px-4 py-12 transition-colors duration-200">
      <div className="max-w-md w-full space-y-8">
        
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/20 mb-4">
            <Utensils className="h-7 w-7" />
          </div>
          <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-dark-text tracking-tight">
            Acesso ao Sistema
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-dark-muted">
            Gerenciador de Pedidos & Cardápio Chef
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-white dark:bg-dark-card border border-zinc-200 dark:border-dark-border p-8 rounded-2xl shadow-xl">
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {error && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center space-x-3 text-sm">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-dark-text mb-2">
                Usuário
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                  <User className="h-5 w-5" />
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition duration-200 text-sm"
                  placeholder="Seu usuário"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-dark-text mb-2">
                Senha
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-zinc-200 dark:border-dark-border rounded-xl bg-zinc-50 dark:bg-dark-element text-zinc-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition duration-200 text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-brand-500/20 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? 'Autenticando...' : 'Entrar'}
              </button>
            </div>
          </form>

          {/* Seed accounts hint card */}
          <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-dark-border text-center">
            <h4 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
              Credenciais de Teste
            </h4>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="bg-zinc-50 dark:bg-dark-element border border-zinc-150 dark:border-dark-border/50 p-2 rounded-lg">
                <span className="font-semibold text-zinc-600 dark:text-dark-muted block">Admin</span>
                <span className="text-zinc-500 dark:text-dark-text">admin / admin123</span>
              </div>
              <div className="bg-zinc-50 dark:bg-dark-element border border-zinc-150 dark:border-dark-border/50 p-2 rounded-lg">
                <span className="font-semibold text-zinc-600 dark:text-dark-muted block">Garçom</span>
                <span className="text-zinc-500 dark:text-dark-text">garcom / garcom123</span>
              </div>
              <div className="bg-zinc-50 dark:bg-dark-element border border-zinc-150 dark:border-dark-border/50 p-2 rounded-lg">
                <span className="font-semibold text-zinc-600 dark:text-dark-muted block">Cozinha</span>
                <span className="text-zinc-500 dark:text-dark-text">cozinha / cozinha123</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
