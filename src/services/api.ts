// src/services/api.ts

import axios, { AxiosInstance } from "axios";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types/product';

class ApiService {
  private api: AxiosInstance;
  private publicApi: AxiosInstance;
  private baseURL = 'https://benucci-artesanato.onrender.com/'
  constructor() {
    // API com autenticação (para rotas protegidas)
    const resolvedBaseURL = 'https://benucci-artesanato.onrender.com/';
    const timeoutMs = Number(3600000) || 15000;
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
      console.error('Erro ao salvar token:', error);
    }
  }

  async getToken(): Promise<string | null> {
    try {
      const t = await AsyncStorage.getItem('@auth_token');
      console.log('ApiService.getToken -> token exists:', !!t);
      return t;
    } catch (error) {
      console.error('Erro ao buscar token:', error);
      return null;
    }
  }

  async removeToken(): Promise<void> {
    try {
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
      // Tenta com token primeiro, se falhar tenta sem
      const token = await this.getToken();
      const apiToUse = token ? this.api : this.publicApi;

      const response = await apiToUse.get<CategoryDTO[]>('/categories');
      console.log('ApiService.getAllCategories -> categorias encontradas:', response.data.length);
      return response.data;
    } catch (error: any) {
      console.error('ApiService.getAllCategories -> erro:', error);
      // Se falhar com autenticação, tenta sem
      if (error?.response?.status === 403 || error?.response?.status === 401) {
        try {
          const response = await this.publicApi.get<CategoryDTO[]>('/categories');
          return response.data;
        } catch (publicError) {
          console.error('ApiService.getAllCategories -> erro público:', publicError);
          throw publicError;
        }
      }
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

      const response = await apiToUse.get<ProductDTO[]>('/products');

      // Mapear do formato do backend para o formato do frontend
      return response.data.map(dto => {
        const categoryName = dto.category?.name?.trim() || 'Sem categoria';
        return {
          id: dto.id,
          name: dto.name,
          description: dto.description,
          price: dto.price,
          category: categoryName,
          image_url: this.resolveImageUrl(dto.imageUrl ?? null),
          stock: dto.stock ?? 0,
          categoryId: dto.category?.id ?? dto.categoryId ?? null,
        };
      });
    } catch (error: any) {
      // Se falhar com token, tentar sem autenticação
      const status = error?.response?.status;
      console.warn('ApiService.getAllProducts -> request failed with status:', status);
      if (status === 403 || status === 401) {
        try {
          console.log('Tentando buscar produtos sem autenticação...');
          const response = await this.publicApi.get<ProductDTO[]>('/products');

          return response.data.map(dto => {
            const categoryName = dto.category?.name?.trim() || 'Sem categoria';
            return {
              id: dto.id,
              name: dto.name,
              description: dto.description,
              price: dto.price,
              category: categoryName,
              image_url: this.resolveImageUrl(dto.imageUrl ?? null),
              stock: dto.stock ?? 0,
              categoryId: dto.category?.id ?? dto.categoryId ?? null,
            };
          });
        } catch (publicError) {
          console.error('Erro ao buscar produtos (público):', publicError);
          throw publicError;
        }
      }

      console.error('Erro ao buscar produtos:', error);
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
      const dto = response.data;

      const categoryName = dto.category?.name?.trim() || 'Sem categoria';
      return {
        id: dto.id,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        category: categoryName,
        image_url: this.resolveImageUrl(dto.imageUrl ?? null),
        stock: dto.stock ?? 0,
        categoryId: dto.category?.id ?? dto.categoryId ?? null,
      };
    } catch (error: any) {
      if (error?.response?.status === 403 || error?.response?.status === 401) {
        try {
          const response = await this.publicApi.get<ProductDTO>(`/products/${id}`);
          const dto = response.data;

          const categoryName = dto.category?.name?.trim() || 'Sem categoria';
          return {
            id: dto.id,
            name: dto.name,
            description: dto.description,
            price: dto.price,
            category: categoryName,
            image_url: this.resolveImageUrl(dto.imageUrl ?? null),
            stock: dto.stock ?? 0,
            categoryId: dto.category?.id ?? dto.categoryId ?? null,
          };
        } catch (publicError) {
          console.error('Erro ao buscar produto (público):', publicError);
          throw publicError;
        }
      }

      console.error('Erro ao buscar produto:', error);
      throw error;
    }
  }

  /**
   * Criar produto (requer autenticação de admin)
   */
  async createProduct(productData: CreateProductRequest): Promise<ProductDTO> {
    try {
      console.log('ApiService.createProduct -> enviando dados para API:', productData);
      console.log('ApiService.createProduct -> payload JSON:', JSON.stringify(productData));

      const token = await this.getToken();
      if (token) {
        const masked = `${token.slice(0, 6)}...${token.slice(-6)}`;
        console.log('ApiService.createProduct -> token (masked):', masked);
      } else {
        console.log('ApiService.createProduct -> sem token no storage');
      }

      const response = await this.api.post<ProductDTO>('/products', productData, {
        headers: token
          ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
          : { 'Content-Type': 'application/json' },
      });
      let payload: any = response.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (parseError) {
          console.warn('ApiService.createProduct -> resposta não JSON recebida:', payload);
          payload = { message: payload };
        }
      }
      console.log('ApiService.createProduct -> produto criado com sucesso:', payload);
      return payload;
    } catch (error: any) {
      console.error('ApiService.createProduct -> erro ao criar produto:', error);
      if (error?.response?.data) {
        console.error('ApiService.createProduct -> error body:', error.response.data);
      }
      if (error?.response?.status) {
        console.error('ApiService.createProduct -> response status:', error.response.status);
      }
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

    const base = (this.baseURL || '').replace(/\/$/, '');
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
    try {
      const response = await this.api.post<OrderResponseDTO>('/orders', orderData);
      return response.data;
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      throw error;
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
}

export interface CreateCategoryRequest {
  name: string;
}

export interface ProductDTO {
  id: number;
  name: string;
  description: string;
  price: number;
  stock?: number | null;
  imageUrl?: string | null;
  categoryId?: number | null;
  category?: {
    id: number;
    name: string;
  } | null;
}

export interface CreateProductRequest {
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  category: {
    id: number;
    name: string;
  };
  categoryId?: number;
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
  id: number;
  mpPreferenceId: string;
  status: string;
  paymentStatus: string;
}

// Exportar instância única
export default new ApiService();