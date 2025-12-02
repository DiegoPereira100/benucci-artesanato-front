import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { orderService } from '@/services/orderService';
import userService from '@/services/userService';
import toast from '../../../src/utils/toast';

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

function formatPhone(value?: string | null) {
	const digits = (value ?? '').replace(/\D/g, '');
	if (!digits) return 'Não informado';
	if (digits.length === 11) {
		return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
	}
	if (digits.length === 10) {
		return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
	}
	return value || 'Não informado';
}

export default function AdminOrderDetails() {
	const { id } = useLocalSearchParams();
	const [loading, setLoading] = useState(true);
	const [order, setOrder] = useState<any>(null);
	const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const fetchOrder = async () => {
        try {
            setLoading(true);
            setError(null);
            if (!id) return setError('ID do pedido inválido');

            // 1. Fetch Order
            const res = await orderService.getOrderById(Number(id));

            let orderData = res;

            // 2. If user is missing, try to find it (Frontend Workaround)
            if (!orderData.user && !orderData.customer) {
                try {
                    const users = await userService.getAllUsers();
                    // Search for the user who owns this order
                    const searchPromises = users.map(async (u) => {
                        try {
                            const userOrders = await orderService.getUserOrders(u.id);
                            if (Array.isArray(userOrders) && userOrders.some((o) => o.id === orderData.id)) {
                                return u;
                            }
                        } catch (e) {
                            return null;
                        }
                        return null;
                    });

                    const results = await Promise.all(searchPromises);
                    const foundUser = results.find((u) => u !== null);

                    if (foundUser) {
                        orderData = { ...orderData, user: foundUser };
                    }
                } catch (err) {
                    console.log('Erro ao buscar usuário dono do pedido', err);
                }
            }

            setOrder(orderData);
        } catch (e: any) {
            console.error('Erro ao carregar pedido:', e);
            setError(e?.message || 'Erro ao buscar pedido');
            toast.showError('Erro', e?.message || 'Não foi possível carregar o pedido');
        } finally {
            setLoading(false);
        }
    };

	useEffect(() => {
		fetchOrder();
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

	if (loading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.centerContent}>
					<ActivityIndicator size="large" color={palette.primary} />
					<Text style={styles.loadingText}>Carregando detalhes...</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (error || !order) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.centerContent}>
					<Ionicons name="alert-circle-outline" size={48} color={palette.danger} />
					<Text style={styles.errorText}>{error ?? 'Pedido não encontrado'}</Text>
					<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
						<Text style={styles.backButtonText}>Voltar</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		);
	}

	const user = order.user ?? order.customer ?? null;
	const items = order.items ?? [];
	const total = Number(order.totalAmount ?? order.total ?? 0);
	const statusInfo = mapOrderStatus(order.status);
	const date = new Date(order.orderDate ?? order.createdAt ?? Date.now()).toLocaleString();

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.headerBar}>
				<TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
					<Ionicons name="arrow-back" size={24} color={palette.text} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Detalhes do Pedido #{order.id}</Text>
				<View style={{ width: 24 }} />
			</View>

			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				{/* Status Card */}
				<View style={[styles.card, styles.statusCard, { borderLeftColor: statusInfo.color }]}>
					<View style={styles.statusHeader}>
						<View style={[styles.iconBox, { backgroundColor: statusInfo.color + '20' }]}>
							<Ionicons name={statusInfo.icon as any} size={24} color={statusInfo.color} />
						</View>
						<View>
							<Text style={styles.statusLabel}>Status do Pedido</Text>
							<Text style={[styles.statusValue, { color: statusInfo.color }]}>{statusInfo.label}</Text>
						</View>
					</View>
					<Text style={styles.dateText}>Realizado em: {date}</Text>
				</View>

                {/* Cancel Button for Admin */}
                {(order.status || '').toLowerCase() === 'pending' && (
                    <TouchableOpacity 
                        style={[styles.cancelButton, processing && styles.disabledButton]}
                        onPress={handleCancelOrder}
                        disabled={processing}
                    >
                        {processing ? (
                            <ActivityIndicator color="#DC2626" />
                        ) : (
                            <>
                                <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                                <Text style={styles.cancelButtonText}>Cancelar Pedido</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

				{/* Customer Info */}
				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Ionicons name="person-outline" size={20} color={palette.primary} />
						<Text style={styles.cardTitle}>Dados do Cliente</Text>
					</View>
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Nome:</Text>
						<Text style={styles.infoValue}>{user?.name ?? 'Não informado'}</Text>
					</View>
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Email:</Text>
						<Text style={styles.infoValue}>{user?.email ?? 'Não informado'}</Text>
					</View>
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Telefone:</Text>
						<Text style={styles.infoValue}>{formatPhone(user?.phone ?? user?.telephone ?? user?.phoneNumber)}</Text>
					</View>
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>CPF:</Text>
						<Text style={styles.infoValue}>{user?.cpf ?? 'Não informado'}</Text>
					</View>
				</View>

				{/* Delivery Info */}
				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Ionicons name="location-outline" size={20} color={palette.primary} />
						<Text style={styles.cardTitle}>Entrega</Text>
					</View>
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Tipo:</Text>
						<Text style={styles.infoValue}>
							{order.deliveryType === 'pickup' ? 'Retirada na Loja' : 'Entrega no Endereço'}
						</Text>
					</View>
					{order.deliveryAddress && (
						<View style={styles.addressBox}>
							<Text style={styles.addressText}>{order.deliveryAddress}</Text>
						</View>
					)}
				</View>

				{/* Items */}
				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Ionicons name="cart-outline" size={20} color={palette.primary} />
						<Text style={styles.cardTitle}>Itens do Pedido</Text>
					</View>
					{items.length === 0 ? (
						<Text style={styles.emptyText}>Nenhum item encontrado.</Text>
					) : (
						items.map((item: any, index: number) => (
							<View key={index} style={[styles.itemRow, index === items.length - 1 && styles.lastItemRow]}>
								<View style={styles.itemIcon}>
									<Ionicons name="cube-outline" size={18} color={palette.muted} />
								</View>
								<View style={styles.itemDetails}>
									<Text style={styles.itemName}>{item.productName ?? item.name ?? 'Produto sem nome'}</Text>
									<Text style={styles.itemSub}>
										{item.quantity}x {formatCurrency(item.unitPrice ?? item.price)}
									</Text>
								</View>
								<Text style={styles.itemTotal}>
									{formatCurrency((item.quantity || 1) * (item.unitPrice ?? item.price ?? 0))}
								</Text>
							</View>
						))
					)}
				</View>

				{/* Payment & Total */}
				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Ionicons name="card-outline" size={20} color={palette.primary} />
						<Text style={styles.cardTitle}>Pagamento</Text>
					</View>
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Método:</Text>
						<Text style={styles.infoValue}>
							{order.paymentMethod ?? order.payment?.paymentMethod ?? 'Não informado'}
						</Text>
					</View>
					<View style={styles.divider} />
					<View style={styles.totalRow}>
						<Text style={styles.totalLabel}>Total do Pedido</Text>
						<Text style={styles.totalValue}>{formatCurrency(total)}</Text>
					</View>
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
	centerContent: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	loadingText: {
		marginTop: 12,
		color: palette.softText,
		fontSize: 16,
	},
	errorText: {
		marginTop: 12,
		color: palette.danger,
		fontSize: 16,
		textAlign: 'center',
		marginBottom: 20,
	},
	headerBar: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: palette.card,
		borderBottomWidth: 1,
		borderBottomColor: palette.border,
	},
	headerButton: {
		padding: 8,
	},
	headerTitle: {
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
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: palette.border,
		shadowColor: '#000',
		shadowOpacity: 0.05,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 2 },
		elevation: 2,
	},
	statusCard: {
		borderLeftWidth: 4,
	},
	statusHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		marginBottom: 8,
	},
	iconBox: {
		width: 40,
		height: 40,
		borderRadius: 20,
		justifyContent: 'center',
		alignItems: 'center',
	},
	statusLabel: {
		fontSize: 12,
		color: palette.softText,
		textTransform: 'uppercase',
		fontWeight: '600',
	},
	statusValue: {
		fontSize: 18,
		fontWeight: '700',
	},
	dateText: {
		fontSize: 12,
		color: palette.muted,
		marginTop: 4,
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginBottom: 16,
		borderBottomWidth: 1,
		borderBottomColor: '#F1F5F9',
		paddingBottom: 12,
	},
	cardTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: palette.text,
	},
	infoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	infoLabel: {
		color: palette.softText,
		fontSize: 14,
	},
	infoValue: {
		color: palette.text,
		fontWeight: '600',
		fontSize: 14,
		flex: 1,
		textAlign: 'right',
	},
	addressBox: {
		backgroundColor: '#F8FAFC',
		padding: 12,
		borderRadius: 8,
		marginTop: 8,
	},
	addressText: {
		color: palette.softText,
		fontSize: 13,
		lineHeight: 20,
	},
	itemRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#F1F5F9',
		gap: 12,
	},
	lastItemRow: {
		borderBottomWidth: 0,
	},
	itemIcon: {
		width: 36,
		height: 36,
		borderRadius: 8,
		backgroundColor: '#F1F5F9',
		justifyContent: 'center',
		alignItems: 'center',
	},
	itemDetails: {
		flex: 1,
	},
	itemName: {
		color: palette.text,
		fontWeight: '600',
		fontSize: 14,
	},
	itemSub: {
		color: palette.softText,
		fontSize: 12,
	},
	itemTotal: {
		fontWeight: '700',
		color: palette.text,
	},
	emptyText: {
		color: palette.muted,
		textAlign: 'center',
		padding: 12,
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
		fontSize: 20,
		fontWeight: '800',
		color: palette.primary,
	},
	backButton: {
		backgroundColor: palette.primary,
		paddingHorizontal: 24,
		paddingVertical: 12,
		borderRadius: 8,
	},
	backButtonText: {
		color: '#fff',
		fontWeight: '700',
	},
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        padding: 12,
        borderRadius: 12,
        gap: 8,
        marginBottom: 8,
    },
    cancelButtonText: {
        color: '#DC2626',
        fontWeight: '600',
        fontSize: 16,
    },
    disabledButton: {
        opacity: 0.7,
    },
});

