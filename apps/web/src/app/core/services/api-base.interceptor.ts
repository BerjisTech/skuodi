import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API_REGEX = /^https?:/i;

export const apiBaseInterceptor: HttpInterceptorFn = (req, next) => {
  if (API_REGEX.test(req.url) || req.url.startsWith('/assets')) {
    return next(req);
  }
  const url = `${environment.apiUrl}${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  return next(req.clone({ url }));
};
