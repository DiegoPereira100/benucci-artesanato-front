import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';
import toast from '../../src/utils/toast';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Product } from '@/types/product';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { useCart } from '@/contexts/CartContext';
import { parseAddress, formatAddressSummary } from '../../src/utils/address';

import { ProductCard } from '@/components/ui/ProductCard';
import { ProductModal } from '@/components/ui/ProductModal';
import { productService } from '@/services/productService';

export default function ExploreScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState('Tudo');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width: windowWidth } = useWindowDimensions();

  const productLayout = useMemo(() => {
    const minCardWidth = 140;
    const maxCardWidth = 320;
    const basePadding = windowWidth >= 1024 ? 40 : windowWidth >= 768 ? 28 : 20;
    const cardMarginTotal = 16; // left + right margins from card style

    let columns = windowWidth >= 1400 ? 4 : windowWidth >= 1024 ? 3 : 2;
    columns = Math.max(columns, 1);

    let availableWidth = Math.max(windowWidth - basePadding * 2, minCardWidth);

    while (columns > 1) {
      const widthForColumn = (availableWidth - columns * cardMarginTotal) / columns;
      if (widthForColumn >= minCardWidth) {
        break;
      }
      columns -= 1;
    }

    const widthForColumn = (availableWidth - columns * cardMarginTotal) / columns;
    const cardWidth = Math.max(Math.min(widthForColumn, maxCardWidth), minCardWidth);
    const rowWidth = columns * (cardWidth + cardMarginTotal);
    const leftoverSpace = Math.max(availableWidth - rowWidth, 0);
    const horizontalPadding = basePadding + leftoverSpace / 2;

    return {
      columns,
      cardWidth,
      horizontalPadding,
    };
  }, [windowWidth]);
  
  const { user } = useAuth();
  const router = useRouter();
  const { addToCart, totalItems } = useCart();
  
  const [location, setLocation] = useState<{ city: string; state: string }>({ city: '', state: '' });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const categories = ['Tudo', 'Mandala', 'Chaveiro', 'Porta chaves', 'Gato', 'Imã'];

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (user?.address && user.address.trim() !== '') {
      extractLocation(user.address);
    } else {
      setLocation({ city: '', state: '' });
    }
  }, [user?.address]);

  useEffect(() => {
    filterProducts();
  }, [products, activeCategory, searchQuery]);

  const extractLocation = useCallback((address: string) => {
    const parsed = parseAddress(address);
    if (parsed.city || parsed.state) {
      setLocation({ city: parsed.city, state: parsed.state });
      return;
    }

    if (!address || address.trim() === '') {
      setLocation({ city: '', state: '' });
      return;
    }

    const parts = address.split(',').map(part => part.trim());
    let extractedLocation = { city: '', state: '' };

    if (parts.length >= 4) {
      if (parts.length >= 5) {
        extractedLocation = { city: parts[2].trim(), state: parts[4].trim() };
      } else if (parts.length === 4) {
        extractedLocation = { city: parts[2].trim(), state: parts[3].trim() };
      }
    } else if (parts.length === 3) {
      extractedLocation = { city: parts[1].trim(), state: parts[2].trim() };
    } else if (parts.length >= 2) {
      extractedLocation = { city: parts[parts.length - 2].trim(), state: parts[parts.length - 1].trim() };
    }

    setLocation(extractedLocation);
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Verificar se o usuário está autenticado
      if (!user) {
        console.warn('Usuário não autenticado, tentando carregar produtos...');
      }
      
      // Buscar produtos reais da API
      const productsData = await productService.getAllProducts();
      setProducts(productsData);
      
      if (productsData.length === 0) {
        setError('Nenhum produto disponível no momento');
      }
    } catch (error: any) {
      console.error('Erro ao carregar produtos:', error);
      
      // Tratamento específico para erro 403
      if (error?.response?.status === 403) {
        setError('Acesso negado. Faça login para ver os produtos.');
  toast.showInfo('Autenticação necessária', 'Você precisa estar logado para visualizar os produtos.');
        router.push('/(auth)/login');
      } else if (error?.response?.status === 401) {
        setError('Sessão expirada. Faça login novamente.');
  toast.showInfo('Sessão Expirada', 'Sua sessão expirou. Por favor, faça login novamente.');
        router.push('/(auth)/login');
      } else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        setError('Tempo de conexão esgotado. Verifique sua internet.');
  toast.showError('Erro de Conexão', 'Não foi possível conectar ao servidor. Verifique sua conexão.');
      } else if (error?.message === 'Network Error') {
        setError('Erro de rede. Verifique sua conexão.');
  toast.showError('Sem Conexão', 'Não foi possível conectar ao servidor.');
      } else {
        setError('Erro ao carregar produtos. Tente novamente.');
  toast.showError('Erro', 'Não foi possível carregar os produtos. Tente novamente mais tarde.');
      }
      
      // Fallback para produtos mockados em caso de erro (opcional)
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const productsData = await productService.getAllProducts();
      setProducts(productsData);
    } catch (error: any) {
      console.error('Erro ao atualizar produtos:', error);
      
      if (error?.response?.status === 403) {
  toast.showInfo('Acesso Negado', 'Você precisa estar logado para visualizar os produtos.');
        router.push('/(auth)/login');
      } else {
  toast.showError('Erro', 'Não foi possível atualizar os produtos');
      }
    } finally {
      setRefreshing(false);
    }
  };

  const filterProducts = useCallback(() => {
    let filtered = [...products];
    if (activeCategory !== 'Tudo') filtered = filtered.filter(p => p.category === activeCategory);
    if (searchQuery) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    setFilteredProducts(filtered);
  }, [products, activeCategory, searchQuery]);

  const handleProductPress = useCallback((product: Product) => {
    setSelectedProduct(product);
    setModalVisible(true);
  }, []);

  const handleAddToCart = (product: Product, quantity: number) => {
    // Verificar se há estoque suficiente
    if (quantity > product.stock) {
      toast.showError('Estoque insuficiente', `Disponível apenas ${product.stock} unidade(s) deste produto.`);
      return;
    }

    addToCart(product, quantity);
    setModalVisible(false);
    toast.showSuccess('Adicionado ao carrinho', `${quantity}x ${product.name} adicionado ao carrinho`);
  };

  const getUserInitials = (name: string) => {
    if (!name) return '?';
    const names = name.trim().split(' ');
    return names.length >= 2
      ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  const addressSummary = useMemo(() => formatAddressSummary(parseAddress(user?.address)), [user?.address]);

  const renderHeader = useMemo(() => (
    <View style={styles.header}>
      <View style={styles.userSection}>
        <View style={styles.userInfo}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <LinearGradient colors={['#00BCD4', '#2196F3']} style={styles.avatar}>
              {user?.name ? (
                <Text style={styles.avatarText}>{getUserInitials(user.name)}</Text>
              ) : (
                <Ionicons name="person" size={28} color="#fff" />
              )}
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.userText}>
            <Text style={styles.welcomeText}>Bem-vindo(a)!</Text>
            <Text style={styles.userName}>{user?.name || 'Visitante'}</Text>
            <Text style={styles.location}>
              {location.city && location.state
                ? `${location.city}, ${location.state}`
                : addressSummary
                  ? addressSummary.length > 30
                    ? `${addressSummary.slice(0, 30)}...`
                    : addressSummary
                  : 'Localização não informada'}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.cartBtn}
          onPress={() => router.push('/(tabs)/cart')}
        >
          <Ionicons name="cart-outline" size={24} color="#666" />
          {totalItems > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>
                {totalItems > 99 ? '99+' : totalItems}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Procure aqui"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.filterBtn}>
          <Ionicons name="options-outline" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.categorySection}>
        <Text style={styles.categoryTitle}>Categoria</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              onPress={() => setActiveCategory(category)}
              style={[
                styles.categoryBtn,
                activeCategory === category && styles.categoryBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  activeCategory === category && styles.categoryTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  ), [user, location, searchQuery, activeCategory, totalItems, router, addressSummary]);

  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <ProductCard
      product={item}
      onPress={() => handleProductPress(item)}
      cardWidth={productLayout.cardWidth}
    />
  ), [handleProductPress, productLayout.cardWidth]);

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name={error ? "alert-circle-outline" : "search-outline"} 
        size={64} 
        color={error ? "#FF6B6B" : "#CCCCCC"} 
      />
      <Text style={styles.emptyText}>
        {error || 'Nenhum produto encontrado'}
      </Text>
      <Text style={styles.emptySubText}>
        {error 
          ? 'Verifique sua conexão e tente novamente'
          : searchQuery 
            ? 'Tente buscar por outro termo' 
            : 'Não há produtos nesta categoria'
        }
      </Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={loadInitialData}
      >
        <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
        <Text style={styles.retryButtonText}>Tentar Novamente</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BCD4" />
        <Text style={styles.loadingText}>Carregando produtos...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        key={productLayout.columns}
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyList}
        numColumns={productLayout.columns}
        columnWrapperStyle={filteredProducts.length > 0 && productLayout.columns > 1
          ? [styles.productRow, { paddingHorizontal: productLayout.horizontalPadding }]
          : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={productLayout.columns === 1
          ? [styles.listContent, { paddingHorizontal: productLayout.horizontalPadding }]
          : styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      <ProductModal
        visible={modalVisible}
        product={selectedProduct}
        onClose={() => {
          setModalVisible(false);
          setSelectedProduct(null);
        }}
        onAddToCart={handleAddToCart}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  userSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userText: {
    flex: 1,
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  location: {
    fontSize: 12,
    color: '#999999',
  },
  cartBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    padding: 0,
  },
  filterBtn: {
    padding: 8,
    marginLeft: 8,
  },
  categorySection: {
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 16,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 80,
    alignItems: 'center',
  },
  categoryBtnActive: {
    backgroundColor: '#00BCD4',
    borderColor: '#00BCD4',
    elevation: 4,
    shadowColor: '#00BCD4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 24,
  },
  productRow: {
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00BCD4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});