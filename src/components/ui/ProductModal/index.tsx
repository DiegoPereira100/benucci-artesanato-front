import React, { useState, useEffect } from "react";
import { Modal, View, Text, Image, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Product } from "@/types/product";
import { styles } from './styles';

type Props = {
  visible: boolean;
  onClose: () => void;
  product: Product | null;
};

export function ProductModal({ visible, onClose, product }: Props) {
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!visible) setQuantity(1);
  }, [visible]);

  if (!product) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            <View style={styles.headerImage}>
              {product.image_url ? (
                <Image
                  source={{ uri: product.image_url }}
                  style={styles.image}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.image, { justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontSize: 40 }}>🎨</Text>
                </View>
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Text style={styles.name}>{product.name}</Text>
              <Text style={styles.price}>R$ {product.price.toFixed(2)}</Text>
              <Text style={styles.description}>{product.description}</Text>

              <View style={styles.qtyRow}>
                <TouchableOpacity onPress={() => setQuantity(q => Math.max(1, q - 1))} style={styles.qtyBtn}>
                  <Ionicons name="remove" size={20} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.qty}>{quantity}</Text>
                <TouchableOpacity onPress={() => setQuantity(q => q + 1)} style={styles.qtyBtn}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cartBtn} onPress={() => {
                // TODO: integrar com lógica de carrinho
                console.log("Adicionar ao carrinho", { productId: product.id, quantity });
                onClose();
              }}>
                <Text style={styles.cartText}>Adicionar ao carrinho</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
