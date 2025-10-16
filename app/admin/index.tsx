import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function AdminIndex() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // If user is admin, redirect to the tabbed admin path. Otherwise send to products.
    if (user && user.type === 'ADMIN') {
      router.replace('/(tabs)/admin');
    } else {
      router.replace('/(tabs)/products');
    }
  }, [user, isLoading]);

  return null;
}
