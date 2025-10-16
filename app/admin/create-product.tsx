// app/(tabs)/admin/create-product.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import Toast from 'react-native-toast-message';
import toast from '../../src/utils/toast';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { productService, categoryService } from '@/services/productService';
import { useAuth } from '@/hooks/useAuth';
import apiService, { CategoryDTO } from '@/services/api';
import { Picker } from '@react-native-picker/picker';

const createProductSchema = z.object({
  name: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres').max(100, 'O nome deve ter no máximo 100 caracteres'),
  description: z.string().min(10, 'A descrição deve ter no mínimo 10 caracteres').max(500, 'A descrição deve ter no máximo 500 caracteres'),
  price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, { message: 'O preço deve ser um número positivo' }),
  stock: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0 && Number.isInteger(Number(val)), { message: 'O estoque deve ser um número inteiro não-negativo' }),
  imageUrl: z.string().url('Insira uma URL válida para a imagem'),
  categoryId: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, { message: 'Selecione uma categoria válida' }),
});

type CreateProductFormData = z.infer<typeof createProductSchema>;

export default function CreateProduct() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const { control, handleSubmit, reset, formState: { errors }, getValues, setValue, watch } = useForm<CreateProductFormData>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { name: '', description: '', price: '', stock: '', imageUrl: '', categoryId: '' }
  });

  const selectedCategoryId = watch('categoryId');

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const cats = await categoryService.getAllCategories();
      setCategories(cats);
      if (cats.length === 0) { 
        toast.showInfo('Nenhuma categoria', 'Não há categorias cadastradas.');
        setShowNewCategoryModal(true);
      }
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error);
      toast.showError('Erro ao carregar categorias', 'Não foi possível carregar as categorias.');
      setShowNewCategoryModal(true);
    } finally { setLoadingCategories(false); }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) { 
      toast.showError('Atenção', 'Digite um nome para a categoria'); 
      return; 
    }
    try { 
      setCreatingCategory(true); 
      const newCategory = await categoryService.createCategory(newCategoryName); 
      setCategories(prev => [...prev, newCategory]); 
      setValue('categoryId', String(newCategory.id)); 
      setShowNewCategoryModal(false); 
      setNewCategoryName(''); 
      toast.showSuccess('Sucesso', `Categoria "${newCategory.name}" criada com sucesso!`); 
    } catch (e: any) { 
      console.error(e); 
      toast.showError('Erro', e.message || 'Não foi possível criar a categoria'); 
    } finally { 
      setCreatingCategory(false); 
    }
  };

  const onSubmit = async (data: CreateProductFormData) => {
    setIsLoading(true);
    if (!user || user.type !== 'ADMIN') { 
      setIsLoading(false); 
      toast.showError('Permissão Negada', 'Você precisa ser um administrador para criar produtos.'); 
      return; 
    }
    const selectedCategory = categories.find(cat => cat.id === Number(data.categoryId));
    if (!selectedCategory) { 
      setIsLoading(false); 
      toast.showError('Erro', 'Categoria selecionada não encontrada'); 
      return; 
    }
    try {
      const createdProduct = await productService.createProduct({ 
        name: data.name, 
        description: data.description, 
        price: Number(data.price), 
        stock: Number(data.stock), 
        imageUrl: data.imageUrl, 
        categoryName: selectedCategory.name, 
        categoryId: selectedCategory.id 
      });
      const createdName = (createdProduct && createdProduct.name) || data?.name || 'produto';
      reset(); 
      setValue('categoryId', ''); 
      setNewCategoryName('');
      toast.showSuccess('Produto criado', `Produto "${createdName}" criado com sucesso.`);
      router.back();
    } catch (error: any) {
      console.error('Erro ao criar produto:', error);
      if (error?.status === 403) { 
        toast.showError('Acesso Negado', 'Seu usuário não tem permissão para criar produtos.'); 
      } else { 
        toast.showError('Erro', error.message || 'Não foi possível criar o produto. Tente novamente.'); 
      }
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} disabled={isLoading}>
              <Text style={styles.backButtonText}>← Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Cadastrar Novo Produto</Text>
          </View>

          <View style={styles.form}>
            {/* Nome */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome do Produto *</Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, errors.name && styles.inputError]}
                    placeholder="Ex: Mandala Decorativa"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    editable={!isLoading}
                  />
                )}
              />
              {errors.name && <Text style={styles.errorText}>{errors.name.message}</Text>}
            </View>

            {/* Descrição */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Descrição *</Text>
              <Controller
                control={control}
                name="description"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, styles.textArea, errors.description && styles.inputError]}
                    placeholder="Descreva o produto..."
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    editable={!isLoading}
                  />
                )}
              />
              {errors.description && <Text style={styles.errorText}>{errors.description.message}</Text>}
            </View>

            {/* Preço */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preço (R$) *</Text>
              <Controller
                control={control}
                name="price"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, errors.price && styles.inputError]}
                    placeholder="Ex: 2999.99"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="decimal-pad"
                    editable={!isLoading}
                  />
                )}
              />
              {errors.price && <Text style={styles.errorText}>{errors.price.message}</Text>}
            </View>

            {/* Estoque */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Estoque *</Text>
              <Controller
                control={control}
                name="stock"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, errors.stock && styles.inputError]}
                    placeholder="Ex: 50"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="numeric"
                    editable={!isLoading}
                  />
                )}
              />
              {errors.stock && <Text style={styles.errorText}>{errors.stock.message}</Text>}
            </View>

            {/* URL da Imagem */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>URL da Imagem *</Text>
              <Controller
                control={control}
                name="imageUrl"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.input, errors.imageUrl && styles.inputError]}
                    placeholder="https://exemplo.com/imagem.jpg"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="url"
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                )}
              />
              {errors.imageUrl && <Text style={styles.errorText}>{errors.imageUrl.message}</Text>}
            </View>

            {/* Categoria com Picker */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Categoria *</Text>
                <TouchableOpacity onPress={() => setShowNewCategoryModal(true)} style={styles.newCategoryButton}>
                  <Text style={styles.newCategoryButtonText}>+ Nova Categoria</Text>
                </TouchableOpacity>
              </View>
              
              {loadingCategories ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#FF6B35" />
                  <Text style={styles.loadingText}>Carregando categorias...</Text>
                </View>
              ) : (
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field: { onChange, value } }) => (
                    <View style={[styles.pickerContainer, errors.categoryId && styles.inputError]}>
                      <Picker
                        selectedValue={value}
                        onValueChange={onChange}
                        enabled={!isLoading && categories.length > 0}
                        style={styles.picker}
                      >
                        <Picker.Item label="Selecione uma categoria..." value="" />
                        {React.Children.toArray(
                          categories.map((cat) => (
                            <Picker.Item label={cat.name} value={String(cat.id)} />
                          ))
                        )}
                      </Picker>
                    </View>
                  )}
                />
              )}
              
              {errors.categoryId && <Text style={styles.errorText}>{errors.categoryId.message}</Text>}
            </View>

            {/* Botão de Submit */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Cadastrar Produto</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal para Nova Categoria */}
      <Modal
        visible={showNewCategoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNewCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova Categoria</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Nome da categoria"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              editable={!creatingCategory}
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowNewCategoryModal(false);
                  setNewCategoryName('');
                }}
                disabled={creatingCategory}
              >
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleCreateCategory}
                disabled={creatingCategory || !newCategoryName.trim()}
              >
                {creatingCategory ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>Criar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  keyboardView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 30 },
  backButton: { marginBottom: 15 },
  backButtonText: { fontSize: 16, color: '#FF6B35', fontWeight: '600' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  form: { backgroundColor: '#fff', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  newCategoryButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FF6B35', borderRadius: 6 },
  newCategoryButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fafafa' },
  textArea: { minHeight: 100, paddingTop: 12 },
  inputError: { borderColor: '#ff4444' },
  errorText: { color: '#ff4444', fontSize: 12, marginTop: 4 },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, backgroundColor: '#fafafa', overflow: 'hidden' },
  picker: { height: 50 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fafafa', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  loadingText: { marginLeft: 10, color: '#666' },
  submitButton: { backgroundColor: '#FF6B35', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 10 },
  submitButtonDisabled: { backgroundColor: '#ffb399' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '85%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fafafa', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalButton: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  modalButtonCancel: { backgroundColor: '#f0f0f0' },
  modalButtonConfirm: { backgroundColor: '#FF6B35' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalButtonTextCancel: { color: '#666', fontSize: 16, fontWeight: '600' },
});