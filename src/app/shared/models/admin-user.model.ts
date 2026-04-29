import { UserRole } from './user.model';

/**
 * Modelo de Usuarios - Roles y Gestión
 */

export type RoleAuthority = 'ROLE_DESIGNER' | 'ROLE_FUNCIONARIO' | 'ROLE_CLIENT' | 'ROLE_ADMIN';

export interface UserAdmin {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  departmentId?: string;
  departmentName?: string;
  activo: boolean;
  telefono?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserCreateRequest {
  nombre: string;
  email: string;
  password: string;
  rol: UserRole;
  departmentId?: string;
  telefono?: string;
  activo?: boolean;
}

export interface UserUpdateRequest {
  nombre?: string;
  email?: string;
  rol?: UserRole;
  departmentId?: string;
  telefono?: string;
  activo?: boolean;
}

export interface UserResponse extends UserAdmin {}
