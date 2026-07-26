import { getDbConnection } from '../config/db.js';

// Helper to fetch order with items
async function getOrderWithItems(db, id) {
  const order = await db.get('SELECT * FROM delivery_orders WHERE id = ?', [id]);
  if (!order) return null;
  order.items = await db.all('SELECT * FROM delivery_order_items WHERE delivery_order_id = ?', [id]);
  return order;
}

/**
 * GET /api/delivery
 * Returns all delivery orders for today, grouped by status.
 */
export async function getDeliveryOrders(req, res) {
  try {
    const db = await getDbConnection();
    const orders = await db.all(`
      SELECT * FROM delivery_orders
      WHERE DATE(created_at) = CURRENT_DATE
      ORDER BY created_at DESC
    `);

    // Attach items to each order
    for (const order of orders) {
      order.items = await db.all(
        'SELECT * FROM delivery_order_items WHERE delivery_order_id = ?',
        [order.id]
      );
    }

    return res.json(orders);
  } catch (err) {
    console.error('getDeliveryOrders error:', err);
    return res.status(500).json({ message: 'Erro interno ao buscar pedidos de delivery.' });
  }
}

/**
 * POST /api/delivery
 * Creates a new delivery order.
 * Body: { client_name, client_phone, address, neighborhood, channel, payment_method, total_amount, notes, items: [{product_name, quantity, price, notes}] }
 */
export async function createDeliveryOrder(req, res) {
  try {
    const db = await getDbConnection();
    const {
      client_name, client_phone, address, neighborhood,
      channel = 'proprio', payment_method = 'dinheiro',
      total_amount, notes, items = []
    } = req.body;

    if (!client_name) {
      return res.status(400).json({ message: 'Nome do cliente é obrigatório.' });
    }

    // Calculate total from items if not provided
    const calculatedTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const finalTotal = total_amount ?? calculatedTotal;

    const result = await db.run(
      `INSERT INTO delivery_orders 
       (client_name, client_phone, address, neighborhood, channel, payment_method, total_amount, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending') RETURNING id`,
      [client_name, client_phone || null, address || null, neighborhood || null, channel, payment_method, finalTotal, notes || null]
    );

    const orderId = result.lastID;

    // Insert items
    for (const item of items) {
      await db.run(
        'INSERT INTO delivery_order_items (delivery_order_id, product_name, quantity, price, notes) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.product_name, item.quantity, item.price, item.notes || null]
      );
    }

    const newOrder = await getOrderWithItems(db, orderId);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('delivery_order_created', newOrder);
    }

    return res.status(201).json(newOrder);
  } catch (err) {
    console.error('createDeliveryOrder error:', err);
    return res.status(500).json({ message: 'Erro interno ao criar pedido de delivery.' });
  }
}

/**
 * PUT /api/delivery/:id/status
 * Updates the status of a delivery order.
 * Body: { status: 'preparing' | 'dispatched' | 'delivered' | 'cancelled', deliverer_name? }
 */
export async function updateDeliveryStatus(req, res) {
  try {
    const db = await getDbConnection();
    const { id } = req.params;
    const { status, deliverer_name } = req.body;

    const validStatuses = ['pending', 'preparing', 'dispatched', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Status inválido.' });
    }

    const order = await db.get('SELECT * FROM delivery_orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    // Set timestamps based on new status
    let extraFields = '';
    const params = [];

    if (status === 'dispatched') {
      extraFields = `, dispatched_at = NOW()`;
    } else if (status === 'delivered') {
      extraFields = `, delivered_at = NOW()`;
      if (!order.dispatched_at) {
        extraFields += `, dispatched_at = NOW()`;
      }
    }

    const delivererUpdate = deliverer_name !== undefined ? `, deliverer_name = ?` : '';
    if (deliverer_name !== undefined) params.push(deliverer_name);

    await db.run(
      `UPDATE delivery_orders SET status = ?, updated_at = NOW()${delivererUpdate}${extraFields} WHERE id = ?`,
      [status, ...params, id]
    );

    // Register transaction if marked as delivered and wasn't previously delivered
    if (status === 'delivered' && order.status !== 'delivered') {
      await db.run(
        `INSERT INTO transactions (table_id, total_amount, payment_method, split_count, group_id, created_at) 
         VALUES (NULL, ?, ?, 1, ?, NOW())`,
        [order.total_amount, order.payment_method, `delivery-${order.id}`]
      );
    }

    const updatedOrder = await getOrderWithItems(db, id);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('delivery_order_updated', updatedOrder);
    }

    return res.json(updatedOrder);
  } catch (err) {
    console.error('updateDeliveryStatus error:', err);
    return res.status(500).json({ message: 'Erro interno ao atualizar pedido.' });
  }
}

/**
 * DELETE /api/delivery/:id
 * Cancels/deletes a delivery order.
 */
export async function deleteDeliveryOrder(req, res) {
  try {
    const db = await getDbConnection();
    const { id } = req.params;

    const order = await db.get('SELECT * FROM delivery_orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    await db.run('DELETE FROM delivery_orders WHERE id = ?', [id]);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('delivery_order_deleted', { id: parseInt(id) });
    }

    return res.json({ message: 'Pedido cancelado com sucesso.' });
  } catch (err) {
    console.error('deleteDeliveryOrder error:', err);
    return res.status(500).json({ message: 'Erro interno ao cancelar pedido.' });
  }
}

/**
 * GET /api/delivery/stats
 * Returns daily statistics for delivery.
 */
export async function getDeliveryStats(req, res) {
  try {
    const db = await getDbConnection();

    const stats = await db.get(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 0) as total_revenue,
        COALESCE(AVG(
          CASE WHEN delivered_at IS NOT NULL AND dispatched_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (delivered_at - created_at)) / 60
          END
        ), 0) as avg_delivery_minutes
      FROM delivery_orders
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    const byStatus = await db.all(`
      SELECT status, COUNT(*) as count
      FROM delivery_orders
      WHERE DATE(created_at) = CURRENT_DATE
      GROUP BY status
    `);

    return res.json({ ...stats, by_status: byStatus });
  } catch (err) {
    console.error('getDeliveryStats error:', err);
    return res.status(500).json({ message: 'Erro interno ao buscar estatísticas.' });
  }
}

/**
 * GET /api/delivery/client/:phone
 * Searches for the latest order with the given phone number to auto-fill client data.
 */
export async function lookupClientByPhone(req, res) {
  try {
    const db = await getDbConnection();
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({ message: 'Telefone é obrigatório.' });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    // Find the latest delivery order with this phone
    const clientData = await db.get(
      `SELECT client_name, address, neighborhood 
       FROM delivery_orders 
       WHERE client_phone = ? 
          OR REPLACE(REPLACE(REPLACE(REPLACE(client_phone, ' ', ''), '-', ''), '(', ''), ')', '') = ?
          OR REPLACE(REPLACE(REPLACE(REPLACE(client_phone, ' ', ''), '-', ''), '(', ''), ')', '') = ?
       ORDER BY created_at DESC 
       LIMIT 1`,
      [phone, phone, cleanPhone]
    );

    if (!clientData) {
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }

    return res.json(clientData);
  } catch (err) {
    console.error('lookupClientByPhone error:', err);
    return res.status(500).json({ message: 'Erro interno ao buscar cliente.' });
  }
}
