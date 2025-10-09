import { router } from 'expo-router';
import { User } from '@/types/auth';

// Centraliza lógica de redirecionamento após autenticação
export function redirectAfterAuth(user?: User | null) {
  if (!user) return;

  // user.type já é normalizado para 'USER' | 'ADMIN' no useAuth/service
  if (user.type === 'ADMIN') {
    router.replace('/admin/dashboard');
  } else {
    router.replace('/(tabs)/products');
  }
}
