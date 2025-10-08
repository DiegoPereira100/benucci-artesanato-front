import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

export default function Welcome() {
  const router = useRouter();
  const { user } = useAuth();

  const handleStart = () => {
    console.log('=== BOTÃO COMEÇAR CLICADO ===');
    console.log('User:', user);
    
    try {
      if (user) {
        console.log('Usuário logado - redirecionando para home');
        router.replace('/(tabs)/products');
      } else {
        console.log('Usuário não logado - redirecionando para login');
        router.replace('/auth/login');
      }
    } catch (error) {
      console.error('Erro na navegação:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Image
        style={styles.waveTop}
        source={require('@/assets/images/wavesbg.png')}
      />
      <View style={styles.content}>
        <Text style={styles.title}>Decore sua área de conforto!!</Text>
        <Image
          style={styles.logo}
          source={require('@/assets/images/logo_benucci_arte.png')}
        />
        <TouchableOpacity 
          onPress={handleStart}
          activeOpacity={0.7}
        >
          <Button
            title='Começar'
            onPress={handleStart}
          />
        </TouchableOpacity>
      </View>
      <Image
        style={styles.waveBottom}
        source={require('@/assets/images/wavesbg.png')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    position: 'relative',
  },
  waveTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: 250,
    resizeMode: 'stretch',
    transform: [{ scaleY: -1 }, { scaleX: -1 }],
    zIndex: -1,
  },
  waveBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: 250,
    resizeMode: 'stretch',
    zIndex: -1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  title: {
    fontSize: 22,
    marginBottom: 40,
    textAlign: 'center',
    color: '#333',
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 50,
    resizeMode: 'contain',
  }
});