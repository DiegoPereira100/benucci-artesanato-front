import React from "react";
import { TouchableOpacity, View, Text, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Product } from "@/types/product";
import { styles } from "./styles";

type Props = {
  product: Product;
  onPress: () => void;
  cardWidth: number;
};

export function ProductCard({ product, onPress, cardWidth }: Props) {
  const classificationLabel = React.useMemo(() => {
    const categoryLabel = product.category?.trim() || 'Sem categoria';
    const subcategoryLabel = product.subcategoryName?.trim();
    if (subcategoryLabel) {
      return `${categoryLabel} - ${subcategoryLabel}`;
    }
    return categoryLabel;
  }, [product.category, product.subcategoryName]);

  const isOutOfStock = product.stock === 0;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.card, { width: cardWidth, opacity: isOutOfStock ? 0.7 : 1 }]}
      onPress={onPress}
    >
      <LinearGradient colors={["#E3F2FD", "#E0F7FA"]} style={styles.gradient}>
        <View style={styles.imageWrapper}>
          {product.image_url ? (
            <Image
              source={{ uri: product.image_url }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>🎨</Text>
            </View>
          )}
          {isOutOfStock && (
            <View style={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: '#FF5252',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              zIndex: 10,
            }}>
              <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>ESGOTADO</Text>
            </View>
          )}
        </View>

        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>

        <Text style={styles.meta} numberOfLines={2}>
          {classificationLabel}
        </Text>

        <Text style={styles.price}>R$ {product.price.toFixed(2)}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}
