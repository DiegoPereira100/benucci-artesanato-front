import ApiService, {
  CategoryDTO,
  CreateCategoryRequest,
  SubcategoryDTO,
  SubcategoryInput,
  ThemeDTO,
  ThemeInput,
  SubcategoryThemeAssignRequest,
} from './api';

export type CategoryFormPayload = {
  name: string;
  description?: string | null;
};

export type SubcategoryFormPayload = {
  name: string;
  description?: string | null;
};

export type ThemeFormPayload = {
  name: string;
  description?: string | null;
};

const normalizeString = (value?: string | null): string => (value ?? '').trim();

const buildCategoryRequest = (payload: CategoryFormPayload): CreateCategoryRequest => ({
  name: normalizeString(payload.name),
  description: normalizeString(payload.description) || null,
});

const buildSubcategoryRequest = (payload: SubcategoryFormPayload): SubcategoryInput => ({
  name: normalizeString(payload.name),
  description: normalizeString(payload.description) || null,
});

const buildThemeRequest = (payload: ThemeFormPayload): ThemeInput => ({
  name: normalizeString(payload.name),
  description: normalizeString(payload.description) || null,
});

const buildAssignmentPayload = (
  categoryId: number,
  subcategoryId: number,
  themeIds: number[],
): SubcategoryThemeAssignRequest => ({
  categoryId,
  subcategoryId,
  themeIds,
});

export const categoryService = {
  async getAllCategories(): Promise<CategoryDTO[]> {
    return ApiService.getAllCategories();
  },

  async getCategoryById(id: number): Promise<CategoryDTO> {
    return ApiService.getCategoryById(id);
  },

  async createCategory(payload: CategoryFormPayload): Promise<CategoryDTO> {
    return ApiService.createCategory(buildCategoryRequest(payload));
  },

  async updateCategory(id: number, payload: CategoryFormPayload): Promise<CategoryDTO> {
    return ApiService.updateCategory(id, buildCategoryRequest(payload));
  },

  async deleteCategory(id: number): Promise<void> {
    return ApiService.deleteCategory(id);
  },

  async getSubcategories(categoryId: number): Promise<SubcategoryDTO[]> {
    return ApiService.getSubcategories(categoryId);
  },

  async createSubcategory(categoryId: number, payload: SubcategoryFormPayload): Promise<SubcategoryDTO> {
    return ApiService.createSubcategory(categoryId, buildSubcategoryRequest(payload));
  },

  async updateSubcategory(
    categoryId: number,
    subcategoryId: number,
    payload: SubcategoryFormPayload,
  ): Promise<SubcategoryDTO> {
    return ApiService.updateSubcategory(categoryId, subcategoryId, buildSubcategoryRequest(payload));
  },

  async deleteSubcategory(categoryId: number, subcategoryId: number): Promise<void> {
    return ApiService.deleteSubcategory(categoryId, subcategoryId);
  },

  async getThemes(): Promise<ThemeDTO[]> {
    return ApiService.getThemes();
  },

  async createTheme(payload: ThemeFormPayload): Promise<ThemeDTO> {
    return ApiService.createTheme(buildThemeRequest(payload));
  },

  async updateTheme(id: number, payload: ThemeFormPayload): Promise<ThemeDTO> {
    return ApiService.updateTheme(id, buildThemeRequest(payload));
  },

  async deleteTheme(id: number): Promise<void> {
    return ApiService.deleteTheme(id);
  },

  async getThemeIdsBySubcategory(subcategoryId: number): Promise<number[]> {
    return ApiService.getThemeIdsBySubcategory(subcategoryId);
  },

  async assignThemesToSubcategory(
    categoryId: number,
    subcategoryId: number,
    themeIds: number[],
  ): Promise<void> {
    const normalizedIds = Array.from(
      new Set((themeIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)),
    );

    const payload = buildAssignmentPayload(categoryId, subcategoryId, normalizedIds);

    if (normalizedIds.length === 0) {
      return ApiService.overwriteThemesForSubcategory(subcategoryId, []);
    }

    return ApiService.assignThemesToSubcategory(payload);
  },

  async overwriteThemes(subcategoryId: number, themeIds: number[]): Promise<void> {
    const normalizedIds = Array.from(
      new Set((themeIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)),
    );
    return ApiService.overwriteThemesForSubcategory(subcategoryId, normalizedIds);
  },

  async removeThemeFromSubcategory(subcategoryId: number, themeId: number): Promise<void> {
    return ApiService.removeThemeFromSubcategory(subcategoryId, themeId);
  },
};

export type { CategoryDTO, SubcategoryDTO, ThemeDTO };
