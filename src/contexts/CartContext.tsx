import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types/product';
import { useAuth } from '@/hooks/useAuth';

// Tipo para item do carrinho
export interface CartItem {
  product: Product;
  quantity: number;
}

// Tipo do contexto
interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateItemQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  reloadCart: () => Promise<void>;
  isInCart: (productId: number) => boolean;
  getItemQuantity: (productId: number) => number;
  totalItems: number;
  cartTotal: number;
  loading: boolean;
}

// Criar contexto
const CartContext = createContext<CartContextType | undefined>(undefined);

// Chave base para AsyncStorage
const CART_STORAGE_KEY_BASE = '@artesanato_cart';

function cartKeyForUser(userId?: number | string | null) {
  if (!userId) return `${CART_STORAGE_KEY_BASE}_guest`;
  return `${CART_STORAGE_KEY_BASE}_${userId}`;
}

// Provider do carrinho
export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar carrinho do AsyncStorage ao inicializar
  useEffect(() => {
    loadCartFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Salvar carrinho no AsyncStorage sempre que mudar
  useEffect(() => {
    if (!loading) {
      saveCartToStorage();
    }
  }, [cartItems, loading]);

  // Carregar carrinho do storage (usa chave por usuário)
  const loadCartFromStorage = async () => {
    const key = cartKeyForUser(user?.id);
    try {
      console.log('CartContext -> loading cart from storage key', key);
      const storedCart = await AsyncStorage.getItem(key);
      console.log('CartContext -> raw storedCart:', storedCart ? (storedCart.length > 200 ? storedCart.slice(0,200)+'...' : storedCart) : null);
      if (storedCart) {
        setCartItems(JSON.parse(storedCart));
      } else {
        setCartItems([]);
      }
    } catch (error) {
      console.error('Erro ao carregar carrinho:', error);
    } finally {
      setLoading(false);
    }
  };

  // Exposed reload function - useful for manual refresh actions
  const reloadCart = async () => {
    setLoading(true);
    await loadCartFromStorage();
  };

  // Salvar carrinho no storage (usa chave por usuário)
  const saveCartToStorage = async () => {
    const key = cartKeyForUser(user?.id);
    try {
      const payload = JSON.stringify(cartItems);
      console.log('CartContext -> saving cart to storage key', key, 'size:', payload.length);
      await AsyncStorage.setItem(key, payload);
    } catch (error) {
      console.error('Erro ao salvar carrinho:', error);
    }
  };

  // Adicionar ao carrinho
  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.product.id === product.id);
      
      if (existingItem) {
        // Se já existe, aumenta a quantidade
        return prevItems.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // Se não existe, adiciona novo item
        return [...prevItems, { product, quantity }];
      }
    });
  }, []);

  // Remover do carrinho
  const removeFromCart = useCallback((productId: number) => {
    setCartItems(prevItems => prevItems.filter(item => item.product.id !== productId));
  }, []);

  // Atualizar quantidade
  const updateItemQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      )
    );
  }, [removeFromCart]);

  // Limpar carrinho
  const clearCart = useCallback(() => {
    const key = cartKeyForUser(user?.id);
    console.log('CartContext -> clearCart called, clearing memory cart and storage key', key);
    setCartItems([]);
    // remove from storage as well
    AsyncStorage.removeItem(key).catch(e => console.warn('CartContext -> failed to remove cart from storage', e));
  }, [user?.id]);

  // Ensure cart is cleared on logout (when user becomes null)
  useEffect(() => {
    if (!user) {
      // clear guest cart as a safety measure
      const guestKey = cartKeyForUser(null);
      AsyncStorage.removeItem(guestKey).catch(e => console.warn('CartContext -> failed to remove guest cart on logout', e));
      setCartItems([]);
    }
  }, [user]);

  // Verificar se produto está no carrinho
  const isInCart = useCallback((productId: number) => {
    return cartItems.some(item => item.product.id === productId);
  }, [cartItems]);

  // Obter quantidade de um produto específico
  const getItemQuantity = useCallback((productId: number) => {
    const item = cartItems.find(item => item.product.id === productId);
    return item?.quantity || 0;
  }, [cartItems]);

  // Calcular total de itens
  const totalItems = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  // Calcular valor total
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity);
    }, 0);
  }, [cartItems]);

  const value = useMemo(
    () => ({
      cartItems,
      addToCart,
      removeFromCart,
      updateItemQuantity,
      clearCart,
      reloadCart,
      isInCart,
      getItemQuantity,
      totalItems,
      cartTotal,
      loading,
    }),
    [
      cartItems,
      addToCart,
      removeFromCart,
      updateItemQuantity,
      clearCart,
      reloadCart,
      isInCart,
      getItemQuantity,
      totalItems,
      cartTotal,
      loading,
    ]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

// Hook customizado para usar o contexto
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart deve ser usado dentro de um CartProvider');
  }
  return context;
}