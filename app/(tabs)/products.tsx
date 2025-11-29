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
import { categoryService, CategoryDTO } from '@/services/categoryService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pagination } from '@/components/ui/Pagination';

export default function ExploreScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: number | null; name: string }>>([
    { id: null, name: 'Tudo' },
  ]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priceSort, setPriceSort] = useState<'asc' | 'desc' | null>(null);
  const [alphaSort, setAlphaSort] = useState(false);
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
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, { id: number; name: string }>>({});

  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isClientMode, setIsClientMode] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const isFiltering = activeCategoryId !== null || searchQuery.trim() !== '' || priceSort !== null || alphaSort;
      setIsClientMode(isFiltering);
      if (isFiltering) {
        fetchProducts(0, 1000);
      } else {
        fetchProducts(0, 10);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [activeCategoryId, searchQuery, priceSort, alphaSort]);

  const loadCategories = useCallback(async () => {
    try {
      const categories: CategoryDTO[] | undefined = await categoryService.getAllCategories();
      if (!categories || categories.length === 0) {
        setCategoryOptions([{ id: null, name: 'Tudo' }]);
        if (activeCategoryId !== null) {
          setActiveCategoryId(null);
        }
        return;
      }

      const seen = new Set<number>();
      const normalized = categories.reduce<Array<{ id: number; name: string }>>((acc, category) => {
        const parsedId = category?.id ? Number(category.id) : NaN;
        const label = category?.name?.trim();
        if (!label || Number.isNaN(parsedId) || parsedId <= 0 || seen.has(parsedId)) {
          return acc;
        }
        seen.add(parsedId);
        acc.push({ id: parsedId, name: label });
        return acc;
      }, []);

      setCategoryOptions([{ id: null, name: 'Tudo' }, ...normalized]);
      if (activeCategoryId !== null && !seen.has(activeCategoryId)) {
        setActiveCategoryId(null);
      }
    } catch (error) {
      console.warn('products.tsx -> failed to load categories', error);
      setCategoryOptions([{ id: null, name: 'Tudo' }]);
      if (activeCategoryId !== null) {
        setActiveCategoryId(null);
      }
    }
  }, [activeCategoryId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const loadOverrides = async () => {
      try {
        const stored = await AsyncStorage.getItem('@product_category_overrides');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            setCategoryOverrides(parsed);
          }
        }
      } catch (error) {
        console.warn('products.tsx -> failed to load category overrides', error);
      }
    };
    loadOverrides();
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
  }, [products, activeCategoryId, searchQuery, priceSort, alphaSort]);

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

  const fetchProducts = async (pageNumber: number, pageSize: number = 10) => {
    try {
      setLoading(true);
      setError(null);
      
      // Verificar se o usuário está autenticado
      if (!user) {
        console.warn('Usuário não autenticado, tentando carregar produtos...');
      }
      
      // Buscar produtos reais da API
      const overridesRaw = await AsyncStorage.getItem('@product_category_overrides');
      let overrides: Record<string, { id: number; name: string }> = {};
      if (overridesRaw) {
        try {
          const parsed = JSON.parse(overridesRaw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            overrides = parsed;
            setCategoryOverrides(parsed);
          }
        } catch (parseErr) {
          console.warn('products.tsx -> failed to parse overrides while loading products', parseErr);
        }
      }

      const result = await productService.getProductsPage(pageNumber, pageSize);
      const productsData = result.items;
      
      const patchedProducts = productsData.map((product) => {
        const override = overrides[String(product.id)];
        if (override) {
          return {
            ...product,
            category: override.name,
            categoryId: override.id,
          };
        }
        return product;
      });
      setProducts(patchedProducts);
      
      // If we fetched a large page (filtering mode), we handle pagination on client side
      if (pageSize > 10) {
        setPage(0);
        // Total pages will be calculated in filterProducts or render
      } else {
        setPage(result.page);
        setTotalPages(result.totalPages);
      }

      await loadCategories();
      
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

  const loadInitialData = () => fetchProducts(0);

  const handlePageChange = (newPage: number) => {
    if (isClientMode) {
      setPage(newPage);
    } else {
      fetchProducts(newPage, 10);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const isFiltering = activeCategoryId !== null || searchQuery.trim() !== '' || priceSort !== null || alphaSort;
    await fetchProducts(0, isFiltering ? 1000 : 10);
    setRefreshing(false);
  };

  const filterProducts = useCallback(() => {
    let filtered = [...products];

    if (activeCategoryId !== null) {
      filtered = filtered.filter((product) => {
        const override = categoryOverrides[String(product.id)];
        const productCategoryId = product.categoryId ?? override?.id ?? null;
        if (productCategoryId == null) {
          return false;
        }
        return Number(productCategoryId) === activeCategoryId;
      });
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery) {
      filtered = filtered.filter((product) => {
        const pool = [product.name, product.category, product.subcategoryName]
          .filter(Boolean)
          .map((value) => value!.toString().toLowerCase());
        return pool.some((value) => value.includes(normalizedQuery));
      });
    }

    if (alphaSort) {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (priceSort === 'asc') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (priceSort === 'desc') {
      filtered.sort((a, b) => b.price - a.price);
    }

    setFilteredProducts(filtered);
    
    if (isClientMode) {
      setTotalPages(Math.ceil(filtered.length / 10));
    }
  }, [products, activeCategoryId, searchQuery, priceSort, alphaSort, categoryOverrides, isClientMode]);

  const handleProductPress = useCallback((product: Product) => {
    setSelectedProduct(product);
    setModalVisible(true);
  }, []);

  const togglePriceSort = useCallback((direction: 'asc' | 'desc') => {
    setPriceSort((current) => (current === direction ? null : direction));
    setAlphaSort(false);
  }, []);

  const toggleAlphaSort = useCallback(() => {
    setAlphaSort((current) => {
      if (!current) {
        setPriceSort(null);
      }
      return !current;
    });
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
            <LinearGradient colors={['#00BCD4', '#00BCD4']} style={styles.avatar}>
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

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Ordenar produtos</Text>
        <View style={styles.sortButtons}>
          <TouchableOpacity
            style={[styles.sortButton, priceSort === 'asc' && styles.sortButtonActive]}
            onPress={() => togglePriceSort('asc')}
          >
            <Ionicons
              name="arrow-up-outline"
              size={16}
              color={priceSort === 'asc' ? '#fff' : '#4B5563'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, priceSort === 'desc' && styles.sortButtonActive]}
            onPress={() => togglePriceSort('desc')}
          >
            <Ionicons
              name="arrow-down-outline"
              size={16}
              color={priceSort === 'desc' ? '#fff' : '#4B5563'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortButton, alphaSort && styles.sortButtonActive]}
            onPress={toggleAlphaSort}
          >
            <Text style={[styles.sortButtonLabel, alphaSort && styles.sortButtonLabelActive]}>A-Z</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.categorySection}>
        <Text style={styles.categoryTitle}>Categoria</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {categoryOptions.map((option) => {
            const isActive = activeCategoryId === option.id;
            return (
              <TouchableOpacity
                key={option.id ?? 'all'}
                onPress={() => setActiveCategoryId(option.id)}
                style={[styles.categoryBtn, isActive && styles.categoryBtnActive]}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {option.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  ), [user, location, searchQuery, categoryOptions, activeCategoryId, priceSort, alphaSort, totalItems, router, addressSummary, togglePriceSort, toggleAlphaSort]);

  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <ProductCard
      product={item}
      onPress={() => handleProductPress(item)}
      cardWidth={productLayout.cardWidth}
    />
  ), [handleProductPress, productLayout.cardWidth]);

  const renderEmptyList = () => {
    if (loading) {
      return (
        <View style={[styles.emptyContainer, { paddingVertical: 100 }]}>
          <ActivityIndicator size="large" color="#00BCD4" />
          <Text style={styles.loadingText}>Carregando produtos...</Text>
        </View>
      );
    }

    return (
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
          onPress={() => fetchProducts(0)}
        >
          <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const visibleProducts = useMemo(() => {
    if (isClientMode) {
      const start = page * 10;
      const end = start + 10;
      return filteredProducts.slice(start, end);
    }
    return filteredProducts;
  }, [filteredProducts, page, isClientMode]);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        key={productLayout.columns}
        data={loading ? [] : visibleProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyList}
        numColumns={productLayout.columns}
        columnWrapperStyle={!loading && visibleProducts.length > 0 && productLayout.columns > 1
          ? [styles.productRow, { paddingHorizontal: productLayout.horizontalPadding }]
          : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={productLayout.columns === 1
          ? [styles.listContent, { paddingHorizontal: productLayout.horizontalPadding }]
          : styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListFooterComponent={
          !loading && filteredProducts.length > 0 ? (
            <View style={{ paddingBottom: 20 }}>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </View>
          ) : null
        }
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
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  sortButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sortButtonActive: {
    backgroundColor: '#00BCD4',
    borderColor: '#00BCD4',
  },
  sortButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  sortButtonLabelActive: {
    color: '#FFFFFF',
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
    marginTop: 80,
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
  pagination: {
    marginTop: 16,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
});