// types/auth.ts

export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: number;
  name: string;
  email: string;
  cpf: string;
  phoneNumber: string;
  address: string;
  type: UserRole;
  role?: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  cpf: string;
  phoneNumber: string;
  address: string;
  type: UserRole;
  role?: UserRole;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  cpf?: string;
  phoneNumber?: string;
  address?: string;
  type?: UserRole;
  role?: UserRole;
}

export interface AuthResponse {
  token: string;
  user: User | null;
}

export interface ApiError {
  message: string;
  status?: number;
}