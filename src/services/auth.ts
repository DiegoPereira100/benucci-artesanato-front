import apiService from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoginRequest, RegisterRequest, AuthResponse, User } from '../types/auth';

class AuthService {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await apiService.instance.post('/auth/login', credentials);
      
      const token = response.data.token || response.data;
      
      if (token) {
        await apiService.saveToken(token);
        
        if (response.data.user) {
          await this.saveUser(response.data.user);
        }
      }
      
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(error.response.data.message || 'Erro ao fazer login');
      }
      throw new Error('Erro de conexão com o servidor');
    }
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await apiService.instance.post('/auth/register', userData);
      
      if (response.data.token) {
        await apiService.saveToken(response.data.token);
        
        if (response.data.user) {
          await this.saveUser(response.data.user);
        }
      }
      
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(error.response.data.message || 'Erro ao cadastrar usuário');
      }
      throw new Error('Erro de conexão com o servidor');
    }
  }

  async logout(): Promise<void> {
    await apiService.removeToken();
    await AsyncStorage.removeItem('@user_data');
  }

  async saveUser(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem('@user_data', JSON.stringify(user));
    } catch (error) {
      console.error('Erro ao salvar dados do usuário:', error);
    }
  }

  async getUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem('@user_data');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await apiService.getToken();
    return !!token;
  }
}

export default new AuthService();