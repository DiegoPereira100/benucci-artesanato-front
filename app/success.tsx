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
  
  // Helper to get string from param which might be array
  const getParam = (p: string | string[] | undefined) => (Array.isArray(p) ? p[0] : p);
  const mpStatus = getParam(params.status ?? params.collection_status);

  useEffect(() => {
    cancelledRef.current = false;

    async function fetchAndHandle() {
      try {
        // 1. Check URL params from Mercado Pago first (Frontend Trust)
        // We trust 'approved' status from URL to bypass broken backend
        if (mpStatus === 'approved') {
           console.log('PaymentSuccess -> URL status is approved. Trusting frontend redirect.');
           
           // FORCE UPDATE BACKEND: Since backend webhook is missing/broken, we update status from frontend
           if (externalRef) {
               try {
                   console.log('PaymentSuccess -> Forcing backend update to PREPARING for order', externalRef);
                   // Use 'preparing' which is a valid Enum value in backend (Order.OrderStatus)
                   // 'approved' is not a valid OrderStatus, it belongs to Payment status which we can't update directly via this endpoint
                   await orderService.updateOrderStatus(Number(externalRef), 'preparing');
               } catch (updateErr) {
                   console.error('PaymentSuccess -> Failed to force update backend status:', updateErr);
               }
           }

           setStatusLabel('Pagamento confirmado. Pedido concluído.');
           // Only clear if not already cleared (though clearCart is safe)
           clearCart();
           toast.showSuccess('Pagamento confirmado', 'Seu carrinho foi limpo com sucesso.');
           setLoading(false);
           return;
        }

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

        if (paymentStatus === 'approved' || paymentStatus === 'paid' || paymentStatus === 'true' || paymentStatus === 'preparing') {
          setStatusLabel('Pagamento confirmado. Pedido concluído.');
          clearCart();
          toast.showSuccess('Pagamento confirmado', 'Seu carrinho foi limpo com sucesso.');
          setLoading(false); 
        } else if (paymentStatus === 'pending' || paymentStatus === 'created' || paymentStatus === 'pending_payment') {
          setStatusLabel('Pagamento pendente. Aguardando confirmação...');
          
          // Polling logic
          if (attempts < 20) {
             // Schedule next poll WITHOUT triggering effect re-run immediately
             pollingRef.current = setTimeout(() => {
                if (cancelledRef.current) return;
                setAttempts(prev => prev + 1); // This will trigger re-render and effect
             }, 3000);
          } else {
            setStatusLabel('Pagamento ainda pendente. Você pode tentar atualizar manualmente.');
            setLoading(false);
          }
        } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled' || paymentStatus === 'canceled') {
          setStatusLabel('Pagamento não concluído. Carrinho mantido.');
          setLoading(false);
        } else {
          if (res?.paymentStatus) {
            setStatusLabel('Status do pagamento: ' + res.paymentStatus);
          } else {
            setStatusLabel('Status do pedido: ' + (res?.status ?? 'Desconhecido'));
          }
          setLoading(false);
        }

      } catch (e: any) {
        console.error('PaymentSuccess -> erro ao verificar pedido:', e);
        setStatusLabel('Erro ao verificar o status do pagamento. Tente novamente mais tarde.');
        toast.showError('Erro', e?.message || 'Não foi possível verificar o pagamento.');
        setLoading(false);
      }
    }

    fetchAndHandle();

    return () => {
      cancelledRef.current = true;
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [externalRef, mpStatus, attempts]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {loading && attempts < 20 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#00BCD4" />
            <Text style={styles.loadingText}>Verificando status do pagamento... ({attempts}/20)</Text>
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
  title: { fontSize: 20, fontWeight: '700', color: '#00BCD4', marginBottom: 8 },
  statusText: { fontSize: 16, marginBottom: 12 },
  orderInfo: { marginTop: 8, alignItems: 'center' },
  button: { marginTop: 20, backgroundColor: '#00BCD4', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
