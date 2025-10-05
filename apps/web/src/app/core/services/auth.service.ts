import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AuthResponse, User } from '../models';

const STORAGE_KEY = 'kouru_auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly userSubject = new BehaviorSubject<User | null>(null);
  private readonly tokenSubject = new BehaviorSubject<string | null>(null);

  readonly user$ = this.userSubject.asObservable();
  readonly token$ = this.tokenSubject.asObservable();

  constructor() {
    const stored = this.loadFromStorage();
    if (stored) {
      this.userSubject.next(stored.user);
      this.tokenSubject.next(stored.token);
      void this.me().subscribe({
        error: () => this.logout(),
      });
    }
  }

  get token(): string | null {
    return this.tokenSubject.value;
  }

  get user(): User | null {
    return this.userSubject.value;
  }

  signup(payload: { email: string; password: string; displayName: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/auth/signup', payload).pipe(
      tap((res) => this.persist(res))
    );
  }

  login(payload: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/auth/login', payload).pipe(
      tap((res) => this.persist(res))
    );
  }

  me(): Observable<User> {
    return this.http.get<User>('/auth/me').pipe(
      tap((user) => {
        const token = this.tokenSubject.value;
        if (token) {
          this.persist({ token, user });
        }
      })
    );
  }

  logout(): void {
    this.tokenSubject.next(null);
    this.userSubject.next(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  private persist(response: AuthResponse) {
    const normalized = this.normalizeResponse(response);
    this.tokenSubject.next(normalized.token);
    this.userSubject.next(normalized.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }

  private loadFromStorage(): AuthResponse | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<AuthResponse>;
      if (!parsed.token || !parsed.user) {
        return null;
      }
      return this.normalizeResponse(parsed as AuthResponse);
    } catch (error) {
      console.warn('Failed to parse auth storage', error);
      return null;
    }
  }

  private normalizeResponse(response: AuthResponse): AuthResponse {
    return {
      token: response.token,
      user: {
        ...response.user,
        isAdmin: response.user.isAdmin ?? false,
      },
    };
  }
}
