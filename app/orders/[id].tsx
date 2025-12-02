import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { orderService } from '@/services/orderService';
import toast from '../../src/utils/toast';
import axios from 'axios';
import * as ExpoLinking from 'expo-linking';

const palette = {
  primary: '#00BCD4',
  primaryDark: '#0097A7',
  background: '#F4F6FB',
  card: '#FFFFFF',
  border: '#E4E9F2',
  muted: '#94A3B8',
  text: '#0F172A',
  softText: '#475569',
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

function formatCurrency(value: number | string) {
  return `R$ ${Number(value || 0).toFixed(2)}`;
}

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const data = await orderService.getOrderById(Number(id));
      setOrder(data);
    } catch (error) {
      console.error('Erro ao carregar pedido:', error);
      toast.showError('Erro', 'Não foi possível carregar os detalhes do pedido.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchOrder();
  }, [id]);

  const handleCancelOrder = async () => {
    Alert.alert(
      'Cancelar Pedido',
      'Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessing(true);
              await orderService.updateOrderStatus(Number(id), 'CANCELED');
              toast.showSuccess('Sucesso', 'Pedido cancelado com sucesso.');
              fetchOrder(); // Reload to update status
            } catch (error) {
              console.error('Erro ao cancelar pedido:', error);
              toast.showError('Erro', 'Não foi possível cancelar o pedido.');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleContinuePayment = async () => {
    if (!order) return;

    // Check if we have a saved link (unlikely with current backend)
    let paymentUrl = order.initPoint || order.mpInitPoint || order.sandboxLink;

    if (paymentUrl) {
      Linking.openURL(paymentUrl);
      return;
    }

    // If no link, try to regenerate it (Frontend Workaround)
    try {
      setProcessing(true);
      toast.showInfo('Aguarde', 'Gerando link de pagamento...');
      
      const mpToken = "APP_USR-7329173875972159-120123-c8e1fc25840c193bbf8acf2550bbcdd4-3032944549";
      const itemsList = (order.items || []).map((item: any) => ({
        id: String(item.productId),
        title: item.productName || `Produto ${item.productId}`,
        quantity: Number(item.quantity),
        unit_price: Number(item.unitPrice ?? item.price),
        currency_id: 'BRL',
      }));

      const successUrl = ExpoLinking.createURL('success');
      const failureUrl = ExpoLinking.createURL('failure');
      const pendingUrl = ExpoLinking.createURL('pending');

      const mpBody = {
        items: itemsList,
        external_reference: String(order.id),
        notification_url: "https://benucci-artesanato.onrender.com/webhook/mercadopago",
        back_urls: {
          success: successUrl,
          failure: failureUrl,
          pending: pendingUrl
        },
        auto_return: "approved",
      };

      const mpResponse = await axios.post('https://api.mercadopago.com/checkout/preferences', mpBody, {
        headers: {
          'Authorization': `Bearer ${mpToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (mpResponse.data && mpResponse.data.init_point) {
        Linking.openURL(mpResponse.data.init_point);
      } else {
        toast.showError('Erro', 'Não foi possível gerar o link de pagamento.');
      }
    } catch (error) {
      console.error('Erro ao gerar pagamento:', error);
      toast.showError('Erro', 'Falha ao conectar com o Mercado Pago.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Pedido não encontrado.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.linkText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusInfo = mapOrderStatus(order.status);
  const isPending = (order.status || '').toLowerCase() === 'pending';
  const items = order.items || [];
  const total = Number(order.totalAmount ?? order.total ?? 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Detalhes do Pedido</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Card */}
        <View style={[styles.card, styles.statusCard, { borderLeftColor: statusInfo.color }]}>
          <View style={styles.statusHeader}>
            <Ionicons name={statusInfo.icon as any} size={24} color={statusInfo.color} />
            <Text style={[styles.statusValue, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
          <Text style={styles.orderId}>Pedido #{order.id}</Text>
        </View>

        {/* Actions for Pending Orders */}
        {isPending && (
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.payButton, processing && styles.disabledButton]}
              onPress={handleContinuePayment}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="card-outline" size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>Continuar Pagamento</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.cancelButton, processing && styles.disabledButton]}
              onPress={handleCancelOrder}
              disabled={processing}
            >
              <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
              <Text style={[styles.actionButtonText, { color: '#DC2626' }]}>Cancelar Pedido</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Itens</Text>
          {items.map((item: any, index: number) => (
            <View key={index} style={[styles.itemRow, index === items.length - 1 && styles.lastItemRow]}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName ?? item.name ?? 'Produto'}</Text>
                <Text style={styles.itemQty}>{item.quantity}x {formatCurrency(item.unitPrice ?? item.price)}</Text>
              </View>
              <Text style={styles.itemTotal}>{formatCurrency((item.quantity || 1) * (item.unitPrice ?? item.price ?? 0))}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>

        {/* Delivery Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Entrega</Text>
          <Text style={styles.infoText}>
            {order.deliveryType === 'pickup' ? 'Retirada na Loja' : 'Entrega no Endereço'}
          </Text>
          {order.deliveryAddress && (
            <Text style={styles.addressText}>{order.deliveryAddress}</Text>
          )}
        </View>
      </ScrollView>
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
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusCard: {
    borderLeftWidth: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  orderId: {
    fontSize: 14,
    color: palette.muted,
  },
  actionContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  payButton: {
    backgroundColor: palette.primary,
  },
  cancelButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  disabledButton: {
    opacity: 0.7,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastItemRow: {
    borderBottomWidth: 0,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
  },
  itemQty: {
    fontSize: 12,
    color: palette.muted,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.primary,
  },
  infoText: {
    fontSize: 14,
    color: palette.text,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: palette.softText,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: palette.danger,
    marginBottom: 16,
  },
  linkText: {
    fontSize: 16,
    color: palette.primary,
    fontWeight: '600',
  },
});
