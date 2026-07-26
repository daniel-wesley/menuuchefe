import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [table, setTable] = useState(null); // { id, number }
  const [clientName, setClientName] = useState('');

  const addToCart = (product, notes = '') => {
    setItems((prevItems) => {
      // Find item with same product_id AND same custom notes
      const existingIndex = prevItems.findIndex(
        (item) => item.product_id === product.id && item.notes.trim().toLowerCase() === notes.trim().toLowerCase()
      );

      if (existingIndex > -1) {
        const newItems = [...prevItems];
        newItems[existingIndex].quantity += 1;
        return newItems;
      }

      return [
        ...prevItems,
        {
          product_id: product.id,
          name: product.name,
          price: product.price,
          category: product.category,
          image_url: product.image_url,
          quantity: 1,
          notes: notes
        }
      ];
    });
  };

  const removeFromCart = (productId, notes = '') => {
    setItems((prevItems) =>
      prevItems.filter(
        (item) => !(item.product_id === productId && item.notes.trim().toLowerCase() === notes.trim().toLowerCase())
      )
    );
  };

  const updateQuantity = (productId, notes = '', quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId, notes);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.product_id === productId && item.notes.trim().toLowerCase() === notes.trim().toLowerCase()
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    setClientName('');
  };

  const selectTable = (tableId, tableNumber) => {
    setTable({ id: tableId, number: tableNumber });
  };

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        table,
        clientName,
        setClientName,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        selectTable,
        setTable,
        totalAmount
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart deve ser usado dentro de um CartProvider');
  }
  return context;
}
