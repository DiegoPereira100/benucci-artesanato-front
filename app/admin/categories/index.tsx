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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import ConfirmModal from '@/components/ui/ConfirmModal';
import toast from '../../../src/utils/toast';
import {
  categoryService,
  CategoryDTO,
  SubcategoryDTO,
  ThemeDTO,
} from '@/services/categoryService';

const palette = {
  background: '#F4F6FB',
  surface: '#FFFFFF',
  border: '#E4E9F2',
  primary: '#00BCD4',
  primaryDark: '#0397A8',
  accent: '#00BCD4',
  text: '#0F172A',
  softText: '#475569',
  muted: '#94A3B8',
  danger: '#DC2626',
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
  { key: 'assignments', label: 'Vinculações', icon: 'link-outline' },
];

const sortByName = <T extends { name?: string | null }>(a: T, b: T) =>
  (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR', { sensitivity: 'base' });

export default function CategoryManagementScreen() {
  const router = useRouter();
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
      <Ionicons name="cube-outline" size={32} color={palette.muted} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );

  const renderCategoryTab = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Categorias</Text>
        <Text style={styles.sectionSubtitle}>Organize as macro áreas dos produtos.</Text>
      </View>
      <View style={styles.sectionActionRow}>
        <TouchableOpacity
          style={[styles.primaryButton, styles.actionButtonFull]}
          onPress={() => openModal({ type: 'category', mode: 'create' })}
        >
          <Ionicons name="add" size={18} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.primaryButtonText}>Nova categoria</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, styles.actionButtonFull, categoriesLoading && styles.disabledButton]}
          disabled={categoriesLoading}
          onPress={loadCategories}
        >
          {categoriesLoading ? (
            <ActivityIndicator color={palette.text} style={styles.buttonIcon} />
          ) : (
            <Ionicons name="refresh-outline" size={16} color={palette.text} style={styles.buttonIcon} />
          )}
          <Text style={styles.secondaryButtonText}>Atualizar lista</Text>
        </TouchableOpacity>
      </View>
      {categoriesLoading ? (
        <ActivityIndicator color={palette.primary} />
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
              <TouchableOpacity onPress={() => openModal({ type: 'category', mode: 'edit', entity: category })}>
                <Ionicons name="create-outline" size={20} color={palette.softText} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete({ type: 'category', entity: category })}>
                <Ionicons name="trash-outline" size={20} color={palette.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      ) : (
        renderEmptyState('Nenhuma categoria cadastrada ainda.')
      )}
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
          <Text style={styles.sectionTitle}>Subcategorias</Text>
          <Text style={styles.sectionSubtitle}>Especifique linhas dentro de cada categoria.</Text>
        </View>
        <View style={styles.sectionActionRow}>
          <TouchableOpacity
            style={[styles.primaryButton, styles.actionButtonFull, (!currentCategoryId || !sortedCategories.length) && styles.disabledButton]}
            disabled={!currentCategoryId || !sortedCategories.length}
            onPress={() =>
              currentCategoryId &&
              openModal({ type: 'subcategory', mode: 'create', categoryId: currentCategoryId })
            }
          >
            <Ionicons name="add" size={18} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>Nova subcategoria</Text>
          </TouchableOpacity>
        </View>

        {sortedCategories.length ? (
          <>
            {renderCategoryFilter(currentCategoryId, (id) => setSubCategoryFilterId(id), 'Categoria')} 
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => currentCategoryId && ensureSubcategories(currentCategoryId, true)}
            >
              <Ionicons name="refresh-outline" size={16} color={palette.softText} />
              <Text style={styles.refreshButtonText}>Atualizar lista</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {!currentCategoryId ? (
          renderEmptyState('Cadastre ao menos uma categoria para seguir.')
        ) : isLoading ? (
          <ActivityIndicator color={palette.primary} />
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
    );
  };

  const renderThemesTab = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Temas</Text>
        <Text style={styles.sectionSubtitle}>Crie variações temáticas reutilizáveis.</Text>
      </View>
      <View style={styles.sectionActionRow}>
        <TouchableOpacity
          style={[styles.primaryButton, styles.actionButtonFull]}
          onPress={() => openModal({ type: 'theme', mode: 'create' })}
        >
          <Ionicons name="add" size={18} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.primaryButtonText}>Novo tema</Text>
        </TouchableOpacity>
      </View>

      {themesLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : sortedThemes.length ? (
        sortedThemes.map((theme) => (
          <View key={theme.id} style={styles.entityRow}>
            <View style={styles.entityInfo}>
              <Text style={styles.entityName}>{theme.name}</Text>
              {theme.description ? <Text style={styles.entityDescription}>{theme.description}</Text> : null}
            </View>
            <View style={styles.rowActions}>
              <TouchableOpacity onPress={() => openModal({ type: 'theme', mode: 'edit', entity: theme })}>
                <Ionicons name="create-outline" size={20} color={palette.softText} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete({ type: 'theme', entity: theme })}>
                <Ionicons name="trash-outline" size={20} color={palette.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      ) : (
        renderEmptyState('Nenhum tema cadastrado ainda.')
      )}
    </View>
  );

  const renderAssignmentsTab = () => {
    const currentCategoryId = assignmentCategoryId;
    const currentSubcategories = currentCategoryId ? subcategoriesByCategory[currentCategoryId] || [] : [];
    const subcategoryLoading = currentCategoryId ? subcategoriesLoading[currentCategoryId] : false;

    return (
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Vincular temas</Text>
          <Text style={styles.sectionSubtitle}>Associe temas às subcategorias para controlar o catálogo.</Text>
        </View>
        <View style={styles.sectionActionRow}>
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              styles.actionButtonFull,
              (!assignmentSubcategoryId || assignmentFetching) && styles.disabledButton,
            ]}
            disabled={!assignmentSubcategoryId || assignmentFetching}
            onPress={() => assignmentSubcategoryId && refreshAssignmentSelection(assignmentSubcategoryId)}
          >
            <Ionicons name="refresh-outline" size={16} color={palette.text} style={styles.buttonIcon} />
            <Text style={styles.secondaryButtonText}>Sincronizar</Text>
          </TouchableOpacity>
        </View>

        {sortedCategories.length ? (
          renderCategoryFilter(currentCategoryId, (id) => setAssignmentCategoryId(id), 'Categoria')
        ) : (
          renderEmptyState('Cadastre uma categoria para começar.')
        )}

        {currentCategoryId && (
          <>
            <Text style={styles.filterLabel}>Subcategoria</Text>
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
                        <Text style={[styles.subcategoryDescription, isActive && styles.subcategoryDescriptionActive]}>
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
          </>
        )}

        {assignmentSubcategoryId && !sortedThemes.length ? (
          renderEmptyState('Cadastre temas antes de realizar vinculações.')
        ) : assignmentSubcategoryId ? (
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
                    name={isSelected ? 'checkbox-outline' : 'square-outline'}
                    size={18}
                    color={isSelected ? '#fff' : palette.softText}
                  />
                  <View style={styles.themeTextWrapper}>
                    <Text style={[styles.themeName, isSelected && styles.themeNameSelected]}>{theme.name}</Text>
                    {theme.description ? (
                      <Text style={[styles.themeDescription, isSelected && styles.themeDescriptionSelected]}>
                        {theme.description}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {assignmentSubcategoryId ? (
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
              <Ionicons name="save-outline" size={18} color="#fff" />
            )}
            <Text style={styles.primaryButtonText}>Salvar vinculações</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const renderModal = () => (
    <Modal visible={!!modalConfig} animationType="slide" transparent onRequestClose={closeModal}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {modalConfig?.mode === 'edit' ? 'Editar' : 'Criar'}{' '}
            {modalConfig?.type === 'category'
              ? 'categoria'
              : modalConfig?.type === 'subcategory'
                ? 'subcategoria'
                : 'tema'}
          </Text>

          <Text style={styles.inputLabel}>Nome</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite o nome"
            value={modalName}
            onChangeText={setModalName}
          />

          <Text style={styles.inputLabel}>Descrição (opcional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Conte um pouco sobre este item"
            value={modalDescription}
            onChangeText={setModalDescription}
            multiline
            numberOfLines={3}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.secondaryButton, styles.modalButton]} onPress={closeModal} disabled={modalSaving}>
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
      </View>
    </Modal>
  );

  if (authLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={palette.accent} />
      </SafeAreaView>
    );
  }

  if (!user || user.type !== 'ADMIN') {
    return (
      <SafeAreaView style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={32} color={palette.danger} />
        <Text style={styles.restrictedText}>Apenas administradores podem acessar esta área.</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Gerenciamento de categorias</Text>
            <Text style={styles.subtitle}>
              Controle categorias, subcategorias, temas e vinculações em um só lugar.
            </Text>
          </View>
        </View>

        <View style={styles.tabsRow}>
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
                  size={16}
                  color={isActive ? palette.text : palette.muted}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
    paddingBottom: 48,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: palette.softText,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: 14,
    padding: 6,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    gap: 1,
  },
  tabButtonActive: {
    backgroundColor: '#E0F7FA',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.muted,
  },
  tabLabelActive: {
    color: palette.text,
  },
  sectionCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
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
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: palette.softText,
    lineHeight: 20,
  },
  sectionActionRow: {
    width: '100%',
    marginBottom: 16,
  },
  actionButtonFull: {
    width: '100%',
    justifyContent: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
    backgroundColor: palette.primary,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
  },
  secondaryButtonText: {
    color: palette.text,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
  entityRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  entityInfo: {
    flex: 1,
  },
  entityName: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
  },
  entityDescription: {
    marginTop: 4,
    color: palette.softText,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    color: palette.softText,
    textAlign: 'center',
  },
  filterContainer: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.softText,
    marginBottom: 8,
  },
  filterScroll: {
    paddingRight: 12,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#E0F7FA',
    borderColor: palette.primary,
  },
  filterChipText: {
    color: palette.softText,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: palette.text,
  },
  refreshButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 12,
  },
  refreshButtonText: {
    color: palette.softText,
    fontWeight: '600',
  },
  subcategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  subcategoryCard: {
    flexBasis: '48%',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    minWidth: 140,
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
    color: palette.text,
  },
  subcategoryDescription: {
    marginTop: 4,
    color: palette.softText,
    fontSize: 12,
  },
  subcategoryDescriptionActive: {
    color: palette.text,
  },
  themeGrid: {
    gap: 12,
    marginBottom: 18,
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
  },
  themePillSelected: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  themeTextWrapper: {
    flex: 1,
  },
  themeName: {
    fontWeight: '600',
    color: palette.text,
  },
  themeNameSelected: {
    color: '#fff',
  },
  themeDescription: {
    marginTop: 2,
    color: palette.softText,
    fontSize: 12,
  },
  themeDescriptionSelected: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: palette.text,
  },
  inputLabel: {
    fontWeight: '600',
    color: palette.softText,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    color: palette.text,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    minHeight: 90,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  modalButton: {
    minWidth: 120,
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.background,
    gap: 12,
    padding: 20,
  },
  restrictedText: {
    fontSize: 16,
    color: palette.softText,
    textAlign: 'center',
  },
});
