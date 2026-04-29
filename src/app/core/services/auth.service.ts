import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { AuthResponse, LoginRequest, RegisterRequest, ChangePasswordRequest, CurrentUser, UserRole } from '../../shared/models';
import { environment } from '../config/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.authUrl;
  private http = inject(HttpClient);

  // Signal para usuario actual
  private currentUserSignal = signal<CurrentUser | null>(null);
  currentUser = computed(() => this.currentUserSignal());

  // Signal para token
  private tokenSignal = signal<string | null>(null);
  token = computed(() => this.tokenSignal());

  // Signal para loading
  private loadingSignal = signal(false);
  isLoading = computed(() => this.loadingSignal());

  // Signal para errores
  private errorSignal = signal<string | null>(null);
  error = computed(() => this.errorSignal());

  // Observable para logout (para casos donde se necesita RxJS)
  private logoutSubject = new BehaviorSubject<boolean>(false);
  logout$ = this.logoutSubject.asObservable();

  constructor() {
    this.loadTokenFromStorage();
  }

  /**
   * Login con email y contraseña
   */
  login(request: LoginRequest) {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap(response => {
        this.handleAuthResponse(response);
        this.loadingSignal.set(false);
      }),
      tap(() => this.errorSignal.set(null))
    );
  }

  /**
   * Registro de nuevo usuario
   */
  register(request: RegisterRequest) {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, request).pipe(
      tap(response => {
        this.handleAuthResponse(response);
        this.loadingSignal.set(false);
      }),
      tap(() => this.errorSignal.set(null))
    );
  }

  /**
   * Registro de nuevo usuario (para administrador, sin iniciar sesión)
   */
  registerWithoutLogin(request: RegisterRequest) {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, request).pipe(
      tap(() => {
        this.loadingSignal.set(false);
      }),
      tap(() => this.errorSignal.set(null))
    );
  }

  /**
   * Refrescar token
   */
  refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      this.clearAuth();
      return;
    }

    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, { refreshToken }).pipe(
      tap(response => this.handleAuthResponse(response))
    );
  }

  /**
   * Cambiar contraseña
   */
  changePassword(request: ChangePasswordRequest) {
    return this.http.post(`${this.apiUrl}/change-password`, request);
  }

  /**
   * Logout
   */
  logout() {
    this.clearAuth();
    this.logoutSubject.next(true);

    // Best effort: notificar al backend si está disponible.
    this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
      error: () => {
        // Ya se limpió la sesión local; no se requiere acción adicional.
      }
    });
  }

  /**
   * Check si está autenticado
   */
  isAuthenticated(): boolean {
    return this.tokenSignal() !== null && this.currentUserSignal() !== null;
  }

  /**
   * Verificar si el usuario actual tiene un rol especifico
   */
  hasRole(role: string): boolean {
    const user = this.currentUserSignal();
    if (!user) return false;
    return user.rol === role;
  }

  /**
   * Obtener token actual
   */
  getToken(): string | null {
    return this.tokenSignal();
  }

  /**
   * Manejo privado de respuesta de autenticación
   */
  private handleAuthResponse(response: AuthResponse) {
    const role = this.normalizeRole(response.user.roleName ?? response.user.rol);
    const user: CurrentUser = {
      ...response.user,
      rol: role ?? 'Cliente',
      departmentId: response.user.departmentId ?? undefined,
      activo: response.user.activo ?? true,
      token: response.accessToken
    };

    this.currentUserSignal.set(user);
    this.tokenSignal.set(response.accessToken);

    // Guardar en localStorage
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  /**
   * Cargar token desde localStorage
   */
  private loadTokenFromStorage() {
    const token = localStorage.getItem('accessToken');
    const userJson = localStorage.getItem('currentUser');

    if (token && userJson) {
      this.tokenSignal.set(token);
      try {
        const parsedUser = JSON.parse(userJson) as CurrentUser & { roleName?: string };
        const normalizedRole = this.normalizeRole(parsedUser.roleName ?? parsedUser.rol);
        this.currentUserSignal.set({
          ...parsedUser,
          rol: normalizedRole ?? 'Cliente',
          departmentId: parsedUser.departmentId ?? undefined,
          activo: parsedUser.activo ?? true
        });
      } catch (e) {
        console.error('Error parsing stored user:', e);
        this.clearAuth();
      }
    }
  }

  private normalizeRole(rawRole: string | undefined | null): UserRole | null {
    if (!rawRole) {
      return null;
    }

    const normalized = rawRole
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    if (normalized === 'disenador' || normalized === 'designer' || normalized === 'role_designer') {
      return 'Diseñador';
    }

    if (normalized === 'funcionario' || normalized === 'role_funcionario') {
      return 'Funcionario';
    }

    if (normalized === 'cliente' || normalized === 'client' || normalized === 'role_client') {
      return 'Cliente';
    }

    if (normalized === 'admin' || normalized === 'administrador' || normalized === 'role_admin') {
      return 'Admin';
    }

    return null;
  }

  /**
   * Limpiar autenticación
   */
  private clearAuth() {
    this.tokenSignal.set(null);
    this.currentUserSignal.set(null);
    this.errorSignal.set(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentUser');
  }
}
