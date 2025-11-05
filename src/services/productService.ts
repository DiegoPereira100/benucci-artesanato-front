// src/services/productService.ts

import ApiService, { ProductDTO, CategoryDTO, CreateCategoryRequest } from './api';
import { Product } from '@/types/product';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const CATEGORY_OVERRIDES_STORAGE_KEY = '@product_category_overrides';

type CategoryOverride = {
  id: number;
  name: string;
};

const ensureProductDto = (data: any, context: string, fallback?: ProductDTO): ProductDTO => {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as ProductDTO;
  }

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as ProductDTO;
      }
      console.warn('productService -> parsed string is not an object', context, parsed);
    } catch (error) {
      console.warn('productService -> failed to parse ProductDTO string', context, error);
    }
  }

  console.warn('productService -> unexpected ProductDTO response type', context, typeof data);
  if (fallback) {
    return { ...fallback };
  }
  return {} as ProductDTO;
};

let cachedCategoryOverrides: Record<string, CategoryOverride> | null = null;

const loadCategoryOverrides = async (): Promise<Record<string, CategoryOverride>> => {
  if (cachedCategoryOverrides) {
    return { ...cachedCategoryOverrides };
  }

  try {
    const stored = await AsyncStorage.getItem(CATEGORY_OVERRIDES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        cachedCategoryOverrides = parsed as Record<string, CategoryOverride>;
        return { ...cachedCategoryOverrides };
      }
    }
  } catch (error) {
    console.warn('productService -> failed to load category overrides', error);
  }

  cachedCategoryOverrides = {};
  return {};
};

const persistCategoryOverrides = async (overrides: Record<string, CategoryOverride>): Promise<void> => {
  cachedCategoryOverrides = { ...overrides };
  try {
    await AsyncStorage.setItem(CATEGORY_OVERRIDES_STORAGE_KEY, JSON.stringify(cachedCategoryOverrides));
  } catch (error) {
    console.warn('productService -> failed to persist category overrides', error);
  }
};

const upsertCategoryOverride = async (productId: number, override: CategoryOverride): Promise<void> => {
  if (!Number.isFinite(productId) || productId <= 0) {
    return;
  }
  const overrides = await loadCategoryOverrides();
  overrides[String(productId)] = override;
  await persistCategoryOverrides(overrides);
};

const removeCategoryOverride = async (productId: number): Promise<void> => {
  const overrides = await loadCategoryOverrides();
  if (overrides[String(productId)]) {
    delete overrides[String(productId)];
    await persistCategoryOverrides(overrides);
  }
};

const syncOverrideCache = async (productId: number, override: CategoryOverride): Promise<void> => {
  if (!Number.isFinite(productId) || productId <= 0) {
    return;
  }
  const overrides = await loadCategoryOverrides();
  overrides[String(productId)] = override;
  await persistCategoryOverrides(overrides);
};

const inferCreatedProductId = async (candidate: { name: string; description: string; price: number; stock: number; }): Promise<number | null> => {
  try {
    const response = await ApiService.instance.get<ProductDTO[]>('/products');
    const items = Array.isArray(response.data) ? response.data : [];
    if (items.length === 0) {
      return null;
    }
    const sorted = [...items].sort((a, b) => {
      const idA = Number((a as any)?.id ?? 0);
      const idB = Number((b as any)?.id ?? 0);
      return idB - idA;
    });

    const directMatch = sorted.find((dto) => {
      const dtoName = dto?.name?.trim?.() ?? '';
      const dtoDescription = dto?.description?.trim?.() ?? '';
      const dtoPrice = Number(dto?.price ?? 0);
      return dtoName === candidate.name.trim()
        && dtoDescription === candidate.description.trim()
        && dtoPrice === Number(candidate.price);
    });

    if (directMatch && Number((directMatch as any)?.id) > 0) {
      return Number((directMatch as any)?.id);
    }

    const fallback = sorted[0];
    if (fallback && Number((fallback as any)?.id) > 0) {
      return Number((fallback as any)?.id);
    }
  } catch (error) {
    console.warn('productService -> unable to infer created product id', error);
  }
  return null;
};

