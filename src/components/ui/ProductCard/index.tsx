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
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.card, { width: cardWidth }]}
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
        </View>

        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>

        <Text style={styles.price}>R$ {product.price.toFixed(2)}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}
