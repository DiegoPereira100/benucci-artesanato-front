import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { orderService } from '@/services/orderService';
import toast from '../../src/utils/toast';

const palette = {
  primary: '#00BCD4',
  background: '#F4F6FB',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#94A3B8',
  border: '#E2E8F0',
  success: '#16A34A',
  warning: '#F97316',
  danger: '#DC2626',
  info: '#2563EB',
};

function mapOrderStatus(status: string) {
  switch ((status || '').toLowerCase()) {
    case 'pending':
      return { label: 'Aguardando Pagamento', color: palette.warning, icon: 'time-outline' };
    case 'preparing':
      return { label: 'Em Preparação', color: palette.info, icon: 'cube-outline' };
    case 'shipped':
      return { label: 'Enviado', color: palette.primary, icon: 'rocket-outline' };
    case 'delivered':
      return { label: 'Entregue', color: palette.success, icon: 'checkmark-circle-outline' };
    case 'canceled':
      return { label: 'Cancelado', color: palette.danger, icon: 'close-circle-outline' };
    default:
      return { label: status || 'Desconhecido', color: palette.muted, icon: 'help-circle-outline' };
  }
}

export default function UserOrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    if (!user) return;
    try {
      const data = await orderService.getUserOrders(Number(user.id));
      // Sort by date desc
      const sorted = Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [];
      setOrders(sorted);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
      toast.showError('Erro', 'Não foi possível carregar seus pedidos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const renderItem = ({ item }: { item: any }) => {
    const statusInfo = mapOrderStatus(item.status);
    const date = new Date(item.orderDate ?? item.createdAt ?? Date.now()).toLocaleDateString('pt-BR');
    const total = Number(item.totalAmount ?? item.total ?? 0).toFixed(2);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/orders/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>Pedido #{item.id}</Text>
          <Text style={styles.date}>{date}</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Ionicons name={statusInfo.icon as any} size={14} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
          <Text style={styles.total}>R$ {total}</Text>
        </View>
        
        <View style={styles.arrowContainer}>
            <Text style={styles.detailsText}>Ver detalhes</Text>
            <Ionicons name="chevron-forward" size={16} color={palette.muted} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Meus Pedidos</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={orders}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[palette.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={palette.muted} />
            <Text style={styles.emptyText}>Você ainda não fez nenhum pedido.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  date: {
    fontSize: 14,
    color: palette.muted,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  total: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.primary,
  },
  arrowContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: '#F1F5F9',
      paddingTop: 12,
      gap: 4,
  },
  detailsText: {
      fontSize: 12,
      color: palette.muted,
      fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: palette.muted,
    textAlign: 'center',
  },
});
