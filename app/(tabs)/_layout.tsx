// app/(tabs)/_layout.tsx

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';

// Componente para o badge do carrinho
function TabBarBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { totalItems } = useCart();
  const { user } = useAuth();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarIconStyle: {
          marginBottom: -4,
        },
        headerStyle: {
          backgroundColor: '#2196F3',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >

      {/* explore tab removed: using products as the catalog screen */}

      {/* NOVA TAB DO CARRINHO */}
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Carrinho',
          tabBarLabel: 'Carrinho',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="cart-outline" size={size} color={color} />
              <TabBarBadge count={totalItems} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarLabel: 'Perfil',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="products"
        options={{
          title: 'Produtos',
          tabBarLabel: 'Produtos',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size + 2} color={color} />
          ),
        }}
      />

      {/* Admin tab - only register it for admin users so it doesn't appear at all for regular users */}
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
          headerShown: false,
          href: user?.type === 'ADMIN' ? '/admin' : null, // Oculta a tab se não for admin
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size + 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -8,
    top: -4,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});