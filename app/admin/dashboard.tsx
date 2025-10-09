import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace('/');
  }

  function handleCreateProduct() {
    console.log('Navegando para tela de criação de produto...');
    router.push('/admin/create-product');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard do Administrador</Text>
          <Text style={styles.subtitle}>Bem-vindo, {user?.name}!</Text>
        </View>

        <View style={styles.content}>
          {/* Informações do usuário */}
          <View style={styles.infoCard}>
            <Text style={styles.info}>Role: {user?.type}</Text>
            <Text style={styles.info}>Email: {user?.email}</Text>
          </View>

          {/* NOVO: Botão de Cadastrar Produto */}
          <TouchableOpacity
            style={styles.createProductButton}
            onPress={handleCreateProduct}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.buttonIcon}>➕</Text>
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonTitle}>Cadastrar Novo Produto</Text>
                <Text style={styles.buttonSubtitle}>
                  Adicione produtos ao catálogo
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Outras ações rápidas (opcional - exemplo) */}
          <View style={styles.quickActionsCard}>
            <Text style={styles.cardTitle}>Ações Rápidas</Text>
            <TouchableOpacity style={styles.quickActionButton}>
              <Text style={styles.quickActionText}>📦 Ver Produtos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton}>
              <Text style={styles.quickActionText}>📋 Ver Pedidos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton}>
              <Text style={styles.quickActionText}>👥 Ver Usuários</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Botão de Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Sair</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
  content: {
    flex: 1,
    gap: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  info: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  // NOVO: Estilos para o botão de cadastrar produto
  createProductButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  buttonSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  // Card de ações rápidas
  quickActionsCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  quickActionButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  // Botão de logout
  logoutButton: {
    backgroundColor: '#f44336',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});