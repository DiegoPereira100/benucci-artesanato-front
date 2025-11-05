import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { productService, categoryService } from '@/services/productService';
import { orderService } from '@/services/orderService';
import userService from '@/services/userService';
import { Product } from '@/types/product';
import { User } from '@/types/auth';
import { ProductDTO, CategoryDTO } from '@/services/api';
import Toast from 'react-native-toast-message';
import toast from '../../src/utils/toast';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ProductList from '@/components/admin/ProductList';
import ProductEditModal from '@/components/admin/ProductEditModal';
import { Alert } from 'react-native';

// Helper to map internal order status to readable label
function mapOrderStatus(status: string) {
  switch ((status || '').toLowerCase()) {
    case 'pending':
      return 'Aguardando Pagamento';
    case 'preparing':
      return 'Em Preparação';
    case 'shipped':
      return 'Enviado';
    case 'delivered':
      return 'Pedido Concluído';
    case 'canceled':
      return 'Cancelado';
    default:
      return status || 'Desconhecido';
  }
}
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [selectedTab, setSelectedTab] = useState<'products' | 'orders' | 'users'>('products');

  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ordersUserId, setOrdersUserId] = useState<string>('');
  const isFocused = useIsFocused();
  // Edit product modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductDTO | null>(null);
  
  const [editLoading, setEditLoading] = useState(false);
  const [editCategories, setEditCategories] = useState<CategoryDTO[]>([]);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<number | null>(null);



  useEffect(() => {
    // load initial tab data
    if (selectedTab === 'products') fetchProducts();
    if (selectedTab === 'users') fetchUsers();
  }, [selectedTab]);

  // Recarrega lista de produtos quando a tela volta ao foco (por exemplo, ao voltar da tela de criação)
  useEffect(() => {
    if (isFocused && selectedTab === 'products') {
      fetchProducts();
    }
  }, [isFocused, selectedTab]);

  async function fetchProducts() {
    setError(null);
    setLoading(true);
    try {
      const res = await productService.getAllProducts();
      setProducts(res || []);
    } catch (e: any) {
      setError('Erro ao buscar produtos');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function openEditModal(productId: number) {
    try {
      setError(null);
      setEditLoading(true);
      // buscar product DTO completo
      const dto = await productService.getProductDTO(productId);
      // carregar categorias para select
      const cats = await categoryService.getAllCategories();
      setEditCategories(cats || []);
      setEditingProduct(dto);
      setEditModalVisible(true);
    } catch (e: any) {
      console.error('Erro ao abrir modal de edição:', e);
      setError('Erro ao carregar dados do produto para edição');
    } finally {
      setEditLoading(false);
    }
  }

  function handleDeleteProduct(id: number) {
    console.log('handleDeleteProduct called for id:', id);
    setConfirmTargetId(id);
    setConfirmVisible(true);
  }

  async function deleteConfirmed(id: number) {
    console.log('deleteConfirmed -> deleting id:', id);
    try {
      setLoading(true);
      await productService.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
  toast.showSuccess('Produto excluído', 'Produto removido com sucesso.');
    } catch (e: any) {
      console.error('Erro ao deletar produto:', e);
  toast.showError('Erro', e?.message || 'Não foi possível excluir o produto');
    } finally {
      setLoading(false);
      setConfirmVisible(false);
      setConfirmTargetId(null);
    }
  }

  async function fetchUsers() {
    setError(null);
    setLoading(true);
    try {
      const res = await userService.getAllUsers();
      setUsers(res || []);
    } catch (e: any) {
      setError('Erro ao buscar usuários');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrdersForUser(id: number) {
    setError(null);
    setLoading(true);
    try {
      const res = await orderService.getUserOrders(id);
      setOrders(res || []);
    } catch (e: any) {
      setError('Erro ao buscar pedidos');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateProduct() {
    console.log('Navegando para tela de criação de produto...');
    router.push('/admin/create-product');
  }

  function navigateToTab(tab: 'home' | 'products' | 'profile') {
    // push to the (tabs) route so the bottom tab navigator shows up
    switch (tab) {
      case 'home':
        router.push('/(tabs)/products');
        break;
      case 'products':
        router.push('/(tabs)/products');
        break;
      case 'profile':
        router.push('/(tabs)/profile');
        break;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard do Administrador</Text>
          <Text style={styles.subtitle}>Bem-vindo, {user?.name}!</Text>
        </View>

        <View style={styles.content}>
          {/* Informações do usuário */}
          <View style={styles.infoCard}>
            <Text style={styles.info}>Role: {user?.type}</Text>
            <Text style={styles.info}>Email: {user?.email}</Text>
          </View>

          {/* NOVO: Botão de Cadastrar Produto */}
          <TouchableOpacity
            style={styles.createProductButton}
            onPress={handleCreateProduct}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.buttonIcon}>➕</Text>
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonTitle}>Cadastrar Novo Produto</Text>
                <Text style={styles.buttonSubtitle}>
                  Adicione produtos ao catálogo
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          {/* Abas admin: Produtos / Pedidos / Usuários */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabButton, selectedTab === 'products' && styles.tabButtonActive]}
              onPress={() => setSelectedTab('products')}
            >
              <Text style={[styles.tabText, selectedTab === 'products' && styles.tabTextActive]}>📦 Ver Produtos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, selectedTab === 'orders' && styles.tabButtonActive]}
              onPress={() => setSelectedTab('orders')}
            >
              <Text style={[styles.tabText, selectedTab === 'orders' && styles.tabTextActive]}>📋 Ver Pedidos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, selectedTab === 'users' && styles.tabButtonActive]}
              onPress={() => setSelectedTab('users')}
            >
              <Text style={[styles.tabText, selectedTab === 'users' && styles.tabTextActive]}>👥 Ver Usuários</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabContent}>
            {loading && <ActivityIndicator size="small" color="#FF6B35" />}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {selectedTab === 'products' && (
              <View>
                {products.length === 0 && !loading ? (
                  <Text style={styles.emptyText}>Nenhum produto encontrado.</Text>
                ) : (
                  <ProductList products={products} onEdit={openEditModal} onDelete={handleDeleteProduct} />
                )}

                <ProductEditModal
                  visible={editModalVisible}
                  product={editingProduct}
                  categories={editCategories}
                  loading={editLoading}
                  onCancel={() => { setEditModalVisible(false); setEditingProduct(null); }}
                  onSave={async (payload) => {
                    if (!editingProduct) return;
                    setEditLoading(true);
                    try {
                      const category = editCategories.find(c => String(c.id) === String(payload.categoryId));
                      const updatePayload = {
                        name: payload.name,
                        description: editingProduct.description || '',
                        price: payload.price,
                        stock: payload.stock,
                        imageUrl: editingProduct.imageUrl || '',
                        category: {
                          id: Number(payload.categoryId) || editingProduct.category?.id || null,
                          name: category?.name || editingProduct.category?.name || '',
                        }
                      };

                      const updated = await productService.updateProduct(editingProduct.id, updatePayload);
                      const updatedFront: Product = {
                        id: updated.id,
                        name: updated.name,
                        description: updated.description || '',
                        price: updated.price,
                        category: updated.category?.name || '',
                        image_url: updated.imageUrl || null,
                        stock: updated.stock,
                      };

                      setProducts(prev => prev.map(p => p.id === updatedFront.id ? updatedFront : p));
                      setEditModalVisible(false);
                      setEditingProduct(null);
                      toast.showSuccess('Produto atualizado', 'As alterações foram salvas.');
                    } catch (e: any) {
                      console.error('Erro ao salvar edição:', e);
                      toast.showError('Erro', e?.message || 'Não foi possível atualizar o produto');
                    } finally {
                      setEditLoading(false);
                    }
                  }}
                />
              </View>
            )}

            {selectedTab === 'orders' && (
              <View>
                <Text style={styles.helperText}>Busque os pedidos por ID do usuário</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ID do usuário (ex: 1)"
                  value={ordersUserId}
                  onChangeText={setOrdersUserId}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={styles.fetchButton}
                  onPress={() => {
                    const id = Number(ordersUserId);
                    if (!id) return setError('Informe um ID válido');
                    fetchOrdersForUser(id);
                  }}
                >
                  <Text style={styles.fetchButtonText}>Buscar Pedidos</Text>
                </TouchableOpacity>

                {( !Array.isArray(orders) || orders.length === 0 ) && !loading ? (
                  <Text style={styles.emptyText}>Nenhum pedido para o usuário informado.</Text>
                ) : (
                  React.Children.toArray((Array.isArray(orders) ? orders : []).map((o: any) => {
                    const statusLabel = mapOrderStatus(o?.status ?? 'pending');
                    return (
                      <TouchableOpacity
                        key={o?.id ?? Math.random().toString(36).slice(2,9)}
                        style={styles.listItem}
                        onPress={() => { if (o?.id) router.push(`/admin/orders/${o.id}`); }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.itemTitle}>Pedido #{o.id}</Text>
                        <Text style={styles.itemSubtitle}>{o.user?.name ?? 'Cliente não informado'} • {new Date(o.orderDate ?? Date.now()).toLocaleString()}</Text>
                        <Text style={styles.itemSubtitle}>Status: {statusLabel} • Total: R$ {Number(o.totalAmount ?? o.total ?? 0).toFixed(2)}</Text>
                      </TouchableOpacity>
                    );
                  }))
                )}
              </View>
            )}

            {selectedTab === 'users' && (
              <View>
                {( !Array.isArray(users) || users.length === 0 ) && !loading ? (
                  <Text style={styles.emptyText}>Nenhum usuário encontrado.</Text>
                ) : (
                  React.Children.toArray((Array.isArray(users) ? users : []).map(u => (
                    <View key={u?.id ?? u?.email ?? Math.random().toString(36).slice(2,9)} style={styles.listItem}>
                      <Text style={styles.itemTitle}>{u.name}</Text>
                      <Text style={styles.itemSubtitle}>{u.email} • {u.type}</Text>
                    </View>
                  )))
                )}
              </View>
            )}
          </View>
        </View>
        {/* Modal de edição de produto */}
        

        {/* Logout is handled in the main app navigation; do not render here */}
      </ScrollView>
      <ConfirmModal
        visible={confirmVisible}
        title="Excluir Produto"
        message="Deseja realmente excluir este produto? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        loading={loading}
        onCancel={() => { setConfirmVisible(false); setConfirmTargetId(null); }}
        onConfirm={() => { if (confirmTargetId) deleteConfirmed(confirmTargetId); }}
      />
    </SafeAreaView>
  );
}

export const unstable_settings = {
  title: 'Dashboard',
  headerShown: false,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
  content: {
    flex: 1,
    gap: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  info: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  // NOVO: Estilos para o botão de cadastrar produto
  createProductButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  buttonSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  // Card de ações rápidas
  quickActionsCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  quickActionButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  // Botão de logout
  logoutButton: {
    backgroundColor: '#f44336',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // --- Novos estilos para abas e listas ---
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FF6B35',
  },
  tabText: {
    color: '#333',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabContent: {
    marginTop: 12,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 8,
  },
  emptyText: {
    color: '#666',
    fontStyle: 'italic',
  },
  listItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  itemSubtitle: {
    color: '#666',
  },
  helperText: {
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f7f7f7',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  fetchButton: {
    backgroundColor: '#FF6B35',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  fetchButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  // small buttons for actions
  smallButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: {
    color: '#FF6B35',
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#f44336',
    borderColor: '#f44336',
  },
  // modal styles (reused from create-product)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 520,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonConfirm: {
    backgroundColor: '#FF6B35',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextCancel: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
    marginBottom: 8,
  },
});
