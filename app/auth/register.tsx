import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import toast from '../../src/utils/toast';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AddressParts, sanitizeAddressParts, serializeAddress, formatZipCode } from '../../src/utils/address';
import { RegisterRequest } from '@/types/auth';

// Função para validar CPF
const validateCPF = (cpf: string) => {
  cpf = cpf.replace(/[^\d]/g, '');

  if (cpf.length !== 11) return false;

  // Elimina CPFs conhecidos como inválidos
  if (/^(\d)\1+$/.test(cpf)) return false;

  // Validação do primeiro dígito
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(9), 10)) return false;

  // Validação do segundo dígito
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(10), 10)) return false;

  return true;
};

// Esquema de validação
const addressSchema = z.object({
  street: z.string().min(1, 'Rua é obrigatória'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional().or(z.literal('')),
  neighborhood: z.string().min(1, 'Bairro é obrigatório'),
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().regex(/^[A-Za-z]{2}$/, 'UF deve ter 2 letras'),
  zipCode: z.string().regex(/^\d{8}$/, 'CEP deve conter 8 dígitos'),
});

const registerSchema = z.object({
  name: z.string()
    .min(1, 'Nome é obrigatório')
    .min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string()
    .email('Email inválido')
    .min(1, 'Email é obrigatório'),
  cpf: z.string()
    .min(1, 'CPF é obrigatório')
    .regex(/^\d{11}$/, 'CPF deve conter 11 dígitos')
    .refine(validateCPF, 'CPF inválido'),
  password: z.string()
    .min(1, 'Senha é obrigatória')
    .min(3, 'Senha deve ter no mínimo 3 caracteres'),
  confirmPassword: z.string()
    .min(1, 'Confirmação de senha é obrigatória'),
  phoneNumber: z.string()
    .min(1, 'Telefone é obrigatório')
    .regex(/^\d{10,11}$/, 'Telefone deve ter 10 ou 11 dígitos'),
  address: addressSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const { register, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      cpf: '',
      password: '',
      confirmPassword: '',
      phoneNumber: '',
      address: {
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        zipCode: '',
      },
    },
  });

  const addressErrors = errors.address as Partial<Record<keyof AddressParts, { message?: string }>> | undefined;

  // Formatar CPF enquanto digita
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
    }
    return value.slice(0, 14);
  };

  // Formatar telefone enquanto digita
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{4})\d+?$/, '$1');
    }
    return value.slice(0, 15);
  };

  async function handleRegister(data: RegisterFormData) {
    try {
      console.log('=== INICIANDO CADASTRO ===');
      setIsLoading(true);

      const { confirmPassword, address, ...rest } = data;
      const cleanedCpf = rest.cpf.replace(/\D/g, '');
      const cleanedPhone = rest.phoneNumber.replace(/\D/g, '');
      const sanitizedAddress = sanitizeAddressParts(address);
      const serializedAddress = serializeAddress(sanitizedAddress);

      // Força o tipo USER
      const payload: RegisterRequest = {
        ...rest,
        cpf: cleanedCpf,
        phoneNumber: cleanedPhone,
        address: serializedAddress,
        type: 'USER',
        role: 'USER',
      };

      await register(payload);

      Alert.alert(
        'Cadastro Realizado!',
        'Sua conta foi criada com sucesso.',
        [
          {
            text: 'OK',
            onPress: () => {
              setTimeout(() => {
                if (!user) {
                  router.replace('/auth/login');
                }
              }, 500);
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('=== ERRO NO CADASTRO ===');
      console.error('Erro:', error.message);
      toast.showError('Erro no Cadastro', error.message || 'Não foi possível criar sua conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Image
        style={styles.waveTop}
        source={require('@/assets/images/wavesbg.png')}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Criar Conta</Text>
            <Text style={styles.subtitle}>Preencha os dados abaixo</Text>
          </View>

          <View style={styles.logoContainer}>
            <Image
              style={styles.logo}
              source={require('@/assets/images/logo_benucci_arte.png')}
            />
          </View>

          <View style={styles.card}>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Nome Completo"
                  placeholder="João Silva"
                  autoCapitalize="words"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isLoading}
                  error={errors.name?.message}
                  containerStyle={styles.inputContainer}
                />
              )}
            />

            <Controller
              control={control}
              name="cpf"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="CPF"
                  placeholder="123.456.789-00"
                  keyboardType="numeric"
                  onBlur={onBlur}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/\D/g, '');
                    onChange(cleaned);
                    setValue('cpf', cleaned);
                  }}
                  value={formatCPF(value || '')}
                  editable={!isLoading}
                  maxLength={14}
                  error={errors.cpf?.message}
                  containerStyle={styles.inputContainer}
                />
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email"
                  placeholder="seu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isLoading}
                  error={errors.email?.message}
                  containerStyle={styles.inputContainer}
                />
              )}
            />

            <Controller
              control={control}
              name="phoneNumber"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Telefone"
                  placeholder="(11) 99999-9999"
                  keyboardType="phone-pad"
                  onBlur={onBlur}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/\D/g, '');
                    onChange(cleaned);
                    setValue('phoneNumber', cleaned);
                  }}
                  value={formatPhone(value || '')}
                  editable={!isLoading}
                  maxLength={15}
                  error={errors.phoneNumber?.message}
                  containerStyle={styles.inputContainer}
                />
              )}
            />

            <Text style={styles.groupLabel}>Endereço</Text>

            <Controller
              control={control}
              name="address.street"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Rua"
                  placeholder="Rua Exemplo"
                  autoCapitalize="words"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value || ''}
                  editable={!isLoading}
                  error={addressErrors?.street?.message}
                  containerStyle={styles.inputContainer}
                />
              )}
            />

            <View style={styles.rowContainer}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Controller
                  control={control}
                  name="address.number"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Número"
                      placeholder="123"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value || ''}
                      editable={!isLoading}
                      error={addressErrors?.number?.message}
                      containerStyle={styles.inputContainer}
                    />
                  )}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Controller
                  control={control}
                  name="address.zipCode"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="CEP"
                      placeholder="00000-000"
                      keyboardType="numeric"
                      maxLength={9}
                      onBlur={onBlur}
                      onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 8))}
                      value={formatZipCode(value || '')}
                      editable={!isLoading}
                      error={addressErrors?.zipCode?.message}
                      containerStyle={styles.inputContainer}
                    />
                  )}
                />
              </View>
            </View>

            <Controller
              control={control}
              name="address.complement"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Complemento"
                  placeholder="Apartamento, bloco, etc."
                  autoCapitalize="sentences"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value || ''}
                  editable={!isLoading}
                  error={addressErrors?.complement?.message}
                  containerStyle={styles.inputContainer}
                />
              )}
            />

            <Controller
              control={control}
              name="address.neighborhood"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Bairro"
                  placeholder="Centro"
                  autoCapitalize="words"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value || ''}
                  editable={!isLoading}
                  error={addressErrors?.neighborhood?.message}
                  containerStyle={styles.inputContainer}
                />
              )}
            />

            <View style={styles.rowContainer}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Controller
                  control={control}
                  name="address.city"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Cidade"
                      placeholder="São Paulo"
                      autoCapitalize="words"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value || ''}
                      editable={!isLoading}
                      error={addressErrors?.city?.message}
                      containerStyle={styles.inputContainer}
                    />
                  )}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Controller
                  control={control}
                  name="address.state"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="UF"
                      placeholder="SP"
                      autoCapitalize="characters"
                      maxLength={2}
                      onBlur={onBlur}
                      onChangeText={(text) => onChange(text.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2))}
                      value={(value || '').toUpperCase()}
                      editable={!isLoading}
                      error={addressErrors?.state?.message}
                      containerStyle={styles.inputContainer}
                    />
                  )}
                />
              </View>
            </View>

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Senha"
                  placeholder="Digite sua senha"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isLoading}
                  error={errors.password?.message}
                  containerStyle={styles.inputContainer}
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirmar Senha"
                  placeholder="Digite a senha novamente"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isLoading}
                  error={errors.confirmPassword?.message}
                  containerStyle={styles.inputContainer}
                />
              )}
            />

            <Button
              title="Cadastrar"
              onPress={handleSubmit(handleRegister)}
              isLoading={isLoading}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Já tem uma conta? </Text>
              <Link href="/auth/login" asChild>
                <TouchableOpacity disabled={isLoading}>
                  <Text style={styles.linkText}>
                    Faça login
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
    backgroundColor: '#f8f9fa',
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
    paddingBottom: 100, // Extra padding for bottom wave
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  inputContainer: {
    marginBottom: 16,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#00BCD4',
    marginTop: 10,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  inputError: {
    borderColor: '#f44336',
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
  },
  loadingContainer: {
    backgroundColor: '#00BCD4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  linkText: {
    color: '#00BCD4',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
