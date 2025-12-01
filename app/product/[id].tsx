import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

  useEffect(() => {
    if (id) {
      fetchProductDetails(Number(id));
      fetchRecommendations(Number(id));
    }
  }, [id]);

  const handleIncrement = () => {
    setQuantity(prev => prev + 1);
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
    addToCart(product, quantity);
    toast.showSuccess('Adicionado', `${quantity}x ${product.name} adicionado(s) ao carrinho.`);
  };

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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informações do Produto</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Imagem Principal */}
        <View style={styles.imageContainer}>
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.productImage} resizeMode="contain" />
          ) : (
            <View style={[styles.productImage, styles.placeholderImage]}>
              <Ionicons name="image-outline" size={64} color="#CBD5E1" />
            </View>
          )}
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productPrice}>R$ {Number(product.price).toFixed(2)}</Text>
          </View>

          {/* Descrição */}
          <Text style={styles.sectionTitle}>Descrição</Text>
          <Text style={styles.descriptionText}>{product.description}</Text>

          {/* Seletor de Quantidade */}
          <View style={styles.quantityContainer}>
            <Text style={styles.quantityLabel}>Quantidade</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity onPress={handleDecrement} style={styles.quantityButton}>
                <Ionicons name="remove" size={24} color="#00BCD4" />
              </TouchableOpacity>
              <Text style={styles.quantityValue}>{quantity}</Text>
              <TouchableOpacity onPress={handleIncrement} style={styles.quantityButton}>
                <Ionicons name="add" size={24} color="#00BCD4" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Recomendados */}
          <Text style={styles.sectionTitle}>Recomendados</Text>
          {loadingRecs ? (
            <ActivityIndicator size="small" color="#00BCD4" style={{ marginTop: 20 }} />
          ) : recommendations.length > 0 ? (
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
                    cardWidth={160}
                  />
                </View>
              )}
              contentContainerStyle={{ paddingVertical: 10 }}
            />
          ) : (
            <Text style={styles.emptyRecsText}>Sem recomendações no momento.</Text>
          )}
        </View>
      </ScrollView>

      {/* Botão de Adicionar ao Carrinho Fixo */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.addToCartButton} onPress={handleAddToCart}>
          <Ionicons name="cart-outline" size={20} color="#FFF" />
          <Text style={styles.addToCartText}>Adicionar ao Carrinho</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50, // Ajuste para Safe Area
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    paddingHorizontal: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  productName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 10,
  },
  productPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00BCD4',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 12,
    marginTop: 20,
  },
  sizesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00BCD4',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  sizeButtonSelected: {
    backgroundColor: '#00BCD4',
  },
  sizeText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  sizeTextSelected: {
    color: '#FFFFFF',
  },
  descriptionText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 22,
  },
  quantityContainer: {
    marginTop: 24,
    marginBottom: 24,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignSelf: 'flex-start',
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quantityButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    shadowColor: '#00BCD4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginHorizontal: 20,
    minWidth: 24,
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewItem: {
    marginBottom: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  reviewText: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 40, // Alinhar com o texto abaixo do ícone
  },
  emptyRecsText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: 30, // Ajuste para Safe Area
  },
  addToCartButton: {
    backgroundColor: '#00BCD4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addToCartText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
