// src/services/productService.ts

import ApiService, { ProductDTO, CategoryDTO, CreateCategoryRequest } from './api';
import { Product } from '@/types/product';

export type ProductImageFile =
  | { uri: string; name: string; type: string }
  | { file: File; name: string; type: string };

export interface CreateProductPayload {
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  imageFile?: ProductImageFile | null;
  categoryName: string;
  categoryId: number;
}

export const productService = {
  /**
   * Buscar todos os produtos
   */
  getAllProducts: async (): Promise<Product[]> => {
    try {
      console.log('productService.getAllProducts -> calling ApiService.getAllProducts');
      const res = await ApiService.getAllProducts();
      console.log('productService.getAllProducts -> received', res.length, 'products');
      return res;
    } catch (error: any) {
      console.error('productService.getAllProducts -> error:', error?.response?.data ?? error?.message ?? String(error));
      throw error;
    }
  },

  /** 
   * Buscar produto por ID
   */
  getProductById: async (id: number): Promise<Product> => {
    return await ApiService.getProductById(id);
  },

  /**
   * Buscar ProductDTO cru (inclui category.id) - para edição
   */
  getProductDTO: async (id: number): Promise<ProductDTO> => {
    try {
      const response = await ApiService.instance.get<ProductDTO>(`/products/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('productService.getProductDTO -> error', error?.response ?? error);
      throw error;
    }
  },

  /**
   * Criar produto (requer autenticação de admin)
   */
  createProduct: async (formData: CreateProductPayload): Promise<ProductDTO> => {
    try {
      console.log('productService.createProduct -> iniciando criação de produto...', formData);

      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        stock: Number(formData.stock),
        imageUrl: formData.imageFile ? null : (formData.imageUrl ?? '').trim(),
        category: {
          id: Number(formData.categoryId),
          name: formData.categoryName.trim(),
        },
        categoryId: Number(formData.categoryId),
      };

      console.log('productService.createProduct -> dados formatados para API:', productData);

      if (formData.imageFile) {
        const multipartData = new FormData();
        multipartData.append('product', JSON.stringify(productData));
        if ('file' in formData.imageFile) {
          multipartData.append('imageFile', formData.imageFile.file, formData.imageFile.name);
        } else {
          multipartData.append('imageFile', {
            uri: formData.imageFile.uri,
            name: formData.imageFile.name,
            type: formData.imageFile.type,
          } as any);
        }

        const response = await ApiService.instance.post<ProductDTO>('/products', multipartData);

        console.log('productService.createProduct -> produto criado via upload!', response.data);
        return response.data as ProductDTO;
      }

      const createdProduct = await ApiService.createProduct(productData);

      console.log('productService.createProduct -> produto criado com sucesso!', createdProduct);
      return createdProduct;
    } catch (error: any) {
      console.error('productService.createProduct -> erro ao criar produto:', error);
      
      if (error.response) {
        console.error('productService.createProduct -> resposta de erro da API:', error.response.data);
        const errorMessage = error.response.data?.message || error.response.data?.error || 'Erro ao criar produto no servidor';
        const err: any = new Error(errorMessage);
        err.status = error.response.status;
        throw err;
      } else if (error.request) {
        console.error('productService.createProduct -> nenhuma resposta recebida:', error.request);
        const err: any = new Error('Sem resposta do servidor. Verifique sua conexão.');
        err.status = null;
        throw err;
      } else {
        console.error('productService.createProduct -> erro ao configurar requisição:', error.message);
        const err: any = new Error('Erro ao processar requisição: ' + error.message);
        err.status = null;
        throw err;
      }
    }
  },
  /**
   * Atualizar produto (requer autenticação ADMIN)
   */
  updateProduct: async (id: number, productData: any): Promise<any> => {
    try {
      console.log('productService.updateProduct -> updating', id, productData);
      const response = await ApiService.instance.put(`/products/${id}`, productData);
      return response.data;
    } catch (error: any) {
      console.error('productService.updateProduct -> error', error?.response ?? error);
      throw error;
    }
  },

  /**
   * Deletar produto (requer autenticação ADMIN)
   */
  deleteProduct: async (id: number): Promise<void> => {
    try {
      console.log('productService.deleteProduct -> deleting', id);
      // log full endpoint for debugging
      const url = `/products/${id}`;
      console.log('productService.deleteProduct -> calling DELETE', url);
      try {
        // attempt to read the Authorization header that will be sent (masked)
        const header = (ApiService.instance.defaults.headers as any)?.Authorization || (ApiService.instance.defaults.headers?.common as any)?.Authorization;
        if (header) {
          const hStr = String(header);
          console.log('productService.deleteProduct -> Authorization header (masked):', hStr.slice(0, 12) + '...');
        } else {
          console.log('productService.deleteProduct -> Authorization header not set on axios defaults');
        }
      } catch (hErr) {
        console.warn('productService.deleteProduct -> could not read Authorization header', hErr);
      }

      const resp = await ApiService.instance.delete(url);
      console.log('productService.deleteProduct -> delete response status:', resp?.status);
    } catch (error: any) {
      console.error('productService.deleteProduct -> error', error?.response ?? error);
      if (error?.response) {
        console.error('productService.deleteProduct -> response body:', error.response.data);
      }
      throw error;
    }
  },
};

export const categoryService = {
  /**
   * Buscar todas as categorias
   */
  getAllCategories: async (): Promise<CategoryDTO[]> => {
    try {
      console.log('categoryService.getAllCategories -> buscando categorias...');
      const categories = await ApiService.getAllCategories();
      console.log('categoryService.getAllCategories -> categorias encontradas:', categories.length);
      return categories;
    } catch (error: any) {
      console.error('categoryService.getAllCategories -> erro:', error?.response?.data ?? error?.message ?? String(error));
      throw error;
    }
  },

  /**
   * Criar nova categoria (requer autenticação ADMIN)
   */
  createCategory: async (name: string): Promise<CategoryDTO> => {
    try {
      console.log('categoryService.createCategory -> criando categoria:', name);
      const categoryData: CreateCategoryRequest = { name: name.trim() };
      const createdCategory = await ApiService.createCategory(categoryData);
      console.log('categoryService.createCategory -> categoria criada:', createdCategory);
      return createdCategory;
    } catch (error: any) {
      console.error('categoryService.createCategory -> erro:', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.message || error.response.data?.error || 'Erro ao criar categoria no servidor';
        const err: any = new Error(errorMessage);
        err.status = error.response.status;
        throw err;
      } else if (error.request) {
        const err: any = new Error('Sem resposta do servidor. Verifique sua conexão.');
        err.status = null;
        throw err;
      } else {
        const err: any = new Error('Erro ao processar requisição: ' + error.message);
        err.status = null;
        throw err;
      }
    }
  },
};