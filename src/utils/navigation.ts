import { router } from 'expo-router';
import { User } from '@/types/auth';

// Centraliza lógica de redirecionamento após autenticação
export function redirectAfterAuth(user?: User | null) {
  if (!user) return;

  // user.type já é normalizado para 'USER' | 'ADMIN' no useAuth/service
  if (user.type === 'ADMIN') {
    // Send admins to the admin screen inside the tabs group so the bottom Tabs are shown
    router.replace('/(tabs)/admin');
  } else {
    router.replace('/(tabs)/products');
  }
}
