import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import toast from '../../src/utils/toast';
import { UpdateUserRequest, User } from '@/types/auth';
import { Input } from '@/components/ui/Input';

type FormState = {
  name: string;
  email: string;
  cpf: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
};

const buildInitialForm = (source?: Partial<User>): FormState => {
  return {
    name: source?.name ?? '',
    email: source?.email ?? '',
    cpf: (source?.cpf ?? '').replace(/\D/g, ''),
    phoneNumber: (source?.phoneNumber ?? '').replace(/\D/g, ''),
    password: '',
    confirmPassword: '',
  };
};

const getInitials = (name?: string) => {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const formatCPF = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  }
  return numbers.slice(0, 11);
};

const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 11) {
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  }
  return numbers.slice(0, 11);
};

export default function ProfileScreen() {
  const { user, logout, refreshUser, updateProfile } = useAuth();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormState>(buildInitialForm(user || undefined));
  const refreshInFlightRef = useRef(false);
  const userRef = useRef<User | null>(user);
  const refreshUserRef = useRef(refreshUser);

  const syncForm = useCallback((source: User | null | undefined) => {
    setFormData(buildInitialForm(source ?? undefined));
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    refreshUserRef.current = refreshUser;
  }, [refreshUser]);

  const loadProfile = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    setLoading(true);
    try {
      const latest = await refreshUserRef.current?.();
      if (latest) {
        syncForm(latest);
      } else if (userRef.current) {
        syncForm(userRef.current);
      }
    } catch (error) {
      console.error('ProfileScreen -> erro ao carregar perfil', error);
      toast.showError('Erro', 'Não foi possível carregar seus dados.');
    } finally {
      refreshInFlightRef.current = false;
      setLoading(false);
    }
  }, [syncForm]);

  useEffect(() => {
    if (isFocused) {
      loadProfile();
    }
  }, [isFocused, loadProfile]);

  useEffect(() => {
    if (!isEditing) {
      syncForm(user);
    }
  }, [user, syncForm, isEditing]);

  const handleChange = (key: keyof FormState, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggleEdit = () => {
    if (isEditing) {
      syncForm(user);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast.showError('Erro', 'Você precisa estar autenticado para atualizar o perfil.');
      return;
    }

    if (!formData.name.trim()) {
      toast.showError('Campo obrigatório', 'Informe seu nome completo.');
      return;
    }

    if (!formData.email.trim()) {
      toast.showError('Campo obrigatório', 'Informe um e-mail válido.');
      return;
    }

    const updates: UpdateUserRequest = {};

    if (formData.name.trim() !== (user.name ?? '').trim()) {
      updates.name = formData.name.trim();
    }
    if (formData.email.trim().toLowerCase() !== (user.email ?? '').toLowerCase()) {
      updates.email = formData.email.trim();
    }
    const normalizedCpf = (user.cpf ?? '').replace(/\D/g, '');
    if (formData.cpf !== normalizedCpf) {
      updates.cpf = formData.cpf;
    }
    const normalizedPhone = (user.phoneNumber ?? '').replace(/\D/g, '');
    if (formData.phoneNumber !== normalizedPhone) {
      updates.phoneNumber = formData.phoneNumber;
    }

    if (formData.password || formData.confirmPassword) {
      if (formData.password !== formData.confirmPassword) {
        toast.showError('Erro', 'As senhas informadas não coincidem.');
        return;
      }
      if (formData.password.length < 6) {
        toast.showError('Senha inválida', 'A nova senha deve ter pelo menos 6 caracteres.');
        return;
      }
      updates.password = formData.password;
    }

    if (Object.keys(updates).length === 0) {
      toast.showInfo('Sem alterações', 'Nenhuma alteração foi detectada.');
      setIsEditing(false);
      setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      return;
    }

    try {
      setSaving(true);
      const updated = await updateProfile(updates);
      if (updated) {
        toast.showSuccess('Perfil atualizado', 'Suas alterações foram salvas com sucesso.');
        syncForm(updated);
      } else {
        toast.showInfo('Atenção', 'Não foi possível atualizar o perfil.');
      }
      setIsEditing(false);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Erro ao atualizar seu perfil.';
      toast.showError('Erro', message);
      console.error('ProfileScreen -> erro ao salvar perfil', error);
    } finally {
      setSaving(false);
      setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.showInfo('Desconectado', 'Você foi desconectado com sucesso.');
      router.replace('/');
    } catch (error) {
      console.error('Erro ao deslogar:', error);
      toast.showError('Erro', 'Falha ao deslogar. Tente novamente.');
    }
  };

  if (!loading && !user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Ionicons name="person-circle-outline" size={72} color="#91A4FF" />
          <Text style={styles.emptyTitle}>Faça login para acessar seu perfil</Text>
          <Text style={styles.emptySubtitle}>
            Entre com sua conta para visualizar e editar seus dados pessoais.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.primaryButtonText}>Ir para Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileHeader}>
            <LinearGradient colors={['#00BCD4', '#00BCD4']} style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(formData.name || user?.name)}</Text>
            </LinearGradient>
            <Text style={styles.name}>{formData.name || user?.email}</Text>
            <Text style={styles.email}>{formData.email}</Text>
            {loading && (
              <View style={styles.loadingInline}>
                <ActivityIndicator size="small" color="#00BCD4" />
                <Text style={styles.loadingInlineText}>Atualizando perfil...</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Informações pessoais</Text>
              {user && (
                <TouchableOpacity onPress={handleToggleEdit}>
                  <Text style={styles.sectionAction}>{isEditing ? 'Cancelar' : 'Editar'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {renderInput('Nome completo', 'name', {
              value: formData.name,
              onChangeText: (value) => handleChange('name', value),
              editable: isEditing,
            })}
            {renderInput('E-mail', 'email', {
              value: formData.email,
              onChangeText: (value) => handleChange('email', value),
              editable: isEditing,
              keyboardType: 'email-address',
              autoCapitalize: 'none',
            })}
            {renderInput('CPF', 'cpf', {
              value: formatCPF(formData.cpf),
              onChangeText: (value) => handleChange('cpf', value.replace(/\D/g, '')),
              editable: isEditing,
              keyboardType: 'numeric',
              autoCapitalize: 'none',
              maxLength: 14,
            })}
            {renderInput('Telefone', 'phoneNumber', {
              value: formatPhone(formData.phoneNumber),
              onChangeText: (value) => handleChange('phoneNumber', value.replace(/\D/g, '')),
              editable: isEditing,
              keyboardType: 'phone-pad',
              autoCapitalize: 'none',
              maxLength: 15,
            })}

            {isEditing && (
              <View style={styles.divider} />
            )}

            {isEditing && (
              <>
                {renderInput('Nova senha', 'password', {
                  value: formData.password,
                  onChangeText: (value) => handleChange('password', value),
                  editable: true,
                  secureTextEntry: true,
                  placeholder: 'Deixe em branco para manter a atual',
                })}
                {renderInput('Confirmar nova senha', 'confirmPassword', {
                  value: formData.confirmPassword,
                  onChangeText: (value) => handleChange('confirmPassword', value),
                  editable: true,
                  secureTextEntry: true,
                })}
              </>
            )}

            {isEditing && (
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                activeOpacity={0.85}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Salvar alterações</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.quickSection}>
            <Text style={styles.quickTitle}>Atalhos rápidos</Text>
            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => router.push('/orders')}
            >
              <Ionicons name="receipt-outline" size={20} color="#00BCD4" />
              <View style={styles.quickTextWrapper}>
                <Text style={styles.quickItemTitle}>Histórico de pedidos</Text>
                <Text style={styles.quickItemSubtitle}>Acompanhe suas compras recentes</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9AA1AD" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => router.push('/addresses')}
            >
              <Ionicons name="home-outline" size={20} color="#00BCD4" />
              <View style={styles.quickTextWrapper}>
                <Text style={styles.quickItemTitle}>Endereços salvos</Text>
                <Text style={styles.quickItemSubtitle}>Cadastre e atualize seus endereços</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9AA1AD" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={20} color="#F44336" />
            <Text style={styles.logoutText}>Sair da conta</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type InputOptions = {
  value: string;
  onChangeText: (value: string) => void;
  editable: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  secureTextEntry?: boolean;
  placeholder?: string;
  maxLength?: number;
};

const renderInput = (
  label: string,
  key: string,
  options: InputOptions
) => {
  return (
    <Input
      key={key}
      label={label}
      value={options.value}
      onChangeText={options.onChangeText}
      editable={options.editable}
      placeholder={options.placeholder}
      keyboardType={options.keyboardType}
      autoCapitalize={options.autoCapitalize ?? 'sentences'}
      autoCorrect={false}
      multiline={options.multiline}
      secureTextEntry={options.secureTextEntry}
      maxLength={options.maxLength}
      containerStyle={styles.inputGroup}
      style={options.multiline ? styles.inputMultiline : undefined}
    />
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F6FB',
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2933',
    marginBottom: 4,
    textAlign: 'center',
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  loadingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  loadingInlineText: {
    fontSize: 13,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#1018281A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2933',
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00BCD4',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputMultiline: {
    minHeight: 80,
  },
  divider: {
    height: 1,
    backgroundColor: '#EEF2F7',
    marginVertical: 12,
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: '#00BCD4',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quickSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#1018281A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2933',
    marginBottom: 12,
  },
  quickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  quickTextWrapper: {
    flex: 1,
  },
  quickItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2933',
  },
  quickItemSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F44336',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2933',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#00BCD4',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});