import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Product } from '@/types/product';

const { width, height } = Dimensions.get('window');

interface ProductModalProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

export function ProductModal({ visible, product, onClose, onAddToCart }: ProductModalProps) {
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const handleClose = () => {
    setQuantity(1);
    onClose();
  };

  const handleIncrement = () => {
    setQuantity(prev => prev + 1);
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const handleAddToCart = () => {
    onAddToCart(product, quantity);
    setQuantity(1);
  };

  const totalPrice = product.price * quantity;
  const isOutOfStock = product.stock === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.imageContainer}>
              {product.image_url ? (
                <Image
                  source={{ uri: product.image_url }}
                  style={[styles.productImage, isOutOfStock && { opacity: 0.7 }]}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.placeholderImage}>
                  <Ionicons name="image-outline" size={80} color="#CCCCCC" />
                </View>
              )}
              {isOutOfStock && (
                <View style={styles.outOfStockBadge}>
                  <Text style={styles.outOfStockText}>ESGOTADO</Text>
                </View>
              )}
            </View>

            <View style={styles.infoContainer}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{product.category}</Text>
              </View>

              <Text style={styles.productName}>{product.name}</Text>
              
              <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>Preço unitário:</Text>
                <Text style={styles.productPrice}>
                  R$ {product.price.toFixed(2).replace('.', ',')}
                </Text>
              </View>

              <Text style={styles.descriptionLabel}>Descrição</Text>
              <Text style={styles.productDescription}>
                {product.description || 'Produto artesanal de alta qualidade.'}
              </Text>

              <View style={styles.divider} />

              <Text style={styles.quantityLabel}>Quantidade</Text>
              <View style={styles.quantityContainer}>
                <TouchableOpacity
                  style={[styles.quantityButton, (quantity === 1 || isOutOfStock) && styles.quantityButtonDisabled]}
                  onPress={handleDecrement}
                  disabled={quantity === 1 || isOutOfStock}
                >
                  <Ionicons 
                    name="remove" 
                    size={24} 
                    color={(quantity === 1 || isOutOfStock) ? '#CCCCCC' : '#00BCD4'} 
                  />
                </TouchableOpacity>

                <View style={styles.quantityDisplay}>
                  <Text style={[styles.quantityText, isOutOfStock && { color: '#999' }]}>{isOutOfStock ? 0 : quantity}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.quantityButton, isOutOfStock && styles.quantityButtonDisabled]}
                  onPress={handleIncrement}
                  disabled={isOutOfStock}
                >
                  <Ionicons name="add" size={24} color={isOutOfStock ? '#CCCCCC' : '#00BCD4'} />
                </TouchableOpacity>
              </View>

              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalPrice}>
                  R$ {isOutOfStock ? '0,00' : totalPrice.toFixed(2).replace('.', ',')}
                </Text>
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.addToCartButton, isOutOfStock && styles.addToCartButtonDisabled]}
            onPress={isOutOfStock ? undefined : handleAddToCart}
            activeOpacity={isOutOfStock ? 1 : 0.8}
            disabled={isOutOfStock}
          >
            <LinearGradient
              colors={isOutOfStock ? ['#BDBDBD', '#9E9E9E'] : ['#00BCD4', '#00BCD4']}
              style={styles.addToCartGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name={isOutOfStock ? "close-circle" : "cart"} size={24} color="#FFF" />
              <Text style={styles.addToCartText}>
                {isOutOfStock ? "Produto Esgotado" : "Adicionar ao Carrinho"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: height * 0.9,
    paddingBottom: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    padding: 24,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryText: {
    color: '#00BCD4',
    fontSize: 12,
    fontWeight: '600',
  },
  productName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
    lineHeight: 32,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666666',
    marginRight: 8,
  },
  productPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00BCD4',
  },
  descriptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  productDescription: {
    fontSize: 15,
    color: '#666666',
    lineHeight: 22,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 20,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  quantityButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  quantityButtonDisabled: {
    opacity: 0.5,
  },
  quantityDisplay: {
    marginHorizontal: 32,
    minWidth: 60,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  totalPrice: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#00BCD4',
  },
  addToCartButton: {
    marginHorizontal: 24,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#00BCD4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addToCartGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  addToCartText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addToCartButtonDisabled: {
    opacity: 0.9,
    elevation: 0,
    shadowOpacity: 0,
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#FF5252',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
  },
  outOfStockText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});