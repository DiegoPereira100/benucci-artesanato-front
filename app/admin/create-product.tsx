import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import toast from '../../src/utils/toast';
import { useAuth } from '@/hooks/useAuth';
import { productService, categoryService, CreateProductPayload, ProductImageFile } from '@/services/productService';
import { Input } from '@/components/ui/Input';
import { CategoryDTO, SubcategoryDTO, ThemeDTO } from '@/services/categoryService';

const palette = {
  background: '#F8FAFC', // Slate 50
  surface: '#FFFFFF',
  border: '#E2E8F0', // Slate 200
  primary: '#00BCD4', // Cyan 500
  primaryDark: '#0891B2', // Cyan 600
  accent: '#00BCD4',
  text: '#0F172A', // Slate 900
  softText: '#64748B', // Slate 500
  muted: '#94A3B8', // Slate 400
  danger: '#EF4444', // Red 500
  success: '#10B981', // Emerald 500
};

const MAX_IMAGES = 6;

const numberString = z
  .string()
  .trim()
  .refine((val) => val.length > 0 && !Number.isNaN(Number(val)), 'Informe um número válido');

const integerString = z
  .string()
  .trim()
  .refine((val) => val.length > 0 && Number.isInteger(Number(val)), 'Informe um número inteiro');

const createProductSchema = z.object({
  name: z
    .string()
    .min(3, 'O nome precisa ter ao menos 3 caracteres')
    .max(120, 'O nome pode ter no máximo 120 caracteres'),
  description: z
    .string()
    .min(10, 'A descrição precisa ter ao menos 10 caracteres')
    .max(1000, 'Use no máximo 1000 caracteres na descrição'),
  price: numberString.refine((value) => Number(value) > 0, 'O preço deve ser maior que zero'),
  stock: integerString.refine((value) => Number(value) >= 0, 'O estoque não pode ser negativo'),
});

type CreateProductFormData = z.infer<typeof createProductSchema>;

type ClassificationErrors = {
  category?: string;
  subcategory?: string;
  themes?: string;
  images?: string;
};

type LocalImageAsset = {
  assetId?: string | null;
  uri: string;
  width?: number;
  height?: number;
  type?: string;
  mimeType?: string;
  fileName?: string | null;
  file?: File;
  resolvedFileName?: string;
};

