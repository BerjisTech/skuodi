import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Comment } from '../models';

@Injectable({ providedIn: 'root' })
export class CommentsService {
  private readonly http = inject(HttpClient);

  list(projectId: string): Observable<Comment[]> {
    return this.http.get<Comment[]>('/comments', { params: { projectId } });
  }

  create(payload: {
    projectId: string;
    body: string;
    category?: string;
    anchor?: Record<string, unknown>;
  }): Observable<Comment> {
    return this.http.post<Comment>('/comments', payload);
  }
}
