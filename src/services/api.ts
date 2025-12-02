// src/services/api.ts

import axios, { AxiosInstance } from "axios";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types/product';
import { API_BASE_URL, API_TIMEOUT } from '@env';
import * as Linking from 'expo-linking';

class ApiService {
  private api: AxiosInstance;
  private publicApi: AxiosInstance;
  private mapProductDTO(dto: ProductDTO): Product {
    const categoryId = dto.categoryId ?? dto.category?.id ?? null;
    const rawCategoryName = dto.categoryName ?? dto.category?.name ?? '';
    const categoryName = rawCategoryName?.trim() || 'Sem categoria';
    const mainImageCandidate = dto.mainImageUrl ?? dto.imageUrl ?? dto.imageUrls?.[0] ?? null;
    const resolvedMainImage = this.resolveImageUrl(mainImageCandidate);
    const gallery = (dto.imageUrls ?? [])
      .map((url: string | null | undefined) => this.resolveImageUrl(url))
      .filter((url): url is string => Boolean(url));

    return {
      id: dto.id,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      category: categoryName,
      image_url: resolvedMainImage,
      stock: dto.stock ?? 0,
      categoryId,
      subcategoryId: dto.subcategoryId ?? null,
      subcategoryName: dto.subcategoryName ?? null,
      gallery,
      themeIds: dto.themeIds ?? [],
      themeNames: dto.themeNames ?? [],
    };
  }

  private normalizeProductPayload(payload: any): ProductDTO[] {
    if (!payload) {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload;
    }
    if (Array.isArray(payload?.content)) {
      return payload.content;
    }
    return [];
  }

  private extractPaginationMeta(payload: any): {
    page: number;
    size: number;
    totalPages: number;
    totalItems: number;
  } {
    const page = Number(payload?.number ?? payload?.page ?? payload?.currentPage ?? 0);
    const size = Number(payload?.size ?? payload?.pageSize ?? payload?.perPage ?? 0);
    const totalPages = Number(payload?.totalPages ?? payload?.pages ?? 0);
    const totalItems = Number(payload?.totalElements ?? payload?.totalItems ?? payload?.total ?? 0);
    return { page, size, totalPages, totalItems };
  }

  private async tryCategoryEndpoints(client: AxiosInstance, endpoints: string[]): Promise<CategoryDTO[]> {
    let lastError: any = null;
    for (const path of endpoints) {
      try {
        console.log('ApiService.tryCategoryEndpoints -> requesting', path);
        const response = await client.get<CategoryDTO[]>(path);
        console.log('ApiService.tryCategoryEndpoints -> received', response.data.length, 'categories');
        return response.data;
      } catch (error: any) {
        lastError = error;
        if (this.shouldStopCategoryFallback(error)) {
          throw error;
        }
        console.warn('ApiService.tryCategoryEndpoints -> endpoint failed, trying next path', path, error?.message);
      }
    }
    throw lastError ?? new Error('Nenhum endpoint de categoria disponível');
  }

