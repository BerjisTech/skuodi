import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { Asset } from '../models';

@Injectable({ providedIn: 'root' })
export class AssetsService {
  private readonly http = inject(HttpClient);

  requestUpload(payload: { filename: string; contentType?: string; spaceId: string }): Observable<{ storageKey: string; uploadUrl: string }> {
    return this.http.post<{ storageKey: string; uploadUrl: string }>(`/assets/upload-url`, payload);
  }

  create(payload: {
    spaceId: string;
    kind: string;
    title: string;
    description?: string;
    priceCents?: number;
    license?: string;
    storageKey: string;
    previewUrl?: string;
    metadata?: Record<string, unknown>;
  }): Observable<Asset> {
    return this.http.post<Asset>('/assets', payload);
  }

  list(spaceId?: string): Observable<Asset[]> {
    const params = spaceId ? { params: { spaceId } } : {};
    return this.http.get<Asset[]>('/assets', params).pipe(catchError(() => of([])));
  }

  download(assetId: string): Observable<{ downloadUrl: string }> {
    return this.http.get<{ downloadUrl: string }>(`/assets/${assetId}/download`);
  }
}
