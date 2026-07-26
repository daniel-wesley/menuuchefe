import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('Erro ao conectar no Supabase:', err.stack);
  }
  console.log('Banco de dados PostgreSQL (Supabase) conectado com sucesso!');
  release();
});

function convertPlaceholders(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

let txClient = null;

async function getClient() {
  if (txClient) return txClient;
  return pool;
}

export const db = {
  all: async (sql, params) => {
    const pgSql = convertPlaceholders(sql);
    const client = await getClient();
    const res = await client.query(pgSql, params || []);
    return res.rows;
  },

  get: async (sql, params) => {
    const pgSql = convertPlaceholders(sql);
    const client = await getClient();
    const res = await client.query(pgSql, params || []);
    return res.rows[0];
  },

  run: async (sql, params) => {
    const trimmed = sql.trim().toUpperCase().replace(/\s+/g, ' ');

    if (trimmed === 'BEGIN TRANSACTION' || trimmed === 'BEGIN') {
      if (!txClient) {
        txClient = await pool.connect();
        await txClient.query('BEGIN');
      }
      return { changes: 0, lastID: null };
    }

    if (trimmed === 'COMMIT') {
      if (txClient) {
        await txClient.query('COMMIT');
        txClient.release();
        txClient = null;
      }
      return { changes: 0, lastID: null };
    }

    if (trimmed === 'ROLLBACK') {
      if (txClient) {
        await txClient.query('ROLLBACK');
        txClient.release();
        txClient = null;
      }
      return { changes: 0, lastID: null };
    }

    const pgSql = convertPlaceholders(sql);
    const client = await getClient();
    const res = await client.query(pgSql, params || []);
    return { changes: res.rowCount, lastID: res.rows[0] ? res.rows[0].id : null };
  },

  exec: async (sql) => {
    await pool.query(sql);
  }
};

export async function getDbConnection() {
  return db;
}

export async function initializeDatabase() {
  const connection = db;

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      current_session_id TEXT
    )
  `);

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      id SERIAL PRIMARY KEY,
      number INTEGER UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'free',
      token TEXT NOT NULL
    )
  `);

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      image_url TEXT,
      category TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      track_stock INTEGER NOT NULL DEFAULT 1,
      observations TEXT
    )
  `);

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      icon TEXT DEFAULT 'package',
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      table_id INTEGER NOT NULL,
      user_id INTEGER,
      client_name TEXT,
      status TEXT NOT NULL DEFAULT 'received',
      total_amount REAL NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      FOREIGN KEY (table_id) REFERENCES tables (id) ON DELETE RESTRICT,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    )
  `);

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      notes TEXT,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
    )
  `);

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      table_id INTEGER,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      split_count INTEGER DEFAULT 1,
      group_id TEXT,
      client_cpf TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS cancellations (
      id SERIAL PRIMARY KEY,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      reason TEXT,
      table_number INTEGER,
      employee_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS cash_registers (
      id SERIAL PRIMARY KEY,
      operator_name TEXT NOT NULL,
      initial_amount REAL NOT NULL DEFAULT 0,
      final_amount REAL,
      total_revenue REAL,
      total_transactions INTEGER,
      opened_at TIMESTAMPTZ DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    )
  `);

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS cash_withdrawals (
      id SERIAL PRIMARY KEY,
      cash_register_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      FOREIGN KEY (cash_register_id) REFERENCES cash_registers(id)
    )
  `);

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS dav_counters (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      last_number INTEGER NOT NULL DEFAULT 0,
      UNIQUE(year, month)
    )
  `);

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS complimentary_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      discount_type TEXT NOT NULL DEFAULT 'cortesia',
      reason TEXT,
      authorized_by TEXT,
      table_number INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS delivery_orders (
      id SERIAL PRIMARY KEY,
      client_name TEXT NOT NULL,
      client_phone TEXT,
      address TEXT,
      neighborhood TEXT,
      channel TEXT NOT NULL DEFAULT 'proprio',
      status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT NOT NULL DEFAULT 'dinheiro',
      total_amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      deliverer_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      dispatched_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ
    )
  `);

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS delivery_order_items (
      id SERIAL PRIMARY KEY,
      delivery_order_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL,
      notes TEXT,
      FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders (id) ON DELETE CASCADE
    )
  `);

  await connection.exec(`
    CREATE TABLE IF NOT EXISTS global_observations (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await seedDefaultData(connection);
}

async function seedDefaultData(connection) {
  const userCount = await connection.get('SELECT COUNT(*) as count FROM users');
  if (parseInt(userCount.count) === 0) {
    const salt = await bcrypt.genSalt(10);
    const adminPass = await bcrypt.hash('admin123', salt);
    const waiterPass = await bcrypt.hash('garcom123', salt);
    const kitchenPass = await bcrypt.hash('cozinha123', salt);

    await connection.run(
      'INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)',
      ['admin', adminPass, 'admin', 'Administrador']
    );
    await connection.run(
      'INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)',
      ['garcom', waiterPass, 'waiter', 'Garcom Principal']
    );
    await connection.run(
      'INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)',
      ['cozinha', kitchenPass, 'kitchen', 'Chef Cozinha']
    );
    console.log('Default users seeded: admin/admin123, garcom/garcom123, cozinha/cozinha123');
  }

  const tableCount = await connection.get('SELECT COUNT(*) as count FROM tables');
  if (parseInt(tableCount.count) === 0) {
    for (let i = 1; i <= 10; i++) {
      const tableToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      await connection.run(
        'INSERT INTO tables (number, status, token) VALUES (?, ?, ?)',
        [i, 'free', tableToken]
      );
    }
    console.log('Tables 1 to 10 seeded.');
  }

  const productCount = await connection.get('SELECT COUNT(*) as count FROM products');
  if (parseInt(productCount.count) === 0) {
    const defaultProducts = [
      { name: 'Hamburguer Gourmet', price: 28.50, description: 'Hamburguer artesanal de 180g, queijo cheddar derretido, bacon crocante, alface, tomate e maionese artesanal no pao brioche.', category: 'lanches', stock: 50, track_stock: 1 },
      { name: 'X-Salada Especial', price: 22.00, description: 'Hamburguer de 120g, queijo prato, alface, tomate, milho, ervilha e maionese da casa.', category: 'lanches', stock: 100, track_stock: 1 },
      { name: 'Pizza Calabresa', price: 45.00, description: 'Molho de tomate artesanal, mussarela de alta qualidade, calabresa fatiada, cebola roxa e azeitonas pretas com oregano.', category: 'pizzas', stock: 30, track_stock: 1 },
      { name: 'Pizza Margherita', price: 42.00, description: 'Molho de tomate fresco, mussarela, rodelas de tomate italiano, manjericao fresco picado e azeite de oliva extra virgem.', category: 'pizzas', stock: 30, track_stock: 1 },
      { name: 'Coca-Cola Lata', price: 6.00, description: 'Refrigerante Coca-Cola original lata 350ml bem gelado.', category: 'bebidas', stock: 150, track_stock: 1 },
      { name: 'Suco de Laranja 400ml', price: 8.50, description: 'Suco natural de laranja espremido na hora, servido com gelo.', category: 'bebidas', stock: 80, track_stock: 0 },
      { name: 'Petit Gateau', price: 18.00, description: 'Bolinho quente de chocolate com recheio cremoso, servido com uma bola de sorvete de creme e calda de chocolate.', category: 'sobremesas', stock: 20, track_stock: 1 },
      { name: 'Pudim de Leite Moca', price: 10.00, description: 'Fatia de pudim de leite condensado super cremoso com calda de caramelo brilhante.', category: 'sobremesas', stock: 25, track_stock: 1 }
    ];

    for (const p of defaultProducts) {
      await connection.run(
        'INSERT INTO products (name, price, description, category, stock, track_stock) VALUES (?, ?, ?, ?, ?, ?)',
        [p.name, p.price, p.description, p.category, p.stock, p.track_stock]
      );
    }
    console.log('Initial products menu seeded.');
  }
}
