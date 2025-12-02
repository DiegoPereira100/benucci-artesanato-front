import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import toast from '../../src/utils/toast';
import { formatAddressSummary, parseAddress } from '../../src/utils/address';

const palette = {
  primary: '#00BCD4',
  background: '#F4F6FB',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#94A3B8',
  border: '#E2E8F0',
  success: '#16A34A',
};

interface LocalAddress {
  id: string;
  label: string; // e.g., "Casa", "Trabalho"
  fullAddress: string;
}

export default function AddressesScreen() {
  const router = useRouter();
  const { user, updateProfile, refreshUser } = useAuth();
  const [savedAddresses, setSavedAddresses] = useState<LocalAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  const loadSavedAddresses = useCallback(async () => {
    if (!user) return;
    try {
      const key = `@saved_addresses_${user.id}`;
      const json = await AsyncStorage.getItem(key);
      if (json) {
        setSavedAddresses(JSON.parse(json));
      }
    } catch (error) {
      console.error('Erro ao carregar endereços salvos:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSavedAddresses();
  }, [loadSavedAddresses]);

  // Reload when coming back from "new address" screen
  useEffect(() => {
    const unsubscribe = router.canGoBack() ? undefined : undefined; 
    // Expo router focus effect would be better, but simple reload on mount is ok for now.
    // We will rely on onFocus or a refresh trigger if needed.
  }, []);
  
  // Simple focus listener workaround
  // In a real app, use useFocusEffect from expo-router/navigation

  const handleSetAsActive = async (address: LocalAddress) => {
    if (!user) return;
    
    // Check if it's already active
    if (user.address === address.fullAddress) {
        toast.showInfo('Já ativo', 'Este já é seu endereço principal.');
        return;
    }

    Alert.alert(
      'Definir como principal',
      `Deseja usar "${address.label}" como seu endereço de entrega atual?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, Definir',
          onPress: async () => {
            try {
              setActivating(address.id);
              await updateProfile({ address: address.fullAddress });
              toast.showSuccess('Atualizado', 'Endereço principal atualizado com sucesso.');
              await refreshUser();
            } catch (error) {
              toast.showError('Erro', 'Falha ao atualizar endereço principal.');
            } finally {
              setActivating(null);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Excluir endereço',
      'Tem certeza que deseja remover este endereço da sua lista?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const newList = savedAddresses.filter(a => a.id !== id);
            setSavedAddresses(newList);
            if (user) {
                await AsyncStorage.setItem(`@saved_addresses_${user.id}`, JSON.stringify(newList));
            }
            toast.showSuccess('Removido', 'Endereço removido da lista.');
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: LocalAddress }) => {
    const isActive = user?.address === item.fullAddress;
    const summary = formatAddressSummary(parseAddress(item.fullAddress));

    return (
      <TouchableOpacity
        style={[styles.card, isActive && styles.activeCard]}
        onPress={() => handleSetAsActive(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.labelContainer}>
            <Ionicons 
                name={isActive ? "location" : "location-outline"} 
                size={20} 
                color={isActive ? palette.primary : palette.muted} 
            />
            <Text style={[styles.label, isActive && styles.activeLabel]}>{item.label}</Text>
            {isActive && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>Principal</Text>
                </View>
            )}
          </View>
          {!isActive && (
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.addressText}>{summary}</Text>
        {activating === item.id && (
            <ActivityIndicator size="small" color={palette.primary} style={{ marginTop: 8 }} />
        )}
      </TouchableOpacity>
    );
  };

  // Add current backend address to saved list if not present
  const syncCurrentAddress = async () => {
      if (!user || !user.address) return;
      
      const exists = savedAddresses.some(a => a.fullAddress === user.address);
      if (!exists) {
          const newAddr: LocalAddress = {
              id: Date.now().toString(),
              label: 'Meu Endereço',
              fullAddress: user.address
          };
          const newList = [newAddr, ...savedAddresses];
          setSavedAddresses(newList);
          await AsyncStorage.setItem(`@saved_addresses_${user.id}`, JSON.stringify(newList));
      }
  };

  useEffect(() => {
      if (!loading && user?.address) {
          syncCurrentAddress();
      }
  }, [loading, user?.address]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Meus Endereços</Text>
        <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/addresses/new')}
        >
            <Ionicons name="add" size={24} color={palette.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={savedAddresses}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={64} color={palette.muted} />
            <Text style={styles.emptyText}>Nenhum endereço salvo.</Text>
            <Text style={styles.emptySubText}>Adicione endereços para facilitar suas compras.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backButton: {
    padding: 8,
  },
  addButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  activeCard: {
    borderColor: palette.primary,
    backgroundColor: '#F0FDFA',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  activeLabel: {
    color: palette.primary,
  },
  badge: {
    backgroundColor: palette.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  deleteBtn: {
    padding: 4,
  },
  addressText: {
    fontSize: 14,
    color: palette.muted,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.text,
  },
  emptySubText: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
  },
});
