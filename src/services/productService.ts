// src/services/productService.ts

import ApiService, { ProductDTO, CategoryDTO, CreateCategoryRequest } from './api';
import { Product } from '@/types/product';

export interface CreateProductFormData {
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string;
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
   * Criar produto (requer autenticação de admin)
   */
  createProduct: async (formData: CreateProductFormData): Promise<ProductDTO> => {
    try {
      console.log('productService.createProduct -> iniciando criação de produto...', formData);

      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        stock: Number(formData.stock),
        imageUrl: formData.imageUrl.trim(),
        category: {
          id: Number(formData.categoryId),
          name: formData.categoryName.trim(),
        },
        categoryId: Number(formData.categoryId),
      };

      console.log('productService.createProduct -> dados formatados para API:', productData);

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