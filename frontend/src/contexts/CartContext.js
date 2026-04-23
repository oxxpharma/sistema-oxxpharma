import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const GUEST_KEY = 'oxx_guest_cart';

function getGuestCart() {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) || '[]'); } catch { return []; }
}
function setGuestCart(items) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(items));
}

export function CartProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [cart, setCart] = useState({ items: [], subtotal: 0, count: 0 });
  const [loading, setLoading] = useState(false);

  const hydrateGuest = useCallback(async () => {
    const guest = getGuestCart();
    if (!guest.length) return { items: [], subtotal: 0, count: 0 };
    const items = [];
    let subtotal = 0;
    for (const g of guest) {
      try {
        const { product } = await api.get(`/api/products/${g.product_id}`);
        const price = product.discount_price || product.price;
        const total = price * g.quantity;
        subtotal += total;
        items.push({
          product_id: product.product_id,
          quantity: g.quantity,
          name: product.name,
          price,
          original_price: product.price,
          image: (product.images || [])[0] || null,
          total,
          stock: product.stock,
        });
      } catch {}
    }
    return { items, subtotal: Math.round(subtotal * 100) / 100, count: items.length };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (isAuthenticated) {
        const data = await api.get('/api/cart');
        setCart(data);
      } else {
        const data = await hydrateGuest();
        setCart(data);
      }
    } catch {
      setCart({ items: [], subtotal: 0, count: 0 });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, hydrateGuest]);

  // Sync guest cart -> server on login
  useEffect(() => {
    const syncGuestToServer = async () => {
      const guest = getGuestCart();
      if (isAuthenticated && guest.length) {
        for (const g of guest) {
          try { await api.post('/api/cart/items', g); } catch {}
        }
        localStorage.removeItem(GUEST_KEY);
      }
      refresh();
    };
    syncGuestToServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.user_id]);

  const addItem = async (product_id, quantity = 1) => {
    if (isAuthenticated) {
      const data = await api.post('/api/cart/items', { product_id, quantity });
      setCart(data);
      return data;
    }
    const guest = getGuestCart();
    const existing = guest.find(i => i.product_id === product_id);
    if (existing) existing.quantity += quantity;
    else guest.push({ product_id, quantity });
    setGuestCart(guest);
    await refresh();
  };

  const updateItem = async (product_id, quantity) => {
    if (isAuthenticated) {
      const data = await api.put(`/api/cart/items/${product_id}`, { quantity });
      setCart(data);
      return;
    }
    let guest = getGuestCart();
    if (quantity <= 0) guest = guest.filter(i => i.product_id !== product_id);
    else {
      const it = guest.find(i => i.product_id === product_id);
      if (it) it.quantity = quantity;
    }
    setGuestCart(guest);
    await refresh();
  };

  const removeItem = async (product_id) => {
    if (isAuthenticated) {
      const data = await api.del(`/api/cart/items/${product_id}`);
      setCart(data);
      return;
    }
    const guest = getGuestCart().filter(i => i.product_id !== product_id);
    setGuestCart(guest);
    await refresh();
  };

  const clear = () => setCart({ items: [], subtotal: 0, count: 0 });

  return (
    <CartContext.Provider value={{ cart, loading, refresh, addItem, updateItem, removeItem, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
