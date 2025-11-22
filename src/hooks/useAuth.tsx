// src/hooks/useAuth.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import authService from '../services/auth';
import userService from '../services/userService';
import { User, LoginRequest, RegisterRequest, UpdateUserRequest } from '../types/auth';
import { parseAddress, serializeAddress, hasAddressInformation, addressPartsAreEqual } from '../utils/address';
import { API_BASE_URL } from '@env';

interface AuthContextData {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<User>; // ✅ Agora retorna User
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  updateProfile: (updates: UpdateUserRequest) => Promise<User | null>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

const toStoredAddressString = (value?: string): string => {
  const parsed = parseAddress(value);
  return hasAddressInformation(parsed) ? serializeAddress(parsed) : '';
};

const normalizeRoleValue = (value?: string | null): 'ADMIN' | 'USER' => {
  if (!value) {
    return 'USER';
  }

  const normalized = value
    .toString()
    .trim()
    .toUpperCase()
    .replace(/^ROLE_/, '');

  return normalized === 'ADMIN' ? 'ADMIN' : 'USER';
};

const hasUserChanged = (current: User | null, next: User): boolean => {
  if (!current) return true;
  const addressChanged = !addressPartsAreEqual(parseAddress(current.address), parseAddress(next.address));

  return (
    current.id !== next.id ||
    current.name !== next.name ||
    current.email !== next.email ||
    current.cpf !== next.cpf ||
    current.phoneNumber !== next.phoneNumber ||
    addressChanged ||
    current.type !== next.type
  );
};

const decodeUserIdFromToken = (token: string): number | null => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    let decodedPayload: string;

    if (typeof atob === 'function') {
      decodedPayload = atob(base64);
    } else {
      const globalBuffer = (globalThis as any)?.Buffer;
      if (globalBuffer) {
        decodedPayload = globalBuffer.from(base64, 'base64').toString('utf-8');
      } else {
        console.warn('decodeUserIdFromToken -> nenhum decodificador base64 disponível');
        return null;
      }
    }

    const payload = JSON.parse(decodedPayload);
    const rawId = payload?.id ?? payload?.userId ?? payload?.user_id ?? payload?.userID;

    if (rawId === undefined || rawId === null) {
      return null;
    }

