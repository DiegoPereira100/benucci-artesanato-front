// src/hooks/useAuth.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import authService from '../services/auth';
import { User, LoginRequest, RegisterRequest } from '../types/auth';

interface AuthContextData {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
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
        setUser(userData);
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(credentials: LoginRequest) {
    try {
      console.log('=== DEBUG LOGIN no useAuth ===');
      console.log('Chamando authService.login...');
      
      const response = await authService.login(credentials);
      console.log('Response é um JWT token:', typeof response === 'string');
      
      if (typeof response === 'string') {
        // Response é um JWT token - vamos decodificar
        console.log('Decodificando JWT token...');
        
        try {
          // Garantir que response é string para TypeScript
          const token = response as string;
          
          // Decodifica o payload do JWT (parte do meio)
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('Payload do JWT:', payload);
          
          // Cria o objeto user a partir do payload
          const userData: User = {
            id: payload.id,
            email: payload.sub, // 'sub' é o email no JWT
            name: payload.name,
            type: payload.type,
            // Propriedades que podem não estar no JWT - definir como null ou string vazia
            cpf: payload.cpf || '',
            phoneNumber: payload.phoneNumber || '',
            address: payload.address || '',
            // Adicione outras propriedades obrigatórias do tipo User aqui se necessário
          };
          
          console.log('Dados do usuário extraídos:', userData);
          setUser(userData);
          
          // Salvar o token para futuras requisições
          // Você pode implementar isso no authService se necessário
          
        } catch (decodeError) {
          console.error('Erro ao decodificar JWT:', decodeError);
          throw new Error('Erro ao processar dados de autenticação');
        }
        
      } else if (response && typeof response === 'object' && 'user' in response) {
        // Caso seja um objeto com user (fallback)
        console.log('Response é objeto com user');
        const responseObj = response as any;
        setUser(responseObj.user);
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
        setUser(response.user);
        // O _layout.tsx vai detectar e redirecionar para home
      } else if (typeof response === 'string') {
        // Se retorna JWT como string (similar ao login)
        console.log('Registro retornou JWT token');
        try {
          const token = response as string;
          const payload = JSON.parse(atob(token.split('.')[1]));
          
          const userData: User = {
            id: payload.id,
            email: payload.sub,
            name: payload.name,
            type: payload.type,
            cpf: payload.cpf || '',
            phoneNumber: payload.phoneNumber || '',
            address: payload.address || '',
          };
          
          setUser(userData);
          // O _layout.tsx vai detectar e redirecionar para home
        } catch (decodeError) {
          console.error('Erro ao decodificar JWT do register:', decodeError);
        }
      } else if (response && typeof response === 'object') {
        // Se retorna diretamente os dados do usuário (como no seu caso)
        const responseObj = response as any;
        
        if (responseObj.id && responseObj.email) {
          console.log('Registro retornou dados do usuário diretamente - fazendo login automático');
          
          const userData: User = {
            id: responseObj.id,
            email: responseObj.email,
            name: responseObj.name,
            type: responseObj.type,
            cpf: responseObj.cpf || '',
            phoneNumber: responseObj.phoneNumber || '',
            address: responseObj.address || '',
          };
          
          setUser(userData);
          // O _layout.tsx vai detectar e redirecionar para home
        } else {
          console.log('Objeto response não contém id e email');
        }
      } else {
        console.log('Registro não fez login automático - usuário deve fazer login manualmente');
        // Não setar user - usuário permanece na área de auth
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
      // Deixar o _layout.tsx gerenciar a navegação para /auth/login
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