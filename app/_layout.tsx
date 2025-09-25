import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack>
        <Stack.Screen 
          name="index" 
          options={{ 
            title: 'Início',
            headerShown: true 
          }} 
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="profile" 
          options={{ 
            title: 'Perfil',
            presentation: 'modal'
          }} 
        />
      </Stack>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}