const sortByName = <T extends { name?: string | null }>(a: T, b: T) =>
  (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR', { sensitivity: 'base' });

export default function CreateProductScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [themes, setThemes] = useState<ThemeDTO[]>([]);
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<Record<number, SubcategoryDTO[]>>({});
  const [subcategoriesLoading, setSubcategoriesLoading] = useState<Record<number, boolean>>({});

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | null>(null);
  const [allowedThemeIds, setAllowedThemeIds] = useState<number[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<number[]>([]);

  const [selectedImages, setSelectedImages] = useState<LocalImageAsset[]>([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [allowedThemesLoading, setAllowedThemesLoading] = useState(false);
  const [classificationErrors, setClassificationErrors] = useState<ClassificationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProductFormData>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { name: '', description: '', price: '', stock: '' },
  });

  const availableThemes = useMemo(() => {
    if (!allowedThemeIds.length) {
      return [];
    }
    return themes.filter((theme) => allowedThemeIds.includes(theme.id));
  }, [allowedThemeIds, themes]);

  useEffect(() => {
    if (!user || user.type !== 'ADMIN') {
      return;
    }
    const bootstrap = async () => {
      try {
        const [fetchedCategories, fetchedThemes] = await Promise.all([
          categoryService.getAllCategories(),
          categoryService.getThemes(),
        ]);
        const sortedCategories = [...fetchedCategories].sort(sortByName);
        setCategories(sortedCategories);
        setThemes(fetchedThemes.sort(sortByName));
        if (sortedCategories.length) {
          handleCategorySelect(sortedCategories[0].id);
        }
      } catch (error: any) {
        console.error('createProduct -> bootstrap error', error);
        toast.showError('Erro', error?.message || 'Não foi possível carregar as categorias.');
      } finally {
        setInitialLoading(false);
      }
    };
    bootstrap();
  }, [user]);

  useEffect(() => {
    if (!selectedSubcategoryId) {
      setAllowedThemeIds([]);
      setSelectedThemes([]);
      return;
    }
    let isMounted = true;
    const fetchAllowedThemes = async () => {
      try {
        setAllowedThemesLoading(true);
        const ids = await categoryService.getThemeIdsBySubcategory(selectedSubcategoryId);
        if (!isMounted) {
          return;
        }
        const sanitized = Array.from(new Set((ids || []).filter((id) => Number.isFinite(id) && id > 0)));
        setAllowedThemeIds(sanitized);
        setSelectedThemes((prev) => {
          const filtered = prev.filter((id) => sanitized.includes(id));
          if (filtered.length === 0 && sanitized.length > 0) {
            return sanitized;
          }
          return filtered;
        });
        setClassificationErrors((prev) => ({ ...prev, themes: undefined }));
      } catch (error: any) {
        console.error('createProduct -> load allowed themes error', error);
        if (isMounted) {
          setAllowedThemeIds([]);
          setSelectedThemes([]);
          toast.showError('Erro', 'Não foi possível carregar os temas desta subcategoria.');
        }
      } finally {
        if (isMounted) {
          setAllowedThemesLoading(false);
        }
      }
    };
    fetchAllowedThemes();
    return () => {
      isMounted = false;
    };
  }, [selectedSubcategoryId]);

  const ensureSubcategories = useCallback(
    async (categoryId: number, force = false) => {
      if (!categoryId) {
        return [];
      }
      if (!force && subcategoriesByCategory[categoryId]) {
        return subcategoriesByCategory[categoryId];
      }
      setSubcategoriesLoading((prev) => ({ ...prev, [categoryId]: true }));
      try {
        const list = await categoryService.getSubcategories(categoryId);
        const sorted = [...list].sort(sortByName);
        setSubcategoriesByCategory((prev) => ({ ...prev, [categoryId]: sorted }));
        return sorted;
      } catch (error: any) {
        console.error('createProduct -> load subcategories error', error);
        toast.showError('Erro', 'Não foi possível carregar as subcategorias.');
        return [];
      } finally {
        setSubcategoriesLoading((prev) => ({ ...prev, [categoryId]: false }));
      }
    },
    [subcategoriesByCategory],
  );

  const handleCategorySelect = useCallback(
    async (categoryId: number) => {
      setSelectedCategoryId(categoryId);
      setClassificationErrors((prev) => ({ ...prev, category: undefined }));
      const list = await ensureSubcategories(categoryId);
      if (list.length) {
        const first = list[0].id;
        setSelectedSubcategoryId(first);
        setClassificationErrors((prev) => ({ ...prev, subcategory: undefined }));
      } else {
        setSelectedSubcategoryId(null);
        setAllowedThemeIds([]);
        setSelectedThemes([]);
      }
    },
    [ensureSubcategories],
  );

  const handleSubcategorySelect = (subcategoryId: number) => {
    setSelectedSubcategoryId(subcategoryId);
    setClassificationErrors((prev) => ({ ...prev, subcategory: undefined }));
  };

  const ensureMediaLibraryPermission = async () => {
    try {
      const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (existing.granted || existing.status === 'granted' || existing.status === 'limited') {
        return true;
      }
      if (!existing.canAskAgain) {
        return false;
      }
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return permission.granted || permission.status === 'granted' || permission.status === 'limited';
    } catch (error) {
      console.error('createProduct -> permission error', error);
      toast.showError('Permissão necessária', 'Autorize o acesso à galeria para selecionar imagens.');
      return false;
    }
  };

  const resolveAssetFileName = (asset: LocalImageAsset): string => {
    if (asset.resolvedFileName && asset.resolvedFileName.trim().length > 0) {
      return asset.resolvedFileName;
    }
    if (asset.fileName && asset.fileName.trim().length > 0) {
      asset.resolvedFileName = asset.fileName.trim();
      return asset.resolvedFileName;
    }
    const uriSegments = asset.uri?.split('/') ?? [];
    const lastSegment = uriSegments[uriSegments.length - 1] || '';
    if (lastSegment.includes('.')) {
      asset.resolvedFileName = lastSegment;
      return lastSegment;
    }
    const extension = (asset.mimeType || asset.type || 'image/jpeg').split('/').pop() || 'jpg';
    const generatedName = `produto-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    asset.resolvedFileName = generatedName;
    return generatedName;
  };

  const buildImageFilePayload = async (asset: LocalImageAsset): Promise<ProductImageFile | null> => {
    const fileName = resolveAssetFileName(asset);
    const contentType = asset.mimeType || asset.type || 'image/jpeg';

    if (Platform.OS === 'web') {
      try {
        if (asset.file instanceof File) {
          return {
            file: new File([asset.file], fileName, { type: contentType }),
            name: fileName,
            type: contentType,
          };
        }
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const webFile = new File([blob], fileName, { type: contentType });
        return {
          file: webFile,
          name: fileName,
          type: contentType,
        };
      } catch (error) {
        console.error('createProduct -> build image payload (web) error', error);
        toast.showError('Erro', 'Não foi possível processar uma das imagens selecionadas.');
        return null;
      }
    }

    return {
      uri: asset.uri,
      name: fileName,
      type: contentType,
    };
  };

  const handlePickImages = async () => {
    if (isSubmitting) {
      return;
    }
    const hasPermission = await ensureMediaLibraryPermission();
    if (!hasPermission) {
      toast.showError('Permissão necessária', 'Autorize o acesso às suas fotos para selecionar imagens.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES,
        quality: 0.9,
      });
      if (!result || result.canceled || !result.assets?.length) {
        return;
      }
      setSelectedImages((prev) => {
        const merged = [...prev];
        result.assets.forEach((asset: LocalImageAsset) => {
          const normalized = { ...asset, resolvedFileName: resolveAssetFileName(asset as LocalImageAsset) };
          if (!merged.some((item) => item.assetId && normalized.assetId && item.assetId === normalized.assetId)) {
            merged.push(normalized);
          } else if (!merged.some((item) => item.uri === normalized.uri)) {
            merged.push(normalized);
          }
        });
        const trimmed = merged.slice(0, MAX_IMAGES);
        setClassificationErrors((prevErrors) => ({ ...prevErrors, images: undefined }));
        if (trimmed.length > MAX_IMAGES) {
          toast.showInfo('Limite de imagens', `Use no máximo ${MAX_IMAGES} imagens por produto.`);
          return trimmed.slice(0, MAX_IMAGES);
        }
        return trimmed;
      });
    } catch (error) {
      console.error('createProduct -> pick images error', error);
      toast.showError('Erro', 'Não foi possível abrir a galeria de imagens.');
    }
  };

  const handleRemoveImage = (uri: string) => {
    setSelectedImages((prev) => prev.filter((asset) => asset.uri !== uri));
  };

  const toggleThemeSelection = (themeId: number) => {
    if (!allowedThemeIds.includes(themeId)) {
      return;
    }
    setSelectedThemes((prev) => {
      const exists = prev.includes(themeId);
      const updated = exists ? prev.filter((id) => id !== themeId) : [...prev, themeId];
      setClassificationErrors((prevErrors) => ({ ...prevErrors, themes: undefined }));
      return updated;
    });
  };

  const prepareImageFiles = async (assets: LocalImageAsset[]): Promise<ProductImageFile[]> => {
    const payloads = await Promise.all(
      assets.map(async (asset) => {
        const descriptor = await buildImageFilePayload(asset);
        if (!descriptor) {
          throw new Error('Não foi possível processar todas as imagens selecionadas.');
        }
        return descriptor;
      }),
    );
    return payloads;
  };

  const validateClassification = (): boolean => {
    const nextErrors: ClassificationErrors = {};
    if (!selectedCategoryId) {
      nextErrors.category = 'Selecione uma categoria';
    }
    if (!selectedSubcategoryId) {
      nextErrors.subcategory = 'Selecione uma subcategoria';
    }
    if (allowedThemeIds.length > 0 && selectedThemes.length === 0) {
      nextErrors.themes = 'Escolha ao menos um tema disponível para esta subcategoria';
    }
    if (selectedImages.length === 0) {
      nextErrors.images = 'Envie ao menos uma imagem do produto';
    }
    setClassificationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async (data: CreateProductFormData) => {
    if (!validateClassification()) {
      toast.showError(
        'Campos obrigatórios',
        'Revise as seções destacadas antes de salvar.'
      );
      return;
    }

    if (!selectedCategoryId || !selectedSubcategoryId) return;

    try {
      setIsSubmitting(true);

      // Prepara as imagens corretamente usando prepareImageFiles
      const imageFiles: ProductImageFile[] = await prepareImageFiles(selectedImages);

      if (imageFiles.length === 0) {
        toast.showError('Erro', 'Selecione ao menos uma imagem do produto.');
        return;
      }

      const categoryName =
        categories.find((cat) => cat.id === selectedCategoryId)?.name ?? 'Categoria';

      // Monta o payload
      const payload: CreateProductPayload = {
        name: data.name.trim(),
        description: data.description.trim(),
        price: Number(data.price),
        stock: Number(data.stock),
        categoryId: selectedCategoryId,
        categoryName,
        subcategoryId: selectedSubcategoryId,
        themeIds: selectedThemes,
        images: imageFiles,
      };

      // Chama o service que já monta o FormData internamente
      await productService.createProduct(payload);

      toast.showSuccess('Produto criado', 'Seu produto foi cadastrado com sucesso.');

      // Reset
      reset();
      setSelectedImages([]);
      setClassificationErrors({});
      router.back();
    } catch (error: any) {
      console.error('createProduct -> submit error', error);
      toast.showError(
        'Erro',
        error?.message || 'Não foi possível criar o produto.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };



  const renderCategoryChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipScroll}
    >
      {categories.map((category) => {
        const isActive = category.id === selectedCategoryId;
        return (
          <TouchableOpacity
            key={`cat-${category.id}`}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => handleCategorySelect(category.id)}
            disabled={isSubmitting}
          >
            <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{category.name}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderSubcategoryGrid = () => {
    if (!selectedCategoryId) {
      return null;
    }
    const list = subcategoriesByCategory[selectedCategoryId] || [];
    const loading = subcategoriesLoading[selectedCategoryId];
    if (loading) {
      return <ActivityIndicator color={palette.primary} style={{ marginVertical: 12 }} />;
    }
    if (!list.length) {
      return <Text style={styles.emptyText}>Nenhuma subcategoria cadastrada para esta categoria.</Text>;
    }
    return (
      <View style={styles.subcategoryGrid}>
        {list.map((sub) => {
          const isActive = sub.id === selectedSubcategoryId;
          return (
            <TouchableOpacity
              key={`sub-${sub.id}`}
              style={[styles.subcategoryCard, isActive && styles.subcategoryCardActive]}
              onPress={() => handleSubcategorySelect(sub.id)}
              disabled={isSubmitting}
            >
              <Text style={[styles.subcategoryName, isActive && styles.subcategoryNameActive]}>{sub.name}</Text>
              {sub.description ? (
                <Text
                  style={[styles.subcategoryDescription, isActive && styles.subcategoryDescriptionActive]}
                  numberOfLines={2}
                >
                  {sub.description}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderThemeSelector = () => {
    if (!selectedSubcategoryId) {
      return null;
    }
    if (allowedThemesLoading) {
      return <ActivityIndicator color={palette.primary} style={{ marginVertical: 12 }} />;
    }
    if (!allowedThemeIds.length) {
      return <Text style={styles.emptyText}>Nenhum tema disponível para esta subcategoria.</Text>;
    }
    return (
      <View style={styles.themeGrid}>
        {availableThemes.map((theme) => {
          const isActive = selectedThemes.includes(theme.id);
          return (
            <TouchableOpacity
              key={`theme-${theme.id}`}
              style={[styles.themePill, isActive && styles.themePillActive]}
              onPress={() => toggleThemeSelection(theme.id)}
              disabled={isSubmitting}
            >
              <Ionicons
                name={isActive ? 'checkbox' : 'square-outline'}
                size={18}
                color={isActive ? '#fff' : palette.softText}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.themeName, isActive && styles.themeNameActive]}>{theme.name}</Text>
                {theme.description ? (
                  <Text style={[styles.themeDescription, isActive && styles.themeDescriptionActive]} numberOfLines={2}>
                    {theme.description}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderImageGrid = () => (
    <View style={styles.imageGrid}>
      {selectedImages.map((asset) => (
        <View key={asset.uri} style={styles.imageWrapper}>
          <Image source={{ uri: asset.uri }} style={styles.imagePreview} />
          <TouchableOpacity
            style={styles.removeBadge}
            onPress={() => handleRemoveImage(asset.uri)}
            disabled={isSubmitting}
          >
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.imageLabel} numberOfLines={1}>
            {asset.resolvedFileName || 'Imagem selecionada'}
          </Text>
        </View>
      ))}
      {selectedImages.length < MAX_IMAGES && (
        <TouchableOpacity 
          style={styles.addImageButton} 
          onPress={handlePickImages}
          disabled={isSubmitting}
        >
          <Ionicons name="add" size={32} color={palette.primary} />
          <Text style={styles.addImageText}>Adicionar</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (authLoading || initialLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.emptyText}>Carregando dados para o cadastro...</Text>
      </View>
    );
  }

  if (!user || user.type !== 'ADMIN') {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={32} color={palette.danger} />
        <Text style={styles.emptyText}>Apenas administradores podem acessar esta área.</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.background} />
      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} disabled={isSubmitting}>
              <Ionicons name="chevron-back" size={24} color={palette.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Novo Produto</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.pageDescription}>
              Preencha os campos abaixo para adicionar um novo produto ao catálogo.
            </Text>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconContainer}>
                  <Ionicons name="information-circle-outline" size={20} color={palette.primary} />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Informações Básicas</Text>
                  <Text style={styles.sectionSubtitle}>Nome e descrição do produto</Text>
                </View>
              </View>
              
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Nome do Produto *"
                    placeholder="Ex: Mandala Decorativa"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    editable={!isSubmitting}
                    error={errors.name?.message}
                    containerStyle={styles.inputGroup}
                  />
                )}
              />
              
              <Controller
                control={control}
                name="description"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Descrição Detalhada *"
                    placeholder="Descreva os materiais, dimensões e detalhes únicos..."
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    editable={!isSubmitting}
                    multiline
                    numberOfLines={5}
                    style={styles.textArea}
                    error={errors.description?.message}
                    containerStyle={styles.inputGroup}
                  />
                )}
              />
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconContainer}>
                  <Ionicons name="pricetag-outline" size={20} color={palette.primary} />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Preço e Estoque</Text>
                  <Text style={styles.sectionSubtitle}>Defina o valor e a quantidade disponível</Text>
                </View>
              </View>
              
              <View style={styles.sideBySide}>
                <View style={styles.inputGroupHalf}>
                  <Controller
                    control={control}
                    name="price"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Preço (R$) *"
                        placeholder="0,00"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="decimal-pad"
                        editable={!isSubmitting}
                        error={errors.price?.message}
                      />
                    )}
                  />
                </View>
                <View style={styles.inputGroupHalf}>
                  <Controller
                    control={control}
                    name="stock"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label="Estoque *"
                        placeholder="0"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="numeric"
                        editable={!isSubmitting}
                        error={errors.stock?.message}
                      />
                    )}
                  />
                </View>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconContainer}>
                  <Ionicons name="grid-outline" size={20} color={palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Categorização</Text>
                  <Text style={styles.sectionSubtitle}>Organize seu produto na loja</Text>
                </View>
                <TouchableOpacity
                  style={styles.manageButton}
                  onPress={() => router.push('/admin/categories')}
                  disabled={isSubmitting}
                >
                  <Text style={styles.manageButtonText}>Gerenciar</Text>
                </TouchableOpacity>
              </View>
              
              {categories.length ? (
                <>
                  <Text style={styles.label}>Categoria Principal *</Text>
                  {renderCategoryChips()}
                  {classificationErrors.category ? (
                    <Text style={styles.errorText}>{classificationErrors.category}</Text>
                  ) : null}

                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Subcategoria *</Text>
                    {selectedCategoryId ? (
                      <TouchableOpacity
                        onPress={() => ensureSubcategories(selectedCategoryId, true)}
                        disabled={subcategoriesLoading[selectedCategoryId]}
                      >
                        <Ionicons name="refresh" size={16} color={palette.primary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {renderSubcategoryGrid()}
                  {classificationErrors.subcategory ? (
                    <Text style={styles.errorText}>{classificationErrors.subcategory}</Text>
                  ) : null}

                  <Text style={styles.label}>Temas Relacionados</Text>
                  {renderThemeSelector()}
                  {classificationErrors.themes ? (
                    <Text style={styles.errorText}>{classificationErrors.themes}</Text>
                  ) : null}
                </>
              ) : (
                <View style={styles.emptyStateBox}>
                  <Text style={styles.emptyText}>Cadastre ao menos uma categoria antes de criar produtos.</Text>
                </View>
              )}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.iconContainer}>
                  <Ionicons name="images-outline" size={20} color={palette.primary} />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Galeria de Imagens</Text>
                  <Text style={styles.sectionSubtitle}>Adicione até {MAX_IMAGES} fotos ({selectedImages.length}/{MAX_IMAGES})</Text>
                </View>
              </View>
              
              {renderImageGrid()}
              {classificationErrors.images ? (
                <Text style={styles.errorText}>{classificationErrors.images}</Text>
              ) : null}
            </View>

            <View style={styles.footerSpace} />
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.disabledButton]}
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Cadastrar Produto</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: palette.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
  },
  pageDescription: {
    fontSize: 15,
    color: palette.softText,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E0F7FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: palette.softText,
  },
  manageButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  manageButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputGroupHalf: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 8,
    marginLeft: 4,
  },
  textArea: {
    minHeight: 120,
  },
  sideBySide: {
    flexDirection: 'row',
  },
  errorText: {
    color: palette.danger,
    marginTop: 6,
    fontSize: 13,
    marginLeft: 4,
  },
  chipScroll: {
    paddingVertical: 4,
    marginBottom: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    backgroundColor: '#FFF',
  },
  chipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  chipLabel: {
    color: palette.softText,
    fontWeight: '600',
    fontSize: 14,
  },
  chipLabelActive: {
    color: '#FFF',
  },
  subcategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
    marginBottom: 20,
  },
  subcategoryCard: {
    flexBasis: '48%',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    padding: 12,
    minHeight: 80,
    backgroundColor: '#FFF',
    justifyContent: 'center',
  },
  subcategoryCardActive: {
    borderColor: palette.primary,
    backgroundColor: '#E0F7FA',
  },
  subcategoryName: {
    fontWeight: '600',
    color: palette.text,
    fontSize: 14,
    marginBottom: 4,
  },
  subcategoryNameActive: {
    color: palette.primaryDark,
  },
  subcategoryDescription: {
    color: palette.softText,
    fontSize: 12,
    lineHeight: 16,
  },
  subcategoryDescriptionActive: {
    color: palette.primaryDark,
    opacity: 0.8,
  },
  themeGrid: {
    marginTop: 8,
    gap: 10,
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#FFF',
  },
  themePillActive: {
    backgroundColor: '#E0F7FA',
    borderColor: palette.primary,
  },
  themeName: {
    color: palette.text,
    fontWeight: '600',
    fontSize: 14,
  },
  themeNameActive: {
    color: palette.primaryDark,
  },
  themeDescription: {
    color: palette.softText,
    fontSize: 12,
  },
  themeDescriptionActive: {
    color: palette.primaryDark,
    opacity: 0.8,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageWrapper: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#FFF',
    fontSize: 10,
    padding: 4,
    textAlign: 'center',
  },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  addImageButton: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: palette.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  addImageText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.primary,
    marginTop: 4,
  },
  footerSpace: {
    height: 80,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  submitButton: {
    backgroundColor: palette.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.7,
    backgroundColor: palette.muted,
    shadowOpacity: 0,
  },
  emptyStateBox: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: palette.softText,
    textAlign: 'center',
    fontSize: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
    gap: 16,
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  secondaryButtonText: {
    color: palette.text,
    fontWeight: '600',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 16,
  },
});
