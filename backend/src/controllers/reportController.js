import { getDbConnection } from '../config/db.js';

// Checkout: Process payment and release table
export async function checkoutTable(req, res) {
  const { table_id, payment_method, split_count, total_amount, payments_detail, client_cpf } = req.body;

  const validMethods = ['dinheiro', 'cartao', 'credito', 'debito', 'pix', 'voucher'];
  
  if (!table_id || !total_amount) {
    return res.status(400).json({ message: 'Dados de pagamento incompletos.' });
  }

  // If payments_detail is provided, validate each method. Otherwise, validate the single payment_method.
  if (payments_detail && Array.isArray(payments_detail) && payments_detail.length > 0) {
    for (const payment of payments_detail) {
      if (!validMethods.includes(payment.method)) {
        return res.status(400).json({ message: `Método de pagamento inválido: ${payment.method}` });
      }
      if (isNaN(parseFloat(payment.amount)) || parseFloat(payment.amount) <= 0) {
        return res.status(400).json({ message: 'Valores de pagamento inválidos.' });
      }
    }
  } else {
    if (!payment_method) {
      return res.status(400).json({ message: 'Método de pagamento não especificado.' });
    }
    if (!validMethods.includes(payment_method)) {
      return res.status(400).json({ message: `Método de pagamento inválido: ${payment_method}` });
    }
  }

  const db = await getDbConnection();

  try {
    await db.run('BEGIN TRANSACTION');

    // 1. Verify table exists
    const table = await db.get('SELECT * FROM tables WHERE id = ?', [table_id]);
    if (!table) {
      await db.run('ROLLBACK');
      return res.status(404).json({ message: 'Mesa não encontrada.' });
    }

    // 2. Mark all active orders for this table as paid
    await db.run('UPDATE orders SET paid = 1 WHERE table_id = ? AND paid = 0', [table_id]);

    // 3. Register transaction(s)
    const groupId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    if (payments_detail && Array.isArray(payments_detail) && payments_detail.length > 0) {
      // Record a transaction for each payment method in the split payment
      for (const payment of payments_detail) {
        await db.run(
          `INSERT INTO transactions (table_id, total_amount, payment_method, split_count, group_id, client_cpf) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [table_id, parseFloat(payment.amount), payment.method, parseInt(split_count) || 1, groupId, client_cpf || null]
        );
      }
    } else {
      // Fallback to single payment
      await db.run(
        `INSERT INTO transactions (table_id, total_amount, payment_method, split_count, group_id, client_cpf) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [table_id, parseFloat(total_amount), payment_method, parseInt(split_count) || 1, groupId, client_cpf || null]
      );
    }

    // 4. Release table & regenerate token (security measure for QR codes)
    const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await db.run('UPDATE tables SET status = \'free\', token = ? WHERE id = ?', [newToken, table_id]);

    await db.run('COMMIT');

    const updatedTable = { ...table, status: 'free', token: newToken };

    // Broadcast table status change
    const io = req.app.get('io');
    if (io) {
      io.emit('table_status_changed', updatedTable);
      io.emit('table_paid', { table_id, total_amount });
    }

    res.json({ message: 'Pagamento processado e mesa liberada com sucesso!', table: updatedTable });
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Error in table checkout:', error);
    res.status(500).json({ message: 'Erro ao processar pagamento.' });
  }
}

// Session Closure (Fechamento do Caixa Aberto)
export async function getDailyClosure(req, res) {
  try {
    const db = await getDbConnection();
    
    const today = new Date().toISOString().split('T')[0];

    // Get current open cash register session
    const session = await db.get(
      `SELECT * FROM cash_registers WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1`
    );

    // Filter transactions by the current session's opened_at time
    let transactions;
    let summary;
    if (session) {
      transactions = await db.all(
        `SELECT t.*, COALESCE(tbl.number, 'Delivery') as table_number 
         FROM transactions t
         LEFT JOIN tables tbl ON t.table_id = tbl.id
         WHERE t.created_at >= ?
         ORDER BY t.created_at DESC`,
        [session.opened_at]
      );

      summary = await db.all(
        `SELECT payment_method, SUM(total_amount) as total, COUNT(*) as count 
         FROM transactions 
         WHERE created_at >= ?
         GROUP BY payment_method`,
        [session.opened_at]
      );
    } else {
      transactions = await db.all(
        `SELECT t.*, COALESCE(tbl.number, 'Delivery') as table_number 
         FROM transactions t
         LEFT JOIN tables tbl ON t.table_id = tbl.id
         ORDER BY t.created_at DESC`
      );

      summary = await db.all(
        `SELECT payment_method, SUM(total_amount) as total, COUNT(*) as count 
         FROM transactions 
         GROUP BY payment_method`
      );
    }

    const totalRevenue = transactions.reduce((sum, t) => sum + t.total_amount, 0);

    // Calculate the number of distinct sales (group_id)
    const uniqueSales = new Set();
    let legacyCount = 0;
    for (const tx of transactions) {
      if (tx.group_id) {
        uniqueSales.add(tx.group_id);
      } else {
        legacyCount++;
      }
    }
    const transactionsCount = uniqueSales.size + legacyCount;

    // Get withdrawals (sangrias) for the current session
    let withdrawals = [];
    let totalWithdrawals = 0;
    if (session) {
      withdrawals = await db.all(
        `SELECT * FROM cash_withdrawals WHERE cash_register_id = ? ORDER BY created_at DESC`,
        [session.id]
      );
      const withdrawResult = await db.get(
        `SELECT COALESCE(SUM(amount), 0) as total FROM cash_withdrawals WHERE cash_register_id = ?`,
        [session.id]
      );
      totalWithdrawals = withdrawResult.total || 0;
    }

    res.json({
      date: today,
      session_opened_at: session?.opened_at || null,
      total_revenue: totalRevenue,
      transactions_count: transactionsCount,
      transactions,
      summary,
      withdrawals,
      total_withdrawals: totalWithdrawals,
      net_revenue: totalRevenue - totalWithdrawals
    });
  } catch (error) {
    console.error('Error on daily closure:', error);
    res.status(500).json({ message: 'Erro ao gerar fechamento de caixa.' });
  }
}

// Dashboard statistics for Admin Panel
export async function getAdminDashboardStats(req, res) {
  try {
    const db = await getDbConnection();

    // 1. Total revenue
    const revenueResult = await db.get('SELECT SUM(total_amount) as total FROM transactions');
    const totalRevenue = revenueResult.total || 0;

    // 2. Best selling products
    const bestSellers = await db.all(
      `SELECT p.name, p.category, SUM(oi.quantity) as quantity_sold, SUM(oi.quantity * oi.price) as total_revenue
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       GROUP BY oi.product_id
       ORDER BY quantity_sold DESC
       LIMIT 5`
    );

    // 3. low stock products (alert threshold: <= 5)
    const lowStock = await db.all(
      'SELECT id, name, stock, category FROM products WHERE track_stock = 1 AND stock <= 5 ORDER BY stock ASC'
    );

    // 4. Sales by payment method (all time)
    const paymentMethods = await db.all(
      'SELECT payment_method, SUM(total_amount) as total, COUNT(*) as count FROM transactions GROUP BY payment_method'
    );

    // 5. Daily sales chart (last 7 days)
    const dailySales = await db.all(
      `SELECT DATE(created_at) as date, SUM(total_amount) as total 
       FROM transactions 
       WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    // 6. Sales by waiter (all time)
    const waiterSales = await db.all(
      `SELECT 
         COALESCE(u.name, 'QR Code / Auto-atendimento') as waiter_name, 
         SUM(o.total_amount) as total_sales, 
         COUNT(o.id) as orders_count
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.paid = 1
       GROUP BY o.user_id, u.name
       ORDER BY total_sales DESC`
    );

    res.json({
      total_revenue: totalRevenue,
      best_sellers: bestSellers,
      low_stock: lowStock,
      payment_methods: paymentMethods,
      daily_sales: dailySales,
      waiter_sales: waiterSales
    });
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({ message: 'Erro ao carregar estatísticas administrativas.' });
  }
}

export async function getDetailedReports(req, res) {
  const { startDate, endDate, turn } = req.query;

  try {
    const db = await getDbConnection();

    // Base filters
    let dateFilter = "";
    const params = [];
    
    // SQLite date functions work with YYYY-MM-DD
    if (startDate) {
      dateFilter += " AND DATE(created_at) >= DATE(?)";
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += " AND DATE(created_at) <= DATE(?)";
      params.push(endDate);
    }

    if (turn) {
      if (turn === 'lunch') {
        dateFilter += " AND created_at::time >= '11:00:00'::time AND created_at::time < '16:00:00'::time";
      } else if (turn === 'dinner') {
        dateFilter += " AND (created_at::time >= '16:00:00'::time OR created_at::time < '04:00:00'::time)";
      }
    }

    // 1. Financeiro: Faturamento por forma de pagamento
    const billingByMethod = await db.all(
      `SELECT payment_method, SUM(total_amount) as total, COUNT(*) as count 
       FROM transactions 
       WHERE 1=1 ${dateFilter}
       GROUP BY payment_method`,
      params
    );

    // 2. Ticket Médio
    const ticketResult = await db.get(
      `SELECT SUM(total_amount) as total, COUNT(DISTINCT group_id) as count 
       FROM transactions 
       WHERE 1=1 ${dateFilter}`,
      params
    );
    const totalRevenue = ticketResult.total || 0;
    const salesCount = ticketResult.count || 0;
    const ticketMedio = salesCount > 0 ? (totalRevenue / salesCount) : 0;

    // 3. Cancelamentos e Estornos
    const cancellations = await db.all(
      `SELECT * FROM cancellations 
       WHERE 1=1 ${dateFilter} 
       ORDER BY created_at DESC`,
      params
    );

    // 4. Curva ABC de Produtos
    const ordersDateFilter = dateFilter.replace(/created_at/g, 'o.created_at');
    const productSales = await db.all(
      `SELECT p.name, p.category, SUM(oi.quantity) as quantity_sold, SUM(oi.quantity * oi.price) as total_revenue
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.paid = 1 ${ordersDateFilter}
       GROUP BY oi.product_id
       ORDER BY total_revenue DESC`,
      params
    );

    const totalProdRevenue = productSales.reduce((sum, p) => sum + p.total_revenue, 0);
    let cumulative = 0;
    const abcProducts = productSales.map(p => {
      cumulative += p.total_revenue;
      const pct = totalProdRevenue > 0 ? (cumulative / totalProdRevenue) : 0;
      let classification = 'C';
      if (pct <= 0.70) classification = 'A';
      else if (pct <= 0.90) classification = 'B';
      return { ...p, classification };
    });

    // 5. Vendas por Categoria
    const salesByCategory = await db.all(
      `SELECT p.category, SUM(oi.quantity * oi.price) as total, SUM(oi.quantity) as quantity
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.paid = 1 ${ordersDateFilter}
       GROUP BY p.category`,
      params
    );

    // 6. Mapa de calor por Horário (Rush)
    const rushHours = await db.all(
      `SELECT EXTRACT(HOUR FROM created_at)::text as hour, COUNT(DISTINCT group_id) as count, SUM(total_amount) as total
       FROM transactions 
       WHERE 1=1 ${dateFilter}
       GROUP BY hour
       ORDER BY hour ASC`,
      params
    );

    // 7. Desempenho por Garçom
    const waiterPerformance = await db.all(
      `SELECT COALESCE(u.name, 'QR Code / Auto-atendimento') as waiter_name, 
              SUM(o.total_amount) as total_sales, 
              COUNT(o.id) as orders_count,
              AVG(o.total_amount) as ticket_medio
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.paid = 1 ${ordersDateFilter}
       GROUP BY o.user_id, u.name
       ORDER BY total_sales DESC`,
      params
    );

    // 8. Tempo médio de preparo
    const prepResult = await db.get(
      `SELECT AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60) as avg_prep_time
       FROM orders o
       WHERE o.status = 'delivered' ${ordersDateFilter}`,
      params
    );
    const avgPrepTime = prepResult.avg_prep_time || 0;

    // 9. Sangrias no período
    let withdrawalsFilter = "";
    const withdrawalsParams = [];
    if (startDate) {
      withdrawalsFilter += " AND DATE(created_at) >= DATE(?)";
      withdrawalsParams.push(startDate);
    }
    if (endDate) {
      withdrawalsFilter += " AND DATE(created_at) <= DATE(?)";
      withdrawalsParams.push(endDate);
    }

    const withdrawals = await db.all(
      `SELECT cw.*, cr.operator_name as register_operator
       FROM cash_withdrawals cw
       JOIN cash_registers cr ON cw.cash_register_id = cr.id
       WHERE 1=1 ${withdrawalsFilter}
       ORDER BY cw.created_at DESC`,
      withdrawalsParams
    );

    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    // 10. Vendas por Modalidade (Salão vs Delivery vs Balcão)
    const salonRevenue = await db.get(
      `SELECT COALESCE(SUM(t.total_amount), 0) as total
       FROM transactions t
       WHERE t.table_id IS NOT NULL AND t.table_id != 0
       AND 1=1 ${dateFilter}`,
      params
    );

    const deliveryDateFilter = dateFilter.replace(/created_at/g, 'do.created_at');
    const deliveryRevenue = await db.get(
      `SELECT COALESCE(SUM(do.total_amount), 0) as total, COUNT(*) as count
       FROM delivery_orders do
       WHERE do.status = 'delivered' ${deliveryDateFilter}`,
      params
    );

    const modalityData = [
      { modality: 'Salão (Mesas)', total: salonRevenue.total || 0 },
      { modality: 'Delivery', total: deliveryRevenue.total || 0, count: deliveryRevenue.count || 0 },
    ];

    // 11. Mapa de Calor por Dia da Semana
    const rushByDay = await db.all(
      `SELECT 
         CASE EXTRACT(DOW FROM created_at)::integer
           WHEN 0 THEN 'Domingo'
           WHEN 1 THEN 'Segunda'
           WHEN 2 THEN 'Terça'
           WHEN 3 THEN 'Quarta'
           WHEN 4 THEN 'Quinta'
           WHEN 5 THEN 'Sexta'
           WHEN 6 THEN 'Sábado'
         END as day_name,
         EXTRACT(DOW FROM created_at)::integer as day_num,
         EXTRACT(HOUR FROM created_at)::text as hour,
         COUNT(DISTINCT group_id) as count,
         SUM(total_amount) as total
       FROM transactions
       WHERE 1=1 ${dateFilter}
       GROUP BY day_num, hour
       ORDER BY day_num ASC, hour ASC`,
      params
    );

    // 12. Ticket Médio por Mesa
    const ticketByTable = await db.all(
      `SELECT t.table_id, tbl.number as table_number, 
              AVG(t.total_amount) as avg_ticket,
              SUM(t.total_amount) as total,
              COUNT(DISTINCT t.group_id) as sales_count
       FROM transactions t
       LEFT JOIN tables tbl ON t.table_id = tbl.id
       WHERE t.table_id IS NOT NULL AND t.table_id != 0
       AND 1=1 ${dateFilter}
       GROUP BY t.table_id
       ORDER BY total DESC`,
      params
    );

    // 13. Tempo Médio de Preparo por Categoria
    const tmaByCategory = await db.all(
      `SELECT p.category, 
              AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60) as avg_prep_time,
              COUNT(o.id) as order_count
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id = p.id
       WHERE o.status = 'delivered' ${ordersDateFilter}
       GROUP BY p.category
       ORDER BY avg_prep_time DESC`,
      params
    );

    // 14. Cortesias e Descontos
    const complimentary = await db.all(
      `SELECT * FROM complimentary_items
       WHERE 1=1 ${dateFilter}
       ORDER BY created_at DESC`,
      params
    );

    const totalComplimentary = complimentary.reduce((sum, c) => sum + (c.unit_price * c.quantity), 0);

    // 15. Auditoria de Cancelamentos por Motivo
    const cancellationsByReason = await db.all(
      `SELECT reason, COUNT(*) as count, SUM(quantity * price) as total_loss
       FROM cancellations
       WHERE 1=1 ${dateFilter}
       GROUP BY reason
       ORDER BY count DESC`,
      params
    );

    // 16. Top 5 Produtos Mais Vendidos
    const top5Products = await db.all(
      `SELECT p.name, p.category, SUM(oi.quantity) as quantity_sold, SUM(oi.quantity * oi.price) as total_revenue
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.paid = 1 ${ordersDateFilter}
       GROUP BY oi.product_id
       ORDER BY quantity_sold DESC
       LIMIT 5`,
      params
    );

    res.json({
      billing_by_method: billingByMethod,
      ticket_medio: ticketMedio,
      sales_count: salesCount,
      total_revenue: totalRevenue,
      cancellations,
      abc_products: abcProducts,
      sales_by_category: salesByCategory,
      rush_hours: rushHours,
      waiter_performance: waiterPerformance,
      avg_prep_time: avgPrepTime,
      withdrawals,
      total_withdrawals: totalWithdrawals,
      net_revenue: totalRevenue - totalWithdrawals,
      modality_data: modalityData,
      rush_by_day: rushByDay,
      ticket_by_table: ticketByTable,
      tma_by_category: tmaByCategory,
      complimentary,
      total_complimentary: totalComplimentary,
      cancellations_by_reason: cancellationsByReason,
      top5_products: top5Products
    });
  } catch (error) {
    console.error('Error fetching detailed reports:', error);
    res.status(500).json({ message: 'Erro ao carregar relatórios detalhados.' });
  }
}

// Vendas por Garçom (filtro individual com gorjeta)
export async function getSalesByWaiter(req, res) {
  const { waiterId, startDate, endDate } = req.query;

  if (!waiterId) {
    return res.status(400).json({ message: 'O ID do garçom é obrigatório.' });
  }

  try {
    const db = await getDbConnection();

    let dateFilter = '';
    const params = [waiterId];

    if (startDate) {
      dateFilter += ' AND DATE(o.created_at) >= DATE(?)';
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND DATE(o.created_at) <= DATE(?)';
      params.push(endDate);
    }

    // Subtotal de pedidos pagos daquele garçom
    const result = await db.get(
      `SELECT 
         SUM(o.total_amount) as subtotal,
         COUNT(o.id) as orders_count,
         AVG(o.total_amount) as ticket_medio
       FROM orders o
       WHERE o.user_id = ? 
         AND o.paid = 1
         ${dateFilter}`,
      params
    );

    const subtotal = result.subtotal || 0;
    const ordersCount = result.orders_count || 0;
    const ticketMedio = result.ticket_medio || 0;
    const gorjeta = subtotal * 0.10;
    const totalGeral = subtotal + gorjeta;

    // Top produtos vendidos por este garçom
    const topProducts = await db.all(
      `SELECT p.name, p.category, SUM(oi.quantity) as quantity_sold, SUM(oi.quantity * oi.price) as total_revenue
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.user_id = ? 
         AND o.paid = 1
         ${dateFilter}
       GROUP BY oi.product_id
       ORDER BY quantity_sold DESC
       LIMIT 5`,
      params
    );

    // Dados do garçom
    const waiter = await db.get('SELECT id, name, username FROM users WHERE id = ?', [waiterId]);

    return res.json({
      waiter: waiter || null,
      subtotal,
      ordersCount,
      ticketMedio,
      gorjeta,
      totalGeral,
      topProducts
    });
  } catch (error) {
    console.error('Erro ao buscar relatório do garçom:', error);
    return res.status(500).json({ message: 'Erro interno no servidor.' });
  }
}
