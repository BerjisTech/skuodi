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
    this.tokenSubject.next(response.token);
    this.userSubject.next(response.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response));
  }

  private loadFromStorage(): AuthResponse | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AuthResponse;
    } catch (error) {
      console.warn('Failed to parse auth storage', error);
      return null;
    }
  }
}
