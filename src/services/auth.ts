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

      // Prioriza 'type' do JWT, depois 'role' (removendo ROLE_), default 'USER'
      let userType: 'USER' | 'ADMIN' = 'USER';
      
      if (payload.type) {
        userType = payload.type.toUpperCase() as 'USER' | 'ADMIN';
      } else if (payload.role) {
        const cleanRole = payload.role.replace('ROLE_', '').toUpperCase();
        userType = cleanRole as 'USER' | 'ADMIN';
      }

      return {
        id: payload.id,
        email: payload.sub || payload.email,
        name: payload.name || '',
        type: userType,
      };
    } catch (error) {
      console.error('❌ Erro ao decodificar JWT:', error);
      return null;
    }
  }

  // Verifica se o token tem o formato JWT (3 partes separadas por '.')
  private isJwt(token: string | null | undefined): boolean {
    if (!token) return false;
    const parts = token.split('.');
    return parts.length === 3;
  }

  // Busca perfil completo no backend
  private async fetchUserProfile(userId: number): Promise<User | null> {
    try {
      console.log('🔍 fetchUserProfile -> GET /users/' + userId);
      const response = await apiService.instance.get(`/users/${userId}`);
      console.log('✅ fetchUserProfile response:', response.data);
      
      const user = response.data as User;
      
      // Normaliza o type recebido do backend
      if (user.type) {
        user.type = user.type.toUpperCase() as 'USER' | 'ADMIN';
      }
      
      return user;
    } catch (error: any) {
      console.error('❌ Erro ao buscar perfil do usuário:', error?.response?.status, error?.message);
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
        type: (updates.type?.toUpperCase() as 'USER' | 'ADMIN') || 'USER',
        cpf: updates.cpf || '',
        phoneNumber: updates.phoneNumber || '',
        address: updates.address || '',
      };
    }

    // Normaliza o type antes de mesclar
    const normalizedType = updates.type 
      ? (updates.type.toUpperCase() as 'USER' | 'ADMIN')
      : existing.type;

    return {
      ...existing,
      ...updates,
      type: normalizedType,
      // Preserva campos quando update é vazio
      address: (updates.address && updates.address.trim() !== '') ? updates.address : existing.address,
      cpf: (updates.cpf && updates.cpf.trim() !== '') ? updates.cpf : existing.cpf,
      phoneNumber: (updates.phoneNumber && updates.phoneNumber.trim() !== '') ? updates.phoneNumber : existing.phoneNumber,
    };
  }

  async saveUser(user: User): Promise<void> {
    try {
      console.log('💾 saveUser called. Candidate to save:', user);

      const existingRaw = await AsyncStorage.getItem('@user_data');
      const existing: User | null = existingRaw ? JSON.parse(existingRaw) : null;

      const finalUser = this.mergeUserData(existing, user);

      console.log('🔄 saveUser -> final merged object:', finalUser);

      await AsyncStorage.setItem('@user_data', JSON.stringify(finalUser));

      // Verificação
      const verify = await AsyncStorage.getItem('@user_data');
      const verifiedUser = verify ? JSON.parse(verify) : null;
      console.log('✅ saveUser verification:', verifiedUser);
    } catch (error) {
      console.error('❌ ERRO ao salvar usuário:', error);
    }
  }

  async getUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem('@user_data');
      if (userData) {
        const user = JSON.parse(userData) as User;
        console.log('✅ getUser -> Usuário recuperado:', user);
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
    try {
      const token = await apiService.getToken();
      console.log('🔍 isAuthenticated -> token present:', !!token);
      
      if (!token) return false;

      // Verifica se é JWT válido
      if (this.isJwt(token)) {
        console.log('🔍 isAuthenticated -> token is valid JWT');
        return true;
      }

      // Token inválido - remove
      console.warn('🔍 isAuthenticated -> token is NOT valid JWT, removing');
      await apiService.removeToken();
      return false;
    } catch (error) {
      console.error('🔍 isAuthenticated -> error:', error);
      return false;
    }
  }

  async getToken(): Promise<string | null> {
    return await apiService.getToken();
  }

  async debugToken(): Promise<void> {
    try {
      const token = await apiService.getToken();
      console.log('🔎 debugToken -> token present:', !!token);
      if (!token) return;

      const masked = token.length > 12 ? `${token.slice(0,6)}...${token.slice(-6)}` : token;
      console.log('🔎 debugToken -> masked token:', masked);

      const parts = token.split('.');
      if (parts.length === 3) {
        console.log('🔎 debugToken -> valid JWT format');
        try {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(base64));
          console.log('🔎 debugToken -> JWT payload:', payload);
        } catch (e) {
          console.warn('🔎 debugToken -> failed to decode payload:', e);
        }
      } else {
        console.warn('🔎 debugToken -> NOT a valid JWT, removing');
        await apiService.removeToken();
      }
    } catch (error) {
      console.error('🔎 debugToken -> error:', error);
    }
  }

  async updateUserData(updates: Partial<User>): Promise<User | null> {
    try {
      const currentUser = await this.getUser();
      if (!currentUser) {
        console.error('❌ updateUserData: nenhum usuário logado');
        return null;
      }
      const updatedUser = this.mergeUserData(currentUser, updates);
      await this.saveUser(updatedUser);
      console.log('✅ Dados do usuário atualizados:', updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('❌ Erro ao atualizar dados:', error);
      return null;
    }
  }

  // LOGIN
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      console.log('🔐 login -> iniciando');
      
      const response = await apiService.instance.post('/auth/login', credentials);
      console.log('📥 login response:', response.data);

      // Backend deve retornar: { token: '...', user: {...} }
      if (!response.data || !response.data.token) {
        throw new Error('Resposta inválida do servidor');
      }

      const { token, user: userFromBackend } = response.data;

      // Valida se é JWT
      if (!this.isJwt(token)) {
        throw new Error('Token inválido recebido do servidor');
      }

      // Salva o token
      await apiService.saveToken(token);

      // Normaliza o user do backend
      if (userFromBackend) {
        userFromBackend.type = (userFromBackend.type?.toUpperCase() || 'USER') as 'USER' | 'ADMIN';
        await this.saveUser(userFromBackend);
        return { token, user: userFromBackend };
      }

      // Fallback: busca perfil completo
      const decoded = this.decodeJWT(token);
      if (decoded?.id) {
        const fullProfile = await this.fetchUserProfile(decoded.id);
        if (fullProfile) {
          await this.saveUser(fullProfile);
          return { token, user: fullProfile };
        }
      }

      // Último fallback: usa dados decodificados do JWT
      const fallbackUser: User = {
        id: decoded?.id || 0,
        email: decoded?.email || credentials.email,
        name: decoded?.name || '',
        type: decoded?.type || 'USER',
        cpf: '',
        phoneNumber: '',
        address: '',
      };
      await this.saveUser(fallbackUser);
      return { token, user: fallbackUser };

    } catch (error: any) {
      console.error('❌ Erro no login:', error?.response?.data || error.message);
      if (error.response) {
        throw new Error(error.response.data?.message || 'Erro ao fazer login');
      }
      throw new Error('Erro de conexão com o servidor');
    }
  }

  // REGISTER
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      console.log('📝 register -> iniciando');

      const response = await apiService.instance.post('/auth/register', userData);
      console.log('📥 register response:', response.data);

      // Backend deve retornar: { token: '...', user: {...} }
      if (!response.data || !response.data.token) {
        throw new Error('Resposta inválida do servidor');
      }

      const { token, user: userFromBackend } = response.data;

      // Valida se é JWT
      if (!this.isJwt(token)) {
        throw new Error('Token inválido recebido do servidor');
      }

      // Salva o token
      await apiService.saveToken(token);

      // Normaliza o user do backend
      if (userFromBackend) {
        userFromBackend.type = (userFromBackend.type?.toUpperCase() || userData.type) as 'USER' | 'ADMIN';
        await this.saveUser(userFromBackend);
        return { token, user: userFromBackend };
      }

      // Fallback: busca perfil completo
      const decoded = this.decodeJWT(token);
      if (decoded?.id) {
        const fullProfile = await this.fetchUserProfile(decoded.id);
        if (fullProfile) {
          await this.saveUser(fullProfile);
          return { token, user: fullProfile };
        }
      }

      // Último fallback: usa dados do registro
      const fallbackUser: User = {
        id: decoded?.id || Date.now(),
        email: userData.email,
        name: userData.name,
        type: userData.type,
        cpf: userData.cpf,
        phoneNumber: userData.phoneNumber,
        address: userData.address,
      };
      await this.saveUser(fallbackUser);
      return { token, user: fallbackUser };

    } catch (error: any) {
      console.error('❌ Erro no register:', error?.response?.data || error.message);
      if (error.response) {
        throw new Error(error.response.data?.message || 'Erro ao cadastrar usuário');
      }
      throw new Error('Erro de conexão com o servidor');
    }
  }

  async logout(): Promise<void> {
    try {
      console.log('👋 logout -> iniciando');
      await apiService.removeToken();
      await AsyncStorage.removeItem('@user_data');
      console.log('✅ logout -> finalizado');
    } catch (error) {
      console.error('❌ Erro no logout:', error);
    }
  }
}

export default new AuthService();