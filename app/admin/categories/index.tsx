import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Input } from '@/components/ui/Input';
import toast from '../../../src/utils/toast';
import {
  categoryService,
  CategoryDTO,
  SubcategoryDTO,
  ThemeDTO,
} from '@/services/categoryService';

const palette = {
  background: '#F8FAFC', // Slate 50
  surface: '#FFFFFF',
  border: '#E2E8F0', // Slate 200
  primary: '#00BCD4', // Cyan 500
  primaryDark: '#0891B2', // Cyan 600
  primaryForeground: '#FFFFFF',
  secondary: '#F1F5F9', // Slate 100
  secondaryForeground: '#0F172A',
  accent: '#00BCD4',
  text: '#0F172A', // Slate 900
  softText: '#64748B', // Slate 500
  muted: '#94A3B8', // Slate 400
  danger: '#EF4444', // Red 500
  success: '#10B981', // Emerald 500
};

type ManagementTab = 'categories' | 'subcategories' | 'themes' | 'assignments';
type ModalMode = 'create' | 'edit';

type ModalConfig =
  | { type: 'category'; mode: ModalMode; entity?: CategoryDTO | null }
  | { type: 'subcategory'; mode: ModalMode; categoryId: number; entity?: SubcategoryDTO | null }
  | { type: 'theme'; mode: ModalMode; entity?: ThemeDTO | null };

type ConfirmConfig =
  | { type: 'category'; entity: CategoryDTO }
  | { type: 'subcategory'; entity: SubcategoryDTO; categoryId: number }
  | { type: 'theme'; entity: ThemeDTO };

const tabs: { key: ManagementTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'categories', label: 'Categorias', icon: 'albums-outline' },
  { key: 'subcategories', label: 'Subcategorias', icon: 'git-branch-outline' },
  { key: 'themes', label: 'Temas', icon: 'color-palette-outline' },
  { key: 'assignments', label: 'Vínculos', icon: 'link-outline' },
];

