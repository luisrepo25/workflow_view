export type UserRole = 'Diseñador' | 'Funcionario' | 'Cliente' | 'Admin';

export interface AuthUserPayload {
  id: string;
  nombre: string;
  email: string;
  roleName?: string;
  rol?: UserRole;
  departmentId?: string | null;
  departmentName?: string;
  activo?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn: number;
  user: AuthUserPayload;
}

export interface UserInfo {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  departmentId?: string;
  departmentName?: string;
  activo?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
  departmentId?: string;
  role?: UserRole;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface CurrentUser extends UserInfo {
  token: string;
}
