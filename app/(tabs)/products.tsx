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
  Alert,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Product } from '@/types/product';
import { User } from '@/types/auth';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';

// ✅ importação dos novos componentes
import { ProductCard } from '@/components/ui/ProductCard';
import { ProductModal } from '@/components/ui/ProductModal';

const { width } = Dimensions.get('window');

export default function ExploreScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState('Tudo');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const { user } = useAuth();
  
  const [location, setLocation] = useState<{ city: string; state: string }>({ city: '', state: '' });

  // ✅ estados para o modal
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
      const getImageUri = () => {
        try {
          if (Platform.OS !== 'web') {
            return Image.resolveAssetSource(require('@/assets/images/gato.png')).uri;
          }
          return '/assets/images/gato.png';
        } catch {
          return 'https://via.placeholder.com/200x200.png?text=Produto';
        }
      };

      const imageUri = getImageUri();
      const mockProducts = [
        { id: 1, name: 'Mandala Colorida', description: 'Linda mandala colorida', price: 35.90, category: 'Mandala', image_url: imageUri },
        { id: 2, name: 'Chaveiro Gato', description: 'Chaveiro em formato de gato', price: 15.50, category: 'Chaveiro', image_url: imageUri },
        { id: 3, name: 'Porta Chaves Decorado', description: 'Porta chaves decorativo', price: 45.00, category: 'Porta chaves', image_url: imageUri },
        { id: 4, name: 'Imã Geladeira', description: 'Imã decorativo para geladeira', price: 12.00, category: 'Imã', image_url: imageUri },
        { id: 5, name: 'Gato Decorativo', description: 'Gato decorativo de parede', price: 28.90, category: 'Gato', image_url: imageUri },
        { id: 6, name: 'Mandala Grande', description: 'Mandala grande e detalhada', price: 65.00, category: 'Mandala', image_url: imageUri },
      ];

      setProducts(mockProducts);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Não foi possível carregar os produtos');
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = useCallback(() => {
    let filtered = [...products];
    if (activeCategory !== 'Tudo') filtered = filtered.filter(p => p.category === activeCategory);
    if (searchQuery) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    setFilteredProducts(filtered);
  }, [products, activeCategory, searchQuery]);

  // ✅ agora o clique abre o modal
  const handleProductPress = (product: Product) => {
    setSelectedProduct(product);
    setModalVisible(true);
  };

  const getUserInitials = (name: string) => {
    if (!name) return '?';
    const names = name.trim().split(' ');
    return names.length >= 2
      ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  const renderHeader = useMemo(() => (
    <View style={styles.header}>
      <View style={styles.userSection}>
        <View style={styles.userInfo}>
          <LinearGradient colors={['#00BCD4', '#2196F3']} style={styles.avatar}>
            {user?.name ? (
              <Text style={styles.avatarText}>{getUserInitials(user.name)}</Text>
            ) : (
              <Ionicons name="person" size={28} color="#fff" />
            )}
          </LinearGradient>
          <View style={styles.userText}>
            <Text style={styles.welcomeText}>Bem-vindo(a)!</Text>
            <Text style={styles.userName}>{user?.name || 'Visitante'}</Text>
            <Text style={styles.location}>
              {location.city && location.state
                ? `${location.city}, ${location.state}`
                : user?.address
                  ? user.address.substring(0, 30) + (user.address.length > 30 ? '...' : '')
                  : 'Localização não informada'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notificationBtn}>
          <Ionicons name="notifications-outline" size={24} color="#666" />
          <View style={styles.notificationDot} />
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
  ), [user, location, searchQuery, activeCategory]);

  // ✅ substituído por ProductCard
  const renderProduct = ({ item }: { item: Product }) => (
    <ProductCard product={item} onPress={() => handleProductPress(item)} />
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={64} color="#CCCCCC" />
      <Text style={styles.emptyText}>Nenhum produto encontrado</Text>
      <Text style={styles.emptySubText}>
        {searchQuery ? 'Tente buscar por outro termo' : 'Não há produtos nesta categoria'}
      </Text>
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
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyList}
        numColumns={2}
        columnWrapperStyle={filteredProducts.length > 0 ? styles.productRow : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />

      {/* ✅ modal de detalhes */}
      <ProductModal
        visible={modalVisible}
        product={selectedProduct}
        onClose={() => {
          setModalVisible(false);
          setSelectedProduct(null);
        }}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  // Container Principal
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Loading State
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

  // Header Section
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },

  // User Section
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
  notificationBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    backgroundColor: '#F44336',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // Search Section
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

  // Category Section
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

  // Product List
  listContent: {
    paddingBottom: 24,
  },
  productRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 4,
  },

  // Product Card
  productCard: {
    width: (width - 52) / 2,
    marginBottom: 16,
  },
  productGradient: {
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    minHeight: 220,
    justifyContent: 'space-between',
  },
  productImage: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    overflow: 'hidden',
  },
  productImageContent: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productEmoji: {
    fontSize: 48,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 6,
    textAlign: 'center',
    lineHeight: 20,
    minHeight: 40,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00BCD4',
  },

  // Empty State
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
  },
});