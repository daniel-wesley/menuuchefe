import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LogOut, Sun, Moon, Utensils, LayoutDashboard, ChefHat, Receipt, Settings, Bike } from 'lucide-react';

export default function Navbar() {
  const { user, logout, apiFetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [licenseModulo, setLicenseModulo] = useState('BASICO');

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Busca o módulo da licença ativa para controlar visibilidade do Delivery
  useEffect(() => {
    if (!user) return;
    apiFetch('/api/license/status')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.modulo) setLicenseModulo(data.modulo.toUpperCase());
      })
      .catch(() => {});
  }, [user]);

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'waiter': return 'Garçom';
      case 'kitchen': return 'Cozinha';
      case 'cashier': return 'Operador de Caixa';
      default: return role;
    }
  };

  // Define quais abas de navegação aparecem para cada cargo
  const getNavLinks = (role) => {
    const links = [];
    if (role === 'admin' || role === 'waiter') {
      links.push({ label: 'Garçom', path: '/garcom', icon: LayoutDashboard });
    }
    if (role === 'admin' || role === 'kitchen') {
      links.push({ label: 'Cozinha', path: '/cozinha', icon: ChefHat });
    }
    if (role === 'admin' || role === 'cashier') {
      links.push({ label: 'Caixa', path: '/caixa', icon: Receipt });
    }
    // Delivery só aparece para admins com plano GERAL
    if (role === 'admin' && licenseModulo === 'GERAL') {
      links.push({ label: 'Delivery', path: '/delivery', icon: Bike });
    }
    if (role === 'admin') {
      links.push({ label: 'Admin', path: '/admin', icon: Settings });
    }
    return links;
  };


  const navLinks = user ? getNavLinks(user.role) : [];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-dark-border bg-white/80 dark:bg-dark-card/80 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="bg-brand-500 text-white p-2 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Utensils className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-brand-500 to-amber-600 bg-clip-text text-transparent hidden sm:block">
              MenuChef
            </span>
          </div>

          {/* Navigation Links (desktop) */}
          {navLinks.length > 1 && (
            <nav className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                        : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-dark-element'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{link.label}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        {/* User Stats & Toggles */}
        <div className="flex items-center space-x-4">
          {/* Dark Mode Switcher */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-dark-element dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-all duration-200"
            aria-label="Alternar tema"
          >
            {darkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
          </button>

          {user && (
            <div className="flex items-center space-x-3 pl-2 border-l border-zinc-200 dark:border-dark-border">
              {/* User text */}
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-zinc-900 dark:text-dark-text">{user.name}</p>
                <p className="text-xs text-brand-500 dark:text-brand-400 font-medium">{getRoleLabel(user.role)}</p>
              </div>

              {/* Initials avatar */}
              <div className="h-9 w-9 rounded-xl bg-brand-100 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>

              {/* Logout button */}
              <button
                onClick={logout}
                className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200"
                title="Sair do sistema"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
