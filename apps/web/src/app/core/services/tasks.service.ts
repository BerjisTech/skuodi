import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Task } from '../models';

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly http = inject(HttpClient);

  list(projectId: string): Observable<Task[]> {
    return this.http.get<Task[]>('/tasks', { params: { projectId } });
  }

  create(payload: {
    projectId: string;
    title: string;
    description?: string;
    status?: Task['status'];
    assigneeId?: string;
    dueAt?: string;
    anchor?: Record<string, unknown>;
  }): Observable<Task> {
    return this.http.post<Task>('/tasks', payload);
  }

  update(taskId: string, payload: Partial<Omit<Task, 'id' | 'projectId' | 'author' | 'createdAt' | 'updatedAt'>>): Observable<Task> {
    return this.http.patch<Task>(`/tasks/${taskId}`, payload);
  }
}
