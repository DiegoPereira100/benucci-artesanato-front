import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { orderService } from '@/services/orderService';
import { Button } from '@/components/ui/Button';
import toast from '../../../src/utils/toast';

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

export default function AdminOrderDetails() {
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        if (!id) return setError('ID do pedido inválido');
        const res = await orderService.getOrderById(Number(id));
        if (cancelled) return;
        setOrder(res);
      } catch (e: any) {
        console.error('Erro ao carregar pedido:', e);
        setError(e?.message || 'Erro ao buscar pedido');
        toast.showError('Erro', e?.message || 'Não foi possível carregar o pedido');
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.messageBox}>
          <Text style={styles.errorText}>{error ?? 'Pedido não encontrado'}</Text>
          <Button title="Voltar" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const user = order.user ?? order.customer ?? null;
  const items = order.items ?? [];
  const total = Number(order.totalAmount ?? order.total ?? 0).toFixed(2);
  const paymentMethod = order.paymentMethod ?? order.payment?.paymentMethod ?? 'Não informado';
  const paymentStatus = order.paymentStatus ?? order.payment?.status ?? order.status ?? 'Desconhecido';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Pedido #{order.id}</Text>
          <Text style={styles.subtitle}>{mapOrderStatus(order.status)}</Text>
          <Text style={styles.muted}>Data: {new Date(order.orderDate ?? order.createdAt ?? Date.now()).toLocaleString()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          <Text>Nome: {user?.name ?? 'Não informado'}</Text>
          <Text>Email: {user?.email ?? 'Não informado'}</Text>
          <Text>Telefone: {user?.phone ?? user?.telephone ?? 'Não informado'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Itens</Text>
          {items.length === 0 ? (
            <Text>Nenhum item encontrado</Text>
          ) : (
            items.map((it: any) => {
              const subtotal = (Number(it.unitPrice ?? it.price ?? 0) * Number(it.quantity ?? 0)).toFixed(2);
              return (
                <View key={it.productId ?? it.id ?? Math.random().toString(36).slice(2,9)} style={styles.itemRow}>
                  <Text style={styles.itemName}>{it.productName ?? it.name ?? 'Produto'}</Text>
                  <Text style={styles.itemQty}>Qtd: {it.quantity}</Text>
                  <Text style={styles.itemPrice}>R$ {Number(it.unitPrice ?? it.price ?? 0).toFixed(2)}</Text>
                  <Text style={styles.itemSubtotal}>Subtotal: R$ {subtotal}</Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pagamento</Text>
          <Text>Método: {paymentMethod}</Text>
          <Text>Status: {String(paymentStatus)}</Text>
          <Text style={{ marginTop: 8, fontWeight: '600' }}>Total: R$ {total}</Text>
        </View>

        <View style={{ marginTop: 20 }}>
          <Button title="Voltar" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  header: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#FF6B35' },
  subtitle: { fontSize: 16, marginTop: 6 },
  muted: { color: '#666', marginTop: 4 },
  section: { backgroundColor: '#fafafa', padding: 12, borderRadius: 10, marginTop: 12 },
  sectionTitle: { fontWeight: '700', marginBottom: 8 },
  itemRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  itemName: { fontWeight: '600' },
  itemQty: { color: '#444' },
  itemPrice: { color: '#444' },
  itemSubtotal: { color: '#222', marginTop: 4 },
  messageBox: { padding: 20, alignItems: 'center' },
  errorText: { color: '#f44336', marginBottom: 12 },
});
