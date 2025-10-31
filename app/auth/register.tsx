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
import { AddressParts, sanitizeAddressParts, serializeAddress, formatZipCode } from '../../src/utils/address';
import { RegisterRequest } from '@/types/auth';

// Tipos de usuário - ajustado para corresponder ao backend
type UserType = 'user' | 'admin';

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

// Esquema de validação - ajustado para usar lowercase
const addressSchema = z.object({
  street: z.string().min(1, 'Rua é obrigatória'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z
    .string()
    .optional()
    .or(z.literal('')),
  neighborhood: z.string().min(1, 'Bairro é obrigatório'),
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z
    .string()
    .regex(/^[A-Za-z]{2}$/, 'UF deve ter 2 letras'),
  zipCode: z
    .string()
    .regex(/^\d{8}$/, 'CEP deve conter 8 dígitos'),
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
  type: z.enum(['user', 'admin']), // Mudado para lowercase
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const { register, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState<UserType>('user'); // Mudado para lowercase

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
      type: 'user', // Mudado para lowercase
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

  // Função para obter a cor do tema baseada no tipo de usuário
  const getThemeColor = () => {
    return selectedUserType === 'admin' ? '#FF6B35' : '#00BCD4';
  };

  async function handleRegister(data: RegisterFormData) {
    try {
      console.log('=== INICIANDO CADASTRO ===');
      console.log('Tipo de usuário selecionado:', selectedUserType);
      setIsLoading(true);

      const { confirmPassword, address, type, ...rest } = data;
      const cleanedCpf = rest.cpf.replace(/\D/g, '');
      const cleanedPhone = rest.phoneNumber.replace(/\D/g, '');
      const sanitizedAddress = sanitizeAddressParts(address);
      const serializedAddress = serializeAddress(sanitizedAddress);

      // Backend expects type in uppercase ('USER' | 'ADMIN'), convert before sending
      const payload: RegisterRequest = {
        ...rest,
        cpf: cleanedCpf,
        phoneNumber: cleanedPhone,
        address: serializedAddress,
        type: type === 'admin' ? 'ADMIN' : 'USER',
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

          {/* Seletor de Tipo de Usuário */}
          <View style={styles.userTypeSelector}>
            <TouchableOpacity
              style={[
                styles.userTypeButton,
                styles.userTypeButtonLeft,
                selectedUserType === 'user' && {
                  ...styles.userTypeButtonActive,
                  backgroundColor: getThemeColor(),
                },
              ]}
              onPress={() => {
                setSelectedUserType('user');
                setValue('type', 'user');
                console.log('Tipo selecionado: user');
              }}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.userTypeButtonText,
                  selectedUserType === 'user' && styles.userTypeButtonTextActive,
                ]}
              >
                Sou Cliente
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.userTypeButton,
                styles.userTypeButtonRight,
                selectedUserType === 'admin' && {
                  ...styles.userTypeButtonActive,
                  backgroundColor: getThemeColor(),
                },
              ]}
              onPress={() => {
                setSelectedUserType('admin');
                setValue('type', 'admin');
                console.log('Tipo selecionado: admin');
              }}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.userTypeButtonText,
                  selectedUserType === 'admin' && styles.userTypeButtonTextActive,
                ]}
              >
                Sou Admin
              </Text>
            </TouchableOpacity>
          </View>

          {/* Indicador visual do tipo selecionado */}
          <View style={styles.typeIndicator}>
            <Text style={styles.typeIndicatorText}>
              Cadastrando como: {selectedUserType === 'admin' ? 'Administrador' : 'Cliente'}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nome Completo</Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      errors.name && styles.inputError,
                      !errors.name && { borderColor: getThemeColor() },
                    ]}
                    placeholder="João Silva"
                    autoCapitalize="words"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isLoading}
                  />
                )}
              />
              {errors.name && (
                <Text style={styles.errorText}>{errors.name.message}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>CPF</Text>
              <Controller
                control={control}
                name="cpf"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      errors.cpf && styles.inputError,
                      !errors.cpf && { borderColor: getThemeColor() },
                    ]}
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
                  />
                )}
              />
              {errors.cpf && (
                <Text style={styles.errorText}>{errors.cpf.message}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      errors.email && styles.inputError,
                      !errors.email && { borderColor: getThemeColor() },
                    ]}
                    placeholder="seu@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isLoading}
                  />
                )}
              />
              {errors.email && (
                <Text style={styles.errorText}>{errors.email.message}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Telefone</Text>
              <Controller
                control={control}
                name="phoneNumber"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      errors.phoneNumber && styles.inputError,
                      !errors.phoneNumber && { borderColor: getThemeColor() },
                    ]}
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
                  />
                )}
              />
              {errors.phoneNumber && (
                <Text style={styles.errorText}>{errors.phoneNumber.message}</Text>
              )}
            </View>

            <Text style={styles.groupLabel}>Endereço</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Rua</Text>
              <Controller
                control={control}
                name="address.street"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      addressErrors?.street && styles.inputError,
                      !addressErrors?.street && { borderColor: getThemeColor() },
                    ]}
                    placeholder="Rua Exemplo"
                    autoCapitalize="words"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value || ''}
                    editable={!isLoading}
                  />
                )}
              />
              {addressErrors?.street?.message && (
                <Text style={styles.errorText}>{addressErrors.street.message}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Número</Text>
              <Controller
                control={control}
                name="address.number"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      addressErrors?.number && styles.inputError,
                      !addressErrors?.number && { borderColor: getThemeColor() },
                    ]}
                    placeholder="123"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value || ''}
                    editable={!isLoading}
                  />
                )}
              />
              {addressErrors?.number?.message && (
                <Text style={styles.errorText}>{addressErrors.number.message}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Complemento</Text>
              <Controller
                control={control}
                name="address.complement"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      addressErrors?.complement && styles.inputError,
                      !addressErrors?.complement && { borderColor: getThemeColor() },
                    ]}
                    placeholder="Apartamento, bloco, etc."
                    autoCapitalize="sentences"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value || ''}
                    editable={!isLoading}
                  />
                )}
              />
              {addressErrors?.complement?.message && (
                <Text style={styles.errorText}>{addressErrors.complement.message}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Bairro</Text>
              <Controller
                control={control}
                name="address.neighborhood"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      addressErrors?.neighborhood && styles.inputError,
                      !addressErrors?.neighborhood && { borderColor: getThemeColor() },
                    ]}
                    placeholder="Centro"
                    autoCapitalize="words"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value || ''}
                    editable={!isLoading}
                  />
                )}
              />
              {addressErrors?.neighborhood?.message && (
                <Text style={styles.errorText}>{addressErrors.neighborhood.message}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Cidade</Text>
              <Controller
                control={control}
                name="address.city"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      addressErrors?.city && styles.inputError,
                      !addressErrors?.city && { borderColor: getThemeColor() },
                    ]}
                    placeholder="São Paulo"
                    autoCapitalize="words"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value || ''}
                    editable={!isLoading}
                  />
                )}
              />
              {addressErrors?.city?.message && (
                <Text style={styles.errorText}>{addressErrors.city.message}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Estado (UF)</Text>
              <Controller
                control={control}
                name="address.state"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      addressErrors?.state && styles.inputError,
                      !addressErrors?.state && { borderColor: getThemeColor() },
                    ]}
                    placeholder="SP"
                    autoCapitalize="characters"
                    maxLength={2}
                    onBlur={onBlur}
                    onChangeText={(text) => onChange(text.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2))}
                    value={(value || '').toUpperCase()}
                    editable={!isLoading}
                  />
                )}
              />
              {addressErrors?.state?.message && (
                <Text style={styles.errorText}>{addressErrors.state.message}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>CEP</Text>
              <Controller
                control={control}
                name="address.zipCode"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      addressErrors?.zipCode && styles.inputError,
                      !addressErrors?.zipCode && { borderColor: getThemeColor() },
                    ]}
                    placeholder="00000-000"
                    keyboardType="numeric"
                    maxLength={9}
                    onBlur={onBlur}
                    onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 8))}
                    value={formatZipCode(value || '')}
                    editable={!isLoading}
                  />
                )}
              />
              {addressErrors?.zipCode?.message && (
                <Text style={styles.errorText}>{addressErrors.zipCode.message}</Text>
              )}
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Tipo de Conta</Text>
              <Controller
                control={control}
                name="type"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.radioContainer}>
                    <TouchableOpacity
                      style={styles.radioOption}
                      onPress={() => onChange('user')}
                      disabled={isLoading}
                    >
                      <View style={[styles.radio, value === 'user' && styles.radioSelected]}>
                        {value === 'user' && <View style={styles.radioInner} />}
                      </View>
                      <Text style={styles.radioText}>Cliente</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.radioOption}
                      onPress={() => onChange('admin')}
                      disabled={isLoading}
                    >
                      <View style={[styles.radio, value === 'admin' && styles.radioSelected]}>
                        {value === 'admin' && <View style={styles.radioInner} />}
                      </View>
                      <Text style={styles.radioText}>Administrador</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Senha</Text>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      errors.password && styles.inputError,
                      !errors.password && { borderColor: getThemeColor() },
                    ]}
                    placeholder="Digite sua senha"
                    secureTextEntry
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isLoading}
                  />
                )}
              />
              {errors.password && (
                <Text style={styles.errorText}>{errors.password.message}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirmar Senha</Text>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[
                      styles.input,
                      errors.confirmPassword && styles.inputError,
                      !errors.confirmPassword && { borderColor: getThemeColor() },
                    ]}
                    placeholder="Digite a senha novamente"
                    secureTextEntry
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isLoading}
                  />
                )}
              />
              {errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword.message}</Text>
              )}
            </View>

            {isLoading ? (
              <View style={{
                backgroundColor: '#00BCD4',
                padding: 16,
                borderRadius: 8,
                alignItems: 'center',
                marginTop: 20,
              }}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <Button
                title="Cadastrar"
                onPress={handleSubmit(handleRegister)}
                disabled={isLoading}
              />
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>Já tem uma conta? </Text>
              <Link href="/auth/login" asChild>
                <TouchableOpacity disabled={isLoading}>
                  <Text style={[styles.linkText, { color: getThemeColor() }]}>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
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
  userTypeSelector: {
    flexDirection: 'row',
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  userTypeButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  userTypeButtonLeft: {
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  userTypeButtonRight: {
    borderLeftWidth: 1,
    borderLeftColor: '#ddd',
  },
  userTypeButtonActive: {
    borderColor: 'transparent',
  },
  userTypeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  userTypeButtonTextActive: {
    color: '#fff',
  },
  typeIndicator: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  typeIndicatorText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
  },
  groupLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#00BCD4',
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
  registerButton: {
    backgroundColor: '#00BCD4',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#00BCD4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: '#00BCD4',
    borderColor: '#00BCD4',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  radioText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
});