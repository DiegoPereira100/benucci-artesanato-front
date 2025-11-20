import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	TextInput,
	ActivityIndicator,
	Animated,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { productService, categoryService } from '@/services/productService';
import { orderService } from '@/services/orderService';
import userService from '@/services/userService';
import { Product } from '@/types/product';
import { UpdateUserRequest, User } from '@/types/auth';
import { ProductDTO, CategoryDTO } from '@/services/api';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ProductEditModal from '@/components/admin/ProductEditModal';
import UserEditModal from '@/components/admin/UserEditModal';
import toast from '../../src/utils/toast';

function mapOrderStatus(status: string) {
	switch ((status || '').toLowerCase()) {
		case 'pending':
			return 'Aguardando pagamento';
		case 'preparing':
			return 'Em preparação';
		case 'shipped':
			return 'Enviado';
		case 'delivered':
			return 'Pedido concluído';
		case 'canceled':
			return 'Cancelado';
		default:
			return status || 'Desconhecido';
	}
}

function formatPhone(value?: string | null) {
	const digits = (value ?? '').replace(/\D/g, '');
	if (!digits) return 'Telefone não informado';
	if (digits.length === 11) {
		return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
	}
	if (digits.length === 10) {
		return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
	}
	return digits;
}

const alignToJustify = (align?: 'left' | 'center' | 'right') => {
	if (align === 'center') return 'center';
	if (align === 'right') return 'flex-end';
	return 'flex-start';
};

type AdminTabs = 'products' | 'orders' | 'users';

type ColumnDefinition = {
	key: string;
	label: string;
	flex?: number;
	align?: 'left' | 'center' | 'right';
	render?: (item: any) => React.ReactNode;
};

