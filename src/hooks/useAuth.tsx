// src/hooks/useAuth.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import authService from '../services/auth';
import { User, LoginRequest, RegisterRequest } from '../types/auth';

interface AuthContextData {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<User>; // ✅ Agora retorna User
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  async function checkAuthStatus() {
    try {
      const isAuth = await authService.isAuthenticated();
      if (isAuth) {
        const userData = await authService.getUser();
        if (userData) {
          // normaliza o tipo salvo (pode vir como 'CUSTOMER' do passado)
          const normalizedType = (userData.type || '').toString().toLowerCase() === 'admin' ? 'ADMIN' : 'USER';
          if (userData.type !== normalizedType) {
            const updated = { ...userData, type: normalizedType } as User;
            await authService.saveUser(updated);
            setUser(updated);
          } else {
            setUser(userData);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(credentials: LoginRequest): Promise<User> {
    try {
      console.log('=== DEBUG LOGIN no useAuth ===');
      console.log('Chamando authService.login...');
      
      const response = await authService.login(credentials);
      console.log('Response do login:', typeof response);
      
      let userData: User;
      
      if (typeof response === 'string') {
        // Response é um JWT token - vamos decodificar
        console.log('Decodificando JWT token...');
        
        try {
          const token = response as string;
          
          // Decodifica o payload do JWT (parte do meio)
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(base64));
          console.log('Payload do JWT:', payload);
          
          // ✅ CORREÇÃO: O backend retorna 'role' com valores 'admin' ou 'customer'
          // Precisamos mapear para o formato esperado pelo frontend
          const userRole = payload.role === 'admin' ? 'ADMIN' : 'USER';
          
          // Cria o objeto user a partir do payload
          userData = {
            id: payload.id,
            email: payload.sub, // 'sub' é o email no JWT
            name: payload.name || payload.email, // fallback caso name não exista
            type: userRole, // ✅ Mapeia 'admin'/'customer' para 'ADMIN'/'USER'
            cpf: payload.cpf || '',
            phoneNumber: payload.phoneNumber || '',
            address: payload.address || '',
          };
          
          console.log('✅ Dados do usuário extraídos:', userData);
          setUser(userData);
          
          return userData;
          
        } catch (decodeError) {
          console.error('Erro ao decodificar JWT:', decodeError);
          throw new Error('Erro ao processar dados de autenticação');
        }
        
      } else if (response && typeof response === 'object' && 'user' in response) {
        // Caso seja um objeto com user (fallback)
        console.log('Response é objeto com user');
        const responseObj = response as any;
        const rawUser = responseObj.user as User;
        // normaliza tipo
        const normalizedType = (rawUser.type || '').toString().toLowerCase() === 'admin' ? 'ADMIN' : 'USER';
        userData = { ...rawUser, type: normalizedType } as User;
        // persiste a versão normalizada
        try {
          await authService.saveUser(userData);
        } catch (e) {
          console.warn('Falha ao salvar usuário normalizado:', e);
        }
        setUser(userData);
        return userData;
      } else {
        console.log('❌ Formato de response não reconhecido');
        throw new Error('Formato de resposta inválido');
      }
      
    } catch (error: any) {
      console.error('Erro no login:', error);
      throw error;
    }
  }

  async function register(userData: RegisterRequest) {
    try {
      console.log('=== DEBUG REGISTER no useAuth ===');
      const response = await authService.register(userData);
      console.log('Response do register:', response);
      
      // Verificar se o registro faz login automático
      if (response.token && response.user) {
        console.log('Registro fez login automático com token');
        const rawUser = response.user as User;
        const normalizedType = (rawUser.type || '').toString().toLowerCase() === 'admin' ? 'ADMIN' : 'USER';
        const normalizedUser = { ...rawUser, type: normalizedType } as User;
        try {
          await authService.saveUser(normalizedUser);
        } catch (e) {
          console.warn('Falha ao salvar usuário do register:', e);
        }
        setUser(normalizedUser);
      } else if (typeof response === 'string') {
        // Se retorna JWT como string (similar ao login)
        console.log('Registro retornou JWT token');
        try {
          const token = response as string;
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(base64));
          
          const userRole = (payload.role || '').toString().toLowerCase() === 'admin' ? 'ADMIN' : 'USER';
          
          const userData: User = {
            id: payload.id,
            email: payload.sub,
            name: payload.name || payload.email,
            type: userRole,
            cpf: payload.cpf || '',
            phoneNumber: payload.phoneNumber || '',
            address: payload.address || '',
          };
          
          try {
            await authService.saveUser(userData);
          } catch (e) {
            console.warn('Falha ao salvar usuário decodificado do register:', e);
          }
          setUser(userData);
        } catch (decodeError) {
          console.error('Erro ao decodificar JWT do register:', decodeError);
        }
      } else if (response && typeof response === 'object') {
        // Se retorna diretamente os dados do usuário
        const responseObj = response as any;
        
        if (responseObj.id && responseObj.email) {
          console.log('Registro retornou dados do usuário diretamente');
          const userRole = (responseObj.role || '').toString().toLowerCase() === 'admin' ? 'ADMIN' : 'USER';
          const userData: User = {
            id: responseObj.id,
            email: responseObj.email,
            name: responseObj.name,
            type: userRole,
            cpf: responseObj.cpf || '',
            phoneNumber: responseObj.phoneNumber || '',
            address: responseObj.address || '',
          };
          try {
            await authService.saveUser(userData);
          } catch (e) {
            console.warn('Falha ao salvar usuário retornado no register:', e);
          }
          setUser(userData);
        } else {
          console.log('Objeto response não contém id e email');
        }
      } else {
        console.log('Registro não fez login automático');
      }
      
    } catch (error: any) {
      console.error('Erro no cadastro:', error);
      throw error;
    }
  }

  async function logout() {
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}