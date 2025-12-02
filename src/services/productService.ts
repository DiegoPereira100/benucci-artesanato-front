// src/services/productService.ts

import ApiService, { ProductDTO, ProductPageFilters, ProductsPageResult } from './api';
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
  categoryId: number;
  categoryName: string;
  subcategoryId: number;
  themeIds: number[];
  images: ProductImageFile[];
}

export interface ProductPageResult extends ProductsPageResult {}

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

  if (!patched.categoryName || patched.categoryName.trim().length === 0) {
    patched.categoryName = override.name;
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

  getProductsPage: async (
    page: number,
    size: number,
    filters?: ProductPageFilters,
  ): Promise<ProductPageResult> => {
    const response = await ApiService.getProductsPage(page, size, filters);
    const overrides = await loadCategoryOverrides();
    const items = response.items.map((product) =>
      applyOverrideToProduct(product, overrides[String(product.id)]),
    );
    return { ...response, items };
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
      const subcategoryId = Number(formData.subcategoryId);
      if (!Number.isFinite(categoryId) || categoryId <= 0) {
        throw new Error('Selecione uma categoria válida antes de salvar o produto.');
      }
      if (!Number.isFinite(subcategoryId) || subcategoryId <= 0) {
        throw new Error('Selecione uma subcategoria válida antes de salvar o produto.');
      }

      const normalizedThemeIds = Array.from(
        new Set((formData.themeIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)),
      );

      if (!Array.isArray(formData.images) || formData.images.length === 0) {
        throw new Error('Selecione ao menos uma imagem do produto antes de salvar.');
      }

      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        stock: Number(formData.stock),
        categoryId,
        categoryName: formData.categoryName.trim(),
        subcategoryId,
        themeIds: normalizedThemeIds,
      };

      console.log('productService.createProduct -> payload normalizado:', productData);

      const multipartData = new FormData();
      multipartData.append('product', JSON.stringify(productData));
      formData.images.forEach((file) => {
        if ('file' in file) {
          multipartData.append('images', file.file, file.name);
        } else {
          multipartData.append('images', {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        }
      });

      const token = await ApiService.getToken();
      const baseURL = ApiService.instance.defaults.baseURL;

      const response = await fetch(`${baseURL}/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: multipartData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Erro ${response.status}`;
        try {
           const errorJson = JSON.parse(errorText);
           errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      let responseData: any = {};
      try {
          if (responseText && responseText.trim().length > 0) {
              responseData = JSON.parse(responseText);
          }
      } catch (e) {
          console.log('productService.createProduct -> response was not JSON, using fallback. Response:', responseText);
      }

      const fallbackDto: ProductDTO = {
        id: NaN,
        name: productData.name,
        description: productData.description,
        price: productData.price,
        stock: productData.stock,
        imageUrls: [],
        categoryId: productData.categoryId,
        categoryName: productData.categoryName,
        subcategoryId: productData.subcategoryId,
        themeIds: productData.themeIds,
      };

      const selectedCategory: CategoryOverride = {
        id: productData.categoryId,
        name: productData.categoryName,
      };

      const responseDto = ensureProductDto(responseData, 'createProduct(multipart)', fallbackDto);
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
        console.warn('productService.createProduct -> produto criado sem id válido, override não persistido');
      }

      console.log('productService.createProduct -> produto criado com sucesso!', normalized);
      return normalized;
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

      // Backend expects multipart/form-data with individual RequestParams
      const formData = new FormData();
      
      if (productData.name) formData.append('name', productData.name);
      if (productData.description) formData.append('description', productData.description);
      if (productData.price !== undefined) formData.append('price', String(productData.price));
      if (productData.stock !== undefined) formData.append('stock', String(productData.stock));
      
      // Handle category/subcategory logic if needed, though backend asks for subcategoryId directly
      // If the UI passes categoryId, we might need to map it or ignore if backend only takes subcategoryId
      // Looking at backend: @RequestParam(required = false) Long subcategoryId
      // It doesn't seem to take categoryId directly for update? 
      // But let's send what we have.
      if (productData.subcategoryId) formData.append('subcategoryId', String(productData.subcategoryId));
      
      // Theme IDs
      if (Array.isArray(productData.themeIds)) {
          // Spring Boot often expects multiple params with same name for lists, or comma separated
          // Let's try appending multiple times
          productData.themeIds.forEach((tid: number) => formData.append('themeIds', String(tid)));
      }

      // Images (if any)
      if (Array.isArray(productData.images)) {
        productData.images.forEach((file: any) => {
            if ('file' in file) {
                formData.append('images', file.file, file.name);
            } else if (file.uri) {
                formData.append('images', {
                    uri: file.uri,
                    name: file.name || 'image.jpg',
                    type: file.type || 'image/jpeg',
                } as any);
            }
        });
      }

      const token = await ApiService.getToken();
      const baseURL = ApiService.instance.defaults.baseURL;

      const response = await fetch(`${baseURL}/products/${id}`, {
          method: 'PUT',
          headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
          },
          body: formData,
      });

      if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `Erro ${response.status}`;
          try {
             const errorJson = JSON.parse(errorText);
             errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch (e) {}
          throw new Error(errorMessage);
      }

      const responseData = await response.json();

      const dto = ensureProductDto(responseData, 'updateProduct');
      const overrides = await loadCategoryOverrides();
      let normalized = applyOverrideToDto(dto, overrides[String(id)]);

      // Update local override cache if category changed
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
      // console.error('productService.deleteProduct -> error', error?.response ?? error);
      if (error?.response?.data) {
        // console.error('productService.deleteProduct -> response body:', error.response.data);
        const backendMessage = error.response.data.message || error.response.data.error;
        
        if (typeof backendMessage === 'string' && backendMessage.includes('violates foreign key constraint')) {
           throw new Error('Não é possível excluir este produto pois ele já foi comprado em pedidos anteriores.');
        }
        
        if (backendMessage) {
            throw new Error(backendMessage);
        }
      }
      throw error;
    }
  },
};

export { categoryService } from './categoryService';
export type { ProductPageFilters };