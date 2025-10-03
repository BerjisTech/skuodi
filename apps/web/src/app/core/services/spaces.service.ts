import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Space, SpaceInvite, SpaceMember } from '../models';

@Injectable({ providedIn: 'root' })
export class SpacesService {
  private readonly http = inject(HttpClient);
  private readonly spacesSubject = new BehaviorSubject<Space[] | null>(null);
  readonly spaces$ = this.spacesSubject.asObservable();

  loadSpaces(): Observable<Space[]> {
    return this.http.get<Space[]>('/spaces').pipe(tap((spaces) => this.spacesSubject.next(spaces)));
  }

  createSpace(payload: { name: string }): Observable<Space> {
    return this.http.post<Space>('/spaces', payload).pipe(
      tap((space) => {
        const current = this.spacesSubject.value ?? [];
        this.spacesSubject.next([space, ...current]);
      })
    );
  }

  listMembers(spaceId: string): Observable<SpaceMember[]> {
    return this.http.get<SpaceMember[]>(`/spaces/${spaceId}/members`);
  }

  invite(spaceId: string, payload: { email: string; role: string; message?: string }): Observable<SpaceInvite | { status: string }> {
    return this.http.post<SpaceInvite | { status: string }>(`/spaces/${spaceId}/invite`, payload);
  }
}
