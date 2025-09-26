// types/auth.ts

export interface User {
  id: number;
  name: string;
  email: string;
  cpf: string;
  phoneNumber: string;
  address: string;
  type: 'CUSTOMER' | 'ADMIN';
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
  type: 'CUSTOMER' | 'ADMIN';
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  message: string;
  status?: number;
}