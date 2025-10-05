import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { catchError, map, of } from 'rxjs';

const redirectToLogin = (router: Router): UrlTree => router.createUrlTree(['/login']);
const redirectToSpaces = (router: Router): UrlTree => router.createUrlTree(['/spaces']);

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.token;
  if (!token) {
    return redirectToLogin(router);
  }

  const currentUser = auth.user;
  if (currentUser) {
    return currentUser.isAdmin ? true : redirectToSpaces(router);
  }

  return auth.me().pipe(
    map((user) => (user.isAdmin ? true : redirectToSpaces(router))),
    catchError(() => of(redirectToLogin(router)))
  );
};
