import React, { useEffect, useState } from 'react';
import AdminDashboard from '../admin/dashboard';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export const unstable_settings = {
  title: 'Dashboard',
  headerShown: false,
};

export default function AdminTabWrapper() {
  const { user, isLoading } = useAuth();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  useEffect(() => {
    // Aguarda o carregamento da autenticação
    if (isLoading) return;

    // Marca que já verificou a autenticação
    if (!hasCheckedAuth) {
      setHasCheckedAuth(true);
    }

    // Se não é admin, redireciona
    if (!user || user.type !== 'ADMIN') {
      router.replace('/(tabs)/products');
    }
  }, [user, isLoading, hasCheckedAuth]);

  // Enquanto carrega a autenticação, mostra um loading
  if (isLoading || !hasCheckedAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  // Não é admin - não renderiza nada (o redirect já foi feito)
  if (!user || user.type !== 'ADMIN') {
    return null;
  }

  // É admin - renderiza o dashboard
  return <AdminDashboard />;
}