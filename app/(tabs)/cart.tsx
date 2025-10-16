import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import toast from '../../src/utils/toast';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCart, CartItem } from '@/contexts/CartContext';

export default function CartScreen() {
  const router = useRouter();
  const { cartItems, updateItemQuantity, removeFromCart, cartTotal, totalItems } = useCart();
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const [confirmTarget, setConfirmTarget] = React.useState<{ id: number; name: string } | null>(null);

  const handleIncrement = (productId: number, currentQuantity: number) => {
    updateItemQuantity(productId, currentQuantity + 1);
  };

  const handleDecrement = (productId: number, currentQuantity: number) => {
    if (currentQuantity > 1) {
      updateItemQuantity(productId, currentQuantity - 1);
    }
  };

  const handleRemove = (productId: number, productName: string) => {
    setConfirmTarget({ id: productId, name: productName });
    setConfirmVisible(true);
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
  toast.showInfo('Carrinho vazio', 'Adicione produtos ao carrinho antes de finalizar a compra.');
      return;
    }

    // TODO: Implementar navegação para tela de checkout
    console.log('Finalizando compra:', {
      items: cartItems,
      total: cartTotal,
    });

  toast.showInfo('Checkout', `Total: R$ ${cartTotal.toFixed(2).replace('.', ',')} — Em breve redirecionaremos para pagamento.`);
  };

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const itemTotal = item.product.price * item.quantity;

    return (
      <View style={styles.cartItem}>
        <View style={styles.itemImageContainer}>
          {item.product.image_url ? (
            <Image
              source={{ uri: item.product.image_url }}
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="image-outline" size={40} color="#CCCCCC" />
            </View>
          )}
        </View>

        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.product.name}
          </Text>
          <Text style={styles.itemCategory}>{item.product.category}</Text>
          <Text style={styles.itemPrice}>
            R$ {item.product.price.toFixed(2).replace('.', ',')}
          </Text>
        </View>

        <View style={styles.itemActions}>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemove(item.product.id, item.product.name)}
          >
            <Ionicons name="trash-outline" size={20} color="#F44336" />
          </TouchableOpacity>

          <View style={styles.quantityControl}>
            <TouchableOpacity
              style={[styles.quantityBtn, item.quantity === 1 && styles.quantityBtnDisabled]}
              onPress={() => handleDecrement(item.product.id, item.quantity)}
              disabled={item.quantity === 1}
            >
              <Ionicons
                name="remove"
                size={18}
                color={item.quantity === 1 ? '#CCCCCC' : '#00BCD4'}
              />
            </TouchableOpacity>

            <Text style={styles.quantityText}>{item.quantity}</Text>

            <TouchableOpacity
              style={styles.quantityBtn}
              onPress={() => handleIncrement(item.product.id, item.quantity)}
            >
              <Ionicons name="add" size={18} color="#00BCD4" />
            </TouchableOpacity>
          </View>

          <Text style={styles.itemTotal}>
            R$ {itemTotal.toFixed(2).replace('.', ',')}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyCart = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cart-outline" size={100} color="#CCCCCC" />
      <Text style={styles.emptyTitle}>Seu carrinho está vazio</Text>
      <Text style={styles.emptySubtitle}>
        Adicione produtos para começar suas compras
      </Text>
      <TouchableOpacity
        style={styles.shopButton}
        onPress={() => router.push('/(tabs)/products')}
      >
        <LinearGradient
          colors={['#00BCD4', '#2196F3']}
          style={styles.shopButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons name="storefront" size={24} color="#FFF" />
          <Text style={styles.shopButtonText}>Voltar às Compras</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (cartItems.length === 0) return null;

    return (
      <View style={styles.footer}>
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal ({totalItems} itens)</Text>
            <Text style={styles.summaryValue}>
              R$ {cartTotal.toFixed(2).replace('.', ',')}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              R$ {cartTotal.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={handleCheckout}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#00BCD4', '#2196F3']}
            style={styles.checkoutGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.checkoutText}>Finalizar Compra</Text>
            <Ionicons name="arrow-forward" size={24} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Carrinho</Text>
        <View style={styles.headerRight}>
          {cartItems.length > 0 && (
            <View style={styles.itemCountBadge}>
              <Text style={styles.itemCountText}>{totalItems}</Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={cartItems}
        renderItem={renderCartItem}
        keyExtractor={(item) => item.product.id.toString()}
        ListEmptyComponent={renderEmptyCart}
        contentContainerStyle={[
          styles.listContent,
          cartItems.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      />

      {renderFooter()}
      <ConfirmModal
        visible={confirmVisible}
        title="Remover item"
        message={confirmTarget ? `Deseja remover "${confirmTarget.name}" do carrinho?` : ''}
        confirmText="Remover"
        cancelText="Cancelar"
        onCancel={() => { setConfirmVisible(false); setConfirmTarget(null); }}
  onConfirm={() => { if (confirmTarget) { removeFromCart(confirmTarget.id); setConfirmVisible(false); setConfirmTarget(null); toast.showSuccess('Removido', `"${confirmTarget.name}" removido do carrinho.`); } }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  itemCountBadge: {
    backgroundColor: '#00BCD4',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  itemCountText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listContent: {
    paddingVertical: 16,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 6,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00BCD4',
  },
  itemActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: 8,
  },
  removeButton: {
    padding: 4,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 4,
  },
  quantityBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  quantityBtnDisabled: {
    opacity: 0.5,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
  },
  shopButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#00BCD4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  shopButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 12,
  },
  shopButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  summaryContainer: {
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00BCD4',
  },
  checkoutButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#00BCD4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  checkoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  checkoutText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});