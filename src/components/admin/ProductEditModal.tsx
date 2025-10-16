import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { CategoryDTO } from '@/services/api';

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
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setPrice(String(product.price ?? ''));
      setStock(String(product.stock ?? ''));
      setCategoryId(product.category?.id ? String(product.category.id) : '');
    } else {
      setName('');
      setPrice('');
      setStock('');
      setCategoryId('');
    }
  }, [product]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Editar Produto</Text>
          {loading ? (
            <ActivityIndicator color="#FF6B35" />
          ) : (
            <View>
              <Text style={styles.label}>Nome</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} />

              <Text style={styles.label}>Preço</Text>
              <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />

              <Text style={styles.label}>Estoque</Text>
              <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="numeric" />

              <Text style={styles.label}>Categoria</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={categoryId} onValueChange={(v) => setCategoryId(String(v))}>
                  <Picker.Item label="Selecione..." value="" />
                  {React.Children.toArray(
                    categories.map(c => (
                      <Picker.Item label={c.name} value={String(c.id)} />
                    ))
                  )}
                </Picker>
              </View>

              <View style={styles.buttonsRow}>
                <TouchableOpacity style={[styles.button, styles.cancel]} onPress={onCancel}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.confirm]} onPress={() => onSave({ name, price: Number(price), stock: Number(stock), categoryId })}>
                  <Text style={styles.confirmText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  content: { backgroundColor: '#fff', width: '90%', borderRadius: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginTop: 6, backgroundColor: '#fafafa' },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginTop: 6, overflow: 'hidden', backgroundColor: '#fafafa' },
  buttonsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  button: { padding: 12, borderRadius: 8, marginLeft: 8 },
  cancel: { backgroundColor: '#f0f0f0' },
  confirm: { backgroundColor: '#FF6B35' },
  cancelText: { color: '#666', fontWeight: '600' },
  confirmText: { color: '#fff', fontWeight: '700' },
});
