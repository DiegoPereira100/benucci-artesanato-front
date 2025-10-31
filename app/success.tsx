import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCart } from '@/contexts/CartContext';
import { orderService } from '@/services/orderService';
import toast from '../src/utils/toast';

export default function PaymentSuccess() {
  const params = useLocalSearchParams();
  const { clearCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [attempts, setAttempts] = useState(0);
  const pollingRef = useRef<any>(null);
  const cancelledRef = useRef(false);

  // Try to read possible params used by MercadoPago or backend
  const externalRef = (params.external_reference ?? params.orderId ?? params.id) as string | undefined;
  const mpPref = (params.mp_preference_id ?? params.preference_id ?? params.preference) as string | undefined;

  useEffect(() => {
    cancelledRef.current = false;

    async function fetchAndHandle() {
      try {
        setLoading(true);
        // prefer external_reference which should be order id
        if (!externalRef) {
          setStatusLabel('Parâmetros insuficientes para verificar o pagamento.');
          setLoading(false);
          return;
        }

        const orderId = Number(externalRef);
        if (Number.isNaN(orderId)) {
          setStatusLabel('ID do pedido inválido recebido no retorno do pagamento.');
          setLoading(false);
          return;
        }

        console.log('PaymentSuccess -> fetching order', orderId);
        const res = await orderService.getOrderById(orderId);
        if (cancelledRef.current) return;

        setOrderData(res);

        const paymentStatus = (res?.paymentStatus ?? res?.payment?.status ?? res?.status ?? '').toString().toLowerCase();
        console.log('PaymentSuccess -> paymentStatus/res.status:', paymentStatus, res?.status);

        if (paymentStatus === 'approved' || paymentStatus === 'paid' || paymentStatus === 'true') {
          setStatusLabel('Pagamento confirmado. Pedido concluído.');
          clearCart();
          toast.showSuccess('Pagamento confirmado', 'Seu carrinho foi limpo com sucesso.');
        } else if (paymentStatus === 'pending' || paymentStatus === 'created' || paymentStatus === 'pending_payment') {
          setStatusLabel('Pagamento pendente. Aguardando confirmação.');
          // start polling a few times
          if (attempts < 5) {
            setAttempts(a => a + 1);
            // schedule next poll
            pollingRef.current = setTimeout(() => {
              fetchAndHandle();
            }, 5000);
          } else {
            // give up automatic polling after N attempts
            setStatusLabel('Pagamento ainda pendente. Você pode tentar atualizar manualmente.');
          }
        } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled' || paymentStatus === 'canceled') {
          setStatusLabel('Pagamento não concluído. Carrinho mantido.');
        } else {
          // Unknown: show status text from backend or keep pending
          if (res?.paymentStatus) {
            setStatusLabel('Status do pagamento: ' + res.paymentStatus);
          } else {
            setStatusLabel('Status do pedido: ' + (res?.status ?? 'Desconhecido'));
          }
        }

      } catch (e: any) {
        console.error('PaymentSuccess -> erro ao verificar pedido:', e);
        setStatusLabel('Erro ao verificar o status do pagamento. Tente novamente mais tarde.');
        toast.showError('Erro', e?.message || 'Não foi possível verificar o pagamento.');
      } finally {
        setLoading(false);
      }
    }

    // initial fetch
    fetchAndHandle();

    return () => {
      cancelledRef.current = true;
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, attempts]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.loadingText}>Verificando status do pagamento...</Text>
          </View>
        ) : (
          <View style={styles.resultBox}>
            <Text style={styles.title}>Resultado do Pagamento</Text>
            <Text style={styles.statusText}>{statusLabel}</Text>
            {orderData ? (
              <View style={styles.orderInfo}>
                <Text>Pedido #{orderData.id}</Text>
                <Text>Total: R$ {Number(orderData.totalAmount ?? orderData.total ?? 0).toFixed(2)}</Text>
                <Text>Data: {new Date(orderData.orderDate ?? Date.now()).toLocaleString()}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.button} onPress={() => router.push('/(tabs)/products')}>
              <Text style={styles.buttonText}>Continuar Comprando</Text>
            </TouchableOpacity>

            {/* Manual refresh button in case polling didn't resolve */}
            <TouchableOpacity
              style={[styles.button, { marginTop: 12, backgroundColor: '#4CAF50' }]}
              onPress={() => {
                // reset attempts so polling will start again and force an immediate check
                setAttempts(0);
                // call orderService directly (safe because function is in effect)
                // We trigger the effect by updating attempts to 0 and letting it run; but we also call check manually by pushing a micro-task
                setTimeout(() => {
                  // small trick: update a state to cause effect to re-run; attempts set to 0 already
                }, 0);
                toast.showSuccess('Atualizando', 'Verificando pagamento...');
              }}
            >
              <Text style={styles.buttonText}>Reverificar Status</Text>
            </TouchableOpacity>

            {/* Offer manual clear as fallback (confirm first) */}
            <TouchableOpacity
              style={[styles.button, { marginTop: 12, backgroundColor: '#f44336' }]}
              onPress={() => {
                Alert.alert(
                  'Limpar Carrinho',
                  'Deseja realmente limpar o carrinho? Esta ação não pode ser desfeita.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Limpar', style: 'destructive', onPress: () => { clearCart(); toast.showSuccess('Carrinho limpo', 'Seu carrinho foi esvaziado.'); } }
                  ]
                );
              }}
            >
              <Text style={styles.buttonText}>Limpar Carrinho</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingBox: { alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666' },
  resultBox: { width: '100%', backgroundColor: '#fff', padding: 20, borderRadius: 12, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#FF6B35', marginBottom: 8 },
  statusText: { fontSize: 16, marginBottom: 12 },
  orderInfo: { marginTop: 8, alignItems: 'center' },
  button: { marginTop: 20, backgroundColor: '#FF6B35', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