  private shouldStopCategoryFallback(error: any): boolean {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      return true;
    }
    if (status === 404 || status === 405) {
      return false;
    }
    if (status === 500) {
      const message = (error?.response?.data?.message ?? '').toString().toLowerCase();
      if (message.includes('not supported')) {
        return false;
      }
    }
    return true;
  }

  constructor() {
    // API com autenticação (para rotas protegidas)
    const resolvedBaseURL = (API_BASE_URL || "").trim().replace(/\/$/, "");
    const timeoutMs = Number(API_TIMEOUT) || 15000;
    console.log('ApiService -> resolved base URL:', resolvedBaseURL, 'timeout:', timeoutMs);
    this.api = axios.create({
      baseURL: resolvedBaseURL,
      timeout: timeoutMs,
    });
    // Public API client (no auth headers/interceptors) — used for public endpoints when token unauthenticated
    this.publicApi = axios.create({
      baseURL: resolvedBaseURL,
      timeout: timeoutMs,
    });
    this.api.interceptors.request.use(
      async (config) => {
        const token = await this.getToken();
        console.log('ApiService.interceptor -> token found:', !!token);
        try {
          // Mask token for logs: show prefix and suffix only
          const masked = token ? `${token.slice(0, 6)}...${token.slice(-6)}` : null;
          console.log('ApiService.interceptor -> masked token:', masked);
        } catch (e) {
          console.log('ApiService.interceptor -> masked token error', e);
        }
        if (token) {
          // ensure header object exists
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
          // log the header that will be sent (masked)
          try {
            const sent = typeof config.headers.Authorization === 'string' ? (config.headers.Authorization as string) : '';
            const maskedHeader = sent ? `${sent.slice(0, 12)}...` : 'none';
            console.log('ApiService.interceptor -> Authorization header to be sent (masked):', maskedHeader);
          } catch (e) {
            console.log('ApiService.interceptor -> could not compute masked header', e);
          }
        } else {
          console.log('ApiService.interceptor -> no token, request will be unauthenticated');
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Interceptor de resposta para tratar erros 401
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Verifica se a resposta é HTML (erro do Cloudflare/Render)
        if (error.response && typeof error.response.data === 'string' && error.response.data.includes('<!DOCTYPE html>')) {
             console.error('API Error: Recebido HTML em vez de JSON. Provável erro 5xx do servidor.', error.response.status);
             // Retorna um erro formatado para não quebrar o JSON.parse em outros lugares
             return Promise.reject({
                 message: 'O servidor está temporariamente indisponível. Tente novamente mais tarde.',
                 status: error.response.status,
                 isServerHtmlError: true
             });
        }

        try {
          const status = error?.response?.status;
          console.log('ApiService.response.interceptor -> error status:', status);
          // log body for debugging
          if (error?.response?.data) {
            console.log('ApiService.response.interceptor -> error body:', error.response.data);
          }
          if (status === 401) {
            console.log('ApiService.response.interceptor -> status 401, removing token');
            await this.removeToken();
          }
          if (status === 403) {
            console.warn('ApiService.response.interceptor -> 403 Forbidden received from API');
          }
        } catch (e) {
          console.error('ApiService.response.interceptor -> unexpected error while handling response error', e);
        }
        return Promise.reject(error);
      }
    );
  }

  async saveToken(token: string): Promise<void> {
    try {
      console.log('ApiService.saveToken -> saving token (masked):', token ? '***' : null);
      await AsyncStorage.setItem('@auth_token', token);

      // Also set default Authorization header to ensure subsequent requests include it
      try {
        const headerValue = `Bearer ${token}`;
        // set in defaults common and instance headers for safety
        (this.api.defaults.headers as any) = (this.api.defaults.headers || {});
        (this.api.defaults.headers.common as any) = (this.api.defaults.headers.common || {});
        (this.api.defaults.headers.common as any).Authorization = headerValue;
        // Also set on instance level
        (this.api.defaults as any).Authorization = headerValue;
        console.log('ApiService.saveToken -> default Authorization header set (masked)');
      } catch (e) {
        console.warn('ApiService.saveToken -> could not set default header:', e);
      }
    } catch (error) {
      console.error('ApiService.saveToken -> error saving token', error);
    }
  }

  async wakeUp(): Promise<void> {
    try {
      console.log('ApiService.wakeUp -> sending ping to wake up server');
      await this.publicApi.get('/categories/list');
      console.log('ApiService.wakeUp -> server is awake');
    } catch (error) {
      console.log('ApiService.wakeUp -> ping failed (expected if server is sleeping or offline)', error);
    }
  }

  async getToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      // console.log('ApiService.getToken -> token exists:', !!token);
      return token;
    } catch (error) {
      console.error('Erro ao buscar token:', error);
      return null;
    }
  }

  async removeToken(): Promise<void> {
    try {
      console.log('ApiService.removeToken -> removing token');
      await AsyncStorage.removeItem('@auth_token');
    } catch (error) {
      console.error('Erro ao remover token:', error);
    }
  }

  get instance() {
    return this.api;
  }

  // ========================================
  // MÉTODOS - CATEGORIAS
  // ========================================

  /**
   * Buscar todas as categorias (rota pública)
   */
  async getAllCategories(): Promise<CategoryDTO[]> {
    try {
      console.log('ApiService.getAllCategories -> buscando categorias...');
      const token = await this.getToken();
      const apiToUse = token ? this.api : this.publicApi;

      const payload = await this.tryCategoryEndpoints(apiToUse, ['/categories/list', '/categories']);
      return payload;
    } catch (error: any) {
      console.error('ApiService.getAllCategories -> erro:', error);
      if (error?.response?.status === 403 || error?.response?.status === 401) {
        try {
          const payload = await this.tryCategoryEndpoints(this.publicApi, ['/categories/list', '/categories']);
          return payload;
        } catch (publicError) {
          console.error('ApiService.getAllCategories -> erro público:', publicError);
          throw publicError;
        }
      }
      throw error;
    }
  }

  async getCategoryById(id: number): Promise<CategoryDTO> {
    try {
      const response = await this.api.get<CategoryDTO>(`/categories/${id}`);
      return response.data;
    } catch (error) {
      console.error('ApiService.getCategoryById -> erro ao buscar categoria:', error);
      throw error;
    }
  }

  /**
   * Criar nova categoria (requer autenticação ADMIN)
   */
  async createCategory(categoryData: CreateCategoryRequest): Promise<CategoryDTO> {
    try {
      console.log('ApiService.createCategory -> criando categoria:', categoryData);
      const response = await this.api.post<CategoryDTO>('/categories', categoryData);
      console.log('ApiService.createCategory -> categoria criada:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('ApiService.createCategory -> erro ao criar categoria:', error);
      if (error?.response?.data) {
        console.error('ApiService.createCategory -> error body:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Atualizar categoria (requer autenticação ADMIN)
   */
  async updateCategory(id: number, categoryData: CreateCategoryRequest): Promise<CategoryDTO> {
    try {
      console.log('ApiService.updateCategory -> atualizando categoria:', id, categoryData);
      const response = await this.api.put<CategoryDTO>(`/categories/${id}`, categoryData);
      console.log('ApiService.updateCategory -> categoria atualizada:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('ApiService.updateCategory -> erro ao atualizar categoria:', error);
      throw error;
    }
  }

  /**
   * Deletar categoria (requer autenticação ADMIN)
   */
  async deleteCategory(id: number): Promise<void> {
    try {
      console.log('ApiService.deleteCategory -> deletando categoria:', id);
      await this.api.delete(`/categories/${id}`);
      console.log('ApiService.deleteCategory -> categoria deletada com sucesso');
    } catch (error: any) {
      console.error('ApiService.deleteCategory -> erro ao deletar categoria:', error);
      throw error;
    }
  }

  // ========================================
  // MÉTODOS - SUBCATEGORIAS
  // ========================================

  async getSubcategories(categoryId: number): Promise<SubcategoryDTO[]> {
    try {
      const response = await this.api.get<SubcategoryDTO[]>(`/categories/${categoryId}/subcategories`);
      return response.data;
    } catch (error: any) {
      console.error('ApiService.getSubcategories -> erro:', error?.response?.data ?? error?.message ?? error);
      throw error;
    }
  }

  async createSubcategory(categoryId: number, payload: SubcategoryInput): Promise<SubcategoryDTO> {
    try {
      const response = await this.api.post<SubcategoryDTO>(
        `/categories/${categoryId}/subcategories`,
        payload,
      );
      return response.data;
    } catch (error: any) {
      console.error('ApiService.createSubcategory -> erro:', error?.response?.data ?? error?.message ?? error);
      throw error;
    }
  }

  async updateSubcategory(
    categoryId: number,
    subcategoryId: number,
    payload: SubcategoryInput,
  ): Promise<SubcategoryDTO> {
    try {
      const response = await this.api.put<SubcategoryDTO>(
        `/categories/${categoryId}/subcategories/${subcategoryId}`,
        payload,
      );
      return response.data;
    } catch (error: any) {
      console.error('ApiService.updateSubcategory -> erro:', error?.response?.data ?? error?.message ?? error);
      throw error;
    }
  }

  async deleteSubcategory(categoryId: number, subcategoryId: number): Promise<void> {
    try {
      await this.api.delete(`/categories/${categoryId}/subcategories/${subcategoryId}`);
    } catch (error: any) {
      console.error('ApiService.deleteSubcategory -> erro:', error?.response?.data ?? error?.message ?? error);
      throw error;
    }
  }

  // ========================================
  // MÉTODOS - TEMAS
  // ========================================

  async getThemes(): Promise<ThemeDTO[]> {
    try {
      const response = await this.api.get<ThemeDTO[]>('/themes');
      return response.data;
    } catch (error: any) {
      console.error('ApiService.getThemes -> erro:', error?.response?.data ?? error?.message ?? error);
      throw error;
    }
  }

  async createTheme(payload: ThemeInput): Promise<ThemeDTO> {
    try {
      const response = await this.api.post<ThemeDTO>('/themes', payload);
      return response.data;
    } catch (error: any) {
      console.error('ApiService.createTheme -> erro:', error?.response?.data ?? error?.message ?? error);
      throw error;
    }
  }

  async updateTheme(id: number, payload: ThemeInput): Promise<ThemeDTO> {
    try {
      const response = await this.api.put<ThemeDTO>(`/themes/${id}`, payload);
      return response.data;
    } catch (error: any) {
      console.error('ApiService.updateTheme -> erro:', error?.response?.data ?? error?.message ?? error);
      throw error;
    }
  }

  async deleteTheme(id: number): Promise<void> {
    try {
      await this.api.delete(`/themes/${id}`);
    } catch (error: any) {
      console.error('ApiService.deleteTheme -> erro:', error?.response?.data ?? error?.message ?? error);
      throw error;
    }
  }

  // ========================================
  // MÉTODOS - ASSOCIAÇÃO SUBCATEGORIA/TEMA
  // ========================================

  async assignThemesToSubcategory(payload: SubcategoryThemeAssignRequest): Promise<void> {
    try {
      await this.api.post('/subcategory-themes', payload);
    } catch (error: any) {
      console.error('ApiService.assignThemesToSubcategory -> erro:', error?.response?.data ?? error?.message ?? error);
      throw error;
    }
  }

  async overwriteThemesForSubcategory(subcategoryId: number, themeIds: number[]): Promise<void> {
    try {
      await this.api.put(`/subcategory-themes/${subcategoryId}`, themeIds);
    } catch (error: any) {
      console.error('ApiService.overwriteThemesForSubcategory -> erro:', error?.response?.data ?? error?.message ?? error);
      throw error;
    }
  }

  async removeThemeFromSubcategory(subcategoryId: number, themeId: number): Promise<void> {
    try {
      await this.api.delete(`/subcategory-themes/${subcategoryId}/${themeId}`);
    } catch (error: any) {
      console.error('ApiService.removeThemeFromSubcategory -> erro:', error?.response?.data ?? error?.message ?? error);
      throw error;
    }
  }

  async getThemeIdsBySubcategory(subcategoryId: number): Promise<number[]> {
    try {
      const response = await this.api.get<number[]>(`/subcategory-themes/${subcategoryId}`);
      return response.data;
    } catch (error: any) {
      console.error('ApiService.getThemeIdsBySubcategory -> erro:', error?.response?.data ?? error?.message ?? error);
      throw error;
    }
  }

  // ========================================
  // MÉTODOS - PRODUTOS (PÚBLICOS)
  // ========================================

  /**
   * Buscar todos os produtos (rota pública)
   */
  async getAllProducts(): Promise<Product[]> {
    try {
      // Tentar primeiro com autenticação
      const token = await this.getToken();
      const apiToUse = token ? this.api : this.publicApi;
      console.log('ApiService.getAllProducts -> using apiToUse:', token ? 'authenticated' : 'public');
      console.log('ApiService.getAllProducts -> token exists:', !!token);

      const response = await apiToUse.get('/products');
      const list = this.normalizeProductPayload(response.data);
      return list.map((dto) => this.mapProductDTO(dto));
    } catch (error: any) {
      // Se falhar com token, tentar sem autenticação
      const status = error?.response?.status;
      console.warn('ApiService.getAllProducts -> request failed with status:', status);
      if (status === 403 || status === 401) {
        try {
          console.log('Tentando buscar produtos sem autenticação...');
          const response = await this.publicApi.get('/products');
          const list = this.normalizeProductPayload(response.data);
          return list.map((dto) => this.mapProductDTO(dto));
        } catch (publicError) {
          console.error('Erro ao buscar produtos (público):', publicError);
          throw publicError;
        }
      }

      console.error('Erro ao buscar produtos:', error);
      throw error;
    }
  }

  async getProductsPage(
    page: number,
    size: number,
    filters?: ProductPageFilters,
  ): Promise<ProductsPageResult> {
    try {
      const token = await this.getToken();
      const apiToUse = token ? this.api : this.publicApi;
      const params: Record<string, any> = { page, size };
      if (filters?.search) {
        params.search = filters.search;
      }
      if (filters?.category) {
        params.category = filters.category;
      }

      const response = await apiToUse.get('/products', { params });
      const payload = response.data ?? {};
      const list = this.normalizeProductPayload(payload).map((dto) => this.mapProductDTO(dto));
      const meta = this.extractPaginationMeta(payload);
      return {
        items: list,
        page: Number.isFinite(meta.page) ? meta.page : page,
        size: meta.size || size,
        totalPages: meta.totalPages || (list.length ? 1 : 0),
        totalItems: meta.totalItems || list.length,
      };
    } catch (error: any) {
      console.error('ApiService.getProductsPage -> erro:', error?.response?.data ?? error?.message ?? error);
      throw error;
    }
  }

  /**
   * Buscar produto por ID (rota pública)
   */
  async getProductById(id: number): Promise<Product> {
    try {
      const token = await this.getToken();
      const apiToUse = token ? this.api : this.publicApi;
      const response = await apiToUse.get<ProductDTO>(`/products/${id}`);
      return this.mapProductDTO(response.data);
    } catch (error: any) {
      if (error?.response?.status === 403 || error?.response?.status === 401) {
        try {
          const response = await this.publicApi.get<ProductDTO>(`/products/${id}`);
          return this.mapProductDTO(response.data);
        } catch (publicError) {
          console.error('Erro ao buscar produto (público):', publicError);
          throw publicError;
        }
      }

      console.error('Erro ao buscar produto:', error);
      throw error;
    }
  }

  private resolveImageUrl(imageUrl?: string | null): string | null {
    if (!imageUrl) {
      return null;
    }

    const trimmed = imageUrl.trim();
    if (trimmed.length === 0) {
      return null;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    const base = (this.api.defaults.baseURL || '').replace(/\/$/, '');
    if (trimmed.startsWith('/')) {
      return `${base}${trimmed}`;
    }

    return `${base}/${trimmed}`;
  }

  // ========================================
  // MÉTODOS - PEDIDOS (REQUEREM AUTENTICAÇÃO)
  // ========================================

  /**
   * Criar pedido (requer autenticação)
   */
  async createOrder(orderData: OrderRequestDTO): Promise<OrderResponseDTO> {
    // OBS: O endpoint /api/payments/preference do backend possui um bug onde ele cria o pedido (deduzindo estoque)
    // mas falha ao criar a preferência, retornando erro 500. Como a transação não é revertida, tentar chamar esse endpoint
    // e depois chamar o /orders no catch causa DUPLA DEDUÇÃO de estoque.
    // Por isso, vamos chamar diretamente o /orders e gerar a preferência no frontend.

    try {
        // Cria o pedido via /orders (deduz estoque apenas uma vez)
        const response = await this.api.post<OrderResponseDTO>('/orders', orderData);
        const order = response.data;

        // WORKAROUND: Gerar preferência do Mercado Pago diretamente no Frontend
        // Necessário pois o backend retorna erro 500 e não configura back_urls para Deep Linking
        try {
          console.log('Tentando gerar preferência MP via Frontend (Workaround com Deep Linking)...');
          const mpToken = "APP_USR-7329173875972159-120123-c8e1fc25840c193bbf8acf2550bbcdd4-3032944549";
          
          const itemsList = (order.items || []).map((item: any) => ({
            id: String(item.productId),
            title: item.productName || `Produto ${item.productId}`,
            quantity: Number(item.quantity),
            unit_price: Number(item.unitPrice),
            currency_id: 'BRL',
          }));

          // Configuração com Deep Linking para retorno ao app
          const successUrl = Linking.createURL('success');
          const failureUrl = Linking.createURL('failure');
          const pendingUrl = Linking.createURL('pending');

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
            console.log('Preferência MP gerada com sucesso no front:', mpResponse.data.init_point);
            return {
              ...order,
              mpInitPoint: mpResponse.data.init_point,
              initPoint: mpResponse.data.init_point,
              sandboxLink: mpResponse.data.sandbox_init_point
            };
          }
        } catch (mpError: any) {
          console.error('Erro ao gerar preferência MP no front:', mpError?.response?.data || mpError.message);
        }

        return order;
      } catch (e) {
        console.error('Erro ao criar pedido:', e);
        throw e;
      }
  }

  /**
   * Buscar detalhes do pedido (requer autenticação)
   */
  async getOrderById(id: number): Promise<any> {
    try {
      const response = await this.api.get(`/orders/${id}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar pedido:', error);
      throw error;
    }
  }

  /**
   * Buscar pedidos do usuário (requer autenticação)
   */
  async getUserOrders(userId: number): Promise<any[]> {
    try {
      const response = await this.api.get(`/orders/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar pedidos do usuário:', error);
      throw error;
    }
  }

  /**
   * Atualizar status do pedido (requer autenticação)
   */
  async updateOrderStatus(orderId: number, status: string): Promise<any> {
    try {
      const response = await this.api.put(`/orders/status/${orderId}`, { status });
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
      throw error;
    }
  }
}

// ========================================
// TIPOS E INTERFACES
// ========================================

export interface CategoryDTO {
  id: number;
  name: string;
  description?: string | null;
  slug?: string | null;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string | null;
}

export interface SubcategoryDTO {
  id: number;
  name: string;
  description?: string | null;
  slug?: string | null;
  categoryId: number;
}

export interface SubcategoryInput {
  name: string;
  description?: string | null;
  slug?: string | null;
}

export interface ThemeDTO {
  id: number;
  name: string;
  description?: string | null;
  slug?: string | null;
}

export interface ThemeInput {
  name: string;
  description?: string | null;
  slug?: string | null;
}

export interface ProductsPageResult {
  items: Product[];
  page: number;
  size: number;
  totalPages: number;
  totalItems: number;
}

export interface ProductPageFilters {
  search?: string;
  category?: string;
}

export interface SubcategoryThemeAssignRequest {
  categoryId: number;
  subcategoryId: number;
  themeIds: number[];
}

export interface ProductDTO {
  id: number;
  name: string;
  description: string;
  price: number;
  stock?: number | null;
  imageUrl?: string | null;
  imageUrls?: Array<string | null>;
  mainImageUrl?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  category?: {
    id: number;
    name: string;
  } | null;
  subcategoryId?: number | null;
  subcategoryName?: string | null;
  themeIds?: number[];
  themeNames?: string[];
}

export interface OrderItemDTO {
  productId: number;
  quantity: number;
}

export interface OrderRequestDTO {
  userId: number;
  items: OrderItemDTO[];
  deliveryType: string;
  deliveryAddress: string;
  paymentMethod: string;
}

export interface OrderResponseDTO {
  id?: number;
  mpPreferenceId?: string;
  preferenceId?: string;
  status?: string;
  orderStatus?: string;
  paymentStatus?: string;
  initPoint?: string;
  sandboxLink?: string;
  mpInitPoint?: string;
  [key: string]: any;
}

// Exportar instância única
export default new ApiService();