const applyOverrideToProduct = (product: Product, override?: CategoryOverride): Product => {
  if (!override) {
    return product;
  }

  const normalizedCategory = product.category?.trim() || '';
  const shouldReplaceCategory = normalizedCategory.length === 0 || normalizedCategory.toLowerCase() === 'sem categoria';
  let changed = false;
  const patched: Product = { ...product };

  if (shouldReplaceCategory) {
    patched.category = override.name;
    changed = true;
  }

  if (patched.categoryId == null || Number.isNaN(patched.categoryId)) {
    patched.categoryId = override.id;
    changed = true;
  }

  return changed ? patched : product;
};

const applyOverrideToDto = (dto: ProductDTO, override?: CategoryOverride): ProductDTO => {
  if (!override) {
    return dto;
  }

  const patched: ProductDTO = { ...dto };

  if (patched.categoryId == null) {
    patched.categoryId = override.id;
  }

  if (!patched.category) {
    patched.category = { id: override.id, name: override.name };
  } else {
    const categoryCopy = { ...patched.category };
    if (categoryCopy.id == null) {
      categoryCopy.id = override.id;
    }
    if (!categoryCopy.name || categoryCopy.name.trim().length === 0) {
      categoryCopy.name = override.name;
    }
    patched.category = categoryCopy;
  }

  return patched;
};

