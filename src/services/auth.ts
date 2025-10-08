// src/services/auth.ts
import apiService from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoginRequest, RegisterRequest, AuthResponse, User } from '../types/auth';

class AuthService {
  // Decodifica JWT e retorna dados básicos
  private decodeJWT(token: string): Partial<User> | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));

      console.log('📋 Payload do JWT decodificado:', payload);

      return {
        id: payload.id,
        email: payload.sub || payload.email,
        name: payload.name || '',
        type: payload.type || 'CUSTOMER',
        // não assumimos address/cpf/phoneNumber no JWT
      };
    } catch (error) {
      console.error('❌ Erro ao decodificar JWT:', error);
      return null;
    }
  }

  // Busca perfil completo no backend
  private async fetchUserProfile(userId: number): Promise<User | null> {
    try {
      console.log('🔍 fetchUserProfile -> GET /users/' + userId);
      const response = await apiService.instance.get(`/users/${userId}`);
      console.log('✅ fetchUserProfile response.status:', response.status);
      console.log('✅ fetchUserProfile data:', response.data);
      return response.data as User;
    } catch (error: any) {
      console.error('❌ Erro ao buscar perfil do usuário:', error?.response?.status, error?.message);
      // tentar recuperar do storage como último recurso
      try {
        console.log('🔄 fetchUserProfile fallback: tentando recuperar do AsyncStorage');
        const existing = await this.getUser();
        if (existing && existing.id === userId) {
          console.log('✅ fetchUserProfile fallback encontrou usuário no storage');
          return existing;
        }
      } catch (e) {
        console.error('❌ Erro no fallback do fetchUserProfile:', e);
      }
      return null;
    }
  }

  // Mescla dados: preserva campos válidos existentes se updates tiver valores vazios
  private mergeUserData(existing: User | null, updates: Partial<User>): User {
    if (!existing) {
      return {
        id: updates.id || 0,
        email: updates.email || '',
        name: updates.name || '',
        type: updates.type || 'CUSTOMER',
        cpf: updates.cpf || '',
        phoneNumber: updates.phoneNumber || '',
        address: updates.address || '',
      };
    }

    return {
      ...existing,
      ...updates,
      // preserva campos importantes quando o update é vazio/undefined
      address: (updates.address !== undefined && updates.address !== null && updates.address !== '') ? updates.address : existing.address,
      cpf: (updates.cpf !== undefined && updates.cpf !== null && updates.cpf !== '') ? updates.cpf : existing.cpf,
      phoneNumber: (updates.phoneNumber !== undefined && updates.phoneNumber !== null && updates.phoneNumber !== '') ? updates.phoneNumber : existing.phoneNumber,
    };
  }

  // saveUser agora MESCLA com dados existentes para evitar sobrescrever com campos vazios
  async saveUser(user: User): Promise<void> {
    try {
      console.log('💾 saveUser called. Candidate to save:', user);

      const existingRaw = await AsyncStorage.getItem('@user_data');
      const existing: User | null = existingRaw ? JSON.parse(existingRaw) : null;

      const finalUser = this.mergeUserData(existing, user);

      console.log('🔄 saveUser -> final merged object that will be saved:', finalUser);

      await AsyncStorage.setItem('@user_data', JSON.stringify(finalUser));

      // verificação imediata
      const verify = await AsyncStorage.getItem('@user_data');
      const verifiedUser = verify ? JSON.parse(verify) : null;
      console.log('✅ saveUser verification - Dados salvos:', verifiedUser);
      console.log('📍 Endereço verificado:', verifiedUser?.address);
    } catch (error) {
      console.error('❌ ERRO CRÍTICO ao salvar usuário:', error);
    }
  }

  async getUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem('@user_data');
      if (userData) {
        const user = JSON.parse(userData) as User;
        console.log('✅ getUser -> Usuário recuperado do storage:', user);
        console.log('📍 Endereço recuperado:', user.address);
        return user;
      }
      console.log('⚠️ getUser -> Nenhum usuário no storage');
      return null;
    } catch (error) {
      console.error('❌ Erro ao buscar dados do usuário:', error);
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await apiService.getToken();
    const isAuth = !!token;
    console.log('🔍 isAuthenticated:', isAuth);
    return isAuth;
  }

  async getToken(): Promise<string | null> {
    return await apiService.getToken();
  }

  // Atualiza parcialmente os dados do usuário (usa merge interno)
  async updateUserData(updates: Partial<User>): Promise<User | null> {
    try {
      const currentUser = await this.getUser();
      if (!currentUser) {
        console.error('❌ updateUserData: nenhum usuário logado para atualizar');
        return null;
      }
      const updatedUser = this.mergeUserData(currentUser, updates);
      await this.saveUser(updatedUser);
      console.log('✅ Dados do usuário atualizados:', updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('❌ Erro ao atualizar dados do usuário:', error);
      return null;
    }
  }

  // LOGIN robusto
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      console.log('🔐 login -> iniciando...');
      const existingUser = await this.getUser();
      console.log('👤 existingUser (antes do login):', existingUser);

      const response = await apiService.instance.post('/auth/login', credentials);
      console.log('📥 login response.data:', response.data);

      // Possíveis formatos:
      // 1) { token: '...' , user: { ... } }
      // 2) 'jwt-token-string'
      // 3) { token: '...' }
      // 4) { id: ..., email: ..., ... } (usuário)
      // 5) { user: {...} }

      // Caso 1: objeto com token e possivelmente user
      if (response.data && typeof response.data === 'object') {
        if (response.data.token) {
          const token = response.data.token as string;
          console.log('💾 login -> recebendo token string do backend');
          await apiService.saveToken(token);

          // tenta decodificar e obter id
          const basic = this.decodeJWT(token);
          if (basic?.id) {
            const full = await this.fetchUserProfile(basic.id);
            if (full) {
              console.log('✅ login -> perfil completo obtido após token');
              await this.saveUser(full);
              return { token, user: full };
            } else {
              console.warn('⚠️ login -> não foi possível obter perfil completo, usando fallback com merge');
              const fallback = this.mergeUserData(existingUser, {
                id: basic.id,
                email: basic.email || credentials.email,
                name: basic.name || '',
                type: basic.type || 'CUSTOMER'
              });
              await this.saveUser(fallback);
              return { token, user: fallback };
            }
          } else {
            console.warn('⚠️ login -> token decodificado não possui id, salvando token e mantendo user existente');
            return { token, user: existingUser || null };
          }
        }

        // Se response.data.user existe (backend retornou o user diretamente)
        if (response.data.user) {
          const userFromBackend = response.data.user as User;
          console.log('✅ login -> backend retornou user dentro do body');
          // Se houver id, tentamos buscar completo (garante endereço atualizado)
          if (userFromBackend.id) {
            const full = await this.fetchUserProfile(userFromBackend.id);
            const toSave = full || userFromBackend;
            await this.saveUser(toSave);
            // se response.data.token também existe, salve
            if (response.data.token) {
              await apiService.saveToken(response.data.token);
            }
            return { token: response.data.token || (await apiService.getToken()) || '', user: toSave };
          } else {
            await this.saveUser(userFromBackend);
            return { token: (await apiService.getToken()) || '', user: userFromBackend };
          }
        }

        // Se response.data parece ser o próprio user
        if (response.data.id && response.data.email) {
          const userFromBackend = response.data as User;
          console.log('✅ login -> backend retornou user diretamente no body (sem token)');
          // se houver token salvo, mantemos; caso contrário, não criamos token automaticamente aqui (aproach seguro)
          const currentToken = await apiService.getToken();
          await this.saveUser(userFromBackend);
          return { token: currentToken || '', user: userFromBackend };
        }
      }

      // Caso 2: backend retornou string (jwt)
      if (typeof response.data === 'string') {
        const token = response.data as string;
        console.log('💾 login -> backend retornou string JWT diretamente');
        await apiService.saveToken(token);
        const basic = this.decodeJWT(token);
        if (basic?.id) {
          const full = await this.fetchUserProfile(basic.id);
          if (full) {
            await this.saveUser(full);
            return { token, user: full };
          } else {
            const fallback = this.mergeUserData(existingUser, {
              id: basic.id,
              email: basic.email || credentials.email,
              name: basic.name || '',
              type: basic.type || 'CUSTOMER'
            });
            await this.saveUser(fallback);
            return { token, user: fallback };
          }
        } else {
          return { token, user: existingUser || null };
        }
      }

      throw new Error('Formato de resposta inválido no login');
    } catch (error: any) {
      console.error('❌ Erro no login:', error?.response?.data || error.message || error);
      if (error.response) {
        throw new Error(error.response.data?.message || 'Erro ao fazer login');
      }
      throw new Error('Erro de conexão com o servidor');
    }
  }

  // REGISTER robusto
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      console.log('📝 register -> iniciando com:', userData);

      const response = await apiService.instance.post('/auth/register', userData);
      console.log('📥 register response.data:', response.data);

      // Se backend forneceu token
      if (response.data && typeof response.data === 'object' && response.data.token) {
        const token = response.data.token as string;
        console.log('💾 register -> token recebido');
        await apiService.saveToken(token);

        const basic = this.decodeJWT(token);
        if (basic?.id) {
          const full = await this.fetchUserProfile(basic.id);
          if (full) {
            await this.saveUser(full);
            return { token, user: full };
          } else {
            // fallback: usa dados do registro (preserva address do form)
            const userToSave: User = {
              id: basic.id,
              email: basic.email || userData.email,
              name: basic.name || userData.name,
              type: basic.type || 'CUSTOMER',
              cpf: userData.cpf || '',
              phoneNumber: userData.phoneNumber || '',
              address: userData.address || '',
            };
            await this.saveUser(userToSave);
            return { token, user: userToSave };
          }
        } else {
          // salvamos token, e usamos os dados do response.user se existir
          if (response.data.user) {
            const userFromBackend: User = response.data.user;
            await this.saveUser(userFromBackend);
            return { token, user: userFromBackend };
          }
          return { token, user: null };
        }
      }

      // Se backend retornou user sem token
      if (response.data && typeof response.data === 'object' && response.data.id) {
        console.log('⚠️ register -> backend retornou usuário sem token');
        const userFromBackend: User = {
          id: response.data.id,
          email: response.data.email || userData.email,
          name: response.data.name || userData.name,
          type: response.data.type || 'CUSTOMER',
          cpf: response.data.cpf || userData.cpf || '',
          phoneNumber: response.data.phoneNumber || userData.phoneNumber || '',
          address: response.data.address || userData.address || '',
        };
        await this.saveUser(userFromBackend);

        // Gerar token temporário (se realmente necessário) — manter compatibilidade
        const tempToken = btoa(JSON.stringify({ id: userFromBackend.id, email: userFromBackend.email }));
        await apiService.saveToken(tempToken);
        return { token: tempToken, user: userFromBackend };
      }

      // Fallback completo: criar user local preservando address do registro
      console.log('⚠️ register -> fallback completo');
      const fallbackUser: User = {
        id: Date.now(),
        email: userData.email,
        name: userData.name,
        type: 'CUSTOMER',
        cpf: userData.cpf || '',
        phoneNumber: userData.phoneNumber || '',
        address: userData.address || '',
      };
      await this.saveUser(fallbackUser);
      const tempToken = btoa(JSON.stringify({ id: fallbackUser.id, email: fallbackUser.email }));
      await apiService.saveToken(tempToken);
      return { token: tempToken, user: fallbackUser };
    } catch (error: any) {
      console.error('❌ Erro no register:', error?.response?.data || error.message || error);
      if (error.response) {
        throw new Error(error.response.data?.message || 'Erro ao cadastrar usuário');
      }
      throw new Error('Erro de conexão com o servidor');
    }
  }

  async logout(): Promise<void> {
    try {
      console.log('👋 logout -> iniciando...');
      await apiService.removeToken();
      await AsyncStorage.removeItem('@user_data');
      console.log('✅ logout -> finalizado');
    } catch (error) {
      console.error('❌ Erro no logout:', error);
    }
  }
}

export default new AuthService();
