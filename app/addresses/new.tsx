import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import toast from '../../src/utils/toast';
import { Input } from '@/components/ui/Input';
import { AddressParts, formatZipCode, sanitizeAddressParts, serializeAddress } from '../../src/utils/address';

const palette = {
  primary: '#00BCD4',
  background: '#F4F6FB',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#94A3B8',
  border: '#E2E8F0',
};

export default function NewAddressScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState<AddressParts>({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
  });
  const [setAsActive, setSetAsActive] = useState(false);

  const handleAddressChange = (key: keyof AddressParts, value: string) => {
    setAddress((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    if (!user) return;

    if (!label.trim()) {
        toast.showError('Erro', 'Dê um nome para este endereço (ex: Casa, Trabalho).');
        return;
    }
    if (!address.street || !address.number || !address.city || !address.state || !address.zipCode) {
        toast.showError('Erro', 'Preencha os campos obrigatórios do endereço.');
        return;
    }

    try {
        setLoading(true);
        const sanitized = sanitizeAddressParts(address);
        const fullAddress = serializeAddress(sanitized);
        
        const newAddressItem = {
            id: Date.now().toString(),
            label: label.trim(),
            fullAddress
        };

        // Save to local storage
        const key = `@saved_addresses_${user.id}`;
        const existingJson = await AsyncStorage.getItem(key);
        const existing = existingJson ? JSON.parse(existingJson) : [];
        const newList = [...existing, newAddressItem];
        await AsyncStorage.setItem(key, JSON.stringify(newList));

        // Set as active if requested
        if (setAsActive) {
            await updateProfile({ address: fullAddress });
            toast.showSuccess('Salvo', 'Endereço salvo e definido como principal.');
        } else {
            toast.showSuccess('Salvo', 'Endereço adicionado à sua lista.');
        }

        router.back();
    } catch (error) {
        console.error(error);
        toast.showError('Erro', 'Falha ao salvar endereço.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Novo Endereço</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.card}>
                <Input
                    label="Nome do local (ex: Casa, Trabalho)"
                    value={label}
                    onChangeText={setLabel}
                    placeholder="Ex: Minha Casa"
                    containerStyle={styles.inputGroup}
                />

                <View style={styles.divider} />
                
                <Input
                    label="CEP"
                    value={formatZipCode(address.zipCode)}
                    onChangeText={(v) => handleAddressChange('zipCode', v.replace(/\D/g, '').slice(0, 8))}
                    keyboardType="numeric"
                    placeholder="00000-000"
                    maxLength={9}
                    containerStyle={styles.inputGroup}
                />
                
                <Input
                    label="Rua / Avenida"
                    value={address.street}
                    onChangeText={(v) => handleAddressChange('street', v)}
                    placeholder="Nome da rua"
                    containerStyle={styles.inputGroup}
                />

                <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Input
                            label="Número"
                            value={address.number}
                            onChangeText={(v) => handleAddressChange('number', v)}
                            placeholder="123"
                            containerStyle={styles.inputGroup}
                        />
                    </View>
                    <View style={{ flex: 2 }}>
                        <Input
                            label="Complemento"
                            value={address.complement}
                            onChangeText={(v) => handleAddressChange('complement', v)}
                            placeholder="Apto 101"
                            containerStyle={styles.inputGroup}
                        />
                    </View>
                </View>

                <Input
                    label="Bairro"
                    value={address.neighborhood}
                    onChangeText={(v) => handleAddressChange('neighborhood', v)}
                    placeholder="Bairro"
                    containerStyle={styles.inputGroup}
                />

                <View style={styles.row}>
                    <View style={{ flex: 2, marginRight: 12 }}>
                        <Input
                            label="Cidade"
                            value={address.city}
                            onChangeText={(v) => handleAddressChange('city', v)}
                            placeholder="Cidade"
                            containerStyle={styles.inputGroup}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Input
                            label="UF"
                            value={address.state}
                            onChangeText={(v) => handleAddressChange('state', v.toUpperCase().slice(0, 2))}
                            placeholder="SP"
                            maxLength={2}
                            autoCapitalize="characters"
                            containerStyle={styles.inputGroup}
                        />
                    </View>
                </View>
            </View>

            <TouchableOpacity 
                style={styles.checkboxContainer} 
                onPress={() => setSetAsActive(!setAsActive)}
                activeOpacity={0.8}
            >
                <View style={[styles.checkbox, setAsActive && styles.checkboxChecked]}>
                    {setAsActive && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </View>
                <Text style={styles.checkboxLabel}>Usar como endereço principal agora</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={[styles.saveButton, loading && styles.disabledButton]}
                onPress={handleSave}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#FFF" />
                ) : (
                    <Text style={styles.saveButtonText}>Salvar Endereço</Text>
                )}
            </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.muted,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  checkboxLabel: {
    fontSize: 16,
    color: palette.text,
  },
  saveButton: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
