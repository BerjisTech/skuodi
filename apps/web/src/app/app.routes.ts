import { Route } from '@angular/router';
import { authGuard } from './core/services/auth-guard.service';
import { adminGuard } from './core/services/admin.guard';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'planner' },
  {
    path: 'planner',
    loadComponent: () => import('./pages/editor/editor.component').then((m) => m.EditorComponent),
    data: { mode: 'single' },
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup.component').then((m) => m.SignupComponent),
  },
  {
    path: 'spaces',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/dashboard/spaces-list.component').then((m) => m.SpacesListComponent),
      },
      {
        path: ':spaceId',
        loadComponent: () => import('./pages/dashboard/space-detail.component').then((m) => m.SpaceDetailComponent),
      },
      {
        path: ':spaceId/projects/:projectId/edit',
        loadComponent: () => import('./pages/editor/editor.component').then((m) => m.EditorComponent),
      },
    ],
  },
  {
    path: 'marketplace',
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/marketplace/marketplace-list.component').then((m) => m.MarketplaceListComponent),
      },
      {
        path: ':id',
        loadComponent: () => import('./pages/marketplace/marketplace-detail.component').then((m) => m.MarketplaceDetailComponent),
      },
    ],
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account/account.component').then((m) => m.AccountComponent),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/admin/admin.component').then((m) => m.AdminComponent),
  },
  { path: '**', redirectTo: 'planner' },
];