export const productService = {
  /**
   * Buscar todos os produtos
   */
  getAllProducts: async (): Promise<Product[]> => {
    try {
      console.log('productService.getAllProducts -> calling ApiService.getAllProducts');
      const res = await ApiService.getAllProducts();
      const overrides = await loadCategoryOverrides();
      const merged = res.map((product) => {
        const override = overrides[String(product.id)];
        const patched = applyOverrideToProduct(product, override);
        if (patched !== product && override) {
          console.log('productService.getAllProducts -> applied category override for product', product.id);
        }
        return patched;
      });
      console.log('productService.getAllProducts -> received', merged.length, 'products');
      return merged;
    } catch (error: any) {
      console.error('productService.getAllProducts -> error:', error?.response?.data ?? error?.message ?? String(error));
      throw error;
    }
  },

  /** 
   * Buscar produto por ID
   */
  getProductById: async (id: number): Promise<Product> => {
    const product = await ApiService.getProductById(id);
    const overrides = await loadCategoryOverrides();
    return applyOverrideToProduct(product, overrides[String(id)]);
  },

  /**
   * Buscar ProductDTO cru (inclui category.id) - para edição
   */
  getProductDTO: async (id: number): Promise<ProductDTO> => {
    try {
      const response = await ApiService.instance.get<ProductDTO>(`/products/${id}`);
      const dto = ensureProductDto(response.data, 'getProductDTO');
      const overrides = await loadCategoryOverrides();
      return applyOverrideToDto(dto, overrides[String(id)]);
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

      const categoryId = Number(formData.categoryId);
      if (!Number.isFinite(categoryId) || !Number.isInteger(categoryId) || categoryId <= 0) {
        const debugValue = formData.categoryId;
        console.error('productService.createProduct -> categoria inválida recebida:', debugValue);
        throw new Error('Selecione uma categoria válida antes de salvar o produto.');
      }

      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        stock: Number(formData.stock),
        imageUrl: formData.imageFile ? null : (formData.imageUrl ?? '').trim(),
        category: {
          id: categoryId,
          name: formData.categoryName.trim(),
        },
        categoryId,
      };

      console.log('productService.createProduct -> dados formatados para API:', productData);

      const selectedCategory: CategoryOverride = {
        id: productData.category.id,
        name: productData.category.name,
      };

      if (formData.imageFile) {
        const multipartData = new FormData();
        multipartData.append('product', JSON.stringify(productData));
        multipartData.append('categoryId', String(categoryId));
        if ('file' in formData.imageFile) {
          multipartData.append('imageFile', formData.imageFile.file, formData.imageFile.name);
          multipartData.append('image', formData.imageFile.file, formData.imageFile.name);
        } else {
          const fileDescriptor = {
            uri: formData.imageFile.uri,
            name: formData.imageFile.name,
            type: formData.imageFile.type,
          } as any;
          multipartData.append('imageFile', fileDescriptor);
          multipartData.append('image', { ...fileDescriptor });
        }

        const response = await ApiService.instance.post<ProductDTO>('/products', multipartData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        const fallbackDto: ProductDTO = {
          id: NaN,
          name: productData.name,
          description: productData.description,
          price: productData.price,
          stock: productData.stock,
          imageUrl: null,
          categoryId: productData.categoryId,
          category: { id: productData.category.id, name: productData.category.name },
        };

        const responseDto = ensureProductDto(response.data, 'createProduct(multipart)', fallbackDto);
        const normalized = applyOverrideToDto(responseDto, selectedCategory);

        let normalizedUploadId = Number((normalized as any)?.id);
        if (!Number.isFinite(normalizedUploadId) || normalizedUploadId <= 0) {
          const inferredId = await inferCreatedProductId(productData);
          if (Number.isFinite(inferredId) && inferredId && inferredId > 0) {
            normalizedUploadId = inferredId;
            (normalized as any).id = inferredId;
          }
        }

        if (Number.isFinite(normalizedUploadId) && normalizedUploadId > 0) {
          await upsertCategoryOverride(normalizedUploadId, selectedCategory);
          await syncOverrideCache(normalizedUploadId, selectedCategory);
        } else {
          console.warn('productService.createProduct -> produto criado via upload sem id válido, override não persistido');
        }

        console.log('productService.createProduct -> produto criado via upload!', normalized);
        return normalized;
      }

      const createdProduct = await ApiService.createProduct(productData);
      const fallbackDto: ProductDTO = {
        id: NaN,
        name: productData.name,
        description: productData.description,
        price: productData.price,
        stock: productData.stock,
        imageUrl: productData.imageUrl,
        categoryId: productData.categoryId,
        category: { id: productData.category.id, name: productData.category.name },
      };

      const createdProductDto = ensureProductDto(createdProduct, 'createProduct(json)', fallbackDto);
      const normalizedProduct = applyOverrideToDto(createdProductDto, selectedCategory);

      let normalizedProductId = Number((normalizedProduct as any)?.id);
      if (!Number.isFinite(normalizedProductId) || normalizedProductId <= 0) {
        const inferredId = await inferCreatedProductId(productData);
        if (Number.isFinite(inferredId) && inferredId && inferredId > 0) {
          normalizedProductId = inferredId;
          (normalizedProduct as any).id = inferredId;
        }
      }

      if (Number.isFinite(normalizedProductId) && normalizedProductId > 0) {
        await upsertCategoryOverride(normalizedProductId, selectedCategory);
        await syncOverrideCache(normalizedProductId, selectedCategory);
      } else {
        console.warn('productService.createProduct -> produto criado (json) sem id válido, override não persistido');
      }

      console.log('productService.createProduct -> produto criado com sucesso!', normalizedProduct);

      return normalizedProduct;
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

  applyCategoryOverride: async (productId: number, categoryId: number, categoryName: string): Promise<void> => {
    if (!Number.isFinite(productId) || productId <= 0) {
      return;
    }
    const override: CategoryOverride = {
      id: Number(categoryId),
      name: categoryName,
    };
    await syncOverrideCache(productId, override);
  },
  /**
   * Atualizar produto (requer autenticação ADMIN)
   */
  updateProduct: async (id: number, productData: any): Promise<any> => {
    try {
      console.log('productService.updateProduct -> updating', id, productData);
  const response = await ApiService.instance.put<ProductDTO>(`/products/${id}`, productData);
  const dto = ensureProductDto(response.data, 'updateProduct');
  const overrides = await loadCategoryOverrides();
  let normalized = applyOverrideToDto(dto, overrides[String(id)]);

      const candidateId = Number(productData?.categoryId ?? productData?.category?.id);
      const candidateName: string | undefined = productData?.category?.name;
      if (Number.isFinite(candidateId) && candidateId > 0 && typeof candidateName === 'string' && candidateName.trim().length > 0) {
        const override: CategoryOverride = { id: candidateId, name: candidateName.trim() };
        normalized = applyOverrideToDto(normalized, override);
        await upsertCategoryOverride(id, override);
      }

      return normalized;
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
      await removeCategoryOverride(id);
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