const palette = {
	primary: '#00B7C2',
	primaryDark: '#0084A3',
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

export default function AdminDashboard() {
	const { user } = useAuth();
	const [selectedTab, setSelectedTab] = useState<AdminTabs>('products');
	const [searchQuery, setSearchQuery] = useState('');

	const [products, setProducts] = useState<Product[]>([]);
	const [users, setUsers] = useState<User[]>([]);
	const [orders, setOrders] = useState<any[]>([]);

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [ordersUserId, setOrdersUserId] = useState('');
	const isFocused = useIsFocused();

	const [editModalVisible, setEditModalVisible] = useState(false);
	const [editingProduct, setEditingProduct] = useState<ProductDTO | null>(null);
	const [editLoading, setEditLoading] = useState(false);
	const [editCategories, setEditCategories] = useState<CategoryDTO[]>([]);
	const [confirmVisible, setConfirmVisible] = useState(false);
	const [confirmTargetId, setConfirmTargetId] = useState<number | null>(null);

	const [userModalVisible, setUserModalVisible] = useState(false);
	const [editingUser, setEditingUser] = useState<User | null>(null);
	const [userModalLoading, setUserModalLoading] = useState(false);
	const [confirmUserVisible, setConfirmUserVisible] = useState(false);
	const [userDeleteTarget, setUserDeleteTarget] = useState<User | null>(null);
	const [userActionLoading, setUserActionLoading] = useState(false);

	const tabFadeAnim = useRef(new Animated.Value(1)).current;

	const normalizeEmailValue = (value?: string | null) => (value ?? '').trim().toLowerCase();

	useEffect(() => {
		if (selectedTab === 'products') fetchProducts();
		if (selectedTab === 'users') fetchUsers();
	}, [selectedTab]);

	useEffect(() => {
		if (isFocused && selectedTab === 'products') {
			fetchProducts();
		}
	}, [isFocused, selectedTab]);

	useEffect(() => {
		setSearchQuery('');
		Animated.sequence([
			Animated.timing(tabFadeAnim, {
				toValue: 0,
				duration: 120,
				useNativeDriver: true,
			}),
			Animated.timing(tabFadeAnim, {
				toValue: 1,
				duration: 180,
				useNativeDriver: true,
			}),
		]).start();
	}, [selectedTab, tabFadeAnim]);

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
			const dto = await productService.getProductDTO(productId);
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
		setConfirmTargetId(id);
		setConfirmVisible(true);
	}

	async function deleteConfirmed(id: number) {
		try {
			setLoading(true);
			await productService.deleteProduct(id);
			setProducts((prev) => prev.filter((p) => p.id !== id));
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

	async function ensureUserHasServerId(target: User | null): Promise<number | null> {
		if (!target) return null;
		if (target.id && target.id > 0) return target.id;
		if (!target.email) {
			toast.showError('Usuário sem email', 'Não foi possível identificar este usuário no servidor.');
			return null;
		}

		try {
			const resolved = await userService.resolveUserIdByEmail(target.email);
			if (resolved && resolved > 0) {
				setUsers((prev) =>
					prev.map((u) =>
						normalizeEmailValue(u.email) === normalizeEmailValue(target.email)
							? { ...u, id: resolved }
							: u,
					),
				);
				return resolved;
			}
			toast.showError('Erro', 'Não foi possível localizar este usuário no servidor.');
			return null;
		} catch (error) {
			console.error('ensureUserHasServerId -> error', error);
			toast.showError('Erro', 'Não foi possível localizar este usuário no servidor.');
			return null;
		}
	}

	function openUserEditor(target: User) {
		setEditingUser(target);
		setUserModalVisible(true);
	}

	async function handleSaveUser(payload: UpdateUserRequest) {
		if (!editingUser) return;
		try {
			setUserModalLoading(true);
			const serverId = await ensureUserHasServerId(editingUser);
			if (!serverId) {
				return;
			}
			const updated = await userService.updateUser(serverId, payload);
			setUsers((prev) =>
				prev.map((u) =>
					u.id === serverId || normalizeEmailValue(u.email) === normalizeEmailValue(updated.email)
						? { ...updated }
						: u,
				),
			);
			toast.showSuccess('Usuário atualizado', 'Dados do usuário salvos com sucesso.');
			setUserModalVisible(false);
			setEditingUser(null);
		} catch (e: any) {
			console.error('Erro ao atualizar usuário:', e);
			toast.showError('Erro', e?.message || 'Não foi possível atualizar o usuário');
		} finally {
			setUserModalLoading(false);
		}
	}

	function handleDeleteUser(target: User) {
		if (!target?.email) {
			toast.showError('Operação inválida', 'Usuário sem email cadastrado.');
			return;
		}
		setUserDeleteTarget(target);
		setConfirmUserVisible(true);
	}

	async function deleteUserConfirmed() {
		if (!userDeleteTarget) return;

		const serverId = await ensureUserHasServerId(userDeleteTarget);
		if (!serverId) {
			setConfirmUserVisible(false);
			setUserDeleteTarget(null);
			return;
		}

		if (user && serverId === user.id) {
			toast.showError('Operação não permitida', 'Você não pode excluir sua própria conta aqui.');
			setConfirmUserVisible(false);
			setUserDeleteTarget(null);
			return;
		}

		try {
			setUserActionLoading(true);
			await userService.deleteUser(serverId);
			setUsers((prev) =>
				prev.filter(
					(u) =>
						u.id !== serverId &&
						normalizeEmailValue(u.email) !== normalizeEmailValue(userDeleteTarget.email),
				),
			);
			toast.showSuccess('Usuário excluído', 'Usuário removido com sucesso.');
		} catch (e: any) {
			console.error('Erro ao deletar usuário:', e);
			toast.showError('Erro', e?.message || 'Não foi possível excluir o usuário');
		} finally {
			setUserActionLoading(false);
			setConfirmUserVisible(false);
			setUserDeleteTarget(null);
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
		router.push('/admin/create-product');
	}

	function handleOrdersSearch() {
		const numericId = Number(ordersUserId);
		if (!numericId) {
			setError('Informe um ID de usuário válido');
			return;
		}
		fetchOrdersForUser(numericId);
	}

	const normalizedSearch = searchQuery.trim().toLowerCase();

	const filteredProducts = useMemo(() => {
		if (!normalizedSearch) return products;
		return products.filter((p) =>
			[p.name, p.category, String(p.price)]
				.filter(Boolean)
				.some((field) => field!.toString().toLowerCase().includes(normalizedSearch)),
		);
	}, [products, normalizedSearch]);

	const filteredUsers = useMemo(() => {
		if (!normalizedSearch) return users;
		return users.filter((u) =>
			[u.name, u.email, u.role, u.type, u.phoneNumber]
				.filter(Boolean)
				.some((field) => field!.toString().toLowerCase().includes(normalizedSearch)),
		);
	}, [users, normalizedSearch]);

	const filteredOrders = useMemo(() => {
		if (!normalizedSearch) return orders;
		return orders.filter((o) =>
			[o?.id, o?.user?.name, o?.status]
				.filter(Boolean)
				.some((field) => field!.toString().toLowerCase().includes(normalizedSearch)),
		);
	}, [orders, normalizedSearch]);

	const lowStock = products.filter((p) => p.stock <= 5).length;
	const adminCount = users.filter((u) => (u.role ?? u.type ?? '').toString().toUpperCase() === 'ADMIN').length;

		const statsCards = [
			{
				key: 'products',
				label: 'Produtos cadastrados',
				value: products.length,
				meta: lowStock ? `${lowStock} itens com estoque baixo` : 'Estoque saudável',
				icon: 'cube-outline' as const,
				tint: '#DBEAFE',
			},
			{
				key: 'users',
				label: 'Usuários ativos',
				value: users.length,
				meta: adminCount ? `${adminCount} administradores` : 'Nenhum admin adicional',
				icon: 'people-outline' as const,
				tint: '#E0F2FE',
			},
			{
				key: 'orders',
				label: 'Pedidos carregados',
				value: orders.length,
				meta: orders.length ? 'Dados atualizados' : 'Busque pelo ID do cliente',
				icon: 'receipt-outline' as const,
				tint: '#DCFCE7',
			},
		];

		const tabsConfig: Array<{ key: AdminTabs; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }> = [
			{ key: 'products', label: 'Produtos', icon: 'cube-outline', description: 'Gerencie catálogo, estoque e preços.' },
			{ key: 'orders', label: 'Pedidos', icon: 'receipt-outline', description: 'Acompanhe pedidos por usuário.' },
			{ key: 'users', label: 'Usuários', icon: 'people-outline', description: 'Atualize perfis e permissões.' },
		];

		const currentTabMeta = tabsConfig.find((tab) => tab.key === selectedTab);

		const renderActionButtons = (type: 'product' | 'user' | 'order', payload: any) => {
			if (type === 'product') {
				return (
					<View style={styles.rowActions}>
						<TouchableOpacity
							style={[styles.rowActionButton, styles.rowActionPrimary]}
							onPress={() => openEditModal(payload.id)}
						>
							<Ionicons name="create-outline" size={16} color="#fff" />
							<Text style={styles.rowActionText}>Editar</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.rowActionButton, styles.rowActionDanger]}
							onPress={() => handleDeleteProduct(payload.id)}
						>
							<Ionicons name="trash-outline" size={16} color="#fff" />
							<Text style={styles.rowActionText}>Excluir</Text>
						</TouchableOpacity>
					</View>
				);
			}

			if (type === 'user') {
				const isCurrentUser =
					(user?.id && payload.id && user.id === payload.id) ||
					(user?.email && payload.email && normalizeEmailValue(user.email) === normalizeEmailValue(payload.email));

				return (
					<View style={styles.rowActions}>
						<TouchableOpacity
							style={[styles.rowActionButton, styles.rowActionPrimary]}
							onPress={() => openUserEditor(payload)}
						>
							<Ionicons name="create-outline" size={16} color="#fff" />
							<Text style={styles.rowActionText}>Editar</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[
								styles.rowActionButton,
								styles.rowActionDanger,
								(isCurrentUser || !payload.email) && styles.rowActionDisabled,
							]}
							onPress={() => {
								if (isCurrentUser) {
									toast.showError('Operação não permitida', 'Você não pode excluir sua própria conta.');
									return;
								}
								handleDeleteUser(payload);
							}}
							disabled={isCurrentUser || !payload.email}
						>
							<Ionicons name="trash-outline" size={16} color="#fff" />
							<Text style={styles.rowActionText}>Excluir</Text>
						</TouchableOpacity>
					</View>
				);
			}

			return (
				<TouchableOpacity
					style={[styles.rowActionButton, styles.rowActionGhost]}
					onPress={() => payload?.id && router.push(`/admin/orders/${payload.id}`)}
				>
					<Text style={[styles.rowActionText, styles.rowActionGhostText]}>Detalhes</Text>
					<Ionicons name="chevron-forward-outline" size={16} color="#0F172A" />
				</TouchableOpacity>
			);
		};

		const renderTable = (columns: ColumnDefinition[], dataset: any[], emptyMessage: string) => {
			if (loading) {
				return (
					<View style={styles.loadingState}>
						<ActivityIndicator size="small" color="#2563EB" />
						<Text style={styles.loadingText}>Carregando dados...</Text>
					</View>
				);
			}

			if (error) {
				return <Text style={styles.errorText}>{error}</Text>;
			}

			if (!dataset.length) {
				return <Text style={styles.emptyText}>{emptyMessage}</Text>;
			}

			return (
				<View>
					<View style={styles.tableHeader}>
						{columns.map((column) => (
							<Text
								key={column.key}
								style={[
									styles.tableHeaderCell,
									{ flex: column.flex ?? 1, textAlign: column.align ?? 'left' },
								]}
							>
								{column.label}
							</Text>
						))}
					</View>

					{dataset.map((item, index) => {
						const rowKey = `${columns[0]?.key}-${item?.id ?? index}`;
						return (
							<View key={rowKey} style={styles.tableRow}>
								{columns.map((column) => (
									<View
										key={`${rowKey}-${column.key}`}
										style={[
											styles.tableCell,
											{ flex: column.flex ?? 1, alignItems: alignToJustify(column.align) },
										]}
									>
										{column.render ? (
											column.render(item)
										) : (
											<Text
												style={[
													styles.tableCellText,
													column.align === 'center' && styles.textCenter,
													column.align === 'right' && styles.textRight,
												]}
											>
												{item?.[column.key] ?? '--'}
											</Text>
										)}
									</View>
								))}
							</View>
						);
					})}
				</View>
			);
		};

		const productColumns: ColumnDefinition[] = [
			{
				key: 'name',
				label: 'Produto',
				flex: 1.2,
				render: (item: Product) => (
					<View>
						<Text style={styles.cellTitle}>{item.name}</Text>
						<Text style={styles.cellSubtitle}>{item.category || 'Sem categoria'}</Text>
					</View>
				),
			},
			{
				key: 'price',
				label: 'Preço',
				flex: 0.6,
				align: 'right',
				render: (item: Product) => (
					<Text style={styles.cellTitle}>R$ {Number(item.price ?? 0).toFixed(2)}</Text>
				),
			},
			{
				key: 'stock',
				label: 'Estoque',
				flex: 0.4,
				align: 'center',
				render: (item: Product) => (
					<Text style={[styles.stockBadge, item.stock <= 5 && styles.stockBadgeLow]}>{item.stock}</Text>
				),
			},
			{
				key: 'actions',
				label: 'Ações',
				flex: 0.9,
				align: 'right',
				render: (item: Product) => renderActionButtons('product', item),
			},
		];

		const userColumns: ColumnDefinition[] = [
			{
				key: 'name',
				label: 'Usuário',
				flex: 1.2,
				render: (item: User) => (
					<View>
						<Text style={styles.cellTitle}>{item.name}</Text>
						<Text style={styles.cellSubtitle}>{item.email}</Text>
					</View>
				),
			},
			{
				key: 'role',
				label: 'Perfil',
				flex: 0.6,
				render: (item: User) => (
					<Text style={styles.roleBadge}>{(item.role ?? item.type ?? 'USER').toString().toUpperCase()}</Text>
				),
			},
			{
				key: 'phoneNumber',
				label: 'Contato',
				flex: 1,
				render: (item: User) => (
					<View style={styles.contactWrapper}>
						<Text style={styles.contactText}>{formatPhone(item.phoneNumber)}</Text>
						{item.email ? <Text style={styles.contactSubText}>{item.email}</Text> : null}
					</View>
				),
			},
			{
				key: 'actions',
				label: 'Ações',
				flex: 0.9,
				align: 'right',
				render: (item: User) => renderActionButtons('user', item),
			},
		];

		const orderColumns: ColumnDefinition[] = [
			{
				key: 'id',
				label: 'Pedido',
				flex: 0.6,
				render: (item: any) => (
					<View>
						<Text style={styles.cellTitle}>#{item?.id ?? 'N/A'}</Text>
						<Text style={styles.cellSubtitle}>{item?.user?.name ?? 'Cliente não informado'}</Text>
					</View>
				),
			},
			{
				key: 'orderDate',
				label: 'Data',
				flex: 0.8,
				render: (item: any) => (
					<Text style={styles.tableCellText}>
						{item?.orderDate ? new Date(item.orderDate).toLocaleString() : 'Sem data'}
					</Text>
				),
			},
			{
				key: 'status',
				label: 'Status',
				flex: 0.7,
				render: (item: any) => <Text style={styles.statusBadge}>{mapOrderStatus(item?.status ?? 'pending')}</Text>,
			},
			{
				key: 'totalAmount',
				label: 'Total',
				flex: 0.6,
				align: 'right',
				render: (item: any) => (
					<Text style={styles.cellTitle}>R$ {Number(item?.totalAmount ?? item?.total ?? 0).toFixed(2)}</Text>
				),
			},
			{
				key: 'orderActions',
				label: '',
				flex: 0.6,
				align: 'right',
				render: (item: any) => renderActionButtons('order', item),
			},
		];

		const renderCurrentTab = () => {
			if (selectedTab === 'products') {
				return renderTable(productColumns, filteredProducts, 'Nenhum produto cadastrado.');
			}
			if (selectedTab === 'users') {
				return renderTable(userColumns, filteredUsers, 'Nenhum usuário encontrado.');
			}
			return renderTable(orderColumns, filteredOrders, 'Nenhum pedido encontrado para este usuário.');
		};

		return (
			<SafeAreaView style={styles.container}>
				<ScrollView contentContainerStyle={styles.scrollContent}>
					<View style={styles.header}>
						<View>
							<Text style={styles.title}>Dashboard administrativo</Text>
							<Text style={styles.subtitle}>
								Bem-vindo, {user?.name?.split(' ')[0] ?? 'administrador'}.
							</Text>
						</View>
						<View style={styles.headerActions}>
							<TouchableOpacity style={styles.primaryButton} onPress={handleCreateProduct} activeOpacity={0.9}>
								<Ionicons name="add-outline" size={18} color="#fff" style={styles.primaryButtonIcon} />
								<Text style={styles.primaryButtonText}>Novo produto</Text>
							</TouchableOpacity>
						</View>
					</View>

					<View style={styles.statsGrid}>
						{statsCards.map((card) => (
							<View key={card.key} style={styles.statCard}>
								<View style={[styles.statIconWrapper, { backgroundColor: card.tint }]}>
									<Ionicons name={card.icon} size={20} color="#0F172A" />
								</View>
								<Text style={styles.statLabel}>{card.label}</Text>
								<Text style={styles.statValue}>{card.value}</Text>
								<Text style={styles.statMeta}>{card.meta}</Text>
							</View>
						))}
					</View>

					<View style={styles.panel}>
						<View style={styles.tabsRow}>
							{tabsConfig.map((tab) => {
								const isActive = tab.key === selectedTab;
								return (
									<TouchableOpacity
										key={tab.key}
										style={[styles.tabButton, isActive && styles.tabButtonActive]}
										onPress={() => setSelectedTab(tab.key)}
										activeOpacity={0.9}
									>
										<Ionicons
											name={tab.icon}
											size={18}
											color={isActive ? '#0F172A' : '#64748B'}
										/>
										<Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
									</TouchableOpacity>
								);
							})}
						</View>

						<View style={styles.panelHeader}>
							<View>
								<Text style={styles.sectionTitle}>{currentTabMeta?.label}</Text>
								<Text style={styles.sectionSubtitle}>{currentTabMeta?.description}</Text>
							</View>
							{selectedTab === 'users' && (
								<TouchableOpacity style={styles.secondaryButton} onPress={fetchUsers}>
									<Ionicons name="refresh-outline" size={16} color="#0F172A" />
									<Text style={styles.secondaryButtonText}>Atualizar lista</Text>
								</TouchableOpacity>
							)}
						</View>

						<View style={styles.utilityRow}>
							<View style={styles.searchBar}>
								<Ionicons name="search-outline" size={18} color="#64748B" />
								<TextInput
									style={styles.searchInput}
									placeholder="Buscar por nome, email ou status"
									placeholderTextColor="#94A3B8"
									value={searchQuery}
									onChangeText={setSearchQuery}
								/>
							</View>

							{selectedTab === 'orders' && (
								<View style={styles.orderFilter}>
									<TextInput
										style={styles.orderInput}
										placeholder="ID do usuário"
										placeholderTextColor="#94A3B8"
										value={ordersUserId}
										onChangeText={setOrdersUserId}
										keyboardType="numeric"
									/>
									<TouchableOpacity style={styles.secondaryButton} onPress={handleOrdersSearch}>
										<Ionicons name="download-outline" size={16} color="#0F172A" />
										<Text style={styles.secondaryButtonText}>Buscar</Text>
									</TouchableOpacity>
								</View>
							)}
						</View>

						<Animated.View style={[styles.tabContent, { opacity: tabFadeAnim }]}>{renderCurrentTab()}</Animated.View>
					</View>
				</ScrollView>

				<ConfirmModal
					visible={confirmVisible}
					title="Excluir Produto"
					message="Deseja realmente excluir este produto? Esta ação não pode ser desfeita."
					confirmText="Excluir"
					cancelText="Cancelar"
					loading={loading}
					onCancel={() => {
						setConfirmVisible(false);
						setConfirmTargetId(null);
					}}
					onConfirm={() => {
						if (confirmTargetId) deleteConfirmed(confirmTargetId);
					}}
				/>

				<UserEditModal
					visible={userModalVisible}
					user={editingUser}
					loading={userModalLoading}
					onCancel={() => {
						setUserModalVisible(false);
						setEditingUser(null);
					}}
					onSave={handleSaveUser}
				/>

				<ConfirmModal
					visible={confirmUserVisible}
					title="Excluir Usuário"
					message={userDeleteTarget ? `Deseja realmente excluir ${userDeleteTarget?.name}?` : 'Deseja excluir este usuário?'}
					confirmText="Excluir"
					cancelText="Cancelar"
					loading={userActionLoading}
					onCancel={() => {
						setConfirmUserVisible(false);
						setUserDeleteTarget(null);
					}}
					onConfirm={deleteUserConfirmed}
				/>

				<ProductEditModal
					visible={editModalVisible}
					product={editingProduct}
					categories={editCategories}
					loading={editLoading}
					onCancel={() => {
						setEditModalVisible(false);
						setEditingProduct(null);
					}}
					onSave={async (payload) => {
						if (!editingProduct) return;
						setEditLoading(true);
						try {
							const category = editCategories.find((c) => String(c.id) === String(payload.categoryId));
							const updatePayload = {
								name: payload.name,
								description: editingProduct.description || '',
								price: payload.price,
								stock: payload.stock,
								imageUrl: editingProduct.imageUrl || '',
								category: {
									id: Number(payload.categoryId) || editingProduct.category?.id || null,
									name: category?.name || editingProduct.category?.name || '',
								},
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

							setProducts((prev) => prev.map((p) => (p.id === updatedFront.id ? updatedFront : p)));
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
			</SafeAreaView>
		);
		return (
			<SafeAreaView style={styles.container}>
				<ScrollView contentContainerStyle={styles.scrollContent}>
					<View style={styles.header}>
						<View>
							<Text style={styles.title}>Dashboard administrativo</Text>
							<Text style={styles.subtitle}>
								Bem-vindo, {user?.name?.split(' ')[0] ?? 'administrador'}.
							</Text>
						</View>
						<TouchableOpacity style={styles.primaryButton} onPress={handleCreateProduct} activeOpacity={0.9}>
							<Ionicons name="add-outline" size={18} color="#fff" style={styles.primaryButtonIcon} />
							<Text style={styles.primaryButtonText}>Novo produto</Text>
						</TouchableOpacity>
					</View>

					<View style={styles.statsGrid}>
						{statsCards.map((card) => (
							<View key={card.key} style={styles.statCard}>
								<View style={[styles.statIconWrapper, { backgroundColor: card.tint }]}>
									<Ionicons name={card.icon} size={20} color="#0F172A" />
								</View>
								<Text style={styles.statLabel}>{card.label}</Text>
								<Text style={styles.statValue}>{card.value}</Text>
								<Text style={styles.statMeta}>{card.meta}</Text>
							</View>
						))}
					</View>

					<View style={styles.panel}>
						<View style={styles.tabsRow}>
							{tabsConfig.map((tab) => {
								const isActive = tab.key === selectedTab;
								return (
									<TouchableOpacity
										key={tab.key}
										style={[styles.tabButton, isActive && styles.tabButtonActive]}
										onPress={() => setSelectedTab(tab.key)}
										activeOpacity={0.9}
									>
										<Ionicons
											name={tab.icon}
											size={18}
											color={isActive ? '#0F172A' : '#64748B'}
										/>
										<Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
									</TouchableOpacity>
								);
							})}
						</View>

						<View style={styles.panelHeader}>
							<View>
								<Text style={styles.sectionTitle}>{currentTabMeta?.label}</Text>
								<Text style={styles.sectionSubtitle}>{currentTabMeta?.description}</Text>
							</View>
							{selectedTab === 'users' && (
								<TouchableOpacity style={styles.secondaryButton} onPress={fetchUsers}>
									<Ionicons name="refresh-outline" size={16} color="#0F172A" />
									<Text style={styles.secondaryButtonText}>Atualizar lista</Text>
								</TouchableOpacity>
							)}
						</View>

						<View style={styles.utilityRow}>
							<View style={styles.searchBar}>
								<Ionicons name="search-outline" size={18} color="#64748B" />
								<TextInput
									style={styles.searchInput}
									placeholder="Buscar por nome, email ou status"
									placeholderTextColor="#94A3B8"
									value={searchQuery}
									onChangeText={setSearchQuery}
								/>
							</View>

							{selectedTab === 'orders' && (
								<View style={styles.orderFilter}>
									<TextInput
										style={styles.orderInput}
										placeholder="ID do usuário"
										placeholderTextColor="#94A3B8"
										value={ordersUserId}
										onChangeText={setOrdersUserId}
										keyboardType="numeric"
									/>
									<TouchableOpacity style={styles.secondaryButton} onPress={handleOrdersSearch}>
										<Ionicons name="download-outline" size={16} color="#0F172A" />
										<Text style={styles.secondaryButtonText}>Buscar</Text>
									</TouchableOpacity>
								</View>
							)}
						</View>

						<Animated.View style={[styles.tabContent, { opacity: tabFadeAnim }]}>{renderCurrentTab()}</Animated.View>
					</View>
				</ScrollView>

				<ConfirmModal
					visible={confirmVisible}
					title="Excluir Produto"
					message="Deseja realmente excluir este produto? Esta ação não pode ser desfeita."
					confirmText="Excluir"
					cancelText="Cancelar"
					loading={loading}
					onCancel={() => {
						setConfirmVisible(false);
						setConfirmTargetId(null);
					}}
					onConfirm={() => {
						if (confirmTargetId) deleteConfirmed(confirmTargetId);
					}}
				/>

				<UserEditModal
					visible={userModalVisible}
					user={editingUser}
					loading={userModalLoading}
					onCancel={() => {
						setUserModalVisible(false);
						setEditingUser(null);
					}}
					onSave={handleSaveUser}
				/>

				<ConfirmModal
					visible={confirmUserVisible}
					title="Excluir Usuário"
					message={userDeleteTarget ? `Deseja realmente excluir ${userDeleteTarget?.name}?` : 'Deseja excluir este usuário?'}
					confirmText="Excluir"
					cancelText="Cancelar"
					loading={userActionLoading}
					onCancel={() => {
						setConfirmUserVisible(false);
						setUserDeleteTarget(null);
					}}
					onConfirm={deleteUserConfirmed}
				/>

				<ProductEditModal
					visible={editModalVisible}
					product={editingProduct}
					categories={editCategories}
					loading={editLoading}
					onCancel={() => {
						setEditModalVisible(false);
						setEditingProduct(null);
					}}
					onSave={async (payload) => {
						if (!editingProduct) return;
						setEditLoading(true);
						try {
							const category = editCategories.find((c) => String(c.id) === String(payload.categoryId));
							const updatePayload = {
								name: payload.name,
								description: editingProduct.description || '',
								price: payload.price,
								stock: payload.stock,
								imageUrl: editingProduct.imageUrl || '',
								category: {
									id: Number(payload.categoryId) || editingProduct.category?.id || null,
									name: category?.name || editingProduct.category?.name || '',
								},
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

							setProducts((prev) => prev.map((p) => (p.id === updatedFront.id ? updatedFront : p)));
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
			backgroundColor: '#EEF2FF',
		},
		scrollContent: {
			paddingHorizontal: 20,
			paddingTop: 20,
			paddingBottom: 60,
			gap: 20,
		},
		header: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'flex-start',
			marginBottom: 12,
			flexWrap: 'wrap',
			gap: 12,
		},
		headerActions: {
			flexDirection: 'row',
			justifyContent: 'flex-end',
			flexGrow: 1,
			flexShrink: 0,
			minWidth: 160,
		},
		title: {
			fontSize: 24,
			fontWeight: '700',
			color: '#0F172A',
			marginBottom: 4,
		},
		subtitle: {
			fontSize: 16,
			color: '#475569',
		},
		primaryButton: {
			backgroundColor: '#2563EB',
			borderRadius: 999,
			paddingHorizontal: 20,
			paddingVertical: 12,
			flexDirection: 'row',
			alignItems: 'center',
			shadowColor: '#2563EB',
			shadowOpacity: 0.3,
			shadowRadius: 8,
			shadowOffset: { width: 0, height: 8 },
			elevation: 4,
			alignSelf: 'flex-start',
			flexShrink: 0,
		},
		primaryButtonIcon: {
			marginRight: 8,
		},
		primaryButtonText: {
			color: '#fff',
			fontSize: 15,
			fontWeight: '600',
		},
		statsGrid: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			gap: 12,
			marginBottom: 24,
		},
		statCard: {
			flex: 1,
			minWidth: 160,
			backgroundColor: '#FFFFFF',
			borderRadius: 16,
			padding: 16,
			borderWidth: 1,
			borderColor: '#E2E8F0',
		},
		statIconWrapper: {
			width: 36,
			height: 36,
			borderRadius: 10,
			justifyContent: 'center',
			alignItems: 'center',
			marginBottom: 12,
		},
		statLabel: {
			color: '#475569',
			fontSize: 13,
		},
		statValue: {
			fontSize: 24,
			fontWeight: '700',
			color: '#0F172A',
			marginVertical: 4,
		},
		statMeta: {
			color: '#64748B',
			fontSize: 12,
		},
		panel: {
			backgroundColor: '#FFFFFF',
			borderRadius: 20,
			padding: 20,
			borderWidth: 1,
			borderColor: '#E2E8F0',
			shadowColor: '#0F172A',
			shadowOpacity: 0.04,
			shadowRadius: 12,
			shadowOffset: { width: 0, height: 4 },
			elevation: 3,
			marginBottom: 24,
		},
		tabsRow: {
			flexDirection: 'row',
			backgroundColor: '#F1F5F9',
			borderRadius: 999,
			padding: 4,
			marginBottom: 16,
		},
		tabButton: {
			flex: 1,
			flexDirection: 'row',
			justifyContent: 'center',
			alignItems: 'center',
			paddingVertical: 10,
			borderRadius: 999,
			gap: 6,
		},
		tabButtonActive: {
			backgroundColor: '#FFFFFF',
			shadowColor: '#94A3B8',
			shadowOpacity: 0.25,
			shadowRadius: 6,
			shadowOffset: { width: 0, height: 3 },
			elevation: 3,
		},
		tabText: {
			color: '#64748B',
			fontWeight: '600',
		},
		tabTextActive: {
			color: '#0F172A',
		},
		panelHeader: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'flex-start',
			marginBottom: 16,
			flexWrap: 'wrap',
			gap: 12,
		},
		sectionTitle: {
			fontSize: 18,
			fontWeight: '700',
			color: '#0F172A',
		},
		sectionSubtitle: {
			color: '#64748B',
			marginTop: 2,
		},
		secondaryButton: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: '#E2E8F0',
			borderRadius: 999,
			paddingHorizontal: 14,
			paddingVertical: 8,
			gap: 6,
		},
		secondaryButtonText: {
			color: '#0F172A',
			fontWeight: '600',
			fontSize: 13,
		},
		utilityRow: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			gap: 12,
			marginBottom: 16,
			flexWrap: 'wrap',
		},
		searchBar: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: '#F8FAFC',
			borderRadius: 12,
			paddingHorizontal: 14,
			flex: 1,
			borderWidth: 1,
			borderColor: '#E2E8F0',
			gap: 8,
		},
		searchInput: {
			flex: 1,
			color: '#0F172A',
		},
		orderFilter: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 8,
			flexWrap: 'wrap',
		},
		orderInput: {
			width: 140,
			backgroundColor: '#F8FAFC',
			borderRadius: 12,
			borderWidth: 1,
			borderColor: '#E2E8F0',
			paddingHorizontal: 12,
			color: '#0F172A',
			height: 44,
		},
		tabContent: {
			borderWidth: 1,
			borderColor: '#E2E8F0',
			borderRadius: 16,
			padding: 8,
			backgroundColor: '#FFFFFF',
		},
		loadingState: {
			alignItems: 'center',
			paddingVertical: 24,
		},
		loadingText: {
			marginTop: 8,
			color: '#475569',
		},
		errorText: {
			color: '#B91C1C',
			padding: 12,
		},
		emptyText: {
			color: '#64748B',
			padding: 16,
			textAlign: 'center',
		},
		tableHeader: {
			flexDirection: 'row',
			paddingVertical: 12,
			borderBottomWidth: 1,
			borderBottomColor: '#E2E8F0',
		},
		tableHeaderCell: {
			fontSize: 12,
			fontWeight: '700',
			textTransform: 'uppercase',
			color: '#94A3B8',
		},
		tableRow: {
			flexDirection: 'row',
			paddingVertical: 14,
			borderBottomWidth: 1,
			borderBottomColor: '#F1F5F9',
		},
		tableCell: {
			justifyContent: 'center',
			paddingHorizontal: 8,
			flexShrink: 1,
		},
		tableCellText: {
			color: '#0F172A',
			flexWrap: 'wrap',
		},
		cellTitle: {
			color: '#0F172A',
			fontWeight: '600',
		},
		cellSubtitle: {
			color: '#94A3B8',
			fontSize: 12,
		},
		stockBadge: {
			paddingHorizontal: 10,
			paddingVertical: 4,
			borderRadius: 999,
			backgroundColor: '#DCFCE7',
			color: '#14532D',
			fontWeight: '600',
			overflow: 'hidden',
		},
		stockBadgeLow: {
			backgroundColor: '#FEF3C7',
			color: '#92400E',
		},
		roleBadge: {
			alignSelf: 'flex-start',
			paddingHorizontal: 10,
			paddingVertical: 4,
			borderRadius: 999,
			backgroundColor: '#E0E7FF',
			color: '#312E81',
			fontWeight: '700',
			fontSize: 12,
		},
		statusBadge: {
			alignSelf: 'flex-start',
			backgroundColor: '#E0F2FE',
			color: '#0369A1',
			paddingHorizontal: 10,
			paddingVertical: 4,
			borderRadius: 999,
			fontWeight: '600',
			fontSize: 12,
		},
		rowActions: {
			flexDirection: 'row',
			gap: 10,
			justifyContent: 'flex-end',
			flexWrap: 'wrap',
		},
		rowActionButton: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			paddingHorizontal: 12,
			paddingVertical: 8,
			borderRadius: 999,
			gap: 6,
			minWidth: 96,
		},
		rowActionPrimary: {
			backgroundColor: '#2563EB',
		},
		rowActionDanger: {
			backgroundColor: '#DC2626',
		},
		rowActionText: {
			color: '#FFFFFF',
			fontSize: 12,
			fontWeight: '600',
		},
		rowActionDisabled: {
			opacity: 0.5,
		},
		rowActionGhost: {
			backgroundColor: '#E2E8F0',
			minWidth: undefined,
			paddingHorizontal: 10,
		},
		rowActionGhostText: {
			color: '#0F172A',
		},
		contactWrapper: {
			gap: 2,
		},
		contactText: {
			color: '#0F172A',
			fontWeight: '600',
		},
		contactSubText: {
			color: '#94A3B8',
			fontSize: 12,
		},
		textCenter: {
			textAlign: 'center',
		},
		textRight: {
			textAlign: 'right',
		},
	});

