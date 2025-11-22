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

const isNumericString = (value: string) => /^\d+$/.test(value.trim());

const getInitials = (value?: string | null) => {
	const chunks = (value ?? '')
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? '');
	return chunks.join('') || 'US';
};

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
	primary: '#00BCD4',
	primaryDark: '#00BCD4',
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
	const [activeUser, setActiveUser] = useState<User | null>(null);

	const tabFadeAnim = useRef(new Animated.Value(1)).current;

	const normalizeEmailValue = (value?: string | null) => (value ?? '').trim().toLowerCase();

	useEffect(() => {
		if (selectedTab === 'products') fetchProducts();
		if (selectedTab === 'users') fetchUsers();
	}, [selectedTab]);

	useEffect(() => {
		fetchUsers();
	}, []);

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

	useEffect(() => {
		if (!activeUser) return;
		const stillExists = users.some(
			(u) =>
				(u.id && activeUser.id && u.id === activeUser.id) ||
				normalizeEmailValue(u.email) === normalizeEmailValue(activeUser.email),
		);
		if (!stillExists) {
			setActiveUser(null);
		}
	}, [users, activeUser]);

	useEffect(() => {
		if (selectedTab !== 'users' && activeUser) {
			setActiveUser(null);
		}
	}, [selectedTab, activeUser]);

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

	async function fetchOrdersForUser(id: number, options?: { silent?: boolean }) {
		setError(null);
		if (!options?.silent) {
			setLoading(true);
		}
		try {
			const res = await orderService.getUserOrders(id);
			setOrders(res || []);
			if (!res || res.length === 0) {
				setError('Nenhum pedido encontrado para este usuário');
			}
		} catch (e: any) {
			setError('Erro ao buscar pedidos');
			console.error(e);
		} finally {
			if (!options?.silent) {
				setLoading(false);
			}
		}
	}

	function handleCreateProduct() {
		router.push('/admin/create-product');
	}

	function handleManageCategories() {
		router.push('/admin/categories');
	}

	async function handleOrdersSearch() {
		if (selectedTab !== 'orders') return;
		const term = searchQuery.trim();
		if (!term) {
			setError('Informe um termo para buscar pedidos');
			return;
		}
		if (!isNumericString(term)) {
			toast.showInfo('Filtro aplicado', 'Filtrando pedidos pelo nome do cliente.');
			return;
		}
		const numericId = Number(term);
		setError(null);
		setLoading(true);
		try {
			const order = await orderService.getOrderById(numericId);
			if (order) {
				setOrders([order]);
				return;
			}
			await fetchOrdersForUser(numericId, { silent: true });
		} catch (error) {
			console.error('Erro ao buscar pedido pelo ID informado:', error);
			await fetchOrdersForUser(numericId, { silent: true });
		} finally {
			setLoading(false);
		}
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
				flex: 1,
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
				flex: 0.65,
				align: 'left',
				render: (item: Product) => (
					<Text style={styles.cellTitle}>{Number(item.price ?? 0).toFixed(2)}</Text>
				),
			},
			{
				key: 'stock',
				label: 'Estoque',
				flex: 1,
				align: 'center',
				render: (item: Product) => (
					<Text style={[styles.stockBadge, item.stock <= 5 && styles.stockBadgeLow]}>{item.stock}</Text>
				),
			},
			{
				key: 'actions',
				label: 'Ações',
				flex: 0.95,
				align: 'center',
				render: (item: Product) => renderActionButtons('product', item),
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

		const isSameUser = (a?: User | null, b?: User | null) => {
			if (!a || !b) return false;
			if (a.id && b.id && a.id === b.id) return true;
			return normalizeEmailValue(a.email) === normalizeEmailValue(b.email);
		};

		const renderUserDetails = (target: User) => {
			const roleLabel = (target.role ?? target.type ?? 'USER').toString().toUpperCase();
			const isCurrentUser =
				(user?.id && target.id && user.id === target.id) ||
				(user?.email && target.email && normalizeEmailValue(user.email) === normalizeEmailValue(target.email));

			return (
				<View style={styles.userDetailCard}>
					<View style={styles.userDetailHeader}>
						<View>
							<Text style={styles.userDetailName}>{target.name || 'Usuário sem nome'}</Text>
							<Text style={styles.userDetailEmail}>{target.email || 'Email não informado'}</Text>
						</View>
						<Text style={styles.roleBadgeExpanded}>{roleLabel}</Text>
					</View>

					<View style={styles.userDetailRow}>
						<Ionicons name="mail-outline" size={16} color={palette.muted} />
						<Text style={styles.userDetailLabel}>Email</Text>
						<Text style={styles.userDetailValue}>{target.email || 'Não informado'}</Text>
					</View>
					<View style={styles.userDetailRow}>
						<Ionicons name="call-outline" size={16} color={palette.muted} />
						<Text style={styles.userDetailLabel}>Contato</Text>
						<Text style={styles.userDetailValue}>{formatPhone(target.phoneNumber)}</Text>
					</View>
					<View style={styles.userDetailRow}>
						<Ionicons name="card-outline" size={16} color={palette.muted} />
						<Text style={styles.userDetailLabel}>CPF</Text>
						<Text style={styles.userDetailValue}>{target.cpf || 'Não informado'}</Text>
					</View>
					<View style={styles.userDetailRow}>
						<Ionicons name="shield-checkmark-outline" size={16} color={palette.muted} />
						<Text style={styles.userDetailLabel}>Perfil</Text>
						<Text style={styles.userDetailValue}>{roleLabel}</Text>
					</View>
					<View style={styles.userDetailRow}>
						<Ionicons name="calendar-outline" size={16} color={palette.muted} />
						<Text style={styles.userDetailLabel}>Cadastro</Text>
						<Text style={styles.userDetailValue}>{target.id ? `ID #${target.id}` : 'Não informado'}</Text>
					</View>

					<View style={styles.userDetailActions}>
						<TouchableOpacity
							style={[styles.detailButton, styles.detailButtonPrimary]}
							onPress={() => openUserEditor(target)}
						>
							<Ionicons name="create-outline" size={16} color="#fff" />
							<Text style={styles.detailButtonText}>Editar</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[
								styles.detailButton,
								styles.detailButtonDanger,
								(isCurrentUser || !target.email) && styles.rowActionDisabled,
							]}
							onPress={() => {
								if (isCurrentUser) {
									toast.showError('Operação não permitida', 'Você não pode excluir sua própria conta.');
									return;
								}
								handleDeleteUser(target);
							}}
							disabled={isCurrentUser || !target.email}
						>
							<Ionicons name="trash-outline" size={16} color="#fff" />
							<Text style={styles.detailButtonText}>Excluir</Text>
						</TouchableOpacity>
					</View>
				</View>
			);
		};

		const renderUserDirectory = () => {
			if (loading) {
				return (
					<View style={styles.loadingState}>
						<ActivityIndicator size="small" color={palette.info} />
						<Text style={styles.loadingText}>Carregando dados...</Text>
					</View>
				);
			}

			if (error) {
				return <Text style={styles.errorText}>{error}</Text>;
			}

			if (!filteredUsers.length) {
				return <Text style={styles.emptyText}>Nenhum usuário encontrado.</Text>;
			}

			return (
				<View style={styles.userDirectory}>
					<View style={styles.userList}>
						{filteredUsers.map((item) => {
							const isActiveUser = isSameUser(activeUser, item);
							return (
								<TouchableOpacity
									key={`user-${item.id || item.email}`}
									style={[styles.userListItem, isActiveUser && styles.userListItemActive]}
									onPress={() =>
										setActiveUser((current) => (isSameUser(current, item) ? null : item))
								}
								>
									<View style={styles.userAvatar}>
										<Text style={styles.userAvatarText}>{getInitials(item.name)}</Text>
									</View>
									<View style={styles.userListMeta}>
										<Text style={styles.userListName}>{item.name || 'Usuário sem nome'}</Text>
										<Text style={styles.userListEmail}>{item.email || 'Email não informado'}</Text>
									</View>
									<Text style={[styles.userRolePill, isActiveUser && styles.userRolePillActive]}>
										{(item.role ?? item.type ?? 'USER').toString().toUpperCase()}
									</Text>
									<Ionicons
										name="chevron-forward"
										size={18}
										color={isActiveUser ? palette.primaryDark : palette.muted}
									/>

								</TouchableOpacity>
							);
						})}
					</View>
					{activeUser ? (
						<View style={styles.userDetailWrapper}>{renderUserDetails(activeUser)}</View>
					) : (
						<Text style={styles.userHint}>Selecione um usuário para visualizar os detalhes.</Text>
					)}
				</View>
			);
		};

		const renderCurrentTab = () => {
			if (selectedTab === 'products') {
				return renderTable(productColumns, filteredProducts, 'Nenhum produto cadastrado.');
			}
			if (selectedTab === 'users') {
				return renderUserDirectory();
			}
			return renderTable(orderColumns, filteredOrders, 'Nenhum pedido encontrado para este usuário.');
		};

		return (
			<SafeAreaView style={styles.container}>
				<ScrollView contentContainerStyle={styles.scrollContent}>
					<View style={styles.header}>
						<Text style={styles.title}>Dashboard administrativo</Text>
						<Text style={styles.subtitle}>Bem-vindo, {user?.name?.split(' ')[0] ?? 'administrador'}.</Text>
					</View>

					<View style={styles.quickActionsRow}>
						<TouchableOpacity
							style={[styles.fullWidthCTA, styles.quickAction]}
							onPress={handleCreateProduct}
							activeOpacity={0.9}
						>
							<Ionicons name="add-outline" size={20} color="#fff" style={styles.primaryButtonIcon} />
							<Text style={styles.primaryButtonText}>Novo produto</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.fullWidthCTA, styles.quickAction, styles.secondaryCTA]}
							onPress={handleManageCategories}
							activeOpacity={0.9}
						>
							<Ionicons name="layers-outline" size={20} color="#fff" style={styles.primaryButtonIcon} />
							<Text style={styles.primaryButtonText}>Categoria</Text>
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
							<View style={[styles.searchBar, selectedTab === 'orders' && styles.searchBarOrders]}>
								<Ionicons name="search-outline" size={18} color={palette.muted} />
								<TextInput
									style={styles.searchInput}
									placeholder={
										selectedTab === 'orders'
											? 'Buscar por ID ou nome do cliente'
											: 'Buscar por nome, email ou status'
									}
									placeholderTextColor={palette.muted}
									value={searchQuery}
									onChangeText={setSearchQuery}
									onSubmitEditing={() => {
										if (selectedTab === 'orders') {
											handleOrdersSearch();
										}
									}}
									returnKeyType={selectedTab === 'orders' ? 'search' : 'done'}
								/>
								{selectedTab === 'orders' && (
									<TouchableOpacity style={styles.searchActionButton} onPress={handleOrdersSearch}>
										<Ionicons name="arrow-forward-outline" size={16} color="#fff" />
										<Text style={styles.searchActionText}>Buscar</Text>
									</TouchableOpacity>
								)}
							</View>
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
			backgroundColor: palette.background,
		},
		scrollContent: {
			paddingHorizontal: 20,
			paddingTop: 20,
			paddingBottom: 60,
			gap: 20,
		},
		header: {
			gap: 4,
		},
		title: {
			fontSize: 24,
			fontWeight: '700',
			color: palette.text,
		},
		subtitle: {
			fontSize: 16,
			color: palette.softText,
		},
		quickActionsRow: {
			flexDirection: 'row',
			gap: 12,
			flexWrap: 'wrap',
		},
		fullWidthCTA: {
			backgroundColor: palette.primary,
			borderRadius: 16,
			paddingHorizontal: 24,
			paddingVertical: 14,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			gap: 8,
			shadowColor: palette.primaryDark,
			shadowOpacity: 0.35,
			shadowRadius: 12,
			shadowOffset: { width: 0, height: 6 },
			elevation: 6,
		},
		quickAction: {
			flex: 1,
			minWidth: 160,
		},
		secondaryCTA: {
			backgroundColor: palette.text,
		},
		primaryButtonIcon: {
			marginRight: 4,
		},
		primaryButtonText: {
			color: '#fff',
			fontSize: 16,
			fontWeight: '700',
			textTransform: 'uppercase',
			letterSpacing: 0.5,
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
			backgroundColor: palette.card,
			borderRadius: 16,
			padding: 16,
			borderWidth: 1,
			borderColor: palette.border,
		},
		statIconWrapper: {
			width: 40,
			height: 40,
			borderRadius: 12,
			justifyContent: 'center',
			alignItems: 'center',
			marginBottom: 12,
		},
		statLabel: {
			color: palette.softText,
			fontSize: 13,
		},
		statValue: {
			fontSize: 24,
			fontWeight: '700',
			color: palette.text,
			marginVertical: 4,
		},
		statMeta: {
			color: palette.muted,
			fontSize: 12,
		},
		panel: {
			backgroundColor: palette.card,
			borderRadius: 24,
			padding: 20,
			borderWidth: 1,
			borderColor: palette.border,
			shadowColor: '#000000',
			shadowOpacity: 0.06,
			shadowRadius: 14,
			shadowOffset: { width: 0, height: 8 },
			elevation: 5,
			marginBottom: 24,
		},
		tabsRow: {
			flexDirection: 'row',
			backgroundColor: '#EAF4F6',
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
			backgroundColor: '#fff',
			shadowColor: '#94A3B8',
			shadowOpacity: 0.3,
			shadowRadius: 8,
			shadowOffset: { width: 0, height: 4 },
			elevation: 3,
		},
		tabText: {
			color: palette.muted,
			fontWeight: '600',
		},
		tabTextActive: {
			color: palette.text,
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
			color: palette.text,
		},
		sectionSubtitle: {
			color: palette.muted,
			marginTop: 2,
		},
		secondaryButton: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: '#E2F6F8',
			borderRadius: 999,
			paddingHorizontal: 14,
			paddingVertical: 8,
			gap: 6,
		},
		secondaryButtonText: {
			color: palette.primaryDark,
			fontWeight: '600',
			fontSize: 13,
		},
		utilityRow: {
			flexDirection: 'row',
			gap: 12,
			marginBottom: 16,
		},
		searchBar: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: '#F8FBFC',
			borderRadius: 14,
			paddingHorizontal: 16,
			flex: 1,
			borderWidth: 1,
			borderColor: palette.border,
			gap: 10,
			minHeight: 48,
		},
		searchBarOrders: {
			paddingVertical: 4,
		},
		searchInput: {
			flex: 1,
			color: palette.text,
			fontSize: 15,
		},
		searchActionButton: {
			backgroundColor: palette.primaryDark,
			paddingHorizontal: 16,
			paddingVertical: 8,
			borderRadius: 999,
			flexDirection: 'row',
			alignItems: 'center',
			gap: 6,
		},
		searchActionText: {
			color: '#fff',
			fontWeight: '700',
		},
		tabContent: {
			borderWidth: 1,
			borderColor: palette.border,
			borderRadius: 18,
			padding: 8,
			backgroundColor: palette.card,
		},
		loadingState: {
			alignItems: 'center',
			paddingVertical: 24,
			gap: 8,
		},
		loadingText: {
			color: palette.softText,
		},
		errorText: {
			color: palette.danger,
			padding: 12,
			textAlign: 'center',
		},
		emptyText: {
			color: palette.muted,
			padding: 16,
			textAlign: 'center',
		},
		tableHeader: {
			flexDirection: 'row',
			paddingVertical: 12,
			borderBottomWidth: 1,
			borderBottomColor: palette.border,
		},
		tableHeaderCell: {
			fontSize: 12,
			fontWeight: '700',
			textTransform: 'uppercase',
			color: palette.muted,
			paddingHorizontal: 12,
		},
		tableRow: {
			flexDirection: 'row',
			paddingVertical: 14,
			borderBottomWidth: 1,
			borderBottomColor: '#F1F4F8',
		},
		tableCell: {
			justifyContent: 'center',
			paddingHorizontal: 12,
			flexShrink: 1,
		},
		tableCellText: {
			color: palette.text,
			flexWrap: 'wrap',
		},
		cellTitle: {
			color: palette.text,
			fontWeight: '600',
			fontSize: 12,
		},
		cellSubtitle: {
			color: palette.muted,
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
			minWidth: 44,
			textAlign: 'center',
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
			backgroundColor: palette.info,
		},
		rowActionDanger: {
			backgroundColor: palette.danger,
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
			color: palette.text,
		},
		iconActionButton: {
			padding: 6,
			borderRadius: 999,
			alignItems: 'center',
			justifyContent: 'center',
		},
		iconActionDisabled: {
			opacity: 0.35,
		},
		contactWrapper: {
			gap: 2,
		},
		contactText: {
			color: palette.text,
			fontWeight: '600',
		},
		contactSubText: {
			color: palette.muted,
			fontSize: 12,
		},
		textCenter: {
			textAlign: 'center',
		},
		textRight: {
			textAlign: 'right',
		},
		userDirectory: {
			gap: 16,
		},
		userList: {
			gap: 8,
		},
		userListItem: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 12,
			backgroundColor: '#F7FAFB',
			borderRadius: 14,
			padding: 14,
			borderWidth: 1,
			borderColor: palette.border,
		},
		userListItemActive: {
			borderColor: palette.primary,
			backgroundColor: '#E8FBFD',
		},
		userAvatar: {
			width: 40,
			height: 40,
			borderRadius: 20,
			backgroundColor: palette.primary,
			justifyContent: 'center',
			alignItems: 'center',
		},
		userAvatarText: {
			color: '#fff',
			fontWeight: '700',
		},
		userListMeta: {
			flex: 1,
		},
		userListName: {
			color: palette.text,
			fontWeight: '600',
		},
		userListEmail: {
			color: palette.muted,
			fontSize: 12,
		},
		userRolePill: {
			paddingHorizontal: 10,
			paddingVertical: 4,
			borderRadius: 999,
			backgroundColor: '#E0F2FE',
			color: palette.info,
			fontWeight: '700',
			fontSize: 12,
		},
		userRolePillActive: {
			backgroundColor: palette.primary,
			color: '#fff',
		},
		userDetailWrapper: {
			backgroundColor: '#F7FAFB',
			borderRadius: 18,
			padding: 16,
			borderWidth: 1,
			borderColor: palette.border,
		},
		userHint: {
			color: palette.muted,
			textAlign: 'center',
		},
		userDetailCard: {
			gap: 12,
		},
		userDetailHeader: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'flex-start',
			gap: 12,
		},
		userDetailName: {
			color: palette.text,
			fontSize: 18,
			fontWeight: '700',
		},
		userDetailEmail: {
			color: palette.muted,
		},
		roleBadgeExpanded: {
			paddingHorizontal: 12,
			paddingVertical: 4,
			borderRadius: 999,
			backgroundColor: '#E0E7FF',
			color: '#312E81',
			fontWeight: '700',
		},
		userDetailRow: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 8,
		},
		userDetailLabel: {
			color: palette.softText,
			fontWeight: '600',
		},
		userDetailValue: {
			color: palette.text,
			flex: 1,
		},
		userDetailActions: {
			flexDirection: 'row',
			gap: 12,
			flexWrap: 'wrap',
		},
		detailButton: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 8,
			borderRadius: 999,
			paddingHorizontal: 16,
			paddingVertical: 10,
		},
		detailButtonPrimary: {
			backgroundColor: palette.info,
		},
		detailButtonDanger: {
			backgroundColor: palette.danger,
		},
		detailButtonText: {
			color: '#fff',
			fontWeight: '700',
			fontSize: 12,
		},
	});