    const numericId = typeof rawId === 'string' ? parseInt(rawId, 10) : Number(rawId);
    return Number.isFinite(numericId) && numericId > 0 ? numericId : null;
  } catch (error) {
    console.error('decodeUserIdFromToken -> erro ao extrair ID do token:', error);
    return null;
  }
};

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
          const normalizedType = normalizeRoleValue(userData.role ?? userData.type);
          const normalizedAddress = toStoredAddressString(userData.address);
          if (userData.type !== normalizedType || userData.role !== normalizedType) {
            const updated = { ...userData, type: normalizedType, role: normalizedType, address: normalizedAddress } as User;
            await authService.saveUser(updated);
            setUser(updated);
          } else if (userData.address !== normalizedAddress) {
            const updated = { ...userData, address: normalizedAddress } as User;
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

  async function login(credentials: LoginRequest) {
    console.log(API_BASE_URL)
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
          const userRole = normalizeRoleValue(payload.role ?? payload.type ?? payload.userType);
          const addressString = toStoredAddressString(payload.address);
          
          // Cria o objeto user a partir do payload
          userData = {
            id: payload.id,
            email: payload.sub, // 'sub' é o email no JWT
            name: payload.name || payload.email, // fallback caso name não exista
            type: userRole, // ✅ Mapeia 'admin'/'customer' para 'ADMIN'/'USER'
            role: userRole,
            cpf: payload.cpf || '',
            phoneNumber: payload.phoneNumber || '',
            address: addressString,
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
        const normalizedType = normalizeRoleValue(rawUser.role ?? rawUser.type);
        const normalizedAddress = toStoredAddressString(rawUser.address);
        userData = { ...rawUser, type: normalizedType, role: normalizedType, address: normalizedAddress } as User;
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
        const normalizedType = normalizeRoleValue(rawUser.role ?? rawUser.type);
        const normalizedAddress = toStoredAddressString(rawUser.address);
        const normalizedUser = { ...rawUser, type: normalizedType, role: normalizedType, address: normalizedAddress } as User;
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
          
          const userRole = normalizeRoleValue(payload.role ?? payload.type);
          const addressString = toStoredAddressString(payload.address);
          
          const userData: User = {
            id: payload.id,
            email: payload.sub,
            name: payload.name || payload.email,
            type: userRole,
            role: userRole,
            cpf: payload.cpf || '',
            phoneNumber: payload.phoneNumber || '',
            address: addressString,
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
          const userRole = normalizeRoleValue(responseObj.role ?? responseObj.type);
          const addressString = toStoredAddressString(responseObj.address);
          const userData: User = {
            id: responseObj.id,
            email: responseObj.email,
            name: responseObj.name,
            type: userRole,
            role: userRole,
            cpf: responseObj.cpf || '',
            phoneNumber: responseObj.phoneNumber || '',
            address: addressString,
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

  const resolveUserAndId = useCallback(async (): Promise<{ stored: User | null; id: number | null }> => {
    const stored = user ?? (await authService.getUser());
    let resolvedId = stored?.id && stored.id > 0 ? stored.id : null;
    let workingUser = stored ?? null;

    if (!resolvedId) {
      const token = await authService.getToken();
      const decodedId = token ? decodeUserIdFromToken(token) : null;
      if (decodedId && decodedId > 0) {
        resolvedId = decodedId;
      }
    }

    if (!resolvedId && workingUser?.email) {
      try {
        const fetched = await userService.getUserByEmail(workingUser.email);
        if (fetched?.id && fetched.id > 0) {
          resolvedId = fetched.id;
          workingUser = fetched;
          if (!user || hasUserChanged(user, fetched)) {
            setUser(fetched);
          }
          try {
            await authService.saveUser(fetched);
          } catch (saveError) {
            console.warn('resolveUserAndId -> falha ao persistir usuário recuperado por email:', saveError);
          }
        }
      } catch (error) {
        console.warn('resolveUserAndId -> erro ao buscar usuário por e-mail:', error);
      }
    }

    if (resolvedId && workingUser && workingUser.id !== resolvedId) {
      const enrichedUser = { ...workingUser, id: resolvedId } as User;
      workingUser = enrichedUser;
      if (!user || hasUserChanged(user, enrichedUser)) {
        setUser(enrichedUser);
      }
      try {
        await authService.saveUser(enrichedUser);
      } catch (saveError) {
        console.warn('resolveUserAndId -> falha ao persistir usuário enriquecido:', saveError);
      }
    }

    if (!workingUser && resolvedId) {
      try {
        const fetched = await userService.getUserById(resolvedId);
        workingUser = fetched;
        if (!user || hasUserChanged(user, fetched)) {
          setUser(fetched);
        }
        try {
          await authService.saveUser(fetched);
        } catch (saveError) {
          console.warn('resolveUserAndId -> falha ao persistir usuário recuperado por id:', saveError);
        }
      } catch (error) {
        console.warn('resolveUserAndId -> erro ao buscar usuário por id:', error);
      }
    }

    return { stored: workingUser ?? null, id: resolvedId && resolvedId > 0 ? resolvedId : null };
  }, [user]);

  const refreshUserProfile = useCallback(async (): Promise<User | null> => {
    try {
      const { stored, id } = await resolveUserAndId();
      if (!id) {
        console.warn('refreshUserProfile -> no user id available');
        return null;
      }

      const latest = await userService.getUserById(id);
      const referenceUser = stored ?? user;

      if (!hasUserChanged(referenceUser, latest)) {
        if (!referenceUser) {
          setUser(latest);
        }
        return referenceUser ?? latest;
      }

      await authService.saveUser(latest);
      setUser(latest);
      return latest;
    } catch (error) {
      console.error('Erro ao atualizar dados do usuário:', error);
      return null;
    }
  }, [resolveUserAndId, user]);

  const updateProfile = useCallback(async (updates: UpdateUserRequest): Promise<User | null> => {
    try {
      const { id } = await resolveUserAndId();
      if (!id) {
        console.warn('updateProfile -> no user id available');
        return null;
      }

      const payload: UpdateUserRequest = { ...updates };
      if (payload.type) {
        payload.type = payload.type.toUpperCase() as 'USER' | 'ADMIN';
      }

      const updated = await userService.updateUser(id, payload);
      await authService.saveUser(updated);
      setUser(updated);
      return updated;
    } catch (error) {
      console.error('Erro ao salvar perfil do usuário:', error);
      throw error;
    }
  }, [resolveUserAndId]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser: refreshUserProfile,
        updateProfile,
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