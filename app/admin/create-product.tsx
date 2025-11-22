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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import toast from '../../src/utils/toast';
import { useAuth } from '@/hooks/useAuth';
import { productService, categoryService, CreateProductPayload, ProductImageFile } from '@/services/productService';
import { CategoryDTO, SubcategoryDTO, ThemeDTO } from '@/services/categoryService';

const palette = {
  background: '#F4F6FB',
  surface: '#FFFFFF',
  border: '#E4E9F2',
  primary: '#00BCD4',
  primaryDark: '#0397A8',
  accent: '#0397A8',
  text: '#0F172A',
  softText: '#475569',
  muted: '#94A3B8',
  danger: '#DC2626',
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
      toast.showError('Campos obrigatórios', 'Revise as seções destacadas antes de salvar.');
      return;
    }
    if (!selectedCategoryId || !selectedSubcategoryId) {
      return;
    }
    try {
      setIsSubmitting(true);
      const imageFiles = await prepareImageFiles(selectedImages);
      const categoryName = categories.find((cat) => cat.id === selectedCategoryId)?.name ?? 'Categoria';
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
      await productService.createProduct(payload);
      toast.showSuccess('Produto criado', 'Seu produto foi cadastrado com sucesso.');
      reset();
      setSelectedImages([]);
      setClassificationErrors({});
      router.back();
    } catch (error: any) {
      console.error('createProduct -> submit error', error);
      toast.showError('Erro', error?.message || 'Não foi possível criar o produto.');
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
    </View>
  );

  if (authLoading || initialLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.emptyText}>Carregando dados para o cadastro...</Text>
      </SafeAreaView>
    );
  }

  if (!user || user.type !== 'ADMIN') {
    return (
      <SafeAreaView style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={32} color={palette.danger} />
        <Text style={styles.emptyText}>Apenas administradores podem acessar esta área.</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} disabled={isSubmitting}>
              <Ionicons name="chevron-back" size={20} color={palette.accent} />
              <Text style={styles.backButtonText}>Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Cadastrar novo produto</Text>
            <Text style={styles.subtitle}>Defina informações, estoque, categorias, temas e imagens em um só lugar.</Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Informações básicas</Text>
              <Text style={styles.sectionSubtitle}>Nome e descrição vistos pelos clientes.</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome *</Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, errors.name && styles.inputError]}
                    placeholder="Ex: Mandala decorativa"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    editable={!isSubmitting}
                  />
                )}
              />
              {errors.name ? <Text style={styles.errorText}>{errors.name.message}</Text> : null}
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Descrição *</Text>
              <Controller
                control={control}
                name="description"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, styles.textArea, errors.description && styles.inputError]}
                    placeholder="Compartilhe detalhes do produto, materiais e diferenciais."
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    editable={!isSubmitting}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                  />
                )}
              />
              {errors.description ? <Text style={styles.errorText}>{errors.description.message}</Text> : null}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Preço e estoque</Text>
              <Text style={styles.sectionSubtitle}>Controle financeiro e disponibilidade.</Text>
            </View>
            <View style={styles.sideBySide}>
              <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>Preço (R$) *</Text>
                <Controller
                  control={control}
                  name="price"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[styles.input, errors.price && styles.inputError]}
                      placeholder="Ex: 129.90"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="decimal-pad"
                      editable={!isSubmitting}
                    />
                  )}
                />
                {errors.price ? <Text style={styles.errorText}>{errors.price.message}</Text> : null}
              </View>
              <View style={styles.inputGroupHalf}>
                <Text style={styles.label}>Estoque *</Text>
                <Controller
                  control={control}
                  name="stock"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[styles.input, errors.stock && styles.inputError]}
                      placeholder="Ex: 15"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="numeric"
                      editable={!isSubmitting}
                    />
                  )}
                />
                {errors.stock ? <Text style={styles.errorText}>{errors.stock.message}</Text> : null}
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Classificação</Text>
              <Text style={styles.sectionSubtitle}>Selecione categoria, subcategoria e temas compatíveis.</Text>
            </View>
            <View style={styles.sectionActionRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push('/admin/categories')}
                disabled={isSubmitting}
              >
                <Ionicons name="albums-outline" size={16} color={palette.text} style={styles.buttonIcon} />
                <Text style={styles.secondaryButtonText}>Gerenciar categorias</Text>
              </TouchableOpacity>
            </View>
            {categories.length ? (
              <>
                <Text style={styles.label}>Categoria *</Text>
                {renderCategoryChips()}
                {classificationErrors.category ? (
                  <Text style={styles.errorText}>{classificationErrors.category}</Text>
                ) : null}

                <View style={styles.labelRow}>
                  <Text style={styles.label}>Subcategorias *</Text>
                  {selectedCategoryId ? (
                    <TouchableOpacity
                      onPress={() => ensureSubcategories(selectedCategoryId, true)}
                      disabled={subcategoriesLoading[selectedCategoryId]}
                    >
                      <Text style={styles.refreshLink}>Atualizar</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {renderSubcategoryGrid()}
                {classificationErrors.subcategory ? (
                  <Text style={styles.errorText}>{classificationErrors.subcategory}</Text>
                ) : null}

                <Text style={styles.label}>Temas disponíveis</Text>
                {renderThemeSelector()}
                {classificationErrors.themes ? (
                  <Text style={styles.errorText}>{classificationErrors.themes}</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.emptyText}>Cadastre ao menos uma categoria antes de criar produtos.</Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Imagens</Text>
              <Text style={styles.sectionSubtitle}>Adicione até {MAX_IMAGES} fotos para destacar seu produto.</Text>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, styles.uploadButton]}
              onPress={handlePickImages}
              disabled={isSubmitting}
            >
              <Ionicons name="images-outline" size={18} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>Selecionar imagens</Text>
            </TouchableOpacity>
            <Text style={styles.helperText}>
              {selectedImages.length ? `${selectedImages.length}/${MAX_IMAGES} selecionadas` : 'Nenhuma imagem selecionada'}
            </Text>
            {renderImageGrid()}
            {classificationErrors.images ? (
              <Text style={styles.errorText}>{classificationErrors.images}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.primaryButtonText}>Cadastrar produto</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  backButtonText: {
    color: palette.accent,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: palette.text,
  },
  subtitle: {
    marginTop: 4,
    color: palette.softText,
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: palette.softText,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupHalf: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 6,
  },
  helperText: {
    color: palette.softText,
    fontSize: 13,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FAFBFF',
    color: palette.text,
  },
  inputError: {
    borderColor: palette.danger,
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
  },
  sectionActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  secondaryButtonText: {
    color: palette.text,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 4,
  },
  chipScroll: {
    paddingVertical: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#E0F7FA',
    borderColor: palette.primary,
  },
  chipLabel: {
    color: palette.softText,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: palette.text,
  },
  subcategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  subcategoryCard: {
    flexBasis: '48%',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 12,
    minHeight: 88,
  },
  subcategoryCardActive: {
    borderColor: palette.primary,
    backgroundColor: '#E0F7FA',
  },
  subcategoryName: {
    fontWeight: '600',
    color: palette.text,
  },
  subcategoryNameActive: {
    color: palette.primaryDark,
  },
  subcategoryDescription: {
    marginTop: 6,
    color: palette.softText,
    fontSize: 12,
  },
  subcategoryDescriptionActive: {
    color: palette.text,
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
    borderRadius: 14,
    padding: 12,
  },
  themePillActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  themeName: {
    color: palette.text,
    fontWeight: '600',
  },
  themeNameActive: {
    color: '#fff',
  },
  themeDescription: {
    color: palette.softText,
    fontSize: 12,
  },
  themeDescriptionActive: {
    color: '#fff',
  },
  uploadButton: {
    alignSelf: 'flex-start',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  imageWrapper: {
    width: 110,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 8,
    backgroundColor: '#F8FAFF',
  },
  imagePreview: {
    width: '100%',
    height: 90,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#E2E8F0',
  },
  imageLabel: {
    fontSize: 11,
    color: palette.softText,
  },
  removeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: palette.softText,
    textAlign: 'center',
    marginTop: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
    gap: 12,
    padding: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  refreshLink: {
    color: palette.accent,
    fontWeight: '600',
  },
});
