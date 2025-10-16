import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { CartProvider } from '@/contexts/CartContext'; // ← ADICIONAR ESTA LINHA
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useSegments, useRootNavigationState } from 'expo-router';

function InitialLayout() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    console.log('=== DEBUG _LAYOUT ===');
    console.log('navigationState?.key:', navigationState?.key);
    console.log('isLoading:', isLoading);
    console.log('user:', user);
    console.log('segments:', segments);

    if (!navigationState?.key || isLoading) {
      console.log('Saindo early - navigationState ou isLoading');
      return;
    }

    const inAuthGroup = segments[0] === 'auth';
    const inTabsGroup = segments[0] === '(tabs)';
    const inIndexPage = segments[0] === 'index' || segments[0] === undefined;

    console.log('inAuthGroup:', inAuthGroup);
    console.log('inTabsGroup:', inTabsGroup);
    console.log('inIndexPage:', inIndexPage);

    // APENAS redireciona se usuário logado está na área de auth
    if (user && inAuthGroup) {
      console.log('Usuário logado na área de auth - redirecionando para home');
      router.replace('/(tabs)/home');
      return;
    }

    // APENAS redireciona se não está logado e tenta acessar área protegida
    if (!user && inTabsGroup) {
      console.log('Usuário não logado tentando acessar área protegida - redirecionando para index');
      router.replace('/');
      return;
    }

    // Não interfere em outras navegações
    console.log('Permitindo navegação normal');

  }, [user, segments, navigationState?.key, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider children={undefined}>
      {/* ← ADICIONAR O CARTPROVIDER AQUI */}
      <CartProvider children={undefined}>
        <InitialLayout />
      </CartProvider>
      {/* ← FIM DO CARTPROVIDER */}
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});