const sortByName = <T extends { name?: string | null }>(a: T, b: T) =>
  (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR', { sensitivity: 'base' });

export default function CategoryManagementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<ManagementTab>('categories');
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [themes, setThemes] = useState<ThemeDTO[]>([]);
  const [themesLoading, setThemesLoading] = useState(false);

  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<Record<number, SubcategoryDTO[]>>({});
  const [subcategoriesLoading, setSubcategoriesLoading] = useState<Record<number, boolean>>({});

  const [subCategoryFilterId, setSubCategoryFilterId] = useState<number | null>(null);
  const [assignmentCategoryId, setAssignmentCategoryId] = useState<number | null>(null);
  const [assignmentSubcategoryId, setAssignmentSubcategoryId] = useState<number | null>(null);

  const [assignmentSelections, setAssignmentSelections] = useState<number[]>([]);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentFetching, setAssignmentFetching] = useState(false);

  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
  const [modalName, setModalName] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const data = await categoryService.getAllCategories();
      setCategories(data.sort(sortByName));
    } catch (error: any) {
      console.error('loadCategories ->', error);
      toast.showError('Erro', error?.message || 'Não foi possível carregar as categorias.');
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const loadThemes = useCallback(async () => {
    try {
      setThemesLoading(true);
      const data = await categoryService.getThemes();
      setThemes(data.sort(sortByName));
    } catch (error: any) {
      console.error('loadThemes ->', error);
      toast.showError('Erro', error?.message || 'Não foi possível carregar os temas.');
    } finally {
      setThemesLoading(false);
    }
  }, []);

  const ensureSubcategories = useCallback(async (categoryId: number, force = false) => {
    if (!categoryId) {
      return;
    }
    if (!force && subcategoriesByCategory[categoryId]) {
      return;
    }
    setSubcategoriesLoading((prev) => ({ ...prev, [categoryId]: true }));
    try {
      const data = await categoryService.getSubcategories(categoryId);
      setSubcategoriesByCategory((prev) => ({ ...prev, [categoryId]: data.sort(sortByName) }));
    } catch (error: any) {
      console.error('ensureSubcategories ->', error);
      toast.showError('Erro', error?.message || 'Não foi possível carregar as subcategorias.');
    } finally {
      setSubcategoriesLoading((prev) => ({ ...prev, [categoryId]: false }));
    }
  }, [subcategoriesByCategory]);

  const refreshAssignmentSelection = useCallback(async (subcategoryId: number) => {
    setAssignmentFetching(true);
    try {
      const ids = await categoryService.getThemeIdsBySubcategory(subcategoryId);
      setAssignmentSelections(ids);
    } catch (error: any) {
      console.error('refreshAssignmentSelection ->', error);
      toast.showError('Erro', error?.message || 'Não foi possível carregar as vinculações.');
    } finally {
      setAssignmentFetching(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadThemes();
  }, [loadCategories, loadThemes]);

  useEffect(() => {
    if (!categories.length) {
      return;
    }
    if (subCategoryFilterId == null) {
      setSubCategoryFilterId(categories[0].id);
    }
    if (assignmentCategoryId == null) {
      setAssignmentCategoryId(categories[0].id);
    }
  }, [categories, subCategoryFilterId, assignmentCategoryId]);

  useEffect(() => {
    if (subCategoryFilterId != null) {
      ensureSubcategories(subCategoryFilterId);
    }
  }, [subCategoryFilterId, ensureSubcategories]);

  useEffect(() => {
    if (assignmentCategoryId != null) {
      ensureSubcategories(assignmentCategoryId);
    }
  }, [assignmentCategoryId, ensureSubcategories]);

  useEffect(() => {
    if (!assignmentCategoryId) {
      setAssignmentSubcategoryId(null);
      setAssignmentSelections([]);
      return;
    }
    const currentList = subcategoriesByCategory[assignmentCategoryId] || [];
    if (!currentList.length) {
      setAssignmentSubcategoryId(null);
      setAssignmentSelections([]);
      return;
    }
    if (assignmentSubcategoryId && currentList.some((item) => item.id === assignmentSubcategoryId)) {
      return;
    }
    setAssignmentSubcategoryId(currentList[0].id);
  }, [assignmentCategoryId, subcategoriesByCategory, assignmentSubcategoryId]);

  useEffect(() => {
    if (!assignmentSubcategoryId) {
      setAssignmentSelections([]);
      return;
    }
    refreshAssignmentSelection(assignmentSubcategoryId);
  }, [assignmentSubcategoryId, refreshAssignmentSelection]);

  const sortedCategories = useMemo(() => [...categories].sort(sortByName), [categories]);
  const sortedThemes = useMemo(() => [...themes].sort(sortByName), [themes]);

  const openModal = (config: ModalConfig) => {
    setModalConfig(config);
    setModalName(config.entity?.name ?? '');
    setModalDescription(config.entity?.description ?? '');
  };

  const closeModal = () => {
    if (modalSaving) {
      return;
    }
    setModalConfig(null);
    setModalName('');
    setModalDescription('');
  };

  const handleModalSubmit = async () => {
    if (!modalConfig) {
      return;
    }
    if (!modalName.trim()) {
      toast.showError('Campo obrigatório', 'Informe um nome antes de salvar.');
      return;
    }

    const payload = { name: modalName.trim(), description: modalDescription.trim() || null };

    try {
      setModalSaving(true);
      if (modalConfig.type === 'category') {
        if (modalConfig.mode === 'create') {
          const created = await categoryService.createCategory(payload);
          setCategories((prev) => [...prev, created].sort(sortByName));
          toast.showSuccess('Categoria criada', `"${created.name}" adicionada.`);
        } else if (modalConfig.entity) {
          const updated = await categoryService.updateCategory(modalConfig.entity.id, payload);
          setCategories((prev) => prev.map((item) => (item.id === updated.id ? updated : item)).sort(sortByName));
          toast.showSuccess('Categoria atualizada', `"${updated.name}" salva.`);
        }
      }

      if (modalConfig.type === 'subcategory') {
        if (!modalConfig.categoryId) {
          throw new Error('Selecione uma categoria válida.');
        }
        if (modalConfig.mode === 'create') {
          const created = await categoryService.createSubcategory(modalConfig.categoryId, payload);
          setSubcategoriesByCategory((prev) => ({
            ...prev,
            [modalConfig.categoryId]: [...(prev[modalConfig.categoryId] || []), created].sort(sortByName),
          }));
          toast.showSuccess('Subcategoria criada', `"${created.name}" adicionada.`);
        } else if (modalConfig.entity) {
          const updated = await categoryService.updateSubcategory(modalConfig.categoryId, modalConfig.entity.id, payload);
          setSubcategoriesByCategory((prev) => ({
            ...prev,
            [modalConfig.categoryId]: (prev[modalConfig.categoryId] || []).map((item) =>
              item.id === updated.id ? updated : item,
            ).sort(sortByName),
          }));
          toast.showSuccess('Subcategoria atualizada', `"${updated.name}" salva.`);
        }
      }

      if (modalConfig.type === 'theme') {
        if (modalConfig.mode === 'create') {
          const created = await categoryService.createTheme(payload);
          setThemes((prev) => [...prev, created].sort(sortByName));
          toast.showSuccess('Tema criado', `"${created.name}" adicionado.`);
        } else if (modalConfig.entity) {
          const updated = await categoryService.updateTheme(modalConfig.entity.id, payload);
          setThemes((prev) => prev.map((item) => (item.id === updated.id ? updated : item)).sort(sortByName));
          toast.showSuccess('Tema atualizado', `"${updated.name}" salvo.`);
        }
      }

      closeModal();
    } catch (error: any) {
      console.error('handleModalSubmit ->', error);
      toast.showError('Erro ao salvar', error?.message || 'Tente novamente mais tarde.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleDelete = (config: ConfirmConfig) => {
    setConfirmConfig(config);
  };

  const handleConfirmDelete = async () => {
    if (!confirmConfig) {
      return;
    }
    try {
      setConfirmLoading(true);
      if (confirmConfig.type === 'category') {
        await categoryService.deleteCategory(confirmConfig.entity.id);
        setCategories((prev) => prev.filter((item) => item.id !== confirmConfig.entity.id));
        setSubcategoriesByCategory((prev) => {
          const copy = { ...prev };
          delete copy[confirmConfig.entity.id];
          return copy;
        });
        if (subCategoryFilterId === confirmConfig.entity.id) {
          setSubCategoryFilterId(null);
        }
        if (assignmentCategoryId === confirmConfig.entity.id) {
          setAssignmentCategoryId(null);
        }
        toast.showSuccess('Categoria excluída', 'Removida com sucesso.');
      }

      if (confirmConfig.type === 'subcategory') {
        await categoryService.deleteSubcategory(confirmConfig.categoryId, confirmConfig.entity.id);
        setSubcategoriesByCategory((prev) => ({
          ...prev,
          [confirmConfig.categoryId]: (prev[confirmConfig.categoryId] || []).filter(
            (item) => item.id !== confirmConfig.entity.id,
          ),
        }));
        if (assignmentSubcategoryId === confirmConfig.entity.id) {
          setAssignmentSubcategoryId(null);
        }
        toast.showSuccess('Subcategoria excluída', 'Removida com sucesso.');
      }

      if (confirmConfig.type === 'theme') {
        await categoryService.deleteTheme(confirmConfig.entity.id);
        setThemes((prev) => prev.filter((item) => item.id !== confirmConfig.entity.id));
        setAssignmentSelections((prev) => prev.filter((id) => id !== confirmConfig.entity.id));
        toast.showSuccess('Tema excluído', 'Removido com sucesso.');
      }

      setConfirmConfig(null);
    } catch (error: any) {
      console.error('handleConfirmDelete ->', error);
      toast.showError('Erro ao excluir', error?.message || 'Não foi possível concluir a ação.');
    } finally {
      setConfirmLoading(false);
    }
  };

  const toggleAssignmentTheme = (themeId: number) => {
    setAssignmentSelections((prev) =>
      prev.includes(themeId) ? prev.filter((id) => id !== themeId) : [...prev, themeId],
    );
  };

  const handleSaveAssignments = async () => {
    if (!assignmentCategoryId || !assignmentSubcategoryId) {
      toast.showError('Selecione uma subcategoria', 'Escolha a subcategoria antes de salvar.');
      return;
    }
    try {
      setAssignmentSaving(true);
      await categoryService.overwriteThemes(assignmentSubcategoryId, assignmentSelections);
      toast.showSuccess('Vinculação atualizada', 'Temas da subcategoria foram salvos.');
    } catch (error: any) {
      console.error('handleSaveAssignments ->', error);
      toast.showError('Erro ao salvar', error?.message || 'Não foi possível salvar as vinculações.');
    } finally {
      setAssignmentSaving(false);
    }
  };

  const renderEmptyState = (message: string) => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="cube-outline" size={32} color={palette.muted} />
      </View>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );

  const renderCategoryTab = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name="albums-outline" size={20} color={palette.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Categorias</Text>
          <Text style={styles.sectionSubtitle}>Organize as macro áreas dos produtos.</Text>
        </View>
        <TouchableOpacity
          style={styles.iconButton}
          disabled={categoriesLoading}
          onPress={loadCategories}
        >
          {categoriesLoading ? (
            <ActivityIndicator size="small" color={palette.text} />
          ) : (
            <Ionicons name="refresh-outline" size={20} color={palette.text} />
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => openModal({ type: 'category', mode: 'create' })}
      >
        <Ionicons name="add" size={20} color={palette.primaryForeground} />
        <Text style={styles.primaryButtonText}>Nova categoria</Text>
      </TouchableOpacity>

      <View style={styles.listContainer}>
        {categoriesLoading ? (
          <ActivityIndicator color={palette.primary} style={{ marginTop: 20 }} />
        ) : sortedCategories.length ? (
          sortedCategories.map((category) => (
            <View key={category.id} style={styles.entityRow}>
              <View style={styles.entityInfo}>
                <Text style={styles.entityName}>{category.name}</Text>
                {category.description ? (
                  <Text style={styles.entityDescription}>{category.description}</Text>
                ) : null}
              </View>
              <View style={styles.rowActions}>
                <TouchableOpacity 
                  style={styles.actionIcon}
                  onPress={() => openModal({ type: 'category', mode: 'edit', entity: category })}
                >
                  <Ionicons name="create-outline" size={20} color={palette.softText} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionIcon, styles.actionIconDanger]}
                  onPress={() => handleDelete({ type: 'category', entity: category })}
                >
                  <Ionicons name="trash-outline" size={20} color={palette.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          renderEmptyState('Nenhuma categoria cadastrada ainda.')
        )}
      </View>
    </View>
  );

  const renderCategoryFilter = (
    selectedId: number | null,
    onSelect: (id: number) => void,
    label: string,
  ) => (
    <View style={styles.filterContainer}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        {sortedCategories.map((category) => {
          const isActive = selectedId === category.id;
          return (
            <TouchableOpacity
              key={`cat-chip-${category.id}`}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => onSelect(category.id)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderSubcategoryTab = () => {
    const currentCategoryId = subCategoryFilterId;
    const currentItems = currentCategoryId ? subcategoriesByCategory[currentCategoryId] || [] : [];
    const isLoading = currentCategoryId ? subcategoriesLoading[currentCategoryId] : false;

    return (
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.iconContainer}>
            <Ionicons name="git-branch-outline" size={20} color={palette.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Subcategorias</Text>
            <Text style={styles.sectionSubtitle}>Especifique linhas dentro de cada categoria.</Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => currentCategoryId && ensureSubcategories(currentCategoryId, true)}
            disabled={!currentCategoryId}
          >
             <Ionicons name="refresh-outline" size={20} color={palette.text} />
          </TouchableOpacity>
        </View>

        {sortedCategories.length ? (
          renderCategoryFilter(currentCategoryId, (id) => setSubCategoryFilterId(id), 'Filtrar por Categoria')
        ) : null}

        <TouchableOpacity
          style={[styles.primaryButton, (!currentCategoryId || !sortedCategories.length) && styles.disabledButton]}
          disabled={!currentCategoryId || !sortedCategories.length}
          onPress={() =>
            currentCategoryId &&
            openModal({ type: 'subcategory', mode: 'create', categoryId: currentCategoryId })
          }
        >
          <Ionicons name="add" size={20} color={palette.primaryForeground} />
          <Text style={styles.primaryButtonText}>Nova subcategoria</Text>
        </TouchableOpacity>

        <View style={styles.listContainer}>
          {!currentCategoryId ? (
            renderEmptyState('Cadastre ao menos uma categoria para seguir.')
          ) : isLoading ? (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 20 }} />
          ) : currentItems.length ? (
            currentItems.map((subcategory) => (
              <View key={subcategory.id} style={styles.entityRow}>
                <View style={styles.entityInfo}>
                  <Text style={styles.entityName}>{subcategory.name}</Text>
                  {subcategory.description ? (
                    <Text style={styles.entityDescription}>{subcategory.description}</Text>
                  ) : null}
                </View>
                <View style={styles.rowActions}>
                  <TouchableOpacity
                    style={styles.actionIcon}
                    onPress={() =>
                      currentCategoryId &&
                      openModal({
                        type: 'subcategory',
                        mode: 'edit',
                        categoryId: currentCategoryId,
                        entity: subcategory,
                      })
                    }
                  >
                    <Ionicons name="create-outline" size={20} color={palette.softText} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionIcon, styles.actionIconDanger]}
                    onPress={() =>
                      currentCategoryId &&
                      handleDelete({ type: 'subcategory', categoryId: currentCategoryId, entity: subcategory })
                    }
                  >
                    <Ionicons name="trash-outline" size={20} color={palette.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            renderEmptyState('Nenhuma subcategoria para esta categoria.')
          )}
        </View>
      </View>
    );
  };

  const renderThemesTab = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name="color-palette-outline" size={20} color={palette.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Temas</Text>
          <Text style={styles.sectionSubtitle}>Crie variações temáticas reutilizáveis.</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => openModal({ type: 'theme', mode: 'create' })}
      >
        <Ionicons name="add" size={20} color={palette.primaryForeground} />
        <Text style={styles.primaryButtonText}>Novo tema</Text>
      </TouchableOpacity>

      <View style={styles.listContainer}>
        {themesLoading ? (
          <ActivityIndicator color={palette.primary} style={{ marginTop: 20 }} />
        ) : sortedThemes.length ? (
          sortedThemes.map((theme) => (
            <View key={theme.id} style={styles.entityRow}>
              <View style={styles.entityInfo}>
                <Text style={styles.entityName}>{theme.name}</Text>
                {theme.description ? <Text style={styles.entityDescription}>{theme.description}</Text> : null}
              </View>
              <View style={styles.rowActions}>
                <TouchableOpacity 
                  style={styles.actionIcon}
                  onPress={() => openModal({ type: 'theme', mode: 'edit', entity: theme })}
                >
                  <Ionicons name="create-outline" size={20} color={palette.softText} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionIcon, styles.actionIconDanger]}
                  onPress={() => handleDelete({ type: 'theme', entity: theme })}
                >
                  <Ionicons name="trash-outline" size={20} color={palette.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          renderEmptyState('Nenhum tema cadastrado ainda.')
        )}
      </View>
    </View>
  );

  const renderAssignmentsTab = () => {
    const currentCategoryId = assignmentCategoryId;
    const currentSubcategories = currentCategoryId ? subcategoriesByCategory[currentCategoryId] || [] : [];
    const subcategoryLoading = currentCategoryId ? subcategoriesLoading[currentCategoryId] : false;

    return (
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.iconContainer}>
            <Ionicons name="link-outline" size={20} color={palette.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Vincular temas</Text>
            <Text style={styles.sectionSubtitle}>Associe temas às subcategorias.</Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            disabled={!assignmentSubcategoryId || assignmentFetching}
            onPress={() => assignmentSubcategoryId && refreshAssignmentSelection(assignmentSubcategoryId)}
          >
            {assignmentFetching ? (
              <ActivityIndicator size="small" color={palette.text} />
            ) : (
              <Ionicons name="sync-outline" size={20} color={palette.text} />
            )}
          </TouchableOpacity>
        </View>

        {sortedCategories.length ? (
          renderCategoryFilter(currentCategoryId, (id) => setAssignmentCategoryId(id), '1. Selecione a Categoria')
        ) : (
          renderEmptyState('Cadastre uma categoria para começar.')
        )}

        {currentCategoryId && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.filterLabel}>2. Selecione a Subcategoria</Text>
            {subcategoryLoading ? (
              <ActivityIndicator color={palette.primary} style={{ marginVertical: 16 }} />
            ) : currentSubcategories.length ? (
              <View style={styles.subcategoryGrid}>
                {currentSubcategories.map((sub) => {
                  const isActive = assignmentSubcategoryId === sub.id;
                  return (
                    <TouchableOpacity
                      key={`sub-chip-${sub.id}`}
                      style={[styles.subcategoryCard, isActive && styles.subcategoryCardActive]}
                      onPress={() => setAssignmentSubcategoryId(sub.id)}
                    >
                      <Text style={[styles.subcategoryName, isActive && styles.subcategoryNameActive]}>
                        {sub.name}
                      </Text>
                      {sub.description ? (
                        <Text style={[styles.subcategoryDescription, isActive && styles.subcategoryDescriptionActive]} numberOfLines={2}>
                          {sub.description}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              renderEmptyState('Nenhuma subcategoria para esta categoria.')
            )}
          </View>
        )}

        {assignmentSubcategoryId && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.filterLabel}>3. Selecione os Temas</Text>
            {!sortedThemes.length ? (
              renderEmptyState('Cadastre temas antes de realizar vinculações.')
            ) : (
              <View style={styles.themeGrid}>
                {sortedThemes.map((theme) => {
                  const isSelected = assignmentSelections.includes(theme.id);
                  return (
                    <TouchableOpacity
                      key={`theme-pill-${theme.id}`}
                      style={[styles.themePill, isSelected && styles.themePillSelected]}
                      onPress={() => toggleAssignmentTheme(theme.id)}
                    >
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={isSelected ? palette.primary : palette.muted}
                      />
                      <View style={styles.themeTextWrapper}>
                        <Text style={[styles.themeName, isSelected && styles.themeNameSelected]}>{theme.name}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {assignmentSubcategoryId && (
          <View style={styles.footerAction}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (assignmentSaving || assignmentFetching) && styles.disabledButton,
              ]}
              onPress={handleSaveAssignments}
              disabled={assignmentSaving || assignmentFetching}
            >
              {assignmentSaving || assignmentFetching ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="save-outline" size={20} color="#fff" />
              )}
              <Text style={styles.primaryButtonText}>Salvar vinculações</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderModal = () => (
    <Modal visible={!!modalConfig} animationType="fade" transparent onRequestClose={closeModal}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {modalConfig?.mode === 'edit' ? 'Editar' : 'Criar'}{' '}
              {modalConfig?.type === 'category'
                ? 'categoria'
                : modalConfig?.type === 'subcategory'
                  ? 'subcategoria'
                  : 'tema'}
            </Text>
            <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={palette.softText} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Input
              label="Nome"
              placeholder="Digite o nome"
              value={modalName}
              onChangeText={setModalName}
              containerStyle={{ marginBottom: 16 }}
            />

            <Input
              label="Descrição (opcional)"
              placeholder="Conte um pouco sobre este item"
              value={modalDescription}
              onChangeText={setModalDescription}
              multiline
              numberOfLines={3}
              style={styles.inputMultiline}
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={closeModal} disabled={modalSaving}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, styles.modalButton, modalSaving && styles.disabledButton]}
              onPress={handleModalSubmit}
              disabled={modalSaving}
            >
              {modalSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  if (authLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (!user || user.type !== 'ADMIN') {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="lock-closed-outline" size={48} color={palette.danger} />
        <Text style={styles.restrictedText}>Acesso restrito</Text>
        <Text style={styles.restrictedSubText}>Apenas administradores podem acessar esta área.</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.background} />
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Gerenciamento</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Ionicons
                  name={tab.icon}
                  size={18}
                  color={isActive ? palette.primaryForeground : palette.softText}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'categories' && renderCategoryTab()}
        {activeTab === 'subcategories' && renderSubcategoryTab()}
        {activeTab === 'themes' && renderThemesTab()}
        {activeTab === 'assignments' && renderAssignmentsTab()}
      </ScrollView>

      {renderModal()}
      <ConfirmModal
        visible={!!confirmConfig}
        title="Confirmar exclusão"
        message="Essa ação não pode ser desfeita. Deseja continuar?"
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => confirmConfig && !confirmLoading && setConfirmConfig(null)}
        loading={confirmLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.background,
    gap: 16,
    padding: 20,
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
  tabsContainer: {
    marginBottom: 16,
  },
  tabsScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: palette.border,
    gap: 8,
  },
  tabButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.softText,
  },
  tabLabelActive: {
    color: palette.primaryForeground,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 20,
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
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: palette.secondary,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: palette.primary,
    borderRadius: 16,
    gap: 8,
    marginBottom: 20,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: palette.primaryForeground,
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    gap: 8,
  },
  secondaryButtonText: {
    color: palette.text,
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
  listContainer: {
    gap: 12,
  },
  entityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  entityInfo: {
    flex: 1,
  },
  entityName: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  entityDescription: {
    fontSize: 13,
    color: palette.softText,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIcon: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: palette.border,
  },
  actionIconDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: palette.softText,
    textAlign: 'center',
    fontSize: 14,
  },
  filterContainer: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 12,
  },
  filterScroll: {
    paddingRight: 20,
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
  },
  filterChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.softText,
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  subcategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  subcategoryCard: {
    width: '48%',
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    minHeight: 80,
    justifyContent: 'center',
  },
  subcategoryCardActive: {
    backgroundColor: '#E0F7FA',
    borderColor: palette.primary,
  },
  subcategoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 4,
  },
  subcategoryNameActive: {
    color: palette.primaryDark,
  },
  subcategoryDescription: {
    fontSize: 12,
    color: palette.softText,
  },
  subcategoryDescriptionActive: {
    color: palette.primaryDark,
    opacity: 0.8,
  },
  themeGrid: {
    gap: 10,
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  themePillSelected: {
    backgroundColor: '#E0F7FA',
    borderColor: palette.primary,
  },
  themeTextWrapper: {
    flex: 1,
  },
  themeName: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.text,
  },
  themeNameSelected: {
    color: palette.primaryDark,
  },
  footerAction: {
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    marginBottom: 24,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    marginBottom: 0,
  },
  restrictedText: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
  },
  restrictedSubText: {
    fontSize: 16,
    color: palette.softText,
    textAlign: 'center',
  },
});
