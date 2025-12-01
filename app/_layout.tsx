import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { CartProvider } from '@/contexts/CartContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useSegments, useRootNavigationState } from 'expo-router';
import api from '@/services/api';
import { mlService } from '@/services/mlService';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

function InitialLayout() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  // Wake up the server (Cold Start mitigation)
  useEffect(() => {
    const wakeUpServer = async () => {
      try {
        console.log('Enviando ping para acordar os servidores...');
        // Dispara os pings em paralelo
        Promise.all([
          api.wakeUp(),
          mlService.wakeUp()
        ]);
        console.log('Pings enviados!');
      } catch (error) {
        // Ignora erro, é apenas um ping
        console.log('Ping falhou:', error);
      }
    };
    wakeUpServer();
  }, []);

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
      console.log('Usuário logado na área de auth - redirecionando para products');
      router.replace('/(tabs)/products');
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <CartProvider>
          <InitialLayout />
        </CartProvider>
      </AuthProvider>
    </GestureHandlerRootView>
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