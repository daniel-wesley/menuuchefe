import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { RefreshCw } from 'lucide-react';

import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import WaiterDashboard from './pages/WaiterDashboard.jsx';
import KitchenDashboard from './pages/KitchenDashboard.jsx';
import CashierDashboard from './pages/CashierDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import DeliveryDashboard from './pages/DeliveryDashboard.jsx';
import CustomerMenu from './pages/CustomerMenu.jsx';
import CustomerCatalog from './pages/CustomerCatalog.jsx';

// Role-based landing router
function HomeRedirect() {
  const { user, loading } = useAuth();

  // Aguarda o contexto de autenticação carregar antes de redirecionar
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-dark-bg">
        <RefreshCw className="h-8 w-8 text-brand-500 animate-spin" />
        <p className="mt-4 text-zinc-500 dark:text-dark-muted font-medium">Carregando sistema...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redireciona cada perfil para seu painel correspondente
  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'waiter':
      return <Navigate to="/garcom" replace />;
    case 'kitchen':
      return <Navigate to="/cozinha" replace />;
    case 'cashier':
      return <Navigate to="/caixa" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <CartProvider>
            <Routes>
              {/* Home redirecting route */}
              <Route path="/" element={<HomeRedirect />} />
              
              {/* Login route */}
              <Route path="/login" element={<Login />} />

              {/* Staff routes protected by role permissions */}
              <Route 
                path="/garcom" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'waiter']}>
                    <WaiterDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/cozinha" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'kitchen']}>
                    <KitchenDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/caixa" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                    <CashierDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/delivery" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <DeliveryDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />

              {/* Public Client QR Self-Service menu Route */}
              <Route path="/mesa/:number" element={<CustomerMenu />} />

              {/* Public Catalog Route (read-only, no ordering) */}
              <Route path="/cardapio" element={<CustomerCatalog />} />

              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </CartProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
