import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  useWindowDimensions,
  StatusBar,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Product } from '@/types/product';
import { productService } from '@/services/productService';
import { mlService } from '@/services/mlService';
import { useCart } from '@/contexts/CartContext';
import toast from '../../src/utils/toast';
import { ProductCard } from '@/components/ui/ProductCard';

export default function ProductDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const { width } = useWindowDimensions();

  const [product, setProduct] = useState<Product | null>(null);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (id) {
      fetchProductDetails(Number(id));
      fetchRecommendations(Number(id));
    }
  }, [id]);

  const handleIncrement = () => {
    if (product && quantity < product.stock) {
      setQuantity(prev => prev + 1);
    } else {
      toast.showInfo('Limite atingido', 'Quantidade máxima em estoque alcançada');
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const fetchProductDetails = async (productId: number) => {
    try {
      setLoading(true);
      const data = await productService.getProductById(productId);
      setProduct(data);
    } catch (error) {
      console.error('Erro ao buscar detalhes do produto:', error);
      toast.showError('Erro', 'Não foi possível carregar os detalhes do produto.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async (productId: number) => {
    try {
      setLoadingRecs(true);
      const recs = await mlService.getRecommendations(productId);
      setRecommendations(recs);
    } catch (error) {
      console.error('Erro ao buscar recomendações:', error);
    } finally {
      setLoadingRecs(false);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (product.stock <= 0) {
      toast.showError('Esgotado', 'Este produto não está disponível no momento.');
      return;
    }
    addToCart(product, quantity);
    toast.showSuccess('Adicionado', `${quantity}x ${product.name} adicionado(s) ao carrinho.`);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setActiveIndex(index);
  };

  const isOutOfStock = (product?.stock ?? 0) <= 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BCD4" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Produto não encontrado.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Prepare images list
  const productImages = product.gallery && product.gallery.length > 0 
    ? product.gallery 
    : (product.image_url ? [product.image_url] : []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />
      
      {/* Header Flutuante */}
      <View style={styles.floatingHeader}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.roundButton}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Carrossel de Imagens */}
        <View style={styles.imageContainer}>
          {productImages.length > 0 ? (
            <FlatList
              data={productImages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              keyExtractor={(_, index) => index.toString()}
              renderItem={({ item }) => (
                <Image 
                  source={{ uri: item }} 
                  style={[styles.productImage, { width }, isOutOfStock && styles.productImageOutOfStock]} 
                  resizeMode="cover" 
                />
              )}
            />
          ) : (
            <View style={[styles.productImage, styles.placeholderImage, isOutOfStock && styles.productImageOutOfStock]}>
              <Ionicons name="image-outline" size={80} color="#CBD5E1" />
            </View>
          )}
          
          {/* Indicadores (Dots) */}
          {productImages.length > 1 && (
            <View style={styles.pagination}>
              {productImages.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    activeIndex === index ? styles.activeDot : styles.inactiveDot,
                  ]}
                />
              ))}
            </View>
          )}
          
          {isOutOfStock && (
            <View style={styles.outOfStockOverlay}>
              <View style={styles.outOfStockBadge}>
                <Ionicons name="alert-circle-outline" size={20} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.outOfStockText}>ESGOTADO</Text>
              </View>
            </View>
          )}
        </View>

        {/* Conteúdo em Sheet */}
        <View style={styles.sheetContainer}>
          <View style={styles.handleBar} />
          
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.categoryText}>{product.category || 'Artesanato'}</Text>
              <Text style={styles.productName}>{product.name}</Text>
            </View>
            <Text style={styles.productPrice}>R$ {Number(product.price).toFixed(2)}</Text>
          </View>

          <View style={styles.divider} />

          {/* Descrição */}
          <Text style={styles.sectionTitle}>Sobre o produto</Text>
          <Text style={styles.descriptionText}>{product.description}</Text>

          {/* Seletor de Quantidade */}
          {!isOutOfStock && (
            <View style={styles.quantitySection}>
              <Text style={styles.sectionTitle}>Quantidade</Text>
              <View style={styles.quantityRow}>
                <View style={styles.quantityControls}>
                  <TouchableOpacity onPress={handleDecrement} style={styles.quantityButton}>
                    <Ionicons name="remove" size={20} color="#0F172A" />
                  </TouchableOpacity>
                  <Text style={styles.quantityValue}>{quantity}</Text>
                  <TouchableOpacity onPress={handleIncrement} style={styles.quantityButton}>
                    <Ionicons name="add" size={20} color="#0F172A" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.stockInfo}>
                  {product.stock} unidades disponíveis
                </Text>
              </View>
            </View>
          )}

          {/* Recomendados */}
          {recommendations.length > 0 && (
            <View style={styles.recommendationsSection}>
              <Text style={styles.sectionTitle}>Você também pode gostar</Text>
              {loadingRecs ? (
                <ActivityIndicator size="small" color="#00BCD4" style={{ marginTop: 20 }} />
              ) : (
                <FlatList
                  data={recommendations}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <View style={{ marginRight: 16 }}>
                      <ProductCard
                        product={item}
                        onPress={() => router.push(`/product/${item.id}`)}
                        cardWidth={150}
                      />
                    </View>
                  )}
                  contentContainerStyle={{ paddingVertical: 10 }}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer Fixo */}
      <View style={styles.footer}>
        <TouchableOpacity 
          activeOpacity={0.9}
          onPress={handleAddToCart}
          disabled={isOutOfStock}
          style={{ flex: 1 }}
        >
          <LinearGradient
            colors={isOutOfStock ? ['#94A3B8', '#64748B'] : ['#00BCD4', '#00ACC1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addToCartButton}
          >
            <Ionicons name={isOutOfStock ? "close-circle-outline" : "cart-outline"} size={22} color="#FFF" />
            <Text style={styles.addToCartText}>
              {isOutOfStock ? 'Produto Indisponível' : 'Adicionar ao Carrinho'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 16,
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    color: '#00BCD4',
    fontSize: 16,
    fontWeight: '600',
  },
  floatingHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageContainer: {
    width: '100%',
    height: 450,
    backgroundColor: '#FFF',
    position: 'relative',
  },
  productImage: {
    height: '100%',
  },
  productImageOutOfStock: {
    opacity: 0.5,
  },
  placeholderImage: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 50, // Above the sheet container overlap
    alignSelf: 'center',
    zIndex: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#00BCD4',
    width: 12,
  },
  inactiveDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    zIndex: 10,
  },
  outOfStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ rotate: '-5deg' }],
  },
  outOfStockText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1,
  },
  sheetContainer: {
    marginTop: -40,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 10,
    minHeight: 500,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  categoryText: {
    fontSize: 14,
    color: '#00BCD4',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 32,
    marginRight: 12,
  },
  productPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00BCD4',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 24,
    marginBottom: 24,
  },
  quantitySection: {
    marginBottom: 32,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
  },
  quantityButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    width: 40,
    textAlign: 'center',
  },
  stockInfo: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  recommendationsSection: {
    marginBottom: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 20,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
  },
  addToCartText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
