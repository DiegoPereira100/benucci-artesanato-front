import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Product } from '@/types/product';

type Props = {
  products: Product[];
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
};

export default function ProductList({ products, onEdit, onDelete }: Props) {
  const items = products.map((p) => (
    <View key={p.id} style={styles.listItem}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{p.name}</Text>
          <Text style={styles.itemSubtitle}>R$ {p.price} • Estoque: {p.stock}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.smallButton} onPress={() => onEdit(p.id)}>
            <Text style={styles.smallButtonText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallButton, styles.deleteButton]} onPress={() => { console.log('ProductList: delete clicked for', p.id); onDelete(p.id); }}>
            <Text style={[styles.smallButtonText, { color: '#fff' }]}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ));

  return <View>{React.Children.toArray(items)}</View>;
}

const styles = StyleSheet.create({
  listItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  itemSubtitle: {
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  smallButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: {
    color: '#FF6B35',
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#f44336',
    borderColor: '#f44336',
  },
});
