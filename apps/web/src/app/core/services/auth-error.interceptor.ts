import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { catchError, throwError } from 'rxjs';

const AUTH_WHITELIST = ['/auth/login', '/auth/signup'];

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        const isWhitelisted = AUTH_WHITELIST.some((path) => req.url.includes(path));
        if (!isWhitelisted) {
          const currentUrl = router.url;
          const onLoginRoute = currentUrl.startsWith('/login');
          auth.logout();
          const extras = !onLoginRoute && !req.url.includes('/auth/') ? { queryParams: { next: currentUrl } } : undefined;
          void router.navigate(['/login'], extras);
        }
      }
      return throwError(() => error);
    })
  );
};
