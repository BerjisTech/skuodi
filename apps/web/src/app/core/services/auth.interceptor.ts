import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has('Authorization') || req.url.startsWith('http')) {
    return next(req);
  }
  const auth = inject(AuthService);
  const token = auth.token;
  if (!token) {
    return next(req);
  }
  const cloned = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
  return next(cloned);
};
