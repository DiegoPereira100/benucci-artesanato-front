import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { CategoryDTO } from '@/services/api';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  product?: any | null; // ProductDTO
  categories: CategoryDTO[];
  loading?: boolean;
  onCancel: () => void;
  onSave: (payload: any) => void;
};

export default function ProductEditModal({ visible, product, categories, loading, onCancel, onSave }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setDescription(product.description || '');
      setPrice(String(product.price ?? ''));
      setStock(String(product.stock ?? ''));
      setCategoryId(product.category?.id ? String(product.category.id) : '');
    } else {
      setName('');
      setDescription('');
      setPrice('');
      setStock('');
      setCategoryId('');
    }
  }, [product]);

  const handleSave = () => {
    onSave({
      name,
      description,
      price: Number(price),
      stock: Number(stock),
      categoryId: Number(categoryId)
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Editar Produto</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00BCD4" />
              <Text style={styles.loadingText}>Salvando alterações...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <Input 
                label="Nome do Produto" 
                value={name} 
                onChangeText={setName} 
                placeholder="Ex: Mandala Azul"
              />
              
              <Input 
                label="Descrição" 
                value={description} 
                onChangeText={setDescription} 
                multiline 
                numberOfLines={3}
                placeholder="Descreva o produto..."
                style={{ height: 80, textAlignVertical: 'top' }}
              />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Input 
                    label="Preço (R$)" 
                    value={price} 
                    onChangeText={setPrice} 
                    keyboardType="decimal-pad" 
                    placeholder="0.00"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Input 
                    label="Estoque" 
                    value={stock} 
                    onChangeText={setStock} 
                    keyboardType="numeric" 
                    placeholder="0"
                  />
                </View>
              </View>

              <Text style={styles.label}>Categoria</Text>
              <View style={styles.pickerContainer}>
                <Picker 
                  selectedValue={categoryId} 
                  onValueChange={(v) => setCategoryId(String(v))}
                  style={styles.picker}
                >
                  <Picker.Item label="Selecione uma categoria..." value="" color="#999" />
                  {categories.map(c => (
                    <Picker.Item key={c.id} label={c.name} value={String(c.id)} color="#333" />
                  ))}
                </Picker>
              </View>

              <View style={styles.buttonsRow}>
                <TouchableOpacity style={[styles.button, styles.cancel]} onPress={onCancel}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.button, styles.confirm]} onPress={handleSave}>
                  <Text style={styles.confirmText}>Salvar Alterações</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20
  },
  content: { 
    backgroundColor: '#fff', 
    width: '100%', 
    maxWidth: 500,
    borderRadius: 20, 
    padding: 24,
    maxHeight: '90%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 16,
  },
  title: { 
    fontSize: 22, 
    fontWeight: '700', 
    color: '#333' 
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    marginBottom: 8, 
    color: '#444',
    marginLeft: 4,
  },
  pickerContainer: { 
    borderWidth: 1, 
    borderColor: '#E0E0E0', 
    borderRadius: 12, 
    overflow: 'hidden', 
    backgroundColor: '#F8F9FA',
    marginBottom: 20,
    height: 56,
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  halfInput: {
    flex: 1,
  },
  buttonsRow: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    marginTop: 12,
    gap: 12,
  },
  button: { 
    paddingVertical: 14, 
    paddingHorizontal: 24, 
    borderRadius: 12, 
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { 
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  confirm: { 
    backgroundColor: '#00BCD4',
    shadowColor: "#00BCD4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelText: { 
    color: '#666', 
    fontWeight: '600',
    fontSize: 16,
  },
  confirmText: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 16,
  },
});
