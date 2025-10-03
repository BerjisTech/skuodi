import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Project, DocSnapshot } from '../models';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);

  createProject(payload: { spaceId: string; name: string }): Observable<Project> {
    return this.http.post<Project>('/projects', payload);
  }

  list(spaceId: string): Observable<Project[]> {
    return this.http.get<Project[]>(`/spaces/${spaceId}/projects`);
  }

  get(projectId: string): Observable<Project> {
    return this.http.get<Project>(`/projects/${projectId}`);
  }

  getDoc(projectId: string, kind: 'plan2d' | 'scene3d' | 'notes'): Observable<{ id: string; ydoc: string }> {
    return this.http.get<{ id: string; ydoc: string }>(`/projects/${projectId}/docs/${kind}`);
  }

  saveDoc(
    projectId: string,
    kind: 'plan2d' | 'scene3d' | 'notes',
    payload: { ydoc: string; metadata?: unknown }
  ): Observable<{ id: string; ydoc: string }> {
    return this.http.put<{ id: string; ydoc: string }>(`/projects/${projectId}/docs/${kind}`, payload);
  }

  snapshots(projectId: string, kind: 'plan2d' | 'scene3d' | 'notes'): Observable<DocSnapshot[]> {
    return this.http.get<DocSnapshot[]>(`/projects/${projectId}/docs/${kind}/snapshots`);
  }
}
