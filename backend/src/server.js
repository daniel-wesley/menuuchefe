import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import os from 'os';
import fs from 'fs';
import dotenv from 'dotenv';

import { initializeDatabase } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import tableRoutes from './routes/tableRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import userRoutes from './routes/userRoutes.js';
import cashRegisterRoutes from './routes/cashRegisterRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import lojaRoutes from './routes/lojaRoutes.js';
import licenseRoutes from './routes/licenseRoutes.js';
import globalObservationRoutes from './routes/globalObservationRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import davRoutes from './routes/davRoutes.js';
import { checkLicense, checkModuloGeral } from './middleware/checkLicense.js';

dotenv.config();

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS to allow local network connections
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Expose io instance to Express app for use in controllers
app.set('io', io);

// Middlewares
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve local product images
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.join(process.cwd(), uploadDir)));

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', checkLicense, orderRoutes);
app.use('/api/reports', checkLicense, reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cash-register', checkLicense, cashRegisterRoutes);
app.use('/api/delivery', checkLicense, checkModuloGeral, deliveryRoutes);
app.use('/api/loja', lojaRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/global-observations', globalObservationRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/dav', davRoutes);

// Endpoint para obter o IP de rede local do servidor
app.get('/api/device-ip', (req, res) => {
  res.json({ ip: LOCAL_IP });
});

// Root route check if no static frontend build is present
app.get('/api/health', (req, res) => {
  res.json({ message: 'API do Restaurante funcionando com sucesso!' });
});

// Serve static frontend build (React) for production unified hosting
const distPath = path.join(process.cwd(), '../frontend/dist');
const localDistPath = path.join(process.cwd(), 'frontend/dist');
const staticPath = fs.existsSync(distPath) ? distPath : (fs.existsSync(localDistPath) ? localDistPath : null);

if (staticPath) {
  console.log(`📦 Servidor configurado para entregar o Frontend estático de: ${staticPath}`);
  app.use(express.static(staticPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(staticPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'API do Restaurante funcionando com sucesso! (Frontend não compilado)' });
  });
}

// Socket.io event handling
io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  socket.on('join_room', (data) => {
    const { role, tableNumber } = data;
    if (role) {
      socket.join(role);
      console.log(`Socket ${socket.id} entrou na sala do cargo: ${role}`);
    }
    if (tableNumber) {
      socket.join(`table_${tableNumber}`);
      console.log(`Socket ${socket.id} entrou na sala da mesa: ${tableNumber}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

// Local IP Address Detection helper
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  
  // 1. Prefer physical adapters (filter out common virtual networks by name)
  for (const name in interfaces) {
    const isVirtual = name.toLowerCase().includes('virtual') || 
                      name.toLowerCase().includes('vbox') || 
                      name.toLowerCase().includes('vboxnet') || 
                      name.toLowerCase().includes('vmware') || 
                      name.toLowerCase().includes('wsl') || 
                      name.toLowerCase().includes('docker') || 
                      name.toLowerCase().includes('vethernet') || 
                      name.toLowerCase().includes('loopback');
    if (isVirtual) continue;

    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Prefer standard local subnets
        if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.')) {
          return iface.address;
        }
      }
    }
  }

  // 2. Fallback to standard check if no physical matched
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.')) {
          return iface.address;
        }
      }
    }
  }

  // 3. Last resort fallback
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIpAddress();

// Initialize DB and start server
async function startServer() {
  try {
    console.log('Inicializando banco de dados...');
    await initializeDatabase();
    console.log('Banco de dados PostgreSQL (Supabase) inicializado.');

    server.listen(PORT, '0.0.0.0', () => {
      console.log('\n======================================================');
      console.log('🚀 SERVIDOR DE RESTAURANTE INICIADO COM SUCESSO');
      console.log(`📡 Rede Local API:  http://${LOCAL_IP}:${PORT}`);
      console.log(`💻 Localhost API:   http://localhost:${PORT}`);
      console.log('------------------------------------------------------');
      console.log('📱 Para acessar de outros aparelhos na mesma rede Wi-Fi:');
      console.log(`   - Backend:       http://${LOCAL_IP}:${PORT}`);
      console.log(`   - Frontend:      http://${LOCAL_IP}:5173 (Porta padrão do Vite)`);
      console.log('======================================================\n');
    });
  } catch (error) {
    console.error('Erro ao inicializar o servidor:', error);
    process.exit(1);
  }
}

startServer();
