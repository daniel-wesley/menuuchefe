import { getDbConnection } from '../config/db.js';
import fs from 'fs';
import path from 'path';

export async function getProducts(req, res) {
  const { category, search } = req.query;

  try {
    const db = await getDbConnection();
    let query = 'SELECT * FROM products';
    const params = [];

    if (category || search) {
      query += ' WHERE';
      const clauses = [];

      if (category) {
        clauses.push(' category = ?');
        params.push(category);
      }

      if (search) {
        clauses.push(' (name LIKE ? OR description LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      query += clauses.join(' AND');
    }

    query += ' ORDER BY category ASC, name ASC';

    const products = await db.all(query, params);
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Erro ao buscar produtos.' });
  }
}

export async function getProductById(req, res) {
  const { id } = req.params;

  try {
    const db = await getDbConnection();
    const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);

    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Erro ao buscar detalhes do produto.' });
  }
}

export async function createProduct(req, res) {
  const { name, price, description, category, stock, track_stock, observations } = req.body;

  if (!name || !price || !category) {
    return res.status(400).json({ message: 'Nome, preço e categoria são obrigatórios.' });
  }

  // Handle uploaded file
  let image_url = null;
  if (req.file) {
    image_url = `/uploads/${req.file.filename}`;
  }

  try {
    const db = await getDbConnection();
    const result = await db.run(
      `INSERT INTO products (name, price, description, image_url, category, stock, track_stock, observations) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        name,
        parseFloat(price),
        description || '',
        image_url,
        category,
        parseInt(stock) || 0,
        track_stock === 'false' || track_stock === '0' || track_stock === 0 ? 0 : 1,
        observations || null
      ]
    );

    const newProduct = {
      id: result.lastID,
      name,
      price: parseFloat(price),
      description: description || '',
      image_url,
      category,
      stock: parseInt(stock) || 0,
      track_stock: track_stock === 'false' || track_stock === '0' || track_stock === 0 ? 0 : 1,
      observations: observations || null
    };

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Erro ao criar produto.' });
  }
}

export async function updateProduct(req, res) {
  const { id } = req.params;
  const { name, price, description, category, stock, track_stock, observations } = req.body;

  if (!name || !price || !category) {
    return res.status(400).json({ message: 'Nome, preço e categoria são obrigatórios.' });
  }

  try {
    const db = await getDbConnection();
    const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);

    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    let image_url = product.image_url;
    if (req.file) {
      // Delete old image if it exists and is local
      if (product.image_url && product.image_url.startsWith('/uploads/')) {
        const oldPath = path.join(process.cwd(), product.image_url);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {
            console.error('Failed to delete old image:', e);
          }
        }
      }
      image_url = `/uploads/${req.file.filename}`;
    }

    await db.run(
      `UPDATE products 
       SET name = ?, price = ?, description = ?, image_url = ?, category = ?, stock = ?, track_stock = ?, observations = ?
       WHERE id = ?`,
      [
        name,
        parseFloat(price),
        description || '',
        image_url,
        category,
        parseInt(stock) || 0,
        track_stock === 'false' || track_stock === '0' || track_stock === 0 ? 0 : 1,
        observations || null,
        id
      ]
    );

    const updatedProduct = {
      id: parseInt(id),
      name,
      price: parseFloat(price),
      description: description || '',
      image_url,
      category,
      stock: parseInt(stock) || 0,
      track_stock: track_stock === 'false' || track_stock === '0' || track_stock === 0 ? 0 : 1,
      observations: observations || null
    };

    res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Erro ao atualizar produto.' });
  }
}

export async function deleteProduct(req, res) {
  const { id } = req.params;

  try {
    const db = await getDbConnection();
    const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);

    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    // Delete image file if it exists
    if (product.image_url && product.image_url.startsWith('/uploads/')) {
      const imgPath = path.join(process.cwd(), product.image_url);
      if (fs.existsSync(imgPath)) {
        try {
          fs.unlinkSync(imgPath);
        } catch (e) {
          console.error('Failed to delete image file:', e);
        }
      }
    }

    await db.run('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Produto excluído com sucesso.' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Erro ao excluir produto.' });
  }
}

export async function updateStock(req, res) {
  const { id } = req.params;
  const { stock } = req.body;

  if (stock === undefined || isNaN(stock)) {
    return res.status(400).json({ message: 'Quantidade de estoque é obrigatória.' });
  }

  try {
    const db = await getDbConnection();
    const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);

    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado.' });
    }

    await db.run('UPDATE products SET stock = ? WHERE id = ?', [parseInt(stock), id]);
    res.json({ id: parseInt(id), name: product.name, stock: parseInt(stock) });
  } catch (error) {
    console.error('Error updating product stock:', error);
    res.status(500).json({ message: 'Erro ao atualizar estoque.' });
  }
}
