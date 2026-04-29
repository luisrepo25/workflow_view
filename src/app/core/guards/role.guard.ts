import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../../shared/models';

/**
 * Guard funcional para protección basada en roles
 * Uso: { path: 'admin', component: AdminComponent, canActivate: [roleGuard([ 'ADMIN' ])] }
 */
export function roleGuard(requiredRoles: UserRole[]): CanActivateFn {
  return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Obtener usuario actual
      const currentUser = authService.currentUser();

    if (!currentUser) {
      console.warn('🔒 RoleGuard: No authenticated user');
      router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    // Validar que el usuario tiene uno de los roles requeridos
    if (requiredRoles.includes(currentUser.rol)) {
      console.log(`✅ RoleGuard: User ${currentUser.nombre} has required role (${currentUser.rol})`);
      return true;
    }

    console.warn(`🚫 RoleGuard: User ${currentUser.nombre} has role ${currentUser.rol}, but route requires [${requiredRoles.join(', ')}]`);
    router.navigate(['/dashboard'], { queryParams: { reason: 'insufficient_permissions' } });
    return false;
  };
}
