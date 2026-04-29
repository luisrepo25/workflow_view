import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpErrorResponse
} from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  console.log('🔐 [AuthInterceptor] Interceptando request:', req.url);
  console.log('🔐 [AuthInterceptor] Token disponible:', !!token);

  if (token) {
    console.log('🔐 [AuthInterceptor] Agregando Bearer token al header');
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        console.warn('⚠️ [AuthInterceptor] Token expirado (401), intentando refrescar...');
        return authService.refreshToken()!.pipe(
          switchMap(() => {
            const newToken = authService.getToken();
            if (newToken) {
              console.log('✅ [AuthInterceptor] Token refrescado, reintentando request');
              req = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${newToken}`
                }
              });
              return next(req);
            }
            return throwError(() => error);
          }),
          catchError(() => {
            console.error('❌ [AuthInterceptor] Fallo refrescar token, cerrando sesión');
            authService.logout();
            return throwError(() => error);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
